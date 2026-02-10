# Voice Workspace + Document Agent — PRD

## Architecture
- **Backend**: FastAPI + MongoDB (motor async)
- **Frontend**: React + Tailwind CSS + shadcn/ui + React Flow
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Auth**: JWT-based
- **Storage**: Timeweb S3
- **Deploy**: VPS 185.246.220.121, Docker Compose, MongoDB 8.0.19, HTTPS
- **Domain**: https://noteall.ru
- **CI/CD**: GitHub Actions auto-deploy on push to main

## Implemented Features

### PDF Parsing (Feb 2026)
- PyMuPDF text extraction from text-layer PDFs
- OCR fallback via Tesseract (Russian + English) for scanned PDFs
- Integrated into: Document Agent pipeline runner, meeting attachments
- Max 100K chars per PDF, auto-truncation
- Service: /app/backend/app/services/pdf_parser.py
- Dockerfile updated with tesseract-ocr + tesseract-ocr-rus

### Pipeline Export/Import (Feb 2026)
- Export pipeline as JSON from dropdown + editor
- Import via button on constructor page

### Branding (Feb 2026)
- Logo, favicon, updated texts, copyright 2026

### S3 Storage (Feb 2026)
- All uploads to Timeweb S3, presigned URL downloads

### Core Features
- Meeting transcription, speaker identification, AI analysis
- Document Agent with automated pipeline runner
- Constructor: visual pipeline editor + prompts
- Folder structures, move-to-folder, persistent state

## Backlog
- Export results to Word/PDF
- Real-time pipeline execution progress
