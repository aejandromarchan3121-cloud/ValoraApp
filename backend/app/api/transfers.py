from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel, condecimal
import hmac
import hashlib
import os

router = APIRouter()

class CheckoutRequest(BaseModel):
    user_id: str
    amount: condecimal(max_digits=12, decimal_places=2) # type: ignore

@router.post("/checkout-session")
def create_checkout_session(payload: CheckoutRequest):
    # Integración simulada con Bridge.xyz / Stripe API para generar pasarela USD
    try:
        external_checkout_url = f"https://checkout.bridge.xyz/pay?amount={payload.amount}&customer={payload.user_id}"
        return {"checkout_url": external_checkout_url, "status": "PENDING"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def onramp_webhook(request: Request, x_signature: str = Header(None)):
    body = await request.body()
    secret = os.getenv("WEBHOOK_SECRET", "whsec_test").encode()
    
    # Validación criptográfica de la firma del webhook
    computed_sig = hmac.new(secret, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed_sig, x_signature or ""):
        raise HTTPException(status_code=403, detail="Firma de webhook inválida")
    
    event_data = await request.json()
    # Lógica para acreditar saldo USDC en Supabase y actualizar Caja de Liquidez
    return {"status": "success", "processed": True}