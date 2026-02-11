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
- **Root causes found and fixed:**
  1. `processedTranscript` was passed as a full DB object → `{{text}}` resolved to `[object Object]`
  2. `batch_loop` nodes without scripts never generated `promptVars`
  3. `parse_list` nodes with Python scripts failed silently in JS runtime
  4. `ai_prompt` nodes with `input_from` couldn't use `{{text}}` to reference input data
  5. `template` nodes with `input_from` were treated as interactive stages, blocking execution
  6. `batch_loop` without AI child node couldn't make AI calls (needed template-based prompt support)
  7. Template variable resolution for multi-dep nodes (e.g., `{{short_summary}}`, `{{detailed_summary}}`)
  8. `user_review` assembly didn't detect which dep is summary vs detailed
  9. `ai_prompt` with single input_from didn't resolve custom variable names (e.g., `{{aggregated_text}}`)
  10. Transcript prop didn't fall back from processed → raw
- **Key architectural changes:**
  - Template nodes with `input_from` are now auto-processed (not interactive stages)
  - New `resolveTemplateVars()` with 3-phase matching (exact → substring → positional)
  - Batch loop handles `{ __items, __template }` input format for template-sourced prompts
  - Auto AI calls from batch loop when no child ai_prompt node exists
  - `defaultParseList()` fallback for Python/failing scripts
  - Smart summary detection in user_review using node ID/label analysis
- **Files:** `FullAnalysisTab.jsx`, `ProjectPage.js`

## Key Credentials
- Superadmin: admin@voiceworkspace.com / admin123
- Test user: bugtest@test.com / bugtest123

### 2026-02-12: user_edit_list Stage Not Populating Topics (FIXED)
- **Bug:** After AI successfully extracted topics and parse_list parsed them, the user_edit_list stage showed "Выбрано: 0 из 0" — topics never appeared in the UI
- **Root causes:**
  1. `startWizard()` never called `prepareStageUI()` for the first wizard stage — the function that populates `editableList` React state from pipeline outputs was only called in `proceedToNextStage()` (subsequent stages), not for the initial stage
  2. `prepareStageUI` was defined AFTER `startWizard` in the file, causing "Cannot access before initialization" error due to `useCallback` hoisting
- **Fix:** Added `prepareStageUI(firstStage, outputs)` call in `startWizard()` after `runAutoNodes` completes, and moved `prepareStageUI` definition before `startWizard`
- **Verified:** Wizard now shows "Выбрано: 34 из 34" with checkboxes
- **File:** `FullAnalysisTab.jsx`

## Backlog
- (пусто)

## Test Coverage
- `backend/tests/test_pipeline_utils.py` — 13 unit tests for `build_input_from_map`, `fix_nodes_input_from`
- `frontend/src/lib/pipelineUtils.test.js` — 12 unit tests for `buildInputFromMap`, `resolveInputFrom`
