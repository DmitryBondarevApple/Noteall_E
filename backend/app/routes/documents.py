import uuid
import os
import logging
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import RedirectResponse
from app.core.database import db
from app.routes.auth import get_current_user
from app.services.gpt import call_gpt52, call_gpt52_metered
from app.services.metering import check_user_monthly_limit, check_org_balance, deduct_credits_and_record
from app.services.s3 import s3_enabled, upload_bytes, download_bytes, delete_object, presigned_url
from app.services.pdf_parser import extract_text_from_pdf

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
    folder_id: Optional[str] = None

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

class PinCreate(BaseModel):
    stream_id: str
    message_index: int
    content: str

class PinUpdate(BaseModel):
    content: Optional[str] = None
    order: Optional[int] = None

class PinReorder(BaseModel):
    pin_ids: List[str]

class RunPipelineRequest(BaseModel):
    pipeline_id: str


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
        if att.get("s3_key"):
            delete_object(att["s3_key"])
        elif att.get("file_path") and os.path.exists(att["file_path"]):
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

    s3_key = None
    file_path = None
    if s3_enabled():
        s3_key = f"doc_attachments/{safe_name}"
        upload_bytes(s3_key, content, file.content_type or "application/octet-stream")
    else:
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
        "s3_key": s3_key,
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

    if att.get("s3_key"):
        delete_object(att["s3_key"])
    elif att.get("file_path") and os.path.exists(att["file_path"]):
        os.remove(att["file_path"])

    await db.doc_attachments.delete_one({"id": attachment_id})
    return {"message": "Deleted"}


@router.get("/doc/projects/{project_id}/attachments/{attachment_id}/download")
async def download_doc_attachment(
    project_id: str, attachment_id: str, user=Depends(get_current_user)
):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    att = await db.doc_attachments.find_one({"id": attachment_id, "project_id": project_id}, {"_id": 0})
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if att.get("s3_key"):
        url = presigned_url(att["s3_key"], expires=3600)
        return RedirectResponse(url=url)

    if att.get("file_path") and os.path.exists(att["file_path"]):
        from fastapi.responses import FileResponse
        return FileResponse(att["file_path"], filename=att.get("name", "file"))

    raise HTTPException(status_code=404, detail="File not found")


# ==================== PIPELINE RUNNER ====================

import re
import json as json_module

def _topo_sort(nodes, edges):
    """Topological sort of pipeline nodes using flow edges."""
    node_ids = {n["node_id"] for n in nodes}
    in_deg = {n["node_id"]: 0 for n in nodes}
    adj = {n["node_id"]: [] for n in nodes}
    for e in edges:
        if e["source"] in node_ids and e["target"] in node_ids:
            adj[e["source"]].append(e["target"])
            in_deg[e["target"]] = in_deg.get(e["target"], 0) + 1
    queue = [nid for nid, d in in_deg.items() if d == 0]
    result = []
    while queue:
        cur = queue.pop(0)
        result.append(cur)
        for nxt in adj.get(cur, []):
            in_deg[nxt] -= 1
            if in_deg[nxt] == 0:
                queue.append(nxt)
    return result


def _build_data_deps(nodes, edges):
    """Build data dependency map: node_id -> [source_node_ids]."""
    deps = {}
    for e in edges:
        sh = e.get("source_handle", "") or ""
        th = e.get("target_handle", "") or ""
        is_data = "data" in sh or "data" in th
        if is_data:
            deps.setdefault(e["target"], []).append(e["source"])
    for n in nodes:
        input_from = n.get("input_from") or []
        if input_from:
            deps.setdefault(n["node_id"], []).extend(input_from)
    return deps


def _get_node_input(node_id, deps, outputs):
    """Get input for a node from its data dependencies."""
    sources = deps.get(node_id, [])
    if not sources:
        return None
    if len(sources) == 1:
        return outputs.get(sources[0])
    return {sid: outputs.get(sid) for sid in sources}


def _substitute_vars(text, outputs):
    """Replace {{var}} placeholders with values from outputs."""
    if not text:
        return text
    for match in re.findall(r'\{\{(\w+)\}\}', text):
        val = outputs.get(match, "")
        text = text.replace(f"{{{{{match}}}}}", str(val) if val else "")
    return text


