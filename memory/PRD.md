# Voice Workspace + Document Agent — PRD

## Original Problem Statement
Web application for transcribing and analyzing meetings with AI. 
New major feature: **Document Agent** — a section for complex document processing workflows with hierarchical project structure, multi-stream AI analysis, and document assembly.

## Core Requirements
1. Meeting transcript analysis with customizable analysis pipelines
2. Speaker directory management
3. Prompt library management
4. **Document Agent**: hierarchical folder/project structure, source material management, AI analysis streams, final document assembly

## Architecture
- **Backend**: FastAPI + MongoDB (motor async)
- **Frontend**: React + Tailwind CSS + shadcn/ui + React Flow
- **AI**: OpenAI GPT-5.2 via Emergent LLM Key
- **Auth**: JWT-based

## What's Implemented

### Phase 0: Meeting Analysis (Complete)
- Project creation and audio upload
- Automatic transcription (Deepgram)
- Speaker identification and directory
- Analysis pipeline constructor (React Flow)
- Dynamic wizard engine for running analysis scenarios
- Results management with re-analysis capability
- File/link attachments with multimodal AI support
- Export to Word/PDF

### Phase 1: Document Agent Foundation (Complete - Feb 10, 2026)
- Backend: Full CRUD API for folders, projects, attachments, templates (`/api/doc/*`)
- Frontend: Vertical sidebar navigation (AppLayout) replacing horizontal nav
- Frontend: Documents page with hierarchical tree view
- Frontend: DocProjectPage workspace with source materials panel
- Testing: 24/24 backend tests pass, 10/10 frontend features verified

### Phase 2: Analysis Streams (Complete - Feb 10, 2026)
- Backend: CRUD for analysis streams + AI message endpoint
- Backend: Source material context injection into AI prompts (reads text files)
- Backend: Multi-turn conversation history preserved
- Frontend: 3-column workspace layout (materials, chat, stream tabs)
- Frontend: Stream creation with name + optional system prompt
- Frontend: Real-time chat with optimistic UI updates
- Frontend: Stream switching with correct message history
- Testing: 18/18 backend tests pass, 11/11 frontend features verified

## Backlog

### P1 - Phase 3: AI & Finalization  
- Reusable prompt/scenario templates for streams
- Final document assembly panel (combine results from streams)

### P2 - Refactoring
- Extract pipeline execution logic into `usePipelineRunner` hook
