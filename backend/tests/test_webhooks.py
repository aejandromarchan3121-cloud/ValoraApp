import base64
import hashlib
import json
import time
from decimal import Decimal

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from pydantic import ValidationError

from app.core.errors import WebhookAuthError
from app.models.schemas import CheckoutSessionIn, WithdrawIn
from app.services.onramp import BridgeProvider, MockProvider, sign_mock, verify_bridge_signature


@pytest.fixture(scope="module")
def keypair():
    priv = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = priv.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    return priv, pem


def bridge_header(priv, body: bytes, ts_ms: int) -> str:
    digest = hashlib.sha256(f"{ts_ms}.{body.decode()}".encode()).digest()
    sig = priv.sign(digest, padding.PKCS1v15(), hashes.SHA256())  # firma sobre SHA256(SHA256(payload))
    return f"t={ts_ms},v0={base64.b64encode(sig).decode()}"


def test_bridge_signature_ok(keypair):
    priv, pem = keypair
    body = b'{"event_id":"wh_1"}'
    verify_bridge_signature(body, bridge_header(priv, body, int(time.time() * 1000)), pem)


def test_bridge_signature_tampered_body(keypair):
    priv, pem = keypair
    ts = int(time.time() * 1000)
    h = bridge_header(priv, b'{"amount":"10"}', ts)
    with pytest.raises(WebhookAuthError):
        verify_bridge_signature(b'{"amount":"9999"}', h, pem)


def test_bridge_signature_expired(keypair):
    priv, pem = keypair
    old = int(time.time() * 1000) - 11 * 60 * 1000
    body = b"{}"
    with pytest.raises(WebhookAuthError):
        verify_bridge_signature(body, bridge_header(priv, body, old), pem)


def test_bridge_missing_header(keypair):
    with pytest.raises(WebhookAuthError):
        verify_bridge_signature(b"{}", None, keypair[1])


def test_bridge_payment_processed_is_normalized(keypair, monkeypatch):
    from app.services import onramp
    priv, pem = keypair
    monkeypatch.setattr(onramp.settings, "bridge_webhook_public_key", pem)
    body = json.dumps({
        "event_id": "wh_9", "event_category": "transfer", "event_type": "updated.status_transitioned",
        "event_object_status": "payment_processed",
        "event_object": {"id": "t_1", "state": "payment_processed", "amount": "50.0",
                         "client_reference_id": "7f0c1d9e-1b0a-4c57-9e5a-0a1b2c3d4e5f",
                         "receipt": {"final_amount": "49.5", "destination_tx_hash": "0xabc"}},
    }).encode()
    ev = BridgeProvider().parse_webhook({"x-webhook-signature": bridge_header(priv, body, int(time.time() * 1000))}, body)
    assert ev.status == "succeeded" and ev.amount == Decimal("49.5") and ev.tx_hash == "0xabc"
    assert ev.session_id == "7f0c1d9e-1b0a-4c57-9e5a-0a1b2c3d4e5f"


def test_bridge_intermediate_states_are_ignored(keypair, monkeypatch):
    from app.services import onramp
    priv, pem = keypair
    monkeypatch.setattr(onramp.settings, "bridge_webhook_public_key", pem)
    body = json.dumps({"event_id": "wh_2", "event_category": "transfer", "event_type": "updated.status_transitioned",
                       "event_object_status": "funds_received", "event_object": {}}).encode()
    ev = BridgeProvider().parse_webhook({"x-webhook-signature": bridge_header(priv, body, int(time.time() * 1000))}, body)
    assert ev.status == "ignored"


def test_mock_roundtrip_and_tamper():
    body = json.dumps({"event_id": "e1", "type": "onramp.succeeded", "session_id": "s", "amount": "25.00"}).encode()
    good = {"x-mock-signature": sign_mock(body, "test-secret")}
    assert MockProvider().parse_webhook(good, body).amount == Decimal("25.00")
    with pytest.raises(WebhookAuthError):
        MockProvider().parse_webhook(good, body.replace(b"25.00", b"2500"))
    with pytest.raises(WebhookAuthError):
        MockProvider().parse_webhook({"x-mock-signature": sign_mock(body, "otra-clave")}, body)


def test_amount_validation():
    assert CheckoutSessionIn(recipient="@ana", amount_usd="100.50").amount_usd == Decimal("100.50")
    with pytest.raises(ValidationError):
        CheckoutSessionIn(recipient="@ana", amount_usd="5")          # mínimo 10
    with pytest.raises(ValidationError):
        CheckoutSessionIn(recipient="@ana", amount_usd="10.123")     # máx. 2 decimales
    with pytest.raises(ValidationError):
        WithdrawIn(amount="10", address="0x123", network="base")     # dirección inválida
    WithdrawIn(amount="10", address="0x" + "a" * 40, network="polygon")


# ───────────── Recarga sandbox ─────────────
def _client(monkeypatch, *, enabled, prod=False):
    from fastapi.testclient import TestClient
    from app.api import wallet as wallet_api
    from app.core.security import AuthUser, get_current_user
    from app.main import app
    calls = []

    async def fake_rpc(fn, params):
        calls.append((fn, params))
        return {"status": "completed", "transaction_id": "t1", "balance": 25}

    monkeypatch.setattr(wallet_api.sb, "rpc", fake_rpc)
    monkeypatch.setattr(wallet_api.settings, "sandbox_topup_enabled", enabled)
    monkeypatch.setattr(wallet_api.settings, "env", "prod" if prod else "dev")
    app.dependency_overrides[get_current_user] = lambda: AuthUser(id="u-1", email="a@x.com")
    return TestClient(app), calls, app


H = {"Idempotency-Key": "topup-12345"}


def test_topup_disabled_by_default(monkeypatch):
    c, calls, app = _client(monkeypatch, enabled=False)
    r = c.post("/api/v1/wallet/topup-sandbox", json={"amount_usd": "25"}, headers=H)
    app.dependency_overrides.clear()
    assert r.status_code == 404 and calls == []


def test_topup_blocked_in_production_even_if_enabled(monkeypatch):
    c, calls, app = _client(monkeypatch, enabled=True, prod=True)
    r = c.post("/api/v1/wallet/topup-sandbox", json={"amount_usd": "25"}, headers=H)
    app.dependency_overrides.clear()
    assert r.status_code == 404 and calls == []


def test_topup_enabled_calls_ledger_without_card_data(monkeypatch):
    c, calls, app = _client(monkeypatch, enabled=True)
    r = c.post("/api/v1/wallet/topup-sandbox", json={"amount_usd": "25.50"}, headers=H)
    app.dependency_overrides.clear()
    assert r.status_code == 200 and r.json()["status"] == "completed"
    fn, params = calls[0]
    assert fn == "sandbox_topup" and params["p_amount"] == "25.50" and params["p_user"] == "u-1"
    assert set(params) == {"p_user", "p_amount", "p_idem"}  # nada de tarjeta


def test_topup_validates_amount_and_requires_idempotency(monkeypatch):
    c, _, app = _client(monkeypatch, enabled=True)
    assert c.post("/api/v1/wallet/topup-sandbox", json={"amount_usd": "1"}, headers=H).status_code == 422
    assert c.post("/api/v1/wallet/topup-sandbox", json={"amount_usd": "9999"}, headers=H).status_code == 422
    assert c.post("/api/v1/wallet/topup-sandbox", json={"amount_usd": "25"}).status_code == 422
    app.dependency_overrides.clear()
