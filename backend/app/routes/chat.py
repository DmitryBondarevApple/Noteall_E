import uuid
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_user
from app.models.chat import ChatRequestCreate, ChatRequestResponse, ChatResponseUpdate
from app.services.gpt import call_gpt52, call_gpt52_metered
from app.services.metering import check_user_monthly_limit, check_org_balance, deduct_credits_and_record
from app.routes.attachments import build_attachment_context

router = APIRouter(tags=["chat"])


class RawAnalysisRequest(BaseModel):
    system_message: str
    user_message: str
    reasoning_effort: Optional[str] = "high"
    attachment_ids: Optional[List[str]] = None


class RawAnalysisResponse(BaseModel):
    response_text: str


class GenerateScriptRequest(BaseModel):
    description: str
    node_type: str
    context: Optional[str] = None


@router.post("/ai/generate-script", response_model=RawAnalysisResponse)
async def generate_script(data: GenerateScriptRequest, user=Depends(get_current_user)):
    """Generate a JavaScript script for a pipeline node using AI."""
    system_message = """Ты генерируешь JavaScript-функции для конвейера анализа текстов.
Каждая функция получает объект context и должна вернуть объект результата.

Доступные поля context:
- context.input — данные от предыдущего узла (строка или массив)
- context.prompt — шаблон промпта из настроек узла (для AI-узлов)
- context.results — массив результатов предыдущих итераций цикла
- context.iteration — номер текущей итерации (0, 1, 2...)
- context.batchSize — размер батча (если задан)
- context.vars — объект переменных из источников данных

Формат возвращаемого значения:
Для обычных скриптов: { output: <результат> }
Для циклических (AI с повторами): { done: true/false, output: <если done>, promptVars: {key: value} }

Верни ТОЛЬКО код функции без пояснений, без markdown-блоков."""

    user_message = f"Тип узла: {data.node_type}\nОписание задачи: {data.description}"
    if data.context:
        user_message += f"\nДополнительный контекст: {data.context}"

    # Check billing limits
    org_id = user.get("org_id")
    if org_id:
        if not await check_user_monthly_limit(user):
            raise HTTPException(status_code=402, detail="Превышен месячный лимит токенов")
        if not await check_org_balance(org_id):
            raise HTTPException(status_code=402, detail="Недостаточно кредитов. Пополните баланс.")

    gpt_result = await call_gpt52_metered(system_message, user_message, reasoning_effort="medium")

    # Deduct credits
    if org_id:
        try:
            await deduct_credits_and_record(
                org_id=org_id,
                user_id=user["id"],
                model=gpt_result.model,
                prompt_tokens=gpt_result.prompt_tokens,
                completion_tokens=gpt_result.completion_tokens,
                source="generate_script",
            )
        except Exception as e:
            logger.error(f"Metering error: {e}")

    return RawAnalysisResponse(response_text=gpt_result.content)


@router.post("/projects/{project_id}/analyze-raw", response_model=RawAnalysisResponse)
async def analyze_raw(
    project_id: str,
    data: RawAnalysisRequest,
    user=Depends(get_current_user)
):
    """
    Raw analysis endpoint for wizard - doesn't save to history.
    Uses transcript as context but allows custom system/user messages.
    """
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get processed transcript (or raw if processed not available)
    transcript = await db.transcripts.find_one(
        {"project_id": project_id, "version_type": "processed"},
        {"_id": 0}
    )
    if not transcript:
        transcript = await db.transcripts.find_one(
            {"project_id": project_id, "version_type": "raw"},
            {"_id": 0}
        )
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript found")
    
    # Build messages with transcript context
    user_content = data.user_message

    # Inject attachment context if any
    text_parts = []
    file_parts = []
    if data.attachment_ids:
        text_parts, file_parts = await build_attachment_context(data.attachment_ids, project_id)

    if text_parts:
        user_content = user_content + "\n\n" + "\n\n".join(text_parts)

    # Build message content — multimodal if file_parts exist
    if file_parts:
        user_msg_content = [{"type": "text", "text": user_content}] + file_parts
    else:
        user_msg_content = user_content

    messages = [
        {"role": "user", "content": f"Вот транскрипт встречи:\n\n{transcript['content']}"},
        {"role": "assistant", "content": "Спасибо, я прочитал транскрипт. Готов помочь с анализом."},
        {"role": "user", "content": user_msg_content}
    ]
    
    # Check billing limits
    org_id = user.get("org_id")
    if org_id:
        if not await check_user_monthly_limit(user):
            raise HTTPException(status_code=402, detail="Превышен месячный лимит токенов")
        if not await check_org_balance(org_id):
            raise HTTPException(status_code=402, detail="Недостаточно кредитов. Пополните баланс.")

    gpt_result = await call_gpt52_metered(
        system_message=data.system_message,
        messages=messages,
        reasoning_effort=data.reasoning_effort or "high"
    )

    # Deduct credits
    if org_id:
        try:
            await deduct_credits_and_record(
                org_id=org_id,
                user_id=user["id"],
                model=gpt_result.model,
                prompt_tokens=gpt_result.prompt_tokens,
                completion_tokens=gpt_result.completion_tokens,
                source="analyze_raw",
            )
        except Exception as e:
            logger.error(f"Metering error: {e}")

    return RawAnalysisResponse(response_text=gpt_result.content)


