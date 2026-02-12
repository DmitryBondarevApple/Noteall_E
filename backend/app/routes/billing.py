import uuid
import logging
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.core.database import db
from app.core.security import get_current_user, get_admin_user, get_superadmin_user
from app.models.billing import (
    TariffPlanResponse,
    CreditBalanceResponse,
    TransactionResponse,
    TopupRequest,
    AdminBalanceResponse,
)

router = APIRouter(prefix="/billing", tags=["billing"])
logger = logging.getLogger(__name__)

BASE_PRICE_PER_CREDIT_USD = 0.02  # $20 / 1000 credits

DEFAULT_PLANS = [
    {"id": "plan_1000", "name": "1 000 кредитов", "credits": 1000, "discount_pct": 0, "is_active": True},
    {"id": "plan_2500", "name": "2 500 кредитов", "credits": 2500, "discount_pct": 10, "is_active": True},
    {"id": "plan_5000", "name": "5 000 кредитов", "credits": 5000, "discount_pct": 15, "is_active": True},
    {"id": "plan_10000", "name": "10 000 кредитов", "credits": 10000, "discount_pct": 20, "is_active": True},
]


async def ensure_default_plan():
    """Seed all tariff plans."""
    for plan in DEFAULT_PLANS:
        existing = await db.tariff_plans.find_one({"id": plan["id"]})
        if not existing:
            now = datetime.now(timezone.utc).isoformat()
            price_usd = round(plan["credits"] * BASE_PRICE_PER_CREDIT_USD * (1 - plan["discount_pct"] / 100), 2)
            await db.tariff_plans.insert_one({**plan, "price_usd": price_usd, "created_at": now})
        else:
            price_usd = round(plan["credits"] * BASE_PRICE_PER_CREDIT_USD * (1 - plan["discount_pct"] / 100), 2)
            await db.tariff_plans.update_one(
                {"id": plan["id"]},
                {"$set": {"discount_pct": plan["discount_pct"], "price_usd": price_usd, "name": plan["name"]}}
            )
    # Deactivate old plan
    await db.tariff_plans.update_one({"id": "plan_default_1000"}, {"$set": {"is_active": False}})


def round_up_50(rub_amount):
    """Round up to the nearest 50 RUB."""
    import math
    return int(math.ceil(rub_amount / 50) * 50)


def get_discount_pct(credits):
    """Get discount percent based on credit amount."""
    if credits >= 10000:
        return 20
    if credits >= 5000:
        return 15
    if credits >= 2500:
        return 10
    return 0


async def get_exchange_rate():
    """Get cached USD/RUB exchange rate from DB."""
    rate_doc = await db.exchange_rates.find_one({"currency": "USD_RUB"}, {"_id": 0})
    if rate_doc:
        return rate_doc.get("rate", 92.5)
    return 92.5  # fallback


