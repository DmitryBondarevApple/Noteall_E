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
- Transactions history, tariff plans
- Welcome credits (100) on registration

### Stage 3: AI Usage Metering (DONE)
- Token counting with tiktoken
- Tiered markup system
- Credit deduction for all AI calls

### Stage 4: Admin & User Dashboards (DONE)
- Org admin dashboard, superadmin platform dashboard
- Credit balance widget in sidebar
- Organization detail modal

## Bug Fixes & Improvements

### 2026-02-11: AI Assistant Bug Fix
- **Root cause:** Organizations had 0 credit balance blocking AI calls
- **Fix:** Welcome credits on registration + existing orgs topped up

### 2026-02-11: Insufficient Credits Modal
- **Feature:** Global modal popup when any AI call fails due to insufficient credits (402)
- **Implementation:** 
  - `CreditsContext.js` — global context with axios 402 interceptor
  - `InsufficientCreditsModal.jsx` — modal with "Перейти в Биллинг" button
  - Applied across ALL AI call points: AiChatPanel, AnalysisTab, ResultsTab, FullAnalysisTab, NodeConfigPanel, DocProjectPage

## Key Credentials
- Superadmin: admin@voiceworkspace.com / admin123
- Test user: bugtest@test.com / bugtest123

## Backlog
- No pending tasks
