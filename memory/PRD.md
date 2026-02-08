# Voice Workspace MVP — PRD

## Problem Statement
Platform for transcribing and analyzing work meetings. Users upload audio/video, Deepgram transcribes it, GPT processes the transcript with a master prompt, then users can run thematic analysis prompts.

## Tech Stack
- **Backend:** FastAPI, PyMongo (async), python-jose (JWT)
- **Frontend:** React, Tailwind CSS, Shadcn UI, Axios
- **Database:** MongoDB
- **Integrations:** Deepgram (Nova-3), OpenAI GPT-4o/5.2

## Core Workflow
1. User uploads audio/video file
2. Deepgram transcribes -> raw transcript saved
3. User clicks "Обработать" -> GPT-5.2 processes with master prompt
4. User reviews uncertain words, maps speaker names (from directory)
5. User runs thematic analysis prompts

## Architecture (Refactored Feb 2026)
```
/app/backend/
├── server.py                    # Entry point (imports from app/)
├── app/
│   ├── main.py                  # FastAPI app, routers, middleware
│   ├── core/
│   │   ├── config.py            # Environment variables
│   │   ├── database.py          # MongoDB connection
│   │   └── security.py          # JWT, password hashing, auth deps
│   ├── models/
│   │   ├── user.py              # User schemas
│   │   ├── project.py           # Project schemas
│   │   ├── transcript.py        # Transcript schemas
│   │   ├── fragment.py          # Uncertain fragment schemas
│   │   ├── speaker.py           # Speaker map + directory schemas
│   │   ├── prompt.py            # Prompt schemas
│   │   └── chat.py              # Chat/analysis schemas
│   ├── routes/
│   │   ├── auth.py              # /auth/* endpoints
│   │   ├── projects.py          # /projects/* + upload, process
│   │   ├── transcripts.py       # /projects/{id}/transcripts/*
│   │   ├── fragments.py         # /projects/{id}/fragments/*
│   │   ├── speakers.py          # Project speakers + directory
│   │   ├── prompts.py           # /prompts/*
│   │   ├── chat.py              # /projects/{id}/analyze, chat-history
│   │   ├── admin.py             # /admin/*
│   │   └── seed.py              # /seed, /update-master-prompt
│   └── services/
│       ├── gpt.py               # GPT-4o, GPT-5.2 calls
│       └── text_parser.py       # Parse uncertain fragments
/app/frontend/src/
├── pages/
│   ├── ProjectPage.js           # Main project UI
│   ├── SpeakerDirectoryPage.js  # Speaker directory with grouping
│   └── ...
├── components/project/
│   ├── UploadSection.jsx
│   ├── TranscriptTab.jsx
│   ├── ProcessedTab.jsx         # With autosave drafts
│   ├── ReviewTab.jsx            # With revert capability
│   ├── SpeakersTab.jsx          # With combobox search
│   ├── AnalysisTab.jsx          # With autosave drafts
│   ├── SpeakerCombobox.jsx      # Autocomplete from directory
│   └── utils.js
```

## DB Collections
- **users:** {id, email, password, name, role, created_at}
- **projects:** {id, name, description, user_id, status, language, reasoning_effort, ...}
- **transcripts:** {id, project_id, version_type, content, created_at}
- **uncertain_fragments:** {id, project_id, original_text, corrected_text, context, status, source}
- **speaker_maps:** {id, project_id, speaker_label, speaker_name}
- **speaker_directory:** {id, user_id, name, email, company, role, phone, telegram, whatsapp, photo_url, comment}
- **prompts:** {id, name, content, prompt_type, user_id, project_id, is_public}
- **chat_requests:** {id, project_id, prompt_id, prompt_content, additional_text, reasoning_effort, response_text}

## Features Implemented
- JWT authentication
- Project CRUD with file upload
- Deepgram transcription (Nova-3)
- Manual GPT-5.2 processing with master prompt
- Speaker diarization and name mapping
- Speaker directory with search, grouping by company
- Uncertain word review with auto-corrected detection
- Revert confirmed fragments
- Autosave drafts (localStorage)
- Context-aware multi-turn analysis
- Admin panel
- **Full Analysis Wizard ("Мастер")** - multi-step automated meeting analysis:
  - Step 1: Enter meeting subject, extract topics from transcript
  - Step 2: Review/edit topics list, configure batch size (default: 3)
  - Step 3: Batch analysis with progress bar
  - Step 4: Final document with summary + detailed analysis (copy/download/save)

## Key API Endpoints
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/{id}`
- `POST /api/projects/{id}/upload`, `POST /api/projects/{id}/process`
- `GET/PUT /api/projects/{id}/transcripts/{version_type}`
- `GET/PUT /api/projects/{id}/fragments/{id}`, `POST .../revert`
- `GET/PUT /api/projects/{id}/speakers/{id}`
- `GET/POST/PUT/DELETE /api/speaker-directory`, `POST .../photo`
- `GET/POST/PUT/DELETE /api/prompts`
- `POST /api/projects/{id}/analyze`, `GET/PUT /api/projects/{id}/chat-history`
- `GET/POST/DELETE /api/admin/users`
- `POST /api/seed`, `POST /api/update-master-prompt`

## Credentials
- Admin: admin@voiceworkspace.com / admin123
