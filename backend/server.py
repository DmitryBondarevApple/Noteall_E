from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import shutil
import httpx
import asyncio
import re
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# API Keys
DEEPGRAM_API_KEY = os.environ.get('DEEPGRAM_API_KEY')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'default-secret-key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# File storage
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Create the main app
app = FastAPI(title="Voice Workspace API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = ""

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    user_id: str
    status: str
    created_at: str
    updated_at: str
    recording_filename: Optional[str] = None
    recording_duration: Optional[float] = None

class TranscriptVersionResponse(BaseModel):
    id: str
    project_id: str
    version_type: str
    content: str
    created_at: str

class UncertainFragmentCreate(BaseModel):
    original_text: str
    context: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    suggestions: List[str] = []

class UncertainFragmentUpdate(BaseModel):
    corrected_text: str
    status: Literal["pending", "confirmed", "rejected"] = "confirmed"

class UncertainFragmentResponse(BaseModel):
    id: str
    project_id: str
    original_text: str
    corrected_text: Optional[str]
    context: str
    start_time: Optional[float]
    end_time: Optional[float]
    suggestions: List[str]
    status: str
    created_at: str

class SpeakerMapCreate(BaseModel):
    speaker_label: str
    speaker_name: str

class SpeakerMapResponse(BaseModel):
    id: str
    project_id: str
    speaker_label: str
    speaker_name: str

class PromptCreate(BaseModel):
    name: str
    content: str
    prompt_type: Literal["master", "thematic", "personal", "project"]
    project_id: Optional[str] = None
    is_public: bool = False

class PromptUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    is_public: Optional[bool] = None

class PromptResponse(BaseModel):
    id: str
    name: str
    content: str
    prompt_type: str
    user_id: Optional[str]
    project_id: Optional[str]
    is_public: bool
    created_at: str
    updated_at: str

class ChatRequestCreate(BaseModel):
    prompt_id: str
    additional_text: Optional[str] = ""

class ChatRequestResponse(BaseModel):
    id: str
    project_id: str
    prompt_id: str
    prompt_content: str
    additional_text: str
    response_text: str
    created_at: str

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_admin_user(user = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": data.email,
        "password": hash_password(data.password),
        "name": data.name,
        "role": "user",
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, "user")
    user_response = UserResponse(
        id=user_id,
        email=data.email,
        name=data.name,
        role="user",
        created_at=now
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["role"])
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        created_at=user["created_at"]
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user = Depends(get_current_user)):
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        role=user["role"],
        created_at=user["created_at"]
    )

# ==================== PROJECT ROUTES ====================

@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(data: ProjectCreate, user = Depends(get_current_user)):
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

@api_router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(user = Depends(get_current_user)):
    projects = await db.projects.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    return [ProjectResponse(**p) for p in projects]

@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, user = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(**project)

@api_router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, data: ProjectUpdate, user = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.projects.update_one({"id": project_id}, {"$set": update_data})
    
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return ProjectResponse(**updated)

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.projects.delete_one({"id": project_id})
    await db.transcripts.delete_many({"project_id": project_id})
    await db.uncertain_fragments.delete_many({"project_id": project_id})
    await db.speaker_maps.delete_many({"project_id": project_id})
    await db.chat_requests.delete_many({"project_id": project_id})
    await db.prompts.delete_many({"project_id": project_id})
    
    return {"message": "Project deleted"}

# ==================== FILE UPLOAD ====================

