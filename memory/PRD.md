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

### 2026-02-12: AI-Generated Pipeline Execution Fix (DONE)
- **Bug:** AI-generated pipelines (with template variables like `{{text}}` and `{{key_subject}}`) failed to execute — "empty topics" reported by user
- **Root causes found (5 issues):**
  1. `processedTranscript` was passed as a full DB object to `FullAnalysisTab`, causing `{{text}}` to resolve to `[object Object]` instead of the actual transcript content
  2. `batch_loop` nodes without scripts never generated `promptVars`, so the AI node inside the loop never executed
  3. `parse_list` nodes with Python scripts failed silently in the JS runtime — no fallback parsing
  4. `ai_prompt` nodes with `input_from` couldn't use `{{text}}` to reference their input data — always got the transcript
  5. `user_review` assembly ordered parts incorrectly (summary/detailed were swapped)
- **Fixes applied:**
  - Extract `.content` from transcript object before assigning to `{{text}}`
  - Default batch behavior in `runBatchLoop`: auto-slices items by `batch_size`, generates `promptVars.item`
  - `defaultParseList()` fallback for `parse_list` nodes with failing/missing scripts
  - `ai_prompt` nodes with `input_from` now substitute `{{text}}` from input data before global variable lookup
  - `user_review` now puts last dep (short summary) first, earlier deps (detailed) after
  - Transcript prop falls back from processed → raw transcript
  - `key_subject` added to subject variable lookup chain
- **Files:** `FullAnalysisTab.jsx`, `ProjectPage.js`

## Key Credentials
- Superadmin: admin@voiceworkspace.com / admin123
- Test user: bugtest@test.com / bugtest123

## Backlog
- (пусто)

## Test Coverage
- `backend/tests/test_pipeline_utils.py` — 13 unit tests for `build_input_from_map`, `fix_nodes_input_from`
- `frontend/src/lib/pipelineUtils.test.js` — 12 unit tests for `buildInputFromMap`, `resolveInputFrom`
