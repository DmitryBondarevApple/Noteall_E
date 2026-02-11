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

═══════════════════════════════════════
  ТИПЫ УЗЛОВ
═══════════════════════════════════════

1. "ai_prompt" — AI-промпт
   Отправляет текст в GPT. Переменные {{var}} в промпте подставляются из контекста выполнения.
   Параметры: inline_prompt, system_message, reasoning_effort ("low"/"medium"/"high").
   Зарезервированные переменные: {{text}} (транскрипт/входные данные от input_from), {{input}} (синоним {{text}}).

2. "parse_list" — Скрипт парсинга
   Разбирает текстовый ответ AI на массив строк. Если скрипт не указан или падает — применяется дефолтный парсинг (разбивка по строкам, удаление маркеров).
   Параметр: script (JavaScript, function run(context) { return { output: [...] }; }).

3. "batch_loop" — Батч-цикл
   Обрабатывает массив элементов порциями (батчами). Для каждого батча вызывает AI с промптом.
   Параметры:
   - batch_size (число, по умолчанию 3; 0 = все за один раз)
   - prompt_source_node (node_id шаблонной ноды, из которой брать промпт; ОБЯЗАТЕЛЬНО если промпт идёт из template-ноды)
   - script (опционально; если нет — дефолтная нарезка на батчи, переменная {{item}} = текст батча)

   ВАЖНО: batch_loop получает данные двумя способами:
   a) Через template-ноду с loop_vars — template возвращает {__template, __items}, батч-цикл подставляет {{item}} в шаблон для каждого батча. Указать prompt_source_node на эту template-ноду.
   b) Через подключённый ai_prompt-узел — батч-цикл находит ближайший ai_prompt после себя и использует его промпт. НЕ рекомендуется — лучше использовать (a).

4. "aggregate" — Агрегация
   Собирает результаты (массив строк) в единый текст (join через \\n\\n). Можно кастомизировать через script.

5. "template" — Шаблон/Переменная
   Два режима работы:
   a) БЕЗ input_from — интерактивная нода. Показывает пользователю форму ввода для каждой {{переменной}}. Используй variable_config для настройки полей.
   b) С input_from — автоматическая нода. Подставляет значения из контекста в шаблон и передаёт результат дальше.

   Параметры:
   - template_text: текст шаблона с {{переменными}}
   - variable_config: { "var_name": { "label": "...", "placeholder": "...", "input_type": "text|textarea|number", "required": true } }
   - loop_vars: массив имён переменных, зарезервированных для батч-цикла (например ["item"]). Эти переменные НЕ резолвятся шаблонизатором, а остаются как плейсхолдеры для подстановки в каждой итерации.

6. "user_edit_list" — Редактирование списка пользователем
   Показывает список с чекбоксами, позволяет добавлять/удалять/редактировать. Вход: массив строк.
   Параметры: allow_add, allow_edit, allow_delete (bool), min_selected (число).

7. "user_review" — Просмотр результата
   Показывает финальный текст (Markdown). Позволяет редактировать, сохранять, экспортировать.
   Параметры: allow_review_edit, show_export, show_save (bool).

═══════════════════════════════════════
  ТИПЫ ПЕРЕМЕННЫХ (ВАЖНО!)
═══════════════════════════════════════

Все переменные используют синтаксис {{имя}}, но имеют РАЗНУЮ семантику:

| Тип              | Примеры              | Когда резолвится                  |
|------------------|----------------------|-----------------------------------|
| Пользовательский | {{subject}}          | До старта (ввод в форму)          |
| Контекстный      | {{text}}, {{input}}  | Автоматически (транскрипт/вход)   |
| Итерационный     | {{item}}             | В каждой итерации batch_loop      |
| Выход ноды       | {{short_summary}}    | После выполнения ноды             |

Итерационные переменные ДОЛЖНЫ быть указаны в loop_vars шаблонной ноды!

═══════════════════════════════════════
  ПРАВИЛА ПОСТРОЕНИЯ ГРАФА
═══════════════════════════════════════

