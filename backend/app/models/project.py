from pydantic import BaseModel
from typing import Optional, Dict, Any


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    folder_id: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    folder_id: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    user_id: str
    owner_id: Optional[str] = None
    visibility: str = "private"
    status: str
    folder_id: Optional[str] = None
    language: Optional[str] = None
    reasoning_effort: Optional[str] = None
    recording_filename: Optional[str] = None
    recording_duration: Optional[float] = None
    fast_track: Optional[Dict[str, Any]] = None
    deleted_at: Optional[str] = None
    created_at: str
    updated_at: str
