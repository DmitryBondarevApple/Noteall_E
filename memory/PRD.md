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
4. User reviews uncertain words, maps speaker names (from directory)
5. User runs thematic analysis prompts on the transcript

## Architecture
```
/app
├── backend/server.py           # Monolithic FastAPI (all routes, models, logic)
├── frontend/src/
│   ├── App.js                  # Router
│   ├── lib/api.js              # Axios API client
│   ├── pages/
│   │   ├── ProjectPage.js      # Main project UI
│   │   ├── DashboardPage.js    # Projects list
│   │   ├── SpeakerDirectoryPage.js  # Speaker directory management
│   │   └── ...
│   ├── components/project/
│   │   ├── SpeakersTab.jsx     # Speaker name mapping with combobox
│   │   ├── SpeakerCombobox.jsx # Autocomplete from directory
│   │   └── ...
│   └── contexts/AuthContext.js
```

## DB Schema
- **users:** {id, email, hashed_password, name, role, created_at}
- **projects:** {id, name, description, user_id, status, language, reasoning_effort}
- **transcripts:** {id, project_id, version_type, content}
- **uncertain_fragments:** {id, project_id, original_text, corrected_text, context, status}
- **speaker_maps:** {id, project_id, speaker_label, speaker_name}
- **speaker_directory:** {id, user_id, name, email, company, role, created_at, updated_at} ← NEW
- **prompts:** {id, name, content, prompt_type, user_id, project_id, is_public}
- **chat_requests:** {id, project_id, prompt_id, response_text, ...}

## What's Implemented

### Core Features
- JWT auth (register/login)
- Project CRUD with file upload
- Deepgram transcription
- GPT-5.2 processing with master prompt
- Speaker diarization and name mapping
- Uncertain word review UI with revert capability
- Thematic analysis with context-aware prompts
- Autosave drafts (localStorage)
- Admin panel

### Speaker Directory (NEW - Feb 2026)
- Global contacts list per user (`/speakers` page)
- Add/Edit/Delete speakers with name, company, role, email
- Search by name with autocomplete
- Combobox in project speakers tab for quick selection
- "Add to directory" button when typing new name
- Navigation from Dashboard and Project page

## Key API Endpoints

### Speaker Directory (NEW)
- `GET /api/speaker-directory` - List all speakers (optional ?q=search)
- `POST /api/speaker-directory` - Add speaker to directory
- `PUT /api/speaker-directory/{id}` - Update speaker
- `DELETE /api/speaker-directory/{id}` - Delete speaker

### Existing
- `/api/auth/*` - Authentication
- `/api/projects/*` - Project CRUD
- `/api/projects/{id}/upload` - File upload
- `/api/projects/{id}/process` - GPT processing
- `/api/projects/{id}/analyze` - Analysis
- `/api/projects/{id}/speakers` - Project-specific speaker mapping
- `/api/projects/{id}/fragments` - Uncertain fragments
- `/api/projects/{id}/fragments/{id}/revert` - Revert confirmation
- `/api/prompts` - Prompt management
- `/api/update-master-prompt` - Update master prompt

## Master Prompt Features
- Исправление ошибок распознавания по контексту
- Объединение реплик спикеров (перенос фраз с маленькой буквы)
- Замена Speaker N на имена
- Форматирование: болд для имён, пробелы между репликами
- Обязательная секция "Сомнительные места" с форматом «исходное» → «исправленное»

## Known Issues
- server.py is monolithic (~1500 lines) — consider splitting

## Future/Backlog (P2-P3)
- Refactor server.py into modules
- Collaborative project access
- Team workspaces
- Global full-text search
- Export transcripts (docx, pdf)
- Keyboard shortcuts
- Mobile applications

## Credentials
- Admin: admin@voiceworkspace.com / admin123
