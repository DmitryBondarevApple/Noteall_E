# PRD — Pipeline Builder App (Noteall)

## Original Problem Statement
Web application for building and running data processing pipelines (workflows) for meeting transcription and analysis. Frontend: React/TypeScript with React Flow. Backend: FastAPI + MongoDB. Pipeline execution runs client-side in the browser.

## Tech Stack
- **Frontend:** React, JavaScript, React Flow, TanStack Query, Shadcn UI
- **Backend:** FastAPI (Python), MongoDB (Motor async driver)
- **Auth:** JWT-based with bcrypt password hashing
- **AI:** OpenAI GPT (via Emergent LLM Key)
- **Storage:** S3-compatible (twcstorage.ru)

## User Roles
- `user`, `org_admin`, `admin`, `superadmin`
- Superadmin: full access to admin routes (user management, model switching)
- Roles stored in MongoDB `users` collection, field `role`
- `dmitry.bondarev@gmail.com` auto-promoted to superadmin on startup

## Node Types (Pipeline Engine)
### Current (after refactoring, Feb 2026):
- `ai_prompt` — AI call with prompt template
- `parse_list` — Parse text into list items
- `batch_loop` — Iterate over items in batches
- `aggregate` — Join results
- `user_input` — Interactive: user fills in form fields (was `template`)
- `format_template` — Auto: resolves variables from other nodes (was `template` with input_from)
- `batch_prompt_template` — Auto: template with loop_vars for batch processing (was `template` with loop_vars)
- `user_edit_list` — Interactive: user edits/selects list items
- `user_review` — Interactive: user reviews final result
- `template` — Legacy, backward compatible (maps to user_input behavior)

## Completed Work
- Pipeline execution engine with batch_loop, template nodes
- Explicit config fields: `prompt_source_node`, `loop_vars`
- Pipeline validation system (pre-run warnings/errors)
- Auto-fix for common validation issues
- Bug fixes: wizard "0 из 0", empty review step
- Master prompt update for AI pipeline generator
- User permission fix: auto-promotion on startup
- **Template node refactoring** (Feb 2026): Split `template` into `user_input`, `format_template`, `batch_prompt_template` with distinct icons, colors, and config panels. DB migration applied. Backward compat preserved. All tests passed (10/10 backend, 100% frontend).

## Key Architecture
```
/app/backend/
  app/core/database.py    - MongoDB connection (Motor)
  app/core/security.py    - JWT auth, role checks
  app/models/user.py      - Pydantic user models
  app/models/pipeline.py  - Pipeline node/edge models
  app/routes/auth.py      - Login, register, /me
  app/routes/admin.py     - Superadmin user/model management
  app/routes/pipelines.py - Pipeline CRUD
  app/routes/seed.py      - Initial data seeding
  app/main.py             - FastAPI app, startup logic
  
/app/frontend/
  src/lib/pipelineUtils.js         - Shared pipeline utilities
  src/components/pipeline/PipelineNode.jsx     - Node visual display + NODE_STYLES
  src/components/pipeline/NodeConfigPanel.jsx  - Node settings panel
  src/pages/PipelineEditorPage.jsx             - Pipeline editor with React Flow
  src/components/project/FullAnalysisTab.jsx   - Pipeline execution wizard
```

## P2 Backlog
- Additional pipeline engine improvements as needed
