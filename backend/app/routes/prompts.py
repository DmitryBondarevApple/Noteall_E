import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_user
from app.models.prompt import PromptCreate, PromptUpdate, PromptResponse

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.get("", response_model=List[PromptResponse])
async def list_prompts(
    prompt_type: Optional[str] = None,
    project_id: Optional[str] = None,
    user=Depends(get_current_user)
):
    query = {
        "$or": [
            {"user_id": user["id"]},
            {"is_public": True}
        ]
    }
    
    if prompt_type:
        query["prompt_type"] = prompt_type
    if project_id:
        query["$or"].append({"project_id": project_id})
    
    prompts = await db.prompts.find(query, {"_id": 0}).to_list(1000)
    return [PromptResponse(**p) for p in prompts]


@router.post("", response_model=PromptResponse)
async def create_prompt(data: PromptCreate, user=Depends(get_current_user)):
    prompt_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    prompt_doc = {
        "id": prompt_id,
        "name": data.name,
        "content": data.content,
        "prompt_type": data.prompt_type,
        "user_id": user["id"],
        "project_id": data.project_id,
        "is_public": data.is_public or data.prompt_type in ["master", "thematic"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.prompts.insert_one(prompt_doc)
    return PromptResponse(**prompt_doc)


@router.put("/{prompt_id}", response_model=PromptResponse)
async def update_prompt(prompt_id: str, data: PromptUpdate, user=Depends(get_current_user)):
    prompt = await db.prompts.find_one({"id": prompt_id})
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    if prompt["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.prompts.update_one({"id": prompt_id}, {"$set": update_data})
    updated = await db.prompts.find_one({"id": prompt_id}, {"_id": 0})
    return PromptResponse(**updated)


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: str, user=Depends(get_current_user)):
    prompt = await db.prompts.find_one({"id": prompt_id})
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    if prompt["user_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not allowed")
    
    await db.prompts.delete_one({"id": prompt_id})
    return {"message": "Prompt deleted"}
