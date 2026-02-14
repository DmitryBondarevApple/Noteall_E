import logging
import os
import httpx
from fastapi import APIRouter, UploadFile, File, Form, Depends
from typing import Optional
from app.core.security import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["feedback"])

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")


@router.post("/suggest")
async def suggest_improvement(
    text: str = Form(...),
    telegram: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    screenshot: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    user_name = current_user.get("name", "Неизвестный")
    org_name = current_user.get("org_name", "—")
    user_email = current_user.get("email", "—")

    caption_parts = [
        f"💡 Предложение улучшения",
        f"",
        f"От: {user_name}",
        f"Компания: {org_name}",
        f"Email: {email or user_email}",
    ]
    if telegram:
        caption_parts.append(f"Telegram: {telegram}")
    caption_parts.append(f"")
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
