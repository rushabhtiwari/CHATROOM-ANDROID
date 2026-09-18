"""
robot/fill.py - fill a form via Windows UI Automation (no screenshots, no guessing).

    from robot.fill import Robot
    r = Robot(profile)              # profile = dict loaded from profiles/<name>.json
    r.attach()                      # find the window (refuses to touch a Sign In screen)
    r.new_record()                  # optional: click the "new" action
    r.fill({"customer_name": "Acme", "city": "Pune", "active": True})
    r.read_back()                   # -> dict of what's on screen now
    r.save()                        # Save Draft if the profile has one, else Save
    r.confirmation()                # -> {"ok": True, "record_id": "CUST-0007", "text": "Saved: CUST-0007"}

Field types
    edit          plain textbox (ValuePattern)
    combo         ComboBox with a fixed item list
    check, radio  toggles
    date          WPF DatePicker - the editable part is a child PART_TextBox; written as dd/MM/yyyy
    lookup_combo  WPF ComboBox backed by a master (vendor, product). The editable part is a child
                  PART_EditableTextBox: type, let the dropdown populate, Enter, then READ IT BACK.
                  A value that does not stick means the master has no such row - that is an error.

Fields may carry "tab": "<tab name>"; the tab is selected once per tab, not once per field.
Records may carry "line_items": [{product_code, qty, unit_price}] which are keyboard-typed into
the profile's `grid` (cells there have no automation ids).

Safety: the "post" action is never executed. Save Draft only.

CLI (for quick tests):
    python -m robot.fill --profile practice --json "{\"customer_name\":\"Test\"}" --save
"""
import argparse, json, os, re, time
from datetime import datetime
from pathlib import Path

from pywinauto import Desktop
from pywinauto.controls.uiawrapper import UIAWrapper
from pywinauto.keyboard import send_keys
from pywinauto.timings import TimeoutError as PwTimeout
from pywinauto.uia_defines import IUIA
from pywinauto.uia_element_info import UIAElementInfo

ROOT = Path(__file__).resolve().parent.parent

SIGNIN_TITLE_RE = r"(?i)\bsign\s*in\b|\blog\s*in\b|\blogon\b"
LINE_ITEMS = "line_items"

_CTYPE = {"edit": "Edit", "combo": "ComboBox", "check": "CheckBox", "radio": "RadioButton",
          "button": "Button", "text": "Text", "tab": "Tab", "tabitem": "TabItem"}

_SENDKEYS_SPECIAL = "^+%~(){}[]"


def load_profile(name: str) -> dict:
    p = ROOT / "profiles" / f"{name}.json"
    if not p.exists():
        raise FileNotFoundError(f"profile not found: {p}")
    return json.loads(p.read_text(encoding="utf-8"))


class RobotError(Exception):
    pass


class WindowMissing(RobotError):
    """The target window is not there (app closed, or PACT is on the Sign In screen).

    The batch runner treats this specially: it pauses instead of failing every remaining row.
    """


def esc_keys(text: str) -> str:
    """Escape a literal string for pywinauto's send_keys."""
    return "".join("{" + c + "}" if c in _SENDKEYS_SPECIAL else c for c in str(text))


def fmt_date(value, fmt="%d/%m/%Y") -> str:
    """Accept dd/MM/yyyy, dd-MM-yyyy, yyyy-MM-dd or a datetime; emit the profile's format."""
    if isinstance(value, datetime):
        return value.strftime(fmt)
    s = str(value).strip()
    if not s:
        return ""
    for pat in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%y", "%d-%m-%y", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, pat).strftime(fmt)
        except ValueError:
            continue
    return s          # hand it over untouched; read-back will catch a bad one


