# Demo customers — synthetic, for the KPAC demo only

Create these four in **PACT's customer master** (test company: KIRAN CABLE PROTECTION
PRODUCTS PRIVATE LIMITED [Index 13]) with the names spelled **exactly** as below, and add the
same four to KiranOS demo data under the identical names so identity mapping resolves.

| # | Name (use verbatim in both systems) | City |
|---|---|---|
| 1 | Meghdoot Auto Components Pvt Ltd (Demo) | Pune |
| 2 | Sahyadri Electricals Pvt Ltd (Demo) | Nashik |
| 3 | Vaijanti Industrial Systems Pvt Ltd (Demo) | Aurangabad |
| 4 | Nilkanth Engineering Works Pvt Ltd (Demo) | Mumbai |

## Why the "(Demo)" suffix

These are invented companies. The suffix means nobody browsing PACT's customer master in six
months mistakes them for real customers, and it cannot accidentally collide with a real firm of
a similar name. It reads as normal demo data to a client audience. Drop it only if you have a
reason to, and if you do, tell KPAC — the names must match character-for-character in both systems.

## Email addresses

`demo/demo_customers.csv` has placeholder addresses. Replace `REPLACE-WITH-YOUR-TEST-INBOX`
with an inbox **you own** before any run. `EMAIL_MODE=sandbox` should keep mail from leaving
regardless, but the addresses on record must never be real customer addresses.

## Alphabetical placement

M / S / V / N — these sit well past the A-range the customer dropdown opens on, so the lookup
must actually filter rather than land on the first row. That is deliberate: it tests the fix.

## Still needed: product codes

Customers are only half of a Sales Order. The grid needs product codes from PACT's **product**
master. Enumerate them off the Sales Order grid's Product Code dropdown the same way the
customer master was enumerated, pick 3–4 real ones, and record them here.
