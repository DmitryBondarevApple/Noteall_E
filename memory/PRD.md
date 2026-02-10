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

## Backlog
- PDF content parsing for AI context
- Export results to Word/PDF
- Real-time pipeline execution progress
