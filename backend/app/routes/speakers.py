import uuid
import base64
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.core.database import db
from app.core.security import get_current_user
from app.models.speaker import (
    SpeakerMapCreate, SpeakerMapUpdate, SpeakerMapResponse,
    SpeakerDirectoryCreate, SpeakerDirectoryUpdate, SpeakerDirectoryResponse
)
from app.services.access_control import can_user_access_project

router = APIRouter(tags=["speakers"])


# ==================== PROJECT SPEAKERS ====================

@router.get("/projects/{project_id}/speakers", response_model=List[SpeakerMapResponse])
async def get_speakers(project_id: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "deleted_at": None}, {"_id": 0})
    if not project or not await can_user_access_project(project, user, "meeting_folders"):
        raise HTTPException(status_code=404, detail="Project not found")
    
    speakers = await db.speaker_maps.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    return [SpeakerMapResponse(**s) for s in speakers]


@router.put("/projects/{project_id}/speakers/{speaker_id}", response_model=SpeakerMapResponse)
async def update_speaker(
    project_id: str,
    speaker_id: str,
    data: SpeakerMapUpdate,
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "deleted_at": None}, {"_id": 0})
    if not project or not await can_user_access_project(project, user, "meeting_folders"):
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_fields = {"speaker_name": data.speaker_name}
    if data.first_name is not None:
        update_fields["first_name"] = data.first_name
    if data.last_name is not None:
        update_fields["last_name"] = data.last_name
    if data.company is not None:
        update_fields["company"] = data.company
    
    await db.speaker_maps.update_one(
        {"id": speaker_id, "project_id": project_id},
        {"$set": update_fields}
    )
    
    updated = await db.speaker_maps.find_one({"id": speaker_id}, {"_id": 0})
    return SpeakerMapResponse(**updated)


# ==================== SPEAKER DIRECTORY ====================

@router.get("/speaker-directory", response_model=List[SpeakerDirectoryResponse])
async def list_speaker_directory(
    q: Optional[str] = None,
    user=Depends(get_current_user)
):
    """List all speakers in user's directory, optionally filtered by search query"""
    query = {"user_id": user["id"]}
    
    if q:
        import re
        # Strip "(Company)" part so "Антон (AX10)" searches for "Антон"
        clean_q = re.sub(r'\s*\(.*?\)\s*$', '', q).strip()
        search_term = re.escape(clean_q) if clean_q else re.escape(q)
        query["$or"] = [
            {"name": {"$regex": search_term, "$options": "i"}},
            {"company": {"$regex": search_term, "$options": "i"}},
            {"role": {"$regex": search_term, "$options": "i"}},
            {"tags": {"$regex": search_term, "$options": "i"}},
        ]
    
    speakers = await db.speaker_directory.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return [SpeakerDirectoryResponse(**s) for s in speakers]


@router.post("/speaker-directory", response_model=SpeakerDirectoryResponse)
async def create_speaker_directory_entry(
    data: SpeakerDirectoryCreate,
    user=Depends(get_current_user)
):
    """Add a new speaker to the directory"""
    speaker_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    speaker_doc = {
        "id": speaker_id,
        "user_id": user["id"],
        "name": data.name,
        "email": data.email,
        "company": data.company,
        "role": data.role,
        "phone": data.phone,
        "telegram": data.telegram,
        "whatsapp": data.whatsapp,
        "photo_url": data.photo_url,
        "comment": data.comment,
        "tags": data.tags or [],
        "created_at": now,
        "updated_at": now
    }
    
    await db.speaker_directory.insert_one(speaker_doc)
    return SpeakerDirectoryResponse(**speaker_doc)


@router.get("/speaker-directory/{speaker_id}", response_model=SpeakerDirectoryResponse)
async def get_speaker_directory_entry(
    speaker_id: str,
    user=Depends(get_current_user)
):
    """Get a single speaker from the directory"""
    speaker = await db.speaker_directory.find_one(
        {"id": speaker_id, "user_id": user["id"]},
        {"_id": 0}
    )
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    return SpeakerDirectoryResponse(**speaker)


@router.put("/speaker-directory/{speaker_id}", response_model=SpeakerDirectoryResponse)
async def update_speaker_directory_entry(
    speaker_id: str,
    data: SpeakerDirectoryUpdate,
    user=Depends(get_current_user)
):
    """Update a speaker in the directory"""
    speaker = await db.speaker_directory.find_one({"id": speaker_id, "user_id": user["id"]})
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.speaker_directory.update_one({"id": speaker_id}, {"$set": update_data})
    
    updated = await db.speaker_directory.find_one({"id": speaker_id}, {"_id": 0})
    return SpeakerDirectoryResponse(**updated)


@router.delete("/speaker-directory/{speaker_id}")
async def delete_speaker_directory_entry(
    speaker_id: str,
    user=Depends(get_current_user)
):
    """Delete a speaker from the directory"""
    speaker = await db.speaker_directory.find_one({"id": speaker_id, "user_id": user["id"]})
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    
    await db.speaker_directory.delete_one({"id": speaker_id})
    return {"message": "Speaker deleted"}


@router.post("/speaker-directory/{speaker_id}/photo")
async def upload_speaker_photo(
    speaker_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    """Upload photo for a speaker"""
    speaker = await db.speaker_directory.find_one({"id": speaker_id, "user_id": user["id"]})
    if not speaker:
        raise HTTPException(status_code=404, detail="Speaker not found")
    
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    
    content = await file.read()
    photo_url = f"data:{file.content_type};base64,{base64.b64encode(content).decode()}"
    
    await db.speaker_directory.update_one(
        {"id": speaker_id},
        {"$set": {"photo_url": photo_url, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"photo_url": photo_url}