@api_router.post("/projects/{project_id}/upload")
async def upload_recording(
    project_id: str,
    file: UploadFile = File(...),
    language: str = Form(default="ru"),
    reasoning_effort: str = Form(default="high"),
    user = Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate language
    supported_languages = ["ru", "en", "de", "fr", "es", "it", "pt", "nl", "pl", "uk"]
    if language not in supported_languages:
        language = "ru"
    
    # Validate reasoning effort
    valid_efforts = ["auto", "minimal", "low", "medium", "high", "xhigh"]
    if reasoning_effort not in valid_efforts:
        reasoning_effort = "high"
    
    # Save file locally
    file_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    filename = f"{file_id}{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    # Update project with settings
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
    
    # Start transcription in background
    asyncio.create_task(process_transcription(project_id, filename, language, reasoning_effort))
    
    return {"message": "File uploaded, transcription started", "filename": filename}

async def call_gpt4o(system_message: str, user_message: str) -> str:
    """Call GPT-4o via user's OpenAI API for initial processing"""
    try:
        from openai import AsyncOpenAI
        
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
            temperature=0.3,
        )
        
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"GPT-4o error: {e}")
        raise e

async def call_gpt52(system_message: str, user_message: str, reasoning_effort: str = "high") -> str:
    """
    Call GPT-5.2 via OpenAI API for master prompt processing
    reasoning_effort: 'auto', 'minimal', 'low', 'medium', 'high', 'xhigh' (deep thinking)
    """
    try:
        from openai import AsyncOpenAI
        
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        
        # Build request params
        params = {
            "model": "gpt-5.2",
            "messages": [
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_message}
            ],
        }
        
        # Map reasoning effort to model parameters
        # For GPT-5.2, use temperature and max_completion_tokens based on effort
        effort_config = {
            "auto": {"temperature": 0.5},
            "minimal": {"temperature": 0.7, "max_completion_tokens": 2000},
            "low": {"temperature": 0.5, "max_completion_tokens": 4000},
            "medium": {"temperature": 0.3, "max_completion_tokens": 8000},
            "high": {"temperature": 0.2, "max_completion_tokens": 16000},
            "xhigh": {"temperature": 0.1, "max_completion_tokens": 32000},
        }
        
        config = effort_config.get(reasoning_effort, effort_config["high"])
        params.update(config)
        
        response = await client.chat.completions.create(**params)
        
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"GPT-5.2 error: {e}")
        raise e

