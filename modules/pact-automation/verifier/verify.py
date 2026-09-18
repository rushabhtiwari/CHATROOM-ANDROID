"""
verifier/verify.py - ask Claude whether the filled form matches the intended values.

Two independent checks are combined:
  1. read-back check  : robot reads the control values via UI Automation and compares (exact, free)
  2. vision check     : a screenshot of the window goes to Claude with the expected values (catches
                        things UIA can't: wrong screen, a popup covering the form, a value visually
                        truncated, a field the profile mapped to the wrong control)

Usage from code:
    from verifier.verify import Verifier
    v = Verifier()                                 # reads ANTHROPIC_API_KEY / VERIFIER_MODEL from .env
    result = v.verify(image_path, expected, labels, readback, vision_extra)
    # -> {"ok": bool, "readback_ok": bool, "vision_ok": bool, "mismatches": [...], "note": str, "model": str}

CLI:
    python verifier\verify.py --check          # validate key + list usable models
"""
import argparse, base64, json, os, sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SYSTEM = (
    "You are a meticulous data-entry QA checker. You are shown a screenshot of a Windows form "
    "and the values that were supposed to be entered. Compare each field VISUALLY. "
    "Report ONLY real discrepancies: a different value, an empty field that should have a value, "
    "a value in the wrong field, or a dialog/popup covering the form. Ignore cosmetic differences "
    "(number formatting like 50000 vs 50,000, capitalisation of dropdown text, trailing spaces). "
    "Answer with strict JSON only: "
    '{"match": true|false, "mismatches": [{"field": "...", "expected": "...", "seen": "..."}], "note": "one short sentence"}'
)


def _norm(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return ""
    s = str(v).strip()
    if s.lower() in ("true", "yes", "1", "on"):
        return "true"
    if s.lower() in ("false", "no", "0", "off"):
        return "false"
    return " ".join(s.split()).lower()


class Verifier:
    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.model = model or os.getenv("VERIFIER_MODEL", "claude-sonnet-4-5")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            if not self.api_key or self.api_key.startswith("sk-ant-..."):
                raise RuntimeError("ANTHROPIC_API_KEY is not set in .env")
            import anthropic
            self._client = anthropic.Anthropic(api_key=self.api_key)
        return self._client

    # ---- check 1: exact read-back ----
    @staticmethod
    def readback_check(expected: dict, readback: dict) -> list[dict]:
        mism = []
        for k, want in expected.items():
            if k not in readback:
                continue
            seen = readback[k]
            if isinstance(seen, str) and seen.startswith("<unreadable"):
                continue  # can't judge; leave to vision
            if _norm(want) != _norm(seen):
                mism.append({"field": k, "expected": str(want), "seen": str(seen), "source": "readback"})
        return mism

    # ---- check 2: vision ----
    def vision_check(self, image_path: Path, expected: dict, labels: dict,
                     extra: dict | None = None) -> dict:
        data = base64.standard_b64encode(Path(image_path).read_bytes()).decode()
        lines = []
        for k, v in expected.items():
            lines.append(f"- {labels.get(k, k)}: {v}")
        for k, v in (extra or {}).items():
            lines.append(f"- {k}: {v}")
        user_text = (
            "Expected values entered on this form:\n" + "\n".join(lines) +
            "\n\nDoes the screenshot show exactly these values in the correctly labelled fields? JSON only."
        )
        msg = self.client.messages.create(
            model=self.model,
            max_tokens=600,
            system=SYSTEM,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": data}},
                    {"type": "text", "text": user_text},
                ],
            }],
        )
        raw = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
        raw = raw.strip("`").removeprefix("json").strip()
        try:
            out = json.loads(raw)
        except json.JSONDecodeError:
            out = {"match": False, "mismatches": [], "note": f"unparseable verifier reply: {raw[:200]}"}
        out.setdefault("mismatches", [])
        for m in out["mismatches"]:
            m["source"] = "vision"
        return out

    def verify(self, image_path: Path, expected: dict, labels: dict,
               readback: dict | None = None, vision_extra: dict | None = None) -> dict:
        rb_mism = self.readback_check(expected, readback or {})
        vis = self.vision_check(image_path, expected, labels, vision_extra)
        mism = rb_mism + vis.get("mismatches", [])
        ok = (not rb_mism) and bool(vis.get("match"))
        return {
            "ok": ok,
            "readback_ok": not rb_mism,
            "vision_ok": bool(vis.get("match")),
            "mismatches": mism,
            "note": vis.get("note", ""),
            "model": self.model,
        }


def check_models():
    v = Verifier()
    print(f"Configured VERIFIER_MODEL = {v.model}")
    try:
        models = v.client.models.list()
        ids = [m.id for m in models.data]
    except Exception as e:
        sys.exit(f"Could not reach the Anthropic API: {e}")
    print("Models this key can use:")
    for i in ids:
        mark = "  <- configured" if i == v.model else ""
        print(f"  {i}{mark}")
    if v.model not in ids:
        print(f"\nWARNING: {v.model} is not in the list. Set VERIFIER_MODEL in .env to one of the above.")
    else:
        print("\nOK - key works and the configured model is available.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="validate API key and list models")
    a = ap.parse_args()
    if a.check:
        check_models()
    else:
        ap.print_help()
