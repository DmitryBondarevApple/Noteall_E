import uuid
import logging
from datetime import datetime, timezone
from app.core.database import db

logger = logging.getLogger(__name__)

# Model pricing (per 1M tokens) — updated for current models
MODEL_PRICING = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-4": {"input": 30.00, "output": 60.00},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
    "gpt-5.2": {"input": 2.50, "output": 10.00},
    "o1": {"input": 15.00, "output": 60.00},
    "o1-mini": {"input": 3.00, "output": 12.00},
}

DEFAULT_PRICING = {"input": 5.00, "output": 15.00}

DEFAULT_MARKUP_TIERS = [
    {"min_cost": 0.0, "max_cost": 0.001, "multiplier": 10.0},
    {"min_cost": 0.001, "max_cost": 0.01, "multiplier": 7.0},
    {"min_cost": 0.01, "max_cost": 0.10, "multiplier": 5.0},
    {"min_cost": 0.10, "max_cost": 1.00, "multiplier": 3.0},
    {"min_cost": 1.00, "max_cost": 999999.0, "multiplier": 2.0},
]


def calculate_base_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculate base USD cost from token usage."""
    pricing = MODEL_PRICING.get(model, DEFAULT_PRICING)
    input_cost = (prompt_tokens / 1_000_000) * pricing["input"]
    output_cost = (completion_tokens / 1_000_000) * pricing["output"]
    return input_cost + output_cost


async def get_markup_tiers() -> list:
    """Get markup tiers from DB, or seed defaults."""
    tiers = await db.markup_tiers.find({}, {"_id": 0}).sort("min_cost", 1).to_list(100)
    if not tiers:
        now = datetime.now(timezone.utc).isoformat()
        for tier in DEFAULT_MARKUP_TIERS:
            await db.markup_tiers.insert_one({
                "id": str(uuid.uuid4()),
                **tier,
                "created_at": now,
            })
        tiers = await db.markup_tiers.find({}, {"_id": 0}).sort("min_cost", 1).to_list(100)
    return tiers


async def apply_markup(base_cost: float) -> tuple:
    """Apply tiered markup. Returns (final_cost_usd, multiplier_used)."""
    tiers = await get_markup_tiers()
    for tier in tiers:
        if tier["min_cost"] <= base_cost < tier["max_cost"]:
            return base_cost * tier["multiplier"], tier["multiplier"]
    # Fallback: lowest multiplier
    return base_cost * 2.0, 2.0


def usd_to_credits(usd: float) -> float:
    """Convert USD to credits. 1 credit = $0.02."""
    return usd / 0.02


async def check_user_monthly_limit(user: dict) -> bool:
    """Check if user has exceeded their monthly token limit. Returns True if OK."""
    # Superadmins bypass all limits
    if user.get("role") == "superadmin":
        return True
    limit = user.get("monthly_token_limit", 0)
    if limit == 0:
        return True  # No limit

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    pipeline = [
        {"$match": {
            "user_id": user["id"],
            "created_at": {"$gte": month_start},
        }},
        {"$group": {"_id": None, "total_tokens": {"$sum": "$total_tokens"}}},
    ]
    result = await db.usage_records.aggregate(pipeline).to_list(1)
    used = result[0]["total_tokens"] if result else 0

    return used < limit


async def check_org_balance(org_id: str, user: dict = None) -> bool:
    """Check if org has positive credit balance."""
    # Superadmins bypass balance checks
    if user and user.get("role") == "superadmin":
        return True
    bal = await db.credit_balances.find_one({"org_id": org_id}, {"_id": 0})
    if not bal:
        return False
    return bal.get("balance", 0) > 0


async def deduct_credits_and_record(
    org_id: str,
    user_id: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    source: str,
) -> dict:
    """Full metering pipeline: calculate cost, apply markup, deduct credits, record usage."""
    total_tokens = prompt_tokens + completion_tokens
    base_cost = calculate_base_cost(model, prompt_tokens, completion_tokens)
    final_cost_usd, multiplier = await apply_markup(base_cost)
    credits_used = usd_to_credits(final_cost_usd)

    now = datetime.now(timezone.utc).isoformat()

    # Deduct from balance
    await db.credit_balances.update_one(
        {"org_id": org_id},
        {"$inc": {"balance": -credits_used}, "$set": {"updated_at": now}},
    )

    # Record transaction
    txn_id = str(uuid.uuid4())
    await db.transactions.insert_one({
        "id": txn_id,
        "org_id": org_id,
        "user_id": user_id,
        "type": "deduction",
        "amount": round(credits_used, 4),
        "description": f"AI: {source} ({model}, {total_tokens} токенов)",
        "created_at": now,
    })

    # Record usage for monthly limits
    await db.usage_records.insert_one({
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "user_id": user_id,
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "base_cost_usd": round(base_cost, 8),
        "markup_multiplier": multiplier,
        "final_cost_usd": round(final_cost_usd, 8),
        "credits_used": round(credits_used, 4),
        "source": source,
        "created_at": now,
    })

    logger.info(
        f"Metering: user={user_id} model={model} tokens={total_tokens} "
        f"base=${base_cost:.6f} markup={multiplier}x final=${final_cost_usd:.6f} "
        f"credits={credits_used:.4f}"
    )

    return {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "base_cost_usd": round(base_cost, 8),
        "markup_multiplier": multiplier,
        "final_cost_usd": round(final_cost_usd, 8),
        "credits_used": round(credits_used, 4),
    }
