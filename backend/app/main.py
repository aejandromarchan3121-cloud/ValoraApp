from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import onramp, transfer, p2p, ai_assistant

app = FastAPI(title="ValoraApp Fintech API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción restringir a dominios de Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(onramp.router, prefix="/api/v1/onramp", tags=["On-Ramp"])
app.include_router(transfer.router, prefix="/api/v1/transfer", tags=["Transfers"])
app.include_router(p2p.router, prefix="/api/v1/p2p", tags=["P2P VES"])
app.include_router(ai_assistant.router, prefix="/api/v1/ai", tags=["AI Advisor"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ValoraApp Core Engine"}