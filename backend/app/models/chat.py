from pydantic import BaseModel
from typing import Optional


class ChatRequestCreate(BaseModel):
    prompt_id: str
    additional_text: Optional[str] = ""
    reasoning_effort: Optional[str] = "high"


class ChatRequestResponse(BaseModel):
    id: str
    project_id: str
    prompt_id: str
    prompt_content: str
    additional_text: Optional[str]
    reasoning_effort: Optional[str]
    response_text: str
    created_at: str


class ChatResponseUpdate(BaseModel):
    response_text: str