async def update_exchange_rate():
    """Fetch current USD/RUB rate and store in DB."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get("https://api.exchangerate-api.com/v4/latest/USD")
            data = resp.json()
            rate = data.get("rates", {}).get("RUB", 92.5)
    except Exception as e:
        logger.warning(f"Failed to fetch exchange rate: {e}")
        return

    now = datetime.now(timezone.utc).isoformat()
    await db.exchange_rates.update_one(
        {"currency": "USD_RUB"},
        {"$set": {"rate": rate, "updated_at": now}},
        upsert=True
    )
    logger.info(f"Exchange rate updated: 1 USD = {rate} RUB")


async def get_or_create_balance(org_id: str) -> dict:
    """Get credit balance for org, create if not exists."""
    bal = await db.credit_balances.find_one({"org_id": org_id}, {"_id": 0})
    if not bal:
        now = datetime.now(timezone.utc).isoformat()
        bal = {
            "org_id": org_id,
            "balance": 0.0,
            "updated_at": now,
        }
        await db.credit_balances.insert_one(bal)
        bal = await db.credit_balances.find_one({"org_id": org_id}, {"_id": 0})
    return bal


# ── Exchange Rate ──

@router.get("/exchange-rate")
async def get_rate(user=Depends(get_current_user)):
    rate = await get_exchange_rate()
    rate_doc = await db.exchange_rates.find_one({"currency": "USD_RUB"}, {"_id": 0})
    return {
        "rate": rate,
        "updated_at": rate_doc.get("updated_at") if rate_doc else None,
    }


# ── Tariff Plans ──

@router.get("/plans")
async def list_plans(user=Depends(get_current_user)):
    await ensure_default_plan()
    plans = await db.tariff_plans.find({"is_active": True}, {"_id": 0}).to_list(100)
    rate = await get_exchange_rate()
    for plan in plans:
        plan["price_rub"] = round_up_50(plan["price_usd"] * rate)
        plan["discount_pct"] = plan.get("discount_pct", 0)
    return plans


# ── Custom Topup Calculation ──

class CustomTopupCalc(BaseModel):
    credits: int

@router.post("/calculate-custom")
async def calculate_custom_topup(data: CustomTopupCalc, user=Depends(get_current_user)):
    if data.credits < 1000:
        raise HTTPException(status_code=400, detail="Минимум 1000 кредитов")
    discount = get_discount_pct(data.credits)
    price_usd = round(data.credits * BASE_PRICE_PER_CREDIT_USD * (1 - discount / 100), 2)
    rate = await get_exchange_rate()
    price_rub = round_up_50(price_usd * rate)
    return {
        "credits": data.credits,
        "discount_pct": discount,
        "price_usd": price_usd,
        "price_rub": price_rub,
    }


# ── Credit Balance ──

@router.get("/balance", response_model=CreditBalanceResponse)
async def get_balance(user=Depends(get_current_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")

    bal = await get_or_create_balance(org_id)
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0, "name": 1})
    org_name = org["name"] if org else "Unknown"

    return CreditBalanceResponse(
        org_id=org_id,
        org_name=org_name,
        balance=bal["balance"],
        updated_at=bal["updated_at"],
    )


# ── Transactions ──

@router.get("/transactions")
async def list_transactions(
    limit: int = 50,
    skip: int = 0,
    user=Depends(get_current_user),
):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")

    txns = (
        await db.transactions.find({"org_id": org_id}, {"_id": 0})
        .sort("created_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    total = await db.transactions.count_documents({"org_id": org_id})

    # Enrich with user names
    user_ids = list({t.get("user_id") for t in txns if t.get("user_id")})
    user_map = {}
    if user_ids:
        users = await db.users.find(
            {"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1}
        ).to_list(len(user_ids))
        user_map = {u["id"]: u["name"] for u in users}

    result = []
    for t in txns:
        result.append(
            TransactionResponse(
                id=t["id"],
                org_id=t["org_id"],
                user_id=t.get("user_id"),
                user_name=user_map.get(t.get("user_id")),
                type=t["type"],
                amount=t["amount"],
                description=t["description"],
                created_at=t["created_at"],
            )
        )

    return {"items": result, "total": total}


# ── Mock Topup ──

@router.post("/topup")
async def topup_credits(data: TopupRequest, user=Depends(get_admin_user)):
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")

    # Find plan
    plan = await db.tariff_plans.find_one({"id": data.plan_id, "is_active": True}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Tariff plan not found")

    now = datetime.now(timezone.utc).isoformat()

    # Update balance
    bal = await get_or_create_balance(org_id)
    new_balance = bal["balance"] + plan["credits"]
    await db.credit_balances.update_one(
        {"org_id": org_id},
        {"$set": {"balance": new_balance, "updated_at": now}},
    )

    # Create transaction record
    txn = {
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "user_id": user["id"],
        "type": "topup",
        "amount": plan["credits"],
        "description": f"Покупка: {plan['name']} (${plan['price_usd']})",
        "created_at": now,
    }
    await db.transactions.insert_one(txn)

    logger.info(f"Topup: org={org_id} plan={plan['id']} credits={plan['credits']} new_balance={new_balance}")

    return {
        "message": f"Начислено {plan['credits']} кредитов",
        "balance": new_balance,
        "transaction_id": txn["id"],
    }


# ── Superadmin: All Balances ──

@router.get("/admin/balances")
async def admin_list_balances(admin=Depends(get_superadmin_user)):
    orgs = await db.organizations.find({}, {"_id": 0}).to_list(1000)
    result = []
    for org in orgs:
        bal = await get_or_create_balance(org["id"])

        # Aggregate totals
        pipeline_topup = [
            {"$match": {"org_id": org["id"], "type": "topup"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        pipeline_deduction = [
            {"$match": {"org_id": org["id"], "type": "deduction"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
        ]
        topup_agg = await db.transactions.aggregate(pipeline_topup).to_list(1)
        deduction_agg = await db.transactions.aggregate(pipeline_deduction).to_list(1)

        total_topups = topup_agg[0]["total"] if topup_agg else 0.0
        total_deductions = deduction_agg[0]["total"] if deduction_agg else 0.0

        result.append(
            AdminBalanceResponse(
                org_id=org["id"],
                org_name=org["name"],
                balance=bal["balance"],
                total_topups=total_topups,
                total_deductions=total_deductions,
                updated_at=bal["updated_at"],
            )
        )

    return result


# ── Markup Tiers (Superadmin) ──

from app.services.metering import get_markup_tiers as _get_tiers


class MarkupTierUpdate(BaseModel):
    tiers: list  # [{min_cost, max_cost, multiplier}, ...]


@router.get("/admin/markup-tiers")
async def get_markup_tiers(admin=Depends(get_superadmin_user)):
    tiers = await _get_tiers()
    return tiers


@router.put("/admin/markup-tiers")
async def update_markup_tiers(data: MarkupTierUpdate, admin=Depends(get_superadmin_user)):
    if not data.tiers:
        raise HTTPException(status_code=400, detail="Tiers cannot be empty")

    # Validate tiers
    for t in data.tiers:
        if "min_cost" not in t or "max_cost" not in t or "multiplier" not in t:
            raise HTTPException(status_code=400, detail="Each tier must have min_cost, max_cost, multiplier")
        if t["multiplier"] < 1:
            raise HTTPException(status_code=400, detail="Multiplier must be >= 1")

    now = datetime.now(timezone.utc).isoformat()

    # Replace all tiers
    await db.markup_tiers.delete_many({})
    for t in data.tiers:
        await db.markup_tiers.insert_one({
            "id": str(uuid.uuid4()),
            "min_cost": t["min_cost"],
            "max_cost": t["max_cost"],
            "multiplier": t["multiplier"],
            "created_at": now,
        })

    return {"message": "Markup tiers updated", "count": len(data.tiers)}


# ── Usage Stats ──

@router.get("/usage/my")
async def get_my_usage(user=Depends(get_current_user)):
    """Get current user's usage stats for current month."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    pipeline = [
        {"$match": {"user_id": user["id"], "created_at": {"$gte": month_start}}},
        {"$group": {
            "_id": None,
            "total_tokens": {"$sum": "$total_tokens"},
            "total_credits": {"$sum": "$credits_used"},
            "total_requests": {"$sum": 1},
        }},
    ]
    result = await db.usage_records.aggregate(pipeline).to_list(1)
    stats = result[0] if result else {"total_tokens": 0, "total_credits": 0, "total_requests": 0}
    stats.pop("_id", None)
    stats["monthly_token_limit"] = user.get("monthly_token_limit", 0)

    return stats


