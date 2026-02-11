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

### Model Management (Feb 2026)
- Dynamic model selection from Admin panel (Модели tab)
- Check OpenAI for new models via API
- One-click switch to newer model
- Model name auto-updates across all AI functions
- Public /api/model-info endpoint for frontend display

### AI-ассистент (Feb 2026)
- Generate pipelines from text prompt via GPT
- Edit prompt and regenerate in editor
- Prompt saved in pipeline document

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

## Backlog
- Export results to Word/PDF
- Real-time pipeline execution progress
