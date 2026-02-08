from pydantic import BaseModel
from typing import Optional, Dict, Any


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    user_id: str
    status: str
    language: Optional[str] = None
    reasoning_effort: Optional[str] = None
    recording_filename: Optional[str] = None
    recording_duration: Optional[float] = None
    speaker_hints: Optional[Dict[str, Any]] = None
    created_at: str
    updated_at: str
