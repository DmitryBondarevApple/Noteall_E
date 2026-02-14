import logging
import httpx
from fastapi import APIRouter, UploadFile, File, Form, Depends
from typing import Optional
from app.core.security import get_current_user
from app.core.database import db
from app.core.config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("/suggest")
async def suggest_improvement(
    text: str = Form(...),
    telegram: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    screenshot: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    user_name = current_user.get("name", "Неизвестный")
    user_email = current_user.get("email", "—")

    org_name = "—"
    org_id = current_user.get("org_id")
    if org_id:
        org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
        if org:
            org_name = org["name"]

    caption_parts = [
        "Предложение улучшения",
        "",
        f"От: {user_name}",
        f"Компания: {org_name}",
        f"Email: {email or user_email}",
    ]
    if telegram:
        caption_parts.append(f"Telegram: {telegram}")
    caption_parts.append("")
    caption_parts.append(text)

    caption = "\n".join(caption_parts)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            if screenshot:
                screenshot_bytes = await screenshot.read()
                url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto"
                files = {"photo": (screenshot.filename or "screenshot.png", screenshot_bytes, "image/png")}
                data = {"chat_id": TELEGRAM_CHAT_ID, "caption": caption}
                resp = await client.post(url, data=data, files=files)
            else:
                url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
                data = {"chat_id": TELEGRAM_CHAT_ID, "text": caption}
                resp = await client.post(url, data=data)

            if resp.status_code != 200:
                logger.error(f"Telegram API error: {resp.status_code} {resp.text}")
                return {"success": False, "error": "Ошибка отправки в Telegram"}

        return {"success": True}

    except Exception as e:
        logger.error(f"Feedback send error: {e}")
        return {"success": False, "error": str(e)}
