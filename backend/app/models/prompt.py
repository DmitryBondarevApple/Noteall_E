from pydantic import BaseModel
from typing import Optional, Literal


class PromptCreate(BaseModel):
    name: str
    content: str
    prompt_type: Literal["master", "thematic", "personal", "project"]
    project_id: Optional[str] = None
    is_public: bool = False


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    is_public: Optional[bool] = None


class PromptResponse(BaseModel):
    id: str
    name: str
    content: str
    prompt_type: str
    user_id: Optional[str]
    project_id: Optional[str]
    is_public: bool
    created_at: str
    updated_at: str
