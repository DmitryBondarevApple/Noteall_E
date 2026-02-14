import uuid
import shutil
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks, Query
from app.core.database import db
from app.core.security import get_current_user
from app.core.config import UPLOAD_DIR, DEEPGRAM_API_KEY
from app.models.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services.gpt import call_gpt52, call_gpt52_metered
from app.services.metering import check_user_monthly_limit, check_org_balance, deduct_credits_and_record
from app.services.text_parser import parse_uncertain_fragments
from app.services.access_control import (
    can_user_access_project,
    can_user_write_project,
    get_accessible_public_folder_ids,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])


class ProjectMove(BaseModel):
    folder_id: Optional[str] = None

# Ensure upload directory exists
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


@router.post("", response_model=ProjectResponse)
async def create_project(data: ProjectCreate, user=Depends(get_current_user)):
    project_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    visibility = "private"
    if data.folder_id:
        folder = await db.meeting_folders.find_one(
            {"id": data.folder_id, "deleted_at": None}, {"_id": 0}
        )
        if folder:
            visibility = folder.get("visibility", "private")
            # Check write permission for folder
            from app.services.access_control import can_user_write_folder
            if visibility == "public" and not can_user_write_folder(folder, user):
                raise HTTPException(403, "Нет прав на создание проекта в этой папке")
            elif visibility != "public" and folder.get("owner_id", folder.get("user_id")) != user["id"]:
                raise HTTPException(403, "Нет прав на создание проекта в этой папке")

    project_doc = {
        "id": project_id,
        "name": data.name,
        "description": data.description or "",
        "user_id": user["id"],
        "owner_id": user["id"],
        "visibility": visibility,
        "status": "new",
        "folder_id": data.folder_id,
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
        "recording_filename": None,
        "recording_duration": None,
    }

    await db.projects.insert_one(project_doc)
    return ProjectResponse(**project_doc)


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    tab: str = Query("private"),
    folder_id: Optional[str] = Query(None),
    user=Depends(get_current_user),
):
    if tab == "trash":
        query = {"owner_id": user["id"], "deleted_at": {"$ne": None}}
        projects = await db.projects.find(query, {"_id": 0}).sort("deleted_at", -1).to_list(1000)
        return [ProjectResponse(**p) for p in projects]

    if tab == "public":
        pub_folder_ids = await get_accessible_public_folder_ids(user, "meeting_folders")
        if not pub_folder_ids:
            return []
        query = {"folder_id": {"$in": pub_folder_ids}, "deleted_at": None}
        if folder_id is not None:
            query["folder_id"] = folder_id
        projects = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
        return [ProjectResponse(**p) for p in projects]

    # private (default)
    query = {"owner_id": user["id"], "deleted_at": None}
    if folder_id is not None:
        query["folder_id"] = folder_id
    else:
        # Exclude projects in public folders from private tab
        pub_folder_ids = await get_accessible_public_folder_ids(user, "meeting_folders")
        if pub_folder_ids:
            query["$or"] = [
                {"folder_id": {"$nin": pub_folder_ids}},
                {"folder_id": None},
                {"folder_id": {"$exists": False}},
            ]
    projects = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [ProjectResponse(**p) for p in projects]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(**project)


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, data: ProjectUpdate, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Use exclude_unset to allow explicit null values (e.g., folder_id: null to move to root)
    update_data = data.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.projects.update_one({"id": project_id}, {"$set": update_data})
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return ProjectResponse(**updated)