def _execute_script(script_text, context):
    """Execute a node script (parse_list, aggregate, template)."""
    if not script_text:
        return {"output": context.get("input")}
    # We run simple Python-like JS scripts by extracting the function body
    # For server-side, we use a safe subset
    try:
        # Try to find function run(context) { ... }
        fn_match = re.search(r'function\s+run\s*\(\w*\)\s*\{([\s\S]*)\}\s*$', script_text)
        if fn_match:
            body = fn_match.group(1)
        else:
            body = script_text

        # Simple JS->Python transpilation for common patterns
        py_body = body
        py_body = py_body.replace('const ', '')
        py_body = py_body.replace('let ', '')
        py_body = py_body.replace('var ', '')
        py_body = py_body.replace('.join(', '.join(')
        py_body = py_body.replace('===', '==')
        py_body = py_body.replace('!==', '!=')
        py_body = py_body.replace('||', ' or ')
        py_body = py_body.replace('&&', ' and ')
        py_body = py_body.replace('null', 'None')
        py_body = py_body.replace('true', 'True')
        py_body = py_body.replace('false', 'False')

        local_vars = {"context": context, "result": {"output": context.get("input")}}
        exec(py_body, {"__builtins__": {"len": len, "str": str, "int": int, "float": float, "list": list, "dict": dict, "range": range, "enumerate": enumerate, "isinstance": isinstance, "print": lambda *a: None, "json": json_module, "re": re}}, local_vars)

        if "result" in local_vars and isinstance(local_vars["result"], dict):
            return local_vars["result"]
        return {"output": context.get("input")}
    except Exception as e:
        logger.warning(f"Script execution error: {e}")
        return {"output": context.get("input"), "error": str(e)}


