import uuid
import os
import base64
import zipfile
import io
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from app.core.database import db
from app.routes.auth import get_current_user
from app.services.s3 import s3_enabled, upload_bytes, download_bytes, delete_object, presigned_url
from app.services.pdf_parser import extract_text_from_pdf

router = APIRouter()

UPLOAD_DIR = "/app/backend/uploads/attachments"
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# File types that the LLM can accept as binary (via Files API / base64)
BINARY_TYPES = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"}
# File types where we extract text
TEXT_TYPES = {".txt", ".csv", ".md", ".docx"}
# Archives
ARCHIVE_TYPES = {".zip"}

ALLOWED_EXTENSIONS = BINARY_TYPES | TEXT_TYPES | ARCHIVE_TYPES


class AttachmentResponse(BaseModel):
    id: str
    project_id: str
    name: str
    file_type: str  # "pdf", "image", "text", "url", "zip"
    content_type: Optional[str] = None
    size: Optional[int] = None
    source_url: Optional[str] = None
    extracted_text: Optional[str] = None
    file_path: Optional[str] = None
    created_at: str


class AddUrlRequest(BaseModel):
    url: str
    name: Optional[str] = None


def get_file_type(ext: str) -> str:
    if ext == ".pdf":
        return "pdf"
    if ext in {".png", ".jpg", ".jpeg", ".webp", ".gif"}:
        return "image"
    if ext in {".txt", ".csv", ".md", ".docx"}:
        return "text"
    if ext == ".zip":
        return "zip"
    return "unknown"


def extract_text_from_file(file_path: str, ext: str) -> Optional[str]:
    """Extract text content from text-based files."""
    try:
        if ext in {".txt", ".csv", ".md"}:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        if ext == ".docx":
            from docx import Document
            doc = Document(file_path)
            return "\n".join(p.text for p in doc.paragraphs)
    except Exception as e:
        return f"[Ошибка извлечения текста: {e}]"
    return None


def process_zip(file_path: str) -> list:
    """Extract files from ZIP and process each one. Returns list of attachment dicts."""
    results = []
    try:
        with zipfile.ZipFile(file_path, "r") as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                ext = os.path.splitext(info.filename)[1].lower()
                if ext not in (BINARY_TYPES | TEXT_TYPES):
                    continue

                inner_data = zf.read(info)
                inner_id = uuid.uuid4().hex
                inner_safe = f"{inner_id}_{os.path.basename(info.filename)}"

                s3_key = None
                inner_path = None
                if s3_enabled():
                    s3_key = f"attachments/{inner_safe}"
                    upload_bytes(s3_key, inner_data)
                else:
                    inner_path = os.path.join(UPLOAD_DIR, inner_safe)
                    with open(inner_path, "wb") as dst:
                        dst.write(inner_data)

                extracted = None
                if ext in TEXT_TYPES:
                    if s3_enabled():
                        extracted = inner_data.decode("utf-8", errors="replace")
                    else:
                        extracted = extract_text_from_file(inner_path, ext)

                results.append({
                    "name": info.filename,
                    "ext": ext,
                    "file_path": inner_path,
                    "s3_key": s3_key,
                    "file_type": get_file_type(ext),
                    "size": info.file_size,
                    "extracted_text": extracted,
                })
    except Exception as e:
        results.append({
            "name": os.path.basename(file_path),
            "ext": ".zip",
            "file_path": file_path,
            "s3_key": None,
            "file_type": "zip",
            "size": 0,
            "extracted_text": f"[Ошибка распаковки ZIP: {e}]",
        })
    return results


