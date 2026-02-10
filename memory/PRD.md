# Voice Workspace + Document Agent — PRD

## Original Problem Statement
Web application for transcribing and analyzing meetings with AI. 
New major feature: **Document Agent** — a section for complex document processing workflows with hierarchical project structure, multi-stream AI analysis, and document assembly.

## Architecture
- **Backend**: FastAPI + MongoDB (motor async)
- **Frontend**: React + Tailwind CSS + shadcn/ui + React Flow
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Auth**: JWT-based

## Navigation Structure
- **Встречи** (`/meetings`) — transcript projects in tree folders + Speakers (button -> `/meetings/speakers`)
- **Документы** (`/documents`) — Document Agent: folders, projects, AI streams, final document
- **Конструктор** (`/constructor`) — Tabs: Сценарии (pipelines) | Промпты
- **Админ** (`/admin`) — Admin panel (admin-only)

## What's Implemented

### Meeting Analysis (Complete)
- Hierarchical folder structure for meeting projects (meeting_folders API)
- Project creation with folder_id association
- Audio upload, transcription (Deepgram), speaker identification
- Analysis pipeline constructor (React Flow)
- Dynamic wizard, results management, re-analysis
- File/link attachments with multimodal AI
- Export to Word/PDF
- Speaker directory at /meetings/speakers

### Document Agent (Complete - Feb 10, 2026)
- Phase 1: Hierarchical tree, vertical sidebar, CRUD for folders/projects/attachments
- Phase 2: Analysis streams (multi-chat), AI with source material context
- Phase 3: Templates (5 pre-seeded), pins for final document assembly, copy-to-clipboard

### Navigation Restructuring (Complete - Feb 10, 2026)
- Sidebar: Встречи, Документы, Конструктор, Админ
- MeetingsPage with tree folder structure (replaces old flat DashboardPage)
- ConstructorPage with Сценарии/Промпты tabs (replaces separate pages)
- Old routes redirect to new locations
- Testing: 15/15 backend, 15/15 frontend

## Backlog
- PDF content parsing for AI context
- Drag-and-drop for trees and pins
- Export final document to Word/PDF
- Extract pipeline logic into `usePipelineRunner` hook
