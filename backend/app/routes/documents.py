import uuid
import os
import logging
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.core.database import db
from app.routes.auth import get_current_user
from app.services.gpt import call_gpt52

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "/app/backend/uploads/doc_attachments"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ==================== MODELS ====================

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    description: Optional[str] = None

class FolderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class DocProjectCreate(BaseModel):
    name: str
    folder_id: str
    description: Optional[str] = None
    system_instruction: Optional[str] = None
    template_id: Optional[str] = None

class DocProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_instruction: Optional[str] = None
    template_id: Optional[str] = None
    status: Optional[str] = None

class DocTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    sections: Optional[list] = None  # [{ title, description, subsections: [...] }]

class DocTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sections: Optional[list] = None

class StreamCreate(BaseModel):
    name: str
    system_prompt: Optional[str] = None

class StreamUpdate(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None

class StreamMessage(BaseModel):
    content: str


# ==================== FOLDERS (tree structure) ====================

@router.get("/doc/folders")
async def list_folders(user=Depends(get_current_user)):
    folders = await db.doc_folders.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return folders

@router.post("/doc/folders", status_code=201)
async def create_folder(data: FolderCreate, user=Depends(get_current_user)):
    # Validate parent exists if specified
    if data.parent_id:
        parent = await db.doc_folders.find_one({"id": data.parent_id, "user_id": user["id"]})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": data.name,
        "parent_id": data.parent_id,
        "description": data.description,
        "created_at": now,
        "updated_at": now,
    }
    await db.doc_folders.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@router.put("/doc/folders/{folder_id}")
async def update_folder(folder_id: str, data: FolderUpdate, user=Depends(get_current_user)):
    folder = await db.doc_folders.find_one({"id": folder_id, "user_id": user["id"]})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    updates = {k: v for k, v in data.dict(exclude_unset=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.doc_folders.update_one({"id": folder_id}, {"$set": updates})

    updated = await db.doc_folders.find_one({"id": folder_id}, {"_id": 0})
    return updated

@router.delete("/doc/folders/{folder_id}")
async def delete_folder(folder_id: str, user=Depends(get_current_user)):
    folder = await db.doc_folders.find_one({"id": folder_id, "user_id": user["id"]})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Check for children
    children = await db.doc_folders.count_documents({"parent_id": folder_id, "user_id": user["id"]})
    projects = await db.doc_projects.count_documents({"folder_id": folder_id, "user_id": user["id"]})
    if children > 0 or projects > 0:
        raise HTTPException(status_code=400, detail="Папка не пуста. Удалите вложенные элементы.")

    await db.doc_folders.delete_one({"id": folder_id})
    return {"message": "Deleted"}


# ==================== DOC PROJECTS ====================

@router.get("/doc/projects")
async def list_doc_projects(folder_id: Optional[str] = None, user=Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if folder_id:
        query["folder_id"] = folder_id
    projects = await db.doc_projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return projects

@router.post("/doc/projects", status_code=201)
async def create_doc_project(data: DocProjectCreate, user=Depends(get_current_user)):
    # Validate folder exists
    folder = await db.doc_folders.find_one({"id": data.folder_id, "user_id": user["id"]})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "folder_id": data.folder_id,
        "name": data.name,
        "description": data.description,
        "system_instruction": data.system_instruction,
        "template_id": data.template_id,
        "status": "draft",
        "created_at": now,
        "updated_at": now,
    }
    await db.doc_projects.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@router.get("/doc/projects/{project_id}")
async def get_doc_project(project_id: str, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get attachments
    attachments = await db.doc_attachments.find(
        {"project_id": project_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    project["attachments"] = attachments

    return project

@router.put("/doc/projects/{project_id}")
async def update_doc_project(project_id: str, data: DocProjectUpdate, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    updates = {k: v for k, v in data.dict(exclude_unset=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.doc_projects.update_one({"id": project_id}, {"$set": updates})

    updated = await db.doc_projects.find_one({"id": project_id}, {"_id": 0})
    return updated

@router.delete("/doc/projects/{project_id}")
async def delete_doc_project(project_id: str, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete attachments
    attachments = await db.doc_attachments.find({"project_id": project_id}, {"_id": 0}).to_list(500)
    for att in attachments:
        if att.get("file_path") and os.path.exists(att["file_path"]):
            os.remove(att["file_path"])
    await db.doc_attachments.delete_many({"project_id": project_id})
    await db.doc_projects.delete_one({"id": project_id})
    return {"message": "Deleted"}


# ==================== DOC ATTACHMENTS ====================

@router.post("/doc/projects/{project_id}/attachments")
async def upload_doc_attachment(
    project_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await file.read()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл превышает 100MB")

    file_id = uuid.uuid4().hex
    safe_name = f"{file_id}_{file.filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as f:
        f.write(content)

    ext = os.path.splitext(file.filename)[1].lower()
    file_type = "pdf" if ext == ".pdf" else "image" if ext in {".png", ".jpg", ".jpeg", ".webp", ".gif"} else "text" if ext in {".txt", ".csv", ".md", ".docx"} else "other"

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "name": file.filename,
        "file_type": file_type,
        "content_type": file.content_type,
        "size": len(content),
        "file_path": file_path,
        "created_at": now,
    }
    await db.doc_attachments.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@router.post("/doc/projects/{project_id}/attachments/url")
async def add_doc_url_attachment(
    project_id: str,
    data: dict,
    user=Depends(get_current_user)
):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "name": data.get("name") or data["url"][:80],
        "file_type": "url",
        "content_type": None,
        "size": None,
        "source_url": data["url"],
        "file_path": None,
        "created_at": now,
    }
    await db.doc_attachments.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@router.delete("/doc/projects/{project_id}/attachments/{attachment_id}")
async def delete_doc_attachment(
    project_id: str, attachment_id: str, user=Depends(get_current_user)
):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    att = await db.doc_attachments.find_one({"id": attachment_id, "project_id": project_id}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if att.get("file_path") and os.path.exists(att["file_path"]):
        os.remove(att["file_path"])

    await db.doc_attachments.delete_one({"id": attachment_id})
    return {"message": "Deleted"}


# ==================== TEMPLATES ====================

@router.get("/doc/templates")
async def list_templates(user=Depends(get_current_user)):
    templates = await db.doc_templates.find(
        {"$or": [{"user_id": user["id"]}, {"is_public": True}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return templates

@router.post("/doc/templates", status_code=201)
async def create_template(data: DocTemplateCreate, user=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": data.name,
        "description": data.description,
        "sections": data.sections or [],
        "is_public": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.doc_templates.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}

@router.put("/doc/templates/{template_id}")
async def update_template(template_id: str, data: DocTemplateUpdate, user=Depends(get_current_user)):
    tmpl = await db.doc_templates.find_one({"id": template_id, "user_id": user["id"]})
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    updates = {k: v for k, v in data.dict(exclude_unset=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.doc_templates.update_one({"id": template_id}, {"$set": updates})

    updated = await db.doc_templates.find_one({"id": template_id}, {"_id": 0})
    return updated

@router.delete("/doc/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(get_current_user)):
    tmpl = await db.doc_templates.find_one({"id": template_id, "user_id": user["id"]})
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    await db.doc_templates.delete_one({"id": template_id})
    return {"message": "Deleted"}
