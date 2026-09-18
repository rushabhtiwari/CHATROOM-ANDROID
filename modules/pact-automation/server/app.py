"""KPAC - Kiran Pact Automation System.

FastAPI backend + the single-page console. Run via scripts\\start.ps1 or:
    python -m uvicorn server.app:app --host 127.0.0.1 --port 8765
"""
import csv, io, os, sys, time
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from server import db, preflight, report, worker  # noqa: E402
from robot.fill import load_profile  # noqa: E402

app = FastAPI(title="KPAC - Kiran Pact Automation System")
STATIC = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.on_event("startup")
def _startup():
    db.init()
    worker.start()


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/assets/logo.png")
def logo():
    p = ROOT / "assets" / "logo.png"
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(p)


def _profile():
    return load_profile(worker.settings.profile_name)


# --------------------------------------------------------------------------- status
@app.get("/api/status")
def status():
    st = worker.state()
    try:
        prof = _profile()
        st["fields"] = [{"key": k,
                         "label": prof.get("verify_labels", {}).get(k, k),
                         "type": v.get("type", "edit"),
                         "required": bool(v.get("required")),
                         "options": v.get("options"),
                         "tab": v.get("tab")}
                        for k, v in prof["fields"].items()]
        st["has_grid"] = bool(prof.get("grid"))
        st["profile_ok"] = True
    except Exception as e:
        st["fields"] = []; st["has_grid"] = False
        st["profile_ok"] = False; st["profile_error"] = str(e)
    st["kpis"] = db.kpis()
    return st


@app.post("/api/settings/reload")
def reload_settings():
    worker.settings.reload()
    return worker.settings.as_dict()


# --------------------------------------------------------------------------- entries (unchanged API)
@app.get("/api/entries")
def entries(limit: int = 500):
    return db.list_all(limit)


class NewEntry(BaseModel):
    record: dict
    source: str = "manual"


@app.post("/api/entries")
def create(e: NewEntry):
    if not e.record:
        raise HTTPException(400, "empty record")
    eid = db.add(e.record, e.source)
    return db.get(eid)


@app.post("/api/entries/import")
async def import_csv(file: UploadFile = File(...), auto: bool = False):
    """Legacy import used by cli.py and the OpenClaw skill: queue every row, optionally
    approve them straight away. Prefer /api/batches/upload for the pre-flight + batch flow."""
    rows = preflight.parse(file.filename, await file.read())
    ids = [db.add(r["record"], source=f"csv:{file.filename}") for r in rows]
    if auto:
        for i in ids:
            db.set_status(i, "approved"); db.append_log(i, "auto-approved on import")
    return {"imported": len(ids), "ids": ids, "auto": auto}


@app.post("/api/entries/approve-all")
def approve_all():
    n = 0
    for e in db.list_all():
        if e["status"] == "pending":
            db.set_status(e["id"], "approved", error=""); db.append_log(e["id"], "approved (approve all)"); n += 1
    return {"approved": n}


@app.post("/api/entries/{eid}/approve")
def approve(eid: int):
    e = db.get(eid)
    if not e:
        raise HTTPException(404)
    if e["status"] not in ("pending", "failed", "rejected", "skipped"):
        raise HTTPException(409, f"cannot approve from status {e['status']}")
    db.set_status(eid, "approved", error="")
    db.append_log(eid, "approved on page")
    return db.get(eid)


@app.post("/api/entries/{eid}/reject")
def reject(eid: int):
    if not db.get(eid):
        raise HTTPException(404)
    db.set_status(eid, "rejected")
    return db.get(eid)


@app.post("/api/entries/{eid}/save")
def save_now(eid: int):
    e = db.get(eid)
    if not e or e["status"] != "awaiting_save":
        raise HTTPException(409, "entry is not awaiting save")
    if worker.settings.dry_run:
        raise HTTPException(409, "DRY_RUN is on; set DRY_RUN=false in .env and reload settings")
    worker.request_save(eid)
    return {"ok": True}


@app.delete("/api/entries/{eid}")
def remove(eid: int):
    db.delete(eid)
    return {"ok": True}


@app.get("/api/entries/{eid}/screenshot")
def screenshot(eid: int):
    e = db.get(eid)
    name = (e or {}).get("result", {}).get("screenshot")
    p = ROOT / "verifier" / "screenshots" / name if name else None
    if not p or not p.exists():
        raise HTTPException(404)
    return FileResponse(p)


