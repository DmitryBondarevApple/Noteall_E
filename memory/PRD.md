# PRD — Pipeline Builder App

## Original Problem Statement
Web application for building and running data processing pipelines (workflows). Frontend: React/TypeScript with React Flow. Backend: FastAPI + MongoDB. Pipeline execution runs client-side in the browser.

## Tech Stack
- **Frontend:** React, TypeScript, React Flow, TanStack Query, Shadcn UI
- **Backend:** FastAPI (Python), MongoDB (Motor async driver)
- **Auth:** JWT-based with bcrypt password hashing
- **AI:** OpenAI GPT (via Emergent LLM Key)
- **Storage:** S3-compatible (twcstorage.ru)

## User Roles
- `user`, `org_admin`, `admin`, `superadmin`
- Superadmin: full access to admin routes (user management, model switching)
- org_admin: organization-level admin
- Roles stored in MongoDB `users` collection, field `role`

## Completed Work
- Pipeline execution engine with batch_loop, template nodes
- Explicit config fields: `prompt_source_node`, `loop_vars`
- Pipeline validation system (pre-run warnings/errors)
- Auto-fix for common validation issues
- Bug fixes: wizard "0 из 0", empty review step
- Master prompt update for AI pipeline generator
- User permission fix: `dmitry.bondarev@gmail.com` auto-promoted to `superadmin` on app startup (Feb 2026, in `main.py` startup event)

## Key Architecture
```
/app/backend/
  app/core/database.py    - MongoDB connection (Motor)
  app/core/security.py    - JWT auth, role checks
  app/models/user.py      - Pydantic user models
  app/routes/auth.py      - Login, register, /me
  app/routes/admin.py     - Superadmin user/model management
  app/routes/pipelines.py - Pipeline CRUD
  
/app/frontend/
  src/lib/pipelines/run.ts     - Client-side pipeline engine
  src/lib/pipelines/wizard.ts  - Wizard UI logic
  src/pages/Project/FullAnalysisTab.tsx - Pipeline run UI
  src/components/NodeConfigPanel.tsx    - Node settings UI
```

## P1 Backlog
- Refactor `template` node into subtypes: `user_input_template`, `format_template`, `batch_prompt_template`

## P2 Backlog
- Additional pipeline engine improvements as needed
