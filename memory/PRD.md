# VoiceWorkspace PRD

## Original Problem Statement
Build a sophisticated web application for transcribing and analyzing audio files. Features include a "Full Analysis Wizard," speaker identification, and various UX/UI improvements. The user actively provides feedback, reports bugs, and requests new features.

## Core Requirements
- **Full Analysis Wizard:** Multi-step process for comprehensive transcript analysis (topic extraction, summaries, combined document)
- **Export Functionality:** Export analysis results to Markdown, Word (.docx), and PDF formats
- **Speaker Identification:** Clickable speaker badges in transcript with inline editing
- **Contextual Editing:** Edit text surrounding problematic words to fix split-word issues
- **Mobile Responsiveness:** Usable on mobile devices

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Axios
- **Backend:** FastAPI, Motor (async MongoDB), Pydantic
- **AI/LLM:** Deepgram (Transcription), OpenAI GPT-4o (Analysis) via Emergent LLM Key
- **Export:** python-docx (Word), reportlab (PDF)

## What's Been Implemented
- Full Analysis Wizard ("Мастер полного анализа встречи")
- Export to Word (.docx) and PDF with Cyrillic support
- Context editing in Review tab to fix split words
- Support for .m4a and other audio formats (iOS fix)
- Mobile responsiveness overhaul
- Deepgram v5 SDK compatibility patch
- SpeakerCombobox multi-click fix
- Project status update logic fix
- Admin panel /api/admin/prompts endpoint
- **[2025-12-08] Fixed: speaker_hints field missing from ProjectResponse**
- **[2025-12-08] Major refactor: Speaker editing moved to Transcript tab**
  - Removed "Speakers" tab entirely
  - Speaker labels are now clickable colored badges in the transcript
  - Click opens edit dialog with combobox
  - Support for "Имя Фамилия (Компания)" format with auto-parsing into first_name, last_name, company
  - Removed AI speaker analysis feature (cost optimization)
  - All badges update instantly after rename

## Speaker Data Model
- `speaker_maps` collection: `{id, project_id, speaker_label, speaker_name, first_name?, last_name?, company?}`
- Input format: "Антон Петров (Яндекс)" → first_name: "Антон", last_name: "Петров", company: "Яндекс"

- **[2025-12-08] Fixed: cosmetic bug** — words in Review tab appeared with spaces between letters due to JetBrains Mono (monospace) font on `<code>` elements. Replaced with `<span>` using proportional body font.

## Upcoming Tasks (P1)
- Tags for Speaker Directory — tagging system for better speaker organization

## Future/Backlog (P2)
- Import/Export — import speakers from CSV, export transcripts

## Credentials
- User: admin@voiceworkspace.com / admin123
- DB: test_database on mongodb://localhost:27017