@router.get("/admin/usage")
async def admin_usage_stats(org_id: str = None, admin=Depends(get_superadmin_user)):
    """Get usage stats per org or platform-wide."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    match = {"created_at": {"$gte": month_start}}
    if org_id:
        match["org_id"] = org_id

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$org_id",
            "total_tokens": {"$sum": "$total_tokens"},
            "total_credits": {"$sum": "$credits_used"},
            "total_requests": {"$sum": 1},
        }},
    ]
    results = await db.usage_records.aggregate(pipeline).to_list(1000)

    # Enrich with org names
    org_ids = [r["_id"] for r in results if r["_id"]]
    org_map = {}
    if org_ids:
        orgs = await db.organizations.find({"id": {"$in": org_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(len(org_ids))
        org_map = {o["id"]: o["name"] for o in orgs}

    return [
        {
            "org_id": r["_id"],
            "org_name": org_map.get(r["_id"], "Unknown"),
            "total_tokens": r["total_tokens"],
            "total_credits": round(r["total_credits"], 4),
            "total_requests": r["total_requests"],
        }
        for r in results
    ]


# ── Org-level per-user usage (org_admin) ──

@router.get("/usage/org-users")
async def org_users_usage(user=Depends(get_admin_user)):
    """Get per-user usage stats within the current org for the current month."""
    org_id = user.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail="No organization")

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    pipeline = [
        {"$match": {"org_id": org_id, "created_at": {"$gte": month_start}}},
        {"$group": {
            "_id": "$user_id",
            "total_tokens": {"$sum": "$total_tokens"},
            "total_credits": {"$sum": "$credits_used"},
            "total_requests": {"$sum": 1},
        }},
        {"$sort": {"total_credits": -1}},
    ]
    results = await db.usage_records.aggregate(pipeline).to_list(1000)

    # Enrich with user info
    user_ids = [r["_id"] for r in results if r["_id"]]
    user_map = {}
    if user_ids:
        users = await db.users.find(
            {"id": {"$in": user_ids}},
            {"_id": 0, "id": 1, "name": 1, "email": 1, "monthly_token_limit": 1},
        ).to_list(len(user_ids))
        user_map = {u["id"]: u for u in users}

    # Also include org users with zero usage
    all_org_users = await db.users.find(
        {"org_id": org_id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "monthly_token_limit": 1},
    ).to_list(1000)
    users_with_data = {r["_id"] for r in results}

    output = []
    for r in results:
        u = user_map.get(r["_id"], {})
        output.append({
            "user_id": r["_id"],
            "name": u.get("name", "Unknown"),
            "email": u.get("email", ""),
            "total_tokens": r["total_tokens"],
            "total_credits": round(r["total_credits"], 4),
            "total_requests": r["total_requests"],
            "monthly_token_limit": u.get("monthly_token_limit", 0),
        })

    # Add users with no usage this month
    for u in all_org_users:
        if u["id"] not in users_with_data:
            output.append({
                "user_id": u["id"],
                "name": u.get("name", "Unknown"),
                "email": u.get("email", ""),
                "total_tokens": 0,
                "total_credits": 0,
                "total_requests": 0,
                "monthly_token_limit": u.get("monthly_token_limit", 0),
            })

    return output


# ── Superadmin platform summary ──

@router.get("/admin/summary")
async def admin_platform_summary(admin=Depends(get_superadmin_user)):
    """Get platform-wide summary metrics."""
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Total topups ever
    topup_pipeline = [
        {"$match": {"type": "topup"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    topup_result = await db.transactions.aggregate(topup_pipeline).to_list(1)
    total_topups = topup_result[0]["total"] if topup_result else 0

    # Total deductions ever
    deduct_pipeline = [
        {"$match": {"type": "deduction"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    deduct_result = await db.transactions.aggregate(deduct_pipeline).to_list(1)
    total_deductions = deduct_result[0]["total"] if deduct_result else 0

    # This month usage
    month_pipeline = [
        {"$match": {"created_at": {"$gte": month_start}}},
        {"$group": {
            "_id": None,
            "total_tokens": {"$sum": "$total_tokens"},
            "total_credits": {"$sum": "$credits_used"},
            "total_requests": {"$sum": 1},
        }},
    ]
    month_result = await db.usage_records.aggregate(month_pipeline).to_list(1)
    month_stats = month_result[0] if month_result else {"total_tokens": 0, "total_credits": 0, "total_requests": 0}
    month_stats.pop("_id", None)

    org_count = await db.organizations.count_documents({})
    user_count = await db.users.count_documents({})

    return {
        "total_topups_credits": round(total_topups, 2),
        "total_deductions_credits": round(total_deductions, 4),
        "total_revenue_usd": round(total_topups * 0.02, 2),
        "month_tokens": month_stats.get("total_tokens", 0),
        "month_credits": round(month_stats.get("total_credits", 0), 4),
        "month_requests": month_stats.get("total_requests", 0),
        "org_count": org_count,
        "user_count": user_count,
    }


# ── Org Detail (Superadmin) ──

class AdminTopupRequest(BaseModel):
    org_id: str
    amount: float
    description: str = ""


@router.get("/admin/org/{org_id}")
async def admin_org_detail(org_id: str, admin=Depends(get_superadmin_user)):
    """Get detailed org info: users, balance, transactions, monthly usage chart, top users."""
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Users
    users = await db.users.find(
        {"org_id": org_id},
        {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1, "created_at": 1, "monthly_token_limit": 1},
    ).to_list(1000)

    # Balance
    from app.routes.billing import get_or_create_balance
    bal = await get_or_create_balance(org_id)

    # Transactions (last 100)
    txns = await db.transactions.find(
        {"org_id": org_id}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)

    # Enrich txn user names
    user_ids = list({t.get("user_id") for t in txns if t.get("user_id")})
    user_map = {}
    if user_ids:
        ulist = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1}).to_list(len(user_ids))
        user_map = {u["id"]: u["name"] for u in ulist}
    for t in txns:
        t["user_name"] = user_map.get(t.get("user_id"))

    # Totals
    topup_agg = await db.transactions.aggregate([
        {"$match": {"org_id": org_id, "type": "topup"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    deduct_agg = await db.transactions.aggregate([
        {"$match": {"org_id": org_id, "type": "deduction"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    total_topups = topup_agg[0]["total"] if topup_agg else 0
    total_deductions = deduct_agg[0]["total"] if deduct_agg else 0

    # Monthly usage chart (last 12 months)
    monthly_pipeline = [
        {"$match": {"org_id": org_id}},
        {"$addFields": {"month": {"$substr": ["$created_at", 0, 7]}}},
        {"$group": {
            "_id": "$month",
            "credits": {"$sum": "$credits_used"},
            "tokens": {"$sum": "$total_tokens"},
            "requests": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
        {"$limit": 12},
    ]
    monthly_data = await db.usage_records.aggregate(monthly_pipeline).to_list(12)
    monthly_chart = [
        {"month": m["_id"], "credits": round(m["credits"], 4), "tokens": m["tokens"], "requests": m["requests"]}
        for m in monthly_data
    ]

    # Avg monthly spend
    if monthly_chart:
        avg_monthly = sum(m["credits"] for m in monthly_chart) / len(monthly_chart)
    else:
        avg_monthly = 0

    # Top users by credit usage
    top_users_pipeline = [
        {"$match": {"org_id": org_id}},
        {"$group": {
            "_id": "$user_id",
            "credits": {"$sum": "$credits_used"},
            "tokens": {"$sum": "$total_tokens"},
            "requests": {"$sum": 1},
        }},
        {"$sort": {"credits": -1}},
        {"$limit": 10},
    ]
    top_users_data = await db.usage_records.aggregate(top_users_pipeline).to_list(10)
    all_user_map = {u["id"]: u for u in users}
    top_users = [
        {
            "user_id": t["_id"],
            "name": all_user_map.get(t["_id"], {}).get("name", "Unknown"),
            "credits": round(t["credits"], 4),
            "tokens": t["tokens"],
            "requests": t["requests"],
        }
        for t in top_users_data
    ]

    # Total AI requests & avg cost
    total_reqs_agg = await db.usage_records.aggregate([
        {"$match": {"org_id": org_id}},
        {"$group": {
            "_id": None,
            "total_requests": {"$sum": 1},
            "total_credits": {"$sum": "$credits_used"},
            "total_tokens": {"$sum": "$total_tokens"},
        }},
    ]).to_list(1)
    total_stats = total_reqs_agg[0] if total_reqs_agg else {"total_requests": 0, "total_credits": 0, "total_tokens": 0}
    total_stats.pop("_id", None)
    avg_request_cost = round(total_stats["total_credits"] / total_stats["total_requests"], 4) if total_stats["total_requests"] > 0 else 0

    return {
        "org": org,
        "users": users,
        "balance": bal["balance"],
        "balance_updated_at": bal["updated_at"],
        "transactions": txns,
        "total_topups": round(total_topups, 2),
        "total_deductions": round(total_deductions, 4),
        "monthly_chart": monthly_chart,
        "avg_monthly_spend": round(avg_monthly, 4),
        "top_users": top_users,
        "total_requests": total_stats["total_requests"],
        "total_tokens": total_stats["total_tokens"],
        "total_credits_spent": round(total_stats["total_credits"], 4),
        "avg_request_cost": avg_request_cost,
    }


@router.post("/admin/topup")
async def admin_topup_org(data: AdminTopupRequest, admin=Depends(get_superadmin_user)):
    """Superadmin: manually add credits to any org."""
    org = await db.organizations.find_one({"id": data.org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    now = datetime.now(timezone.utc).isoformat()
    bal = await get_or_create_balance(data.org_id)
    new_balance = bal["balance"] + data.amount

    await db.credit_balances.update_one(
        {"org_id": data.org_id},
        {"$set": {"balance": new_balance, "updated_at": now}},
    )

    desc = data.description or f"Ручное пополнение (суперадмин)"
    txn = {
        "id": str(uuid.uuid4()),
        "org_id": data.org_id,
        "user_id": admin["id"],
        "type": "topup",
        "amount": data.amount,
        "description": desc,
        "created_at": now,
    }
    await db.transactions.insert_one(txn)

    logger.info(f"Admin topup: org={data.org_id} amount={data.amount} by={admin['id']}")
    return {"message": f"Начислено {data.amount} кредитов", "balance": new_balance}

