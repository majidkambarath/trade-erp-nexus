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

**Needs:** a backend `.env` with `MONGO_URI` (an Atlas replica set: the backend uses transactions), `npm install` done in
both folders (puppeteer lives in the frontend). The backend is found at `../trade ERP node`; set `ERP_BACKEND_DIR` if yours is
elsewhere. Ports default per script (`E2E_API_PORT`, `E2E_WEB_PORT` override them). Screenshots go to `e2e/.out/<script>/`
(git ignores it; `E2E_OUT` moves it).

Run them **one at a time** (the runner does): they share ports, and the cluster caps the number of collections, so do not run
them while the backend test suite is running. A step that fails does not stop the story: the rest still runs and reports.

When a screen's wording or layout changes on purpose, the script that clicks it by its label needs the same change; that is the
cost of a check that uses the product the way a person does.
