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
    attachments_router
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


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}


@app.on_event("startup")
async def startup_db_client():
    logger.info("Starting Voice Workspace API v2.0.0")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
