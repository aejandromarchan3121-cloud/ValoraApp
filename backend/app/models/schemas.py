import re
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, field_validator

EVM_ADDRESS = re.compile(r"^0x[a-fA-F0-9]{40}$")

# Los montos viajan como STRING desde el frontend ("1234.56") para no perder precisión.
UsdAmount = Annotated[Decimal, Field(ge=Decimal("10"), le=Decimal("10000"), decimal_places=2)]
TokenAmount = Annotated[Decimal, Field(gt=0, le=Decimal("10000"), decimal_places=6)]


class CheckoutSessionIn(BaseModel):
    recipient: str = Field(min_length=3, max_length=40, description="@usuario o +teléfono")
    amount_usd: UsdAmount


class CheckoutSessionOut(BaseModel):
    session_id: str
    provider: str
    kind: Literal["bank_instructions", "redirect", "widget"]
    payload: dict[str, Any]


class InternalTransferIn(BaseModel):
    recipient: str = Field(min_length=3, max_length=40)
    amount: TokenAmount
    note: str | None = Field(default=None, max_length=140)


class WithdrawIn(BaseModel):
    amount: Annotated[Decimal, Field(ge=Decimal("5"), le=Decimal("10000"), decimal_places=6)]
    address: str
    network: Literal["base", "polygon"]

    @field_validator("address")
    @classmethod
    def valid_address(cls, v: str) -> str:
        v = v.strip()
        if not EVM_ADDRESS.match(v):
            raise ValueError("Dirección EVM inválida (0x + 40 hex).")
        return v


class CompleteWithdrawalIn(BaseModel):
    tx_hash: str = Field(min_length=10, max_length=100)


class FailWithdrawalIn(BaseModel):
    reason: str = Field(min_length=3, max_length=200)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1500)


class ChatIn(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)
    context: dict[str, Any] = Field(default_factory=dict)


class TopUpIn(BaseModel):
    """Recarga simulada. Solo el monto: los datos de tarjeta NUNCA llegan al backend."""
    amount_usd: Annotated[Decimal, Field(ge=Decimal("5"), le=Decimal("500"), decimal_places=2)]
