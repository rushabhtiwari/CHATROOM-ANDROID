from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, undefer

from app.db import get_db
from app.deps import current_user
from app.models import App, User

router = APIRouter()


@router.get("/apps/{slug}/logo")
def app_logo(slug: str, db: Session = Depends(get_db), _: User = Depends(current_user)) -> Response:
    app = db.scalar(select(App).options(undefer(App.logo)).where(App.slug == slug))
    if app is None or app.logo is None:
        raise HTTPException(404, "No logo")
    return Response(
        content=app.logo,
        media_type=app.logo_content_type,
        headers={
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'",
        },
    )
