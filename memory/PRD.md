# Voice Workspace + Document Agent — PRD

## Architecture
- **Backend**: FastAPI + MongoDB (motor async)
- **Frontend**: React + Tailwind CSS + shadcn/ui + React Flow
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Auth**: JWT-based
- **Storage**: Timeweb S3 (s3.twcstorage.ru)
- **Deploy**: VPS 185.246.220.121, Docker Compose, MongoDB 8.0.19, HTTPS via Let's Encrypt
- **Domain**: https://noteall.ru
- **CI/CD**: GitHub Actions auto-deploy on push to main

## Implemented Features

### Branding (Feb 2026)
- Logo: "noteall" wordmark with teal sparkle over "a"
- Favicon: teal 4-pointed star
- Title: "Noteall"
- Updated landing page texts for document/meeting analysis focus
- Copyright: 2026 Noteall

### S3 Storage Integration (Feb 2026)
- All file uploads go to Timeweb S3
- Presigned URL download endpoints
- Fallback to local storage if S3 not configured

### Pipeline Export/Import (Feb 2026)
- Export pipeline as JSON from list dropdown menu + editor page
- Import pipeline from JSON file via button on constructor page
- Duplicate name detection with "(импорт)" suffix

### Deployment (Feb 2026)
- Docker Compose on VPS with HTTPS
- GitHub Actions CI/CD auto-deploy
- Emergent badge removed from production

### Meeting Analysis
- Folder structure, audio upload, transcription, speaker identification
- Pipeline constructor, results, file/link attachments

### Document Agent — Automated Pipeline
- Folder/project structure, source material upload
- Server-side pipeline runner with fan-out/fan-in

### Constructor
- Tabbed interface: Сценарии | Промпты
- Visual pipeline editor with React Flow

## Backlog
- PDF content parsing for AI context
- Export results to Word/PDF
- Real-time pipeline execution progress