class Robot:
    def __init__(self, profile: dict, log=print):
        self.profile = profile
        self.log = log
        self.win = None
        self._tab = None          # which tab we last selected
        self._cache = {}          # locator -> wrapper, valid for one document
        self.grid_notes = []      # things a human should see about the line items
        self.grid_prices = []     # what PACT actually charged per row
        self._doc_tab = None      # the selected document TabItem every lookup is scoped to
        self._doc_tab_name = None
        # One Robot is reused for a whole batch (server/worker.py), so the resolved-control
        # cache has to survive New. COLD_CACHE_EACH_RECORD=true restores the old behaviour
        # of throwing it away, at 2-9s per field per record.
        self._cold_cache_each_record = os.getenv("COLD_CACHE_EACH_RECORD", "false").lower() == "true"
        self.records_filled = 0

    # ---------- window ----------
    def attach(self, timeout: float = 5.0):
        spec = self.profile["window"]
        desk = Desktop(backend="uia")
        kw = {}
        if "title_re" in spec:
            kw["title_re"] = f"(?i).*{spec['title_re']}.*"
        elif "title" in spec:
            kw["title"] = spec["title"]
        else:
            raise RobotError("profile.window needs title_re or title")
        self.win = desk.window(**kw)
        if not self.win.exists(timeout=timeout):
            raise WindowMissing(f"window not found: {kw}. Is the app open, logged in and visible?")
        title = self.win.window_text() or ""
        if re.search(spec.get("signin_title_re", SIGNIN_TITLE_RE), title):
            raise WindowMissing(
                f"the window is on a sign-in screen ({title!r}). The robot never logs in - "
                "log into PACT yourself, open the document screen, then resume.")
        try:
            if self.win.is_minimized():
                self.win.restore()
        except Exception:
            pass
        self.win.set_focus()
        time.sleep(0.2)
        self._tab = None
        self._cache.clear()
        self._doc_tab = None
        self._doc_tab_name = None
        self.log(f"attached to window: {title!r}")
        self.bind_document()
        return self

    # ---------- which document tab are we typing into? ----------
    def bind_document(self):
        """Pin every later lookup to the SELECTED document tab.

        PACT keeps several documents open at once - Purchase Order and Sales Order side by
        side - and they reuse the same automation ids: `lstname`, `GrdBody` and
        `DtpVoucherDate` all exist on both. An unscoped FindFirst returns whichever the
        tree happens to yield first, so without this the robot can fill a customer name
        into the Purchase Order while the operator is looking at the Sales Order. In front
        of a client that is unrecoverable, so it is a hard failure rather than a warning.

        Profiles that do not declare `document_tab` keep the old window-wide behaviour.
        """
        spec = self.profile.get("document_tab")
        if not spec:
            return None
        container = spec.get("container", "tabAllScreens")
        expected = spec.get("name")
        tc = self._find_native({"auto_id": container, "type": "tab"}, root=self.win)
        if tc is None:
            raise RobotError(f"document tab control {container!r} not found")

        selected, selected_name, names = None, "", []
        for item in tc.children(control_type="TabItem"):
            labels = [t.window_text() for t in item.children(control_type="Text") if t.window_text()]
            name = (labels[0] if labels else item.window_text() or "").strip()
            names.append(name)
            try:
                is_sel = bool(item.is_selected())
            except Exception:
                is_sel = False
            if is_sel:
                selected, selected_name = item, name

        if selected is None:
            raise RobotError(f"no document tab is selected in {container!r} (open: {names})")
        if expected and selected_name.strip().lower() != expected.strip().lower():
            raise RobotError(
                f"the active document is {selected_name!r} but this profile is for "
                f"{expected!r}. Switch to the {expected!r} tab in PACT and run again - "
                "refusing to type into the wrong document.")
        # cache keys carry the tab name, but a *different* document behind the same name
        # would collide, so only a same-name re-bind may keep the resolved controls
        if self._doc_tab_name != selected_name:
            self._cache.clear()
        self._doc_tab, self._doc_tab_name = selected, selected_name
        self.log(f"document tab: {selected_name!r} (every lookup is scoped to it)")
        return selected

    def _scope_root(self, loc: dict):
        """Ribbon buttons and the flash message live outside the document tab."""
        if self._doc_tab is None or loc.get("scope") == "window":
            return self.win
        return self._doc_tab

    # ---------- finding controls ----------
    # PACT's window has thousands of elements. pywinauto's child_window() filters them in
    # Python and costs ~30s per field on this screen; the same search expressed as a native
    # UIA condition runs inside UIAutomationCore and costs 2-9s. Resolved controls are cached
    # for the life of one document, so a 16-field record resolves once, not once per read.
    def _condition(self, loc: dict):
        i = IUIA()
        parts = []
        if loc.get("auto_id"):
            parts.append(i.iuia.CreatePropertyCondition(
                i.UIA_dll.UIA_AutomationIdPropertyId, str(loc["auto_id"])))
        if loc.get("name"):
            parts.append(i.iuia.CreatePropertyCondition(
                i.UIA_dll.UIA_NamePropertyId, str(loc["name"])))
        ctype = _CTYPE.get(loc.get("type", ""))
        if ctype and i.known_control_types.get(ctype):
            parts.append(i.iuia.CreatePropertyCondition(
                i.UIA_dll.UIA_ControlTypePropertyId, i.known_control_types[ctype]))
        if not parts:
            return None
        cond = parts[0]
        for extra in parts[1:]:
            cond = i.iuia.CreateAndCondition(cond, extra)
        return cond

    def _find_native(self, loc: dict, root=None):
        """Native UIA descendant search, scoped to the active document tab by default."""
        if loc.get("title_re") or self.win is None:
            return None                      # regex has no native equivalent
        cond = self._condition(loc)
        if cond is None:
            return None
        i = IUIA()
        scope = i.tree_scope["descendants"]
        root = (root if root is not None else self._scope_root(loc)).element_info.element
        idx = loc.get("found_index")
        try:
            if idx:
                found = root.FindAll(scope, cond)
                el = found.GetElement(idx) if found.Length > idx else None
            else:
                el = root.FindFirst(scope, cond)
        except Exception:
            return None
        return UIAWrapper(UIAElementInfo(el)) if el else None

    def _find_in(self, parent, loc: dict, timeout: float = 2.0):
        """Native descendant search scoped to `parent`. A wrapper has no child_window()."""
        cond = self._condition(loc)
        if cond is None:
            return None
        scope = IUIA().tree_scope["descendants"]
        deadline = time.time() + timeout
        while True:
            try:
                el = parent.element_info.element.FindFirst(scope, cond)
            except Exception:
                el = None
            if el:
                return UIAWrapper(UIAElementInfo(el))
            if time.time() >= deadline:
                return None
            time.sleep(0.15)

    def _key(self, loc: dict) -> str:
        # the document tab is part of the identity: the same auto_id means a different
        # control on a different tab
        return repr((self._doc_tab_name, loc.get("scope"),
                     sorted((k, str(v)) for k, v in loc.items()
                            if k in ("auto_id", "name", "title_re", "type", "found_index"))))

    @staticmethod
    def window_present(profile: dict, timeout: float = 1.0) -> bool:
        """Cheap 'is the app still there?' check - no focus stealing, no attach."""
        spec = profile.get("window", {})
        if "title_re" in spec:
            kw = {"title_re": f"(?i).*{spec['title_re']}.*"}
        elif "title" in spec:
            kw = {"title": spec["title"]}
        else:
            return False
        try:
            return Desktop(backend="uia").window(**kw).exists(timeout=timeout)
        except Exception:
            return False

    def _ctrl(self, loc: dict, timeout: float = 3.0):
        """Resolve a locator dict to a pywinauto wrapper (cached for this document)."""
        ck = self._key(loc)
        cached = self._cache.get(ck)
        if cached is not None:
            try:
                cached.element_info.rectangle    # cheap liveness poke
                return cached
            except Exception:
                self._cache.pop(ck, None)
        w = self._find_native(loc)
        if w is not None:
            self._cache[ck] = w
            return w
        kw = {}
        if loc.get("auto_id"):
            kw["auto_id"] = loc["auto_id"]
        if loc.get("name"):
            kw["title"] = loc["name"]
        if loc.get("title_re"):
            kw["title_re"] = loc["title_re"]
        ctype = _CTYPE.get(loc.get("type", ""))
        if ctype:
            kw["control_type"] = ctype
        if loc.get("found_index") is not None:
            kw["found_index"] = loc["found_index"]
        if not kw:
            raise RobotError(f"locator has nothing to search by: {loc}")
        # the slow fallback can only search the whole window; refuse it when a document
        # scope is in force and the locator is not explicitly window-scoped, rather than
        # silently widening the search back out across both tabs
        if self._doc_tab is not None and loc.get("scope") != "window":
            raise RobotError(
                f"control not found inside the {self._doc_tab_name!r} document tab: {kw}")
        spec = self.win.child_window(**kw)
        try:
            w = spec.wait("exists ready", timeout=timeout)
        except PwTimeout:
            raise RobotError(f"control not found: {kw}")
        except Exception as e:
            if "ambiguous" in str(e).lower() and "found_index" not in kw:
                w = self.win.child_window(found_index=0, **kw).wait("exists ready", timeout=timeout)
            else:
                raise
        self._cache[ck] = w
        return w

    def _child_edit(self, ctrl, part: str, timeout: float = 2.0):
        """The editable TextBox inside a WPF DatePicker / editable ComboBox."""
        w = self._find_in(ctrl, {"auto_id": part, "type": "edit"}, timeout)
        if w is None:
            w = self._find_in(ctrl, {"type": "edit"}, 1.0)      # any Edit under it will do
        if w is None:
            raise RobotError(f"editable part {part!r} not found inside "
                             f"{ctrl.element_info.automation_id!r}")
        return w

    def _keys(self, keys: str, pause: float = 0.03):
        send_keys(keys, pause=pause, with_spaces=True)

    # ---------- tabs ----------
    def _tab_control(self):
        tabs = self.profile.get("tabs") or {}
        container = tabs.get("container")
        if not container:
            raise RobotError("profile has no tabs.container but a field asks for a tab")
        return self._ctrl({"auto_id": container, "type": "tab"})

    def ensure_tab(self, name: str):
        """Select a tab by its visible name. Cheap no-op if we are already on it."""
        if not name or self._tab == name:
            return
        tc = self._tab_control()
        for item in tc.children(control_type="TabItem"):
            labels = [item.window_text() or ""]
            try:
                labels += [t.window_text() or "" for t in item.children(control_type="Text")]
            except Exception:
                pass
            if any(l.strip().lower() == name.strip().lower() for l in labels):
                try:
                    item.select()
                except Exception:
                    item.click_input()
                # The panel behind a WPF TabItem is not populated the instant the tab is
                # selected. 0.35s was not enough on this screen: the FIRST field written
                # after the switch silently did not take, so `mode_of_transport` - the first
                # field on Extra Fields - stayed empty on the form while every field after
                # it was fine, and the verifier failed the document. `_set` re-asserts an
                # edit that did not stick as well, so this is the cheap half of that fix.
                time.sleep(self.profile.get("tab_settle_ms", 800) / 1000.0)
                self._tab = name
                self.log(f"tab: {name}")
                return
        raise RobotError(f"tab {name!r} not found in {self.profile['tabs'].get('container')}")

    # ---------- actions ----------
    def _do_action(self, key: str, act: dict):
        if key == "post" or (act.get("name") or "").strip().lower() == "post":
            raise RobotError("the Post action commits the document and is deliberately not wired up")
        if act.get("type") == "hotkey" or act.get("keys"):
            self.win.set_focus()
            time.sleep(0.15)
            self._keys(act["keys"])
        else:
            self._ctrl(act).click_input()
        self.log(f"action: {key}")
        time.sleep(0.35)

    def new_record(self):
        act = self.profile.get("actions", {}).get("new")
        if act:
            self._do_action("new", act)
            self._tab = None
            self._revalidate_cache()

    def _revalidate_cache(self):
        """Drop the controls New actually invalidated, keep the rest.

        Clearing the whole cache here used to be free, because the worker built a fresh
        Robot per record anyway. It is not free now: every dropped entry is another cold
        UIA resolve at 2-9s (see the note above `_condition`), which for a ten-field
        document is most of a minute per row. WPF's New resets the bound data rather than
        rebuilding the visual tree, so the wrappers normally stay valid; the ones that do
        not raise when poked and are dropped here exactly as if they had never been cached.
        """
        if self._cold_cache_each_record:
            self._cache.clear()
            return
        dead = []
        for k, w in self._cache.items():
            try:
                w.element_info.rectangle          # same liveness poke `_ctrl` uses
            except Exception:
                dead.append(k)
        for k in dead:
            self._cache.pop(k, None)
        if dead:
            self.log(f"cache: dropped {len(dead)} stale control(s) after New, kept {len(self._cache)}")

    def focus(self):
        """Bring the window forward without re-attaching.

        The old worker got this free from `attach()` once per record. Reusing a Robot
        skips the attach, so focus has to be taken deliberately - `send_keys` types into
        whatever has it, and a batch that types a line item into the operator's browser
        is the failure this prevents.
        """
        try:
            if self.win.is_minimized():
                self.win.restore()
        except Exception:
            pass
        self.win.set_focus()
        time.sleep(0.15)
        return self

    def is_live(self) -> bool:
        """Is this Robot still usable for another record? Cheap - no focus stealing.

        Used by the worker to decide whether it can reuse the attached Robot (and its
        resolved-control cache) for the next row, or has to attach from scratch.
        """
        try:
            if self.win is None or not self.win.exists(timeout=1.0):
                return False
            if self._doc_tab is not None:
                self._doc_tab.element_info.rectangle
                if not self._doc_tab.is_selected():
                    return False        # the operator moved to another document
        except Exception:
            return False
        return True

    def ensure_editable(self):
        """A PACT document marked (locked) cannot be typed into - click New for a fresh draft.

        PACT keeps a hidden 0x0 "(locked)" TextBlock in the tree at all times, so mere existence
        means nothing; only a rendered one means this document really is read-only.
        """
        marker = self.profile.get("locked_marker")
        if not marker:
            return
        w = self._find_native({"name": marker})
        if w is not None and self._visible(w):
            self.log(f"document shows {marker!r} - clicking New for a fresh draft")
            self.new_record()
            time.sleep(0.6)
        elif w is not None:
            self.log(f"{marker!r} present but not rendered - document is editable")

    def save(self):
        acts = self.profile.get("actions", {})
        for key in ("save_draft", "save"):
            if acts.get(key):
                self._do_action(key, acts[key])
                time.sleep(0.5)
                return
        raise RobotError("profile has no actions.save_draft or actions.save")

    # ---------- filling ----------
    def fill(self, record: dict):
        fields = self.profile["fields"]
        items = record.get(LINE_ITEMS)

        # group by tab so a tab is selected once, main-form fields first
        order = sorted(
            (k for k in fields if k in record or fields[k].get("required")),
            key=lambda k: (fields[k].get("tab") or "", list(fields).index(k)))

        for key in order:
            loc = fields[key]
            if key not in record:
                if loc.get("required"):
                    raise RobotError(f"required field missing from record: {key}")
                continue
            if loc.get("tab"):
                self.ensure_tab(loc["tab"])
            self._set(key, loc, record[key])

        if items:
            if not self.profile.get("grid"):
                raise RobotError("record has line_items but the profile has no grid")
            self.fill_grid(items)
        self.log("fill complete")

    def _set(self, key, loc, value):
        t = loc.get("type", "edit")
        c = self._ctrl(loc)
        if t == "edit":
            want = "" if value is None else str(value)
            self._set_text(c, want)
            # Read it straight back. A WPF panel that has only just been rendered accepts a
            # ValuePattern write and then discards it, which looks like nothing at all went
            # wrong until the verifier sees an empty box. One re-assert is enough; if it
            # still will not hold, the verifier is the right place to fail.
            if want and not self._reads_as(c, want):
                time.sleep(0.4)
                self._set_text(c, want)
                if self._reads_as(c, want):
                    self.log(f"set {key} = {want!r} (did not take the first time)")
                else:
                    self.log(f"set {key} = {want!r} - WARNING: still reads "
                             f"{self._current_text(c)!r}")
            else:
                self.log(f"set {key} = {value!r}")
        elif t == "date":
            v = fmt_date(value, self.profile.get("date_format", "%d/%m/%Y"))
            box = self._child_edit(c, loc.get("child_edit", "PART_TextBox"))
            self._set_text(box, v)
            self._keys("{TAB}")            # commit the date and let the picker reformat
            time.sleep(0.15)
            self.log(f"date {key} = {v!r}")
        elif t == "lookup_combo":
            self._set_lookup(key, loc, c, "" if value is None else str(value))
        elif t == "combo":
            v = "" if value is None else str(value)
            try:
                c.select(v)
            except Exception:
                c.set_focus()
                self._keys(esc_keys(v))
                self._keys("{ENTER}")
            self.log(f"select {key} = {v!r}")
        elif t == "check":
            want = _truthy(value)
            state = c.get_toggle_state()   # 0 off, 1 on
            if (state == 1) != want:
                c.toggle()
            self.log(f"check {key} = {want}")
        elif t == "radio":
            if _truthy(value):
                c.select()
            self.log(f"radio {key} = {value}")
        else:
            raise RobotError(f"unsupported field type {t!r} for {key}")
        time.sleep(0.08)

    @staticmethod
    def _current_text(ctrl) -> str:
        try:
            return (ctrl.get_value() if hasattr(ctrl, "get_value") else ctrl.window_text()) or ""
        except Exception:
            return ""

    def _reads_as(self, ctrl, want: str) -> bool:
        return _same(self._current_text(ctrl), want)

    @staticmethod
    def _set_text(ctrl, v: str):
        ctrl.set_focus()
        try:
            ctrl.set_edit_text(v)          # ValuePattern - exact, no keystroke issues
        except Exception:
            send_keys("^a{BACKSPACE}", pause=0.02)
            if v:
                send_keys(esc_keys(v), pause=0.02, with_spaces=True)

    def _selection_count(self, combo) -> int | None:
        """How many master rows the combo currently has selected. None = pattern unavailable."""
        try:
            return combo.iface_selection.GetCurrentSelection().Length
        except Exception:
            return None

    def _await_dropdown(self, combo, timeout_s: float, poll_s: float = 0.12) -> bool:
        """Wait for the master lookup to actually resolve, instead of guessing at a sleep.

        The Purchase Order screen settles in about 400ms; the Sales Order screen is much
        heavier (GST lookups, credit fields, a 40-column grid) and a fixed wait tuned on
        the lighter screen misses it most of the time. The combo selects a row as soon as
        it has matched one, so a non-zero selection count is the signal that it is ready -
        polling for it is both faster on the light screen and reliable on the heavy one.

        Returns True if a row was selected before the timeout. False is not fatal: the
        caller still presses Enter and judges by the read-back.
        """
        deadline = time.time() + timeout_s
        blind = 0
        while time.time() < deadline:
            n = self._selection_count(combo)
            if n:
                return True
            if n is None:
                # No SelectionPattern on this control, so there is nothing here to wait for.
                # Give it a few polls in case the pattern is still being attached, then stop
                # rather than burn the whole timeout learning the same thing 30 times over.
                blind += 1
                if blind >= 3:
                    return False
            else:
                blind = 0
            time.sleep(poll_s)
        return False

    def _set_lookup(self, key, loc, combo, value: str):
        """Type into the master-backed combo, let it resolve, then insist it stuck.

        Two things make this awkward on PACT:
          * the combo queries the master on every text change and drops keystrokes while that
            query is in flight, so typing the value character by character loses the first few;
          * it is an editable combo, so text that matches nothing can simply stay in the box.
        The reliable protocol is therefore: put all but the last character in through the
        ValuePattern (atomic, nothing dropped), then TYPE the final character so the dropdown
        actually filters on the complete value, then confirm. With the dropdown filtering, PACT
        commits a real match and clears the box for anything else - which is the signal we want.
        """
        part = loc.get("child_edit", "PART_EditableTextBox")
        wait = loc.get("dropdown_wait_ms", 400) / 1000.0
        settle = loc.get("settle_ms", 300) / 1000.0
        timeout = loc.get("dropdown_timeout_ms", 4000) / 1000.0
        settle_after = loc.get("confirm_settle_ms", 400) / 1000.0

        def clear():
            box = self._child_edit(combo, part)
            box.set_focus()
            time.sleep(settle)
            try:
                box.set_edit_text("")
            except Exception:
                send_keys("^a{BACKSPACE}", pause=0.03)
            time.sleep(settle)
            return box

        def attempt(how, confirm_keys):
            box = clear()
            if how == "hybrid" and len(value) > 1:
                box.set_edit_text(value[:-1])
                time.sleep(0.15)
                send_keys(esc_keys(value[-1]), pause=0.05, with_spaces=True)
            else:
                send_keys(esc_keys(value), pause=0.06, with_spaces=True)
            time.sleep(0.15)
            typed = self._read_lookup(combo, part)
            if not _same(typed, value):
                self.log(f"lookup {key}: only {typed!r} reached the box")
                return None
            # poll for the master to resolve rather than sleeping a fixed guess
            ready = self._await_dropdown(combo, timeout)
            if not ready:
                time.sleep(wait)                  # nothing selected yet; give it the old grace
            send_keys(confirm_keys, pause=0.05)
            time.sleep(settle_after)
            seen = self._read_lookup(combo, part)
            n = self._selection_count(combo)
            self.log(f"lookup {key}: after {how}+{confirm_keys} box={seen!r} selected={n}")
            return seen, n

        # NOTE: Down+Enter is deliberately NOT used as a fallback. On this screen it selects
        # whatever row happens to be first in the unfiltered list, so a value the master does
        # not contain comes back as a real but WRONG vendor. Enter on a filtered dropdown either
        # commits the true match or clears the box, which is the behaviour we want.
        typed_ok = False
        for how, confirm in (("hybrid", "{ENTER}"), ("keys", "{ENTER}"), ("hybrid", "{ENTER}")):
            got = attempt(how, confirm)
            if got is None:
                continue                          # the text never landed; try another way
            typed_ok = True
            seen, n = got
            if _same(seen, value) and (n is None or n > 0):
                self.log(f"lookup {key} = {value!r} (resolved against the master)")
                return
            if _same(seen, value) and n == 0:
                # text kept but nothing selected: PACT is holding free text, not a master row
                self.log(f"lookup {key}: text kept but no master row is selected")

        if not typed_ok:
            raise RobotError(
                f"{key}: could not type {value!r} into the box at all. The combo is dropping "
                "keystrokes - raise settle_ms for this field in the profile.")
        seen = self._read_lookup(combo, part)
        try:                                      # never leave a half-matched name behind
            clear()
        except Exception:
            pass
        raise RobotError(
            f"{key}: {value!r} did not stick - PACT left the box as {seen!r}. That means the "
            "master has no such entry, or it is spelled differently there. Copy the name "
            "exactly as PACT shows it; the box has been cleared and nothing was saved.")

    def _read_lookup(self, combo, part) -> str:
        try:
            box = self._child_edit(combo, part, timeout=1.0)
            return (box.get_value() if hasattr(box, "get_value") else box.window_text()) or ""
        except Exception:
            try:
                return combo.selected_text() or ""
            except Exception:
                return combo.window_text() or ""

    # ---------- grid ----------
    # GrdBody's cells carry no automation ids, and a DataGridRow's children include 0x0
    # placeholders for columns WPF has not realised, so a cell's position in that list means
    # nothing. What is reliable is geometry: a cell sits directly under its column header.
    # Everything below maps columns to cells by matching (left, width) against the header row.
    def _grid(self):
        return self._ctrl({"auto_id": self.profile["grid"]["auto_id"]}, timeout=5)

    def grid_headers(self, grid=None) -> list[str]:
        """The header row exactly as it is on screen, including the unnamed columns."""
        return [n for n, _, _ in self._header_boxes(grid)]

    def _header_boxes(self, grid=None) -> list[tuple]:
        grid = grid if grid is not None else self._grid()
        hdr = self._find_in(grid, {"auto_id": "PART_ColumnHeadersPresenter"}, 3.0)
        if hdr is None:
            raise RobotError("grid column headers not found - is the document screen really open?")
        out = []
        for h in hdr.children():
            rc = h.element_info.rectangle
            out.append((h.window_text() or "", rc.left, rc.right - rc.left))
        return out

    def _grid_rows(self, grid):
        presenter = self._find_in(grid, {"auto_id": "PART_RowsPresenter"}, 3.0)
        if presenter is None:
            raise RobotError("grid rows presenter not found - is the document screen really open?")
        return [r for r in presenter.children()
                if (r.element_info.class_name or "").endswith("DataGridRow")
                or r.element_info.control_type == "DataItem"]

    @staticmethod
    def _data_cells(row) -> list:
        """Rendered DataGridCells of a row, left to right. Placeholders are dropped."""
        out = []
        for c in row.children():
            if not (c.element_info.class_name or "").endswith("DataGridCell"):
                continue
            rc = c.element_info.rectangle
            if rc.right - rc.left > 0 and rc.bottom - rc.top > 0:
                out.append((rc.left, c))
        out.sort(key=lambda t: t[0])
        return [c for _, c in out]

    def _row_map(self, row, heads) -> tuple:
        """(column name -> cell, ordered cells). Matching is by header geometry."""
        cells = self._data_cells(row)
        by_col = {}
        for c in cells:
            rc = c.element_info.rectangle
            w = rc.right - rc.left
            for name, hx, hw in heads:
                if name and abs(rc.left - hx) <= 3 and abs(w - hw) <= 3:
                    by_col.setdefault(name, c)
                    break
        return by_col, cells

    @staticmethod
    def _cell_text(cell) -> str:
        txt = (cell.window_text() or "").strip()
        if txt:
            return txt
        try:
            for ch in cell.children():
                t = (ch.window_text() or "").strip()
                if t:
                    return t
        except Exception:
            pass
        return ""

    def _visible(self, ctrl) -> bool:
        try:
            r = ctrl.element_info.rectangle
            return (r.right - r.left) > 0 and (r.bottom - r.top) > 0
        except Exception:
            return False

    def _cell_for(self, grid, heads, index, row_no, col):
        by_col, _ = self._row_map(self._row(grid, index, row_no), heads)
        return by_col.get(col)

    def _wait_resolved(self, grid, heads, index, row_no, g):
        """After a lookup cell commits, PACT fills the derived columns. Typing into the next
        cell before that finishes loses keystrokes, so wait for the evidence it is done."""
        col = g.get("lookup_resolved_column", "Product Name")
        deadline = time.time() + g.get("resolve_timeout_ms", 4000) / 1000.0
        while time.time() < deadline:
            cell = self._cell_for(grid, heads, index, row_no, col)
            if cell is not None and self._cell_text(cell):
                time.sleep(g.get("post_resolve_ms", 250) / 1000.0)
                return True
            time.sleep(0.15)
        self.log(f"  row {row_no}: {col!r} never filled in; carrying on")
        return False

    # A lookup column is an editable ComboBox hosted inside the DataGridCell: {F2} opens it
    # and a real Edit with a ValuePattern appears underneath. Finding that Edit is the whole
    # difference between a code that resolves and one that does not.
    #
    # send_keys types character by character, and PACT queries the product master on every
    # text change while dropping keystrokes for as long as that query is in flight - the
    # exact behaviour `_set_lookup` documents and works around for the header combos. So on
    # a busy master '45629' arrives as '456', Enter matches nothing, and PACT clears the
    # cell. The vendor name landed and the product code did not for precisely this reason:
    # the header lookup used the ValuePattern and the grid did not.
    def _cell_editor(self, cell, g, timeout: float = 0.8):
        """The Edit inside a cell that is already in edit mode, or None if it has none."""
        part = g.get("cell_child_edit", "PART_EditableTextBox")
        w = self._find_in(cell, {"auto_id": part, "type": "edit"}, timeout)
        if w is None:
            w = self._find_in(cell, {"type": "edit"}, 0.4)   # any Edit under it will do
        return w

    def _cell_combo(self, cell, timeout: float = 0.4):
        """The ComboBox hosting a lookup cell - its selection count says when the master
        has matched, which beats sleeping a fixed guess."""
        try:
            return self._find_in(cell, {"type": "combo"}, timeout)
        except Exception:
            return None

    def _open_editor(self, cell, g):
        """Get a cell into edit mode and hand back its Edit control, or None.

        One {F2} is not enough. PACT rebuilds the row when a Product Code resolves, and a
        key that arrives mid-rebuild is dropped - so the cell stays out of edit mode and
        every keystroke after it goes nowhere. That is not a visible failure: the value
        simply never appears, and on Qty the 1 that PACT reset the row to survives, which
        is exactly the "Qty should be '120' but the grid still shows '1'" read-back.
        Clicking the cell again between tries re-anchors on the rebuilt row.
        """
        for attempt in range(g.get("edit_open_attempts", 3)):
            self._keys(g.get("edit_key", "{F2}"))
            time.sleep(g.get("cell_edit_ms", 150) / 1000.0)
            editor = self._cell_editor(cell, g)
            if editor is not None:
                return editor
            try:
                cell.click_input()
            except Exception:
                return None
            time.sleep(g.get("cell_settle_ms", 300) / 1000.0)
        return None

    def _type_cell(self, cell, value: str, g, lookup: bool = True):
        """Put `value` into a grid cell and prove it arrived. -> (editor, combo, landed).

        `landed` False means the whole value could not be got into the box - either the cell
        never opened for editing or it kept dropping keystrokes. The caller can then say the
        failure was typing rather than a missing master row, which need opposite fixes.

        `lookup` says which kind of cell this is, because the two want opposite orders:
          * a lookup cell hosts an autocomplete combo that drops keystrokes while the
            master query runs, so the hybrid write (ValuePattern for all but the last
            character, then one typed key) goes first - that is the protocol note7 in the
            profile records as verified on the live screen;
          * a plain cell (Qty) is an ordinary TextBox whose caret sits at position 0 after
            a ValuePattern write, so the hybrid write puts the last character at the FRONT:
            '12' then '0' read back as '012' on every multi-digit quantity in the run log,
            and only the plain-keys fallback ever landed. Plain keys go first there, and
            the hybrid write stays as the fallback it has always been.
        """
        editor = self._open_editor(cell, g)
        combo = self._cell_combo(cell)

        def clear():
            if editor is not None:
                try:
                    editor.set_edit_text("")
                    return
                except Exception:
                    pass
            self._keys("^a")
            self._keys("{BACKSPACE}")

        if editor is None:
            # The cell never opened for editing. Type it anyway as a last resort - it costs
            # nothing and occasionally lands - but report it as NOT landed, because a cell
            # being edited reports stale text to UIA and there is nothing here to verify
            # against. Reporting success here is what made a silent no-op look like a
            # missing master row further down.
            self.log("  cell would not open for editing; typing blind")
            clear()
            if value:
                self._keys(esc_keys(value), pause=0.08)
            time.sleep(g.get("cell_settle_ms", 300) / 1000.0)
            return editor, combo, False

        def in_box() -> str:
            try:
                return (editor.get_value() if hasattr(editor, "get_value")
                        else editor.window_text()) or ""
            except Exception:
                return ""

        if not value:
            clear()
            time.sleep(g.get("cell_settle_ms", 300) / 1000.0)
            return editor, combo, True

        # Hybrid first: everything but the last character goes in atomically through the
        # ValuePattern, then the last character is TYPED so the dropdown filters on the
        # complete value. Plain typing is kept as the fallback, not the default.
        ways = ("hybrid", "keys", "hybrid") if lookup else ("keys", "hybrid")
        for way in ways:
            clear()
            time.sleep(0.12)
            if way == "hybrid" and len(value) > 1:
                try:
                    editor.set_edit_text(value[:-1])
                except Exception:
                    self._keys(esc_keys(value[:-1]), pause=0.05)
                time.sleep(0.15)
                self._keys(esc_keys(value[-1]), pause=0.05)
            else:
                self._keys(esc_keys(value), pause=0.08)
            time.sleep(g.get("cell_settle_ms", 300) / 1000.0)
            got = in_box()
            if _same(got, value):
                return editor, combo, True
            self.log(f"  cell took only {got!r} of {value!r}; trying another way")
        return editor, combo, False

    def fill_grid(self, items: list):
        """Keyboard-drive the line-item grid. Only entry_columns are ever typed.

        Two live-screen behaviours drive the shape of this:
          * a cell that is being edited reports stale text to UIA, so a value can only be
            checked once the row has been committed;
          * PACT resolves a Product Code when focus LEAVES that cell, then recalculates the
            row and resets Qty to 1 - clobbering a Qty typed a moment earlier.
        So: type, tab, wait for the recalculation to land, type the next one, commit, and only
        then read the row back and repair anything that did not survive.
        """
        g = self.profile["grid"]
        entry_cols = g["entry_columns"]
        keymap = g.get("item_keys", {c: c for c in entry_cols})
        lookups = g.get("lookup_columns", [])
        commit = g.get("commit_key", "{ENTER}")
        grid = self._grid()
        heads = self._header_boxes(grid)

        live = [n for n, _, _ in heads]
        if g.get("columns") and live != g["columns"]:
            self.log(f"note: rendered grid columns differ from the profile ({len(live)} on screen)")
        gone = [c for c in entry_cols if c not in {n for n, _, _ in heads}]
        if gone:
            raise RobotError(f"grid has no column(s) named {gone} - the profile's "
                             f"entry_columns do not match this screen: {live}")

        self.grid_notes, self.grid_prices = [], []
        self._lookup_typed = {}          # (row, column) -> did the whole value land?
        self._lookup_resolved = {}       # (row, column) -> did the master ever resolve it?
        self._lookup_spent = {}          # (row, column) -> commit attempts used so far
        self.log(f"grid {g['auto_id']}: {len(items)} line item(s), typing {entry_cols}")
        for i, item in enumerate(items):
            row_no = i + 1
            row = self._row(grid, i, row_no)
            by_col, cells = self._row_map(row, heads)
            gone = [c for c in entry_cols if c not in by_col]
            if gone:
                raise RobotError(f"grid row {row_no}: column(s) {gone} are not rendered - "
                                 "scroll the grid so they are on screen, or widen the window")
            order = {c: cells.index(by_col[c]) for c in entry_cols}
            prev_col = None

            first = by_col[entry_cols[0]]
            if not self._visible(first):
                raise RobotError(f"grid row {row_no}: the {entry_cols[0]} cell is not on screen")

            # Each entry cell is CLICKED rather than tabbed to.
            #
            # Tabbing was counted in data-cell positions - five columns from Product Code to
            # Qty, past Product Name, HSNCODE, ProductAliasNames and Purchase Account. That
            # arithmetic only holds while the row stays still, and it does not: resolving the
            # Product Code makes PACT rewrite the row (it fills Product Name, Units, UnitPrice
            # and resets Qty to 1). The tabs then landed somewhere other than Qty, the
            # quantity went into a column nobody reads back, and the row failed verification
            # with "Qty should be '1200' but the grid still shows ''".
            #
            # Clicking re-resolves the cell against the row as it is now, so a re-render
            # between one column and the next costs nothing.
            for position, col in enumerate(entry_cols):
                cell = self._cell_for(grid, heads, i, row_no, col) if position else first
                if cell is None or not self._visible(cell):
                    raise RobotError(
                        f"grid row {row_no}: the {col} cell is not on screen - scroll the grid "
                        "so it is, or widen the window")
                cell.click_input()
                time.sleep(0.2)

                if prev_col in lookups:
                    # focus has just left the lookup: PACT is resolving and will reset Qty,
                    # so let that land before typing, then click again because the row the
                    # click landed in has been rebuilt underneath us
                    time.sleep(g.get("lookup_wait_ms", 400) / 1000.0)
                    if self._lookup_resolved.get((row_no, prev_col), True):
                        self._wait_resolved(grid, heads, i, row_no, g)
                    else:
                        # the commit already spent its attempts watching for this and never
                        # saw it; another full timeout here would learn nothing new
                        self.log(f"  row {row_no}: {prev_col} is unresolved, not waiting again")
                    again = self._cell_for(grid, heads, i, row_no, col)
                    if again is not None and self._visible(again):
                        again.click_input()
                        time.sleep(0.15)
                        cell = again      # the old wrapper points into the rebuilt row

                prev_col = col
                value = str(item.get(keymap.get(col, col), "") or "")
                if col in lookups:
                    # Clear the cell, then re-anchor on the row before typing the real value.
                    # Going straight from the click to the value does not resolve here: the
                    # master lookup only filters reliably once the cell has been opened and
                    # emptied, and the clear itself rebuilds the row - so the wrapper the
                    # click produced is already stale by the time the value goes in.
                    self._type_cell(cell, "", g)
                    time.sleep(g.get("cell_settle_ms", 300) / 1000.0)
                    again = self._cell_for(grid, heads, i, row_no, col)
                    if again is not None and self._visible(again):
                        again.click_input()
                        time.sleep(0.2)
                        cell = again
                # a DataGrid cell must be in edit mode first: outside it, Ctrl+A selects rows
                editor, combo, landed = self._type_cell(cell, value, g, lookup=col in lookups)
                self._lookup_typed[(row_no, col)] = landed
                self.log(f"  row {row_no} {col} = {value!r}"
                         + ("" if landed else "   [the box would not take the whole value]"))

                if col in lookups:
                    # Enter on the *filtered* dropdown is what commits a real master row -
                    # the same protocol the header lookups use, and what makes PACT fill
                    # Product Name and Units before the next column is touched.
                    #
                    # Enter pressed before the filter has run does the opposite: it matches
                    # nothing and PACT clears the cell. That is not hypothetical - with a
                    # fixed wait, rows 1 and 2 committed and row 3 came back blank on a busy
                    # window, because the master query is slower the deeper the grid gets.
                    # So: let the filter run, commit, then confirm the row really resolved
                    # by watching the column PACT fills itself, and re-type if it did not.
                    self._commit_grid_lookup(grid, heads, i, row_no, col, value, g, combo)

            self._keys(commit)             # commit the row; PACT computes the derived columns
            time.sleep(g.get("row_commit_ms", 600) / 1000.0)
            self._settle_row(grid, heads, i, row_no, item, g)
            self._check_price(grid, heads, i, row_no, item, g)

        # Committing a row can leave a cell editor or the Units dropdown open. That covers the
        # grid in the screenshot (the verifier rightly refuses to pass it) and can swallow the
        # Save Draft hotkey. Escape closes the popup; parking focus on a plain header field then
        # takes the grid out of edit mode altogether.
        self._keys("{ESC}")
        time.sleep(0.25)
        out = g.get("focus_out_field")
        if out and out in self.profile["fields"]:
            try:
                loc = self.profile["fields"][out]
                if loc.get("tab"):
                    self.ensure_tab(loc["tab"])
                self._ctrl(loc).set_focus()
                time.sleep(0.25)
                self.log(f"focus parked on {out} to close any open cell editor")
            except Exception as e:
                self.log(f"could not park focus on {out}: {e.__class__.__name__}")

    def _commit_grid_lookup(self, grid, heads, index, row_no, col, value, g, combo=None):
        """Commit a grid lookup cell, and insist the master actually resolved it.

        `_wait_resolved` watches the column PACT fills in by itself (Product Name), which
        is the only honest evidence that a real master row was selected rather than free
        text left in the box.
        """
        attempts = g.get("lookup_attempts", 3)
        timeout = g.get("lookup_timeout_ms", 4000) / 1000.0
        # One budget for the whole record, shared by the fill and the repair passes.
        #
        # Each attempt costs about ten seconds when the master does not answer (the
        # dropdown timeout, then the resolve timeout), and the old shape spent three
        # here, then three more in each of two repair passes: nine attempts and two
        # minutes on a code the master plainly did not have, which is the "lags at
        # product code" a demo audience sees. The same retries still happen - the run
        # log shows a second attempt succeeding - but the record now gives up after
        # `lookup_attempts_total` of them in all, and says so.
        spent = getattr(self, "_lookup_spent", {})
        resolved = getattr(self, "_lookup_resolved", {})
        budget = g.get("lookup_attempts_total", 5)
        used = spent.get((row_no, col), 0)
        if used >= budget:
            self.log(f"  row {row_no} {col}: lookup budget of {budget} attempt(s) already spent; "
                     "not retrying")
            resolved[(row_no, col)] = False
            return False
        attempts = max(1, min(attempts, budget - used))
        for attempt in range(attempts):
            spent[(row_no, col)] = spent.get((row_no, col), 0) + 1
            # Wait for the master to actually select a row instead of sleeping a fixed
            # guess. Enter pressed before the filter has run matches nothing and PACT
            # clears the cell - and the query gets slower the deeper the grid and the
            # busier the box, which is why a fixed wait passes one day and fails the next.
            t0 = time.time()
            ready = self._await_dropdown(combo, timeout) if combo is not None else False
            selected = self._selection_count(combo) if combo is not None else None
            if not ready:
                time.sleep(g.get("lookup_filter_ms", 700) / 1000.0)
            # What the combo said before Enter is the one fact that separates "the master
            # has no such code" from "Enter went in before the filter ran" - and the log
            # is the only place the next person can read it.
            state = "selected a row" if ready else "selected nothing"
            found = "found" if combo is not None else "not found"
            self.log(f"  row {row_no} {col}: dropdown {state} after {time.time() - t0:.1f}s "
                     f"(combo={found}, selected={selected})")
            self._keys(g.get("lookup_commit_key", "{ENTER}"))
            time.sleep(g.get("lookup_wait_ms", 400) / 1000.0)
            if self._wait_resolved(grid, heads, index, row_no, g):
                if attempt:
                    self.log(f"  row {row_no} {col}: resolved on attempt {attempt + 1}")
                resolved[(row_no, col)] = True
                return True
            if attempt == attempts - 1:
                break
            cell = self._cell_for(grid, heads, index, row_no, col)
            if cell is None or not self._visible(cell):
                break
            self.log(f"  row {row_no} {col}: {value!r} did not resolve, typing it again "
                     f"({spent[(row_no, col)]} of {budget} attempts used)")
            cell.click_input()
            time.sleep(0.2)
            _, combo, landed = self._type_cell(cell, value, g)
            self._lookup_typed[(row_no, col)] = landed
        resolved[(row_no, col)] = False
        self.log(f"  row {row_no} {col}: never resolved against the master "
                 f"({spent.get((row_no, col), 0)} of {budget} attempts used); "
                 "the row read-back will decide")
        return False

    def _check_price(self, grid, heads, index, row_no, item, g):
        """PACT owns the unit price on this screen. Report what it used, never overrule it."""
        col = g.get("price_column")
        if not col:
            return
        by_col, _ = self._row_map(self._row(grid, index, row_no), heads)
        got = self._cell_text(by_col[col]) if col in by_col else ""
        want = str(item.get(g.get("price_key", "unit_price"), "") or "")
        self.grid_prices.append({"row": row_no,
                                 "product_code": item.get("product_code", ""),
                                 "pact_price": got, "expected": want})
        if want and not _same_number_or_text(got, want):
            note = (f"row {row_no} ({item.get('product_code', '')}): PACT priced this at {got or '0'}, "
                    f"the file expected {want}. PACT takes the rate from the product master - "
                    "it cannot be typed on this screen.")
            self.log("  " + note)
            self.grid_notes.append(note)

    def _settle_row(self, grid, heads, index, row_no, item, g):
        """Read the committed row back; retype anything PACT overwrote; then insist it is right."""
        keymap = g.get("item_keys", {})
        check = g.get("verify_columns", g["entry_columns"])
        passes = g.get("row_repair_passes", 2)

        def want_of(col):
            return str(item.get(keymap.get(col, col), "") or "")

        for attempt in range(passes + 1):
            by_col, _ = self._row_map(self._row(grid, index, row_no), heads)
            seen = {c: (self._cell_text(by_col[c]) if c in by_col else "") for c in check}
            self.log(f"  row {row_no} read back: {seen}")
            bad = [c for c in check if not _same_number_or_text(seen.get(c, ""), want_of(c))]
            if not bad:
                return
            if attempt == passes:
                break
            lookups = g.get("lookup_columns", [])
            budget = g.get("lookup_attempts_total", 5)
            spent = getattr(self, "_lookup_spent", {})
            exhausted = [c for c in bad if c in lookups and spent.get((row_no, c), 0) >= budget]
            if exhausted:
                # The master never answered for this code across every attempt the budget
                # allowed. Another repair pass would retype the same value into the same
                # cell and could not commit it; nothing about the answer can change, so
                # stop here and report what the grid shows.
                self.log(f"  row {row_no}: {exhausted[0]} still reads "
                         f"{seen.get(exhausted[0], '')!r} after the full lookup budget; "
                         "not repairing again")
                break
            for col in bad:
                cell = by_col.get(col)
                if cell is None or not self._visible(cell):
                    continue
                self.log(f"  row {row_no}: {col} is {seen.get(col)!r}, correcting to {want_of(col)!r}")
                cell.click_input()
                time.sleep(0.2)
                _, combo, landed = self._type_cell(cell, want_of(col), g, lookup=col in lookups)
                self._lookup_typed[(row_no, col)] = landed
                if col in lookups:
                    # a lookup is repaired the way it was filled: let the master filter and
                    # confirm it resolved. Plain keys plus Enter is what leaves it blank.
                    self._commit_grid_lookup(grid, heads, index, row_no, col,
                                             want_of(col), g, combo)
                else:
                    self._keys(g.get("commit_key", "{ENTER}"))
                time.sleep(g.get("row_commit_ms", 600) / 1000.0)

        col = bad[0]
        # Say which of the two failures this was. They need opposite fixes and guessing
        # wrong sends someone hunting through the product master for a code that is there.
        hint = ""
        if col in g.get("lookup_columns", []) and not seen.get(col):
            if getattr(self, "_lookup_typed", {}).get((row_no, col), True):
                hint = (f" The whole value reached the cell, so this master has no "
                        f"{want_of(col)!r} - or it is spelled differently there.")
            else:
                hint = (" The cell would not take the whole value: PACT is dropping "
                        "keystrokes while it queries the master. Raise cell_settle_ms "
                        "for this grid in the profile.")
        raise RobotError(
            f"grid row {row_no}: {col} should be {want_of(col)!r} but the grid still shows "
            f"{seen.get(col, '')!r} after {passes} correction attempt(s). Stopping this record - "
            "nothing was saved." + hint)


    def _scroll_row_into_view(self, grid, row, row_no: int):
        """Make sure the row is actually on screen, not behind the header or below the grid.

        The grid keeps its scroll position across New. After a run that pressed Enter on a
        few rows, the first visible row is 2 and row 1 sits behind the column header: its
        cells still report a rectangle, so a geometry check calls them visible, the click
        lands on the header, F2 opens nothing, and the value typed goes nowhere - or into
        a cell only a sliver of which is exposed, whose dropdown then never selects. Seen
        in a screenshot on 2026-09-08, after every probe of the day had left the grid one
        row down. ScrollIntoView is the WPF row's own pattern and is exact; Ctrl+Home on
        the grid is the fallback, and only when nothing is being edited.
        """
        try:
            hdr = self._find_in(grid, {"auto_id": "PART_ColumnHeadersPresenter"}, 1.0)
            gr = grid.element_info.rectangle
            top_limit = hdr.element_info.rectangle.bottom if hdr is not None else gr.top
            rr = row.element_info.rectangle
            hidden = rr.top < top_limit - 2 or rr.bottom > gr.bottom + 2 or rr.bottom - rr.top <= 0
        except Exception:
            return row
        if not hidden:
            return row
        try:
            row.iface_scroll_item.ScrollIntoView()
        except Exception:
            try:
                grid.set_focus()
                self._keys("^{HOME}")
            except Exception:
                return row
        time.sleep(0.35)
        self.log(f"grid: row {row_no} was scrolled out of view; brought it back")
        rows = self._grid_rows(grid)
        return rows[row_no - 1] if row_no - 1 < len(rows) else row

    def _row(self, grid, index: int, row_no: int):
        rows = self._grid_rows(grid)
        if index < len(rows):
            return self._scroll_row_into_view(grid, rows[index], row_no)
        try:                                # the grid virtualises: nudge it and look again
            grid.set_focus()
            self._keys("{DOWN}")
            time.sleep(0.3)
        except Exception:
            pass
        rows = self._grid_rows(grid)
        if index < len(rows):
            return rows[index]
        goto = self.profile.get("actions", {}).get("goto_line")
        if goto:
            self.log(f"row {row_no} not realised; trying GoToLine")
            try:
                self._do_action("goto_line", goto)
                self._keys(f"{row_no}{{ENTER}}")
                time.sleep(0.4)
            except Exception as e:
                self.log(f"GoToLine failed: {e}")
            rows = self._grid_rows(grid)
            if index < len(rows):
                return rows[index]
        raise RobotError(f"grid has {len(rows)} rows but line item {row_no} was asked for - "
                         "add rows in PACT or split the document")

    def _verify_row(self, grid, heads, index: int, row_no: int, item: dict):
        g = self.profile["grid"]
        keymap = g.get("item_keys", {})
        check = g.get("verify_columns", g["entry_columns"])
        rows = self._grid_rows(grid)
        if index >= len(rows):
            raise RobotError(f"grid row {row_no} vanished after commit - cannot verify it")
        by_col, _ = self._row_map(rows[index], heads)
        seen = {c: self._cell_text(by_col[c]) if c in by_col else "" for c in check}
        self.log(f"  row {row_no} read back: {seen}")
        for col in check:
            want = str(item.get(keymap.get(col, col), "") or "")
            if not _same_number_or_text(seen.get(col, ""), want):
                raise RobotError(
                    f"grid row {row_no}: {col} should be {want!r} but the grid shows "
                    f"{seen.get(col, '')!r}. Stopping this record - nothing was saved."
                    + (" A blank Product Code means PACT's product master has no such code."
                       if col in g.get("lookup_columns", []) and not seen.get(col) else ""))

    def read_line_items(self) -> list[dict]:
        g = self.profile.get("grid")
        if not g:
            return []
        keymap = g.get("item_keys", {})
        want = g["entry_columns"]
        grid = self._grid()
        heads = self._header_boxes(grid)
        out = []
        for row in self._grid_rows(grid):
            by_col, _ = self._row_map(row, heads)
            rec = {keymap.get(c, c): (self._cell_text(by_col[c]) if c in by_col else "")
                   for c in want}
            if any(v for v in rec.values()):
                out.append(rec)
        return out


    # ---------- reading ----------
    def read_back(self) -> dict:
        """Read current on-screen values for every field in the profile (tabs included).

        Fields are read tab by tab, so exactly one field per tab is the first one read
        after that tab is selected - and WPF has not necessarily populated the panel by
        then. That field, and only that field, came back empty while every other field on
        the same tab read correctly: `mode_of_transport` reported '' on a form where it
        plainly said BY ROAD, which failed the verifier and blocked the save. So a value
        that reads empty straight after a tab switch is read once more before it is
        believed. Only empty reads pay the extra wait.
        """
        out = {}
        fields = self.profile["fields"]
        just_switched = False
        for key in sorted(fields, key=lambda k: (fields[k].get("tab") or "", list(fields).index(k))):
            loc = fields[key]
            try:
                if loc.get("tab"):
                    before = self._tab
                    self.ensure_tab(loc["tab"])
                    just_switched = before != self._tab
                c = self._ctrl(loc, timeout=1.5)
                t = loc.get("type", "edit")
                if t == "edit":
                    out[key] = c.get_value() if hasattr(c, "get_value") else c.window_text()
                elif t == "date":
                    out[key] = self._read_lookup(c, loc.get("child_edit", "PART_TextBox"))
                elif t == "lookup_combo":
                    out[key] = self._read_lookup(c, loc.get("child_edit", "PART_EditableTextBox"))
                elif t == "combo":
                    v = c.selected_text() if hasattr(c, "selected_text") else c.window_text()
                    out[key] = v or ""          # an empty combo reports None, not ""
                elif t == "check":
                    out[key] = c.get_toggle_state() == 1
                elif t == "radio":
                    out[key] = c.is_selected()
                else:
                    out[key] = c.window_text()

                if just_switched and out[key] in ("", None):
                    time.sleep(0.6)                   # the panel had not painted yet
                    c = self._ctrl(loc, timeout=1.5)
                    again = c.get_value() if hasattr(c, "get_value") else c.window_text()
                    if again:
                        self.log(f"read back {key}: empty on the first read after the "
                                 f"{loc.get('tab')!r} tab switch, {again!r} on the second")
                        out[key] = again
                just_switched = False
            except Exception as e:
                out[key] = f"<unreadable: {e.__class__.__name__}>"
                just_switched = False
        return out

    def confirmation(self, timeout: float = 5.0) -> dict:
        conf = self.profile.get("confirmation")
        if not conf:
            return {"ok": None, "text": "", "record_id": None}
        deadline = time.time() + timeout
        text = ""
        while time.time() < deadline:
            try:
                c = self._ctrl({k: v for k, v in conf.items() if k in ("auto_id", "name", "title_re")}, timeout=1)
                text = c.window_text() or ""
            except Exception:
                text = ""
            if conf.get("success_re") and re.search(conf["success_re"], text):
                m = re.search(conf["success_re"], text)
                rid = m.groupdict().get("record_id") if m else None
                return {"ok": True, "text": text, "record_id": rid or _doc_no(self)}
            if conf.get("error_re") and re.search(conf["error_re"], text):
                return {"ok": False, "text": text, "record_id": None}
            time.sleep(0.25)
        return {"ok": None, "text": text, "record_id": None}

    def screenshot(self, path: Path):
        # capture_as_image() grabs the screen where the window is, so it must be on top first -
        # otherwise the verifier is shown whatever else was covering it.
        try:
            self.win.set_focus()
            time.sleep(0.35)
        except Exception:
            pass
        img = self.win.capture_as_image()
        path.parent.mkdir(parents=True, exist_ok=True)
        img.save(path)
        return path


