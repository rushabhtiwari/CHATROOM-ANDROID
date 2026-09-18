# Demo runbook — Order Automation

One page. The click order, and what to do when a step misbehaves.

---

## 0. Before anyone is watching

> **Open PACT and log into it before the demo starts, not during it.**
> PACT's own cold start — launching, authenticating, painting the document screen — takes
> the better part of a minute and there is nothing in this system that can make it faster.
> Every stage timing below assumes PACT is already open and on the Purchase Order screen.
> Doing this while an audience watches is the single largest avoidable delay in the demo.

```powershell
# 1. PACT RevenU — FIRST. Open it, log in, land on Purchase Order.
#    Close every other document tab. One open document, one keyboard focus.
#    Leave it open and visible for the whole demo: the robot reuses the attached
#    window across a batch, and closing it pauses the batch (recoverably).

# 2. KPAC — the robot that drives that window
cd C:\Users\prach\pact-automation
.\scripts\start.ps1                      # serves http://127.0.0.1:8765

# 3. KiranOS
cd C:\Users\prach\pact-automation\base-system\Kiran-Demo-Os-V1
.\start.ps1                              # API on :3001, console on :5173

# 4. The opening position: three orders, one at each gate
cd backend
python tools\seed_demo_orders.py
```

> **If the machine is short of memory, build the console and drop the node process.**
> Vite compiles on demand and holds a large heap; under pressure Windows kills it first.
> On 2026-09-08 it took the console down three times in one session at ~300 MB free, and
> `vite preview` — a plain static server — was killed too. The Python API survived every
> one of them, so it serves the console itself when the bundle exists:
>
> ```powershell
> cd master-frontend\varun
> npm run build                    # then the console is at http://localhost:3001
> ```
>
> One process, one origin, no proxy, and the console cannot be killed without the API
> going with it. Set `KIRANOS_APP_URL=http://localhost:3001` in `backend\.env` so the
> links inside customer mail point at the right place. Delete `dist\` to go back to the
> dev server. Use the dev server while editing the console, and rebuild after any change
> to it, or the API keeps serving the previous bundle.

Then open **the console → Automation → KPAC** (`/admin/automation/kpac`, on :5173 with the
dev server or :3001 when the API is serving the build) and check three lines before you
start talking:

| Line | Must say |
|---|---|
| KPAC | `reachable` |
| Loaded profile / Console expects | the **same** value, `pact_purchase_order` |
| Mode | `DRY RUN` to rehearse, `LIVE` to save a real draft |

**Recovery:** if KPAC says offline, the `start.ps1` window in `pact-automation` has died —
restart it. If the profiles differ, set `PROFILE=pact_purchase_order` in
`pact-automation\.env` and press *Reload settings* on KPAC's own page. Nothing will be
pushed while they differ, so this cannot go wrong quietly.

---

## The gates

**As configured now (`PACT_AUTO_RELEASE=true` in `backend\.env`) there is one click.** The
admin's approval acknowledges the customer, tasks the teams, and then the robot fills and
saves the PACT draft straight away; the proforma and the closing message follow. The
button reads *Approve and fill PACT*, and the Accounts queue is passed through by itself.
Set it to `false` to bring the second, Accounts, click back. Everything below describes
the states the order passes through either way.

Every order stops for a person; with two gates, twice:

```
PO arrives -> read -> automatic RECEIPT to the customer      (no gate)
                   -> AWAITING ADMIN APPROVAL

   admin approves  -> ACKNOWLEDGEMENT to the customer
                   -> tasks for Sales, Accounts, Manufacturing
                   -> AWAITING ACCOUNTS APPROVAL

   Accounts release-> ONE PACT Purchase Order draft, every line item, ONE Save Draft
                   -> demo proforma
                   -> closing message: document number, dispatch date, tracking link
                   -> team tasks closed
                   -> COMPLETED
