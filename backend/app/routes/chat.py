import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_user
from app.models.chat import ChatRequestCreate, ChatRequestResponse, ChatResponseUpdate
from app.services.gpt import call_gpt52

router = APIRouter(tags=["chat"])


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
    messages.append({"role": "user", "content": user_prompt})
    
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