async def process_transcription(project_id: str, filename: str, language: str = "ru", reasoning_effort: str = "high"):
    """
    Pipeline:
    1. Deepgram -> raw transcript
    2. GPT-4o (Emergent) -> initial cleanup
    3. GPT-5.2 (User's OpenAI) + User's Master Prompt -> final processed transcript
    4. Extract speakers for mapping
    """
    now = datetime.now(timezone.utc).isoformat()
    file_path = UPLOAD_DIR / filename
    
    try:
        # ========== STEP 1: DEEPGRAM TRANSCRIPTION ==========
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"status": "transcribing", "updated_at": now}}
        )
        
        with open(file_path, "rb") as audio_file:
            buffer_data = audio_file.read()
        
        ext = Path(filename).suffix.lower()
        content_types = {
            '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
            '.webm': 'video/webm', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
        }
        content_type = content_types.get(ext, 'audio/mpeg')
        
        logger.info(f"[{project_id}] Starting Deepgram transcription, language: {language}")
        
        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.post(
                "https://api.deepgram.com/v1/listen",
                params={
                    "model": "nova-3",
                    "language": language,
                    "smart_format": "true",
                    "diarize": "true",
                    "punctuate": "true",
                    "paragraphs": "true",
                },
                headers={
                    "Authorization": f"Token {DEEPGRAM_API_KEY}",
                    "Content-Type": content_type,
                },
                content=buffer_data,
            )
        
        if response.status_code != 200:
            raise Exception(f"Deepgram API error: {response.status_code} - {response.text}")
        
        result = response.json()
        duration = result.get("metadata", {}).get("duration", 0)
        
        # Extract raw transcript
        results = result.get("results", {})
        channels = results.get("channels", [])
        
        if not channels:
            raise Exception("No channels in Deepgram response")
        
        alternatives = channels[0].get("alternatives", [])
        if not alternatives:
            raise Exception("No alternatives in Deepgram response")
        
        alt = alternatives[0]
        paragraphs_data = alt.get("paragraphs", {})
        paragraphs = paragraphs_data.get("paragraphs", [])
        
        # Build raw transcript with speaker labels
        transcript_lines = []
        unique_speakers = set()
        
        if paragraphs:
            for para in paragraphs:
                speaker = para.get("speaker", 0)
                unique_speakers.add(speaker)
                sentences = para.get("sentences", [])
                for sentence in sentences:
                    text = sentence.get("text", "")
                    if text:
                        transcript_lines.append(f"Speaker {speaker + 1}: {text}")
        else:
            transcript_text = alt.get("transcript", "")
            if transcript_text:
                transcript_lines.append(transcript_text)
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
        
        # ========== STEP 2: INITIAL AI CLEANUP (GPT-4o) ==========
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"status": "processing", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        logger.info(f"[{project_id}] Step 2: Initial cleanup with GPT-4o")
        
        initial_system = """Ты - эксперт по обработке транскриптов встреч.
Твоя задача - первичная очистка транскрипта:
1. Исправь очевидные ошибки распознавания речи
2. Расставь знаки препинания правильно
3. Сохрани разметку спикеров (Speaker 1:, Speaker 2: и т.д.)
4. НЕ меняй смысл текста
5. НЕ выделяй спорные места - это будет сделано на следующем этапе

Верни очищенный транскрипт."""

        cleaned_transcript = await call_gpt4o(
            system_message=initial_system,
            user_message=f"Очисти этот транскрипт:\n\n{raw_transcript}"
        )
        
        logger.info(f"[{project_id}] Initial cleanup done, {len(cleaned_transcript)} chars")
        
        # ========== STEP 3: MASTER PROMPT PROCESSING (GPT-5.2) ==========
        logger.info(f"[{project_id}] Step 3: Processing with user's Master Prompt via GPT-5.2")
        
        # Get user's master prompt from database - ONLY user's prompt, no modifications
        user_master_prompt = await db.prompts.find_one(
            {"prompt_type": "master"}, 
            {"_id": 0}
        )
        
        if not user_master_prompt:
            logger.error(f"[{project_id}] No master prompt found in database!")
            raise Exception("Master prompt not configured. Please create a master prompt in Prompts settings.")
        
        master_prompt_content = user_master_prompt["content"]
        logger.info(f"[{project_id}] Using master prompt: '{user_master_prompt.get('name', 'Unknown')}' (length: {len(master_prompt_content)} chars)")
        
        # Call GPT-5.2 with EXACTLY user's master prompt - NO modifications
        processed_transcript = await call_gpt52(
            system_message=master_prompt_content,
            user_message=cleaned_transcript,
            reasoning_effort=reasoning_effort
        )
        
        logger.info(f"[{project_id}] GPT-5.2 processing complete, result length: {len(processed_transcript)} chars")
        
        # ========== STEP 3.5: PARSE AND SEPARATE UNCERTAIN SECTION ==========
        # Look for section with uncertain words at the end
        main_text = processed_transcript
        uncertain_section = ""
        
        # Common patterns for the uncertain section header
        uncertain_headers = [
            r'Сомнительные места[^:]*:',
            r'Сомнительные[^:]*:',
            r'Возможные ошибки[^:]*:',
            r'Список сомнительных[^:]*:',
            r'Сомнения[^:]*:',
            r'Уточнить[^:]*:',
            r'Ошибки распознавания[^:]*:',
        ]
        
        for header_pattern in uncertain_headers:
            match = re.search(header_pattern, processed_transcript, re.IGNORECASE)
            if match:
                split_pos = match.start()
                main_text = processed_transcript[:split_pos].strip()
                uncertain_section = processed_transcript[split_pos:].strip()
                logger.info(f"[{project_id}] Found uncertain section at position {split_pos}")
                break
        
        # Save processed transcript (main text only, without uncertain section)
        await db.transcripts.insert_one({
            "id": str(uuid.uuid4()),
            "project_id": project_id,
            "version_type": "processed",
            "content": main_text,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"[{project_id}] Processed transcript saved, {len(main_text)} chars")
        
        # ========== STEP 4: EXTRACT UNCERTAIN FRAGMENTS ==========
        uncertain_items = []
        
        # Method 1: Parse [word?] patterns in the main text
        bracket_pattern = re.compile(r'\[+([^\[\]]+?)\?+\]+')
        for match in bracket_pattern.finditer(main_text):
            word = match.group(1).strip()
            position = match.start()
            
            # Get extended context (100 chars before and after)
            context_start = max(0, position - 100)
            context_end = min(len(main_text), match.end() + 100)
            context = main_text[context_start:context_end]
            
            # Clean up context - make it a full sentence if possible
            # Find sentence boundaries
            if context_start > 0:
                # Try to start from beginning of sentence
                sentence_start = context.rfind('. ', 0, 50)
                if sentence_start != -1:
                    context = context[sentence_start + 2:]
            
            uncertain_items.append({
                "word": word,
                "context": context.strip(),
                "position": position,
                "source": "inline"
            })
        
        # Method 2: Parse numbered list from uncertain section
        if uncertain_section:
            # Pattern for numbered items: "1. слово" or "1) слово" or "- слово"
            list_pattern = re.compile(r'(?:^\d+[\.\)]\s*|\n\d+[\.\)]\s*|\n[-•]\s*)([^\n]+)', re.MULTILINE)
            for match in list_pattern.finditer(uncertain_section):
                item_text = match.group(1).strip()
                
                # Try to extract the word in quotes or brackets
                word_match = re.search(r'[«"\'"\[]([^»"\'"\]]+)[»"\'"\]]', item_text)
                if word_match:
                    word = word_match.group(1).strip()
                else:
                    # Just take first word or phrase
                    word = item_text.split(' - ')[0].split(':')[0].strip()
                    word = re.sub(r'^[\[\(«"\']+|[\]\)»"\']+$', '', word)
                
                if word and len(word) > 1:
                    # Try to find this word in main text for context
                    word_in_text = re.search(
                        rf'.{{0,100}}{re.escape(word)}.{{0,100}}',
                        main_text,
                        re.IGNORECASE
                    )
                    context = word_in_text.group(0) if word_in_text else item_text
                    
                    uncertain_items.append({
                        "word": word,
                        "context": context.strip(),
                        "position": -1,
                        "source": "list",
                        "original_line": item_text
                    })
        
        # Deduplicate and save uncertain fragments
        seen_words = set()
        fragments_saved = 0
        
        for item in uncertain_items:
            word = item["word"]
            # Normalize for dedup
            word_lower = word.lower().strip()
            
            if word_lower and word_lower not in seen_words and len(word_lower) > 1:
                seen_words.add(word_lower)
                
                await db.uncertain_fragments.insert_one({
                    "id": str(uuid.uuid4()),
                    "project_id": project_id,
                    "original_text": word,
                    "corrected_text": None,
                    "context": item["context"],
                    "start_time": None,
                    "end_time": None,
                    "suggestions": [word],
                    "status": "pending",
                    "source": item.get("source", "inline"),
                    "original_line": item.get("original_line", ""),
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                fragments_saved += 1
        
        logger.info(f"[{project_id}] Saved {fragments_saved} uncertain fragments")
        
        # ========== STEP 4: CREATE SPEAKER MAP ==========
        if not unique_speakers:
            unique_speakers = {0}
        
        for speaker_num in sorted(unique_speakers):
            await db.speaker_maps.insert_one({
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "speaker_label": f"Speaker {speaker_num + 1}",
                "speaker_name": f"Speaker {speaker_num + 1}"
            })
        
        # ========== STEP 5: UPDATE PROJECT STATUS ==========
        new_status = "needs_review" if seen_words else "ready"
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {
                "status": new_status,
                "recording_duration": duration,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"[{project_id}] Transcription pipeline completed, status: {new_status}, duration: {duration}s")
        
    except Exception as e:
        logger.error(f"[{project_id}] Transcription error: {e}")
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {
                "status": "error",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )

# ==================== TRANSCRIPT ROUTES ====================

@api_router.get("/projects/{project_id}/transcripts", response_model=List[TranscriptVersionResponse])
async def get_transcripts(project_id: str, user = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    transcripts = await db.transcripts.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    return [TranscriptVersionResponse(**t) for t in transcripts]

@api_router.post("/projects/{project_id}/transcripts/confirm")
async def confirm_transcript(project_id: str, user = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get processed transcript
    processed = await db.transcripts.find_one(
        {"project_id": project_id, "version_type": "processed"},
        {"_id": 0}
    )
    if not processed:
        raise HTTPException(status_code=400, detail="No processed transcript found")
    
    # Get speaker map
    speaker_maps = await db.speaker_maps.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    
    # Get confirmed fragments
    fragments = await db.uncertain_fragments.find(
        {"project_id": project_id, "status": "confirmed"},
        {"_id": 0}
    ).to_list(100)
    
    # Apply corrections
    confirmed_content = processed["content"]
    
    # Replace uncertain markers with corrections
    for fragment in fragments:
        if fragment.get("corrected_text"):
            marker = f"[{fragment['original_text']}?]"
            confirmed_content = confirmed_content.replace(marker, fragment["corrected_text"])
    
    # Apply speaker names
    for sm in speaker_maps:
        if sm["speaker_name"] != sm["speaker_label"]:
            confirmed_content = confirmed_content.replace(
                f"{sm['speaker_label']}:",
                f"{sm['speaker_name']}:"
            )
    
    # Remove remaining uncertain markers
    import re
    confirmed_content = re.sub(r'\[([^\]]+)\?\]', r'\1', confirmed_content)
    
    # Save confirmed transcript
    now = datetime.now(timezone.utc).isoformat()
    confirmed_id = str(uuid.uuid4())
    
    # Remove existing confirmed version
    await db.transcripts.delete_many({"project_id": project_id, "version_type": "confirmed"})
    
    await db.transcripts.insert_one({
        "id": confirmed_id,
        "project_id": project_id,
        "version_type": "confirmed",
        "content": confirmed_content,
        "created_at": now
    })
    
    # Update project status
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"status": "ready", "updated_at": now}}
    )
    
    return {"message": "Transcript confirmed", "id": confirmed_id}

# ==================== UNCERTAIN FRAGMENTS ====================

@api_router.get("/projects/{project_id}/fragments", response_model=List[UncertainFragmentResponse])
async def get_fragments(project_id: str, user = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    fragments = await db.uncertain_fragments.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    return [UncertainFragmentResponse(**f) for f in fragments]

@api_router.put("/projects/{project_id}/fragments/{fragment_id}", response_model=UncertainFragmentResponse)
async def update_fragment(
    project_id: str,
    fragment_id: str,
    data: UncertainFragmentUpdate,
    user = Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    fragment = await db.uncertain_fragments.find_one({"id": fragment_id, "project_id": project_id})
    if not fragment:
        raise HTTPException(status_code=404, detail="Fragment not found")
    
    await db.uncertain_fragments.update_one(
        {"id": fragment_id},
        {"$set": {
            "corrected_text": data.corrected_text,
            "status": data.status
        }}
    )
    
    updated = await db.uncertain_fragments.find_one({"id": fragment_id}, {"_id": 0})
    return UncertainFragmentResponse(**updated)

# ==================== SPEAKER MAP ====================

@api_router.get("/projects/{project_id}/speakers", response_model=List[SpeakerMapResponse])
async def get_speakers(project_id: str, user = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    speakers = await db.speaker_maps.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    return [SpeakerMapResponse(**s) for s in speakers]

@api_router.put("/projects/{project_id}/speakers/{speaker_id}", response_model=SpeakerMapResponse)
async def update_speaker(
    project_id: str,
    speaker_id: str,
    data: SpeakerMapCreate,
    user = Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.speaker_maps.update_one(
        {"id": speaker_id, "project_id": project_id},
        {"$set": {"speaker_name": data.speaker_name}}
    )
    
    updated = await db.speaker_maps.find_one({"id": speaker_id}, {"_id": 0})
    return SpeakerMapResponse(**updated)

# ==================== PROMPTS ====================

@api_router.post("/prompts", response_model=PromptResponse)
async def create_prompt(data: PromptCreate, user = Depends(get_current_user)):
    prompt_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    prompt_doc = {
        "id": prompt_id,
        "name": data.name,
        "content": data.content,
        "prompt_type": data.prompt_type,
        "user_id": user["id"] if data.prompt_type in ["personal", "project"] else None,
        "project_id": data.project_id,
        "is_public": data.is_public or data.prompt_type in ["master", "thematic"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.prompts.insert_one(prompt_doc)
    return PromptResponse(**prompt_doc)

@api_router.get("/prompts", response_model=List[PromptResponse])
async def list_prompts(
    prompt_type: Optional[str] = None,
    project_id: Optional[str] = None,
    user = Depends(get_current_user)
):
    query = {
        "$or": [
            {"is_public": True},
            {"user_id": user["id"]}
        ]
    }
    
    if prompt_type:
        query["prompt_type"] = prompt_type
    if project_id:
        query["$or"].append({"project_id": project_id})
    
    prompts = await db.prompts.find(query, {"_id": 0}).to_list(1000)
    return [PromptResponse(**p) for p in prompts]

@api_router.get("/prompts/{prompt_id}", response_model=PromptResponse)
async def get_prompt(prompt_id: str, user = Depends(get_current_user)):
    prompt = await db.prompts.find_one({"id": prompt_id}, {"_id": 0})
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    if not prompt.get("is_public") and prompt.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return PromptResponse(**prompt)

@api_router.put("/prompts/{prompt_id}", response_model=PromptResponse)
async def update_prompt(prompt_id: str, data: PromptUpdate, user = Depends(get_current_user)):
    prompt = await db.prompts.find_one({"id": prompt_id})
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    # Only owner or admin can edit
    if prompt.get("user_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.prompts.update_one({"id": prompt_id}, {"$set": update_data})
    
    updated = await db.prompts.find_one({"id": prompt_id}, {"_id": 0})
    return PromptResponse(**updated)

@api_router.delete("/prompts/{prompt_id}")
async def delete_prompt(prompt_id: str, user = Depends(get_current_user)):
    prompt = await db.prompts.find_one({"id": prompt_id})
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    if prompt.get("user_id") != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.prompts.delete_one({"id": prompt_id})
    return {"message": "Prompt deleted"}

# ==================== CHAT / ANALYSIS ====================

@api_router.post("/projects/{project_id}/analyze", response_model=ChatRequestResponse)
async def analyze_transcript(
    project_id: str,
    data: ChatRequestCreate,
    user = Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get the best available transcript
    transcript = await db.transcripts.find_one(
        {"project_id": project_id, "version_type": "confirmed"},
        {"_id": 0}
    )
    if not transcript:
        transcript = await db.transcripts.find_one(
            {"project_id": project_id, "version_type": "processed"},
            {"_id": 0}
        )
    if not transcript:
        raise HTTPException(status_code=400, detail="No transcript available")
    
    # Get prompt
    prompt = await db.prompts.find_one({"id": data.prompt_id}, {"_id": 0})
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    # Call GPT-4o for analysis using user's OpenAI API
    try:
        from openai import AsyncOpenAI
        
        client = AsyncOpenAI(api_key=OPENAI_API_KEY)
        
        system_message = f"""Ты - эксперт по анализу рабочих встреч. 
Анализируй транскрипт встречи согласно инструкциям пользователя.
Отвечай на русском языке, структурированно и по существу.

Инструкция для анализа:
{prompt['content']}
"""
        
        user_text = f"Транскрипт встречи:\n\n{transcript['content']}"
        if data.additional_text:
            user_text += f"\n\nДополнительные указания:\n{data.additional_text}"
        
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": user_text}
            ],
            temperature=0.3,
        )
        
        response_text = response.choices[0].message.content
        
    except Exception as e:
        logger.error(f"GPT analysis error: {e}")
        response_text = f"Ошибка при анализе: {str(e)}"
    
    # Save chat request
    chat_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    chat_doc = {
        "id": chat_id,
        "project_id": project_id,
        "prompt_id": data.prompt_id,
        "prompt_content": prompt["content"],
        "additional_text": data.additional_text or "",
        "response_text": response_text,
        "created_at": now
    }
    
    await db.chat_requests.insert_one(chat_doc)
    return ChatRequestResponse(**chat_doc)

@api_router.get("/projects/{project_id}/chat-history", response_model=List[ChatRequestResponse])
async def get_chat_history(project_id: str, user = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "user_id": user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    history = await db.chat_requests.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [ChatRequestResponse(**h) for h in history]

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/users", response_model=List[UserResponse])
async def admin_list_users(user = Depends(get_admin_user)):
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.put("/admin/users/{user_id}/role")
async def admin_update_role(user_id: str, role: str, admin = Depends(get_admin_user)):
    if role not in ["user", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Role updated"}

@api_router.get("/admin/prompts", response_model=List[PromptResponse])
async def admin_list_all_prompts(admin = Depends(get_admin_user)):
    prompts = await db.prompts.find({}, {"_id": 0}).to_list(1000)
    return [PromptResponse(**p) for p in prompts]

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Seed initial prompts"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check if master prompt exists
    existing = await db.prompts.find_one({"prompt_type": "master"})
    if existing:
        return {"message": "Data already seeded"}
    
    prompts = [
        {
            "id": str(uuid.uuid4()),
            "name": "Мастер промпт",
            "content": """Обработай транскрипт встречи:
1. Исправь очевидные ошибки распознавания
2. Расставь знаки препинания
3. Выдели фрагменты с низкой уверенностью в формате [слово?]
4. Сохрани разметку спикеров""",
            "prompt_type": "master",
            "user_id": None,
            "project_id": None,
            "is_public": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Резюме встречи",
            "content": "Составь краткое резюме встречи в 3-5 пунктах. Выдели главные темы и решения.",
            "prompt_type": "thematic",
            "user_id": None,
            "project_id": None,
            "is_public": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Список задач",
            "content": "Извлеки все задачи и action items из встречи. Укажи ответственного если он упомянут.",
            "prompt_type": "thematic",
            "user_id": None,
            "project_id": None,
            "is_public": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Риски и проблемы",
            "content": "Выдели все упомянутые риски, проблемы и блокеры. Оцени их критичность.",
            "prompt_type": "thematic",
            "user_id": None,
            "project_id": None,
            "is_public": True,
            "created_at": now,
            "updated_at": now
        },
        {
            "id": str(uuid.uuid4()),
            "name": "Ключевые решения",
            "content": "Найди и структурируй все принятые решения на встрече.",
            "prompt_type": "thematic",
            "user_id": None,
            "project_id": None,
            "is_public": True,
            "created_at": now,
            "updated_at": now
        }
    ]
    
    for prompt in prompts:
        await db.prompts.insert_one(prompt)
    
    # Create admin user
    admin_id = str(uuid.uuid4())
    admin_doc = {
        "id": admin_id,
        "email": "admin@voiceworkspace.com",
        "password": hash_password("admin123"),
        "name": "Administrator",
        "role": "admin",
        "created_at": now
    }
    
    existing_admin = await db.users.find_one({"email": admin_doc["email"]})
    if not existing_admin:
        await db.users.insert_one(admin_doc)
    
    return {"message": "Data seeded successfully"}

# ==================== SETUP ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