```

There is no customer-facing gate and no timeout into any state. The customer is *told*
twice and *asked* nothing; an order nobody approves sits where it is.

---

## The click order

### 1 — Show the board

**http://localhost:5173/admin/automation/orders**

Three orders, deliberately at three different points:

| PO | Customer | State |
|---|---|---|
| `PO-MEG-2026-001` | Meghdoot | **Awaiting Admin Approval** — the one you will walk through |
| `PO-SAH-2026-014` | Sahyadri | Awaiting Accounts Approval — admin done, team tasked, PACT untouched |
| `PO-VAI-2026-007` | Vaijanti | Completed — through both gates, drafted, closed out |

**Recovery:** empty board → the seed did not run, or the API restarted after it. Re-run
`python tools\seed_demo_orders.py` and refresh; the console re-reads the ledger on the
next request, no restart needed.

### 2 — Open the Meghdoot order

The right pane is the whole journey. Point at the two gates: **nothing between them
happened without a person, and nothing past the second one is in the accounting system.**

The receipt is already green. Open it in the outbound list: it says *"We have received
your purchase order…"*. It does **not** say accepted, confirmed or approved. Those words
describe a decision to supply, and a machine sending them off a parsed PDF would be
agreeing to a contract nobody read. `mailing_messages.assert_receipt_wording` refuses to
render anything stronger, so a well-meant rewrite fails at the render rather than at a
customer.

Also worth pointing at: **line items**. The order's table is read row for row, and that
list is what reaches PACT — one document, one grid row per line, one Save Draft.

**Recovery:** a step showing red → hover it for the reason. Re-running any stage is
idempotent, so nothing is sent twice.

### 3 — Gate 1: the admin approves

Press **Approve** (or `POST /api/admin/mailing/jobs/{job}/approve`).

Three things happen at once, and the console shows all three:

- the customer gets the **acknowledgement** — this one *is* allowed to say the order was
  accepted, because by now a person has decided that it was;
- **Sales, Accounts and Manufacturing** each get a task, in the console's own notification
  panel and on the order;
- the order moves to **Awaiting Accounts Approval**.

Nothing has reached PACT. Say so out loud — it is the point of having two gates.

### 4 — Gate 2: Accounts release it into PACT

Press **Approve** on the Accounts queue (or `POST /api/admin/mailing/jobs/{job}/accounts-approve`).

Watch the PACT window: the robot clicks *New*, fills the header, switches to Extra Fields,
types **every line of the order** into the grid, runs its check, and commits with a single
**Save Draft** (Ctrl+Shift+D). One document number comes back and lands on the order.

Then:

- the **demo proforma** renders inline — watermarked DEMO, first line says it is not a tax
  invoice;
- the **closing message** goes to the customer with the document number, a dispatch date
  and a tracking reference. Both of those last two are **invented for the demo** and the
  message says so in its own first line;
- the three team tasks close, and a completion notice is posted.

**Recovery, three cases:**

| What you see | What it means | What to do |
|---|---|---|
| **KPAC paused** (amber) | The PACT window was closed or on a sign-in screen | Open PACT, log in, press the button again. Nothing was lost — the attempt is a row, and the retry is a new one. |
| **DRY RUN — nothing was saved** | KPAC is rehearsing | Expected in dry run. No document number means no proforma and no closing message, deliberately. Set `DRY_RUN=false` in `pact-automation\.env` for a real draft. |
| **customer not in PACT master: ⟨name⟩** | The name is not in PACT's vendor master, spelled identically | Add it in PACT, or add a translation to `PACT_MASTER_MAP`. The system will not guess or pick a near-match; that is how an order gets filed against the wrong company. |

### 5 — Press it again

Press the Accounts button a second time. Every step comes back green and marked
**idempotent**: no second PACT entry, no second bill, no second closing message. That is
what makes a paused window a recoverable inconvenience rather than a lost order.

### 6 — The multi-line order, if you have time

`PO-MEG-2026-015.pdf` carries three lines across two product codes. Send it and follow the
same two clicks. At the PACT step, count the grid rows: **three rows, one document, one
Save Draft.** One purchase order is one PACT document however many lines it has — the
extractor reads the table row for row, and `pact_bridge.build_line_items` maps every one.

---

## Speed

### What was slow, and what changed

`server/worker.py` built a **fresh `Robot` for every entry in a batch**. A `Robot` starts
with an empty resolved-control cache, and a cold UI Automation resolve on the PACT screen
costs **2–9 seconds per control** — the comment above `Robot._condition` in
`robot/fill.py` has the measurement. The `pact_purchase_order` profile has 16 fields plus
a tab switch plus the grid, so every row re-paid full resolution: on the order of a minute
of pure re-lookup per row, repeated for every row in the batch.

Three changes:

| Change | Effect |
|---|---|
| One `Robot` per batch (`server/worker.py`) | Row 1 resolves; rows 2..n reuse the cache. Also one attach, one `set_focus`, one document bind for the batch instead of one per row. |
| `new_record()` revalidates the cache instead of clearing it | New resets the bound data; it does not rebuild the visual tree. Dead wrappers are dropped on a liveness poke, live ones stay. |
| `VERIFY_MODE` (`.env`, default `first`) | The Claude vision check runs once per batch instead of once per row. The exact read-back check is local and free and still runs on every row. |

### The second pass: the lags between the stages

The robot's per-row cost was one thing; the waits *between* stages were another, and they
were where a demo audience actually felt the system drag. Each of these was measured from
the run log or the code and fixed without changing what any stage does:

| Where it lagged | Why | Now |
|---|---|---|
| A PO sat in the inbox for up to a minute (five after any hiccup) | The watcher logged in, searched and logged out once every 60s, doubling its wait after each failure up to 300s | One IMAP session stays open and **idles** on it (RFC 2177): the server pushes the arrival and the loop fetches within a second or two. `MAIL_POLL_SECONDS` (default 20) is only the ceiling. Backoff starts at 5s and caps at 60s. |
| The console froze while a PO was injected | `POST /direct-send` ran extraction and three SMTP round-trips *on the event loop*, which stalled the SSE stream and every other request until it finished | The ingest runs in a worker thread; the console stays live and the board updates as each step lands. |
| Every pipeline message paid a fresh SMTP login | Receipt, internal notices, proforma, closing message: one TCP+TLS+AUTH each, a couple of seconds apiece against Gmail | One SMTP session is kept for 45s and reused across a stage. A stale session is reopened once, transparently. |
| **PACT entry lagged at Product Code** for a minute or two | When the product master did not answer, the grid retried the lookup three times in the fill and three more in each of two repair passes: nine attempts, each burning the dropdown timeout and the resolve timeout, on a code that was never going to resolve. A second full wait followed on the way to Qty | One budget of `lookup_attempts_total` (5, in the profile) covers the fill and every repair pass; the redundant wait is skipped once the commit has already given up; the repair loop stops as soon as the budget is spent. The retry the log shows succeeding on attempt 2 still happens. The log now records what the dropdown said before Enter, so the next failure names its cause. |
| Qty took two tries every time | The hybrid write (ValuePattern then one typed key) lands the last digit at the *front* of a plain TextBox: `120` read back as `012`, then the plain-keys fallback fixed it | Plain cells type by keys first; the hybrid write is kept as the fallback. Lookup cells are unchanged. |
| The KPAC page always said `offline` | The console reads a `kpac` block from the automation summary that the backend never built | The summary probes KPAC (cached 4s, 2s timeout) and reports reachable / worker / mode / loaded profile, so the pre-demo check in step 0 works. |
| Small waits on the KPAC path | KiranOS polled the entry every 2s; the robot looked for approved rows every 0.7s | 1s and 0.25s. |

### Measure it yourself

With PACT open on the Purchase Order screen, from `C:\Users\prach\pact-automation`:

```powershell
python scripts\measure_speed.py --profile pact_purchase_order --rows 3
```

It fills the same rows twice — once rebuilding the `Robot` per row (the old behaviour) and
once reusing it (the new one) — and prints seconds per entry for each, plus the saving.
Nothing is ever saved: it never touches Save or Post. Use at least three rows; row 1 is
cold either way and the saving is in rows 2 onward.

The worker also logs its own per-stage timings for every entry now — look for
`timings (s): attach=… fill=… readback=… verify=… save=… total=…` in `logs/runs.log`.

### Two escape hatches, in `pact-automation\.env`

```ini
VERIFY_MODE=every              # a vision check per row, if you want it back
COLD_CACHE_EACH_RECORD=true    # throw the cache away after every New (the old behaviour)
```

Set `COLD_CACHE_EACH_RECORD=true` if a batch ever fills a row with values from the previous
one — that is what a stale cached control would look like. It has not been seen, and the
read-back check and the verifier both sit in front of a Save, but the switch is there.

### Nothing here fixes PACT's cold start

Opening PACT and logging in is slow and always will be. Do it before the demo. It is in
step 0 for a reason.

---

## Sending real mail

Everything above works with no mail credentials: each message is written to the ledger and
shown in the console, and says plainly that it was not transmitted. To make it actually
send, put two values in `backend\.env`:

```ini
SMTP_SEND=true
IMAP_USER=you@gmail.com
IMAP_APP_PASSWORD=your-google-app-password    # an app password, not the account password
DEMO_MAIL_REDIRECT=you@gmail.com              # see below
DEMO_MAIL_ALLOWED=                            # any other address you deliberately allow
DEMO_MAIL_ALLOWED_DOMAINS=gmail.com           # or a whole domain — see "anyone can send"
```

**`SMTP_SEND` is `false` by default and should stay that way for a rehearsal.** The closing
message states a dispatch date and a tracking reference that do not exist. Even with
sending on, `po_pipeline.may_transmit` refuses any recipient that is not a reserved demo
domain, the `DEMO_MAIL_REDIRECT` inbox, an address listed in `DEMO_MAIL_ALLOWED`, or a
domain listed in `DEMO_MAIL_ALLOWED_DOMAINS` — the
message is still written to the ledger, and the console says why it was not transmitted.
That guard is in code rather than in this document because one wrong environment variable
is otherwise all that stands between a rehearsal and a real customer being told their
non-existent consignment has shipped.

The IMAP and SMTP hosts are inferred from the address, so those four lines are the whole of
it. You can also type the address and app password into the console at `/admin/mailing` —
credentials entered there are sealed to disk and outrank the env file.

**Why `DEMO_MAIL_REDIRECT`.** The demo customers live on reserved `.example` domains,
which can never receive mail. That is on purpose: it is not possible to write to a real
company by accident. Set the redirect to an inbox you own and every customer-facing message
is delivered there instead, subject-prefixed with who it was written for, with both
addresses kept on the ledger. Leave it blank and nothing customer-facing leaves the machine.

**Recovery:** messages showing *recorded* rather than *sent* → `SMTP_SEND` is not `true`, or
no mailbox is connected. The order is unaffected either way; a transport failure never
unwinds a committed order.

---

## Recording with the demo PO PDFs — the simplest live run

Eight ready-made purchase orders. Every vendor is a real row of this PACT's vendor master,
and every product is one of that vendor's own products, harvested from the live window and
verified the strict way (typed, resolved). Anyone can send them from any Gmail address.

### Why "that vendor's own products"

PACT filters the Product Code dropdown to the products linked to the vendor in the header.
Walked with no vendor selected, every row of the product master resolves; the same code
typed after a vendor is selected finds nothing, and the grid stays blank. That is what
`44223` did on 2026-09-08, and why one code resolved for M K MOBILES the day before and
never for M S Enterpries. So the snapshot records products **per vendor**, and the
generator takes each order's codes from its vendor's list.

### Make them

```powershell
# 1. read the masters off the live PACT window (PACT open, on Purchase Order; saves nothing)
cd C:\Users\prach\pact-automation
python scripts\harvest_pact_master.py --vendors 8 --products 8      # the vendors
python scripts\harvest_pact_master.py --per-vendor --products 5     # each vendor's products

