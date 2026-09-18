"""
cli.py - talk to the running KPAC server from a terminal (used by the OpenClaw skill).

Single entries (one approval each):
  python cli.py status
  python cli.py list
  python cli.py add  '{"customer_name":"Acme","city":"Pune"}'
  python cli.py approve 7
  python cli.py reject 7
  python cli.py approve-all
  python cli.py log 7
  python cli.py import C:\\path\\to\\entries.csv      # legacy bulk queue (no pre-flight)

Batches (upload -> pre-flight -> ONE approval -> unattended run):
  python cli.py batch upload C:\\path\\to\\entries.csv ["batch name"]
  python cli.py batch start <id> [--exclude 3,7]
  python cli.py batch status <id>
  python cli.py batch list
  python cli.py batch pause <id> | resume <id> | stop <id>
  python cli.py batch report <id> [out.csv]
"""
import json, mimetypes, os, sys, urllib.error, urllib.request
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")
BASE = f"http://{os.getenv('HOST','127.0.0.1')}:{os.getenv('PORT','8765')}"


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"content-type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        sys.exit(f"{e.code} {e.reason}: {e.read().decode()[:400]}")


def upload(path, field="file", extra=None, url="/api/batches/upload"):
    boundary = "----kpaccli"
    name = os.path.basename(path)
    ctype = mimetypes.guess_type(name)[0] or "application/octet-stream"
    parts = []
    for k, v in (extra or {}).items():
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    parts.append((f"--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"{name}\"\r\n"
                  f"Content-Type: {ctype}\r\n\r\n").encode())
    parts.append(Path(path).read_bytes())
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    req = urllib.request.Request(BASE + url, data=b"".join(parts), method="POST",
                                 headers={"content-type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode() or "null")
    except urllib.error.HTTPError as e:
        sys.exit(f"{e.code} {e.reason}: {e.read().decode()[:400]}")


def show_batch(b, rows=True):
    c = b.get("counts", {})
    print(f"batch #{b['id']}  {b['name']}  [{b['status']}]  mode={b.get('mode') or '-'}  "
          f"profile={b.get('profile') or '-'}")
    print(f"  {c.get('done',0)}/{c.get('total',0)} done | {c.get('saved',0)} saved | "
          f"{c.get('failed',0)} failed | {c.get('skipped',0)} skipped"
          + (f" · est. {b['eta_seconds']}s left" if b.get("eta_seconds") else ""))
    if b.get("pause_reason"):
        print(f"  PAUSED: {b['pause_reason']}")
    for e in (b.get("entries") or []) if rows else []:
        flag = "  "
        if e["errors"]:
            flag = "!!"
        rec = ", ".join(f"{k}={v}" for k, v in list(e["record"].items())[:4])
        print(f"  {flag} row {e['row_no']:<3} {e['status']:<12} {e.get('document_no') or '':<14} {rec[:80]}")
        for x in e["errors"]:
            print(f"       BLOCKING: {x}")
        for x in e["warnings"]:
            print(f"       warning:  {x}")
        if e.get("error"):
            print(f"       {e['error']}")


def batch_cmd(argv):
    if not argv:
        sys.exit("batch needs a sub-command: upload | start | status | list | pause | resume | stop | report")
    sub = argv[0]
    if sub == "upload":
        b = upload(argv[1], extra={"name": argv[2] if len(argv) > 2 else ""})
        show_batch(b)
        blocking = sum(1 for e in b["entries"] if e["errors"])
        print(f"\nnothing has run yet. {blocking} row(s) are blocked.")
        print(f"start it with:  python cli.py batch start {b['id']}"
              + (f" --exclude {','.join(str(e['row_no']) for e in b['entries'] if e['errors'])}" if blocking else ""))
    elif sub == "start":
        exclude = []
        if "--exclude" in argv:
            exclude = [int(x) for x in argv[argv.index("--exclude") + 1].split(",") if x.strip()]
        show_batch(call("POST", f"/api/batches/{int(argv[1])}/start", {"exclude": exclude}), rows=False)
    elif sub == "status":
        show_batch(call("GET", f"/api/batches/{int(argv[1])}"))
    elif sub == "list":
        for b in call("GET", "/api/batches"):
            c = b.get("counts", {})
            print(f"#{b['id']:<4} {b['status']:<9} {c.get('saved',0)}/{c.get('total',0)} saved  "
                  f"{b.get('mode') or '':<8} {b['name']}")
    elif sub in ("pause", "resume", "stop"):
        show_batch(call("POST", f"/api/batches/{int(argv[1])}/{sub}"), rows=False)
    elif sub == "report":
        bid = int(argv[1])
        out = Path(argv[2]) if len(argv) > 2 else Path(f"kpac_batch_{bid}.csv")
        with urllib.request.urlopen(BASE + f"/api/batches/{bid}/report.csv", timeout=60) as r:
            out.write_bytes(r.read())
        print(f"wrote {out}")
    else:
        sys.exit(f"unknown batch sub-command {sub!r}")


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__); return
    cmd = argv[0]
    if cmd == "status":
        s = call("GET", "/api/status")
        out = {k: s.get(k) for k in ("busy", "current", "step", "worker_alive", "settings")}
        out["batch"] = (lambda b: b and {"id": b["id"], "status": b["status"], "counts": b["counts"]})(s.get("batch"))
        print(json.dumps(out, indent=2))
    elif cmd == "list":
        for e in call("GET", "/api/entries"):
            rid = (e.get("result") or {}).get("confirmation", {}).get("record_id") or ""
            batch = f"b{e['batch_id']}:r{e['row_no']}" if e.get("batch_id") else ""
            print(f"#{e['id']:<4} {e['status']:<14} {batch:<10} {rid:<14} {json.dumps(e['record'], ensure_ascii=False)}")
    elif cmd == "add":
        print(json.dumps(call("POST", "/api/entries", {"record": json.loads(argv[1]), "source": "openclaw"}), indent=2))
    elif cmd == "approve":
        print(json.dumps(call("POST", f"/api/entries/{int(argv[1])}/approve"), indent=2))
    elif cmd == "reject":
        print(json.dumps(call("POST", f"/api/entries/{int(argv[1])}/reject"), indent=2))
    elif cmd == "import":
        auto = "--no-auto" not in argv
        print(json.dumps(upload(argv[1], url=f"/api/entries/import?auto={'true' if auto else 'false'}"), indent=2))
    elif cmd == "approve-all":
        print(json.dumps(call("POST", "/api/entries/approve-all"), indent=2))
    elif cmd == "log":
        entries = call("GET", "/api/entries")
        e = next((x for x in entries if x["id"] == int(argv[1])), None)
        print(e["log"] if e else "not found")
    elif cmd == "batch":
        batch_cmd(argv[1:])
    else:
        print("unknown command"); print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