class SaveFullAnalysisRequest(BaseModel):
    subject: str
    content: str
    pipeline_id: Optional[str] = None
    pipeline_name: Optional[str] = None


@router.post("/projects/{project_id}/save-full-analysis", response_model=ChatRequestResponse)
async def save_full_analysis(
    project_id: str,
    data: SaveFullAnalysisRequest,
    user=Depends(get_current_user)
):
    """Save full analysis result to chat history"""
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    chat_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    chat_doc = {
        "id": chat_id,
        "project_id": project_id,
        "prompt_id": "full-analysis",
        "prompt_content": f"Мастер-анализ: {data.subject}",
        "additional_text": None,
        "reasoning_effort": "high",
        "response_text": data.content,
        "pipeline_id": data.pipeline_id,
        "pipeline_name": data.pipeline_name,
        "created_at": now
    }
    
    await db.chat_requests.insert_one(chat_doc)
    return ChatRequestResponse(**chat_doc)


@router.get("/projects/{project_id}/analysis-results")
async def get_analysis_results(
    project_id: str,
    user=Depends(get_current_user)
):
    """Get all analysis results (from master analysis and re-analysis)"""
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    results = await db.chat_requests.find(
        {"project_id": project_id, "prompt_id": {"$in": ["full-analysis", "result-analysis"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(length=100)
    
    return results


@router.delete("/projects/{project_id}/chat-history/{chat_id}")
async def delete_chat_history(
    project_id: str,
    chat_id: str,
    user=Depends(get_current_user)
):
    """Delete a chat history entry"""
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    result = await db.chat_requests.delete_one({"id": chat_id, "project_id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Chat entry not found")
    
    return {"message": "Deleted"}


@router.post("/projects/{project_id}/analyze", response_model=ChatRequestResponse)
async def analyze_with_prompt(
    project_id: str,
    data: ChatRequestCreate,
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    prompt = await db.prompts.find_one({"id": data.prompt_id}, {"_id": 0})
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    # Get processed transcript (or raw if processed not available)
    transcript = await db.transcripts.find_one(
        {"project_id": project_id, "version_type": "processed"},
        {"_id": 0}
    )
    if not transcript:
        transcript = await db.transcripts.find_one(
            {"project_id": project_id, "version_type": "raw"},
            {"_id": 0}
        )
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript found")
    
    # Build conversation history
    chat_history = await db.chat_requests.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Build messages list for multi-turn conversation
    messages = []
    
    # Add transcript as first user message
    messages.append({"role": "user", "content": f"Вот транскрипт встречи:\n\n{transcript['content']}"})
    messages.append({"role": "assistant", "content": "Спасибо, я прочитал транскрипт. Готов помочь с анализом."})
    
    # Add previous conversation turns
    for ch in chat_history:
        user_msg = ch.get("prompt_content", "")
        if ch.get("additional_text"):
            user_msg += f"\n\nДополнительно: {ch['additional_text']}"
        messages.append({"role": "user", "content": user_msg})
        messages.append({"role": "assistant", "content": ch.get("response_text", "")})
    
    # Add current request
    user_prompt = prompt["content"]
    if data.additional_text:
        user_prompt += f"\n\nДополнительно: {data.additional_text}"

    # Inject attachment context
    text_parts = []
    file_parts = []
    if data.attachment_ids:
        text_parts, file_parts = await build_attachment_context(data.attachment_ids, project_id)

    if text_parts:
        user_prompt = user_prompt + "\n\n" + "\n\n".join(text_parts)

    if file_parts:
        user_msg_content = [{"type": "text", "text": user_prompt}] + file_parts
    else:
        user_msg_content = user_prompt

    messages.append({"role": "user", "content": user_msg_content})
    
    # System message
    system_message = """Ты — профессиональный ассистент для анализа рабочих встреч.
У тебя есть транскрипт встречи и история предыдущих запросов по этой встрече.
Отвечай структурированно, используя markdown для форматирования.
При ссылках на реплики участников указывай их имена."""
    
    # Call GPT with full conversation
    response_text = await call_gpt52(
        system_message=system_message,
        messages=messages,
        reasoning_effort=data.reasoning_effort or "high"
    )
    
    # Save chat request
    chat_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    chat_doc = {
        "id": chat_id,
        "project_id": project_id,
        "prompt_id": data.prompt_id,
        "prompt_content": prompt["content"],
        "additional_text": data.additional_text,
        "reasoning_effort": data.reasoning_effort,
        "response_text": response_text,
        "created_at": now
    }
    
    await db.chat_requests.insert_one(chat_doc)
    return ChatRequestResponse(**chat_doc)


@router.get("/projects/{project_id}/chat-history", response_model=List[ChatRequestResponse])
async def get_chat_history(project_id: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    history = await db.chat_requests.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    return [ChatRequestResponse(**h) for h in history]


@router.put("/projects/{project_id}/chat-history/{chat_id}", response_model=ChatRequestResponse)
async def update_chat_response(
    project_id: str,
    chat_id: str,
    data: ChatResponseUpdate,
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    chat = await db.chat_requests.find_one({"id": chat_id, "project_id": project_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat request not found")
    
    await db.chat_requests.update_one(
        {"id": chat_id},
        {"$set": {"response_text": data.response_text}}
    )
    
    updated = await db.chat_requests.find_one({"id": chat_id}, {"_id": 0})
    return ChatRequestResponse(**updated)
