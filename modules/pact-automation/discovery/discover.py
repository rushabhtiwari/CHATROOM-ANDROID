r"""
discover.py - dump a window's UI Automation control tree.

Use it once per PACT screen to learn the automation ids, then build a profile.

    python discovery\discover.py --title "PACT RevenU"
    python discovery\discover.py --title "PACT RevenU - Practice Form" --depth 12
    python discovery\discover.py --list          # list all top-level windows

Writes discovery\<timestamp>_<title>.json and prints a readable outline.
Only controls that can matter for filling (edits, combos, checks, buttons,
text/labels, tabs, lists, data grids) are printed; the JSON has everything.
"""
import argparse, json, re, sys, time
from pathlib import Path

try:
    from pywinauto import Desktop
except ImportError:
    sys.exit("pywinauto is not installed. Run scripts\\start.ps1 once, or: pip install pywinauto")

INTERESTING = {"Edit", "ComboBox", "CheckBox", "RadioButton", "Button", "Text",
               "Tab", "TabItem", "List", "ListItem", "DataGrid", "DataItem",
               "Custom", "Document", "Spinner", "Slider", "MenuItem", "Hyperlink"}

def node_info(el):
    info = el.element_info
    try:
        rect = info.rectangle
        r = [rect.left, rect.top, rect.right, rect.bottom]
    except Exception:
        r = None
    return {
        "control_type": info.control_type,
        "auto_id": info.automation_id or "",
        "name": (info.name or "")[:120],
        "class_name": info.class_name or "",
        "rect": r,
    }

def walk(el, depth, max_depth, out, outline, indent=0):
    n = node_info(el)
    n["children"] = []
    out.append(n)
    if n["control_type"] in INTERESTING and (n["auto_id"] or n["name"]):
        outline.append("  " * indent + f'[{n["control_type"]}] auto_id="{n["auto_id"]}" name="{n["name"]}"')
    if depth >= max_depth:
        return
    try:
        kids = el.children()
    except Exception:
        kids = []
    for k in kids:
        walk(k, depth + 1, max_depth, n["children"], outline, indent + 1)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", help="window title (regex, case-insensitive)")
    ap.add_argument("--depth", type=int, default=14)
    ap.add_argument("--index", type=int, default=None,
                    help="if several windows match, pick this one (0-based). Omit to list them.")
    ap.add_argument("--list", action="store_true", help="list top-level windows and exit")
    args = ap.parse_args()

    desk = Desktop(backend="uia")
    if args.list or not args.title:
        print("Top-level windows:")
        for w in desk.windows():
            t = w.window_text().strip()
            if t:
                print(f"  {t!r}  class={w.element_info.class_name}")
        return

    pattern = f"(?i).*{args.title}.*"
    matches = [w for w in desk.windows() if re.search(pattern, w.window_text() or "")]
    if not matches:
        sys.exit(f"No window matching {args.title!r}. Use --list to see titles.")
    if len(matches) > 1 and args.index is None:
        print(f"{len(matches)} windows match {args.title!r}:")
        for i, w in enumerate(matches):
            try:
                r = w.rectangle(); size = f"{r.width()}x{r.height()}"
            except Exception:
                size = "?"
            print(f"  [{i}] {w.window_text()!r}  ({size})")
        sys.exit("\nClose the extra window, or re-run with --index <n> to choose one.")
    win = matches[args.index or 0]
    try:
        win.set_focus()
    except Exception as e:
        print(f"(could not focus the window: {e}; continuing anyway)")
    time.sleep(0.4)

    tree, outline = [], []
    walk(win, 0, args.depth, tree, outline)

    Path(__file__).parent.mkdir(exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9]+", "_", args.title)[:40]
    outfile = Path(__file__).parent / f"{time.strftime('%Y%m%d_%H%M%S')}_{safe}.json"
    outfile.write_text(json.dumps({"title": win.window_text(), "tree": tree}, indent=2), encoding="utf-8")

    print(f"\nWindow: {win.window_text()!r}")
    print("\n".join(outline) or "(no named controls found - try a bigger --depth, or the app may not expose UIA)")
    print(f"\nFull tree saved to: {outfile}")
    print("Next: copy the auto_id values into a profile in profiles\\ (see profiles\\README.md)")

if __name__ == "__main__":
    main()