# --------------------------------------------------------------------------- batches
@app.post("/api/batches/upload")
async def upload_batch(file: UploadFile = File(...), name: str = Form("")):
    """Parse a CSV/XLSX, run pre-flight against the active profile, and park the rows in a
    draft batch. NOTHING runs until /api/batches/{id}/start."""
    data = await file.read()
    try:
        rows = preflight.parse(file.filename, data)
    except Exception as e:
        raise HTTPException(400, f"could not read {file.filename}: {e}")
    if not rows:
        raise HTTPException(400, "the file has no data rows")
    try:
        prof = _profile()
    except Exception as e:
        raise HTTPException(500, f"profile {worker.settings.profile_name!r} could not be loaded: {e}")

    checked = preflight.validate(rows, prof)
    bid = db.create_batch(name or file.filename or f"batch {time.strftime('%d %b %H:%M')}",
                          source=file.filename or "", profile=worker.settings.profile_name)
    for r in checked:
        db.add(r["record"], source=f"batch:{bid}", batch_id=bid, row_no=r["row_no"],
               warnings=r["warnings"] + [f"BLOCKING: {x}" for x in r["errors"]])
    return get_batch(bid)


@app.get("/api/batches")
def list_batches(limit: int = 50):
    out = []
    for b in db.list_batches(limit):
        out.append({**b, "counts": db.batch_counts(b["id"])})
    return out


@app.get("/api/batches/{bid}")
def get_batch(bid: int):
    b = worker.batch_progress(bid)
    if not b:
        raise HTTPException(404)
    entries = db.list_for_batch(bid)
    prof_fields = []
    try:
        prof_fields = list(_profile()["fields"])
    except Exception:
        pass
    b["entries"] = [{
        "id": e["id"], "row_no": e["row_no"], "status": e["status"], "record": e["record"],
        "errors": [w[10:] for w in e["warnings"] if w.startswith("BLOCKING: ")],
        "warnings": [w for w in e["warnings"] if not w.startswith("BLOCKING: ")],
        "error": e["error"],
        "document_no": ((e.get("result") or {}).get("confirmation") or {}).get("record_id"),
        "mismatches": ((e.get("result") or {}).get("verifier") or {}).get("mismatches", []),
        "price_notes": (e.get("result") or {}).get("price_notes", []),
        "seconds": round(e["duration"], 1) if e.get("duration") else None,
    } for e in entries]
    b["columns"] = prof_fields
    return b


class StartBody(BaseModel):
    exclude: list[int] = []


@app.post("/api/batches/{bid}/start")
def start_batch(bid: int, body: StartBody | None = None):
    b = db.get_batch(bid)
    if not b:
        raise HTTPException(404)
    if b["status"] == "running":
        raise HTTPException(409, "this batch is already running")
    other = db.running_batch()
    if other and other["id"] != bid and other["status"] == "running":
        raise HTTPException(409, f"batch #{other['id']} is still running")
    return worker.start_batch(bid, (body.exclude if body else []) or [])


@app.post("/api/batches/{bid}/pause")
def pause_batch(bid: int):
    if not db.get_batch(bid):
        raise HTTPException(404)
    return worker.pause_batch(bid)


@app.post("/api/batches/{bid}/resume")
def resume_batch(bid: int):
    b = db.get_batch(bid)
    if not b:
        raise HTTPException(404)
    if b["status"] not in ("paused", "stopping"):
        raise HTTPException(409, f"cannot resume a batch that is {b['status']}")
    other = db.running_batch()
    if other and other["id"] != bid and other["status"] in ("running", "stopping"):
        raise HTTPException(409, f"batch #{other['id']} is still running")
    return worker.resume_batch(bid)


@app.post("/api/batches/{bid}/stop")
def stop_batch(bid: int):
    if not db.get_batch(bid):
        raise HTTPException(404)
    return worker.stop_batch(bid)


@app.delete("/api/batches/{bid}")
def delete_batch(bid: int):
    b = db.get_batch(bid)
    if not b:
        raise HTTPException(404)
    if b["status"] in ("running", "stopping"):
        raise HTTPException(409, "stop the batch first")
    db.delete_batch(bid)
    return {"ok": True}


@app.get("/api/batches/{bid}/report.csv")
def batch_report_csv(bid: int):
    if not db.get_batch(bid):
        raise HTTPException(404)
    return Response(report.csv_bytes(bid), media_type="text/csv",
                    headers={"content-disposition": f'attachment; filename="kpac_batch_{bid}.csv"'})


@app.get("/api/batches/{bid}/report.html")
def batch_report_html(bid: int):
    if not db.get_batch(bid):
        raise HTTPException(404)
    return HTMLResponse(report.html_page(bid))


# --------------------------------------------------------------------------- samples
@app.get("/api/sample.csv")
def sample_csv():
    name = "sample_pact_po.csv" if (_has_grid()) else "sample_entries.csv"
    return FileResponse(ROOT / "practice" / name, filename=name)


def _has_grid() -> bool:
    try:
        return bool(_profile().get("grid"))
    except Exception:
        return False
