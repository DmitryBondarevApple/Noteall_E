import logging
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import (
    auth_router,
    projects_router,
    transcripts_router,
    fragments_router,
    speakers_router,
    prompts_router,
    chat_router,
    admin_router,
    seed_router,
    export_router,
    pipelines_router,
    attachments_router,
    documents_router,
    meeting_folders_router,
    ai_chat_router,
    organizations_router,
    billing_router,
    invitations_router,
)
from app.core.database import client

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create app
app = FastAPI(
    title="Voice Workspace API",
    description="API for transcribing and analyzing meetings",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(transcripts_router, prefix="/api")
app.include_router(fragments_router, prefix="/api")
app.include_router(speakers_router, prefix="/api")
app.include_router(prompts_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(seed_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(pipelines_router, prefix="/api")
app.include_router(attachments_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(meeting_folders_router, prefix="/api")
app.include_router(ai_chat_router, prefix="/api")
app.include_router(organizations_router, prefix="/api")
app.include_router(billing_router, prefix="/api")
app.include_router(invitations_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}


@app.get("/api/model-info")
async def model_info():
    from app.core.database import db
    settings = await db.settings.find_one({"key": "active_model"}, {"_id": 0})
    model = settings["value"] if settings else "gpt-5.2"
    return {"model": model}


@app.on_event("startup")
async def startup_db_client():
    logger.info("Starting Voice Workspace API v2.0.0")
    # Ensure superadmin role for the product owner
    from app.core.database import db
    SUPERADMIN_EMAIL = "dmitry.bondarev@gmail.com"
    result = await db.users.update_one(
        {"email": SUPERADMIN_EMAIL},
        {"$set": {"role": "superadmin"}},
    )
    if result.modified_count:
        logger.info(f"Promoted {SUPERADMIN_EMAIL} to superadmin")
    elif result.matched_count:
        logger.info(f"{SUPERADMIN_EMAIL} is already superadmin")
    
    # Ensure superadmin has an organization
    sa_user = await db.users.find_one({"email": SUPERADMIN_EMAIL}, {"_id": 0})
    if sa_user and not sa_user.get("org_id"):
        import uuid as _uuid
        org_id = str(_uuid.uuid4())
        org_name = "Bondarev Consulting"
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.organizations.insert_one({
            "id": org_id,
            "name": org_name,
            "owner_id": sa_user["id"],
            "created_at": now_iso,
            "updated_at": now_iso,
        })
        await db.users.update_one(
            {"email": SUPERADMIN_EMAIL},
            {"$set": {"org_id": org_id}},
        )
        await db.credit_balances.insert_one({
            "org_id": org_id,
            "balance": 1000.0,
            "updated_at": now_iso,
        })
        await db.transactions.insert_one({
            "id": str(_uuid.uuid4()),
            "org_id": org_id,
            "user_id": sa_user["id"],
            "type": "topup",
            "amount": 1000.0,
            "description": "Начальные кредиты (суперадмин)",
            "created_at": now_iso,
        })
        logger.info(f"Created org '{org_name}' for {SUPERADMIN_EMAIL}")
    elif sa_user and sa_user.get("org_id"):
        # Ensure org is named correctly
        await db.organizations.update_one(
            {"id": sa_user["org_id"], "name": {"$ne": "Bondarev Consulting"}},
            {"$set": {"name": "Bondarev Consulting"}},
        )
    
    # Fetch exchange rate on startup
    from app.routes.billing import update_exchange_rate
    await update_exchange_rate()

    # Run data migration for public/private storage system
    await _migrate_storage_schema()

    # Schedule daily exchange rate update at 3am MSK (00:00 UTC)
    # and S3 storage cost calculation at 3:05am MSK (00:05 UTC)
    # and trash cleanup at 3:10am MSK
    import asyncio
    async def rate_updater():
        while True:
            now = datetime.now(timezone.utc)
            # 3am MSK = 00:00 UTC (MSK = UTC+3)
            target = now.replace(hour=0, minute=0, second=0, microsecond=0)
            if now >= target:
                target += timedelta(days=1)
            wait_secs = (target - now).total_seconds()
            logger.info(f"Next exchange rate update in {wait_secs/3600:.1f}h")
            await asyncio.sleep(wait_secs)
            await update_exchange_rate()
            # Run storage cost calculation 5 minutes after rate update
            await asyncio.sleep(300)
            await calculate_daily_storage_costs()
            # Run trash cleanup 5 minutes after storage calc
            await asyncio.sleep(300)
            await _run_trash_cleanup()

    asyncio.create_task(rate_updater())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


async def calculate_daily_storage_costs():
    """Calculate and deduct S3 storage costs for all orgs. Runs daily after exchange rate update."""
    from app.core.database import db
    from app.services.metering import get_cost_settings, usd_to_credits
    import uuid as _uuid
    import calendar

    logger.info("Starting daily S3 storage cost calculation")

    try:
        settings = await get_cost_settings()
        cost_per_gb_month = settings["s3_storage_cost_per_gb_month_usd"]
        multiplier = settings["s3_storage_cost_multiplier"]

        if cost_per_gb_month <= 0 or multiplier <= 0:
            logger.info("Storage cost calculation skipped: cost or multiplier is 0")
            return

        now = datetime.now(timezone.utc)
        days_in_month = calendar.monthrange(now.year, now.month)[1]
        daily_cost_per_gb = cost_per_gb_month / days_in_month

        # Get all orgs
        orgs = await db.organizations.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(10000)

        for org in orgs:
            org_id = org["id"]
            # Find all users in this org
            org_users = await db.users.find(
                {"org_id": org_id}, {"_id": 0, "id": 1}
            ).to_list(10000)
            user_ids = [u["id"] for u in org_users]
            if not user_ids:
                continue

            total_bytes = 0

            # Sum S3 storage from meeting project attachments
            att_pipeline = [
                {"$match": {"s3_key": {"$exists": True, "$ne": None}}},
                {"$lookup": {
                    "from": "projects",
                    "localField": "project_id",
                    "foreignField": "id",
                    "as": "project",
                }},
                {"$unwind": "$project"},
                {"$match": {"project.user_id": {"$in": user_ids}}},
                {"$group": {"_id": None, "total_size": {"$sum": {"$ifNull": ["$size", 0]}}}},
            ]
            att_result = await db.attachments.aggregate(att_pipeline).to_list(1)
            if att_result:
                total_bytes += att_result[0].get("total_size", 0)

            # Sum S3 storage from document project attachments
            doc_att_pipeline = [
                {"$match": {"s3_key": {"$exists": True, "$ne": None}}},
                {"$lookup": {
                    "from": "doc_projects",
                    "localField": "project_id",
                    "foreignField": "id",
                    "as": "project",
                }},
                {"$unwind": "$project"},
                {"$match": {"project.user_id": {"$in": user_ids}}},
                {"$group": {"_id": None, "total_size": {"$sum": {"$ifNull": ["$size", 0]}}}},
            ]
            doc_att_result = await db.doc_attachments.aggregate(doc_att_pipeline).to_list(1)
            if doc_att_result:
                total_bytes += doc_att_result[0].get("total_size", 0)

            if total_bytes <= 0:
                continue

            total_gb = total_bytes / (1024 ** 3)
            base_cost_usd = total_gb * daily_cost_per_gb
            final_cost_usd = base_cost_usd * multiplier
            credits_used = usd_to_credits(final_cost_usd)

            if credits_used <= 0.0001:
                continue

            now_iso = now.isoformat()

            await db.credit_balances.update_one(
                {"org_id": org_id},
                {"$inc": {"balance": -credits_used}, "$set": {"updated_at": now_iso}},
            )

            txn = {
                "id": str(_uuid.uuid4()),
                "org_id": org_id,
                "user_id": "system",
                "type": "deduction",
                "amount": round(credits_used, 4),
                "description": f"Хранение S3: {total_gb:.4f} ГБ (${base_cost_usd:.6f} x{multiplier})",
                "created_at": now_iso,
            }
            await db.transactions.insert_one(txn)

            logger.info(
                f"Storage cost: org={org_id} ({org['name']}) "
                f"size={total_gb:.4f}GB base=${base_cost_usd:.6f} "
                f"multiplier={multiplier}x credits={credits_used:.4f}"
            )

        logger.info("Daily S3 storage cost calculation complete")

    except Exception as e:
        logger.error(f"Storage cost calculation error: {e}")
        import traceback
        logger.error(traceback.format_exc())



async def _migrate_storage_schema():
    """One-time migration: add owner_id, visibility, deleted_at to existing data."""
    from app.core.database import db

    # Migrate projects
    migrated = await db.projects.update_many(
        {"owner_id": {"$exists": False}},
        [{"$set": {
            "owner_id": "$user_id",
            "visibility": "private",
            "deleted_at": None,
        }}],
    )
    if migrated.modified_count:
        logger.info(f"Migrated {migrated.modified_count} projects (added owner_id/visibility/deleted_at)")

    # Migrate meeting_folders
    migrated = await db.meeting_folders.update_many(
        {"owner_id": {"$exists": False}},
        [{"$set": {
            "owner_id": "$user_id",
            "visibility": "private",
            "shared_with": [],
            "access_type": "readwrite",
            "org_id": None,
            "is_system": False,
            "system_type": None,
            "deleted_at": None,
        }}],
    )
    if migrated.modified_count:
        logger.info(f"Migrated {migrated.modified_count} meeting_folders")

    # Migrate doc_projects
    migrated = await db.doc_projects.update_many(
        {"owner_id": {"$exists": False}},
        [{"$set": {
            "owner_id": "$user_id",
            "visibility": "private",
            "deleted_at": None,
        }}],
    )
    if migrated.modified_count:
        logger.info(f"Migrated {migrated.modified_count} doc_projects")

    # Migrate doc_folders
    migrated = await db.doc_folders.update_many(
        {"owner_id": {"$exists": False}},
        [{"$set": {
            "owner_id": "$user_id",
            "visibility": "private",
            "shared_with": [],
            "access_type": "readwrite",
            "org_id": None,
            "is_system": False,
            "system_type": None,
            "deleted_at": None,
        }}],
    )
    if migrated.modified_count:
        logger.info(f"Migrated {migrated.modified_count} doc_folders")

    # Backfill org_id for meeting_folders from user data
    folders_no_org = await db.meeting_folders.find(
        {"org_id": None, "owner_id": {"$exists": True}}, {"_id": 0, "id": 1, "owner_id": 1}
    ).to_list(10000)
    for folder in folders_no_org:
        user = await db.users.find_one({"id": folder["owner_id"]}, {"_id": 0, "org_id": 1})
        if user and user.get("org_id"):
            await db.meeting_folders.update_one(
                {"id": folder["id"]}, {"$set": {"org_id": user["org_id"]}}
            )

    # Backfill org_id for doc_folders
    doc_folders_no_org = await db.doc_folders.find(
        {"org_id": None, "owner_id": {"$exists": True}}, {"_id": 0, "id": 1, "owner_id": 1}
    ).to_list(10000)
    for folder in doc_folders_no_org:
        user = await db.users.find_one({"id": folder["owner_id"]}, {"_id": 0, "org_id": 1})
        if user and user.get("org_id"):
            await db.doc_folders.update_one(
                {"id": folder["id"]}, {"$set": {"org_id": user["org_id"]}}
            )

    logger.info("Storage schema migration check complete")


async def _run_trash_cleanup():
    """Run trash cleanup for both meeting and document collections."""
    from app.services.access_control import cleanup_expired_trash
    try:
        await cleanup_expired_trash("meeting_folders", "projects")
        await cleanup_expired_trash("doc_folders", "doc_projects")
        logger.info("Trash cleanup complete")
    except Exception as e:
        logger.error(f"Trash cleanup error: {e}")
