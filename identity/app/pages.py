from pathlib import Path

from fastapi import Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory=Path(__file__).parent / "templates")


def render_message(
    request: Request,
    status_code: int,
    title: str,
    message: str,
    link_url: str | None = None,
    link_label: str | None = None,
) -> HTMLResponse:
    return templates.TemplateResponse(
        request,
        "message.html",
        {
            "title": title,
            "message": message,
            "link_url": link_url,
            "link_label": link_label,
            "request_id": getattr(request.state, "request_id", ""),
        },
        status_code=status_code,
    )
