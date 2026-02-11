import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.database import db
from app.core.security import get_current_user, get_admin_user

router = APIRouter(prefix="/invitations", tags=["invitations"])
logger = logging.getLogger(__name__)


class InvitationCreate(BaseModel):
    note: Optional[str] = None


class InvitationResponse(BaseModel):
    id: str
    token: str
    org_id: str
    org_name: str
    created_by_id: str
    created_by_name: str
    note: Optional[str] = None
    is_used: bool
    is_revoked: bool
    used_by_id: Optional[str] = None
    used_by_name: Optional[str] = None
    used_at: Optional[str] = None
    created_at: str


@router.post("/create")
async def create_invitation(data: InvitationCreate, user=Depends(get_admin_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")

    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    now = datetime.now(timezone.utc).isoformat()
    token = str(uuid.uuid4())
    inv_doc = {
        "id": str(uuid.uuid4()),
        "token": token,
        "org_id": org_id,
        "org_name": org["name"],
        "created_by_id": user["id"],
        "created_by_name": user.get("name", user["email"]),
        "note": data.note,
        "is_used": False,
        "is_revoked": False,
        "used_by_id": None,
        "used_by_name": None,
        "used_at": None,
        "created_at": now,
    }
    await db.invitations.insert_one(inv_doc)

    return {
        "id": inv_doc["id"],
        "token": token,
        "org_id": org_id,
        "org_name": org["name"],
        "created_at": now,
    }


@router.get("/list")
async def list_invitations(user=Depends(get_admin_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")

    invitations = await db.invitations.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    return invitations


@router.post("/{invitation_id}/revoke")
async def revoke_invitation(invitation_id: str, user=Depends(get_admin_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")

    inv = await db.invitations.find_one(
        {"id": invitation_id, "org_id": org_id}, {"_id": 0}
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv["is_used"]:
        raise HTTPException(status_code=400, detail="Invitation already used")
    if inv["is_revoked"]:
        raise HTTPException(status_code=400, detail="Invitation already revoked")

    await db.invitations.update_one(
        {"id": invitation_id},
        {"$set": {"is_revoked": True}},
    )
    return {"message": "Invitation revoked"}


@router.get("/validate/{token}")
async def validate_invitation(token: str):
    """Public endpoint - no auth required. Returns org info if token is valid."""
    inv = await db.invitations.find_one(
        {"token": token}, {"_id": 0}
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Invalid invitation link")
    if inv["is_used"]:
        raise HTTPException(status_code=400, detail="This invitation has already been used")
    if inv["is_revoked"]:
        raise HTTPException(status_code=400, detail="This invitation has been revoked")

    return {
        "valid": True,
        "org_name": inv["org_name"],
        "org_id": inv["org_id"],
        "note": inv.get("note"),
        "invited_by": inv["created_by_name"],
    }
