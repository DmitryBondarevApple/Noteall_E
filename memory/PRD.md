# Voice Workspace + Document Agent — PRD

## Architecture
- **Backend**: FastAPI + MongoDB (motor async)
- **Frontend**: React + Tailwind CSS + shadcn/ui + React Flow
- **AI**: OpenAI GPT (dynamic model from settings, default gpt-5.2)
- **Auth**: JWT-based
- **Storage**: Timeweb S3
- **Deploy**: VPS 185.246.220.121, Docker Compose, MongoDB 8.0.19, HTTPS
- **Domain**: https://noteall.ru
- **CI/CD**: GitHub Actions auto-deploy on push to main

## Implemented Features

### AI Chat Assistant (Feb 2026)
- Persistent chat interface replacing modal-based AI assistant
- Multi-turn conversations with full context persistence
- Image upload support (screenshots) for debugging via S3
- AI parses pipeline JSON from responses, shows as interactive cards
- "Apply scenario" button to update canvas from chat
- Session management: create, list, delete sessions
- Works on both PipelinesPage (create new) and PipelineEditorPage (edit existing)
- Chat history saved to MongoDB `ai_chat_sessions` collection
- **Pipeline context injection**: current scenario (nodes, edges, prompts) is automatically attached to AI context in editor, enabling precise edits to specific nodes

### Model Management (Feb 2026)
- Dynamic model selection from Admin panel (Модели tab)
- Check OpenAI for new models via API
- One-click switch to newer model
- Model name auto-updates across all AI functions
- Public /api/model-info endpoint for frontend display

### PDF Parsing (Feb 2026)
- PyMuPDF + Tesseract OCR fallback

### Pipeline Export/Import (Feb 2026)
- JSON export/import with UI

### S3 Storage (Feb 2026)
- All uploads to Timeweb S3

### Core Features
- Meeting transcription, speaker identification, AI analysis
- Document Agent with automated pipeline runner
- Constructor: visual pipeline editor + prompts
- Folder structures, branding (Noteall)

## Key API Endpoints
- POST /api/ai-chat/sessions — Create chat session
- GET /api/ai-chat/sessions — List sessions (optionally by pipeline_id)
- GET /api/ai-chat/sessions/{id} — Get session with messages
- POST /api/ai-chat/sessions/{id}/message — Send message (multipart, supports image)
- DELETE /api/ai-chat/sessions/{id} — Delete session
- POST /api/pipelines/generate — Generate pipeline from prompt
- GET /api/pipelines/{id}/export — Export pipeline as JSON
- POST /api/pipelines/import/json — Import pipeline from JSON

## DB Schema
- `users`: {email, password, role, name}
- `projects`: {name, user_id, documents, attachments}
- `pipelines`: {name, user_id, nodes, edges, generation_prompt}
- `ai_chat_sessions`: {id, user_id, pipeline_id, messages: [{role, content, image_url, image_s3_key, timestamp}], created_at, updated_at}
- `settings`: {key: "active_model", value: "gpt-5.2"}

## Backlog
- **P1**: "Go Back" from execution to scenario selection page
- **P2**: Auto-check for new AI models and admin notification
- **P2**: Export results to Word/PDF
- **P2**: Real-time pipeline execution progress
