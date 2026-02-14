# PRD — Pipeline Builder App (Noteall)

## Original Problem Statement
Web application for building and running data processing pipelines (workflows) for meeting transcription and analysis with a public/private storage system.

## Tech Stack
- **Frontend:** React, JavaScript, React Flow, TanStack Query, Shadcn UI
- **Backend:** FastAPI (Python), MongoDB (Motor async driver)
- **Auth:** JWT-based, `dmitry.bondarev@gmail.com` auto-promoted to superadmin
- **AI:** OpenAI GPT via Emergent LLM Key
- **Storage:** S3-compatible (twcstorage.ru)
- **Domain:** app.noteall.ru (migrated)

## Completed Work
- Pipeline engine: batch_loop, template subtypes
- Pipeline validation + auto-fix
- Landing page (dark theme, real screenshots)
- Fast-track mode (auto-processing)
- Removed GPT/Deepgram brand mentions
- **Billing with RUB prices**: 4 packages, exchange rate daily, custom amounts, tiered discounts
- **Cost Calculation Parameters**: Transcription ($0.0043/min x multiplier), S3 storage ($0.025/GB/month x multiplier, daily at 3:05 MSK)
- **UI Polish**: Active tab blue underline globally, removed unused "Промпты" tab
- **Org Management** (Feb 2026):
  - dmitry.bondarev@gmail.com → org "Bondarev Consulting" (startup script)
  - Default org name: "{Name} Company" when registration field empty
  - Org name in sidebar above user name
  - Org name editing via "Переименовать" button on AdminPage → PUT /api/organizations/my

### Phase 1: Backend Foundations (Feb 2026) — DONE
  - New schema: `owner_id`, `visibility` (private/public), `shared_with`, `access_type`, `deleted_at` for all folders and projects
  - Meeting folders: full CRUD with visibility, sharing, move, trash (soft delete/restore/permanent)
  - Doc folders: same feature set
  - Meeting projects: tab filtering (private/public/trash), soft delete, restore, move with visibility inheritance
  - Doc projects: same feature set
  - Access control service: `can_user_access_folder/project`, `can_user_write_folder/project`, `soft_delete_folder`, `cleanup_expired_trash`
  - Migration script: existing data auto-migrated on startup
  - Trash cleanup: scheduled daily job
  - Admin trash settings: GET/PUT /api/admin/trash-settings (superadmin only)
  - All related routes (transcripts, fragments, speakers, chat, attachments) updated to use access control
  - **53/53 backend tests passed**

### Phase 2: Frontend — Meetings View (Feb 2026) — DONE
  - Tabs: Приватные / Публичные / Корзина with state persistence in localStorage
  - Folder tree with visibility icons (Globe for public), folder counts
  - Create folder dialog with visibility selector and access type
  - Sharing UI: Share/Unshare via dropdown menu, Share dialog with access level selector
  - Move dialog for folders and projects
  - Trash management: soft delete, restore, permanent delete with time-ago labels
  - Context menu shows folder owner name for public folders
  - **14/14 frontend tests passed**

### Phase 3: Frontend — Documents View (Feb 2026) — DONE
  - Same tab/sharing/trash UI as Meetings page
  - All dialogs (create folder, share, move) replicated
  - **Tested together with Phase 2 — all passed**

## Key API Endpoints
- `GET /api/meeting-folders?tab=private|public|trash` — List meeting folders by tab
- `POST /api/meeting-folders/{id}/share` — Share folder (make public)
- `POST /api/meeting-folders/{id}/unshare` — Unshare folder (make private)
- `POST /api/meeting-folders/{id}/move` — Move folder
- `POST /api/meeting-folders/{id}/restore` — Restore from trash
- `DELETE /api/meeting-folders/{id}/permanent` — Permanently delete
- `GET /api/projects?tab=private|public|trash` — List projects by tab
- `POST /api/projects/{id}/move` — Move project between folders
- `POST /api/projects/{id}/restore` — Restore project from trash
- `DELETE /api/projects/{id}/permanent` — Permanently delete project
- Same endpoints for doc folders/projects under /api/doc/...
- `GET/PUT /api/admin/trash-settings` — Trash retention period (superadmin)

## P0 — In Progress
- **Phase 4:** Superadmin Controls — trash retention UI in admin panel, final E2E testing

## P1 Backlog
- Landing page refinements
- Real payment integration (Stripe/YooKassa)
