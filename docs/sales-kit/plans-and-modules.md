# Plans and what is in them

Taken from the product's own plan table (`trade ERP node/utils/plans.js`) on 15 Nov 2026.
Prices are on the price list you were given, not here. The product team can switch a single
module or feature on or off for one client, so a plan is a starting point, not a cage.

## The ERP plans

| | **Standard** | **Premium** | **Trade only** |
|---|---|---|---|
| Who it is for | A trading company that wants its books in Zarvia | A larger company, more than one branch, or wanting everything | A company whose accountant keeps the books elsewhere |
| Sales, purchase, stock | ✓ | ✓ | ✓ |
| Quotations, delivery notes | ✓ | ✓ | ✓ |
| Batches and expiry | ✓ | ✓ | ✓ |
| Send invoices by email / WhatsApp | ✓ | ✓ | ✓ |
| Finance (receipts, payments, journals, expenses) | ✓ | ✓ | — |
| Accounts (chart, opening balances, year end) | ✓ | ✓ | — |
| Banks, cards and cheques | ✓ | ✓ | — |
| Foreign-currency receipts and payments | ✓ | ✓ | — |
| VAT return | ✓ | ✓ | — |
| Financial reports (P&L, balance sheet, ledgers) | ✓ | ✓ | — (dashboard and trade reports only) |
| Audit log | ✓ | ✓ | — |
| **Bank and card reconciliation** | — | ✓ | — |
| **IFRS statements** | — | ✓ | — |
| **E-invoicing** (test service only today) | — | ✓ | — |
| **More than one branch** | — | ✓ | — |
| CRM, HR | — | ✓ | — |
| Zarvia AI help | ✓ | ✓ | ✓ |
| People who can sign in | 10 | 50 | 10 |
| Trade documents a month | 2,000 | 20,000 | 2,000 |

Notes:

- On **Trade only** the invoices still post to the books behind the scenes (they must, or stock
  would have no cost). The client's people simply do not see the accounting screens. It can be
  upgraded later without re-entering anything.
- The demo company runs on **Premium**. If the client is buying Standard, do not show
  reconciliation, IFRS statements or branches as if they were included. Say "that is on Premium".

## Other plans (not part of this kit)

| Plan | What it is |
|------|------------|
| Trial | 14 days, limited features, 200 documents a month. **Not for demos**: no banking, VAT return or reconciliation |
| CRM only | Leads, deals, follow-ups, calendar. Deals are moved by hand (inside the ERP they move themselves from quotations and invoices) |
| HR only | Employee records, documents, expiry warnings |

## Add-ons switched on per client

- **Production**: materials and expenses into a product's cost, job work, process steps. For
  manufacturers.
- **Garage**: job cards, vehicles, insurance claims. For workshops.

Both need a separate demo with the product team.
