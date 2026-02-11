# PRD — Pipeline Builder App (Noteall)

## Original Problem Statement
Web application for building and running data processing pipelines (workflows) for meeting transcription and analysis. Frontend: React/JavaScript with React Flow. Backend: FastAPI + MongoDB. Pipeline execution runs client-side in the browser.

## Tech Stack
- **Frontend:** React, JavaScript, React Flow, TanStack Query, Shadcn UI
- **Backend:** FastAPI (Python), MongoDB (Motor async driver)
- **Auth:** JWT-based with bcrypt password hashing
- **AI:** OpenAI GPT (via Emergent LLM Key)
- **Storage:** S3-compatible (twcstorage.ru)

## User Roles
- `user`, `org_admin`, `admin`, `superadmin`
- `dmitry.bondarev@gmail.com` auto-promoted to superadmin on startup

## Node Types (Pipeline Engine)
- `ai_prompt`, `parse_list`, `batch_loop`, `aggregate`
- `user_input` (interactive), `format_template` (auto), `batch_prompt_template` (auto)
- `user_edit_list`, `user_review`
- `template` (legacy, backward compatible)

## Completed Work
- Pipeline execution engine with batch_loop, template nodes
- Explicit config fields: `prompt_source_node`, `loop_vars`
- Pipeline validation + auto-fix
- Bug fixes: wizard "0 из 0", empty review step
- User permission auto-promotion on startup
- **Template node refactoring** (Feb 2026): Split into 3 subtypes
- **Landing page** (Feb 2026): Full marketing landing at `/` with:
  - Hero section with CTA
  - Key differentiator ("not transcription, meaning extraction")
  - Features: meeting analysis, document analysis, scenario constructor
  - How it works (3 steps)
  - Constructor deep-dive with illustration
  - Document formats section
  - Team/collaboration
  - Pricing
  - Auth modal (login + register)
  - Dark theme, responsive (mobile-ready)
  - Old auth page preserved at `/login`

## Key Architecture
```
/app/backend/
  app/main.py             - FastAPI app, startup logic
  app/core/database.py    - MongoDB connection
  app/core/security.py    - JWT auth, role checks
  app/models/             - Pydantic models
  app/routes/             - API routes

/app/frontend/
  src/pages/LandingPage.js              - Marketing landing page
  src/pages/AuthPage.js                 - Standalone auth page (/login)
  src/pages/PipelineEditorPage.jsx      - Pipeline editor
  src/pages/ConstructorPage.js          - Scenarios list
  src/components/pipeline/              - Pipeline components
  src/components/project/FullAnalysisTab.jsx - Pipeline wizard
  src/App.js                            - Routes configuration
```

## Routing
- `/` — Landing page (public, redirects to /meetings if logged in)
- `/login` — Standalone auth page (public)
- `/meetings` — Dashboard (protected)
- `/constructor` — Scenarios (protected)
- `/pipelines/:id` — Pipeline editor (protected)

## P2 Backlog
- Migrate to `app.noteall.ru` subdomain (requires DNS CNAME)
- Replace generated illustrations with real app screenshots
- Additional landing page refinements based on user feedback
