# PRD — Pipeline Builder App (Noteall)

## Original Problem Statement
Web application for building and running data processing pipelines (workflows) for meeting transcription and analysis.

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
  - **Org name editing** via "Переименовать" button on AdminPage → PUT /api/organizations/my

## Key API Endpoints
- `PUT /api/organizations/my` — Rename organization
- `GET/PUT /api/billing/admin/cost-settings` — Cost settings
- `POST /api/billing/admin/run-storage-calc` — Manual S3 storage cost job

## P2 Backlog
- Landing page refinements
- Real payment integration (Stripe/YooKassa)