@router.post("/projects/{project_id}/attachments", response_model=List[AttachmentResponse])
async def upload_attachment(
    project_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Формат {ext} не поддерживается. Поддерживаются: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    # Save file
    file_id = uuid.uuid4().hex
    safe_name = f"{file_id}_{file.filename}"

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Файл превышает 100MB")

    now = datetime.now(timezone.utc).isoformat()
    created_attachments = []

    if ext in ARCHIVE_TYPES:
        # Save ZIP locally temporarily for extraction
        tmp_path = os.path.join(UPLOAD_DIR, safe_name)
        with open(tmp_path, "wb") as f:
            f.write(content)
        inner_files = process_zip(tmp_path)
        # Remove temp ZIP
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        for inner in inner_files:
            att_id = str(uuid.uuid4())
            doc = {
                "id": att_id,
                "project_id": project_id,
                "name": inner["name"],
                "file_type": inner["file_type"],
                "content_type": None,
                "size": inner["size"],
                "source_url": None,
                "extracted_text": inner.get("extracted_text"),
                "file_path": inner.get("file_path"),
                "s3_key": inner.get("s3_key"),
                "created_at": now,
            }
            await db.attachments.insert_one(doc)
            created_attachments.append(AttachmentResponse(**{k: v for k, v in doc.items() if k != "s3_key"}))
    else:
        # Single file
        s3_key = None
        file_path = None
        if s3_enabled():
            s3_key = f"attachments/{safe_name}"
            upload_bytes(s3_key, content, file.content_type or "application/octet-stream")
        else:
            file_path = os.path.join(UPLOAD_DIR, safe_name)
            with open(file_path, "wb") as f:
                f.write(content)

        extracted = None
        if ext in TEXT_TYPES:
            if s3_enabled():
                extracted = content.decode("utf-8", errors="replace")
            else:
                extracted = extract_text_from_file(file_path, ext)
        elif ext == ".pdf":
            extracted = extract_text_from_pdf(content)

        att_id = str(uuid.uuid4())
        doc = {
            "id": att_id,
            "project_id": project_id,
            "name": file.filename,
            "file_type": get_file_type(ext),
            "content_type": file.content_type,
            "size": len(content),
            "source_url": None,
            "extracted_text": extracted,
            "file_path": file_path,
            "s3_key": s3_key,
            "created_at": now,
        }
        await db.attachments.insert_one(doc)
        created_attachments.append(AttachmentResponse(**{k: v for k, v in doc.items() if k != "s3_key"}))

    return created_attachments


@router.post("/projects/{project_id}/attachments/url", response_model=AttachmentResponse)
async def add_url_attachment(
    project_id: str,
    data: AddUrlRequest,
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    att_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    name = data.name or data.url[:80]
    doc = {
        "id": att_id,
        "project_id": project_id,
        "name": name,
        "file_type": "url",
        "content_type": None,
        "size": None,
        "source_url": data.url,
        "extracted_text": None,
        "file_path": None,
        "created_at": now,
    }
    await db.attachments.insert_one(doc)
    return AttachmentResponse(**doc)


@router.get("/projects/{project_id}/attachments", response_model=List[AttachmentResponse])
async def list_attachments(
    project_id: str,
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    items = await db.attachments.find(
        {"project_id": project_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    return [AttachmentResponse(**a) for a in items]


@router.delete("/projects/{project_id}/attachments/{attachment_id}")
async def delete_attachment(
    project_id: str,
    attachment_id: str,
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    att = await db.attachments.find_one({"id": attachment_id, "project_id": project_id}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Delete file from storage
    if att.get("s3_key"):
        delete_object(att["s3_key"])
    elif att.get("file_path") and os.path.exists(att["file_path"]):
        os.remove(att["file_path"])

    await db.attachments.delete_one({"id": attachment_id})
    return {"message": "Deleted"}


@router.get("/projects/{project_id}/attachments/{attachment_id}/download")
async def download_attachment(
    project_id: str,
    attachment_id: str,
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    att = await db.attachments.find_one({"id": attachment_id, "project_id": project_id}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if att.get("s3_key"):
        url = presigned_url(att["s3_key"], expires=3600)
        return RedirectResponse(url=url)

    if att.get("file_path") and os.path.exists(att["file_path"]):
        from fastapi.responses import FileResponse
        return FileResponse(att["file_path"], filename=att.get("name", "file"))

    raise HTTPException(status_code=404, detail="File not found")

async def build_attachment_context(attachment_ids: List[str], project_id: str):
    """
    Build additional content for LLM messages from selected attachments.
    Returns:
      - text_parts: list of strings to append to user_message
      - file_parts: list of content parts for multimodal messages (images, PDFs)
    """
    if not attachment_ids:
        return [], []

    attachments = await db.attachments.find(
        {"id": {"$in": attachment_ids}, "project_id": project_id},
        {"_id": 0}
    ).to_list(100)

    text_parts = []
    file_parts = []

    for att in attachments:
        ft = att.get("file_type", "")

        if ft == "url":
            text_parts.append(f"Также изучи информацию по ссылке: {att['source_url']}")

        elif ft == "text":
            if att.get("extracted_text"):
                text_parts.append(f"--- Файл: {att['name']} ---\n{att['extracted_text']}")

        elif ft == "pdf":
            raw = None
            if att.get("s3_key"):
                raw = download_bytes(att["s3_key"])
            elif att.get("file_path") and os.path.exists(att["file_path"]):
                with open(att["file_path"], "rb") as f:
                    raw = f.read()
            if raw:
                b64 = base64.b64encode(raw).decode("utf-8")
                file_parts.append({
                    "type": "file",
                    "file": {
                        "file_data": f"data:application/pdf;base64,{b64}",
                        "filename": att["name"],
                    }
                })

        elif ft == "image":
            raw = None
            if att.get("s3_key"):
                raw = download_bytes(att["s3_key"])
            elif att.get("file_path") and os.path.exists(att["file_path"]):
                with open(att["file_path"], "rb") as f:
                    raw = f.read()
            if raw:
                content_type = att.get("content_type", "image/png")
                b64 = base64.b64encode(raw).decode("utf-8")
                file_parts.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{content_type};base64,{b64}",
                    }
                })

    return text_parts, file_parts
