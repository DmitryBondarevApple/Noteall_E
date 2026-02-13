import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.core.database import db
from app.core.security import get_current_user, get_admin_user, get_superadmin_user
from app.models.organization import (
    OrganizationResponse,
    OrgUserResponse,
    OrgInvite,
    OrgUserLimit,
)

router = APIRouter(prefix="/organizations", tags=["organizations"])
logger = logging.getLogger(__name__)


# ── Org-admin endpoints ──

@router.get("/my", response_model=OrganizationResponse)
async def get_my_org(user=Depends(get_current_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=404, detail="No organization")
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return OrganizationResponse(**org)


@router.get("/my/users")
async def list_org_users(user=Depends(get_admin_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=404, detail="No organization")
    users = await db.users.find(
        {"org_id": org_id}, {"_id": 0, "password": 0}
    ).to_list(1000)
    return [
        OrgUserResponse(
            id=u["id"],
            email=u["email"],
            name=u["name"],
            role=u["role"],
            monthly_token_limit=u.get("monthly_token_limit", 0),
            created_at=u["created_at"],
        )
        for u in users
    ]


class OrgNameUpdate(BaseModel):
    name: str


@router.put("/my", response_model=OrganizationResponse)
async def update_my_org(data: OrgNameUpdate, user=Depends(get_admin_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=404, detail="No organization")
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    now = datetime.now(timezone.utc).isoformat()
    await db.organizations.update_one(
        {"id": org_id},
        {"$set": {"name": name, "updated_at": now}},
    )
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    return OrganizationResponse(**org)


@router.post("/my/invite")
async def invite_user(data: OrgInvite, user=Depends(get_admin_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")

    # Check if user already exists in this org
    existing = await db.users.find_one({"email": data.email, "org_id": org_id})
    if existing:
        raise HTTPException(status_code=400, detail="User already in organization")

    # Check if already invited
    existing_inv = await db.org_invitations.find_one(
        {"email": data.email, "org_id": org_id, "accepted": False}
    )
    if existing_inv:
        raise HTTPException(status_code=400, detail="Already invited")

    now = datetime.now(timezone.utc).isoformat()
    inv_doc = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "email": data.email,
        "invited_by": user["id"],
        "accepted": False,
        "created_at": now,
    }
    await db.org_invitations.insert_one(inv_doc)

    # If user already registered, add them to org directly
    existing_user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing_user and not existing_user.get("org_id"):
        await db.users.update_one(
            {"id": existing_user["id"]},
            {"$set": {"org_id": org_id}},
        )
        await db.org_invitations.update_one(
            {"id": inv_doc["id"]},
            {"$set": {"accepted": True, "accepted_at": now, "user_id": existing_user["id"]}},
        )
        return {"message": f"User {data.email} added to organization"}

    return {"message": f"Invitation sent to {data.email}"}


@router.delete("/my/users/{user_id}")
async def remove_user_from_org(user_id: str, user=Depends(get_admin_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself")

    target = await db.users.find_one({"id": user_id, "org_id": org_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found in organization")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"org_id": None, "role": "user"}},
    )
    return {"message": "User removed from organization"}


@router.put("/my/users/{user_id}/role")
async def update_user_role(user_id: str, role: str, user=Depends(get_admin_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot change own role")
    if role not in ("user", "org_admin"):
        raise HTTPException(status_code=400, detail="Invalid role")

    target = await db.users.find_one({"id": user_id, "org_id": org_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found in organization")

    await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    return {"message": "Role updated"}


@router.put("/my/users/{user_id}/limit")
async def set_user_token_limit(user_id: str, data: OrgUserLimit, user=Depends(get_admin_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")

    target = await db.users.find_one({"id": user_id, "org_id": org_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found in organization")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"monthly_token_limit": data.monthly_token_limit}},
    )
    return {"message": "Token limit updated"}


# ── Superadmin endpoints ──

@router.get("/all")
async def list_all_orgs(admin=Depends(get_superadmin_user)):
    orgs = await db.organizations.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    result = []
    for org in orgs:
        user_count = await db.users.count_documents({"org_id": org["id"]})
        result.append({**org, "user_count": user_count})
    return result


@router.get("/{org_id}")
async def get_org_details(org_id: str, admin=Depends(get_superadmin_user)):
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    users = await db.users.find(
        {"org_id": org_id}, {"_id": 0, "password": 0}
    ).to_list(1000)
    return {**org, "users": users}
