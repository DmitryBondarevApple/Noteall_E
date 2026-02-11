from pydantic import BaseModel
from typing import Optional, List


class OrganizationCreate(BaseModel):
    name: str


class OrganizationResponse(BaseModel):
    id: str
    name: str
    owner_id: str
    created_at: str
    updated_at: str


class OrgUserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    monthly_token_limit: int = 0
    created_at: str


class OrgInvite(BaseModel):
    email: str


class OrgUserLimit(BaseModel):
    monthly_token_limit: int = 0
