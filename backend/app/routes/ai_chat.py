import uuid
import base64
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from app.core.database import db
from app.core.security import get_current_user
from app.services.gpt import call_gpt_chat, call_gpt_chat_metered
from app.services.metering import check_user_monthly_limit, check_org_balance, deduct_credits_and_record
from app.services.s3 import s3_enabled, upload_bytes, presigned_url, download_bytes
from app.models.ai_chat import AiChatSessionResponse, AiChatSessionListItem, AiChatMessage

router = APIRouter(prefix="/ai-chat", tags=["ai-chat"])
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Ты — AI-ассистент платформы Noteall. Твоя задача — помогать пользователю создавать и редактировать сценарии анализа документов и транскриптов встреч.

Сценарий — это граф из узлов (nodes) и связей (edges). Каждый узел имеет тип и конфигурацию.

ДОСТУПНЫЕ ТИПЫ УЗЛОВ:
1. "ai_prompt" — AI-промпт. Отправляет текст в GPT для анализа. Параметры: inline_prompt (текст промпта), system_message (системное сообщение).
2. "parse_list" — Скрипт парсинга. Разбирает текст на список элементов. Параметр: script (Python-выражение для парсинга, например "items = text.split('\\n')").
3. "batch_loop" — Батч-цикл. Обрабатывает каждый элемент списка через подключённый AI-промпт. Параметр: batch_size (размер батча, по умолчанию 3).
4. "aggregate" — Агрегация. Собирает результаты батч-обработки в единый текст.
5. "template" — Шаблон/Переменная. Задаёт шаблон текста с переменными {{var}}. Параметр: template_text.
6. "user_edit_list" — Редактирование списка пользователем. Позволяет пользователю отредактировать список перед продолжением.
7. "user_review" — Просмотр результата. Показывает финальный результат пользователю.

ПРАВИЛА ПОСТРОЕНИЯ ГРАФА:
- Первый узел получает исходный текст (транскрипт или документ) автоматически.
- Узлы связаны через edges: {source: "node_id", target: "node_id"}.
- Для fan-out (один узел → несколько): создай несколько edges от одного source.
- Для fan-in (несколько → один): укажи input_from: ["node_id_1", "node_id_2"] у целевого узла.
- Располагай узлы на canvas: position_x (горизонталь, шаг ~300), position_y (вертикаль, шаг ~150).

РЕЖИМЫ ОТВЕТА:
1. Когда пользователь просит создать или изменить сценарий, верни JSON-блок внутри маркеров ```json ... ```. JSON должен содержать:
{
  "name": "Название сценария",
  "description": "Краткое описание",
  "nodes": [
    {
      "node_id": "уникальный_id",
      "node_type": "ai_prompt",
      "label": "Название узла",
      "inline_prompt": "Текст промпта...",
      "position_x": 0,
      "position_y": 0
    }
  ],
  "edges": [
    {"source": "node_id_1", "target": "node_id_2"}
  ]
}

2. Когда пользователь задаёт вопрос, обсуждает ошибку или просит совет — отвечай текстом на русском языке. Если нужно предложить исправление сценария, добавь обновлённый JSON.

3. Когда пользователь присылает скриншот ошибки — проанализируй изображение, объясни проблему и предложи решение (с обновлённым JSON если нужно).

