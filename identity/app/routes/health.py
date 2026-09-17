from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import SigningKey

router = APIRouter()


@router.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@router.get("/readyz")
def readyz(db: Session = Depends(get_db)) -> JSONResponse:
    try:
        db.execute(text("SELECT 1"))
        active = db.scalar(select(SigningKey.kid).where(SigningKey.retired_at.is_(None)))
    except Exception:
        return JSONResponse({"status": "unavailable", "database": False}, status_code=503)
    if active is None:
        return JSONResponse({"status": "unavailable", "signing_key": False}, status_code=503)
    return JSONResponse({"status": "ok"})
