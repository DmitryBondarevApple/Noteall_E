import uuid
import shutil
import asyncio
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from app.core.database import db
from app.core.security import get_current_user
from app.core.config import UPLOAD_DIR, DEEPGRAM_API_KEY
from app.models.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.services.gpt import call_gpt52
from app.services.text_parser import parse_uncertain_fragments

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])

# Ensure upload directory exists
Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


async def analyze_speakers_with_ai(project_id: str, transcript: str, speaker_nums: list):
    """Background task to analyze speakers using AI"""
    try:
        logger.info(f"[{project_id}] Starting AI speaker analysis")
        
        # Build speaker labels
        speaker_labels = [f"Speaker {num + 1}" for num in speaker_nums]
        
        # System message
        system_message = """Ты - эксперт по анализу транскриптов встреч. 
Твоя задача - определить информацию о спикерах по косвенным признакам в тексте."""

        # User message with transcript
        user_message = f"""Проанализируй транскрипт встречи и определи информацию о каждом спикере.

Спикеры в транскрипте: {', '.join(speaker_labels)}

Для каждого спикера определи:
1. **Пол** - по окончаниям глаголов прошедшего времени (говорил/говорила, сказал/сказала, думал/думала и т.п.)
2. **Возможное имя** - если другие участники обращаются к спикеру по имени ("Иван, ты...", "Слушай, Маша...")
3. **Роль** - если спикер упоминает свою должность или роль

Верни ответ ТОЛЬКО в формате JSON без дополнительного текста:
{{
  "Speaker 1": {{"gender": "м" или "ж" или null, "possible_name": "Имя" или null, "role": "роль" или null}},
  "Speaker 2": {{"gender": "м" или "ж" или null, "possible_name": "Имя" или null, "role": "роль" или null}}
}}

Транскрипт (первые 8000 символов):
{transcript[:8000]}"""

        # Call GPT with system and user messages
        response = await call_gpt52(system_message, user_message, reasoning_effort="low")
        
        if not response:
            logger.warning(f"[{project_id}] Empty AI response for speaker analysis")
            return
        
        # Parse JSON response
        import json
        import re
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response)
        if not json_match:
            logger.warning(f"[{project_id}] No JSON found in AI response: {response[:200]}")
            return
        
        try:
            hints = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            logger.warning(f"[{project_id}] Failed to parse AI response as JSON: {e}")
            return
        
        # Save hints to project
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {
                "speaker_hints": hints,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"[{project_id}] AI speaker analysis complete: {hints}")
        
    except Exception as e:
        logger.error(f"[{project_id}] AI speaker analysis error: {e}")
        # Don't raise - this is a background task, failure shouldn't affect main flow


@router.post("", response_model=ProjectResponse)
async def create_project(data: ProjectCreate, user=Depends(get_current_user)):
    project_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    project_doc = {
        "id": project_id,
        "name": data.name,
        "description": data.description or "",
        "user_id": user["id"],
        "status": "new",
        "created_at": now,
        "updated_at": now,
        "recording_filename": None,
        "recording_duration": None
    }
    
    await db.projects.insert_one(project_doc)
    return ProjectResponse(**project_doc)


@router.get("", response_model=List[ProjectResponse])
async def list_projects(user=Depends(get_current_user)):
    projects = await db.projects.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
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
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.projects.update_one({"id": project_id}, {"$set": update_data})
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return ProjectResponse(**updated)


@router.delete("/{project_id}")
async def delete_project(project_id: str, user=Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.projects.delete_one({"id": project_id})
    await db.transcripts.delete_many({"project_id": project_id})
    await db.uncertain_fragments.delete_many({"project_id": project_id})
    await db.speaker_maps.delete_many({"project_id": project_id})
    await db.chat_requests.delete_many({"project_id": project_id})
    
    return {"message": "Project deleted"}


@router.post("/{project_id}/upload")
async def upload_file(
    project_id: str,
    file: UploadFile = File(...),
    language: str = Form(default="ru"),
    reasoning_effort: str = Form(default="high"),
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
    file_path = Path(UPLOAD_DIR) / filename
    
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "recording_filename": filename,
            "language": language,
            "reasoning_effort": reasoning_effort,
            "status": "transcribing",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    asyncio.create_task(process_transcription(project_id, filename, language, reasoning_effort))
    
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
    
    background_tasks.add_task(
        _run_gpt_processing,
        project_id,
        raw_transcript["content"],
        master_prompt,
        project.get("reasoning_effort", "high")
    )
    
    return {"message": "Processing started", "status": "processing"}


async def _run_gpt_processing(project_id: str, raw_content: str, master_prompt: dict, reasoning_effort: str):
    """Background task for GPT processing"""
    logger.info(f"[{project_id}] Starting manual GPT processing with master prompt: '{master_prompt.get('name')}'")
    try:
        processed_text = await call_gpt52(
            system_message=master_prompt["content"],
            user_message=raw_content,
            reasoning_effort=reasoning_effort
        )
        
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


async def process_transcription(project_id: str, filename: str, language: str = "ru", reasoning_effort: str = "high"):
    """Deepgram transcription pipeline"""
    now = datetime.now(timezone.utc).isoformat()
    file_path = Path(UPLOAD_DIR) / filename
    
    try:
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"status": "transcribing", "updated_at": now}}
        )
        
        logger.info(f"[{project_id}] Starting Deepgram transcription for {filename}")
        
        # Deepgram transcription - run in executor to not block event loop
        from deepgram import DeepgramClient
        import concurrent.futures
        
        def run_deepgram():
            client = DeepgramClient(api_key=DEEPGRAM_API_KEY)
            
            with open(file_path, "rb") as audio_file:
                buffer_data = audio_file.read()
            
            # Use new SDK v5 API
            response = client.listen.v1.media.transcribe_file(
                request=buffer_data,
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
        
        # Run AI speaker recognition in background (don't block)
        asyncio.create_task(analyze_speakers_with_ai(project_id, raw_transcript, list(unique_speakers)))
        
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