- Первый узел НЕ ИМЕЕТ input_from (получает {{text}} — транскрипт автоматически).
- Все остальные узлы ОБЯЗАТЕЛЬНО имеют input_from — массив node_id источников данных.
- input_from определяет, откуда узел берёт входные данные. Должен совпадать с edges.
- Линейная цепочка A → B → C: у B input_from: ["A"], у C input_from: ["B"].
- Fan-in (несколько → один): input_from: ["node_1", "node_2"]. Данные передаются как объект.
- Располагай узлы: position_x (шаг ~300), position_y (шаг ~150).

═══════════════════════════════════════
  ПАТТЕРН: БАТЧ-АНАЛИЗ ПО ТЕМАМ
═══════════════════════════════════════

Типовой сценарий — подробный анализ встречи по темам:

1. ai_prompt: извлечь список тем из транскрипта → текст
2. parse_list: разобрать текст в массив тем → ["тема1", "тема2", ...]
3. user_edit_list: пользователь редактирует список → отфильтрованный массив
4. template (с loop_vars: ["item"]): шаблон батч-промпта с {{item}} и {{text}}
5. batch_loop (prompt_source_node: "step_4"): обрабатывает темы батчами
6. aggregate: собирает все батчи в один текст
7. ai_prompt: делает короткое резюме из подробного → текст
8. template (input_from: ["step_7", "step_6"]): финальный документ
9. user_review: показывает результат

Пример шаблона для шага 4 (батч-промпт):
```
Контекст: транскрипт встречи для {{subject}}.
Сделай подробное резюме по каждой теме.
Батч тем:
{{item}}
Транскрипт:
{{text}}
```
loop_vars: ["item"] — чтобы {{item}} не подставлялся раньше времени.

Пример шаблона для шага 8 (финальный документ):
```
ИТОГОВОЕ РЕЗЮМЕ
{{short_summary}}
---
ПОДРОБНОЕ РЕЗЮМЕ ПО ТЕМАМ
{{detailed_summary}}
```
Здесь {{short_summary}} и {{detailed_summary}} резолвятся из выходов шагов 7 и 6 (по substring-совпадению node_id).

═══════════════════════════════════════
  ФОРМАТ ОТВЕТА
═══════════════════════════════════════

1. Создание/изменение сценария → JSON внутри ```json ... ```:
{
  "name": "Название",
  "description": "Описание",
  "nodes": [
    {
      "node_id": "step_1",
      "node_type": "ai_prompt",
      "label": "Извлечь темы",
      "inline_prompt": "...",
      "system_message": "Ты — аналитик встреч.",
      "input_from": null,
      "position_x": 0, "position_y": 0
    },
    {
      "node_id": "step_4_batch_template",
      "node_type": "template",
      "label": "Шаблон батча",
      "template_text": "Анализируй темы:\\n{{item}}\\nТранскрипт:\\n{{text}}",
      "loop_vars": ["item"],
      "input_from": ["step_3"],
      "position_x": 900, "position_y": 0
    },
    {
      "node_id": "step_5_batch_loop",
      "node_type": "batch_loop",
      "label": "Батч-анализ",
      "batch_size": 3,
      "prompt_source_node": "step_4_batch_template",
      "input_from": ["step_4_batch_template"],
      "position_x": 1200, "position_y": 0
    }
  ],
  "edges": [...]
}

2. Вопрос/обсуждение → текстовый ответ на русском.
3. Скриншот ошибки → анализ + решение (с JSON если нужно).

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
        # Prepare base64 for OpenAI Vision
        image_base64 = base64.b64encode(image_data).decode("utf-8")
        mime = f"image/{ext}" if ext in ("png", "jpeg", "jpg", "webp", "gif") else "image/png"
        if s3_enabled():
            try:
                upload_bytes(s3_key, image_data, image.content_type or "image/png")
                image_s3_key = s3_key
                image_display_url = presigned_url(s3_key)
            except Exception as e:
                logger.warning(f"S3 upload failed, using data URL fallback: {e}")
                image_display_url = f"data:{mime};base64,{image_base64}"
        else:
            image_display_url = f"data:{mime};base64,{image_base64}"

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
        if not await check_org_balance(org_id, user):
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
    metering_info = None
    if org_id:
        try:
            metering_info = await deduct_credits_and_record(
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
        "usage": metering_info,
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