# 2. write the PDFs from that snapshot, reading each back through the pipeline's extractor
cd base-system\Kiran-Demo-Os-V1\backend
python tools\make_client_pos.py
```

The harvester writes `demo\pact_master_snapshot.json`; the generator refuses any vendor
without typed-verified products. If PACT's masters move again, the symptom in
`logs\runs.log` is `dropdown selected nothing ... (combo=found, selected=0)`, and
re-running both steps is the fix. Paste the harvester's *usable vendors* into
`PACT_MASTER_MAP` in `backend\.env` as identity mappings and restart the API.

| File | Vendor | Lines | Products |
|---|---|---|---|
| `PO-MKI-2026-201.pdf` | M.K.INDUSTRIES | 2 | **start with this one** — stripper plate, lithium grease |
| `PO-BRT-2026-202.pdf` | M/s B R Traders | 2 | air coolers |
| `PO-MRE-2026-203.pdf` | M.r. Enterprises | **3** | weighing machines — the multi-line order: one PO, one PACT document, three grid rows |
| `PO-MJC-2026-204.pdf` | M.J.COMFORT | 2 | lithium grease, polyester yarn |
| `PO-AWI-2026-205.pdf` | M/s Accurate Weight Industries | 2 | first aid box, cast iron weights |
| `PO-MAM-2026-103.pdf` | M.a. Mannan Silk Lining House | 3 | polyester thread |

Everything else that was ever in `demo-pos\` now sits in `demo-pos\superseded\` and must
not be sent. `PO-MEG / PO-SAH / PO-VAI / PO-NIL` name the four "(Demo)" companies, which
this PACT's vendor master no longer holds. `PO-MKM-2026-101` and `PO-MSE-2026-102` were
dropped on 2026-09-08 for the same reason: typing `M K` or `M S` into the vendor lookup
now leaves nothing selected, and Down+Enter on that unfiltered list lands on
`M.a. Mannan Silk Lining House` — a real but completely different company. The robot
refuses that near-match by design, so those two orders fail at the first field.

Every order is written as a column table so the product code is read off the document
itself rather than defaulted; the rate on the document will not match, because PACT takes
the rate from its product master and the column cannot be typed - KPAC records that as a
price note on the row.

### Send one

**Subject:** `Kiran Order PO-MEG-2026-014`
**Body:** anything — *"Please find attached our purchase order."* is enough
**Attach:** the matching PDF
**From:** any Gmail address

That is the whole instruction to give whoever is sending it. The covering note carries no
figures at all: **every value comes out of the PDF.** The PO number, the customer, the
quantity, the total, the delivery date, the product code, the rate, the terms, the
transporter and the packing note are all read from the attachment.

### Why it works

Three settings, already in `backend\.env`:

```ini
TRUSTED_SENDER_DOMAINS=gmail.com   # read Gmail senders instead of quarantining them
```

`kiran order` is a built-in order marker, so that subject line classifies as an order on
its own. And `TRUSTED_SENDER_DOMAINS` decides only whether a message is **read** — who the
order is *for* still comes from the document and still has to resolve in PACT's master, so
a trusted domain cannot smuggle in an unknown customer.

The customer name is taken from the PDF (`For Meghdoot Auto Components Pvt Ltd (Demo)`),
which is why these four work with no `PACT_MASTER_MAP` entry: those names are already in
PACT's vendor master.

### What lands in PACT

Filled from the customer's own document, not from defaults:

```
vendor_name            Meghdoot Auto Components Pvt Ltd (Demo)
party_ref_no           PO-MEG-2026-014
mode_of_transport      BY ROAD
transporter            VRL Logistics
delivery_terms         EX WORKS
payment_terms          30 DAYS
packing_instruction    Wooden crates, palletised
shipping_instructions  Meghdoot Auto Components Pvt Ltd (Demo), Pune
line_items             [{product_code: 46893, qty: 1800, unit_price: 265.0}]
```

For `PO-MEG-2026-015` that last line is three entries rather than one, and they become three
rows in the grid of the **same** document before the single Save Draft.

### Reading the PDF, and what it will not do

`app/pdf_text.py` pulls the text layer out with nothing but `zlib` — no wheels to install
the morning of a demo. It reads any PDF written by a word processor or an accounting
package.

It does **not** do OCR. A photographed or scanned order has no text layer, comes back
empty, and lands in the OCR-failure queue — correctly. Returning a guess would be worse
than returning nothing. So the demo PDFs are generated text-layer documents, and a
filename containing *photo, scan, fax, camera, img_* or *whatsapp* forces that branch on
purpose.

---

## Recording with a REAL purchase order from a colleague

This is the version worth filming, and it needs three things the synthetic demo does not.

### Before you ask them to send it

**Check the draft first.** One command, and it saves discovering on camera that the
extractor could not find a delivery date:

```powershell
cd C:\Users\prach\pact-automation\base-system\Kiran-Demo-Os-V1\backend
python tools\check_po_email.py --template                       # a body known to work
python tools\check_po_email.py --from buyer@theircompany.com    # check theirs
```

**Send them this.** Every line matters — the four fields each have to match a pattern, and
a missing delivery date is the most common reason an order parks itself as an exception:

```
Subject: Purchase Order PO-ACM-2026-014

