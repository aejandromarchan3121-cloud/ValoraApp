from decimal import Decimal
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "dev"
    allowed_origins: str = "http://localhost:5173"

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    onramp_provider: str = "mock"  # mock | bridge
    mock_webhook_secret: str = "dev-only-change-me"
    bridge_api_key: str = ""
    bridge_base_url: str = "https://api.bridge.xyz"
    bridge_webhook_public_key: str = ""
    bridge_destination_rail: str = "base"
    treasury_address: str = ""

    # Recarga simulada con tarjeta: SOLO pruebas. Apagada por defecto y bloqueada en producción.
    sandbox_topup_enabled: bool = False
    sandbox_topup_max_usd: Decimal = Decimal("500")

    admin_api_key: str = ""
    max_transfer_usd: Decimal = Decimal("1000")
    max_withdraw_daily_usd: Decimal = Decimal("500")

    ai_provider: str = "anthropic"
    anthropic_api_key: str = ""
    ai_model: str = "claude-haiku-5-5"  # configurable: los IDs de modelo cambian con frecuencia
    ai_daily_limit: int = 60

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    @property
    def is_prod(self) -> bool:
        return self.env.lower() in {"prod", "production"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
