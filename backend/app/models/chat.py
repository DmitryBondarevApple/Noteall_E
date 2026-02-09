from pydantic import BaseModel
from typing import Optional, List


class ChatRequestCreate(BaseModel):
    prompt_id: str
    additional_text: Optional[str] = ""
    reasoning_effort: Optional[str] = "high"
    attachment_ids: Optional[List[str]] = None


class ChatRequestResponse(BaseModel):
    id: str
    project_id: str
    prompt_id: str
    prompt_content: str
    additional_text: Optional[str]
    reasoning_effort: Optional[str]
    response_text: str
    pipeline_id: Optional[str] = None
    pipeline_name: Optional[str] = None
    created_at: str


class ChatResponseUpdate(BaseModel):
    response_text: str
