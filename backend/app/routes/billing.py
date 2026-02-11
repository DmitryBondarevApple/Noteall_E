import uuid
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
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

DEFAULT_PLAN = {
    "id": "plan_default_1000",
    "name": "$20 / 1000 кредитов",
    "price_usd": 20.0,
    "credits": 1000,
    "is_active": True,
}


async def ensure_default_plan():
    """Seed the default tariff plan if not exists."""
    existing = await db.tariff_plans.find_one({"id": DEFAULT_PLAN["id"]})
    if not existing:
        now = datetime.now(timezone.utc).isoformat()
        await db.tariff_plans.insert_one({**DEFAULT_PLAN, "created_at": now})


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


# ── Tariff Plans ──

@router.get("/plans")
async def list_plans(user=Depends(get_current_user)):
    await ensure_default_plan()
    plans = await db.tariff_plans.find({"is_active": True}, {"_id": 0}).to_list(100)
    return plans


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


from pydantic import BaseModel as _BM


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

