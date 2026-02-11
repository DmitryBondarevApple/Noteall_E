# Voice Workspace + Document Agent — PRD

## Architecture
- **Backend**: FastAPI + MongoDB (motor async)
- **Frontend**: React + Tailwind CSS + shadcn/ui + React Flow
- **AI**: OpenAI GPT (dynamic model from settings, default gpt-5.2)
- **Auth**: JWT-based
- **Storage**: Timeweb S3
- **Deploy**: VPS 185.246.220.121, Docker Compose, MongoDB 8.0.19, HTTPS
- **Domain**: https://noteall.ru
- **CI/CD**: GitHub Actions auto-deploy on push to main

## Implemented Features

### AI Chat Assistant (Feb 2026)
- Persistent chat interface replacing modal-based AI assistant
- Multi-turn conversations with full context persistence
- Image upload support (screenshots) for debugging via S3
- AI parses pipeline JSON from responses, shows as interactive cards
- "Apply scenario" button to update canvas from chat
- Session management: create, list, delete sessions
- Works on both PipelinesPage (create new) and PipelineEditorPage (edit existing)
- Chat history saved to MongoDB `ai_chat_sessions` collection
- **Pipeline context injection**: current scenario (nodes, edges, prompts) is automatically attached to AI context in editor, enabling precise edits to specific nodes

### Model Management (Feb 2026)
- Dynamic model selection from Admin panel (Модели tab)
- Check OpenAI for new models via API
- One-click switch to newer model
- Model name auto-updates across all AI functions
- Public /api/model-info endpoint for frontend display

### PDF Parsing (Feb 2026)
- PyMuPDF + Tesseract OCR fallback

### Pipeline Export/Import (Feb 2026)
- JSON export/import with UI

### S3 Storage (Feb 2026)
- All uploads to Timeweb S3

### Navigation: Go Back (Feb 2026)
- Edit pipeline button on DocProjectPage next to Run button
- "Return to project" button in PipelineEditorPage when navigated from a document project
- Back arrow also returns to source page (project or pipelines list)

### Organizations & Roles (Feb 2026)
- `organizations` collection: {id, name, owner_id, created_at, updated_at}
- Roles: `superadmin` (platform), `org_admin` (org-level), `user` (regular)
- Registration auto-creates organization (optional org name field)
- Pre-invitation flow: org_admin invites by email → user joins org on registration
- Org-admin: manage team, set roles (user/org_admin), set monthly token limits per user
- Superadmin: view all orgs/users, change any user's role
- Admin panel with tabs: Организация, Все пользователи, Все организации, Промпты, Модели
- Migration: existing users assigned to personal orgs, admin@voiceworkspace.com → superadmin

### Billing & Credit System (Feb 2026)
- Organization-level credit balances
- Tariff plan: $20/month for 1000 credits (1 credit = $0.02 USD)
- Mock topup: credits added without real payment gateway
- Transaction history log (topups/deductions)
- Billing page with balance card, tariff plans, purchase dialog, transaction history
- Superadmin: view all organizations' balances (tab in billing)
- Navigation: "Биллинг" sidebar link for org_admin and superadmin users

### Core Features
- Meeting transcription, speaker identification, AI analysis
- Document Agent with automated pipeline runner
- Constructor: visual pipeline editor + prompts
- Folder structures, branding (Noteall)

- `credit_balances`: {org_id, balance (float), updated_at}
- `transactions`: {id, org_id, user_id, type (topup|deduction), amount, description, created_at}
- `tariff_plans`: {id, name, price_usd, credits, is_active, created_at}

## Key API Endpoints
- POST /api/auth/register — Register with optional organization_name
- POST /api/auth/login — Login, returns user with org_id, org_name
- GET /api/organizations/my — Get current user's organization
- GET /api/organizations/my/users — List org members (org_admin+)
- POST /api/organizations/my/invite — Invite user by email (org_admin+)
- PUT /api/organizations/my/users/{id}/role — Change user role in org
- PUT /api/organizations/my/users/{id}/limit — Set monthly token limit
- DELETE /api/organizations/my/users/{id} — Remove user from org
- GET /api/organizations/all — List all orgs (superadmin only)
- PUT /api/admin/users/{id}/role — Change any user's role (superadmin only)
- GET /api/billing/plans — List active tariff plans
- GET /api/billing/balance — Get org credit balance
- POST /api/billing/topup — Mock purchase credits (org_admin+)
- GET /api/billing/transactions — Transaction history with pagination
- GET /api/billing/admin/balances — All org balances (superadmin only)
- POST /api/ai-chat/sessions — Create chat session
- GET /api/ai-chat/sessions — List sessions (optionally by pipeline_id)
- GET /api/ai-chat/sessions/{id} — Get session with messages
- POST /api/ai-chat/sessions/{id}/message — Send message (multipart, supports image)
- DELETE /api/ai-chat/sessions/{id} — Delete session
- POST /api/pipelines/generate — Generate pipeline from prompt
- GET /api/pipelines/{id}/export — Export pipeline as JSON
- POST /api/pipelines/import/json — Import pipeline from JSON

## DB Schema
- `users`: {id, email, password, name, role, org_id, monthly_token_limit, created_at}
- `organizations`: {id, name, owner_id, created_at, updated_at}
- `org_invitations`: {id, org_id, email, invited_by, accepted, created_at}
- `projects`: {name, user_id, documents, attachments}
- `pipelines`: {name, user_id, nodes, edges, generation_prompt}
- `ai_chat_sessions`: {id, user_id, pipeline_id, messages: [{role, content, image_url, image_s3_key, timestamp}], created_at, updated_at}
- `settings`: {key: "active_model", value: "gpt-5.2"}

## Backlog
- **P0**: SaaS Stage 3: AI request metering (token counting, cost calculation, markup table, credit deduction per AI call, enforcement of monthly_token_limit)
- **P1**: SaaS Stage 4: Admin dashboards (superadmin: revenue/credit charts, org_admin: usage stats per employee, configurable markup coefficient table)
- **P2**: SaaS Stage 5: Real payment gateway integration (Stripe)
- **P2**: Auto-check for new AI models and admin notification
- **P2**: Export results to Word/PDF
- **P2**: Real-time pipeline execution progress
