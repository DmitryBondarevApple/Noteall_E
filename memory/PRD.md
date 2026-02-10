# Voice Workspace + Document Agent — PRD

## Architecture
- **Backend**: FastAPI + MongoDB (motor async)
- **Frontend**: React + Tailwind CSS + shadcn/ui + React Flow
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Auth**: JWT-based

## Navigation
- **Встречи** (`/meetings`) — transcript projects in tree folders + Speakers button
- **Документы** (`/documents`) — Document Agent: automated pipeline analysis
- **Конструктор** (`/constructor`) — Tabs: Сценарии (pipelines) | Промпты
- **Админ** (`/admin`) — Admin panel

## What's Implemented

### Meeting Analysis (Complete)
- Hierarchical folder structure (meeting_folders API)
- Audio upload, transcription, speaker identification
- Pipeline constructor (React Flow), dynamic wizard, results
- File/link attachments with multimodal AI, export

### Document Agent — Automated Pipeline (Complete - Feb 10, 2026)
- Hierarchical folder/project structure with CRUD
- Source material upload (files + URLs)
- **Server-side pipeline runner**: executes pipeline nodes in topological order
- Supports: ai_prompt, template, parse_list, batch_loop, aggregate nodes
- Fan-out/fan-in: one node can feed many parallel branches, aggregate merges them
- Source materials injected as AI context automatically
- Results displayed as expandable cards per node step
- Copy full results or individual steps to clipboard
- Multiple runs per project with history

### Navigation (Complete - Feb 10, 2026)
- Sidebar: Встречи, Документы, Конструктор, Админ
- MeetingsPage with tree folders (replaces flat DashboardPage)
- ConstructorPage with Сценарии/Промпты tabs
- Old routes redirect to new locations

## Backlog
- PDF content parsing for AI context
- Drag-and-drop for tree navigation
- Export results to Word/PDF
- Refactor `usePipelineRunner` hook
