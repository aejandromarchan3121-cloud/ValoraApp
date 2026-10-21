from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import transfers

app = FastAPI(title="ValoraApp Fintech API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción restringir a dominios de Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transfers.router, prefix="/api/v1/onramp", tags=["On-Ramp"])

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ValoraApp Core Engine"}