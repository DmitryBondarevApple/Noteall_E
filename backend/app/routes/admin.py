import uuid
import logging
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_admin_user, hash_password
from app.models.user import UserResponse
from app.core.config import OPENAI_API_KEY

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)

DEFAULT_MODEL = "gpt-5.2"


async def get_active_model() -> str:
    """Get current active model from settings"""
    settings = await db.settings.find_one({"key": "active_model"}, {"_id": 0})
    return settings["value"] if settings else DEFAULT_MODEL


@router.get("/users", response_model=List[UserResponse])
async def list_users(admin=Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]


@router.post("/users")
async def create_user(
    email: str,
    password: str,
    name: str,
    role: str = "user",
    admin=Depends(get_admin_user)
):
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    await db.users.insert_one({
        "id": user_id,
        "email": email,
        "password": hash_password(password),
        "name": name,
        "role": role,
        "created_at": now
    })
    
    return {"id": user_id, "message": "User created"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin=Depends(get_admin_user)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted"}


@router.get("/prompts")
async def list_all_prompts(admin=Depends(get_admin_user)):
    """List all prompts (admin only)"""
    prompts = await db.prompts.find({}, {"_id": 0}).to_list(1000)
    return prompts


@router.get("/model")
async def get_model_settings(admin=Depends(get_admin_user)):
    """Get current model settings and available updates"""
    active = await get_active_model()
    notifications = await db.settings.find_one({"key": "model_notifications"}, {"_id": 0})
    new_models = notifications["value"] if notifications else []
    last_check = await db.settings.find_one({"key": "model_last_check"}, {"_id": 0})
    return {
        "active_model": active,
        "new_models": new_models,
        "last_check": last_check["value"] if last_check else None,
    }


@router.post("/model/check")
async def check_new_models(admin=Depends(get_admin_user)):
    """Check OpenAI for new GPT models"""
    from openai import AsyncOpenAI

    try:
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        models_resp = await client.models.list()

        gpt_models = sorted([
            m.id for m in models_resp.data
            if m.id.startswith("gpt-") and not any(x in m.id for x in ["instruct", "realtime", "audio", "search", "transcribe"])
        ])

        active = await get_active_model()
        now = datetime.now(timezone.utc).isoformat()

        await db.settings.update_one(
            {"key": "model_notifications"},
            {"$set": {"key": "model_notifications", "value": gpt_models}},
            upsert=True,
        )
        await db.settings.update_one(
            {"key": "model_last_check"},
            {"$set": {"key": "model_last_check", "value": now}},
            upsert=True,
        )

        newer = [m for m in gpt_models if m > active]
        return {
            "active_model": active,
            "available_models": gpt_models,
            "newer_models": newer,
            "last_check": now,
        }
    except Exception as e:
        logger.error(f"Model check error: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка проверки: {str(e)}")


@router.post("/model/switch")
async def switch_model(model: str = None, admin=Depends(get_admin_user)):
    """Switch active GPT model"""
    if not model:
        raise HTTPException(status_code=400, detail="Укажите модель")

    now = datetime.now(timezone.utc).isoformat()
    old_model = await get_active_model()

    await db.settings.update_one(
        {"key": "active_model"},
        {"$set": {"key": "active_model", "value": model}},
        upsert=True,
    )

    logger.info(f"Model switched: {old_model} -> {model}")
    return {"message": f"Модель переключена: {old_model} → {model}", "active_model": model}
