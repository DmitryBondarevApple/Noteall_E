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
- Template node refactoring: 3 subtypes
- Landing page with dark theme, real screenshots
- **Fast-track mode** (Feb 2026):
  - Toggle in upload section + topic input + pipeline selector
  - Backend: `POST /api/projects/{id}/fragments/bulk-accept` for auto-accepting AI corrections
  - Backend: `fast_track` field in project model (enabled, topic, pipeline_id)
  - ProjectPage auto-processing: detect completion → bulk-accept → switch to analysis tab
  - FullAnalysisTab auto-mode: auto-select pipeline, auto-start wizard, auto-proceed through interactive steps
  - Last used pipeline remembered in localStorage

## Key Architecture
```
/app/backend/
  app/main.py             - FastAPI app, startup logic
  app/core/database.py    - MongoDB connection
  app/core/security.py    - JWT auth, role checks
  app/models/project.py   - Project model with fast_track field
  app/routes/fragments.py - Fragments CRUD + bulk-accept
  app/routes/projects.py  - Projects + upload with fast_track params

/app/frontend/
  src/pages/LandingPage.js              - Marketing landing page
  src/pages/ProjectPage.js              - Project with fast-track auto-processing
  src/components/project/UploadSection.jsx - Upload with fast-track toggle
  src/components/project/FullAnalysisTab.jsx - Pipeline wizard with autoRun mode
  src/lib/api.js                        - API layer with bulkAccept, upload fast_track
```

## Key API Endpoints
- `POST /api/projects/{id}/upload` — Upload with fast_track, fast_track_topic, fast_track_pipeline_id
- `POST /api/projects/{id}/fragments/bulk-accept` — Auto-accept all pending fragments
- `GET /api/pipelines` — List available pipelines

## P2 Backlog
- Migrate to `app.noteall.ru` subdomain (requires DNS CNAME)
- Landing page refinements
