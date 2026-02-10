import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.core.database import db
from app.core.security import get_current_user
from app.models.pipeline import (
    PipelineCreate, PipelineUpdate, PipelineResponse
)

router = APIRouter(prefix="/pipelines", tags=["pipelines"])


@router.get("", response_model=List[PipelineResponse])
async def list_pipelines(user=Depends(get_current_user)):
    """List all pipelines accessible to the user (own + public)"""
    query = {
        "$or": [
            {"user_id": user["id"]},
            {"is_public": True}
        ]
    }
    pipelines = await db.pipelines.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [PipelineResponse(**p) for p in pipelines]


@router.get("/{pipeline_id}", response_model=PipelineResponse)
async def get_pipeline(pipeline_id: str, user=Depends(get_current_user)):
    pipeline = await db.pipelines.find_one(
        {"id": pipeline_id, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
        {"_id": 0}
    )
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return PipelineResponse(**pipeline)


@router.post("", response_model=PipelineResponse, status_code=201)
async def create_pipeline(data: PipelineCreate, user=Depends(get_current_user)):
    pipeline_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    pipeline_doc = {
        "id": pipeline_id,
        "name": data.name,
        "description": data.description,
        "nodes": [n.model_dump() for n in data.nodes],
        "edges": [e.model_dump() for e in data.edges],
        "user_id": user["id"],
        "is_public": data.is_public,
        "created_at": now,
        "updated_at": now
    }

    await db.pipelines.insert_one(pipeline_doc)
    return PipelineResponse(**pipeline_doc)


@router.put("/{pipeline_id}", response_model=PipelineResponse)
async def update_pipeline(
    pipeline_id: str,
    data: PipelineUpdate,
    user=Depends(get_current_user)
):
    pipeline = await db.pipelines.find_one({"id": pipeline_id})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipeline["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")

    update_data = {}
    if data.name is not None:
        update_data["name"] = data.name
    if data.description is not None:
        update_data["description"] = data.description
    if data.nodes is not None:
        update_data["nodes"] = [n.model_dump() for n in data.nodes]
    if data.edges is not None:
        update_data["edges"] = [e.model_dump() for e in data.edges]
    if data.is_public is not None:
        update_data["is_public"] = data.is_public

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.pipelines.update_one({"id": pipeline_id}, {"$set": update_data})
    updated = await db.pipelines.find_one({"id": pipeline_id}, {"_id": 0})
    return PipelineResponse(**updated)


@router.delete("/{pipeline_id}")
async def delete_pipeline(pipeline_id: str, user=Depends(get_current_user)):
    pipeline = await db.pipelines.find_one({"id": pipeline_id})
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    if pipeline["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")

    await db.pipelines.delete_one({"id": pipeline_id})
    return {"message": "Pipeline deleted"}


@router.post("/{pipeline_id}/duplicate", response_model=PipelineResponse)
async def duplicate_pipeline(pipeline_id: str, user=Depends(get_current_user)):
    """Duplicate a pipeline (useful for copying public pipelines)"""
    original = await db.pipelines.find_one(
        {"id": pipeline_id, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
        {"_id": 0}
    )
    if not original:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    new_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    new_doc = {
        **original,
        "id": new_id,
        "name": f"{original['name']} (копия)",
        "user_id": user["id"],
        "is_public": False,
        "created_at": now,
        "updated_at": now
    }
    new_doc.pop("_id", None)

    await db.pipelines.insert_one(new_doc)
    return PipelineResponse(**new_doc)


@router.get("/{pipeline_id}/export")
async def export_pipeline(pipeline_id: str, user=Depends(get_current_user)):
    """Export pipeline as JSON"""
    pipeline = await db.pipelines.find_one(
        {"id": pipeline_id, "$or": [{"user_id": user["id"]}, {"is_public": True}]},
        {"_id": 0}
    )
    if not pipeline:
        raise HTTPException(status_code=404, detail="Pipeline not found")

    export_data = {
        "noteall_pipeline_version": 1,
        "name": pipeline["name"],
        "description": pipeline.get("description", ""),
        "nodes": pipeline.get("nodes", []),
        "edges": pipeline.get("edges", []),
    }
    return export_data


@router.post("/import/json", response_model=PipelineResponse, status_code=201)
async def import_pipeline(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Import pipeline from JSON file"""
    import json

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Файл превышает 5MB")

    try:
        data = json.loads(content.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Некорректный JSON файл")

    if not isinstance(data, dict) or "nodes" not in data:
        raise HTTPException(status_code=400, detail="Неверный формат сценария")

    name = data.get("name", "Импортированный сценарий")

    existing = await db.pipelines.find_one({"name": name, "user_id": user["id"]})
    if existing:
        name = f"{name} (импорт)"

    pipeline_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    pipeline_doc = {
        "id": pipeline_id,
        "name": name,
        "description": data.get("description", ""),
        "nodes": data.get("nodes", []),
        "edges": data.get("edges", []),
        "user_id": user["id"],
        "is_public": False,
        "created_at": now,
        "updated_at": now,
    }

    await db.pipelines.insert_one(pipeline_doc)
    return PipelineResponse(**pipeline_doc)
