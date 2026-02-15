# Noteall.ru - PRD

## Original Problem Statement
Build the "noteall.ru" platform - a meeting notes and transcription management tool with organization management, billing, and AI-powered features.

## Core Features (Implemented)
- Project/folder management (public/private/trash)
- JWT authentication with password reset via Resend
- "Suggest Improvements" feedback modal (Telegram integration)
- Superadmin analytics dashboard
- Organization admin analytics dashboard
- Transcript view with compact speaker badges
- Redesigned sidebar layout

## Tech Stack
- **Frontend:** React, Recharts, html2canvas, Shadcn UI
- **Backend:** FastAPI, MongoDB
- **Email:** Resend (transactional emails)
- **Integrations:** OpenAI GPT-4o, Deepgram, AWS S3, Telegram Bot API, Free Currency Converter API

## Key Architecture
- Frontend: `/app/frontend/src/`
- Backend: `/app/backend/src/`
- Shared analytics components: `/app/frontend/src/components/analytics/`
- Shared analytics utils: `/app/backend/src/projects/routes/billing_utils.py`

## Completed Tasks
- [x] Core project management features
- [x] Feedback modal with Telegram integration
- [x] Superadmin analytics dashboard
- [x] Organization admin analytics dashboard
- [x] Sidebar redesign
- [x] Compact speaker badges in transcript
- [x] Password reset flow (Resend integration)
- [x] "Forgot Password?" link in landing page auth modal (Feb 2026)

## Backlog
- No defined future tasks - awaiting user input

## Credentials
- Superadmin: dmitry.bondarev@gmail.com
- Resend API Key: configured in backend/.env
- Resend from email: noreply@notifications.noteall.ru
