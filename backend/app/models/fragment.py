from pydantic import BaseModel
from typing import Optional, Literal


class UncertainFragmentCreate(BaseModel):
    original_text: str
    context: str


class UncertainFragmentUpdate(BaseModel):
    corrected_text: Optional[str] = None
    status: Literal["pending", "confirmed", "rejected", "auto_corrected"] = "confirmed"


class UncertainFragmentResponse(BaseModel):
    id: str
    project_id: str
    original_text: str
    corrected_text: Optional[str]
    context: str
    status: str
    created_at: str
