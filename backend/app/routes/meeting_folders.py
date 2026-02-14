import uuid
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, Query
from app.core.database import db
from app.core.security import get_current_user
from app.services.access_control import (
    can_user_access_folder,
    can_user_write_folder,
    soft_delete_folder,
)

router = APIRouter(prefix="/meeting-folders", tags=["meeting-folders"])


class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None
    description: Optional[str] = None
    visibility: str = "private"
    shared_with: Optional[List[str]] = None
    access_type: str = "readonly"


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class FolderShare(BaseModel):
    shared_with: Optional[List[str]] = None
    access_type: str = "readonly"


class FolderMove(BaseModel):
    parent_id: Optional[str] = None


@router.get("")
async def list_folders(
    tab: str = Query("private"),
    parent_id: Optional[str] = Query(None),
    user=Depends(get_current_user),
):
    if tab == "trash":
        folders = await db.meeting_folders.find(
            {"owner_id": user["id"], "deleted_at": {"$ne": None}},
            {"_id": 0},
        ).sort("deleted_at", -1).to_list(500)
        return folders

    if tab == "public":
        query = {"visibility": "public", "org_id": user.get("org_id"), "deleted_at": None}
        if parent_id is not None:
            query["parent_id"] = parent_id
        folders = await db.meeting_folders.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)
        return [f for f in folders if can_user_access_folder(f, user)]

    # private (default)
    query = {"owner_id": user["id"], "visibility": {"$ne": "public"}, "deleted_at": None}
    if parent_id is not None:
        query["parent_id"] = parent_id
    return await db.meeting_folders.find(query, {"_id": 0}).sort("created_at", 1).to_list(500)


@router.get("/{folder_id}")
async def get_folder(folder_id: str, user=Depends(get_current_user)):
    folder = await db.meeting_folders.find_one({"id": folder_id}, {"_id": 0})
    if not folder:
        raise HTTPException(404, "Folder not found")
    if folder.get("visibility") == "public":
        if not can_user_access_folder(folder, user):
            raise HTTPException(403, "Нет доступа")
    elif folder.get("owner_id", folder.get("user_id")) != user["id"]:
        raise HTTPException(403, "Нет доступа")
    owner = await db.users.find_one({"id": folder.get("owner_id")}, {"_id": 0, "name": 1, "email": 1})
    folder["owner_name"] = owner["name"] if owner else "Неизвестный"
    return folder


@router.post("", status_code=201)
async def create_folder(data: FolderCreate, user=Depends(get_current_user)):
    if data.parent_id:
        parent = await db.meeting_folders.find_one(
            {"id": data.parent_id, "deleted_at": None}, {"_id": 0}
        )
        if not parent:
            raise HTTPException(404, "Parent folder not found")
        if parent.get("visibility") == "public":
            if not can_user_write_folder(parent, user):
                raise HTTPException(403, "Нет прав на создание в этой папке")
        elif parent.get("owner_id", parent.get("user_id")) != user["id"]:
            raise HTTPException(403, "Нет прав на создание в этой папке")

    now = datetime.now(timezone.utc).isoformat()
    folder = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "owner_id": user["id"],
        "name": data.name,
        "parent_id": data.parent_id,
        "description": data.description,
        "visibility": data.visibility,
        "shared_with": data.shared_with if data.shared_with is not None else [],
        "access_type": data.access_type,
        "org_id": user.get("org_id"),
        "is_system": False,
        "system_type": None,
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
    }
    await db.meeting_folders.insert_one(folder)
    return {k: v for k, v in folder.items() if k != "_id"}


@router.put("/{folder_id}")
async def update_folder(folder_id: str, data: FolderUpdate, user=Depends(get_current_user)):
    folder = await db.meeting_folders.find_one({"id": folder_id, "deleted_at": None}, {"_id": 0})
    if not folder:
        raise HTTPException(404, "Folder not found")
    if folder.get("owner_id", folder.get("user_id")) != user["id"]:
        raise HTTPException(403, "Только владелец может редактировать папку")
    updates = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.meeting_folders.update_one({"id": folder_id}, {"$set": updates})
    return await db.meeting_folders.find_one({"id": folder_id}, {"_id": 0})


@router.post("/{folder_id}/share")
async def share_folder(folder_id: str, data: FolderShare, user=Depends(get_current_user)):
    folder = await db.meeting_folders.find_one({"id": folder_id, "deleted_at": None}, {"_id": 0})
    if not folder:
        raise HTTPException(404, "Folder not found")
    if folder.get("owner_id", folder.get("user_id")) != user["id"]:
        raise HTTPException(403, "Только владелец может настраивать доступ")
    now = datetime.now(timezone.utc).isoformat()
    await db.meeting_folders.update_one({"id": folder_id}, {"$set": {
        "visibility": "public",
        "shared_with": data.shared_with if data.shared_with is not None else [],
        "access_type": data.access_type,
        "updated_at": now,
    }})
    return await db.meeting_folders.find_one({"id": folder_id}, {"_id": 0})


