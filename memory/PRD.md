# Voice Workspace + Document Agent — PRD

## Architecture
- **Backend**: FastAPI + MongoDB (motor async)
- **Frontend**: React + Tailwind CSS + shadcn/ui + React Flow
- **AI**: GPT-5.2 via Emergent LLM Key (emergentintegrations)
- **Auth**: JWT-based
- **Storage**: Timeweb S3
- **Deploy**: VPS 185.246.220.121, Docker Compose, MongoDB 8.0.19, HTTPS
- **Domain**: https://noteall.ru
- **CI/CD**: GitHub Actions auto-deploy on push to main

## Implemented Features

### AI-ассистент для генерации сценариев (Feb 2026)
- POST /api/pipelines/generate — AI создаёт полную структуру сценария по промпту
- Кнопка "AI-ассистент" на странице Конструктора + в редакторе
- Промпт сохраняется в сценарии (generation_prompt)
- Возможность редактирования промпта и перегенерации
- Переход в редактор после генерации

### PDF Parsing (Feb 2026)
- PyMuPDF + Tesseract OCR fallback (Russian + English)

### Pipeline Export/Import (Feb 2026)
- JSON export/import с UI

### Branding (Feb 2026)
- Logo, favicon, updated texts

### S3 Storage (Feb 2026)
- All uploads to Timeweb S3

### Core Features
- Meeting transcription, speaker identification, AI analysis
- Document Agent with automated pipeline runner
- Constructor: visual pipeline editor + prompts
- Folder structures, move-to-folder, persistent state

## Backlog
- Export results to Word/PDF
- Real-time pipeline execution progress
