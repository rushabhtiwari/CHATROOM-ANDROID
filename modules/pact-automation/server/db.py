"""SQLite queue for entries and batches. Kept deliberately simple (stdlib only)."""
import json, sqlite3, threading, time
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "queue.db"
_lock = threading.Lock()

STATUSES = ("pending", "approved", "filling", "verifying", "awaiting_save", "saving",
            "saved", "failed", "rejected", "skipped")

BATCH_STATUSES = ("draft", "running", "paused", "stopping", "done")


def _conn():
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    return c


def _columns(c, table) -> set:
    return {r["name"] for r in c.execute(f"PRAGMA table_info({table})").fetchall()}


def init():
    with _lock, _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL,
            status TEXT NOT NULL,
            record TEXT NOT NULL,          -- JSON of field -> value
            source TEXT DEFAULT 'manual',
            result TEXT DEFAULT '',        -- JSON: verifier verdict, confirmation, record_id
            error TEXT DEFAULT '',
            log TEXT DEFAULT ''            -- newline-separated run log
        )""")
        c.execute("""CREATE TABLE IF NOT EXISTS batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at REAL NOT NULL,
            started_at REAL,
            finished_at REAL,
            status TEXT NOT NULL DEFAULT 'draft',
            mode TEXT DEFAULT '',          -- LIVE or DRY RUN, as of the moment of approval
            totals TEXT DEFAULT '',        -- JSON snapshot written when the batch finishes
            source TEXT DEFAULT '',        -- original filename
            profile TEXT DEFAULT '',
            pause_reason TEXT DEFAULT ''
        )""")
        # --- migrations for databases created by earlier versions -------------
        have = _columns(c, "entries")
        for col, ddl in (("batch_id", "INTEGER"), ("row_no", "INTEGER"),
                         ("started_at", "REAL"), ("finished_at", "REAL"),
                         ("duration", "REAL"), ("warnings", "TEXT DEFAULT ''")):
            if col not in have:
                c.execute(f"ALTER TABLE entries ADD COLUMN {col} {ddl}")
        if "pause_reason" not in _columns(c, "batches"):
            c.execute("ALTER TABLE batches ADD COLUMN pause_reason TEXT DEFAULT ''")
        c.execute("CREATE INDEX IF NOT EXISTS ix_entries_batch ON entries(batch_id, row_no)")


# --------------------------------------------------------------------------- entries
def add(record: dict, source="manual", batch_id: int | None = None,
        row_no: int | None = None, warnings: list | None = None,
        status: str = "pending") -> int:
    now = time.time()
    with _lock, _conn() as c:
        cur = c.execute(
            "INSERT INTO entries(created_at,updated_at,status,record,source,batch_id,row_no,warnings)"
            " VALUES(?,?,?,?,?,?,?,?)",
            (now, now, status, json.dumps(record), source, batch_id, row_no,
             json.dumps(warnings or [])))
        return cur.lastrowid


def get(eid: int) -> dict | None:
    with _lock, _conn() as c:
        r = c.execute("SELECT * FROM entries WHERE id=?", (eid,)).fetchone()
        return _row(r) if r else None


def list_all(limit=500) -> list[dict]:
    with _lock, _conn() as c:
        rows = c.execute("SELECT * FROM entries ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [_row(r) for r in rows]


def list_for_batch(bid: int) -> list[dict]:
    with _lock, _conn() as c:
        rows = c.execute("SELECT * FROM entries WHERE batch_id=? ORDER BY row_no ASC, id ASC",
                         (bid,)).fetchall()
        return [_row(r) for r in rows]


def set_status(eid: int, status: str, *, error: str | None = None, result: dict | None = None):
    assert status in STATUSES, status
    now = time.time()
    with _lock, _conn() as c:
        sets, vals = ["status=?", "updated_at=?"], [status, now]
        if error is not None:
            sets.append("error=?"); vals.append(error)
        if result is not None:
            sets.append("result=?"); vals.append(json.dumps(result))
        if status == "filling":
            sets.append("started_at=?"); vals.append(now)
        if status in ("saved", "failed", "rejected", "skipped"):
            sets.append("finished_at=?"); vals.append(now)
            sets.append("duration=CASE WHEN started_at IS NULL THEN duration ELSE ?-started_at END")
            vals.append(now)
        vals.append(eid)
        c.execute(f"UPDATE entries SET {', '.join(sets)} WHERE id=?", vals)


def append_log(eid: int, line: str):
    stamp = time.strftime("%H:%M:%S")
    with _lock, _conn() as c:
        c.execute("UPDATE entries SET log = log || ? WHERE id=?", (f"[{stamp}] {line}\n", eid))


def next_approved() -> dict | None:
    """Next entry the worker should run.

    Batch rows come first, in file order, and only while their batch is running.
    Loose entries (added by hand, by cli.py or by the OpenClaw skill) are picked up after that.
    """
    with _lock, _conn() as c:
        r = c.execute(
            "SELECT e.* FROM entries e JOIN batches b ON b.id = e.batch_id"
            " WHERE e.status='approved' AND b.status='running'"
            " ORDER BY b.id ASC, e.row_no ASC, e.id ASC LIMIT 1").fetchone()
        if r is None:
            r = c.execute("SELECT * FROM entries WHERE status='approved' AND batch_id IS NULL"
                          " ORDER BY id ASC LIMIT 1").fetchone()
        return _row(r) if r else None


def delete(eid: int):
    with _lock, _conn() as c:
        c.execute("DELETE FROM entries WHERE id=?", (eid,))


def _row(r) -> dict:
    d = dict(r)
    d["record"] = json.loads(d["record"] or "{}")
    d["result"] = json.loads(d["result"]) if d.get("result") else {}
    try:
        d["warnings"] = json.loads(d.get("warnings") or "[]")
    except (TypeError, ValueError):
        d["warnings"] = []
    return d


# --------------------------------------------------------------------------- batches
def create_batch(name: str, source: str = "", profile: str = "") -> int:
    with _lock, _conn() as c:
        cur = c.execute("INSERT INTO batches(name,created_at,status,source,profile) VALUES(?,?,?,?,?)",
                        (name, time.time(), "draft", source, profile))
        return cur.lastrowid


def get_batch(bid: int) -> dict | None:
    with _lock, _conn() as c:
        r = c.execute("SELECT * FROM batches WHERE id=?", (bid,)).fetchone()
        return _batch_row(r) if r else None


def list_batches(limit=100) -> list[dict]:
    with _lock, _conn() as c:
        rows = c.execute("SELECT * FROM batches ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [_batch_row(r) for r in rows]


def set_batch(bid: int, **fields):
    if "status" in fields:
        assert fields["status"] in BATCH_STATUSES, fields["status"]
    if "totals" in fields and not isinstance(fields["totals"], str):
        fields["totals"] = json.dumps(fields["totals"])
    with _lock, _conn() as c:
        sets = ", ".join(f"{k}=?" for k in fields)
        c.execute(f"UPDATE batches SET {sets} WHERE id=?", [*fields.values(), bid])


def running_batch() -> dict | None:
    with _lock, _conn() as c:
        r = c.execute(
            "SELECT * FROM batches WHERE status IN ('running','stopping','paused')"
            " ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'stopping' THEN 1 ELSE 2 END,"
            " id DESC LIMIT 1").fetchone()
        return _batch_row(r) if r else None


def delete_batch(bid: int):
    with _lock, _conn() as c:
        c.execute("DELETE FROM entries WHERE batch_id=?", (bid,))
        c.execute("DELETE FROM batches WHERE id=?", (bid,))


def batch_counts(bid: int) -> dict:
    with _lock, _conn() as c:
        rows = c.execute("SELECT status, COUNT(*) n, SUM(COALESCE(duration,0)) d"
                         " FROM entries WHERE batch_id=? GROUP BY status", (bid,)).fetchall()
    out = {"total": 0, "done": 0, "saved": 0, "failed": 0, "skipped": 0, "remaining": 0,
           "fill_seconds": 0.0, "by_status": {}}
    for r in rows:
        out["by_status"][r["status"]] = r["n"]
        out["total"] += r["n"]
        out["fill_seconds"] += r["d"] or 0.0
        if r["status"] in ("saved", "failed", "rejected", "skipped"):
            out["done"] += r["n"]
        else:
            out["remaining"] += r["n"]
        if r["status"] == "saved":
            out["saved"] = r["n"]
        elif r["status"] == "failed":
            out["failed"] = r["n"]
        elif r["status"] in ("skipped", "rejected"):
            out["skipped"] += r["n"]
    return out


def avg_seconds(bid: int | None = None) -> float | None:
    sql = ("SELECT AVG(duration) a FROM entries WHERE duration IS NOT NULL"
           " AND status IN ('saved','failed')")
    args = []
    if bid is not None:
        sql += " AND batch_id=?"; args.append(bid)
    with _lock, _conn() as c:
        r = c.execute(sql, args).fetchone()
    return r["a"] if r and r["a"] else None


def kpis() -> dict:
    """Dashboard numbers: today's totals plus how many batches have been run."""
    lt = time.localtime()
    midnight = time.mktime((lt.tm_year, lt.tm_mon, lt.tm_mday, 0, 0, 0, 0, 0, -1))
    with _lock, _conn() as c:
        one = lambda sql, *a: c.execute(sql, a).fetchone()[0]
        saved = one("SELECT COUNT(*) FROM entries WHERE status='saved' AND updated_at>=?", midnight)
        failed = one("SELECT COUNT(*) FROM entries WHERE status='failed' AND updated_at>=?", midnight)
        avg = one("SELECT AVG(duration) FROM entries WHERE status='saved' AND duration IS NOT NULL"
                  " AND updated_at>=?", midnight)
        batches = one("SELECT COUNT(*) FROM batches WHERE status!='draft'")
    return {"saved_today": saved, "failed_today": failed,
            "avg_seconds": round(avg, 1) if avg else None, "batches_run": batches}


def _batch_row(r) -> dict:
    d = dict(r)
    try:
        d["totals"] = json.loads(d["totals"]) if d.get("totals") else {}
    except (TypeError, ValueError):
        d["totals"] = {}
    return d