Промпты в узлах должны быть подробными и на русском языке. Отвечай по-русски."""


class CreateSessionRequest(BaseModel):
    pipeline_id: Optional[str] = None


@router.post("/sessions", response_model=AiChatSessionResponse, status_code=201)
async def create_session(data: CreateSessionRequest, user=Depends(get_current_user)):
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": session_id,
        "user_id": user["id"],
        "pipeline_id": data.pipeline_id,
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }
    await db.ai_chat_sessions.insert_one(doc)
    doc.pop("_id", None)
    return AiChatSessionResponse(**doc)


@router.get("/sessions")
async def list_sessions(pipeline_id: Optional[str] = None, user=Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if pipeline_id:
        query["pipeline_id"] = pipeline_id
    sessions = await db.ai_chat_sessions.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
    result = []
    for s in sessions:
        msgs = s.get("messages", [])
        last_preview = None
        if msgs:
            last_msg = msgs[-1]
            last_preview = last_msg.get("content", "")[:100]
        result.append(AiChatSessionListItem(
            id=s["id"],
            pipeline_id=s.get("pipeline_id"),
            message_count=len(msgs),
            last_message_preview=last_preview,
            created_at=s["created_at"],
            updated_at=s["updated_at"],
        ))
    return result


@router.get("/sessions/{session_id}", response_model=AiChatSessionResponse)
async def get_session(session_id: str, user=Depends(get_current_user)):
    session = await db.ai_chat_sessions.find_one(
        {"id": session_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    # Refresh presigned URLs for images
    for msg in session.get("messages", []):
        if msg.get("image_s3_key"):
            try:
                msg["image_url"] = presigned_url(msg["image_s3_key"])
            except Exception:
                pass
    return AiChatSessionResponse(**session)


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user=Depends(get_current_user)):
    result = await db.ai_chat_sessions.delete_one(
        {"id": session_id, "user_id": user["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session deleted"}


@router.post("/sessions/{session_id}/message")
async def send_message(
    session_id: str,
    content: str = Form(""),
    pipeline_context: str = Form(""),
    image: Optional[UploadFile] = File(None),
    user=Depends(get_current_user),
):
    session = await db.ai_chat_sessions.find_one(
        {"id": session_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc).isoformat()
    image_s3_key = None
    image_display_url = None
    image_base64 = None

    # Handle image upload
    if image:
        image_data = await image.read()
        if len(image_data) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Image too large (max 10MB)")
        ext = image.filename.rsplit(".", 1)[-1] if "." in image.filename else "png"
        s3_key = f"chat_images/{session_id}/{uuid.uuid4()}.{ext}"
        if s3_enabled():
            upload_bytes(s3_key, image_data, image.content_type or "image/png")
            image_s3_key = s3_key
            image_display_url = presigned_url(s3_key)
        # Prepare base64 for OpenAI Vision
        image_base64 = base64.b64encode(image_data).decode("utf-8")

    # Create user message
    user_msg = {
        "role": "user",
        "content": content,
        "image_url": image_display_url,
        "image_s3_key": image_s3_key,
        "timestamp": now,
    }

    # Build OpenAI messages from history
    openai_messages = []
    for msg in session.get("messages", []):
        if msg["role"] == "user":
            parts = []
            if msg.get("content"):
                parts.append({"type": "text", "text": msg["content"]})
            if msg.get("image_s3_key"):
                # For historical images, load from S3
                try:
                    hist_data = download_bytes(msg["image_s3_key"])
                    hist_b64 = base64.b64encode(hist_data).decode("utf-8")
                    ext = msg["image_s3_key"].rsplit(".", 1)[-1]
                    mime = f"image/{ext}" if ext in ("png", "jpeg", "jpg", "webp", "gif") else "image/png"
                    parts.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{hist_b64}", "detail": "low"}
                    })
                except Exception as e:
                    logger.warning(f"Failed to load historical image: {e}")
            if parts:
                openai_messages.append({"role": "user", "content": parts if len(parts) > 1 else parts[0].get("text", "")})
            else:
                openai_messages.append({"role": "user", "content": msg.get("content", "")})
        else:
            openai_messages.append({"role": "assistant", "content": msg.get("content", "")})

    # Add current user message
    current_parts = []
    if content:
        current_parts.append({"type": "text", "text": content})
    if image_base64:
        ext = image.filename.rsplit(".", 1)[-1] if "." in image.filename else "png"
        mime = f"image/{ext}" if ext in ("png", "jpeg", "jpg", "webp", "gif") else "image/png"
        current_parts.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{image_base64}", "detail": "high"}
        })

    if current_parts:
        if len(current_parts) == 1 and current_parts[0].get("type") == "text":
            openai_messages.append({"role": "user", "content": current_parts[0]["text"]})
        else:
            openai_messages.append({"role": "user", "content": current_parts})

    # Build system prompt with optional pipeline context
    system = SYSTEM_PROMPT
    if pipeline_context:
        try:
            ctx = json.loads(pipeline_context)
            system += "\n\nТЕКУЩИЙ СЦЕНАРИЙ ПОЛЬЗОВАТЕЛЯ (JSON):\n```json\n" + json.dumps(ctx, ensure_ascii=False, indent=2) + "\n```\nУчитывай структуру этого сценария при ответе. Если пользователь просит изменить сценарий — верни полный обновлённый JSON."
        except json.JSONDecodeError:
            pass

    # Check billing limits before AI call
    org_id = user.get("org_id")
    if org_id:
        if not await check_user_monthly_limit(user):
            raise HTTPException(status_code=402, detail="Превышен месячный лимит токенов")
        if not await check_org_balance(org_id):
            raise HTTPException(status_code=402, detail="Недостаточно кредитов. Пополните баланс.")

    # Call GPT
    try:
        gpt_result = await call_gpt_chat_metered(
            system_message=system,
            messages=openai_messages,
        )
        ai_response = gpt_result.content
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

    # Deduct credits after successful AI call
    if org_id:
        try:
            await deduct_credits_and_record(
                org_id=org_id,
                user_id=user["id"],
                model=gpt_result.model,
                prompt_tokens=gpt_result.prompt_tokens,
                completion_tokens=gpt_result.completion_tokens,
                source="ai_chat",
            )
        except Exception as e:
            logger.error(f"Metering error (non-blocking): {e}")

    assistant_msg = {
        "role": "assistant",
        "content": ai_response,
        "image_url": None,
        "image_s3_key": None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Save messages to session
    await db.ai_chat_sessions.update_one(
        {"id": session_id},
        {
            "$push": {"messages": {"$each": [user_msg, assistant_msg]}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()},
        },
    )

    # Try to extract pipeline JSON from response
    pipeline_data = _extract_pipeline_json(ai_response)

    # Refresh image URL for the user message response
    if image_s3_key:
        user_msg["image_url"] = presigned_url(image_s3_key)

    return {
        "user_message": user_msg,
        "assistant_message": assistant_msg,
        "pipeline_data": pipeline_data,
    }


def _extract_pipeline_json(text: str) -> Optional[dict]:
    """Try to extract pipeline JSON from AI response text."""
    try:
        # Look for ```json ... ``` blocks
        if "```json" in text:
            start = text.index("```json") + 7
            end = text.index("```", start)
            json_str = text[start:end].strip()
            data = json.loads(json_str)
            if isinstance(data, dict) and "nodes" in data:
                return data
        elif "```" in text:
            start = text.index("```") + 3
            # Skip optional language marker on same line
            newline = text.index("\n", start)
            start = newline + 1
            end = text.index("```", start)
            json_str = text[start:end].strip()
            data = json.loads(json_str)
            if isinstance(data, dict) and "nodes" in data:
                return data
        # Try parsing the whole response as JSON
        data = json.loads(text.strip())
        if isinstance(data, dict) and "nodes" in data:
            return data
    except (ValueError, json.JSONDecodeError):
        pass
    return None
