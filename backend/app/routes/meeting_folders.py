import uuid
from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import db
from app.core.security import get_current_user

router = APIRouter(prefix="/meeting-folders", tags=["meeting-folders"])


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    description: Optional[str] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.get("")
async def list_folders(user=Depends(get_current_user)):
    folders = await db.meeting_folders.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)
    return folders


@router.post("", status_code=201)
async def create_folder(data: FolderCreate, user=Depends(get_current_user)):
    if data.parent_id:
        parent = await db.meeting_folders.find_one({"id": data.parent_id, "user_id": user["id"]})
        if not parent:
            raise HTTPException(status_code=404, detail="Parent folder not found")

    now = datetime.now(timezone.utc).isoformat()
    folder = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": data.name,
        "parent_id": data.parent_id,
        "description": data.description,
        "created_at": now,
        "updated_at": now,
    }
    await db.meeting_folders.insert_one(folder)
    return {k: v for k, v in folder.items() if k != "_id"}


@router.put("/{folder_id}")
async def update_folder(folder_id: str, data: FolderUpdate, user=Depends(get_current_user)):
    folder = await db.meeting_folders.find_one({"id": folder_id, "user_id": user["id"]})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    updates = {k: v for k, v in data.dict(exclude_unset=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.meeting_folders.update_one({"id": folder_id}, {"$set": updates})
    updated = await db.meeting_folders.find_one({"id": folder_id}, {"_id": 0})
    return updated


@router.delete("/{folder_id}")
async def delete_folder(folder_id: str, user=Depends(get_current_user)):
    folder = await db.meeting_folders.find_one({"id": folder_id, "user_id": user["id"]})
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Check for children
    children = await db.meeting_folders.count_documents({"parent_id": folder_id})
    projects = await db.projects.count_documents({"folder_id": folder_id})
    if children > 0 or projects > 0:
        raise HTTPException(status_code=400, detail="Folder is not empty")

    await db.meeting_folders.delete_one({"id": folder_id})
    return {"message": "Deleted"}
