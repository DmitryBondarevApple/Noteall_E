import logging
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
    
    # Fetch exchange rate on startup
    from app.routes.billing import update_exchange_rate
    await update_exchange_rate()
    
    # Schedule daily exchange rate update at 3am MSK (00:00 UTC)
    import asyncio
    async def rate_updater():
        while True:
            now = datetime.now(timezone.utc)
            # 3am MSK = 00:00 UTC (MSK = UTC+3)
            target = now.replace(hour=0, minute=0, second=0, microsecond=0)
            if now >= target:
                from datetime import timedelta
                target += timedelta(days=1)
            wait_secs = (target - now).total_seconds()
            logger.info(f"Next exchange rate update in {wait_secs/3600:.1f}h")
            await asyncio.sleep(wait_secs)
            await update_exchange_rate()
    
    asyncio.create_task(rate_updater())


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
