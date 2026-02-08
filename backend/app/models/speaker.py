from pydantic import BaseModel
from typing import Optional


class SpeakerMapCreate(BaseModel):
    speaker_label: str
    speaker_name: str


class SpeakerMapUpdate(BaseModel):
    speaker_label: str
    speaker_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None


class SpeakerMapResponse(BaseModel):
    id: str
    project_id: str
    speaker_label: str
    speaker_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None


# Speaker Directory (global user's contact list)
class SpeakerDirectoryCreate(BaseModel):
    name: str
    email: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    whatsapp: Optional[str] = None
    photo_url: Optional[str] = None
    comment: Optional[str] = None


class SpeakerDirectoryUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    whatsapp: Optional[str] = None
    photo_url: Optional[str] = None
    comment: Optional[str] = None


class SpeakerDirectoryResponse(BaseModel):
    id: str
    user_id: str
    name: str
    email: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    telegram: Optional[str] = None
    whatsapp: Optional[str] = None
    photo_url: Optional[str] = None
    comment: Optional[str] = None
    created_at: str
    updated_at: str
