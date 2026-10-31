from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.auth import router as auth_router
from app.api.v1.qr import router as qr_router
from app.api.v1.symptoms import router as symptoms_router
from app.api.v1.predictions import router as predictions_router
from app.api.v1.guidance import router as guidance_router
from app.api.v1.admin import router as admin_router
from app.api.v1.users import router as users_router

app = FastAPI(title="SmartAid AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8443",
        "http://localhost:8080",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:8443",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(qr_router, prefix="/api/v1")
app.include_router(symptoms_router, prefix="/api/v1")
app.include_router(predictions_router, prefix="/api/v1")
app.include_router(guidance_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "SmartAid AI backend is running"}