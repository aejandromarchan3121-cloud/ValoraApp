from fastapi import APIRouter, Depends

from app.api.transfers import IdemKey
from app.core.config import settings
from app.core.errors import AppError
from app.core.security import AuthUser, get_current_user
from app.models.schemas import TopUpIn
from app.services import supabase as sb
from app.services.profiles import get_profile

router = APIRouter(prefix="/wallet", tags=["wallet"])


@router.get("/me")
async def my_wallet(user: AuthUser = Depends(get_current_user)):
    """Saldo + perfil público. (El dashboard web lee directo de Supabase con RLS; esto es para móvil/terceros.)"""
    rows = await sb.select("wallets", {"user_id": f"eq.{user.id}", "select": "usdc_balance,usdt_balance,status"})
    if not rows:
        raise AppError(404, "WALLET_NOT_FOUND", "Billetera no encontrada.")
    p = await get_profile(user.id)
    return {"wallet": rows[0], "profile": {"username": p.get("username"), "full_name": p.get("full_name"),
                                           "is_verified": p.get("is_verified")}}


@router.post("/topup-sandbox")
async def topup_sandbox(body: TopUpIn, idempotency_key: IdemKey, user: AuthUser = Depends(get_current_user)):
    """Acredita USDC 1:1 por un cobro SIMULADO (solo desarrollo). No procesa ninguna tarjeta real."""
    if settings.is_prod or not settings.sandbox_topup_enabled:
        raise AppError(404, "NOT_AVAILABLE", "Función no disponible.")
    if body.amount_usd > settings.sandbox_topup_max_usd:
        raise AppError(400, "LIMIT_EXCEEDED", f"Máximo {settings.sandbox_topup_max_usd} USD en modo prueba.")
    return await sb.rpc("sandbox_topup", {"p_user": user.id, "p_amount": str(body.amount_usd), "p_idem": idempotency_key})
