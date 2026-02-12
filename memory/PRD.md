# PRD — Pipeline Builder App (Noteall)

## Original Problem Statement
Web application for building and running data processing pipelines (workflows) for meeting transcription and analysis.

## Tech Stack
- **Frontend:** React, JavaScript, React Flow, TanStack Query, Shadcn UI
- **Backend:** FastAPI (Python), MongoDB (Motor async driver)
- **Auth:** JWT-based, `dmitry.bondarev@gmail.com` auto-promoted to superadmin
- **AI:** OpenAI GPT via Emergent LLM Key
- **Storage:** S3-compatible (twcstorage.ru)

## Completed Work
- Pipeline engine: batch_loop, template subtypes (user_input, format_template, batch_prompt_template)
- Pipeline validation + auto-fix
- Landing page (dark theme, real screenshots)
- Fast-track mode (auto-processing from upload to result)
- Removed GPT/Deepgram brand mentions from UI
- **Billing with RUB prices** (Feb 2026):
  - 4 packages: 1000 (no discount), 2500 (-10%), 5000 (-15%), 10000 (-20%)
  - Prices in RUB (main) + USD (secondary), rounded up to 50 RUB
  - Exchange rate fetched daily at 3am MSK via exchangerate-api.com
  - Custom credit amount (min 1000) with automatic discount tiers
  - Updated purchase dialog with RUB, discount display
  - Backend: `/api/billing/exchange-rate`, `/api/billing/calculate-custom`, updated `/api/billing/plans` with price_rub

## Key API Endpoints
- `GET /api/billing/plans` — Plans with price_rub, discount_pct
- `GET /api/billing/exchange-rate` — Current USD/RUB rate
- `POST /api/billing/calculate-custom` — Calculate custom credit amount pricing
- `POST /api/billing/topup` — Topup by plan_id or custom_credits

## P2 Backlog
- Migrate to `app.noteall.ru` (DNS CNAME)
- Landing page refinements
- Real payment integration (Stripe/YooKassa)