@router.post("/{folder_id}/unshare")
async def unshare_folder(folder_id: str, user=Depends(get_current_user)):
    folder = await db.meeting_folders.find_one({"id": folder_id, "deleted_at": None}, {"_id": 0})
    if not folder:
        raise HTTPException(404, "Folder not found")
    if folder.get("owner_id", folder.get("user_id")) != user["id"]:
        raise HTTPException(403, "Только владелец может настраивать доступ")
    now = datetime.now(timezone.utc).isoformat()
    await db.meeting_folders.update_one({"id": folder_id}, {"$set": {
        "visibility": "private", "shared_with": [], "updated_at": now,
    }})
    return await db.meeting_folders.find_one({"id": folder_id}, {"_id": 0})


@router.post("/{folder_id}/move")
async def move_folder(folder_id: str, data: FolderMove, user=Depends(get_current_user)):
    folder = await db.meeting_folders.find_one({"id": folder_id, "deleted_at": None}, {"_id": 0})
    if not folder:
        raise HTTPException(404, "Folder not found")
    if folder.get("owner_id", folder.get("user_id")) != user["id"]:
        raise HTTPException(403, "Только владелец может перемещать папку")
    if data.parent_id:
        parent = await db.meeting_folders.find_one(
            {"id": data.parent_id, "deleted_at": None}, {"_id": 0}
        )
        if not parent:
            raise HTTPException(404, "Целевая папка не найдена")
    now = datetime.now(timezone.utc).isoformat()
    await db.meeting_folders.update_one(
        {"id": folder_id}, {"$set": {"parent_id": data.parent_id, "updated_at": now}}
    )
    return await db.meeting_folders.find_one({"id": folder_id}, {"_id": 0})


@router.delete("/{folder_id}")
async def delete_folder(folder_id: str, user=Depends(get_current_user)):
    result = await soft_delete_folder(folder_id, user, "meeting_folders", "projects")
    if result is None:
        raise HTTPException(404, "Folder not found")
    if result == "forbidden":
        raise HTTPException(403, "Только владелец может удалить папку")
    return {"message": "Папка перемещена в корзину"}


@router.post("/{folder_id}/restore")
async def restore_folder(folder_id: str, user=Depends(get_current_user)):
    folder = await db.meeting_folders.find_one(
        {"id": folder_id, "owner_id": user["id"], "deleted_at": {"$ne": None}}, {"_id": 0}
    )
    if not folder:
        raise HTTPException(404, "Папка не найдена в корзине")
    now = datetime.now(timezone.utc).isoformat()
    await db.meeting_folders.update_one({"id": folder_id}, {"$set": {
        "deleted_at": None, "deleted_by": None, "parent_id": None, "updated_at": now,
    }})
    await db.projects.update_many(
        {"folder_id": folder_id, "owner_id": user["id"], "deleted_at": {"$ne": None}},
        {"$set": {"deleted_at": None, "deleted_by": None, "updated_at": now}},
    )
    return {"message": "Папка восстановлена"}


@router.delete("/{folder_id}/permanent")
async def permanent_delete_folder(folder_id: str, user=Depends(get_current_user)):
    folder = await db.meeting_folders.find_one(
        {"id": folder_id, "owner_id": user["id"], "deleted_at": {"$ne": None}}, {"_id": 0}
    )
    if not folder:
        raise HTTPException(404, "Папка не найдена в корзине")
    projects = await db.projects.find(
        {"folder_id": folder_id, "owner_id": user["id"]}, {"_id": 0, "id": 1}
    ).to_list(10000)
    from app.services.s3 import s3_enabled, delete_object
    for proj in projects:
        atts = await db.attachments.find(
            {"project_id": proj["id"], "s3_key": {"$exists": True, "$ne": None}},
            {"_id": 0, "s3_key": 1},
        ).to_list(500)
        if s3_enabled():
            for att in atts:
                try:
                    delete_object(att["s3_key"])
                except Exception:
                    pass
        await db.attachments.delete_many({"project_id": proj["id"]})
        await db.transcripts.delete_many({"project_id": proj["id"]})
        await db.uncertain_fragments.delete_many({"project_id": proj["id"]})
        await db.speaker_maps.delete_many({"project_id": proj["id"]})
        await db.chat_requests.delete_many({"project_id": proj["id"]})
        await db.projects.delete_one({"id": proj["id"]})
    await db.meeting_folders.delete_one({"id": folder_id})
    return {"message": "Папка удалена навсегда"}
