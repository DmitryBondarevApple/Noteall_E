"""
Shared access-control helpers for folders & projects.
Handles visibility (private/public), sharing, soft-delete (trash).
Works identically for meeting_folders/projects and doc_folders/doc_projects.
"""
import uuid
import logging
from datetime import datetime, timezone
from app.core.database import db

logger = logging.getLogger(__name__)

SYSTEM_FOLDER_RECOVERED = "Из удалённого"


async def ensure_recovered_folder(user_id: str, collection_name: str) -> str:
    """Get or create the system 'Из удалённого' folder for a user."""
    coll = db[collection_name]
    folder = await coll.find_one(
        {"user_id": user_id, "is_system": True, "system_type": "recovered"},
        {"_id": 0, "id": 1},
    )
    if folder:
        return folder["id"]
    now = datetime.now(timezone.utc).isoformat()
    folder_id = str(uuid.uuid4())
    await coll.insert_one({
        "id": folder_id,
        "user_id": user_id,
        "name": SYSTEM_FOLDER_RECOVERED,
        "parent_id": None,
        "description": "Проекты из удалённых публичных папок",
        "visibility": "private",
        "shared_with": [],
        "access_type": "readwrite",
        "owner_id": user_id,
        "org_id": None,
        "is_system": True,
        "system_type": "recovered",
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
    })
    return folder_id


def can_user_access_folder(folder: dict, user: dict) -> bool:
    """Check if user can see a public folder."""
    if folder.get("visibility") != "public":
        return folder.get("user_id") == user["id"] or folder.get("owner_id") == user["id"]
    if folder.get("org_id") != user.get("org_id"):
        return False
    shared = folder.get("shared_with", [])
    if not shared or "all" in shared:
        return True
    return user["id"] in shared


def can_user_write_folder(folder: dict, user: dict) -> bool:
    """Check if user can create subfolders/projects in a public folder."""
    if folder.get("owner_id") == user["id"]:
        return True
    if not can_user_access_folder(folder, user):
        return False
    return folder.get("access_type") == "readwrite"


async def get_trash_retention_days() -> int:
    """Get trash retention period from settings."""
    from app.services.metering import get_cost_settings
    doc = await db.settings.find_one({"key": "trash_settings"}, {"_id": 0})
    if doc and "value" in doc:
        return doc["value"].get("retention_days", 30)
    return 30


async def set_trash_retention_days(days: int):
    now = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"key": "trash_settings"},
        {"$set": {"key": "trash_settings", "value": {"retention_days": days}, "updated_at": now}},
        upsert=True,
    )


async def soft_delete_folder(
    folder_id: str,
    user: dict,
    folder_collection: str,
    project_collection: str,
):
    """
    Soft-delete a folder (move to trash).
    For public folders: other users' projects go to their 'Из удалённого'.
    """
    coll_folders = db[folder_collection]
    coll_projects = db[project_collection]
    now = datetime.now(timezone.utc).isoformat()

    folder = await coll_folders.find_one({"id": folder_id, "deleted_at": None}, {"_id": 0})
    if not folder:
        return None

    # Permission: only owner can delete
    is_owner = folder.get("owner_id", folder.get("user_id")) == user["id"]
    if not is_owner:
        return "forbidden"

    # If public folder, relocate other users' projects
    if folder.get("visibility") == "public":
        # Get all projects in this folder (and subfolders)
        all_folder_ids = await _get_descendant_folder_ids(folder_id, coll_folders)
        all_folder_ids.append(folder_id)

        # Find projects by OTHER users in these folders
        other_projects = await coll_projects.find(
            {
                "folder_id": {"$in": all_folder_ids},
                "owner_id": {"$ne": user["id"]},
                "deleted_at": None,
            },
            {"_id": 0, "id": 1, "owner_id": 1},
        ).to_list(10000)

        # Move each to their owner's "Из удалённого"
        for proj in other_projects:
            recovered_id = await ensure_recovered_folder(proj["owner_id"], folder_collection)
            await coll_projects.update_one(
                {"id": proj["id"]},
                {"$set": {
                    "folder_id": recovered_id,
                    "visibility": "private",
                    "updated_at": now,
                }},
            )

        # Soft-delete subfolders
        await coll_folders.update_many(
            {"id": {"$in": all_folder_ids[:-1]}, "deleted_at": None},
            {"$set": {"deleted_at": now, "deleted_by": user["id"]}},
        )

    # Soft-delete the folder itself
    await coll_folders.update_one(
        {"id": folder_id},
        {"$set": {"deleted_at": now, "deleted_by": user["id"]}},
    )

    # Soft-delete owner's own projects in folder
    await coll_projects.update_many(
        {
            "folder_id": folder_id,
            "owner_id": user["id"],
            "deleted_at": None,
        },
        {"$set": {"deleted_at": now, "deleted_by": user["id"]}},
    )

    return "ok"


