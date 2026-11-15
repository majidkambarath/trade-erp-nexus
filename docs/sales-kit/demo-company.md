# The demo company

**Sahara Gate Foodstuff Trading LLC**, Ras Al Khor, Dubai. A foodstuff importer and distributor
that sells rice, sugar, edible oils, flour, pulses, tea and canned goods to supermarkets,
restaurants, caterers, hotels and one exporter in Oman. It is registered for VAT, uses three
banks, and has traded for the last 13 months.

The company, its customers, suppliers and people are made up. Phone numbers and email
addresses are fake (`@example.com`), so nothing sent from the demo can reach a real person.

## It is the same story every day

The demo company is rebuilt every night. It always holds the same 13 months of trading, ending
**today**. So "an invoice 48 days old" is always 48 days old, and the records below are always
there, whatever the date. If you change something during a demo, it is put back overnight.

Each salesperson has their own copy, so nobody breaks a colleague's demo. One more copy (the
"golden" company) is used only to record the videos and the click-through demos. Do not sign in
to it.

> **Status:** the nightly rebuild is Phase 2 of the sales-kit plan and is not built yet. This page
> is the specification the rebuild must meet, and the script relies on it. Amounts marked ✱ are
> the designed figures; the rebuild must produce exactly these.

## Who signs in

| Person | Role | Why they are there |
|--------|------|--------------------|
| You | Owner | You give the demo with full access |
| Fatima Hassan | Accountant | She gave the first approval on the large invoice (Act 5) |
| Ravi Menon | Sales | Shows a person who can sell but cannot see the books (Act 5) |
| Auditor | Viewer | Shows "look but do not touch" (Act 5) |

Company rule: an invoice over **AED 50,000** needs two different people to approve it.

## The records the script uses

"T" is today. Every date moves with it.

| # | What | Where to find it | Used in |
|---|------|------------------|---------|
| 1 | **Quotation to Royal Feast Catering Services LLC**, sent T-3, valid until T+11. 40 bags Basmati Rice 1121 40kg at 232, 20 tins Sunflower Oil 18L at 165. AED 13,209.00 with VAT ✱ | Sales > Quotations | Act 2 |
| 2 | **Sales order for Al Madina Fresh Supermarket LLC**, confirmed T-2, with a delivery note signed for by Khalid at T-1, **not invoiced yet**. AED 8,347.50 with VAT ✱ | Sales > Delivery notes (Delivered, not invoiced) | Act 2 |
| 3 | **Overdue invoice, Spice Garden Restaurant LLC**, dated T-48, terms Net 30, so 18 days late. AED 12,789.00 ✱ | Reports > Ageing; the customer's page | Acts 2 and 6 |
| 4 | **Large invoice waiting for a second approver, Green Basket Hypermarket LLC**, AED 62,832.00 ✱. Fatima has approved it once | Home > Approvals | Act 5 |
| 5 | **Coral Bay Grocery & Mini Market** owes about AED 56,000 against a credit limit of 60,000. A new order of 8,000 sets off the credit warning | Sales > Customers | Act 5 (optional) |
| 6 | **Two customer cheques in hand**: Bright Star Wholesale LLC, due T+2, AED 18,450.00 ✱; Al Reef Trading Co. LLC, due T+5, AED 24,300.00 ✱ | Finance > Cheques | Act 4 |
| 7 | **Emirates NBD statement imported up to yesterday**: reconciled to the end of last month, with about six new lines. Four have suggested matches, one is a bank charge, one is unknown | Finance > Reconcile | Act 4 |
| 8 | **VAT**: last quarter's return is finalised (that quarter is locked); this quarter's is saved as a draft | Reports > VAT | Act 4 |
| 9 | **Purchase order to Gulf Grain Importers LLC**, confirmed T-4, goods not received yet. 150 packs Basmati Rice 5kg, 60 bags White Long Grain Rice 25kg | Purchase > Orders | Act 3 |
| 10 | **Basmati Rice Premium 5kg is below its reorder level** | Reports > Stock (reorder) | Act 3 |
| 11 | **One batch of Pure Ghee expires within 25 days** | Inventory > Batches | Act 3 (optional) |
| 12 | **Last fiscal year is closed** (profit moved to retained earnings) and **months are closed up to the end of last month** | Accounts > Setup > Fiscal years | Act 4 / Act 6 |

## Lines behind the designed figures (for the nightly rebuild)

All at standard-rated VAT 5%.

| # | Lines | Net | With VAT |
|---|-------|-----|----------|
| 1 | 40 × RIC-BAS-40 @ 232; 20 × OIL-SUN-18 @ 165 | 12,580.00 | 13,209.00 |
| 2 | 100 × RIC-BAS-05 @ 29.50; 60 × SUG-WHT-10 @ 38; 40 × OIL-SUN-15 @ 68 | 7,950.00 | 8,347.50 |
| 3 | 50 × FLR-APF-50 @ 112; 30 × RIC-SEL-20 @ 78; 20 × OIL-GHE-16 @ 212 | 12,180.00 | 12,789.00 |
| 4 | 200 × RIC-BAS-40 @ 232; 80 × SUG-WHT-50 @ 168 | 59,840.00 | 62,832.00 |

Item codes are those in `trade ERP node/scripts/demo/abc-data.cjs`.

## What you should NOT quote from memory

Dashboard totals (revenue, margin, what customers owe) are worked out from 13 months of
trading. Read them off the screen; never say a number you remember from an earlier demo.
