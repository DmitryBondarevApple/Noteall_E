# Noteall — Multi-tenant SaaS Platform

## Original Problem Statement
Build a comprehensive multi-tenant SaaS application with AI features for meeting transcript analysis.

## Core Architecture
- **Backend:** FastAPI + MongoDB (Motor async driver)
- **Frontend:** React + Tailwind CSS + shadcn/ui + Recharts
- **AI:** OpenAI GPT-5.2 via Emergent LLM Key
- **Storage:** S3 (Timeweb) for file attachments
- **Auth:** JWT with roles (user, org_admin, superadmin)

## Completed Stages

### Stage 1: User/Organization Management (DONE)
- Registration, login, JWT auth
- Organizations with roles
- Invitations system

### Stage 2: Billing & Credit System (DONE)
- Credit balances per organization
- Transactions history
- Tariff plans
- Welcome credits (100) on registration

### Stage 3: AI Usage Metering (DONE)
- Token counting with tiktoken
- Tiered markup system
- Credit deduction for all AI calls
- Monthly token limits per user

### Stage 4: Admin & User Dashboards (DONE)
- Org admin dashboard (team usage)
- Superadmin platform dashboard
- Credit balance widget in sidebar
- Organization detail modal

## Bug Fixes
### 2026-02-11: AI Assistant in Script Builder (FIXED)
- **Bug:** "Error sending message from AI assistant in script builder"
- **Root cause:** Organizations had 0 credit balance after billing system was added
- **Fix:** 
  1. Added 100 welcome credits on new org registration
  2. Topped up all existing orgs with 0 balance
  3. Improved 402 error handling in frontend

## Key Credentials
- Superadmin: admin@voiceworkspace.com / admin123
- Test user: bugtest@test.com / bugtest123

## Backlog
- No pending tasks. All planned stages completed.
