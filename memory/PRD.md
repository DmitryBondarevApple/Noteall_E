# Noteall — Multi-tenant SaaS Platform

## Original Problem Statement
Build a comprehensive multi-tenant SaaS application with AI features for meeting transcript analysis.

## Core Architecture
- **Backend:** FastAPI + MongoDB (Motor async driver)
- **Frontend:** React + Tailwind CSS + shadcn/ui + Recharts
- **AI:** OpenAI GPT-5.2 via Emergent LLM Key
- **Storage:** S3 (Timeweb) — currently unavailable, base64 fallback active
- **Auth:** JWT with roles (user, org_admin, superadmin)

## Completed Stages

### Stage 1: User/Organization Management (DONE)
### Stage 2: Billing & Credit System (DONE)
### Stage 3: AI Usage Metering (DONE)
### Stage 4: Admin & User Dashboards (DONE)

## Bug Fixes & Improvements

### 2026-02-11: AI Assistant Image Upload Bug (FIXED)
- **Bug:** Error when sending message with image in AI assistant (script builder)
- **Root cause:** S3 bucket `context-chat-7` unavailable (NoSuchBucket), unhandled exception on upload
- **Fix:** Wrapped S3 upload in try/catch, fallback to base64 data URL for image display. Images always sent to OpenAI via base64.
- **File:** `backend/app/routes/ai_chat.py` lines 158-178

### 2026-02-11: Insufficient Credits Modal (DONE)
- Global axios interceptor for 402 errors (`CreditsContext.js`)
- Modal popup with "Перейти в Биллинг" button (`InsufficientCreditsModal.jsx`)

### 2026-02-11: Welcome Credits on Registration (DONE)
- 100 credits given to new organizations on registration

## Key Credentials
- Superadmin: admin@voiceworkspace.com / admin123
- Test user: bugtest@test.com / bugtest123

## Backlog
- Fix S3 bucket configuration for persistent image storage
