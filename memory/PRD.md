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

### 2026-02-11: AI Pipeline input_from Fix (DONE)
- **Bug:** AI assistant generated pipelines with `input_from: null` for all nodes — nodes couldn't receive data from previous nodes
- **Fix 1 (Prompt):** Updated SYSTEM_PROMPT to explicitly require `input_from` on all nodes except the first
- **Fix 2 (Auto-fix):** Added logic to derive `input_from` from edges array in:
  - `PipelineEditorPage.jsx` handlePipelineFromChat
  - `PipelinesPage.jsx` handlePipelineFromChat
  - `pipelines.py` import_pipeline endpoint

### 2026-02-11: S3 Bucket Setup (DONE)
### 2026-02-11: AI Image Upload Bug (FIXED)
### 2026-02-11: Insufficient Credits Modal (DONE)
### 2026-02-11: Welcome Credits on Registration (DONE)

## Key Credentials
- Superadmin: admin@voiceworkspace.com / admin123
- Test user: bugtest@test.com / bugtest123

## Backlog
- No pending tasks
