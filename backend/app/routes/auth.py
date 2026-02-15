import uuid
import os
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from app.core.database import db
from app.core.security import hash_password, verify_password, create_token, get_current_user
from app.models.user import UserCreate, UserLogin, UserResponse, TokenResponse
import resend

logger = logging.getLogger(__name__)

resend.api_key = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "noreply@notifications.noteall.ru")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://noteall.ru")

router = APIRouter(prefix="/auth", tags=["auth"])


async def _get_org_name(org_id):
    if not org_id:
        return None
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
    return org["name"] if org else None


def _user_response(user_doc, org_name=None):
    return UserResponse(
        id=user_doc["id"],
        email=user_doc["email"],
        name=user_doc["name"],
        role=user_doc["role"],
        org_id=user_doc.get("org_id"),
        org_name=org_name,
        created_at=user_doc["created_at"],
    )


@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    now = datetime.now(timezone.utc).isoformat()
    user_id = str(uuid.uuid4())

    # Check if registering via magic-link invitation
    if data.invitation_token:
        inv = await db.invitations.find_one({"token": data.invitation_token})
        if not inv:
            raise HTTPException(status_code=400, detail="Invalid invitation link")
        if inv.get("is_used"):
            raise HTTPException(status_code=400, detail="This invitation has already been used")
        if inv.get("is_revoked"):
            raise HTTPException(status_code=400, detail="This invitation has been revoked")

        inv_org_id = inv["org_id"]
        user_doc = {
            "id": user_id,
            "email": data.email,
            "password": hash_password(data.password),
            "name": data.name,
            "role": "user",
            "org_id": inv_org_id,
            "monthly_token_limit": 0,
            "created_at": now,
        }
        await db.users.insert_one(user_doc)

        # Mark invitation as used
        await db.invitations.update_one(
            {"token": data.invitation_token},
            {"$set": {
                "is_used": True,
                "used_by_id": user_id,
                "used_by_name": data.name,
                "used_at": now,
            }},
        )
        org_name = inv.get("org_name")

    # Check if this email was pre-invited to an org (legacy email-based invite)
    elif await db.org_invitations.find_one({"email": data.email, "accepted": False}):
        invitation = await db.org_invitations.find_one({"email": data.email, "accepted": False})
        inv_org_id = invitation["org_id"]
        user_doc = {
            "id": user_id,
            "email": data.email,
            "password": hash_password(data.password),
            "name": data.name,
            "role": "user",
            "org_id": inv_org_id,
            "monthly_token_limit": 0,
            "created_at": now,
        }
        await db.users.insert_one(user_doc)
        await db.org_invitations.update_one(
            {"_id": invitation["_id"]},
            {"$set": {"accepted": True, "accepted_at": now, "user_id": user_id}},
        )
        org_name = await _get_org_name(inv_org_id)

    else:
        # New user — create their own org
        org_id = str(uuid.uuid4())
        org_name = data.organization_name or f"{data.name} Company"
        org_doc = {
            "id": org_id,
            "name": org_name,
            "owner_id": user_id,
            "created_at": now,
            "updated_at": now,
        }
        await db.organizations.insert_one(org_doc)

        # Initialize credit balance with welcome credits
        WELCOME_CREDITS = 100.0
        await db.credit_balances.insert_one({
            "org_id": org_id,
            "balance": WELCOME_CREDITS,
            "updated_at": now,
        })
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "org_id": org_id,
            "user_id": user_id,
            "type": "topup",
            "amount": WELCOME_CREDITS,
            "description": "Приветственные кредиты при регистрации",
            "created_at": now,
        })

        user_doc = {
            "id": user_id,
            "email": data.email,
            "password": hash_password(data.password),
            "name": data.name,
            "role": "org_admin",
            "org_id": org_id,
            "monthly_token_limit": 0,
            "created_at": now,
        }
        await db.users.insert_one(user_doc)

    token = create_token(user_id)
    return TokenResponse(
        access_token=token,
        user=_user_response(user_doc, org_name),
    )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    org_name = await _get_org_name(user.get("org_id"))
    token = create_token(user["id"])
    return TokenResponse(
        access_token=token,
        user=_user_response(user, org_name),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user=Depends(get_current_user)):
    org_name = await _get_org_name(user.get("org_id"))
    return _user_response(user, org_name)