@router.post("/doc/projects/{project_id}/run-pipeline")
async def run_pipeline(project_id: str, data: RunPipelineRequest, user=Depends(get_current_user)):
    """Run a pipeline on document project materials. Fully server-side execution."""
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Load pipeline
    pipeline = await db.pipelines.find_one({"id": data.pipeline_id}, {"_id": 0})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    nodes = pipeline.get("nodes", [])
    edges = pipeline.get("edges", [])
    node_map = {n["node_id"]: n for n in nodes}

    # Load source materials as context
    attachments = await db.doc_attachments.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(100)

    source_texts = []
    for att in attachments:
        ext = os.path.splitext(att.get("name", ""))[1].lower()
        raw_bytes = None

        # Get file bytes
        if att.get("s3_key"):
            try:
                raw_bytes = download_bytes(att["s3_key"])
            except Exception as e:
                logger.warning(f"Failed to download S3 attachment {att['name']}: {e}")
        elif att.get("file_path") and os.path.exists(att["file_path"]):
            try:
                with open(att["file_path"], "rb") as f:
                    raw_bytes = f.read()
            except Exception as e:
                logger.warning(f"Failed to read attachment {att['name']}: {e}")

        if raw_bytes:
            if ext == ".pdf":
                text = extract_text_from_pdf(raw_bytes, max_chars=50000)
                if text:
                    source_texts.append(f"--- Документ: {att['name']} ---\n{text}")
            elif ext in {".txt", ".md", ".csv"}:
                text = raw_bytes.decode("utf-8", errors="replace")[:50000]
                source_texts.append(f"--- Документ: {att['name']} ---\n{text}")
        elif att.get("source_url"):
            source_texts.append(f"--- Ссылка: {att['name']} ({att['source_url']}) ---")

    source_context = "\n\n".join(source_texts) if source_texts else ""

    # Topological sort
    sorted_ids = _topo_sort(nodes, edges)
    data_deps = _build_data_deps(nodes, edges)

    # Execute nodes in order
    outputs = {}
    node_results = []  # ordered list of {node_id, label, type, output}
    consumed_by_loop = set()

    for node_id in sorted_ids:
        node = node_map.get(node_id)
        if not node or node_id in consumed_by_loop:
            continue

        node_type = node.get("node_type", "")
        label = node.get("label", node_id)

        # Skip interactive nodes (user_edit_list, user_review, template with vars)
        if node_type in ("user_edit_list", "user_review"):
            # Pass through input
            inp = _get_node_input(node_id, data_deps, outputs)
            outputs[node_id] = inp
            if label:
                outputs[label] = inp
            continue

        if node_type == "template":
            # Template node: substitute variables from outputs
            tmpl = node.get("template_text", "") or ""
            result = _substitute_vars(tmpl, outputs)
            # Also substitute {{input}}
            inp = _get_node_input(node_id, data_deps, outputs)
            if inp and isinstance(inp, str):
                result = result.replace("{{input}}", inp)
            outputs[node_id] = result
            if label:
                outputs[label] = result
            node_results.append({"node_id": node_id, "label": label, "type": node_type, "output": result})
            continue

        if node_type == "ai_prompt":
            inp = _get_node_input(node_id, data_deps, outputs)
            prompt = node.get("inline_prompt", "") or ""
            system_msg = node.get("system_message", "") or "Ты — AI-ассистент для анализа документов. Отвечай на русском языке."

            # Run prep script if exists
            if node.get("script"):
                script_result = _execute_script(node["script"], {
                    "input": inp, "prompt": prompt, "vars": outputs
                })
                if isinstance(script_result, dict) and script_result.get("promptVars"):
                    for key, value in script_result["promptVars"].items():
                        prompt = prompt.replace(f"{{{{{key}}}}}", str(value))

            # Substitute variables
            prompt = _substitute_vars(prompt, outputs)
            if isinstance(inp, str):
                prompt = prompt.replace("{{input}}", inp)

            # Add source materials to system message
            if source_context:
                system_msg += f"\n\nИсходные материалы проекта:\n{source_context}"

            try:
                effort = node.get("reasoning_effort", "high")
                gpt_result = await call_gpt52_metered(
                    system_message=system_msg,
                    user_message=prompt,
                    reasoning_effort=effort
                )
                ai_result = gpt_result.content
                # Meter the call
                org_id = user.get("org_id")
                if org_id:
                    try:
                        await deduct_credits_and_record(
                            org_id=org_id, user_id=user["id"],
                            model=gpt_result.model,
                            prompt_tokens=gpt_result.prompt_tokens,
                            completion_tokens=gpt_result.completion_tokens,
                            source="pipeline_node",
                        )
                    except Exception as me:
                        logger.error(f"Metering error: {me}")
            except Exception as e:
                ai_result = f"[Ошибка AI: {str(e)}]"

            outputs[node_id] = ai_result
            if label:
                outputs[label] = ai_result
            node_results.append({"node_id": node_id, "label": label, "type": node_type, "output": ai_result})
            continue

        if node_type == "parse_list":
            inp = _get_node_input(node_id, data_deps, outputs)
            if node.get("script"):
                result = _execute_script(node["script"], {"input": inp, "vars": outputs})
                out = result.get("output", inp)
            else:
                # Default: split by newlines
                out = [line.strip() for line in str(inp or "").split("\n") if line.strip()] if inp else []
            outputs[node_id] = out
            if label:
                outputs[label] = out
            node_results.append({"node_id": node_id, "label": label, "type": node_type, "output": out})
            continue

        if node_type == "aggregate":
            inp = _get_node_input(node_id, data_deps, outputs)
            if node.get("script"):
                result = _execute_script(node["script"], {"input": inp, "vars": outputs})
                out = result.get("output", inp)
            else:
                # Default: join all inputs
                if isinstance(inp, dict):
                    parts = []
                    for k, v in inp.items():
                        node_label = node_map.get(k, {}).get("label", k)
                        parts.append(f"## {node_label}\n\n{v}")
                    out = "\n\n---\n\n".join(parts)
                elif isinstance(inp, list):
                    out = "\n\n".join(str(item) for item in inp)
                else:
                    out = str(inp) if inp else ""
            outputs[node_id] = out
            if label:
                outputs[label] = out
            node_results.append({"node_id": node_id, "label": label, "type": node_type, "output": out})
            continue

        if node_type == "batch_loop":
            inp = _get_node_input(node_id, data_deps, outputs)
            items = inp if isinstance(inp, list) else []
            batch_size = node.get("batch_size", 3) or len(items) or 1

            # Find AI node that follows this loop
            loop_idx = sorted_ids.index(node_id)
            ai_node = None
            for next_id in sorted_ids[loop_idx + 1:]:
                next_node = node_map.get(next_id)
                if next_node and next_node.get("node_type") == "ai_prompt":
                    ai_node = next_node
                    consumed_by_loop.add(next_id)
                    break

            results = []
            total_batches = max(1, (len(items) + batch_size - 1) // batch_size) if items else 0

            for iteration in range(total_batches):
                context = {
                    "input": items,
                    "iteration": iteration,
                    "batchSize": batch_size,
                    "results": results,
                    "vars": outputs,
                }
                if node.get("script"):
                    script_result = _execute_script(node["script"], context)
                    if isinstance(script_result, dict) and script_result.get("done"):
                        out = script_result.get("output", results)
                        outputs[node_id] = out
                        if label:
                            outputs[label] = out
                        break

                    if ai_node and isinstance(script_result, dict) and script_result.get("promptVars"):
                        prompt = ai_node.get("inline_prompt", "") or ""
                        system_msg = ai_node.get("system_message", "") or "Ты — AI-ассистент для анализа."
                        for key, val in script_result["promptVars"].items():
                            prompt = prompt.replace(f"{{{{{key}}}}}", str(val))
                        prompt = _substitute_vars(prompt, outputs)
                        if source_context:
                            system_msg += f"\n\nИсходные материалы проекта:\n{source_context}"
                        try:
                            ai_result = await call_gpt52(
                                system_message=system_msg,
                                user_message=prompt,
                                reasoning_effort=ai_node.get("reasoning_effort", "high")
                            )
                            results.append(ai_result)
                        except Exception as e:
                            results.append(f"[Ошибка AI: {str(e)}]")
                else:
                    # No script — just pass items through
                    outputs[node_id] = items
                    if label:
                        outputs[label] = items
                    break
            else:
                outputs[node_id] = results
                if label:
                    outputs[label] = results

            if ai_node:
                ai_label = ai_node.get("label", ai_node["node_id"])
                outputs[ai_node["node_id"]] = results
                outputs[ai_label] = results

            node_results.append({"node_id": node_id, "label": label, "type": "batch_loop", "output": outputs.get(node_id)})
            continue

    # Save run result
    now = datetime.now(timezone.utc).isoformat()
    run_record = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "pipeline_id": data.pipeline_id,
        "pipeline_name": pipeline.get("name", ""),
        "node_results": node_results,
        "status": "completed",
        "created_at": now,
    }
    await db.doc_runs.insert_one(run_record)

    # Update project status
    await db.doc_projects.update_one(
        {"id": project_id},
        {"$set": {"status": "completed", "updated_at": now}}
    )

    return {k: v for k, v in run_record.items() if k != "_id"}


