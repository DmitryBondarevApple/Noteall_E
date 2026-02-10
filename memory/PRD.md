# Voice Workspace + Document Agent — PRD

## Architecture
- **Backend**: FastAPI + MongoDB (motor async)
- **Frontend**: React + Tailwind CSS + shadcn/ui + React Flow
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Auth**: JWT-based

## Navigation
- **Встречи** (`/meetings`) — transcript projects in tree folders + Speakers (`/meetings/speakers`)
- **Документы** (`/documents`) — Document Agent: automated pipeline analysis
- **Конструктор** (`/constructor`) — Tabs: Сценарии | Промпты
- **Админ** (`/admin`)

## Implemented Features

### Meeting Analysis
- Hierarchical folder structure (meeting_folders API)
- Audio upload, transcription, speaker identification
- Pipeline constructor (React Flow), dynamic wizard, results
- File/link attachments with multimodal AI, export

### Speaker Directory (Redesigned - Feb 10, 2026)
- Compact table view (replaces card layout)
- Tags support (multi-tag per speaker, comma-separated input)
- Filters: search, company dropdown, tag dropdown
- Sortable columns: name, company, role
- Back navigation to /meetings

### Document Agent — Automated Pipeline
- Hierarchical folder/project structure
- Source material upload (files + URLs)
- Server-side pipeline runner with topological sort
- Fan-out/fan-in support (parallel branches + aggregate merge)
- Results displayed as expandable node cards
- Copy full results or individual steps

### Navigation
- 4-item sidebar: Встречи, Документы, Конструктор, Админ
- ConstructorPage with Сценарии/Промпты tabs
- Old routes redirect correctly

## Backlog
- PDF content parsing for AI context
- Export results to Word/PDF
- Real-time pipeline execution progress