def _doc_no(robot: "Robot"):
    """PACT stamps the document number into the doc-no box rather than the flash message."""
    loc = robot.profile.get("fields", {}).get("doc_no")
    if not loc:
        return None
    try:
        c = robot._ctrl(loc, timeout=1)
        v = (c.get_value() if hasattr(c, "get_value") else c.window_text()) or ""
        return v.strip() or None
    except Exception:
        return None


def _truthy(v):
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in ("1", "true", "yes", "y", "on", "active")


def _same(a, b) -> bool:
    return " ".join(str(a or "").split()).lower() == " ".join(str(b or "").split()).lower()


def _same_number_or_text(seen, want) -> bool:
    if _same(seen, want):
        return True
    try:
        return float(str(seen).replace(",", "")) == float(str(want).replace(",", ""))
    except (TypeError, ValueError):
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", default="practice")
    ap.add_argument("--json", required=True, help="record as JSON")
    ap.add_argument("--save", action="store_true")
    a = ap.parse_args()
    r = Robot(load_profile(a.profile)).attach()
    r.ensure_editable()
    r.new_record()
    r.fill(json.loads(a.json))
    print("on screen now:", json.dumps(r.read_back(), indent=2))
    if r.profile.get("grid"):
        print("line items:", json.dumps(r.read_line_items(), indent=2))
    if a.save:
        r.save()
        print("confirmation:", r.confirmation())


if __name__ == "__main__":
    main()
