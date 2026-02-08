# VoiceWorkspace PRD

## Original Problem Statement
Build a sophisticated web application for transcribing and analyzing audio files. Features include a "Full Analysis Wizard," speaker identification, and various UX/UI improvements. The user actively provides feedback, reports bugs, and requests new features.

## Core Requirements
- **Full Analysis Wizard:** Multi-step process for comprehensive transcript analysis (topic extraction, summaries, combined document)
- **Export Functionality:** Export analysis results to Markdown, Word (.docx), and PDF formats
- **Speaker Identification:** AI-powered hints (gender, name, role) based on transcript content
- **Contextual Editing:** Edit text surrounding problematic words to fix split-word issues
- **Mobile Responsiveness:** Usable on mobile devices
- **Bug Fixes:** Address various reported issues

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Axios
- **Backend:** FastAPI, Motor (async MongoDB), Pydantic
- **AI/LLM:** Deepgram (Transcription), OpenAI GPT-4o (Analysis, Speaker Hints) via Emergent LLM Key
- **Export:** python-docx (Word), reportlab (PDF)

## What's Been Implemented
- Full Analysis Wizard ("Мастер полного анализа встречи")
- Export to Word (.docx) and PDF with Cyrillic support
- AI-powered speaker identification hints (gender, name, role)
- Context editing in Review tab to fix split words
- Support for .m4a and other audio formats (iOS fix)
- Mobile responsiveness overhaul
- Speakers tab reordered to 2nd position
- Deepgram v5 SDK compatibility patch
- SpeakerCombobox multi-click fix
- Project status update logic fix
- Admin panel /api/admin/prompts endpoint
- **[2025-12-08] Fixed: speaker_hints field missing from ProjectResponse Pydantic model** — AI hints were saved to DB but not returned by API

## Known Issues
- **P2: Cosmetic bug** — Words appear split in Review tab UI (e.g., "п о м н ю"). CSS/rendering issue in FragmentCard.jsx.

## Upcoming Tasks (P1)
- Tags for Speaker Directory — tagging system for better speaker organization

## Future/Backlog (P2)
- Import/Export — import speakers from CSV, export transcripts

## Credentials
- User: admin@voiceworkspace.com / admin123
- DB: test_database on mongodb://localhost:27017