@router.delete("/{project_id}")
async def delete_project(project_id: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Clean up S3 attachments
    from app.services.s3 import s3_enabled, delete_object
    attachments = await db.attachments.find({"project_id": project_id}, {"_id": 0, "s3_key": 1}).to_list(500)
    if s3_enabled():
        for att in attachments:
            if att.get("s3_key"):
                try:
                    delete_object(att["s3_key"])
                except Exception:
                    pass
    
    await db.projects.delete_one({"id": project_id})
    await db.transcripts.delete_many({"project_id": project_id})
    await db.uncertain_fragments.delete_many({"project_id": project_id})
    await db.speaker_maps.delete_many({"project_id": project_id})
    await db.chat_requests.delete_many({"project_id": project_id})
    await db.attachments.delete_many({"project_id": project_id})
    
    return {"message": "Project deleted"}


@router.post("/{project_id}/upload")
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    language: str = Form(default="ru"),
    reasoning_effort: str = Form(default="high"),
    fast_track: str = Form(default=""),
    fast_track_topic: str = Form(default=""),
    fast_track_pipeline_id: str = Form(default=""),
    user=Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    supported_languages = ["ru", "en", "de", "fr", "es", "it", "pt", "nl", "pl", "uk"]
    if language not in supported_languages:
        language = "ru"
    
    valid_efforts = ["auto", "minimal", "low", "medium", "high", "xhigh"]
    if reasoning_effort not in valid_efforts:
        reasoning_effort = "high"
    
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    filename = f"{file_id}{file_ext}"

    content = await file.read()
    # Audio files: store locally only (no S3), will be deleted after transcription
    file_path = Path(UPLOAD_DIR) / filename
    with open(file_path, "wb") as f:
        f.write(content)
    
    update_fields = {
            "recording_filename": filename,
            "language": language,
            "reasoning_effort": reasoning_effort,
            "status": "transcribing",
            "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if fast_track == "true":
        update_fields["fast_track"] = {
            "enabled": True,
            "topic": fast_track_topic or "",
            "pipeline_id": fast_track_pipeline_id or ""
        }
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": update_fields}
    )
    
    asyncio.create_task(process_transcription(project_id, filename, language, reasoning_effort, user["id"], user.get("org_id")))
    
    return {"message": "File uploaded, transcription started", "filename": filename}


@router.post("/{project_id}/process")
async def process_transcript_with_gpt(
    project_id: str,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user)
):
    """Trigger async GPT processing of transcript with master prompt"""
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    raw_transcript = await db.transcripts.find_one(
        {"project_id": project_id, "version_type": "raw"},
        {"_id": 0}
    )
    if not raw_transcript:
        raise HTTPException(status_code=400, detail="No raw transcript found")
    
    master_prompt = await db.prompts.find_one({"prompt_type": "master"}, {"_id": 0})
    if not master_prompt:
        raise HTTPException(status_code=400, detail="Master prompt not configured")
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"status": "processing", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Fetch speaker mappings to replace "Speaker N" with real names
    speaker_maps = await db.speaker_maps.find(
        {"project_id": project_id}, {"_id": 0}
    ).to_list(100)
    
    # Apply speaker names to raw content before sending to GPT
    content_for_gpt = raw_transcript["content"]
    for s in speaker_maps:
        if s.get("speaker_name") and s["speaker_name"] != s.get("speaker_label"):
            content_for_gpt = content_for_gpt.replace(
                f'{s["speaker_label"]}:', f'{s["speaker_name"]}:'
            )
    
    background_tasks.add_task(
        _run_gpt_processing,
        project_id,
        content_for_gpt,
        master_prompt,
        project.get("reasoning_effort", "high"),
        user.get("org_id"),
        user["id"],
    )
    
    return {"message": "Processing started", "status": "processing"}


async def _run_gpt_processing(project_id: str, raw_content: str, master_prompt: dict, reasoning_effort: str, org_id: str = None, user_id: str = None):
    """Background task for GPT processing"""
    logger.info(f"[{project_id}] Starting manual GPT processing with master prompt: '{master_prompt.get('name')}'")
    try:
        gpt_result = await call_gpt52_metered(
            system_message=master_prompt["content"],
            user_message=raw_content,
            reasoning_effort=reasoning_effort
        )
        processed_text = gpt_result.content

        # Deduct credits
        if org_id and user_id:
            try:
                await deduct_credits_and_record(
                    org_id=org_id,
                    user_id=user_id,
                    model=gpt_result.model,
                    prompt_tokens=gpt_result.prompt_tokens,
                    completion_tokens=gpt_result.completion_tokens,
                    source="transcript_processing",
                )
            except Exception as e:
                logger.error(f"Metering error: {e}")
        
        logger.info(f"[{project_id}] GPT processing complete, result: {len(processed_text)} chars")
        
        # Delete old processed transcript and fragments
        await db.transcripts.delete_many({"project_id": project_id, "version_type": "processed"})
        await db.uncertain_fragments.delete_many({"project_id": project_id})
        
        # Save processed transcript
        await db.transcripts.insert_one({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "version_type": "processed",
            "content": processed_text,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Parse uncertain fragments
        await parse_uncertain_fragments(project_id, processed_text)
        
        # Update project status
        fragments_count = await db.uncertain_fragments.count_documents({"project_id": project_id})
        new_status = "needs_review" if fragments_count > 0 else "ready"
        
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"[{project_id}] Processing complete, status: {new_status}, fragments: {fragments_count}")
        
    except Exception as e:
        logger.error(f"[{project_id}] GPT processing error: {e}")
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"status": "error", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )


async def process_transcription(project_id: str, filename: str, language: str = "ru", reasoning_effort: str = "high", user_id: str = None, org_id: str = None):
    """Transcription pipeline"""
    now = datetime.now(timezone.utc).isoformat()
    file_path = Path(UPLOAD_DIR) / filename
    
    try:
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"status": "transcribing", "updated_at": now}}
        )
        
        logger.info(f"[{project_id}] Starting transcription for {filename}")
        
        # Read audio from local file
        with open(file_path, "rb") as audio_file:
            audio_data = audio_file.read()
        
        # Deepgram transcription - run in executor to not block event loop
        from deepgram import DeepgramClient
        import concurrent.futures
        
        def run_deepgram():
            client = DeepgramClient(api_key=DEEPGRAM_API_KEY)
            
            response = client.listen.v1.media.transcribe_file(
                request=audio_data,
                model="nova-3",
                language=language,
                smart_format=True,
                diarize=True,
                paragraphs=True,
                punctuate=True,
            )
            return response
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as pool:
            response = await loop.run_in_executor(pool, run_deepgram)
        
        logger.info(f"[{project_id}] Deepgram transcription received")
        
        # Extract metadata
        duration = response.metadata.duration if response.metadata else 0
        
        # Extract transcript with speaker labels
        transcript_lines = []
        unique_speakers = set()
        
        # Navigate new SDK response structure
        if response.results and response.results.channels:
            for channel in response.results.channels:
                if channel.alternatives:
                    for alt in channel.alternatives:
                        if alt.paragraphs and alt.paragraphs.paragraphs:
                            for para in alt.paragraphs.paragraphs:
                                speaker = para.speaker if para.speaker is not None else 0
                                unique_speakers.add(speaker)
                                if para.sentences:
                                    for sentence in para.sentences:
                                        text = sentence.text if sentence.text else ""
                                        if text:
                                            transcript_lines.append(f"Speaker {speaker + 1}: {text}")
                        # Fallback: use paragraphs.transcript if available
                        elif alt.paragraphs and alt.paragraphs.transcript:
                            transcript_lines.append(alt.paragraphs.transcript)
                            unique_speakers.add(0)
                        # Fallback: use alternative transcript directly
                        elif alt.transcript:
                            transcript_lines.append(alt.transcript)
                            unique_speakers.add(0)
        
        raw_transcript = "\n\n".join(transcript_lines)
        
        if not raw_transcript.strip():
            raise Exception("Empty transcript received from Deepgram")
        
        # Save raw transcript
        await db.transcripts.insert_one({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "version_type": "raw",
            "content": raw_transcript,
            "created_at": now
        })
        
        logger.info(f"[{project_id}] Raw transcript saved, {len(raw_transcript)} chars, {len(unique_speakers)} speakers")
        
        # Create speaker map
        if not unique_speakers:
            unique_speakers = {0}
        
        for speaker_num in sorted(unique_speakers):
            await db.speaker_maps.insert_one({
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "speaker_label": f"Speaker {speaker_num + 1}",
                "speaker_name": f"Speaker {speaker_num + 1}"
            })
        
        # Update project status to ready
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {
                "status": "ready",
                "recording_duration": duration,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"[{project_id}] Transcription complete, ready for manual processing")
        
        # Deduct transcription cost from org balance
        if org_id and user_id and duration > 0:
            try:
                from app.services.metering import deduct_transcription_cost
                cost_result = await deduct_transcription_cost(org_id, user_id, duration)
                logger.info(f"[{project_id}] Transcription cost deducted: {cost_result}")
            except Exception as cost_err:
                logger.error(f"[{project_id}] Failed to deduct transcription cost: {cost_err}")
        
        # Delete local audio file after successful transcription
        try:
            if file_path.exists():
                file_path.unlink()
                logger.info(f"[{project_id}] Deleted local audio file: {filename}")
        except Exception as cleanup_err:
            logger.warning(f"[{project_id}] Failed to delete audio file: {cleanup_err}")
        
    except Exception as e:
        import traceback
        logger.error(f"[{project_id}] Transcription error: {e}")
        logger.error(f"[{project_id}] Traceback: {traceback.format_exc()}")
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {
                "status": "error",
                "error_message": str(e),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
