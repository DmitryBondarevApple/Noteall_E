# Voice Workspace MVP — PRD

## Problem Statement
Platform for transcribing and analyzing work meetings. Users upload audio/video, Deepgram transcribes it, GPT processes the transcript with a master prompt, then users can run thematic analysis prompts.

## Tech Stack
- **Backend:** FastAPI, PyMongo (async), python-jose (JWT)
- **Frontend:** React, Tailwind CSS, Shadcn UI, Axios
- **Database:** MongoDB
- **Integrations:** Deepgram (Nova-3), OpenAI GPT-4o/5.2 (user's API key)

## Core Workflow
1. User uploads audio/video file
2. Deepgram transcribes -> raw transcript saved
3. User clicks "Обработать" -> GPT-5.2 processes with master prompt -> processed text saved
4. User reviews uncertain words, maps speaker names
5. User runs thematic analysis prompts on the transcript

## Architecture
```
/app
├── backend/server.py           # Monolithic FastAPI (all routes, models, logic)
├── frontend/src/
│   ├── App.js                  # Router
│   ├── lib/api.js              # Axios API client
│   ├── pages/ProjectPage.js    # Main project UI (refactored, ~220 lines)
│   ├── components/project/     # Modular project components
│   │   ├── index.js            # Exports all components
│   │   ├── utils.js            # Shared utilities and constants
│   │   ├── UploadSection.jsx   # File upload dropzone
│   │   ├── TranscriptTab.jsx   # Raw transcript display
│   │   ├── ProcessedTab.jsx    # Processed text with editing + autosave
│   │   ├── ReviewTab.jsx       # Fragment review UI with revert
│   │   ├── SpeakersTab.jsx     # Speaker name mapping
│   │   ├── AnalysisTab.jsx     # AI analysis with history + autosave
│   │   └── FragmentCard.jsx    # Single review fragment card
│   └── contexts/AuthContext.js
```

## DB Schema
- **users:** {id, email, hashed_password, name, role, created_at}
- **projects:** {id, name, description, user_id, status, language, reasoning_effort, recording_filename, recording_duration}
- **transcripts:** {id, project_id, version_type (raw|processed|confirmed), content}
- **uncertain_fragments:** {id, project_id, original_text, corrected_text, context, status, source}
- **speaker_maps:** {id, project_id, speaker_label, speaker_name}
- **prompts:** {id, name, content, prompt_type, user_id, project_id, is_public}
- **chat_requests:** {id, project_id, prompt_id, prompt_content, additional_text, reasoning_effort, response_text}

## What's Implemented
- JWT auth (register/login)
- Project CRUD
- File upload with Deepgram transcription
- Manual GPT-5.2 processing with master prompt
- Speaker diarization and name mapping
- Uncertain word review UI
- Thematic analysis with selectable prompts
- Reasoning effort selector in sticky tab bar
- Admin panel (users, prompts)
- Seed data endpoint

## Completed Features (Feb 2026)

### Parser Stability
- [x] Enhanced master prompt to always output "Сомнительные места" section
- [x] Explicit fallback: "Нет сомнительных мест" when no uncertainties found
- [x] Added `/api/update-master-prompt` endpoint

### Frontend Refactoring
- [x] Decomposed ProjectPage.js (1280 → 220 lines) into modular components
- [x] Created reusable components: UploadSection, TranscriptTab, ProcessedTab, ReviewTab, SpeakersTab, AnalysisTab, FragmentCard

### Autosave Drafts
- [x] ProcessedTab: auto-saves edits to localStorage every 2 seconds
- [x] Shows "Есть черновик" badge when unsaved draft exists
- [x] "Восстановить" / "Удалить" buttons for draft management
- [x] Visual indicator "Черновик сохранён" during editing
- [x] Draft cleared on successful save
- [x] AnalysisTab: same autosave functionality for chat response editing

### Fragment Review Revert
- [x] Added "Отменить" button for confirmed fragments
- [x] `POST /api/projects/{id}/fragments/{id}/revert` endpoint
- [x] Restores [word?] marker in transcript when reverting
- [x] Returns fragment to appropriate status (pending or auto_corrected)

## Key API Endpoints
- `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- `/api/projects` (CRUD)
- `/api/projects/{id}/upload` - file upload + Deepgram transcription
- `/api/projects/{id}/process` - manual GPT processing with master prompt
- `/api/projects/{id}/analyze` - multi-turn analysis
- `/api/projects/{id}/transcripts` (GET, PUT by version_type)
- `/api/projects/{id}/fragments` (GET, PUT)
- `/api/projects/{id}/fragments/{id}/revert` - **NEW** revert confirmed fragment
- `/api/projects/{id}/chat-history` (GET sorted ASC, PUT to update response)
- `/api/prompts` (CRUD)
- `/api/update-master-prompt` - update master prompt to improved version
- `/api/seed` - seed initial data

## Known Issues
- Automated transcript pipeline disabled (manual "Обработать" button is workaround)
- server.py is still monolithic (~1400 lines) — consider splitting into modules

## Future/Backlog (P2-P3)
- Collaborative project access
- Team workspaces
- Global full-text search
- Mobile applications
- Refactor server.py into modules (routes/, models/, services/)
- Add tests for new components
- Batch processing for multiple files
- Export transcripts to various formats (docx, txt, pdf)
- Keyboard shortcuts for common actions
- Undo/redo stack for text editing

## Credentials
- Admin: admin@voiceworkspace.com / admin123
- API keys: Deepgram + OpenAI in /app/backend/.env
