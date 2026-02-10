# Voice Workspace + Document Agent — PRD

## Architecture
- **Backend**: FastAPI + MongoDB (motor async)
- **Frontend**: React + Tailwind CSS + shadcn/ui + React Flow
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Auth**: JWT-based
- **Storage**: Timeweb S3 (s3.twcstorage.ru, bucket 63dffe5a-920b-4901-a340-056793b978fa, region ru-1)

## Navigation
- **Встречи** (`/meetings`) — transcript projects in tree folders + Speakers (`/meetings/speakers`)
- **Документы** (`/documents`) — Document Agent: automated pipeline analysis
- **Конструктор** (`/constructor`) — Tabs: Сценарии | Промпты
- **Админ** (`/admin`)

## Implemented Features

### Meeting Analysis
- Hierarchical folder structure with tree navigation (full-width)
- "Move to folder" in project context menu
- Audio upload, transcription, speaker identification
- Pipeline constructor (React Flow), dynamic wizard, results
- File/link attachments with multimodal AI, export

### Speaker Directory
- Compact table view with sortable columns
- Tags support, filters (search, company, tag dropdowns)
- Back navigation to /meetings

### Document Agent — Automated Pipeline
- Hierarchical folder/project structure (full-width tree)
- "Move to folder" in project context menu
- Source material upload (files + URLs)
- Server-side pipeline runner with topological sort
- Fan-out/fan-in support
- Results as expandable node cards with copy

### Navigation & Layout
- 4-item sidebar: Встречи, Документы, Конструктор, Админ
- ConstructorPage with Сценарии/Промпты tabs
- Full-width left-aligned tree layouts
- Old routes redirect correctly

### S3 Storage Integration (Feb 2026)
- All file uploads (doc attachments, meeting attachments, audio) go to Timeweb S3
- Presigned URL download endpoints for secure file access
- Automatic fallback to local storage if S3 not configured
- S3 delete on attachment/project removal
- Service module: /app/backend/app/services/s3.py

### Deployment
- Docker Compose setup guide created (DEPLOY_GUIDE.md)
- Instructions for: MongoDB install, Docker setup, Nginx proxy, HTTPS
- Target VPS: 185.246.220.121

## Backlog
- PDF content parsing for AI context
- Export results to Word/PDF
- Real-time pipeline execution progress
