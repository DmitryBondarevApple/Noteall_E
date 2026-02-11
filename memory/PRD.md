# Noteall — Multi-tenant SaaS Platform

## Original Problem Statement
Build a comprehensive multi-tenant SaaS application with AI features for meeting transcript analysis.

## Core Architecture
- **Backend:** FastAPI + MongoDB (Motor async driver)
- **Frontend:** React + Tailwind CSS + shadcn/ui + Recharts
- **AI:** OpenAI GPT-5.2 via Emergent LLM Key
- **Storage:** S3 (Timeweb Cloud) — bucket `context-chat-7`
- **Auth:** JWT with roles (user, org_admin, superadmin)

## Completed Stages
- Stage 1: User/Organization Management
- Stage 2: Billing & Credit System
- Stage 3: AI Usage Metering
- Stage 4: Admin & User Dashboards

## Bug Fixes & Improvements

### 2026-02-11: Refactoring input_from logic (DONE)
- Extracted duplicated `input_from` derivation from edges into shared utilities
- Backend: `app/utils/__init__.py` — `build_input_from_map()`, `fix_nodes_input_from()`
- Frontend: `src/lib/pipelineUtils.js` — `buildInputFromMap()`, `resolveInputFrom()`
- Refactored: `pipelines.py`, `documents.py`, `PipelineEditorPage.jsx`, `PipelinesPage.jsx`

### 2026-02-11: Magic Link Invitations (DONE)
- **Feature:** One-time magic link invitations for adding employees to an organization
- **Backend:** New `/api/invitations/` routes (create, list, validate, revoke)
- **Registration:** Modified to accept `invitation_token` — user joins existing org, no credits given
- **Anti-cheating:** Invited users don't trigger org creation or welcome credits
- **Frontend:** Invite registration page at `/invite/:token`, invitation management in Admin → Organization tab
- **Files:** `routes/invitations.py`, `routes/auth.py`, `models/user.py`, `pages/InviteRegisterPage.js`, `pages/AdminPage.js`, `lib/api.js`, `App.js`

### 2026-02-11: Superadmin Billing Bypass (DONE)
- **Bug:** Superadmin blocked by "Превышен месячный лимит токенов" despite having 1897 credits
- **Root cause:** `monthly_token_limit: 50000` was set for admin, and 54991 tokens were used this month
- **Fix:** Superadmins now bypass ALL billing checks (monthly limit + credit balance) in `metering.py`

### 2026-02-11: AI Pipeline input_from Fix (DONE)
### 2026-02-11: S3 Bucket Setup (DONE)
### 2026-02-11: AI Image Upload Bug (FIXED)
### 2026-02-11: Insufficient Credits Modal (DONE)
### 2026-02-11: Welcome Credits on Registration (DONE)

## Key Credentials
- Superadmin: admin@voiceworkspace.com / admin123
- Test user: bugtest@test.com / bugtest123

## Backlog
- (пусто)
