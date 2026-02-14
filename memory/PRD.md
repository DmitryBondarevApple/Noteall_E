# PRD — Pipeline Builder App (Noteall)

## Original Problem Statement
Web application for building and running data processing pipelines (workflows) for meeting transcription and analysis with a public/private storage system.

## Tech Stack
- **Frontend:** React, JavaScript, React Flow, TanStack Query, Shadcn UI
- **Backend:** FastAPI (Python), MongoDB (Motor async driver)
- **Auth:** JWT-based, `dmitry.bondarev@gmail.com` auto-promoted to superadmin
- **AI:** OpenAI GPT via Emergent LLM Key
- **Storage:** S3-compatible (twcstorage.ru)

## Completed Work

### Phase 1: Backend Foundations (Feb 2026)
- New schema: `owner_id`, `visibility`, `shared_with`, `access_type`, `deleted_at` for all folders and projects
- Full CRUD + sharing + move + trash for meeting_folders, projects, doc_folders, doc_projects
- Access control service with per-folder/per-project permission checks
- Migration script + daily trash cleanup job
- Admin trash retention settings API
- **53/53 backend tests passed**

### Phase 2: Frontend — Meetings View (Feb 2026)
- Tabs: Приватные / Публичные / Корзина
- Folder tree with visibility icons, sharing/move/trash dialogs
- Context menu shows folder owner for public folders

### Phase 3: Frontend — Documents View (Feb 2026)
- Same tab/sharing/trash UI as Meetings
- **14/14 frontend tests passed (Phase 2+3)**

### Phase 4: Superadmin Controls (Feb 2026)
- Trash retention settings UI in admin panel ("Корзина" tab)
- Final E2E testing — all flows verified
- **53/53 backend + full frontend E2E passed**

## Key API Endpoints
- `GET /api/meeting-folders?tab=private|public|trash`
- `POST /api/meeting-folders/{id}/share|unshare|move|restore`
- `DELETE /api/meeting-folders/{id}/permanent`
- `GET /api/projects?tab=private|public|trash`
- `POST /api/projects/{id}/move|restore`
- `DELETE /api/projects/{id}/permanent`
- Same for doc folders/projects under /api/doc/...
- `GET/PUT /api/admin/trash-settings`

## P1 Backlog
- Landing page refinements
- Real payment integration (Stripe/YooKassa)