@router.get("/doc/projects/{project_id}/runs")
async def list_runs(project_id: str, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    runs = await db.doc_runs.find(
        {"project_id": project_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return runs


@router.delete("/doc/projects/{project_id}/runs/{run_id}")
async def delete_run(project_id: str, run_id: str, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.doc_runs.delete_one({"id": run_id, "project_id": project_id})
    return {"message": "Deleted"}


# ==================== ANALYSIS STREAMS ====================

@router.get("/doc/projects/{project_id}/streams")
async def list_streams(project_id: str, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    streams = await db.doc_streams.find(
        {"project_id": project_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(50)
    return streams

@router.post("/doc/projects/{project_id}/streams", status_code=201)
async def create_stream(project_id: str, data: StreamCreate, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    now = datetime.now(timezone.utc).isoformat()
    stream = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "name": data.name,
        "system_prompt": data.system_prompt,
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.doc_streams.insert_one(stream)
    return {k: v for k, v in stream.items() if k != "_id"}

@router.put("/doc/projects/{project_id}/streams/{stream_id}")
async def update_stream(project_id: str, stream_id: str, data: StreamUpdate, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stream = await db.doc_streams.find_one({"id": stream_id, "project_id": project_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    updates = {k: v for k, v in data.dict(exclude_unset=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.doc_streams.update_one({"id": stream_id}, {"$set": updates})

    updated = await db.doc_streams.find_one({"id": stream_id}, {"_id": 0})
    return updated

@router.delete("/doc/projects/{project_id}/streams/{stream_id}")
async def delete_stream(project_id: str, stream_id: str, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stream = await db.doc_streams.find_one({"id": stream_id, "project_id": project_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    await db.doc_streams.delete_one({"id": stream_id})
    return {"message": "Deleted"}

@router.post("/doc/projects/{project_id}/streams/{stream_id}/messages")
async def send_stream_message(
    project_id: str, stream_id: str, data: StreamMessage, user=Depends(get_current_user)
):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    stream = await db.doc_streams.find_one({"id": stream_id, "project_id": project_id})
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")

    # Build context from source materials
    attachments = await db.doc_attachments.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(100)

    context_parts = []
    for att in attachments:
        ext = os.path.splitext(att.get("name", ""))[1].lower()
        raw_bytes = None

        if att.get("s3_key"):
            try:
                raw_bytes = download_bytes(att["s3_key"])
            except Exception as e:
                logger.warning(f"Failed to download S3 attachment {att['name']}: {e}")
        elif att.get("file_path") and os.path.exists(att["file_path"]):
            try:
                with open(att["file_path"], "rb") as f:
                    raw_bytes = f.read()
            except Exception as e:
                logger.warning(f"Failed to read attachment {att['name']}: {e}")

        if raw_bytes:
            if ext == ".pdf":
                text = extract_text_from_pdf(raw_bytes, max_chars=50000)
                if text:
                    context_parts.append(f"--- Документ: {att['name']} ---\n{text}")
            elif ext in {".txt", ".md", ".csv"}:
                text = raw_bytes.decode("utf-8", errors="replace")[:50000]
                context_parts.append(f"--- Документ: {att['name']} ---\n{text}")
        elif att.get("source_url"):
            context_parts.append(f"--- Ссылка: {att['name']} ({att['source_url']}) ---")

    source_context = "\n\n".join(context_parts) if context_parts else ""

    # Build system prompt
    base_system = stream.get("system_prompt") or project.get("system_instruction") or ""
    system_message = "Ты — AI-ассистент для анализа документов. Отвечай на русском языке. Будь точен и структурирован."
    if base_system:
        system_message += f"\n\nИнструкция пользователя:\n{base_system}"
    if source_context:
        system_message += f"\n\nИсходные материалы проекта:\n{source_context}"

    # Build messages history for multi-turn
    history = stream.get("messages", [])
    openai_messages = []
    for msg in history:
        openai_messages.append({"role": msg["role"], "content": msg["content"]})
    openai_messages.append({"role": "user", "content": data.content})

    # Add user message to DB first
    now = datetime.now(timezone.utc).isoformat()
    user_msg = {"role": "user", "content": data.content, "timestamp": now}

    try:
        ai_response = await call_gpt52(
            system_message=system_message,
            messages=openai_messages,
            reasoning_effort="high"
        )
    except Exception as e:
        logger.error(f"AI stream error: {e}")
        ai_response = f"Ошибка AI: {str(e)}"

    assistant_msg = {"role": "assistant", "content": ai_response, "timestamp": datetime.now(timezone.utc).isoformat()}

    # Save both messages
    await db.doc_streams.update_one(
        {"id": stream_id},
        {
            "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )

    return {"user_message": user_msg, "assistant_message": assistant_msg}


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


# ==================== PINS (Final Document Assembly) ====================

@router.get("/doc/projects/{project_id}/pins")
async def list_pins(project_id: str, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pins = await db.doc_pins.find(
        {"project_id": project_id}, {"_id": 0}
    ).sort("order", 1).to_list(200)
    return pins

@router.post("/doc/projects/{project_id}/pins", status_code=201)
async def create_pin(project_id: str, data: PinCreate, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get max order
    last_pin = await db.doc_pins.find_one(
        {"project_id": project_id}, sort=[("order", -1)]
    )
    next_order = (last_pin["order"] + 1) if last_pin else 0

    now = datetime.now(timezone.utc).isoformat()
    pin = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "stream_id": data.stream_id,
        "message_index": data.message_index,
        "content": data.content,
        "order": next_order,
        "created_at": now,
    }
    await db.doc_pins.insert_one(pin)
    return {k: v for k, v in pin.items() if k != "_id"}

@router.post("/doc/projects/{project_id}/pins/reorder")
async def reorder_pins(project_id: str, data: PinReorder, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    for i, pin_id in enumerate(data.pin_ids):
        await db.doc_pins.update_one(
            {"id": pin_id, "project_id": project_id},
            {"$set": {"order": i}}
        )
    return {"message": "Reordered"}

@router.put("/doc/projects/{project_id}/pins/{pin_id}")
async def update_pin(project_id: str, pin_id: str, data: PinUpdate, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pin = await db.doc_pins.find_one({"id": pin_id, "project_id": project_id})
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    updates = {k: v for k, v in data.dict(exclude_unset=True).items()}
    await db.doc_pins.update_one({"id": pin_id}, {"$set": updates})

    updated = await db.doc_pins.find_one({"id": pin_id}, {"_id": 0})
    return updated

@router.delete("/doc/projects/{project_id}/pins/{pin_id}")
async def delete_pin(project_id: str, pin_id: str, user=Depends(get_current_user)):
    project = await db.doc_projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    pin = await db.doc_pins.find_one({"id": pin_id, "project_id": project_id})
    if not pin:
        raise HTTPException(status_code=404, detail="Pin not found")

    await db.doc_pins.delete_one({"id": pin_id})
    return {"message": "Deleted"}


# ==================== SEED TEMPLATES ====================

@router.post("/doc/seed-templates")
async def seed_default_templates(user=Depends(get_current_user)):
    """Seed default analysis templates if none exist for the user"""
    existing = await db.doc_templates.count_documents(
        {"$or": [{"user_id": user["id"]}, {"is_public": True}]}
    )
    if existing > 0:
        return {"message": "Templates already exist", "count": existing}

    now = datetime.now(timezone.utc).isoformat()
    templates = [
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "name": "Резюме документа",
            "description": "Краткое резюме ключевых пунктов",
            "sections": [],
            "is_public": True,
            "system_prompt": "Создай структурированное резюме документа. Выдели ключевые пункты, основные выводы и рекомендации. Используй маркированные списки.",
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "name": "Анализ рисков",
            "description": "Выявление рисков и проблемных зон",
            "sections": [],
            "is_public": True,
            "system_prompt": "Проанализируй документ на предмет рисков, неоднозначных формулировок, потенциальных проблем и 'серых зон'. Для каждого риска укажи: описание, уровень критичности (высокий/средний/низкий), рекомендацию.",
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "name": "Извлечение фактов",
            "description": "Даты, суммы, обязательства, участники",
            "sections": [],
            "is_public": True,
            "system_prompt": "Извлеки из документа все конкретные факты: даты, суммы, сроки, имена участников, обязательства сторон, условия. Представь в виде структурированной таблицы.",
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "name": "Вопросы на уточнение",
            "description": "Генерация вопросов по недостающей информации",
            "sections": [],
            "is_public": True,
            "system_prompt": "Проанализируй документ и сформулируй список вопросов на уточнение. Что неясно? Какая информация отсутствует? Какие пункты требуют дополнительного разъяснения? Сгруппируй вопросы по темам.",
            "created_at": now,
            "updated_at": now,
        },
        {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "name": "Сравнение версий",
            "description": "Сравнение двух документов или версий",
            "sections": [],
            "is_public": True,
            "system_prompt": "Сравни предоставленные документы или версии. Выдели: что добавлено, что убрано, что изменено. Оцени существенность каждого изменения.",
            "created_at": now,
            "updated_at": now,
        },
    ]

    await db.doc_templates.insert_many(templates)
    return {"message": "Seeded", "count": len(templates)}