async def _get_descendant_folder_ids(parent_id: str, coll) -> list:
    """Recursively get all descendant folder IDs."""
    children = await coll.find(
        {"parent_id": parent_id, "deleted_at": None},
        {"_id": 0, "id": 1},
    ).to_list(10000)
    result = [c["id"] for c in children]
    for child_id in list(result):
        result.extend(await _get_descendant_folder_ids(child_id, coll))
    return result


async def cascade_visibility(
    folder_id: str,
    visibility: str,
    folder_collection: str,
    project_collection: str,
):
    """Cascade visibility change to all descendant folders and projects."""
    coll_folders = db[folder_collection]
    coll_projects = db[project_collection]
    now = datetime.now(timezone.utc).isoformat()

    descendant_ids = await _get_descendant_folder_ids(folder_id, coll_folders)
    if descendant_ids:
        await coll_folders.update_many(
            {"id": {"$in": descendant_ids}, "deleted_at": None},
            {"$set": {"visibility": visibility, "updated_at": now}},
        )

    all_ids = [folder_id] + descendant_ids
    await coll_projects.update_many(
        {"folder_id": {"$in": all_ids}, "deleted_at": None},
        {"$set": {"visibility": visibility, "updated_at": now}},
    )


async def get_accessible_public_folder_ids(user: dict, folder_collection: str) -> list:
    """Get all public folder IDs accessible to user in their org."""
    query = {"visibility": "public", "org_id": user.get("org_id"), "deleted_at": None}
    folders = await db[folder_collection].find(query, {"_id": 0}).to_list(10000)
    return [f["id"] for f in folders if can_user_access_folder(f, user)]


async def can_user_access_project(project: dict, user: dict, folder_collection: str) -> bool:
    """Check if user can read a project (owner or via public folder access)."""
    if project.get("owner_id", project.get("user_id")) == user["id"]:
        return True
    folder_id = project.get("folder_id")
    if not folder_id:
        return False
    folder = await db[folder_collection].find_one({"id": folder_id, "deleted_at": None}, {"_id": 0})
    if not folder:
        return False
    return can_user_access_folder(folder, user)


async def can_user_write_project(project: dict, user: dict, folder_collection: str) -> bool:
    """Check if user can write to a project (owner or readwrite folder)."""
    if project.get("owner_id", project.get("user_id")) == user["id"]:
        return True
    folder_id = project.get("folder_id")
    if not folder_id:
        return False
    folder = await db[folder_collection].find_one({"id": folder_id, "deleted_at": None}, {"_id": 0})
    if not folder:
        return False
    return can_user_write_folder(folder, user)


async def cleanup_expired_trash(folder_collection: str, project_collection: str):
    """Permanently delete items that exceeded trash retention period."""
    from datetime import timedelta

    days = await get_trash_retention_days()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    coll_folders = db[folder_collection]
    coll_projects = db[project_collection]

    # Find expired projects
    expired_projects = await coll_projects.find(
        {"deleted_at": {"$lte": cutoff, "$ne": None}},
        {"_id": 0, "id": 1},
    ).to_list(10000)

    for proj in expired_projects:
        # Clean up S3 attachments if needed
        att_coll = "attachments" if project_collection == "projects" else "doc_attachments"
        attachments = await db[att_coll].find(
            {"project_id": proj["id"], "s3_key": {"$exists": True, "$ne": None}},
            {"_id": 0, "s3_key": 1},
        ).to_list(500)
        from app.services.s3 import s3_enabled, delete_object
        if s3_enabled():
            for att in attachments:
                try:
                    delete_object(att["s3_key"])
                except Exception:
                    pass
        await db[att_coll].delete_many({"project_id": proj["id"]})
        await coll_projects.delete_one({"id": proj["id"]})

    # Find expired folders
    expired_folders = await coll_folders.find(
        {"deleted_at": {"$lte": cutoff, "$ne": None}},
        {"_id": 0, "id": 1},
    ).to_list(10000)
    for folder in expired_folders:
        await coll_folders.delete_one({"id": folder["id"]})

    total = len(expired_projects) + len(expired_folders)
    if total > 0:
        logger.info(f"Trash cleanup ({folder_collection}): deleted {len(expired_projects)} projects, {len(expired_folders)} folders")
