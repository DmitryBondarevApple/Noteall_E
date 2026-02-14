from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_user
from app.models.transcript import TranscriptVersionResponse, TranscriptContentUpdate
from app.services.access_control import can_user_access_project

router = APIRouter(prefix="/projects/{project_id}/transcripts", tags=["transcripts"])


@router.get("", response_model=List[TranscriptVersionResponse])
async def get_transcripts(project_id: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "deleted_at": None}, {"_id": 0})
    if not project or not await can_user_access_project(project, user, "meeting_folders"):
        raise HTTPException(status_code=404, detail="Project not found")
    
    transcripts = await db.transcripts.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    return [TranscriptVersionResponse(**t) for t in transcripts]


@router.put("/{version_type}", response_model=TranscriptVersionResponse)
async def update_transcript(
    project_id: str,
    version_type: str,
    data: TranscriptContentUpdate,
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "deleted_at": None}, {"_id": 0})
    if not project or not await can_user_access_project(project, user, "meeting_folders"):
        raise HTTPException(status_code=404, detail="Project not found")
    
    transcript = await db.transcripts.find_one(
        {"project_id": project_id, "version_type": version_type}
    )
    if not transcript:
        raise HTTPException(status_code=404, detail="Transcript not found")
    
    await db.transcripts.update_one(
        {"project_id": project_id, "version_type": version_type},
        {"$set": {"content": data.content}}
    )
    
    updated = await db.transcripts.find_one(
        {"project_id": project_id, "version_type": version_type},
        {"_id": 0}
    )
    return TranscriptVersionResponse(**updated)
