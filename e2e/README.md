# End-to-end browser checks

Each script starts its **own** backend and its **own** Vite on spare ports, on a **throwaway database** (made on the
cluster in the backend's `.env`, dropped at the end), drives a real browser through a real flow, and reads what happened
back from the database. It never touches your own dev servers or your own database, and it only ever drops the database
it made. They exist to catch what unit tests cannot: the two sides disagreeing about a shape.

```bash
npm run e2e                  # every script, one after another
npm run e2e -- rbac send     # only these
npm run e2e -- --list        # what there is
```

| Script | What it proves |
| --- | --- |
| `rbac` | A company's owner makes roles and people on the Users and roles screen, then each person signs in and does their job (or tries to do someone else's). Delete-approved, approval limits and second approver, roles by branch, forced password change. |
| `rbac-screens` | What the screens offer each role (hidden, never disabled). |
| `sales-docs` | Quotations, delivery notes, invoice from notes, the customer's Documents tab. |
| `bank-recon`, `bank-recon-2` | Bank statement import, matching, posting, finishing, cards, offsets, reopening. |
| `close-short` | Closing a sales order short (and reopening it). |
| `send` | Sending an invoice by email / WhatsApp, the public link, the history. |
| `dashboard` | The home dashboard, whole: real documents (a purchase, three sales invoices, a receipt on account, an expense), then every tab and view in a real browser - the stage strip, the ring, month by month, the flow diagram from the keyboard, the cash cycle, Sales / Inventory / Reports, a different period - checked against what the server sent and what the documents make; on a phone, with reduced motion, and in dark mode. |

**Needs:** a backend `.env` with `MONGO_URI` (an Atlas replica set: the backend uses transactions), `npm install` done in
both folders (puppeteer lives in the frontend). The backend is found at `../trade ERP node`; set `ERP_BACKEND_DIR` if yours is
elsewhere. Ports default per script (`E2E_API_PORT`, `E2E_WEB_PORT` override them). Screenshots go to `e2e/.out/<script>/`
(git ignores it; `E2E_OUT` moves it).

Run them **one at a time** (the runner does): they share ports, and the cluster caps the number of collections, so do not run
them while the backend test suite is running. A step that fails does not stop the story: the rest still runs and reports.

**Writing a script - three things that cost an afternoon each:**

- A script that makes its first records through the models (`new Admin(...).save()`) sets `process.env.TENANT_LEGACY_DEFAULT = "1"`
  at the top, and passes `TENANT_LEGACY_DEFAULT: "0"` to the backend it spawns (so the server under test stays strict). Without
  it the first save stops with "No organisation is in scope".
- Wait for `GET /api/v1/health` to answer `ready: true`, not just 200. A new throwaway database takes 30 seconds or more to build
  and adopt its first organisation; the server answers health at once, and a sign-in in that window is refused with
  `ORGANISATION_NOT_FOUND` (it waits 20 s, then gives up).
- Be patient with the screens: what a page offers depends on lists that arrive after the page does, and the first of them on a new
  database is slow. Wait for a button (`click` retries) instead of looking once. An item in a row's "more" menu is in the page
  but hidden (`display: none`) until the menu opens: look for it by being in the DOM, not by `offsetParent`.

When a screen's wording or layout changes on purpose, the script that clicks it by its label needs the same change; that is the
cost of a check that uses the product the way a person does.
