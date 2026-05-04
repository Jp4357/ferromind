from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import jwt, datetime, os

router = APIRouter()

SECRET     = os.getenv("JWT_SECRET",       "ferromind-dev-secret")
ADMIN_USER = os.getenv("ADMIN_USERNAME",   "admin")
ADMIN_PASS = os.getenv("ADMIN_PASSWORD",   "admin")


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/auth/login")
def login(req: LoginRequest):
    if req.username != ADMIN_USER or req.password != ADMIN_PASS:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    payload = {
        "sub": req.username,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=24),
    }
    token = jwt.encode(payload, SECRET, algorithm="HS256")
    return {"token": token, "expires_in": 86400}
