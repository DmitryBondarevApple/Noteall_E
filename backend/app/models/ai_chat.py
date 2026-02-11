from pydantic import BaseModel
from typing import Optional, List


class AiChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    image_url: Optional[str] = None  # S3 presigned URL for display
    image_s3_key: Optional[str] = None  # S3 key for storage
    timestamp: str


class AiChatSessionResponse(BaseModel):
    id: str
    user_id: str
    pipeline_id: Optional[str] = None
    messages: List[AiChatMessage]
    created_at: str
    updated_at: str


class AiChatSessionListItem(BaseModel):
    id: str
    pipeline_id: Optional[str] = None
    message_count: int
    last_message_preview: Optional[str] = None
    created_at: str
    updated_at: str