Dear Sir,

Please supply 12,000 m of cable protection sleeving against this purchase order.

PO number: PO-ACM-2026-014
Quantity: 12,000 m
Value: Rs 1,80,000
Delivery: 2026-10-15

Kindly acknowledge receipt.

Regards,
Purchase Department
Acme Engineering Pvt Ltd
```

**They must attach a PDF.** Without one the message loses 0.18 of confidence and parks as
`LOW_CONFIDENCE`. Any PDF will do, but the filename must not contain *photo, scan, fax,
camera, img_* or *whatsapp* — those force the OCR-failure branch on purpose.

### What will happen, and why it is worth showing

Their domain is not whitelisted, so the message is **quarantined as `UNKNOWN_DOMAIN` before
extraction is attempted**. That is not a hitch to apologise for — it is the intake filter
refusing to spend a model call on a stranger, and it is a good thirty seconds of film.

**On Hold queue → the message → Whitelist**, and give it a company name. Every message from
that domain is re-ingested at once, and the pipeline runs on from there.

⚠ **The name you whitelist it as is what PACT then has to resolve.** Two routes:

| Route | What to do | On camera |
|---|---|---|
| **Map it** | Whitelist under their real company name, then put `PACT_MASTER_MAP=Acme Engineering Pvt Ltd=Meghdoot Auto Components Pvt Ltd (Demo)` in `backend\.env` and restart the API | ✅ their real name shows throughout |
| **Whitelist directly** | Whitelist the domain as `Meghdoot Auto Components Pvt Ltd (Demo)` | one step fewer, but their real name never appears |

Get it wrong and the PACT step fails with `customer not in PACT master: ⟨name⟩` — loudly, by
design, because guessing is how an order gets filed against the wrong company.

### Mail settings for a real sender

In `backend\.env`:

```ini
SMTP_SEND=true
IMAP_USER=you@gmail.com
IMAP_APP_PASSWORD=your-16-char-app-password
DEMO_MAIL_REDIRECT=you@gmail.com                       # keep this pointed at YOUR inbox
DEMO_MAIL_ALLOWED=colleague@theircompany.com           # and name them explicitly
INTERNAL_NOTIFY_ADDRESSES=you@gmail.com
```

If you want your colleague to actually receive the receipt, name their address in
`DEMO_MAIL_ALLOWED`. That is deliberately a second, explicit step: `may_transmit` refuses
every recipient that is not a reserved demo domain, the redirect inbox, or on that list, so
"I set SMTP_SEND and forgot what else was queued" cannot mail a real company.

### Anyone can send — `DEMO_MAIL_ALLOWED_DOMAINS`

Naming one address at a time is right when you know who is sending. It is wrong for the
demo this is usually shown in, where a client or a colleague sends a purchase order from
whatever address is to hand: `TRUSTED_SENDER_DOMAINS=gmail.com` lets the order be **read**,
but every reply written for that person is then refused at the wire because nobody added
their exact address to a list first. The order runs; the sender hears nothing, which looks
like the automation is broken.

```ini
TRUSTED_SENDER_DOMAINS=gmail.com        # anybody on gmail may send an order
DEMO_MAIL_ALLOWED_DOMAINS=gmail.com     # ...and be answered at that address
```

Set as a pair, the same population that may send is the population that may be answered.
Everything outside those domains is still refused, so a real company on its own domain
cannot be mailed a fabricated dispatch date by accident. Both are blank in
`.env.example`: opting a domain in is a decision that real mail leaves this machine, and
it belongs in one visible line rather than in a default.

⚠ **Think before you add them.** The receipt is safe — it says only that a document
arrived. The **closing message is not**: it states a dispatch date and a tracking reference
that are invented. It labels itself a demonstration in its first line, but a real person
receiving a shipping confirmation for a consignment that does not exist is still a real
problem. For a filmed run with a real colleague, the honest options are to stop after the
proforma, or to tell them in advance what the last message is.

### To save a real PACT draft rather than rehearse

In `C:\Users\prach\pact-automation\.env` — KPAC's file, **not** KiranOS's:

```ini
DRY_RUN=false
```

then restart `pact-automation\scripts\start.ps1`. The KPAC & PACT page will read
`Mode: LIVE`. In dry run the robot fills the form and discards it, so no document number
comes back and no proforma is generated — correct behaviour, and the reason a rehearsal
looks "incomplete" at that last step.

### The order to film it in

1. PACT already open and logged in, visible beside the console on the Orders board.
2. Colleague sends the PO.
3. Mailing Hub — it arrives, quarantined. Explain why.
4. Whitelist the domain. It re-ingests in front of you.
5. Order Automation — the new order, at **Awaiting Admin Approval**. Receipt and internal
   notification already green; everything past the gate grey.
6. Their inbox: the receipt. Read the wording aloud — *received*, never *accepted*.
7. **Approve** as the admin. Acknowledgement out, three team tasks created, order moves to
   the Accounts queue. Nothing in PACT yet — say so.
8. **Approve** as Accounts.
9. The PACT window fills — header, Extra Fields tab, every line item into the grid — and
   saves the draft. One document number lands on the order.
10. The proforma renders inline; the closing message goes out with the document number.
11. Press the Accounts button again — every step comes back **idempotent**.

---

## The Purchase-Order-instead-of-Sales-Order simplification

**This demo files an incoming customer PO on PACT's _Purchase Order_ screen, not its Sales
Order screen. That is a shortcut, and here is exactly what it costs.**

KiranOS ingests a purchase order that a *customer* sent *to* Kiran, so Kiran is the seller
and the document is a sale. In a full implementation it belongs on PACT's **Sales Order**
screen, where the party lookup resolves against the **customer** master.

The screen this demo drives is Kiran's own **Purchase Order** screen, where Kiran is the
buyer and the party lookup resolves against the **vendor** master. It is used because it is
the one proven working against the live window: four capabilities — the party lookup, the
date field, the Extra Fields tab and keyboard-driven grid entry — were built and verified
against it, and a real draft was saved from it.

**What this means in practice:** the four demo customers are registered in PACT's **vendor**
master. They are synthetic companies with a `(Demo)` suffix, so nobody browsing that master
in six months mistakes them for real suppliers.

**What it does not mean:** it is not a claim about the accounting. A PACT draft created this
way is on the wrong side of the ledger and would be wrong to post — which is one more reason
the robot only ever saves a draft and the `post` action is not wired up anywhere.

**Moving to Sales Order** is one configuration value, not a code change:

```ini
KPAC_PROFILE=pact_sales_order
```

What that will need first: a `profiles\pact_sales_order.json` in `pact-automation`, the four
customers in PACT's **customer** master, and the Sales Order party lookup re-tuned — that
screen is much heavier than Purchase Order and its dropdown behaves differently. The console
already reads the profile from configuration and shows a red banner if KPAC has a different
one loaded than expected, so a half-finished switch cannot quietly fill the wrong document.

---

## The four rules the system will not let you break

1. **It never Posts.** KPAC commits with Save Draft only. The `post` action is unwired in
   the robot and uncalled in the backend, and no setting reaches it.
2. **It never guesses a customer.** An unknown name fails that order with
   `customer not in PACT master: ⟨name⟩` and stops.
3. **It never advances itself.** Both gates are people. There is no timeout, threshold or
   flag that moves an order past either — an order nobody approves sits where it is.
4. **It never produces a tax invoice.** The renderer refuses to return a document that
   describes itself as one or carries a GSTIN, a tax breakdown or bank details.

---

## If you need to start over

```powershell
cd C:\Users\prach\pact-automation\base-system\Kiran-Demo-Os-V1\backend
python tools\seed_demo_orders.py          # resets the ledger and re-seeds
```

The console picks it up on the next refresh. To prove the whole flow without the UI:

```powershell
python tools\run_pipeline_demo.py                        # the multi-line PO, KPAC faked
python tools\run_pipeline_demo.py --po PO-MEG-2026-014   # the single-line one
python tools\run_pipeline_demo.py --live                 # the same, driving the real PACT window
```

It walks one order through both gates and prints the stage timings, the line items it read,
the record KPAC receives (count the grid rows), and where every message went. Every line is
read back out of the ledger afterwards rather than asserted by the script.

### Reference timings

From a laptop with KPAC faked — the ledger and messaging work only, PACT excluded:

```
  intake + receipt                0.10s
  admin approval                  0.08s
  accounts approval + PACT        2.09s     (2s of this is KPAC's poll interval)
  TOTAL                           2.27s
```

The pipeline itself is not where the time goes. Everything that feels slow in a live demo
is either PACT's cold start (do it beforehand — step 0) or UI Automation resolving controls
in the PACT window (see **Speed** above, and measure it with
`pact-automation\scripts\measure_speed.py`).
