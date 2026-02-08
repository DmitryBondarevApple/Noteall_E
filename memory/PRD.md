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
├── backend/server.py       # Monolithic FastAPI (all routes, models, logic)
├── frontend/src/
│   ├── App.js              # Router
│   ├── lib/api.js          # Axios API client
│   ├── pages/ProjectPage.js # Main project UI (all tabs)
│   └── contexts/AuthContext.js
```

## DB Schema
- **users:** {id, email, hashed_password, name, role, created_at}
- **projects:** {id, name, description, user_id, status, language, reasoning_effort, recording_filename, recording_duration}
- **transcripts:** {id, project_id, version_type (raw|processed|confirmed), content}
- **uncertain_fragments:** {id, project_id, original_text, corrected_text, context, status}
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

## Completed Bug Fixes (Dec 2025)
- [x] Speaker names now update in transcript display (applySpeakerNames)
- [x] Reasoning depth applied during analysis (uses call_gpt52 with reasoning_effort)
- [x] Reasoning depth selector moved to sticky tab bar
- [x] Markdown rendering enabled for "Обработанный текст" and "Анализ" tabs
- [x] Fragment corrections from Review tab now update Processed text (replace [word?] markers, persist to backend)
- [x] Review tab shows full sentences instead of truncated 80-char context
- [x] Processed text tab has edit mode (Редактировать/Сохранить/Отмена)
- [x] Markdown escaping: [word?] markers rendered as inline code, not eaten as link syntax
- [x] Scroll position preserved when toggling edit mode on Processed text tab
- [x] Analysis tab: edit mode added (pencil icon per result, textarea + save/cancel)
- [x] Analysis results in chronological order (oldest first, newest at bottom)
- [x] Parser: header matching without colon, «word» — description format support
- [x] Scroll position in Processed tab preserved via ScrollArea ref (inner viewport)

## Known Issues
- Automated transcript pipeline disabled (manual "Обработать" button is workaround)
- server.py and ProjectPage.js are monolithic (800+ lines each)

## Key API Endpoints
- `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- `/api/projects` (CRUD)
- `/api/projects/{id}/upload` - file upload + Deepgram transcription
- `/api/projects/{id}/process` - manual GPT processing with master prompt
- `/api/projects/{id}/analyze` - multi-turn analysis (transcript + all previous analyses as context)
- `/api/projects/{id}/transcripts` (GET, PUT by version_type)
- `/api/projects/{id}/chat-history` (GET sorted ASC, PUT to update response)
- `/api/prompts` (CRUD)

## Future/Backlog (P2-P3)
- Collaborative project access
- Team workspaces
- Global full-text search
- Mobile applications
- Refactor server.py into modules
- Decompose ProjectPage.js into smaller components

## Credentials
- Admin: admin@voiceworkspace.com / admin123
- API keys: Deepgram + OpenAI in /app/backend/.env
