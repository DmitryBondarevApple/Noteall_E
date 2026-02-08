from pydantic import BaseModel
from typing import Optional


class TranscriptVersionResponse(BaseModel):
    id: str
    project_id: str
    version_type: str
    content: str
    created_at: str


class TranscriptContentUpdate(BaseModel):
    content: str
