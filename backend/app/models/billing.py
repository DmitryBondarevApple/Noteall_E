from pydantic import BaseModel
from typing import Optional, List


class TariffPlanResponse(BaseModel):
    id: str
    name: str
    price_usd: float
    credits: int
    is_active: bool
    created_at: str


class CreditBalanceResponse(BaseModel):
    org_id: str
    org_name: str
    balance: float
    updated_at: str


class TransactionResponse(BaseModel):
    id: str
    org_id: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    type: str  # topup | deduction
    amount: float
    description: str
    created_at: str


class TopupRequest(BaseModel):
    plan_id: Optional[str] = None
    custom_credits: Optional[int] = None


class AdminBalanceResponse(BaseModel):
    org_id: str
    org_name: str
    balance: float
    total_topups: float
    total_deductions: float
    updated_at: str
