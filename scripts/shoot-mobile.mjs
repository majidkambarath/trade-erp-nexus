// Screenshots the app at phone, tablet and desktop width, against a stub API, so the layout
// can be looked at without a database behind it.
//
//   node scripts/shoot-mobile.mjs                  all three widths, default page list
//   node scripts/shoot-mobile.mjs /sales-order     one page
//
// The stub answers every /api/v1 call with a small, plausible payload: enough rows to show a
// list, a party, a voucher. It is for looking at layout, nothing else.
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import puppeteer from "puppeteer";
// the same responses the screen tests use, so the sweep and the tests cannot drift apart
import { POSITION_REGROUPED as POSITION, PROFIT_WITH_DISCOUNTS as PROFIT, EQUITY, CASH, NOTES_REGROUPED as NOTES } from "../src/lib/__tests__/ifrsFixtures.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.SHOT_DIR || join(ROOT, ".shots");
// The order lists open on the current calendar month and cut to it in the browser, so the stub's order rows are dated in it
// (a fixed October date would leave an empty list - and no row to open - in any other month).
const THIS_MONTH = new Date().toISOString().slice(0, 7);
const API_PORT = 4477;
const WEB_PORT = 5177;

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "tablet", width: 820, height: 1180, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "desktop", width: 1440, height: 900, deviceScaleFactor: 1 },
];

// Every page the app navigates to, read from the one place that lists them, so a screen
// added to the product is checked here without anyone remembering to add it.
const { MODULES } = await import("../src/config/navigation.js");
// Screens worth opening past their first screen, and how to get there. The labels are what a
// person would tap, matched on visible text, so these survive markup changes.
// What the sweep's signed-in administrator holds: everything any page asks for, so no page is hidden from the measurement.
const ALL_GRANTS = [...new Set([
  ...MODULES.flatMap((m) => m.tabs.flatMap((t) => [].concat(t.permission || []))),
  ...Object.entries({
    crm: ["view", "create", "edit", "delete", "assign", "manage"],
    sales: ["view", "create", "edit", "approve", "delete", "send", "creditOverride"], purchase: ["view", "create", "edit", "approve", "delete"],
    inventory: ["view", "create", "edit", "delete", "adjust"], finance: ["view", "create", "edit", "approve", "delete"], banking: ["view", "manage", "reconcile"],
    accounts: ["view", "manage", "close"], reports: ["view", "financial", "vat"], users: ["view", "manage"], settings: ["view", "manage"],
    audit: ["view"], lookups: ["view"],
  }).flatMap(([m, actions]) => actions.map((a) => `${m}.${a}`)),
])];
// Files a step can choose in a dialog's file input (`upload: "leads"`), written once to a throwaway folder. The lead sheet has
// every column, a blank row and a row with no name, so the preview has something to say about each kind of row.
const FIXTURE_DIR = mkdtempSync(join(tmpdir(), "erp-sweep-"));
const FIXTURES = Object.fromEntries(
  Object.entries({
    leads: ["leads.csv", "Name,Company,Phone,Email,City,Source,Wants,Value,Owner,Notes\nHassan Al Noor,Al Noor Foods Trading,+971 50 123 4567,hassan@alnoor.example,Dubai,Referral,200 bags of flour a week,45000,,\nFatima Noor,Noor Supermarket,0501110000,,Sharjah,Walk-in,Price list,12000,Maya Khan,Asked on Friday\n,,,,,,,,,\n,Brand New Co,0502223333,,Ajman,Website,,,,\n"],
    people: ["people.csv", "Name,Job title,Email,Phone,Company,Notes\nOmar Hassan,Purchasing manager,omar@alnoor.example,+971 50 123 4567,Al Noor Foods Trading,Prefers a call before 11\nPriya Nair,Owner,priya@example.com,+971 55 987 6543,,Met at the expo\n"],
  }).map(([key, [file, text]]) => {
    const path = join(FIXTURE_DIR, file);
    writeFileSync(path, text);
    return [key, path];
  })
);

const DEEP = {
  // CRM: the board with its stage columns, the lead form and one lead's own page, the worklist's Done dialog (which
  // asks what came of it and plans the next one), and the pipeline editor - the tallest form of the five.
  "crm-pipeline": [
    { name: "board", page: true, clicks: [], settle: 1100 },
    { name: "board-move", clicks: ["^Move$"], settle: 900 },
    { name: "board-new-deal", clicks: ["^New deal"], settle: 1000 },
    { name: "board-lost", clicks: ["^Lost$"], settle: 900 },
    // one deal's own page: how it got here (what the documents did) and what has happened
    { name: "deal", page: true, clicks: ["^Monthly rice and sunflower oil$"], settle: 1100 },
    { name: "deal-move", clicks: ["^Monthly rice and sunflower oil$", "^Move$"], settle: 1000 },
    { name: "deal-log", clicks: ["^Monthly rice and sunflower oil$", "^Log a follow-up$"], settle: 1000 },
    { name: "deal-edit", clicks: ["^Monthly rice and sunflower oil$", "^Edit$"], settle: 1000 },
    { name: "deal-email", clicks: ["^Monthly rice and sunflower oil$", "^Write to the customer$"], settle: 1100 },
  ],
  // The CRM workspace's landing page: what is late, what is mine, and what the documents moved on their own.
  "crm-dashboard": [{ name: "crm-home", page: true, clicks: [], settle: 1100 }],
  "crm-contacts": [
    { name: "contacts", page: true, clicks: [], settle: 1000 },
    { name: "contact-new", clicks: ["^New contact"], settle: 1000 },
    { name: "contact-view", page: true, clicks: ["^Rajesh Kumar$"], settle: 1100 },
    { name: "contact-edit", clicks: ["^Rajesh Kumar$", "^Edit$"], settle: 1000 },
    { name: "contact-import", clicks: ["^Import$"], settle: 900 },
    { name: "contact-import-match", clicks: ["^Import$"], upload: "people", settle: 1300 },
  ],
  "crm-communications": [
    { name: "communications", page: true, clicks: [], settle: 1000 },
    { name: "communications-calls", page: true, clicks: ["^Calls$"], settle: 900 },
  ],
  "crm-leads": [
    { name: "leads", page: true, clicks: [], settle: 1000 },
    { name: "lead-new", clicks: ["^New enquiry"], settle: 1000 },
    { name: "lead-view", page: true, clicks: ["LD-2026-0001"], settle: 1100 },
    { name: "lead-qualify", clicks: ["LD-2026-0001", "^Qualify$"], settle: 1100 },
    { name: "lead-log", clicks: ["LD-2026-0001", "^Log a follow-up$"], settle: 1000 },
    // bringing a spreadsheet in: choosing the file, matching its columns (eleven fields, the tallest step), and the preview
    // arranging a meeting: the tallest dialog in the CRM (a date, a time, a length, a place, people and a note)
    { name: "lead-meeting", clicks: ["LD-2026-0001", "^Arrange a meeting$"], settle: 1100 },
    // writing to the customer: a tall dialog (template picker, addresses, the people chips, subject, a nine-row message)
    { name: "lead-email", clicks: ["LD-2026-0001", "^Write to them$"], settle: 1100 },
    { name: "lead-import", clicks: ["^Import$"], settle: 900 },
    { name: "lead-import-match", clicks: ["^Import$"], upload: "leads", settle: 1300 },
    { name: "lead-import-preview", clicks: ["^Import$"], upload: "leads", after: ["^Check the file$"], settle: 1500 },
  ],
  "crm-calendar": [
    { name: "calendar", page: true, clicks: [], settle: 1100 },
    { name: "calendar-enquiries", page: true, clicks: ["^Enquiries$"], settle: 900 },
    { name: "calendar-next", page: true, clicks: ["^Next month$"], settle: 1000 },
  ],
  "crm-follow-ups": [
    { name: "followups", page: true, clicks: [], settle: 1000 },
    { name: "followup-done", clicks: ["^Done$"], settle: 1000 },
    { name: "followups-today", page: true, clicks: ["^Today"], settle: 900 },
    { name: "followups-board", page: true, clicks: ["^Board$"], settle: 1100 },
    { name: "followups-board-people", page: true, clicks: ["^Board$", "^By person$"], settle: 1100 },
  ],
  "crm-reports": [{ name: "reports", page: true, clicks: [], settle: 1100 }],
  "crm-setup": [
    { name: "setup", page: true, clicks: [], settle: 1100 },
    // a stage's timing opened, then the unsaved-changes bar (adding a stage is the quickest edit) - the bar sticks to
    // the bottom of its panel, so on a phone it has to sit clear of the bottom navigation
    { name: "setup-timing", page: true, clicks: ["^Follow-up in 3 days"], settle: 900 },
    { name: "setup-unsaved", page: true, clicks: ["^Add a stage"], settle: 1000 },
  ],
  // Users and roles: the dialogs behind the two tabs. The role editor is the tallest form in the product (every module's boxes).
  // The customer master's own dialog. It had no deep step at all, so the party form - the widest form
  // in the product, and now the one where a phone is entered in two halves (the dialling code, then
  // the number) - had never been measured at 390px.
  "sales-customers": [
    { name: "customer-new", clicks: ["^Add Customer$"], settle: 1000 },
  ],
  "people-users-and-roles": [
    { name: "add-person", clicks: ["Add a person"], settle: 900 },
    { name: "change-person", clicks: ["^Change"], settle: 900 },
    // "Different role in a branch": two rows on a phone is the tallest the section gets; Imran Ali already holds one
    { name: "add-person-branch-roles", clicks: ["Add a person", "Add a branch", "Add a branch"], settle: 900 },
    { name: "change-person-branch-roles", clicks: ["^Change Imran"], settle: 900 },
    // clearing someone's two-factor (a lost phone): the confirmation names the consequence
    { name: "reset-two-factor", clicks: ["Reset two-factor for"], settle: 900 },
    { name: "roles", page: true, clicks: ["^Roles$"], settle: 900 },
    { name: "new-role", clicks: ["^Roles$", "New role"], settle: 1100 },
    { name: "built-in-role", clicks: ["^Roles$", "^View$"], settle: 1100 },
  ],
  // Accounting setup, Fiscal years: closing a year is a long dialog (the checks, the figures, what the next year opens with),
  // and reopening one is another. The stub returns a year with a blocker, a warning and two branches: the tallest it gets.
  "accounts-setup": [
    { name: "close-year", clicks: ["^Fiscal years$", "^Close year$"], settle: 1100 },
    { name: "reopen-year", clicks: ["^Fiscal years$", "^Reopen$"], settle: 1100 },
    // the same two for a month of the open year (the Month end panel under the years): checks, warnings to tick, stock against the ledger
    { name: "close-month", clicks: ["^Fiscal years$", "^Close month$"], settle: 1100 },
    { name: "reopen-month", clicks: ["^Fiscal years$", "^Reopen month$"], settle: 1100 },
    // Numbering: the three views, and the form where a number's shape is set (its live preview, the
    // grouped lists and the gap report are all wide things on a phone).
    { name: "numbering", page: true, clicks: ["^Numbering$"], settle: 1100 },
    { name: "numbering-edit", clicks: ["^Numbering$", "^Edit Sales invoice$"], settle: 1100 },
    { name: "numbering-new", clicks: ["^Numbering$", "^New voucher type$"], settle: 1100 },
    { name: "numbering-counters", page: true, clicks: ["^Numbering$", "^Counters$"], settle: 1000 },
    { name: "numbering-deleted", page: true, clicks: ["^Numbering$", "^Deleted & gaps$"], settle: 1100 },
  ],
  // The item form: goods (every stock field), then a service (the Goods / Service choice, no stock fields, two account pickers).
  "inventory-stock-items": [
    { name: "add-item", clicks: ["^Add Stock Item"], settle: 900 },
    // an amount typed in: the field draws the grouping the organisation's country uses as the digits arrive
    { name: "add-item-amount", clicks: ["^Add Stock Item"], type: [["Enter purchase price", "2000000"]], reveal: "^Pricing Information", settle: 900 },
    { name: "add-service", clicks: ["^Add Stock Item", "^Service"], settle: 900 },
  ],
  // Production: the form (materials and cost lines, the live unit cost) and one posted production with its breakdown
  "inventory-production": [
    // the board (opens first): counts, columns per step, my work, what is with job workers; Done on my work
    { name: "board", page: true, clicks: [], settle: 1100 },
    { name: "board-done", clicks: ["^Done$"], settle: 900 },
    // process orders: the list, the form with its steps, one order's step timeline, the finish dialog
    { name: "process", page: true, clicks: ["^Process orders$"], settle: 1000 },
    { name: "process-new", clicks: ["^Process orders$", "^New process order"], settle: 1100 },
    { name: "process-view", clicks: ["^Process orders$", "^View PRO-2026-0001"], settle: 1100 },
    { name: "process-finish", clicks: ["^Process orders$", "^View PRO-2026-0002", "^Finish$"], settle: 1100 },
    { name: "process-add-cost", clicks: ["^Process orders$", "^View PRO-2026-0001", "^Add cost$"], settle: 1100 },
    // phase 2: saved routes (the list and one route's form) and the analysis
    { name: "routes", page: true, clicks: ["^Routes$"], settle: 1000 },
    { name: "route-form", clicks: ["^Routes$", "^Open the route for"], settle: 1100 },
    { name: "analysis", page: true, clicks: ["^Analysis$"], settle: 1100 },
    { name: "new", clicks: ["^Productions$", "^New production"], settle: 1100 },
    { name: "posted", clicks: ["^Productions$", "^View PRD-2026-0001"], settle: 1100 },
    { name: "cost", page: true, clicks: ["^Product cost$"], settle: 1000 },
    // job work: the send form, one job's challan with what came back, and the receive dialog
    { name: "job-work", page: true, clicks: ["^Job work$"], settle: 1000 },
    { name: "job-work-send", clicks: ["^Job work$", "Send to job worker"], settle: 1100 },
    { name: "job-work-challan", page: true, clicks: ["^Job work$", "^View JWC-2026-0001"], settle: 1300 },
    { name: "job-work-receive", clicks: ["^Job work$", "^View JWC-2026-0001", "Receive back"], settle: 1100 },
  ],
  // The approvals list: a voucher opens on the page, with its own Approve and Reject (the tables and cards are the page itself).
  "home-approvals": [
    { name: "voucher", clicks: ["^Open JV-2026-0012"], settle: 1200 },
    // The bell's feed. It is in the top bar of every page, so one step is enough: it is a panel hanging off
    // the bell from md up and the bottom sheet below, and this sweep measures both widths.
    { name: "notifications", clicks: ["^Notifications"], settle: 900 },
  ],
  // The cheque register puts "Audit trail" on the row itself, so the densest dialog in the
  // app is one tap away - the posting table inside it is what this check exists for.
  "finance-cheques": [{ name: "audit", clicks: ["Audit trail"], settle: 1400 }],
  // Copying a voucher opens the ordinary form, but with a much longer title ("New journal voucher,
  // copied from JV-2026-0012") and a two-sentence description: at 390px those are what can overflow.
  "journal-voucher": [{ name: "copy", clicks: ["^Copy "], settle: 900 }],
  "expense-voucher": [{ name: "copy", clicks: ["^Copy "], settle: 900 }],
  // A quotation and a delivery note are each a printed document with a row of actions above it, and
  // dialogs behind those. `page: true` means the step lands on a page, not a dialog.
  // The Sending tab with "your own mail server" chosen: five more fields and a warning, on a phone.
  "settings-settings": [
    { name: "smtp", page: true, clicks: ["^Sending$", "Your own mail server"], settle: 800, reveal: "^Mail server" },
    // Branches: the list, then the add dialog (a form someone fills in on a phone).
    { name: "branches", page: true, clicks: ["^Branches$"], settle: 1000 },
    { name: "add-branch", clicks: ["^Branches$", "Add a branch"], settle: 900 },
    // Security: the password panel with the two-factor panel under it (on, with two recovery codes left: the tallest state), and
    // the two dialogs that ask for the password AND a code. The enrolment dialog (QR code, key, code box) needs typing to reach.
    { name: "security", page: true, clicks: ["^Security$"], settle: 1000 },
    { name: "two-factor-off", clicks: ["^Security$", "Turn off two-factor"], settle: 900 },
    { name: "two-factor-new-codes", clicks: ["^Security$", "New recovery codes"], settle: 900 },
  ],

  "sales-quotations": [
    { name: "document", page: true, clicks: ["^View$"], settle: 1500 },
    { name: "convert", clicks: ["^View$", "Convert to sales order"], settle: 1300 },
    // the shared order form, configured as a quotation (valid until, terms, reference)
    { name: "form", page: true, clicks: ["^New quotation"], settle: 1500 },
  ],
  // Orders: the list, one order with its progress panel, and the dialog that makes the invoice from what has arrived
  "sales-orders": [
    { name: "document", page: true, clicks: ["^View$"], settle: 1500 },
    { name: "form", page: true, clicks: ["^New sales order"], settle: 1500 },
    { name: "form-add-line", page: true, clicks: ["^New sales order", "^Add line"], settle: 1300 },
  ],
  "purchase-orders": [
    { name: "document", page: true, clicks: ["^View$"], settle: 1500 },
    { name: "invoice", clicks: ["^View$", "Create invoice"], settle: 1300 },
    { name: "form", page: true, clicks: ["^New purchase order"], settle: 1500 },
    { name: "form-add-line", page: true, clicks: ["^New purchase order", "^Add line"], settle: 1300 },
  ],
  "purchase-goods-received": [
    { name: "new", clicks: ["New goods receipt"], settle: 900 },
    { name: "from-order", page: true, clicks: ["New goods receipt", "against a purchase order"], settle: 1500 },
    { name: "own-form", page: true, clicks: ["New goods receipt", "on its own"], settle: 1500 },
    { name: "document", page: true, clicks: ["^View$"], settle: 1500 },
    { name: "receive", clicks: ["^View$", "Confirm goods received"], settle: 1300 },
  ],
  "sales-delivery-notes": [
    { name: "new", clicks: ["New delivery note"], settle: 900 },
    // both ways to make one: against a sales order (its own form), and on its own (the shared order form)
    { name: "from-order", page: true, clicks: ["New delivery note", "against a sales order"], settle: 1500 },
    { name: "own-form", page: true, clicks: ["New delivery note", "on its own"], settle: 1500 },
    { name: "document", page: true, clicks: ["^View$"], settle: 1500 },
    { name: "deliver", clicks: ["^View$", "Mark delivered"], settle: 1300 },
  ],
  // The sales order list and the invoice behind a row. Send is a VISIBLE control on the row and the card, and
  // on the document screen; the dialog behind it is a form someone fills in on a phone.
  // The page opens on its dashboard, so the first tap is "View all invoices". A row's View is the eye (labelled
  // with the number) on a wide screen and the word View on a card, so the match is "View" then a number or the end.
  "sales-invoices": [
    { name: "list", page: true, clicks: ["^View all invoices"], settle: 1200 },
    // Zarvia AI opens from the top bar on every screen, so it is measured on this one: the panel
    // with its suggestions, then a real exchange with its citation and its link button.
    { name: "assistant", clicks: ["^Ask Zarvia AI$"], settle: 900 },
    { name: "assistant-answer", clicks: ["^Ask Zarvia AI$", "^How do I raise an invoice\?$"], settle: 1100 },
    { name: "document", page: true, clicks: ["^View all invoices", "^View( [0-9]|$)"], settle: 1600 },
    { name: "send", clicks: ["^View all invoices", "^View( [0-9]|$)", "^Send$"], settle: 1800 },
    { name: "send-row", clicks: ["^View all invoices", "^Send (SO|[0-9])"], settle: 1600 },
    { name: "history", clicks: ["^View all invoices", "^View( [0-9]|$)", "^Send history$"], settle: 1500 },
    // the audit trail, from the button on a card
    { name: "audit", cards: true, clicks: ["^View all invoices", "^Audit trail$"], settle: 1600 },
    // the entry form behind the Add button, and a second line added on it: the form a phone has to fill in
    { name: "form", page: true, clicks: ["^New sales invoice"], settle: 1600 },
    { name: "form-add-line", page: true, clicks: ["^New sales invoice", "^Add line"], settle: 1300 },
  ],
  // The other three order modules have the same dashboard-then-list shape, the same cards, and the same dialogs behind them.
  "purchase-invoices": [
    { name: "list", page: true, clicks: ["^View all purchase invoices"], settle: 1200 },
    { name: "document", cards: true, page: true, clicks: ["^View all purchase invoices", "^View( [0-9]|$)"], settle: 1600 },
    { name: "audit", cards: true, clicks: ["^View all purchase invoices", "^Audit trail$"], settle: 1600 },
    { name: "form", page: true, clicks: ["^New purchase invoice"], settle: 1600 },
    { name: "form-add-line", page: true, clicks: ["^New purchase invoice", "^Add line"], settle: 1300 },
  ],
  "sales-returns": [
    { name: "list", page: true, clicks: ["^View all sales returns"], settle: 1200 },
    { name: "audit", cards: true, clicks: ["^View all sales returns", "^Audit trail$"], settle: 1600 },
    { name: "form", page: true, clicks: ["^New sales return"], settle: 1600 },
    { name: "form-add-line", page: true, clicks: ["^New sales return", "^Add line"], settle: 1300 },
  ],
  "purchase-returns": [
    { name: "list", page: true, clicks: ["^View all purchase returns"], settle: 1200 },
    { name: "audit", cards: true, clicks: ["^View all purchase returns", "^Audit trail$"], settle: 1600 },
    { name: "form", page: true, clicks: ["^New purchase return"], settle: 1600 },
    { name: "form-add-line", page: true, clicks: ["^New purchase return", "^Add line"], settle: 1300 },
  ],
  // Banks: the institutions, then one bank's own accounts (a table in a dialog) and the chart's own
  // account form opened from there with the bank already chosen.
  "accounts-banks": [
    { name: "accounts", clicks: ["^Accounts at Emirates NBD"], settle: 1000 },
    { name: "add-account", clicks: ["^Accounts at Emirates NBD", "^Add a bank account$"], settle: 1400 },
  ],
  // Bank reconciliation: every dialog is a table of figures or a form someone fills in on a phone.
  "finance-reconcile": [
    { name: "import", clicks: ["^Import a statement$"], settle: 900 },
    { name: "set-up", clicks: ["^Set up$"], settle: 1100 },
    { name: "find", clicks: ["Find another"], settle: 1100 },
    { name: "post", clicks: ["Post an entry"], settle: 1300 },
    { name: "card", clicks: ["^Card settlement$"], settle: 1300 }, // the button on a line, not the tab named Card settlements
    { name: "ignore", clicks: ["^Ignore$"], settle: 900 },
    { name: "statement", clicks: ["^History$", "^Statement$"], settle: 1300 },
  ],
};
// a single-page run (`npm run check:mobile -- /bank-reconciliation`) names the page after its path
DEEP["banks"] = DEEP["accounts-banks"]; // check:mobile -- /banks
DEEP["bank-reconciliation"] = DEEP["finance-reconcile"];
DEEP["accounting-setup"] = DEEP["accounts-setup"]; // check:mobile -- /accounting-setup
DEEP["sales-order"] = DEEP["sales-invoices"]; // a single-page run (check:mobile -- /sales-order): the sales INVOICE list
DEEP["quotations"] = DEEP["sales-quotations"]; // check:mobile -- /quotations
DEEP["purchase-order"] = DEEP["purchase-invoices"]; // ... and likewise for the other three order modules
DEEP["sales-return"] = DEEP["sales-returns"];
DEEP["purchase-return"] = DEEP["purchase-returns"];
DEEP["goods-received"] = DEEP["purchase-goods-received"];
DEEP["delivery-notes"] = DEEP["sales-delivery-notes"]; // a single page run (check:mobile -- /delivery-notes) is named by its path
DEEP["settings"] = DEEP["settings-settings"]; // check:mobile -- /settings
DEEP["approvals"] = DEEP["home-approvals"]; // check:mobile -- /approvals (the bell's feed is one of its steps)
DEEP["production"] = DEEP["inventory-production"]; // check:mobile -- /production
DEEP["dashboard"] = DEEP["crm-dashboard"]; // check:mobile -- /crm/dashboard
DEEP["contacts"] = DEEP["crm-contacts"]; // check:mobile -- /crm/contacts
DEEP["communications"] = DEEP["crm-communications"]; // check:mobile -- /crm/communications
DEEP["calendar"] = DEEP["crm-calendar"]; // check:mobile -- /crm/calendar
DEEP["reports"] = DEEP["crm-reports"]; // check:mobile -- /crm/reports
DEEP["pipeline"] = DEEP["crm-pipeline"]; // check:mobile -- /crm/pipeline
DEEP["leads"] = DEEP["crm-leads"]; // check:mobile -- /crm/leads
DEEP["follow-ups"] = DEEP["crm-follow-ups"]; // check:mobile -- /crm/follow-ups
DEEP["users"] = DEEP["people-users-and-roles"]; // check:mobile -- /users
DEEP["stock-item-creation"] = DEEP["inventory-stock-items"]; // check:mobile -- /stock-item-creation
DEEP["customer-creation"] = DEEP["sales-customers"]; // check:mobile -- /customer-creation
// The developer console's modules panel: one module opened (its parts, what people can do, who gets it), then every module
// opened at once (the tallest the panel gets), on a new organisation and on one organisation's Plan tab. The page is measured,
// not a dialog, and `reveal` scrolls the part the step is about into view so the screenshot shows it.
const MODULE_STEPS = [
  { name: "module-open", page: true, clicks: ["^Inventory details "], reveal: "^Parts of Inventory", settle: 700 },
  { name: "modules-open", page: true, clicks: ["^Expand all$"], reveal: "^Who gets it", settle: 900 },
  // a switch changed: the unsaved-changes bar is fixed to the bottom of the window, clear of the last card (Plan tab only)
  { name: "modules-unsaved", page: true, clicks: ["^Finance$"], settle: 600 },
];
DEEP["console-new-organisation"] = MODULE_STEPS;
DEEP["platform-new"] = MODULE_STEPS; // check:mobile -- /platform/new
DEEP["console-organisation-plan"] = MODULE_STEPS;
DEEP["platform-organisations-gulf-fresh-tab-plan"] = MODULE_STEPS; // check:mobile -- /platform/organisations/gulf-fresh?tab=plan

/**
 * The first visible, enabled control whose text or label matches. It looks again for up to `patience` ms: the first viewport of
 * a cold run can be reloaded by Vite when it finds a new dependency in a lazy chunk, and a control that is not there YET is not a
 * control that is missing (the approvals step was skipped on the phone, and only on the phone, for exactly that).
 */
async function findByText(page, label, patience = 4000) {
  const until = Date.now() + patience;
  for (;;) {
    // a radio option is a label around the input, not a button: the Sending setup's "how email is sent"
    const handles = await page.$$("button, a[href], [role='button'], label:has(input[type='radio'])");
    for (const h of handles) {
      const ok = await page.evaluate(
        (el, want) => {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return false;
          if (el.disabled) return false;
          const text = `${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`.trim();
          return new RegExp(want, "i").test(text);
        },
        h,
        label
      );
      if (ok) return h;
    }
    if (Date.now() >= until) return null;
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * Controls and headings that sit partly or wholly OUTSIDE a box that clips them (overflow hidden / clip), so they can be neither
 * reached nor read. The page itself fits, so the overflow checks never see this: a card with `overflow-hidden` holding a row of
 * buttons wider than the card simply loses its last buttons. Runs in the page. `rootSel` is a selector, or "dialog" for the top one.
 */
function findCutOff(rootSel) {
  const root = rootSel === "dialog" ? [...document.querySelectorAll('[role="dialog"]')].pop() : document.querySelector(rootSel);
  if (!root) return [];
  const out = [];
  const nodes = root.querySelectorAll("a[href], button, [role='button'], [role='tab'], input:not([type='hidden']), select, textarea, h1, h2, h3");
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    if (r.width <= 4 || r.height <= 4 || st.visibility === "hidden" || st.display === "none" || st.position === "fixed") continue;
    if (el.closest("[data-print-preview], .sr-only, [aria-hidden='true']")) continue;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === "visible") continue;
      if (ps.overflowX === "auto" || ps.overflowX === "scroll") break; // it scrolls: whatever is outside can be reached
      const b = p.getBoundingClientRect();
      if (b.width <= 0) break;
      const cut = Math.round(Math.max(r.right - b.right, b.left - r.left, 0));
      if (cut > 2) {
        const what = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 26);
        const cls = String(p.className?.baseVal ?? p.className ?? "").split(" ").filter(Boolean).slice(0, 2).join(".");
        out.push(`"${what}" ${cut}px outside ${p.tagName.toLowerCase()}.${cls}`);
      }
      break; // the nearest clipping box decides
    }
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * A box that scrolls vertically only because something INVISIBLE hangs below its content. `overflow-x: auto` makes the other
 * axis `auto` too, so a row's `absolute ... invisible` menu (opacity 0, still in layout) that reaches below the last row gave the
 * table's card its own scroll area: a blank strip under the rows and a second scrollbar inside the page. The page fits, so no other
 * check sees it. A box meant to scroll vertically has a height limit (`max-height`, or a height of its own), so only an auto-height
 * box with a vertical overflow is reported. Runs in the page.
 */
function findGhostScroll(rootSel) {
  const root = document.querySelector(rootSel);
  if (!root) return [];
  const out = [];
  for (const el of root.querySelectorAll("*")) {
    const st = getComputedStyle(el);
    if (st.overflowY !== "auto" && st.overflowY !== "scroll") continue;
    if (st.maxHeight !== "none" || el.clientHeight <= 0) continue;
    const hidden = el.scrollHeight - el.clientHeight;
    if (hidden <= 2) continue;
    // an element whose height was set on purpose (a style) scrolls on purpose
    if (el.style.height) continue;
    const cls = String(el.className?.baseVal ?? el.className ?? "").split(" ").filter(Boolean).slice(0, 2).join(".");
    out.push(`${hidden}px of nothing to scroll to in ${el.tagName.toLowerCase()}.${cls}`);
    if (out.length >= 4) break;
  }
  return out;
}

/** Measure the topmost dialog the way a pane is measured. */
async function measureDialog(page) {
  const res = await page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
    const box = dlg || document.querySelector("main") || document.documentElement;
    const opened = Boolean(dlg);
    const text = (box.innerText || "").trim().length;
    // the dialog's own scrolling body is what overflows, not the dialog element
    const panes = [box, ...box.querySelectorAll("*")].filter((el) => {
      // an A4 preview is a fixed 210mm sheet in a pane that scrolls on purpose; it is the page
      // around it that has to fit
      if (el.closest("[data-print-preview]")) return false;
      // a strip of tabs scrolls sideways on purpose (Settings has six; the bar is meant to be swiped)
      if (el.getAttribute("role") === "tablist" || el.querySelector(":scope > [role='tablist']")) return false;
      // the line-items grid scrolls inside its own card on purpose (below md it becomes a card per line)
      if (el.querySelector(":scope > table[role='grid']")) return false;
      // On a PAGE (no dialog open), a table of figures that must line up is allowed to scroll sideways under a
      // pinned first column - that is the house rule. Inside a dialog it is not: there is nowhere to scroll to,
      // which is why `table-stack` exists. So this exemption applies only when nothing is open over the page.
      if (!dlg && el.classList.contains("table-pin-first")) return false;
      const st = getComputedStyle(el);
      return st.overflowX === "auto" || st.overflowX === "scroll";
    });
    let worst = { sw: 0, w: 1, what: "dialog" };
    for (const el of [box, ...panes]) {
      if (el.scrollWidth - el.clientWidth > worst.sw - worst.w) {
        worst = { sw: el.scrollWidth, w: el.clientWidth, what: el === box ? "dialog" : "pane" };
      }
    }
    const wide = [...box.querySelectorAll("table")]
      .filter((t) => t.getBoundingClientRect().width > box.clientWidth + 4)
      .slice(0, 3)
      .map((t) => `table ${Math.round(t.getBoundingClientRect().width)}px in ${box.clientWidth}px`);
    // when something bleeds, name the first elements that stick out past the screen, so it is found, not guessed
    if (worst.sw > worst.w + 4) {
      for (const el of box.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > window.innerWidth + 4) wide.push(`${el.tagName.toLowerCase()}.${String(el.className || "").toString().split(" ")[0]} ${Math.round(r.width)}px "${(el.textContent || "").trim().slice(0, 28)}"`);
        if (wide.length >= 6) break;
      }
    }
    return { opened, text, bleeds: worst.sw > worst.w + 4, sw: worst.sw, w: worst.w, what: worst.what, wide };
  });
  res.cutOff = await page.evaluate(findCutOff, res.opened ? "dialog" : "main");
  // a list's own box scrolling over nothing (an invisible menu hanging below its last row) shows only on a page, not in a dialog
  if (!res.opened) res.cutOff.push(...(await page.evaluate(findGhostScroll, "main")));
  return res;
}

// Screens with no navigation entry of their own. The public document link is the only page a customer ever
// sees, so it is checked like any other: a phone is exactly where it will be opened.
// The developer console is a second app inside this one (its own sign-in, its own frame), also reached by address only.
const EXTRA_PAGES = [
  ["share", "/d/ABCDEFGHJKM.demo-token-demo-token-demo-token-demo-tok"],
  ["console-organisations", "/platform"],
  ["console-new-organisation", "/platform/new"],
  ["console-organisation", "/platform/organisations/gulf-fresh"],
  ["console-organisation-plan", "/platform/organisations/gulf-fresh?tab=plan"],
  ["console-activity", "/platform/activity"],
  ["console-developers", "/platform/developers"],
  ["console-security", "/platform/security"],
  // reached while signed OUT, from the sign-in page and from the emailed link
  ["forgot-password", "/forgot-password"],
  ["reset-password", "/reset-password?token=Zq3_-aB9Zq3_-aB9Zq3_-aB9Zq3_-aB9Zq3_-aB9xyz"],
];
const PAGES = [
  ["login", "/"],
  // <module id>-<tab slug>, except that a one-tab module whose id already ends in its own slug is not said twice:
  // the CRM workspace's sections are ids like "crm-leads" with a single "Leads" tab, and this keeps their shot
  // names (and their DEEP steps) exactly what they were when the CRM was one module with five tabs.
  ...MODULES.flatMap((m) =>
    m.tabs.map((t) => {
      const slug = t.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      return [m.id.endsWith(slug) ? m.id : `${m.id}-${slug}`, t.to];
    })
  ),
  ...EXTRA_PAGES,
];

// ---------------------------------------------------------------- the stub API

const party = (i) => ({
  _id: `p${i}`, id: `p${i}`, name: `Al Noor Trading ${i}`, customerName: `Al Noor Trading ${i}`,
  vendorName: `Gulf Supply ${i}`, partyName: `Al Noor Trading ${i}`, code: `CUST20260${i}`,
  balance: 12480.5 * i, documents: 3 + i, overdue: i % 2 ? 2400 : 0, utilisation: 40 + i * 7,
  creditLimit: 100000, status: ["ok", "near", "over", "no-limit"][i % 4], terms: "30 days",
  documents: [], contacts: [], bankAccounts: [], vat: {}, credit: {},
  ageing: [1000, 500, 0, 0, 0], total: 1500, invoices: [], expired: false,
});

const voucher = (i) => ({
  _id: `v${i}`, voucherNo: `RV-2026-000${i}`, date: "2026-10-0" + ((i % 9) + 1),
  partyName: `Al Noor Trading ${i}`, totalAmount: 1250.75 * i, status: "approved",
  paymentMode: ["cash", "bank", "cheque"][i % 3], entries: [], linkedInvoices: [],
  ledgerBased: true, narration: "Against invoice SO-2026-004" + i, currency: "AED",
  accountName: `Account ${i}`, accountCode: `100${i}`, expenseAccountName: `Expense ${i}`,
  partyType: "customer", vatTotal: 62.5 * i,
});

// how each of the first six went to the customer: opened, none (a draft), failed, never sent, none, WhatsApp
const SENDS = {
  1: { sendId: "s1", channel: "email", status: "SENT", at: "2026-10-06T10:32:00.000Z", to: "ali@alnoor.ae", openedAt: "2026-10-07T08:00:00.000Z", error: null },
  3: { sendId: "s3", channel: "email", status: "FAILED", at: "2026-10-06T10:32:00.000Z", to: "ali@alnoor.ae", openedAt: null, error: "The mailbox is full" },
  6: { sendId: "s6", channel: "whatsapp", status: "HANDED_OFF", at: "2026-10-06T10:32:00.000Z", to: "971501112222", openedAt: null, error: null },
};
const doc = (i) => ({
  _id: `d${i}`, id: `d${i}`, partyId: `p${i}`, transactionNo: `SO-2026-004${i}`, date: `${THIS_MONTH}-0${(i % 9) + 1}`,
  deliveryDate: "2026-10-1" + ((i % 9) + 1), customerName: `Al Noor Trading ${i}`,
  vendorName: `Gulf Supply ${i}`, status: ["APPROVED", "APPROVED", "DRAFT"][i % 3], lastSend: SENDS[i] || null,
  totalAmount: 12480.5 * i,
  // unpaid, partly paid, paid, and a row whose amounts never arrived: each must fit a phone card (lib/paymentStatus.js)
  ...[{ paidAmount: 0, outstandingAmount: 12480.5 * i }, { paidAmount: 5000, outstandingAmount: 12480.5 * i - 5000 }, { paidAmount: 12480.5 * i, outstandingAmount: 0 }, {}][i % 4],
  // real lines have names and prices; one is long on purpose, because that is what breaks a card
  items: [
    { description: "Basmati rice 5kg, long grain, premium export pack", qty: 6, rate: 20 },
    { description: "Sunflower oil 1.8L", qty: 24, rate: 11.5 },
    { description: "Sugar 50kg", qty: 2, rate: 118 },
  ],
  priority: "normal", createdBy: "Admin",
  invoiceGenerated: i % 2 === 0, type: "sales_order", pricing: {},
});

const cheque = (i) => ({
  _id: `c${i}`, chequeNo: `0012${i}`, chequeDate: "2026-10-1" + ((i % 9) + 1),
  partyName: `Al Noor Trading ${i}`, amount: 5400 * i, status: ["pending", "cleared", "bounced"][i % 3],
  direction: i % 2 ? "receipt" : "payment", voucherNo: `RV-2026-000${i}`, matured: i % 2 === 0,
  drawnOnBankName: "Emirates NBD", bankAccountName: "Current account",
});

const account = (i) => ({
  _id: `a${i}`, accountName: `Cash in hand ${i}`, accountCode: `1010${i}`, balance: 8800 * i,
  name: `Cash in hand ${i}`, code: `1010${i}`, isActive: true, bankName: "Emirates NBD",
  bank: { bankName: "Emirates NBD", accountNumberMasked: "•••• 4421", iban: "AE07 0331 2345 6789 0123 456" },
});

const bank = (i) => ({
  _id: `b${i}`, bankName: `Emirates NBD ${i}`, bankCode: `ENBD${i}`, swiftCode: "EBILAEAD",
  city: "Dubai", country: "UAE", branches: [{}, {}], isActive: true,
});

// ---- quotations and delivery notes: the shape the server's present() gives each, including `actions`
// (the server decides who may do what) and the joined stock details a printed copy reads.
const QSTATES = ["DRAFT", "SENT", "ACCEPTED", "SENT", "CONVERTED", "REJECTED"];
const quotationActions = (s, expired) => ({
  edit: s === "DRAFT", delete: s === "DRAFT", send: s === "DRAFT", accept: s === "SENT" && !expired,
  reject: ["SENT", "ACCEPTED"].includes(s), convert: ["SENT", "ACCEPTED"].includes(s) && !expired, revise: ["SENT", "ACCEPTED", "REJECTED"].includes(s),
});
const quotation = (i) => {
  const status = QSTATES[i - 1];
  const expired = i === 4; // a sent offer past its date
  return {
    _id: `q${i}`, quotationNo: `QT-2026-000${i}`, reference: i % 2 ? `RFQ-${40 + i}` : "", partyId: `p${i}`,
    party: { customerName: `Al Noor Trading ${i}`, customerId: `C00${i}` }, date: "2026-10-0" + i, validUntil: expired ? "2026-10-01" : "2026-11-0" + i,
    totalAmount: 2646 * i, status, displayStatus: expired ? "EXPIRED" : status, expired, daysLeft: expired ? -5 : 20 - i,
    actions: quotationActions(status, expired), items: [{}, {}, {}],
  };
};
const stockDetails = { itemId: "ITM001", itemName: "Basmati Rice 5kg", barcode: "", brand: "", origin: "", currentStock: 240, unit: "BAG" };
const docLine = (i) => ({
  _id: `l${i}`, itemId: `s${i}`, itemCode: `ITM00${i}`, description: `Basmati Rice ${i * 5}kg`, qty: 10 * i, price: 42, discountPercent: 0, discountAmount: 0,
  grossAmount: 420 * i, taxableAmount: 420 * i, vatPercent: 5, vatAmount: 21 * i, lineTotal: 441 * i, stockDetails,
});
const docPricing = { gross: 2520, lineDiscount: 0, net: 2520, lineVat: 126, chargesNet: 0, chargesVat: 0, headerDiscount: 0, roundOff: 0, grandTotal: 2646 };
const quotationDoc = () => ({
  ...quotation(3), terms: "Payment within 30 days of delivery.\nPrices are for the quantities shown.", notes: "", charges: [], discount: 0,
  items: n(docLine, 3), pricing: docPricing, totalAmount: 2646, convertedTo: undefined,
  party: { customerName: "Al Noor Trading 3", customerId: "C003", billingAddress: "Deira, Dubai", phone: "04 123 4567", paymentTerms: "Net 30", trnNumber: "100123456700003" },
});

const DSTATES = ["DRAFT", "DISPATCHED", "DELIVERED", "DELIVERED", "DELIVERED", "CANCELLED"];
const deliveryNote = (i) => {
  const status = DSTATES[i - 1];
  const delivered = status === "DELIVERED";
  const invoiceStatus = i === 5 ? "INVOICED" : delivered ? "NONE" : "NONE";
  return {
    _id: `dn${i}`, deliveryNoteNo: `DLN-2026-000${i}`, partyId: `p${i}`, party: { customerName: `Al Noor Trading ${i}`, customerId: `C00${i}` },
    date: "2026-10-0" + i, deliveredAt: delivered ? "2026-09-2" + i : null, status, invoiceStatus, totalAmount: 2646 * i,
    source: i % 2 ? { kind: "sales_order", no: `SO-2026-004${i}` } : { kind: "manual" }, reference: "", items: [{}, {}],
    invoice: i === 5 ? { kind: "sales_order", no: "SO-2026-0049" } : undefined,
    clock: delivered && invoiceStatus !== "INVOICED" ? { clock: i === 3 ? "overdue" : "dueSoon", daysToStandard: i === 3 ? -9 : 2, standardDue: "2026-10-12", summaryDue: "2026-10-14", deliveredDay: "2026-09-28", daysSince: 8 } : null,
    actions: { edit: status === "DRAFT", delete: status === "DRAFT", dispatch: status === "DRAFT", deliver: ["DRAFT", "DISPATCHED"].includes(status), cancel: ["DRAFT", "DISPATCHED"].includes(status), invoice: delivered && invoiceStatus === "NONE" && !(i % 2) },
  };
};
const deliveryNoteDoc = () => ({
  ...deliveryNote(2), deliveryAddress: "Warehouse 4, Al Quoz Industrial Area 3, Dubai", contactPerson: "Ali Hassan", contactPhone: "050 111 2222",
  vehicleNo: "DXB A 12345", driverName: "Raju", driverPhone: "055 000 1111", notes: "Call the store keeper before arriving.",
  items: n(docLine, 3).map((l) => ({ ...l, sourceLineId: l._id })), pricing: docPricing, totalAmount: 2646, charges: [],
  source: { kind: "sales_order", id: "o1", no: "SO-2026-0042" }, invoice: { kind: "sales_order", id: "o1", no: "SO-2026-0042" }, invoiceStatus: "DRAFT",
  party: { customerName: "Al Noor Trading 2", customerId: "C002", billingAddress: "Deira, Dubai", shippingAddress: "Warehouse 4, Al Quoz", phone: "050 111 2222" },
  sourceOrder: { id: "o1", no: "SO-2026-0042", status: "DRAFT", lines: n(docLine, 3).map((l) => ({ lineId: l._id, description: l.description, itemCode: l.itemCode })) },
  fulfilment: Object.fromEntries(n(docLine, 3).map((l) => [l._id, { ordered: l.qty * 2, pending: l.qty, delivered: 0, remaining: l.qty, over: false }])),
});
const activityRows = () => n((i) => ({ _id: `act${i}`, at: `2026-10-0${i}T09:3${i}:00.000Z`, action: ["QUOTATION_CREATED", "QUOTATION_SENT", "QUOTATION_ACCEPTED"][i - 1], summary: "Quotation QT-2026-0003 - 2646.00 saved", username: "admin@test.uae" }), 3);

// Orders (non-posting commitments) and goods received (the vendor-side twin of a delivery note)
const ORDER_STATES = ["DRAFT", "CONFIRMED", "CONFIRMED", "CLOSED", "CANCELLED", "CONFIRMED"];
const tradeOrder = (kind) => (i) => {
  const status = ORDER_STATES[i - 1];
  const sales = kind === "sales";
  return {
    _id: `to${i}`, orderNo: `${sales ? "SORD" : "PORD"}-2026-000${i}`, kind, partyId: `p${i}`, status, date: `${THIS_MONTH}-0${i}`, totalAmount: 2646 * i,
    party: sales ? { customerName: `Al Noor Trading ${i}`, customerId: `C00${i}` } : { vendorName: `Gulf Mill ${i}`, vendorId: `V00${i}` },
    items: n(docLine, 2).map((l) => ({ ...l, sourceLineId: l._id })), reference: "LPO-77",
    progress: { label: status === "DRAFT" ? "Not started" : i === 2 ? (sales ? "Partly delivered" : "Partly received") : "Not " + (sales ? "delivered" : "received"), lines: {} },
    actions: { edit: status === "DRAFT", delete: status === "DRAFT", confirm: status === "DRAFT", receive: status === "CONFIRMED", invoice: i === 2, close: status === "CONFIRMED", cancel: status === "DRAFT" || status === "CONFIRMED", reopen: status === "CLOSED" },
  };
};
const tradeOrderDoc = (kind) => ({
  ...tradeOrder(kind)(2), pricing: docPricing, charges: [], discount: 0, terms: "", notes: "",
  party: kind === "sales"
    ? { customerName: "Al Noor Trading 2", customerId: "C002", billingAddress: "Deira, Dubai", trnNumber: "100123456700003", vat: { status: "registered" } }
    : { vendorName: "Gulf Mill 2", vendorId: "V002", address: "Jebel Ali", trnNO: "100456783400003", vat: { status: "registered" } },
  progress: { label: kind === "sales" ? "Partly delivered" : "Partly received", lines: Object.fromEntries(n(docLine, 2).map((l) => [l._id, { ordered: l.qty, received: l.qty / 2, onTheWay: 0, invoiced: l.qty / 4, toReceive: l.qty / 2 }])) },
  // the invoices made from what arrived: one still a draft (offers Approve), one approved and unpaid (offers the payment)
  invoices: [
    { id: "inv1", no: kind === "sales" ? "SO-2026-0201" : "PO-2026-0201", status: "DRAFT", date: `${THIS_MONTH}-03T00:00:00.000Z`, totalAmount: 1323, paidAmount: 0, outstandingAmount: 1323, creditedAmount: 0 },
    { id: "inv2", no: kind === "sales" ? "SO-2026-0202" : "PO-2026-0202", status: "APPROVED", date: `${THIS_MONTH}-02T00:00:00.000Z`, totalAmount: 1323, paidAmount: 300, outstandingAmount: 1023, creditedAmount: 0 },
  ],
});
const RSTATES = ["DRAFT", "RECEIVED", "RECEIVED", "RECEIVED", "CANCELLED"];
const goodsReceipt = (i) => {
  const status = RSTATES[i - 1];
  const invoiceStatus = i === 4 ? "INVOICED" : "NONE";
  return {
    _id: `gr${i}`, receiptNo: `GRN-2026-000${i}`, partyId: `p${i}`, party: { _id: `p${i}`, name: `Gulf Mill ${i}`, code: `V00${i}` },
    date: `${THIS_MONTH}-0${i}`, receivedAt: status === "RECEIVED" ? `${THIS_MONTH}-0${i}` : null, status, invoiceStatus, totalAmount: 2646 * i, vendorDeliveryNo: `VD-${i}`,
    source: i % 2 ? { kind: "purchase_order", id: "to2", no: "PORD-2026-0002" } : { kind: "manual" }, items: [{}, {}],
    invoice: i === 4 ? { kind: "purchase_order", id: "t9", no: "PO-2026-0049" } : undefined,
    actions: { edit: status !== "CANCELLED", delete: status === "DRAFT", receive: status === "DRAFT", cancel: status !== "CANCELLED" && invoiceStatus === "NONE", invoice: status === "RECEIVED" && invoiceStatus === "NONE" },
  };
};
const goodsReceiptDoc = () => ({
  ...goodsReceipt(1), items: n(docLine, 3).map((l) => ({ ...l, sourceLineId: l._id })), pricing: docPricing, charges: [], discount: 0,
  party: { vendorName: "Gulf Mill 2", vendorId: "V002", address: "Jebel Ali", trnNO: "100456783400003", vat: { status: "registered" } },
  sourceOrder: { id: "to2", no: "PORD-2026-0002", status: "CONFIRMED", lines: [] },
});

const batch = (i) => ({
  _id: `bt${i}`, batchNumber: `B-20260${i}`, itemName: `Basmati Rice ${i}`, sku: `SKU-00${i}`,
  itemCode: `IT00${i}`, receivedAt: "2026-09-1" + ((i % 9) + 1), expiryDate: "2027-03-1" + ((i % 9) + 1),
  qtyOnHand: 120 * i, receivedQty: 200 * i, expired: false, sourceTransactionNo: `PO-2026-001${i}`,
});

const n = (f, count = 6) => Array.from({ length: count }, (_, i) => f(i + 1));

// The item list reads { stocks: [...] }: goods, and one service with a long name (it has no stock, so its cells show a dash and "Not stocked").
const stockCategory = { _id: "c1", name: "Grains" };
const stockItem = (i) => ({
  _id: `it${i}`, itemId: `ITM00${i}`, sku: `SKU-00${i}`, itemName: `Basmati Rice ${i}`, itemType: "goods", category: stockCategory, unitOfMeasure: "u1",
  currentStock: 40 * i, reorderLevel: 100, purchasePrice: 38, salesPrice: 42, status: "Active", origin: "India", brand: "Royal", expiryDate: "2027-03-15T00:00:00.000Z",
});
const serviceItem = {
  _id: "it9", itemId: "SRV001", sku: "SV0001", itemName: "Installation and commissioning", itemType: "service", category: stockCategory, unitOfMeasure: "u2",
  currentStock: 0, reorderLevel: 0, purchasePrice: 150, salesPrice: 400, status: "Active", incomeAccountId: "a1", expenseAccountId: null,
};

// lib/accountingApi.js hands callers `res.data.data` as-is, so the shape here has to be the
// shape each screen actually reads - an array for most lists, an object where the screen wants
// a summary beside its rows. Getting this wrong shows up as a blank page, which is exactly what
// the harness is watching for, so it has to be right for the check to mean anything.
function stubFor(pathname, search = "") {
  const p = pathname;
  const q = new URLSearchParams(search);
  const page = { total: 6, current: 1, pages: 1, limit: 20 };

  // Zarvia AI. The panel asks what the screen is about as it opens, and answers come back with
  // citations and a link, so the deep step below measures a real exchange rather than an empty box.
  if (p.includes("/assistant/screen")) return { screen: p, topics: [{ id: "guide-4-5", title: "Order to cash", screens: ["/sales-order"] }] };
  if (p.includes("/assistant/ask")) {
    return {
      conversationId: "c1",
      messageId: "m1",
      answer: "Save the order as a draft first, then press Approve on it. Approving is what moves stock and posts the books, which is why it is its own step.",
      citations: [{ id: "guide-4-5", title: "Order to cash" }],
      links: [{ path: "/accounting-setup", label: "Open Accounting setup" }],
      outcome: "answered",
      canEscalate: false,
    };
  }
  if (p.includes("/assistant/mine")) return [];
  if (p.includes("/assistant/usage")) return { days: [], totals: { questions: 0, costMicros: 0 }, unanswered: [], corpus: { topics: 128 } };
  if (p.includes("/assistant/settings")) return { enabled: true, provider: "echo", model: "claude-opus-5-5", hasApiKey: false, models: ["claude-opus-5-5"], corpus: { topics: 128 } };

  // The session is restored from a cookie, not from storage: src/axios/axios.js asks for a
  // token on every page load and sends the tab to sign-in when it does not get one. Without
  // this the harness measures the sign-in page on every route and calls it fine.
  if (p.includes("/refresh-token") || p.includes("/login")) {
    return {
      accessToken: "stub-access-token",
      admin: { _id: "a1", name: "Super Admin", email: "admin@test.uae", role: "Admin", permissions: [], isActive: true, status: "active" },
    };
  }

  // The organisation the signed-in person belongs to: its plan, what that switches on, its use, where its subscription stands.
  if (p.includes("/organisation/status")) {
    return {
      organisation: { code: "gulf-fresh", legalName: "Gulf Fresh Foods LLC", country: "AE", baseCurrency: "AED", timezone: "Asia/Dubai", planCode: "premium", planName: "Premium" },
      subscription: { state: "active", blocked: false, canRead: true, canWrite: true, endsAt: null, daysLeft: null, onExpiry: "block" },
      features: { quotations: true, deliveryNotes: true, batches: true, banking: true, reconciliation: true, currencies: true, vatReturn: true, ifrsStatements: true, einvoicing: true, messaging: true, multiBranch: true, production: true, assistant: true },
      limits: { users: 50, branches: 20, documentsPerMonth: 20000 },
      usage: { users: 4, branches: 1, documentsPerMonth: 120 },
      room: {},
      // What the organisation bought. The ERP / CRM switch is offered only when this says the CRM is on AND the person
      // holds a page of it, so the sweep must say so or the switch would not be drawn in any screenshot.
      modules: { crm: { on: true, full: true, actions: ["view", "create", "edit", "delete", "assign", "manage"] } },
      support: { contact: "help@zarvia.example" },
      // Who is signed in and what the role holds. The sweep signs in as an administrator who holds every permission any page
      // asks for, so every page is still measured; the Users and roles screen needs a rank to offer anything.
      branches: [{ code: "main", name: "Head office", isHeadOffice: true }, { code: "shj", name: "Sharjah Warehouse" }],
      branch: { code: "main", name: "Head office", canSwitch: true, canViewAll: true },
      me: { id: "a1", name: "Super Admin", role: { key: "admin", name: "Administrator", rank: 80, approvalLimit: null }, grants: ALL_GRANTS, homeBranch: "main", branchRoles: [], twoFactorEnabled: true, twoFactorRequired: false },
      // Who must approve what (Settings -> Business rules -> Approvals); off until the organisation sets it. And whether it requires two-factor.
      policy: { approvals: { separateApprover: false, secondApprovalAbove: null }, security: { requireTwoFactor: false } },
    };
  }

  // The bell's own feed (/api/v1/notifications), which no navigation tab names - it is read on every page, so a stub
  // here is what puts a real count on the bell in every screenshot. `unread-count` and the list share the shape the
  // feed's components read.
  if (p.includes("/notifications")) {
    const row = (id, kind, severity, title, body, link) => ({ id, kind, severity, title, body, link, occurredAt: "2026-10-19T05:30:00.000Z", createdAt: "2026-10-19T05:30:00.000Z", read: false });
    const items = [
      row("n1", "crm_followup", "warning", "2 days late: Send the price for 200 bags", "It was due on 2026-10-17.", "/crm/follow-ups"),
      row("n2", "crm_stale", "warning", "Ramadan hampers has gone quiet", "Nothing for 21 days, on Quotation sent.", "/crm/pipeline"),
      row("n3", "low_stock", "critical", "Basmati rice 5kg is low on stock", "2 left, at or below the reorder level of 10.", "/stock"),
    ];
    if (p.endsWith("/unread-count")) return { count: items.length, capped: false };
    return { items, counts: { total: items.length, unread: items.length }, capped: false };
  }

  // The approvals list (/api/v1/approvals/waiting). The navigation badge asks the same route with ?countOnly=1 and reads `count`,
  // so the one answer carries both. Long names, a long narration and long reasons are the point: they are what clips on a card.
  if (p.endsWith("/approvals/waiting")) {
    const row = (i, over) => ({
      id: `a${i}`, kind: "document", type: "sales_order", typeLabel: "Sales order", number: `SO-2026-00${40 + i}`, party: `Al Noor Trading ${i}`, narration: "",
      amount: 1250.75 * i, date: `2026-10-0${i}T00:00:00.000Z`, createdAt: `2026-10-0${i}T08:00:00.000Z`, branchId: "main",
      preparedBy: "Layla Al Mansoori", preparedById: "u9", ageDays: 9 - i, state: "waiting", given: 0, firstApprovers: [], step: 1, of: 1, reason: null,
      link: `/sales-order?search=SO-2026-00${40 + i}`, ...over,
    });
    return {
      count: 4,
      forYou: [
        row(1),
        row(2, { type: "purchase_order", typeLabel: "Purchase order", number: "PO-2026-0017", party: "Gulf Supply Company for Frozen and Chilled Foodstuff Trading LLC", state: "awaiting second approver", given: 1, firstApprovers: ["Sam Khan"], step: 2, of: 2, link: "/purchase-order?search=PO-2026-0017" }),
        row(3, { id: "v3", kind: "voucher", type: "journal", typeLabel: "Journal", number: "JV-2026-0012", party: "", narration: "Month-end accrual of rent and utilities for the Al Quoz warehouse", step: 1, of: 2, link: "/journal-voucher" }),
        row(4, { id: "v4", kind: "voucher", type: "receipt", typeLabel: "Receipt", number: "RV-2026-0031", party: "Al Noor Trading 4", link: "/receipt-voucher" }),
      ],
      others: [
        row(5, { amount: 98000, step: null, of: null, reason: { code: "APPROVAL_LIMIT_EXCEEDED", message: "This document is 98000.00 AED and your approval limit is 5000.00 AED. Ask someone with a higher limit to approve it." } }),
        row(6, { type: "sales_return", typeLabel: "Sales return", number: "SR-2026-0003", step: null, of: null, reason: { code: "SELF_APPROVAL_NOT_ALLOWED", message: "You prepared this document, so someone else has to approve it." } }),
      ],
      counts: { forYou: 4, others: 2 },
      capped: false,
    };
  }
  // One voucher as its own screen reads it ({ voucher, ledgerEntries }): the journal the approvals list opens, waiting for approval.
  if (p.includes("/vouchers/vouchers/") && !p.slice(p.indexOf("/vouchers/vouchers/") + 19).includes("/")) {
    return {
      voucher: {
        _id: "v3", voucherNo: "JV-2026-0012", voucherType: "journal", status: "pending", date: "2026-10-08T00:00:00.000Z", totalAmount: 1500, ledgerBased: true, createdBy: "u8", approvals: [],
        narration: "Month-end accrual of rent and utilities for the Al Quoz warehouse",
        entries: [{ accountName: "Rent Expense", accountCode: "OPEX0006", debitAmount: 1500, creditAmount: 0, description: "October rent" }, { accountName: "Cash in Hand", accountCode: "CASH0001", debitAmount: 0, creditAmount: 1500, description: "" }],
      },
      ledgerEntries: [],
    };
  }

  // The customer's own people and roles (/api/v1/access/*). The catalogue is what the server sends: modules, their
  // actions, and what ticking each one brings along.
  if (p.includes("/access/roles")) {
    const act = (key, short, implies = []) => ({ key, action: key.split(".")[1], short, label: `${short} in this part of the product.`, read: key.endsWith(".view"), implies });
    const mod = (key, label, hint, actions) => ({ key, label, hint, actions: actions.map(([a, s, i]) => act(`${key}.${a}`, s, i || [])) });
    const sv = (k) => [`${k}.view`, "lookups.view"];
    const catalogue = [
      mod("sales", "Sales", "Quotations, orders, delivery notes, returns and customers", [["view", "View"], ["create", "Add", sv("sales")], ["edit", "Edit", sv("sales")], ["approve", "Approve", sv("sales")], ["delete", "Delete", sv("sales")], ["send", "Send to customers", sv("sales")], ["creditOverride", "Override credit limit", sv("sales")]]),
      mod("purchase", "Purchase", "Purchase orders, returns and vendors", [["view", "View"], ["create", "Add", sv("purchase")], ["edit", "Edit", sv("purchase")], ["approve", "Approve", sv("purchase")], ["delete", "Delete", sv("purchase")]]),
      mod("inventory", "Inventory", "Items, batches and stock", [["view", "View"], ["create", "Add", sv("inventory")], ["edit", "Edit", sv("inventory")], ["adjust", "Adjust stock", sv("inventory")], ["delete", "Delete", sv("inventory")]]),
      mod("finance", "Finance", "Receipts, payments, journals and cheques", [["view", "View"], ["create", "Add", sv("finance")], ["edit", "Edit", sv("finance")], ["approve", "Approve", sv("finance")], ["delete", "Delete", sv("finance")]]),
      mod("reports", "Reports", "Statements, VAT and financial reports", [["view", "View"], ["financial", "Financial reports", ["reports.view"]], ["vat", "File a VAT return", ["reports.view"]]]),
      mod("banking", "Banking", "Banks, cards, statements and reconciliation", [["view", "View"], ["manage", "Add and change", ["banking.view"]], ["reconcile", "Reconcile", ["banking.view"]]]),
      mod("accounts", "Accounts", "Chart of accounts, tax codes, numbering and the period lock", [["view", "View"], ["manage", "Add and change", ["accounts.view"]], ["close", "Close a period", ["accounts.view"]]]),
      mod("users", "People", "Login accounts and roles", [["view", "View"], ["manage", "Add and change", ["users.view"]]]),
      mod("settings", "Settings", "Company profile, sending and business rules", [["view", "View"], ["manage", "Change", ["settings.view"]]]),
      mod("audit", "Activity trail", "Who did what, and when", [["view", "View"]]),
      { key: "lookups", label: "Pick lists", hint: "", automatic: true, actions: [act("lookups.view", "Pick lists")] },
    ];
    const role = (key, name, rank, permissions, over = {}) => ({ key, name, rank, description: "", approvalLimit: null, builtIn: true, isActive: true, permissions, people: 0, ...over });
    return {
      catalogue,
      roles: [
        role("super_admin", "Owner", 100, ALL_GRANTS, { description: "Everything, including other administrators.", people: 1 }),
        role("admin", "Administrator", 80, ALL_GRANTS, { description: "Everything except managing owners.", people: 1 }),
        role("manager", "Manager", 60, ["sales.view", "sales.approve", "purchase.view", "purchase.approve", "inventory.view", "lookups.view"], { people: 2 }),
        role("storekeeper", "Storekeeper", 40, ["inventory.view", "inventory.create", "inventory.adjust", "lookups.view"], { people: 1 }),
        role("viewer", "Viewer", 20, ["sales.view", "purchase.view", "inventory.view", "lookups.view"]),
        role("supervisor", "Sales supervisor", 55, ["sales.view", "sales.create", "sales.approve", "lookups.view"], { builtIn: false, named: ["sales.create", "sales.approve"], description: "Approves what the sales team enters.", approvalLimit: 5000, people: 1 }),
        role("night_shift", "Night shift", 30, ["inventory.view", "lookups.view"], { builtIn: false, named: ["inventory.view"], people: 0 }),
      ],
    };
  }
  // The organisation's letterhead (/api/v1/company/profile): Settings -> Company and Invoice bank details, and every printed document.
  if (p.endsWith("/company/profile")) {
    return {
      companyName: "Gulf Fresh Foods LLC", companyNameArabic: "", addressLine1: "Warehouse 7, Al Quoz Industrial Area 3", addressLine2: "", city: "Dubai", state: "Dubai",
      country: "United Arab Emirates", postalCode: "", phoneNumber: "+971 4 555 0100", emailAddress: "accounts@gulffresh.example", website: "https://gulffresh.example",
      vatNumber: "100999888700003", companyLogo: null,
      bankDetails: { bankName: "Emirates NBD", accountName: "Gulf Fresh Foods LLC", accountNumber: "1234567890", ibanNumber: "AE070331234567890123456", swiftCode: "EBILAEAD", currency: "AED" }, branch: "",
    };
  }
  // The organisation's own branches (/api/v1/branches), as Settings -> Branches reads them.
  if (p.endsWith("/branches")) {
    return [
      { code: "main", name: "Head office", isHeadOffice: true, isActive: true, address: { city: "Dubai", line1: "Al Quoz" }, people: 4 },
      { code: "shj", name: "Sharjah Warehouse", isHeadOffice: false, isActive: true, address: { city: "Sharjah", line1: "Industrial Area 3" }, phone: "06 555 0000", people: 2 },
      { code: "ajm", name: "Ajman Depot", isHeadOffice: false, isActive: false, address: { city: "Ajman" }, people: 0 },
    ];
  }
  // A person's own two-factor (Settings -> Security): on, with two recovery codes left, which is the tallest the panel gets.
  if (p.endsWith("/auth/2fa")) return { enabled: true, enabledAt: "2026-10-01T08:00:00.000Z", recoveryCodesLeft: 2, required: false };
  if (p.includes("/access/users")) {
    const person = (i, name, key, roleName, rank, over = {}) => ({ id: `u${i}`, name, email: `user${i}@gulffresh.example`, role: { key, name: roleName, rank, builtIn: true, active: true }, branchId: i % 2 ? "main" : "shj", branchRoles: [], isActive: true, status: "active", lastLogin: "2026-10-06T08:00:00.000Z", ...over });
    return [
      person(1, "Owner One", "super_admin", "Owner", 100),
      person(2, "Super Admin", "admin", "Administrator", 80, { id: "a1" }),
      // holds another role in a branch: the list says so under the role, and Change opens the dialog with a row
      person(3, "Imran Ali", "manager", "Manager", 60, { twoFactorEnabled: true, branchRoles: [{ branchId: "shj", role: { key: "viewer", name: "Viewer", rank: 20, builtIn: true, active: true } }] }),
      person(4, "Sara Khan", "supervisor", "Sales supervisor", 55, { role: { key: "supervisor", name: "Sales supervisor", rank: 55, builtIn: false, active: true } }),
      person(5, "Lina Haddad", "viewer", "Viewer", 20, { isActive: false, status: "inactive" }),
    ];
  }

  // The developer console (/api/v1/platform/*).
  if (p.includes("/platform/")) {
    if (p.endsWith("/me/2fa")) return { enabled: false, enabledAt: null, recoveryCodesLeft: 0 };
    // every module of the product, as a plan that includes all of it says so (utils/plans.js ALL_MODULES)
    const ALL_STUB_MODULES = Object.fromEntries(["crm", "sales", "purchase", "inventory", "finance", "banking", "accounts", "reports", "users", "staff", "settings", "audit", "lookups"].map((m) => [m, true]));
    // what the role editor names each action (utils/permissions.js SHORT), so the console's checkboxes carry real words
    const SHORT = { view: "View", create: "Add", edit: "Edit", approve: "Approve", delete: "Delete", deletePosted: "Delete approved", send: "Send to customers", creditOverride: "Override credit limit", adjust: "Adjust stock", manage: "Manage", reconcile: "Reconcile", close: "Close periods", financial: "Financial reports", vat: "File VAT", assign: "Assign to someone" };
    const org = (over) => ({ code: "gulf-fresh", legalName: "Gulf Fresh Foods LLC", country: "AE", baseCurrency: "AED", timezone: "Asia/Dubai", planCode: "standard", status: "active", featureOverrides: { einvoicing: true }, moduleOverrides: { finance: false, reports: ["view", "financial"] }, limitOverrides: { users: 25 }, subscription: { endsAt: "2026-12-31T23:59:59.999Z", graceDays: 7, onExpiry: "block" }, provisioning: { complete: true, steps: { settings: { state: "done" }, chart: { state: "done" }, taxCodes: { state: "done" } } }, ...over });
    if (p.endsWith("/catalog")) {
      return {
        plans: [
          { code: "trial", name: "Trial", trialDays: 14, features: { quotations: true, deliveryNotes: true, batches: true }, modules: ALL_STUB_MODULES, limits: { users: 3, branches: 1, documentsPerMonth: 200 } },
          { code: "standard", name: "Standard", features: { quotations: true, deliveryNotes: true, batches: true, banking: true, currencies: true, vatReturn: true, messaging: true }, modules: ALL_STUB_MODULES, limits: { users: 10, branches: 3, documentsPerMonth: 2000 } },
          { code: "premium", name: "Premium", features: { quotations: true, deliveryNotes: true, batches: true, banking: true, reconciliation: true, currencies: true, vatReturn: true, ifrsStatements: true, einvoicing: true, messaging: true, multiBranch: true }, modules: ALL_STUB_MODULES, limits: { users: 50, branches: 20, documentsPerMonth: 20000 } },
        ],
        // the same shape the server sends (utils/consoleCatalog.js): a group for each module, the screens it includes with the
        // optional features filed inside it, and each action named and explained
        groups: [{ key: "crm", label: "CRM workspace" }, { key: "trade", label: "Buying, selling and stock" }, { key: "money", label: "Money and books" }, { key: "organisation", label: "People and settings" }, { key: "core", label: "Always on" }],
        modules: [
          ["crm", "CRM", "The CRM workspace: leads, contacts, deals, follow-ups, calendar and reports, with an ERP / CRM switch for the people who hold it", "crm", ["Dashboard", "Leads", "Contacts", "Pipeline", "Follow-ups", "Calendar", "Reports", "Setup"], ["view", "create", "edit", "delete", "assign", "manage"], []],
          ["sales", "Sales", "Quotations, sales orders, delivery notes, sales returns and customers", "trade", [{ feature: "quotations" }, "Orders", { feature: "deliveryNotes" }, "Invoices", "Returns", "Customers", { feature: "messaging" }], ["view", "create", "edit", "approve", "delete", "deletePosted", "send", "creditOverride"], []],
          ["purchase", "Purchase", "Purchase orders, purchase returns and vendors", "trade", ["Orders", "Goods received", "Invoices", "Returns", "Vendors"], ["view", "create", "edit", "approve", "delete", "deletePosted"], []],
          ["inventory", "Inventory", "Items, categories, units, batches and stock movements", "trade", ["Stock items", "Movements", "Categories", "Units", { feature: "batches" }, { feature: "production" }], ["view", "create", "edit", "delete", "adjust"], []],
          ["finance", "Finance", "Receipts, payments, journals, contra, expenses, notes and cheques", "money", ["Receipts", "Payments", "Journal", "Contra", "Expenses", "Debit and credit notes", "Ledger"], ["view", "create", "edit", "approve", "delete", "deletePosted"], []],
          ["banking", "Banking", "Bank and card masters, statements and reconciliation", "money", [{ feature: "banking" }, { feature: "reconciliation" }], ["view", "manage", "reconcile"], []],
          ["accounts", "Accounts", "Chart of accounts, tax codes, opening balances and the period lock", "money", ["Chart of accounts", "Accounting setup and tax codes", "Opening balances", "Period lock", { feature: "currencies" }], ["view", "manage", "close"], []],
          ["reports", "Reports", "The dashboard and reports", "money", ["Dashboard", "Financial statements", "Ledger reports", "Trade analysis", "Ageing", { feature: "ifrsStatements" }, { feature: "vatReturn" }, { feature: "einvoicing" }], ["view", "financial", "vat"], ["view"]],
          ["users", "Users and roles", "The people who sign in, and what each may do", "organisation", ["Users", "Roles and permissions"], ["view", "manage"], []],
          ["staff", "Staff records", "Employee records (HR)", "organisation", ["Staff records"], ["view", "manage"], []],
          ["settings", "Settings", "Company profile, sending, e-invoicing and business rules", "organisation", ["Company profile", "Business rules", "Security", { feature: "multiBranch" }], ["view", "manage"], ["view"]],
          ["audit", "Activity trail", "Who did what", "organisation", ["Activity trail"], ["view"], []],
          ["lookups", "Pick lists", "The lists a form chooses from", "core", [], ["view"], ["view"]],
        ].map(([key, label, hint, group, sections, actions, alwaysOn]) => ({ key, label, hint, group, sections, actions: actions.map((action) => ({ action, short: SHORT[action] || action, label: `${SHORT[action] || action}: what a person holding it may do in ${label}`, read: action === "view" })), alwaysOn })),
        features: [
          ["quotations", "Quotations", "Price offers that the customer accepts and that turn into orders", "sales"], ["deliveryNotes", "Delivery notes", "Delivery notes, signed for on delivery and invoiced afterwards", "sales"],
          ["messaging", "Send documents to customers", "Email or WhatsApp an invoice to the customer with a secure link", "sales"], ["batches", "Batches and expiry", "Batch numbers, expiry dates and first-expiry-first-out stock", "inventory"],
          ["production", "Production", "Materials and expenses moved into a product's cost, job work and process orders. Off for everyone unless switched on here", "inventory", true],
          ["banking", "Banks, cards and cheques", "Bank and card masters, cheques, and card and bank payment modes", "banking"], ["reconciliation", "Bank and card reconciliation", "Import a bank statement and match it to the books", "banking"],
          ["currencies", "Foreign currency", "Receipts and payments in a foreign currency, with exchange rates", "accounts"], ["ifrsStatements", "IFRS statements", "Statement of financial position, profit or loss, cash flows and notes", "reports"],
          ["vatReturn", "VAT return", "The VAT 201 return, built from the approved documents", "reports", false, ["AE"]], ["einvoicing", "E-invoicing", "Electronic tax invoices sent to the tax authority", "reports", false, ["AE"]],
          ["multiBranch", "More than one branch", "More than one branch, each with its own documents and numbering", "settings"],
        ].map(([key, label, hint, module, optIn, onlyIn]) => ({ key, label, hint, module, optIn: Boolean(optIn), onlyIn: onlyIn || null })),
        // what each ready-made role holds in each module (the panel says who gets what is sold)
        roles: [
          { key: "super_admin", name: "Owner", rank: 100, modules: { sales: ["view", "create", "edit", "approve", "delete", "deletePosted", "send", "creditOverride"], inventory: ["view", "create", "edit", "delete", "adjust"], finance: ["view", "create", "edit", "approve", "delete", "deletePosted"], reports: ["view", "financial", "vat"] } },
          { key: "manager", name: "Manager", rank: 60, modules: { sales: ["view", "create", "edit", "approve", "delete", "deletePosted", "send", "creditOverride"], inventory: ["view", "create", "edit", "delete", "adjust"], finance: ["view", "create", "edit", "approve"], reports: ["view", "financial"] } },
          { key: "storekeeper", name: "Storekeeper", rank: 40, modules: { inventory: ["view", "create", "edit", "adjust"], sales: ["view"], reports: ["view"] } },
          { key: "viewer", name: "Viewer", rank: 20, modules: { sales: ["view"], inventory: ["view"], finance: ["view"], reports: ["view", "financial"] } },
        ],
        limits: ["users", "branches", "documentsPerMonth"],
        currencies: [{ code: "AED", name: "UAE Dirham" }, { code: "SAR", name: "Saudi Riyal" }, { code: "USD", name: "US Dollar" }, { code: "INR", name: "Indian Rupee" }],
        unsupportedCurrencies: ["KWD", "BHD", "OMR"],
        timezones: ["Asia/Dubai", "Asia/Kolkata", "Asia/Riyadh", "Europe/London"],
        accountTypes: ["super_admin", "admin", "manager", "operator", "viewer"],
      };
    }
    if (p.endsWith("/audit")) return { total: 3, rows: n((i) => ({ _id: `pa${i}`, at: `2026-10-0${i}T09:30:00.000Z`, action: ["ORGANISATION_CREATED", "SUBSCRIPTION_EXTENDED", "USER_CREATED"][i - 1], organisation: "gulf-fresh", summary: ["Organisation created on the standard plan, books in AED", "Subscription now ends 2026-12-31", "Account created for owner@gulffresh.example (super_admin)"][i - 1], by: "dev@zarvia.test" }), 3) };
    // the console's own developers, not an organisation's staff - both paths end in /users, so this one first
    if (p.endsWith("/platform/users")) return n((i) => ({ _id: `p${i}`, name: ["Dev One", "Dev Two", "Dev Three"][i - 1], email: `dev${i}@zarvia.test`, status: i === 3 ? "inactive" : "active", twoFactor: { enabled: i === 1 }, lastLogin: i === 3 ? null : "2026-10-10T07:15:00.000Z" }), 3);
    if (p.endsWith("/users")) return n((i) => ({ _id: `u${i}`, name: ["Owner One", "Sara Khan", "Imran Ali", "Lina Haddad"][i - 1], email: `user${i}@gulffresh.example`, type: ["super_admin", "admin", "operator", "viewer"][i - 1], status: i === 4 ? "inactive" : "active", isActive: i !== 4, branchId: "main", lastLogin: "2026-10-06T08:00:00.000Z" }), 4);
    if (p.endsWith("/branches")) return [{ code: "main", name: "Head office", isHeadOffice: true, isActive: true, address: { city: "Dubai" } }, { code: "shj", name: "Sharjah Warehouse", isHeadOffice: false, isActive: true, address: { city: "Sharjah" } }];
    const orgTail = p.split("/organisations/")[1]; // one organisation: .../organisations/<code>
    if (orgTail && !orgTail.includes("/")) {
      return {
        organisation: org(),
        features: {}, limits: { users: 25, branches: 3, documentsPerMonth: 2000 }, usage: { users: 4, branches: 2, documentsPerMonth: 180 },
        state: { state: "grace", daysLeft: 3, onExpiry: "block", endsAt: "2026-12-31T23:59:59.999Z" },
        room: { users: { ok: true }, branches: { ok: true }, documentsPerMonth: { ok: true } },
        profile: { legalName: "Gulf Fresh Foods LLC", trn: "100123456700003", addressLine1: "Al Quoz, Dubai", city: "Dubai", emirate: "Dubai", email: "accounts@gulffresh.example", phone: "04 123 4567", vatRegistered: true },
      };
    }
    if (p.endsWith("/organisations")) {
      return { total: 4, rows: [
        org({ state: { state: "active", daysLeft: 200 } }),
        org({ code: "harbour", legalName: "Harbour Trading LLC", planCode: "premium", state: { state: "active", daysLeft: 9 }, subscription: { endsAt: "2026-10-17T23:59:59.999Z" } }),
        org({ code: "desert-rose", legalName: "Desert Rose Catering", country: "SA", baseCurrency: "SAR", planCode: "trial", status: "trial", state: { state: "expired", onExpiry: "readonly" }, subscription: { endsAt: "2026-10-01T23:59:59.999Z" } }),
        org({ code: "old-client", legalName: "Old Client Foodstuff", status: "suspended", state: { state: "suspended" } }),
      ] };
    }
    return {};
  }

  // Banks: the institutions, each carrying how many of the company's own accounts name it, and one
  // bank's own accounts - a table inside a dialog, which is where a phone layout gives way.
  if (p.includes("/banking/banks")) {
    const banks = [
      { _id: "k1", bankName: "Emirates NBD", bankCode: "ENBD", swiftCode: "EBILAEAD", country: "AE", city: "Dubai", branches: [], isActive: true, accounts: { total: 2, active: 1 } },
      { _id: "k2", bankName: "Abu Dhabi Commercial Bank", bankCode: "ADCB", swiftCode: "ADCBAEAA", country: "AE", city: "Abu Dhabi", branches: [], isActive: true, accounts: { total: 0, active: 0 } },
    ];
    if (p.endsWith("/accounts")) {
      return {
        bank: banks[0],
        accounts: [
          { _id: "ba1", accountCode: "1102", accountName: "Emirates NBD Current Account", groupId: "g3", isActive: true, allowDirectPosting: true, balance: 128450.75, bank: { bankId: "k1", bankName: "Emirates NBD", accountNumber: "1014567890123", accountNumberMasked: "•••• 0123", iban: "AE070331234567890123456", accountHolder: "Gulf Fresh Foods LLC", branchCode: "DXB" } },
          { _id: "ba2", accountCode: "1103", accountName: "Emirates NBD Collection Account (closed)", groupId: "g3", isActive: false, allowDirectPosting: true, balance: 0, bank: { bankId: "k1", bankName: "Emirates NBD", accountNumber: "", accountNumberMasked: "", iban: "", accountHolder: "", branchCode: "" } },
        ],
      };
    }
    return banks;
  }

  // Bank reconciliation: one account that is set up, a worklist with a strong suggestion, a line with
  // nothing to suggest, a matched line and an ignored one, and a proof that cannot be finished yet.
  if (p.includes("/banking/reconciliation/")) {
    const entry = { id: "e1", type: "ledger", ledgerEntryId: "le1", chequeId: null, voucherId: "v1", voucherNo: "RV-2026-0014", voucherType: "receipt", day: "2026-10-02", amount: 1050, narration: "", party: "Al Noor Grocery", reference: "TRF-9001", chequeNo: "", card: null, pending: false };
    const line = (over) => ({ _id: "l1", importId: "i1", lineNo: 3, day: "2026-10-02", valueDay: null, description: "TRANSFER FROM AL NOOR GROCERY TRF-9001", reference: "", chequeNo: "", amount: 1050, balance: 11050, state: "open", matchId: null, reconciliationId: null, ignoredReason: "", suggestion: null, match: null, ...over });
    const lines = [
      line({ suggestion: { confidence: "high", score: 100, reasons: ["same amount", "same day", "reference TRF-9001 is in the text"], kind: "one", entries: [entry] } }),
      line({ _id: "l2", description: "BANK CHARGES INCL VAT", amount: -21, balance: 11029 }),
      line({ _id: "l3", state: "matched", description: "IPP PAY-1 GULF SUPPLY", amount: -300, matchId: "m1", match: { _id: "m1", kind: "match", method: "auto", reconciliationId: null, lineCount: 1, entries: [{ ...entry, voucherNo: "PV-2026-0003", voucherType: "payment", amount: -300 }], createdVouchers: [] } }),
      line({ _id: "l4", state: "ignored", description: "DUPLICATE FEE", amount: -15, ignoredReason: "Duplicate in the bank's own file" }),
    ];
    const proof = { asOf: "2026-10-06", statementBalance: 1341.9, bookBalance: 1433.9, depositsInTransit: { total: 77, items: [{ id: "e9", day: "2026-10-05", voucherNo: "RV-2026-0020", party: "Al Noor Grocery", amount: 77 }] }, outstandingPayments: { total: 0, items: [] }, bankItemsNotInBooks: { total: 0, items: [] }, ignored: { total: -15, items: [] }, adjustedBank: 1418.9, adjustedBook: 1418.9, difference: 0, openLines: 2, openingDifference: 0, blockers: [{ code: "OPEN_LINES", message: "2 statement lines are not matched or ignored yet" }], canFinish: false, unclearedCheques: { items: [], count: 0, total: 0 } };
    if (p.endsWith("/accounts")) return [{ _id: "b1", accountName: "Emirates NBD Current", accountCode: "BANK0001", bank: { bankName: "Emirates NBD", accountNumberMasked: "•••• 4567" }, bookBalance: 1433.9, setUp: true, counts: { open: 2, matched: 1, reconciled: 0, ignored: 1 }, lastLineDay: "2026-10-06", lastReconciled: { number: "BRC-2026-0001", asOf: "2026-09-30", statementBalance: 1000 } }];
    if (p.endsWith("/lines")) return { account: { _id: "b1", accountName: "Emirates NBD Current" }, needsSetup: false, rows: lines, total: lines.length, page: 1, pages: 1, counts: { todo: 1, suggested: 1, matched: 1, reconciled: 0, ignored: 1, all: 4 } };
    if (p.endsWith("/setup/status")) return { startDay: "2026-09-01", statementOpening: 1000, outstandingCount: 0, outstandingTotal: 0, bookBalanceBefore: 1000, difference: 0 };
    if (p.endsWith("/imports")) return [{ _id: "i1", status: "active", periodFrom: "2026-10-01", periodTo: "2026-10-06", closingBalance: 1341.9, lineCount: 4, workedOn: 2 }];
    if (p.endsWith("/proof")) return proof;
    if (p.endsWith("/reconciliations")) return [{ _id: "r1", number: "BRC-2026-0001", asOf: "2026-09-30", statementBalance: 1000, lineCount: 9, status: "completed" }];
    if (p.includes("/reconciliations/")) return { _id: "r1", number: "BRC-2026-0001", status: "completed", account: { accountName: "Emirates NBD Current" }, proof, createdAt: "2026-10-01T08:00:00.000Z" };
    if (p.endsWith("/card/ageing")) return { asOf: "2026-10-06", buckets: [{ label: "0-3 days", from: 0, to: 3, count: 1, total: 98 }, { label: "4-7 days", from: 4, to: 7, count: 1, total: 196 }, { label: "8-14 days", from: 8, to: 14, count: 0, total: 0 }, { label: "15+ days", from: 15, to: null, count: 0, total: 0 }], total: 294, count: 2, items: [{ entryId: "e1", voucherNo: "RV-2026-0004", day: "2026-10-03", cardLabel: "POS 1", gross: 100, feeBooked: 2, net: 98, workingDays: 2 }] };
    if (p.endsWith("/card/variance")) return { summary: { settlements: 1, gross: 300, feeBooked: 6, extraCommission: 0.4, vat: 0.3, received: 293.3, bookedRate: 2, effectiveRate: 2.133 }, months: [], cards: [{ cardId: "k1", cardLabel: "POS 1", sales: 2, gross: 300, feeBooked: 6, bookedRate: 2 }], settlements: [{ _id: "s1", settlementDate: "2026-10-03", settlementRef: "NI-0099", gross: 300, feeBooked: 6, extraCommission: 0.4, vat: 0.3, received: 293.3, receiptCount: 2, effectiveRate: 2.133 }] };
    if (p.endsWith("/card/settlements")) return [];
    if (p.endsWith("/card/unsettled")) {
      const sale = (id, no, day, gross, fee) => ({ entryId: id, ledgerEntryId: `l${id}`, voucherNo: no, day, cardId: "k1", cardLabel: "POS 1", gross, feeBooked: fee, net: gross - fee });
      return { receipts: [sale("e1", "RV-2026-0004", "2026-10-01", 100, 2), sale("e2", "RV-2026-0005", "2026-10-02", 200, 4), sale("e3", "RV-2026-0006", "2026-10-03", 100, 2)], vatRate: 5, line: {}, suggestion: { cutoffDay: "2026-10-02", entryIds: ["e1", "e2"], expectedNet: 294, difference: 0.3 } };
    }
    if (p.endsWith("/setup/preview")) return { account: { _id: "b1", accountName: "Emirates NBD Current" }, startDay: "2026-09-01", bookBalanceBefore: 1060, existing: null, candidates: [{ ...entry, id: "e8", ledgerEntryId: "le8", voucherNo: "RV-2026-0002", day: "2026-08-28", amount: 60 }, { ...entry, id: "e9", ledgerEntryId: "le9", voucherNo: "RV-2026-0001", day: "2026-08-01", amount: 1000 }] };
    if (p.endsWith("/entries")) return { rows: [entry], total: 1 };
    if (p.endsWith("/profile")) return null;
    return {};
  }

  // A customer's deals (the Documents tab): one of each shape that reads differently - an offer out, an
  // invoiced order only part delivered, goods first with the 14-day clock running, and a finished deal.
  if (p.includes("/document-flow/")) {
    const quote = (over) => ({ _id: "q1", quotationNo: "QT-2026-0007", status: "SENT", expired: false, daysLeft: 12, validUntil: "2026-11-05T00:00:00.000Z", totalAmount: 10584, ...over });
    const order = (over) => ({ _id: "o1", transactionNo: "SO-2026-0042", status: "APPROVED", totalAmount: 13230, outstandingAmount: 13230, ...over });
    const note = (over) => ({ _id: "n1", deliveryNoteNo: "DLN-2026-0012", status: "DELIVERED", deliveredAt: "2026-10-04T08:00:00.000Z", totalAmount: 6615, ...over });
    return {
      customer: { _id: "p1", customerId: "C001", customerName: "Al Noor Trading 1" },
      truncated: false,
      summary: { outWithCustomer: { count: 1, value: 10584 }, acceptedNotOrdered: { count: 0, value: 0 }, ordersToApprove: { count: 1, value: 6615 }, deliveredNotInvoiced: { count: 1, value: 6615 }, pastInvoiceWindow: 0 },
      chains: [
        { key: "a", stage: "delivering", mode: "order_first", quotation: quote({ _id: "q2", quotationNo: "QT-2026-0003", status: "CONVERTED" }), order: order(), notes: [note({ _id: "n2", deliveryNoteNo: "DLN-2026-0009", invoiceStatus: "INVOICED" })], delivery: { started: true, complete: false, remaining: [{ description: "Basmati Rice 5kg", qty: 5 }, { description: "Sunflower Oil 1.8L", qty: 12 }, { description: "Sugar 2kg", qty: 3 }] }, amount: 13230, date: "2026-10-01T00:00:00.000Z", invoiceClock: null, expiresInDays: null },
        { key: "b", stage: "quoted", mode: null, quotation: quote(), order: null, notes: [], delivery: null, amount: 10584, date: "2026-10-06T00:00:00.000Z", invoiceClock: null, expiresInDays: 12 },
        { key: "c", stage: "delivered", mode: "delivery_first", quotation: null, order: order({ _id: "o3", transactionNo: "SO-2026-0043", status: "DRAFT", totalAmount: 6615 }), notes: [note()], delivery: null, amount: 6615, date: "2026-10-04T00:00:00.000Z", invoiceClock: { clock: "dueSoon", daysToStandard: 2, standardDue: "2026-10-18", summaryDue: "2026-11-14" }, expiresInDays: null },
        { key: "d", stage: "invoiced", mode: "order_first", quotation: quote({ _id: "q4", quotationNo: "QT-2026-0001", status: "CONVERTED" }), order: order({ _id: "o4", transactionNo: "SO-2026-0009", outstandingAmount: 0 }), notes: [note({ _id: "n4", deliveryNoteNo: "DLN-2026-0003", invoiceStatus: "INVOICED" })], delivery: { started: true, complete: true, remaining: [] }, amount: 13230, date: "2026-09-20T00:00:00.000Z", invoiceClock: null, expiresInDays: null },
      ],
    };
  }

  if (p.includes("/messaging/")) {
    if (p.includes("/settings")) return { enabled: true, provider: "resend", fromName: "Harbour Trading LLC", fromEmail: "accounts@harbour.ae", replyTo: "", verifiedDomain: "harbour.ae", bccSelf: false, signature: "", defaultNote: "", attachPdf: true, shareEnabled: true, shareLinkDays: 30, statementShareDays: 14, retryMax: 3, dailyLimit: 200, connected: true, hasApiKey: true, lastAuthFailureAt: null };
    if (p.includes("/readiness")) return { ready: true, provider: "resend", checks: [{ key: "key", label: "An email service key is saved", ok: true, blocking: true }, { key: "from", label: "A sender address is set", ok: true, blocking: true }, { key: "domain", label: "The sender domain is the one verified at the email service", ok: true, blocking: true }, { key: "company", label: "Your company name is set (Settings, Company)", ok: true, blocking: false }, { key: "trn", label: "Your TRN is set, because a tax invoice must show it", ok: false, blocking: false }] };
    if (p.includes("/sends")) {
      const future = "2026-11-05T00:00:00.000Z";
      return { total: 2, page: 1, pages: 1, rows: [
        { _id: "s1", channel: "email", status: "SENT", to: ["ali@alnoor.ae", "sara@alnoor.ae"], sentAt: "2026-10-06T10:32:00.000Z", sentByName: "Super Admin", attachment: { fileName: "Tax-invoice_SO-2026-0041.pdf" }, attempts: 1, openedAt: "2026-10-07T08:00:00.000Z", shareLinkId: "l1", share: { _id: "l1", publicId: "ABCDEFGHJKM", expiresAt: future, revokedAt: null, viewCount: 2, firstViewedAt: "2026-10-07T08:00:00.000Z" } },
        { _id: "s2", channel: "email", status: "FAILED", retryable: true, to: ["ali@alnoor.ae"], failedAt: "2026-10-06T11:00:00.000Z", sentByName: "Super Admin", lastError: "We could not reach the email service. It will try again shortly.", nextRetryAt: "2026-10-06T11:05:00.000Z", attempts: 2, shareLinkId: "l2", share: { _id: "l2", publicId: "NMPQRSTVWXY", expiresAt: future, revokedAt: null, viewCount: 0 } },
      ] };
    }
    return {};
  }
  if (p.includes("/share/")) {
    return {
      kind: "tax_invoice", currency: "AED", expiresAt: "2026-11-05T00:00:00.000Z",
      document: { transactionNo: "SO-2026-0041", invoiceNumber: "INV-2026-0041", status: "APPROVED", date: "2026-10-06T00:00:00.000Z", lpono: "LPO-7", items: [{ itemCode: "RICE5", description: "Basmati Rice 5kg", qty: 10, rate: 200, vatPercent: 5, vatAmount: 10, lineTotal: 210 }, { itemCode: "OIL1", description: "Sunflower Oil 1L", qty: 24, rate: 360, vatPercent: 5, vatAmount: 18, lineTotal: 378 }], charges: [], pricing: { gross: 560, lineDiscount: 0, net: 560, lineVat: 28, chargesNet: 0, chargesVat: 0, headerDiscount: 0, roundOff: 0, grandTotal: 588 } },
      party: { customerName: "Al Noor Trading", customerId: "C1", billingAddress: "Warehouse 4, Al Quoz, Dubai", trnNumber: "100123456700003", paymentTerms: "Net 30" },
      company: { companyName: "Harbour Trading LLC", addressLine1: "Al Quoz, Dubai", phoneNumber: "04 123 4567", email: "accounts@harbour.ae", vatNumber: "100123456700003", logo: null },
    };
  }
  if (p.includes("/admin") || p.includes("profile") || p.includes("/me")) {
    return { name: "Super Admin", email: "admin@test.uae", role: "Admin", permissions: [] };
  }

  // The cheque reports (Cheques > Due dates, Cash forecast). They must answer BEFORE the register's stub below, which
  // matches any path with "cheque" in it and would hand them the wrong shape.
  if (p.includes("/banking/cheques/maturity")) {
    const slot = (amount, count) => ({ amount, count });
    const g = (key, label, r, p2, h) => ({ key, label, receivable: slot(r, r ? 2 : 0), payable: slot(p2, p2 ? 1 : 0), onHold: slot(h, h ? 1 : 0), net: r - p2 });
    return {
      asOn: "2026-10-26", groupBy: "bucket", capped: false, atBank: slot(5400, 1),
      totals: { receivable: slot(24800, 3), payable: slot(11200, 2), onHold: slot(5400, 1), net: 13600 },
      groups: [g("overdue", "Overdue", 10800, 0, 0), g("week", "Next 7 days", 14000, 5400, 5400), g("month", "8 to 30 days", 0, 5800, 0)],
      rows: n((i) => ({ _id: `m${i}`, chequeNo: `0012${i}`, direction: i % 2 ? "receipt" : "payment", partyName: `Al Noor Trading ${i}`, chequeDay: `2026-10-${20 + i}`, days: i - 6, status: ["pending", "hold", "deposited"][i % 3], amount: 5400 * i, voucherNo: `RV-2026-000${i}`, bankName: "Current account" })),
    };
  }
  if (p.includes("/banking/cheques/forward")) {
    const s = (r, pay, h) => ({ receipts: { amount: r, count: r ? 1 : 0 }, payments: { amount: pay, count: pay ? 1 : 0 }, onHold: { amount: h, count: h ? 1 : 0 }, net: r - pay });
    return {
      asOn: "2026-10-26", unit: "week", openingKnown: true, opening: 88000, capped: false, due: s(10800, 0, 0), afterDue: 98800,
      periods: [
        { key: "w1", label: "26 Oct - 1 Nov", from: "2026-10-26", to: "2026-11-01", ...s(14000, 5400, 5400), closing: 107400 },
        { key: "w2", label: "2 Nov - 8 Nov", from: "2026-11-02", to: "2026-11-08", ...s(0, 5800, 0), closing: 101600 },
        { key: "w3", label: "9 Nov - 15 Nov", from: "2026-11-09", to: "2026-11-15", ...s(0, 0, 0), closing: 101600 },
      ],
      later: s(0, 0, 0), totals: { receipts: 24800, payments: 11200, onHold: 5400, closing: 101600 },
    };
  }

  // { rows, total, summary } - ChequeRegister reads all three
  if (p.includes("cheque")) {
    return {
      rows: n(cheque), total: 6,
      summary: {
        receivable: { amount: 24800, count: 3 },
        payable: { amount: 11200, count: 2 },
      },
    };
  }

  // Quotations: a list (rows, with pagination beside), a summary object, one document, its activity
  if (p.includes("/quotations")) {
    if (p.endsWith("/summary")) {
      return {
        byStatus: { DRAFT: { count: 1, value: 2646 }, SENT: { count: 1, value: 10584 }, ACCEPTED: { count: 1, value: 7938 }, EXPIRED: { count: 1, value: 10584 }, CONVERTED: { count: 1, value: 13230 }, REJECTED: { count: 1, value: 15876 } },
        total: 6, winRate: 33.3, expiringSoon: { count: 1, value: 10584 },
      };
    }
    if (p.endsWith("/activity")) return { rows: activityRows(), total: 3, page: 1, pages: 1 };
    if (/\/quotations\/[^/]+$/.test(p)) return quotationDoc();
    return n(quotation);
  }

  // Orders: a list (rows, pagination beside), a summary by status, one order with its progress, its activity
  if (p.includes("/trade-orders")) {
    const kind = /kind=purchase/.test(p) || p.includes("purchase") ? "purchase" : "sales";
    if (p.endsWith("/summary")) return { DRAFT: { count: 1, value: 2646 }, CONFIRMED: { count: 3, value: 33075 }, CLOSED: { count: 1, value: 10584 }, CANCELLED: { count: 1, value: 13230 } };
    if (p.endsWith("/activity")) return { rows: activityRows(), total: 3, page: 1, pages: 1 };
    if (/\/trade-orders\/[^/]+$/.test(p)) return tradeOrderDoc(kind);
    return n(tradeOrder(kind), 6);
  }

  // CRM (Pipeline / Leads / Follow-ups / Analysis / Setup): one deal a quotation has already moved, one enquiry nobody
  // has rung yet, and one follow-up that is late - the three states every CRM screen is about.
  if (p.includes("/crm")) {
    const stage = (key, name, order, probability, advanceOn, followUpDays, staleDays, type = "open") => ({ key, name, order, probability, advanceOn, followUpDays, staleDays, type });
    const stages = [
      stage("new", "New", 1, 10, null, 1, 7),
      stage("qualified", "Qualified", 2, 25, null, 2, 10),
      stage("quoted", "Quotation sent", 3, 50, "quotation_sent", 3, 14),
      stage("accepted", "Offer accepted", 4, 90, "quotation_accepted", 2, 7),
      stage("won", "Won", 5, 100, "invoice_approved", 0, 0, "won"),
      stage("lost", "Lost", 6, 0, null, 0, 0, "lost"),
    ];
    const deal = (i, over = {}) => ({
      _id: `op${i}`, opportunityNo: `OPP-2026-000${i}`, title: "Monthly rice and sunflower oil", customerId: "c1", customerName: "Al Noor Foods Trading",
      stageKey: "quoted", stageName: "Quotation sent", probability: 50, status: "OPEN", value: 48500, expectedCloseDate: "2026-11-05",
      ownerId: "a1", ownerName: "Asif Rahman", source: "referral", stageSinceDay: "2026-10-16", lastActivityDay: "2026-10-17",
      nextActionAt: "2026-10-21", overdueAction: false, stale: { days: 3, isStale: false, limit: 14 }, weighted: 24250, daysInStage: 3,
      links: { quotationId: "q1", quotationNo: "QT-2026-0007", orderId: null, orderNo: "" },
      autoMoves: [{ key: "quotation_sent:q1", event: "quotation_sent", from: "qualified", to: "quoted", at: "2026-10-16T09:00:00.000Z", by: "automation", docNo: "QT-2026-0007" }],
      actions: { edit: true, delete: true, move: true, win: true, lose: true, reopen: false, assign: true }, ...over,
    });
    const lead = (i, over = {}) => ({
      _id: `ld${i}`, leadNo: `LD-2026-000${i}`, name: "Hassan Al Noor", company: "Al Noor Foods Trading", phone: "0501234567", email: "buyer@alnoor.ae",
      source: "referral", sourceLabel: "Referral", sourceNote: "Sent by Gulf Trading", interest: "Monthly rice and oil for four branches",
      expectedValue: 45000, status: "NEW", band: "warm", score: 47, ownerId: "a1", ownerName: "Asif Rahman",
      nextActionAt: "2026-10-19", overdueAction: true, idleDays: 2, contactCount: 0, notes: "",
      actions: { edit: true, delete: true, qualify: true, lose: true, assign: true, logActivity: true }, ...over,
    });
    const followUp = (i, over = {}) => ({
      _id: `ac${i}`, kind: "call", kindLabel: "Call", subject: "Send the price for 200 bags", notes: "", regarding: { kind: "opportunity", id: "op1" },
      customerId: "c1", ownerId: "a1", ownerName: "Asif Rahman", dueAt: "2026-10-18", dueState: "overdue", status: "OPEN", auto: true,
      actions: { edit: true, done: true, delete: true }, ...over,
    });
    const timeline = [
      followUp(1),
      followUp(2, { _id: "ac2", subject: "Rang about the rice price", status: "DONE", outcome: "interested", dueState: "done", completedAt: "2026-10-17T06:30:00.000Z", auto: false }),
    ];
    const stageRows = (which) => stages.map((st) => ({
      ...st,
      count: st.key === "quoted" ? 2 : st.key === "accepted" ? 1 : 0,
      value: st.key === "quoted" ? 68500 : st.key === "accepted" ? 28000 : 0,
      weighted: st.key === "quoted" ? 34250 : st.key === "accepted" ? 25200 : 0,
      ...(which === "board"
        ? {
            deals:
              st.key === "quoted"
                ? [deal(1), deal(2, { _id: "op2", opportunityNo: "OPP-2026-0002", title: "Ramadan hampers", value: 20000, ownerName: "Maya Khan", stale: { days: 21, isStale: true, limit: 14 }, overdueAction: true })]
                : st.key === "accepted"
                  ? [deal(3, { _id: "op3", opportunityNo: "OPP-2026-0003", title: "Dates and nuts", stageKey: "accepted", stageName: "Offer accepted", probability: 90, value: 28000 })]
                  : [],
          }
        : {}),
    }));

    if (p.endsWith("/crm/summary")) return { today: "2026-10-19", openLeads: 4, openDeals: 3, pipelineValue: 96500, weightedValue: 59450, staleDeals: 1, dueToday: 2, overdue: 1 };
    const contact = (i, over = {}) => ({
      _id: `ct${i}`, name: "Rajesh Kumar", designation: "Purchase Manager", email: "rajesh@alnoor.ae", phone: "0507778888",
      isPrimary: true, partyKind: "customer", partyId: "c1", partyName: "Al Noor Foods Trading", unlinked: false, notes: "Prefers a call before noon",
      createdAt: "2026-10-01T06:00:00.000Z", actions: { edit: true, delete: true, logActivity: true }, ...over,
    });
    if (p.endsWith("/crm/dashboard")) {
      return {
        today: "2026-10-19", openLeads: 4, openDeals: 3, pipelineValue: 96500, weightedValue: 59450, staleDeals: 1, dueToday: 2, overdue: 1,
        since: "2026-10-12",
        late: [followUp(1)],
        mine: [followUp(3, { _id: "ac3", subject: "Visit the Deira branch", kind: "visit", kindLabel: "Visit", dueAt: "2026-10-19", dueState: "today" })],
        moved: [
          { dealId: "op1", opportunityNo: "OPP-2026-0001", title: "Monthly rice and sunflower oil", customerName: "Al Noor Foods Trading", event: "quotation_sent", eventLabel: "Quotation sent", from: "qualified", to: "quoted", stageName: "Quotation sent", docNo: "QT-2026-0007", at: "2026-10-16T09:00:00.000Z" },
          { dealId: "op3", opportunityNo: "OPP-2026-0003", title: "Dates and nuts", customerName: "Noor Supermarket", event: "invoice_approved", eventLabel: "Invoice approved", from: "accepted", to: "won", stageName: "Won", docNo: "SO-2026-0042", at: "2026-10-18T11:00:00.000Z" },
        ],
        topDeals: [
          { _id: "op1", title: "Monthly rice and sunflower oil", customerName: "Al Noor Foods Trading", stageName: "Quotation sent", probability: 50, value: 48500, weighted: 24250 },
          { _id: "op3", title: "Dates and nuts", customerName: "Noor Supermarket", stageName: "Offer accepted", probability: 90, value: 28000, weighted: 25200 },
        ],
        byOwner: [
          { key: "Asif Rahman", name: "Asif Rahman", deals: 2, value: 68500, weighted: 34250 },
          { key: "Maya Khan", name: "Maya Khan", deals: 1, value: 28000, weighted: 25200 },
          { key: "Unassigned", name: "Unassigned", deals: 1, value: 12000, weighted: 1200 },
        ],
        trend: [
          { month: "2026-05", deals: 2, value: 41000 }, { month: "2026-06", deals: 1, value: 18000 },
          { month: "2026-07", deals: 3, value: 62000 }, { month: "2026-08", deals: 0, value: 0 },
          { month: "2026-09", deals: 4, value: 88000 }, { month: "2026-10", deals: 2, value: 74000 },
        ],
        funnel: stageRows("funnel"),
        pulse: Array.from({ length: 14 }, (_, i) => ({ day: `2026-10-${String(6 + i).padStart(2, "0")}`, count: [2, 0, 3, 1, 4, 0, 0, 2, 5, 1, 3, 2, 0, 4][i] })),
        leadSources: [
          { key: "referral", name: "Referral", value: 4 }, { key: "walk_in", name: "Walk-in", value: 3 },
          { key: "website", name: "Website", value: 2 }, { key: "exhibition", name: "Exhibition", value: 1 },
        ],
      };
    }
    if (p.endsWith("/crm/activities")) {
      return [
        followUp(2, { _id: "ac2", subject: "Rang about the rice price", status: "DONE", outcome: "interested", dueState: "done", completedAt: "2026-10-17T06:30:00.000Z", auto: false, createdAt: "2026-10-17T06:00:00.000Z" }),
        followUp(1, { createdAt: "2026-10-16T05:00:00.000Z" }),
        followUp(4, { _id: "ac4", kind: "note", kindLabel: "Note", subject: "Met at the trade fair", status: "DONE", outcome: "done", dueState: "done", regarding: { kind: "contact", id: "ct1" }, auto: false, createdAt: "2026-10-15T05:00:00.000Z" }),
      ];
    }
    if (p.endsWith("/crm/contacts")) return [contact(1), contact(2, { _id: "ct2", name: "Fatima Noor", designation: "Owner", partyKind: null, partyId: null, partyName: "", unlinked: true, isPrimary: false, email: "", phone: "0501110000" })];
    if (/\/crm\/contacts\/[^/]+$/.test(p)) return { ...contact(1), timeline, party: { kind: "customer", id: "c1", name: "Al Noor Foods Trading", code: "CUST2026001" } };
    if (p.endsWith("/crm/pipeline")) return { today: "2026-10-19", stages: stageRows("board"), totals: { count: 3, value: 96500, weighted: 59450, stale: 1, overdueAction: 1 } };
    if (p.endsWith("/crm/owners")) return [{ id: "a1", name: "Asif Rahman" }, { id: "a2", name: "Maya Khan" }];
    if (p.endsWith("/crm/stages")) return stages;
    if (p.endsWith("/crm/settings")) return { autoAdvance: true, autoFollowUp: true, assignmentMode: "round_robin", fixedOwnerId: null, uncontactedHours: 24, staleDays: 14, quotationExpiryDays: 3, lastAssignedOwnerId: "a1" };
    if (p.endsWith("/crm/timeline")) return timeline;
    if (p.endsWith("/crm/follow-ups/count")) return { count: 1 };
    if (p.endsWith("/crm/follow-ups")) return [followUp(1), followUp(3, { _id: "ac3", subject: "Visit the Deira branch", kind: "visit", kindLabel: "Visit", dueAt: "2026-10-19", dueState: "today" })];
    // A spreadsheet preview: two rows to be made, one with a problem (what the dialog's last step before the import shows).
    // Declared before the one-lead pattern below, which would otherwise read "import" as a lead's id.
    if (p.endsWith("/crm/leads/import") || p.endsWith("/crm/contacts/import")) {
      return {
        dryRun: true,
        summary: { total: 3, create: 2, invalid: 1, duplicate: 0, skipped: 0 },
        issues: [{ line: 4, status: "invalid", errors: [{ message: "Give the person or company a name" }] }],
        sample: [{ name: "Hassan Al Noor", company: "Al Noor Foods Trading", phone: "0501234567" }, { name: "Fatima Noor", company: "Noor Supermarket", phone: "0501110000" }],
      };
    }
    // The customers a deal can be opened on: the CRM's own narrow list
    if (p.endsWith("/crm/customers")) return [{ id: "c1", name: "Al Noor Foods Trading", code: "CUST2026001", active: true }, { id: "c2", name: "Noor Supermarket", code: "CUST2026002", active: true }];
    // Files on a lead or a deal: one with a long name on purpose, because that is what breaks a row
    if (/\/crm\/(leads|opportunities)\/[^/]+\/attachments$/.test(p)) {
      return [
        { attachmentId: "f1", fileName: "Signed quotation QT-2026-0007 - Al Noor Foods Trading - final version.pdf", fileType: "application/pdf", fileSize: 184320, label: "Quotation" },
        { attachmentId: "f2", fileName: "Site photo.jpg", fileType: "image/jpeg", fileSize: 2411724, label: "" },
      ];
    }
    if (p.endsWith("/crm/leads/summary")) return { today: "2026-10-19", total: 9, open: 4, hot: 1, unassigned: 1, converted: 3, lost: 2, openValue: 128000, overdueFollowUps: 1 };
    if (p.endsWith("/crm/leads/duplicates")) return { leads: [], customers: [] };
    if (p.endsWith("/crm/leads")) return [lead(1), lead(2, { _id: "ld2", leadNo: "LD-2026-0002", name: "Fatima Noor", company: "Noor Supermarket", band: "hot", score: 78, source: "walk_in", sourceLabel: "Walk-in", ownerName: "Maya Khan", expectedValue: 83000, overdueAction: false, nextActionAt: "2026-10-21" })];
    if (/\/crm\/leads\/[^/]+\/activity$/.test(p)) return activityRows();
    if (/\/crm\/leads\/[^/]+$/.test(p)) return { ...lead(1), timeline, opportunity: null };
    if (p.endsWith("/crm/opportunities")) return [deal(1), deal(3, { _id: "op3", opportunityNo: "OPP-2026-0003", title: "Dates and nuts", stageKey: "accepted", stageName: "Offer accepted", probability: 90, value: 28000 })];
    if (/\/crm\/opportunities\/[^/]+\/activity$/.test(p)) return activityRows();
    if (/\/crm\/opportunities\/[^/]+$/.test(p)) return { ...deal(1), timeline, customer: { _id: "c1", customerName: "Al Noor Foods Trading", phone: "0501234567", email: "buyer@alnoor.ae", creditLimit: 50000, paymentTerms: "Net 30" }, pipeline: stages };
    // A day's meetings, for the agenda and the clash warning in the schedule dialog.
    // A person's own Google connection: connected, so the panel draws its fullest state.
    // Writing to a customer: the templates a person picks from, and the people we already hold for the deal.
    if (p.endsWith("/crm/email/templates")) {
      return {
        starters: false,
        signature: "Asif Rahman\nAl Noor Trading",
        placeholders: [{ key: "contact.firstName", label: "Their first name" }, { key: "deal.title", label: "What the deal is for" }],
        templates: [
          { key: "after-a-call", name: "After a call", subject: "Following up on our call", body: "Hello {{contact.firstName}},\n\nThank you for your time today." },
          { key: "sending-a-quotation", name: "Sending a quotation", subject: "Our quotation for {{deal.title}}", body: "Hello {{contact.firstName}},\n\nPlease find our quotation attached." },
        ],
      };
    }
    if (p.endsWith("/crm/email/recipients")) {
      return {
        regarding: { kind: "opportunity", id: "op1", name: "Flour for the new branch" },
        deal: { title: "Flour for the new branch", value: 48000 },
        customer: { name: "Al Noor Foods Trading" },
        people: [
          { id: "ct1", name: "Rajesh Kumar", email: "rajesh@alnoor.test", designation: "Purchase Manager", primary: true },
          { id: "ct2", name: "Fatima Noor", email: "fatima@alnoor.test", designation: "Owner", primary: false },
        ],
      };
    }
    if (p.endsWith("/crm/google/status")) return { available: true, connected: true, label: "Connected as asif@gmail.test", detail: "", email: "asif@gmail.test", connectedAt: "2026-10-20T09:00:00.000Z" };
    if (p.endsWith("/crm/meetings/day")) {
      return [
        { _id: "mt1", subject: "Price review for 200 bags of flour", kind: "meeting", status: "OPEN", meeting: { time: "14:30", timeRange: "14:30 - 15:00", minutes: 30, where: "online", joinUrl: "https://meet.example.com/abc-defg-hij", cancelled: false, attendees: [{ kind: "contact", id: "ct1", name: "Rajesh Kumar", email: "rajesh@alnoor.test", rsvp: "accepted" }] } },
        { _id: "mt2", subject: "Site visit", kind: "meeting", status: "OPEN", meeting: { time: "16:00", timeRange: "16:00 - 17:00", minutes: 60, where: "in_person", location: "Deira office", cancelled: false, attendees: [] } },
      ];
    }
    if (p.endsWith("/crm/calendar")) {
      const at = (id, type, day, title, over = {}) => ({ id, type, day, title, sub: "", status: "OPEN", overdue: false, movable: false, ...over });
      return {
        today: "2026-10-19", from: "2026-09-28", to: "2026-11-01",
        items: [
          at("c1", "activity", "2026-10-14", "Chase the signed contract copy", { sub: "Call", kind: "call", overdue: true, movable: true, ownerName: "Asif Rahman" }),
          at("c2", "activity", "2026-10-19", "Visit the Deira branch", { sub: "Visit", kind: "visit", movable: true, ownerName: "Asif Rahman" }),
          at("c3", "activity", "2026-10-19", "Send the price for 200 bags", { sub: "Call", kind: "call", movable: true }),
          at("c4", "activity", "2026-10-19", "Met at the trade fair", { sub: "Note", kind: "note", status: "DONE" }),
          at("c5", "deal", "2026-10-19", "Monthly rice and sunflower oil", { sub: "Al Noor Foods Trading", value: 48500 }),
          at("c6", "activity", "2026-10-22", "Works visit with the production head", { sub: "Meeting", kind: "meeting", movable: true }),
          // a scheduled meeting: it leads with its hour on the chip, which is the one entry that is not a whole day
          at("c9", "activity", "2026-10-19", "Price review for 200 bags of flour", { sub: "Meeting", kind: "meeting", time: "14:30", online: true, hasLink: true, ownerName: "Asif Rahman" }),
          at("c7", "deal", "2026-10-30", "Dates and nuts", { sub: "Noor Supermarket", value: 28000 }),
          at("c8", "lead", "2026-10-07", "Hassan Al Noor", { sub: "Al Noor Foods", status: "NEW" }),
        ],
      };
    }
    if (p.endsWith("/crm/reports/aging")) {
      const aged = (i, days, over = {}) => ({
        id: `op${i}`, opportunityNo: `OPP-2026-000${i}`, title: "Monthly rice and sunflower oil", customerName: "Al Noor Foods Trading",
        stageKey: "quoted", stageName: "Quotation sent", ownerName: "Asif Rahman", value: 48500, days, band: "0-7", bandLabel: "Up to a week",
        stale: false, expectedCloseDate: "2026-11-05", overdueClose: false, ...over,
      });
      return {
        today: "2026-10-19",
        bands: [
          { key: "0-7", label: "Up to a week", deals: 1, value: 48500 },
          { key: "8-14", label: "1 to 2 weeks", deals: 0, value: 0 },
          { key: "15-30", label: "2 to 4 weeks", deals: 0, value: 0 },
          { key: "31-60", label: "1 to 2 months", deals: 1, value: 28000, },
          { key: "60+", label: "Over 2 months", deals: 0, value: 0 },
        ],
        rows: [
          aged(3, 47, { _id: "op3", opportunityNo: "OPP-2026-0003", title: "Dates and nuts", customerName: "Noor Supermarket", value: 28000, band: "31-60", bandLabel: "1 to 2 months", stale: true, overdueClose: true, expectedCloseDate: "2026-10-01" }),
          aged(1, 3),
        ],
        oldest: 47, average: 25, stale: 1, overdueClose: 1, capped: false,
      };
    }
    if (p.endsWith("/crm/reports/activity")) {
      return {
        period: { from: "2026-09-20", to: "2026-10-19", today: "2026-10-19" },
        byKind: [
          { kind: "call", label: "Call", done: 9, open: 3, overdue: 1 },
          { kind: "visit", label: "Visit", done: 4, open: 1, overdue: 0 },
          { kind: "whatsapp", label: "WhatsApp", done: 5, open: 1, overdue: 0 },
        ],
        byPerson: [
          { key: "a1", name: "Asif Rahman", done: 12, open: 3, overdue: 1, total: 15 },
          { key: "a2", name: "Maya Khan", done: 6, open: 2, overdue: 0, total: 8 },
        ],
        byDay: [{ day: "2026-10-17", count: 4 }, { day: "2026-10-18", count: 6 }],
        done: 18, open: 5, overdue: 1, capped: false,
      };
    }
    if (p.endsWith("/crm/analysis")) {
      return {
        period: { from: "2026-09-20", to: "2026-10-19", today: "2026-10-19" },
        leads: { total: 9, converted: 3, lost: 2, open: 4, conversionRate: 33.3 },
        deals: { total: 6, open: 3, won: 2, lost: 1, winRate: 66.7, wonValue: 74000, lostValue: 12000, openValue: 96500, weightedValue: 59450, averageDaysToWin: 11.5 },
        activity: { done: 18, open: 5, overdue: 1 },
        funnel: stageRows("funnel"),
        bySource: [
          { source: "referral", label: "Referral", leads: 4, converted: 2, lost: 1, value: 96000, conversionRate: 50 },
          { source: "walk_in", label: "Walk-in", leads: 3, converted: 1, lost: 1, value: 51000, conversionRate: 33.3 },
          { source: "website", label: "Website", leads: 2, converted: 0, lost: 0, value: 14000, conversionRate: 0 },
        ],
        byOwner: [
          { ownerId: "a1", name: "Asif Rahman", leads: 5, deals: 4, won: 2, lost: 1, wonValue: 74000, activities: 12, winRate: 66.7 },
          { ownerId: "a2", name: "Maya Khan", leads: 3, deals: 2, won: 0, lost: 0, wonValue: 0, activities: 6, winRate: null },
          { ownerId: null, name: "Unassigned", leads: 1, deals: 0, won: 0, lost: 0, wonValue: 0, activities: 0, winRate: null },
        ],
        lostReasons: [{ reason: "price", label: "Price too high", deals: 1, value: 12000 }],
        capped: false,
      };
    }
    return [];
  }

  // Process orders (Inventory > Production > Board / Process orders): one order mid-way (bending at Ravi, painting at the
  // coater, packing to come), one ready to finish, the board built from them
  if (p.includes("/process-orders")) {
    const st = (seq, name, status, over = {}) => ({ _id: `st${seq}`, seq, name, mode: "in_house", status, plannedQty: 100, qtyDone: status === "DONE" ? 96 : 0, qtyRejected: status === "DONE" ? 4 : 0, dueDate: `2026-10-${16 + seq}`, dueState: status === "DONE" ? "done" : seq === 2 ? "overdue" : "later", assigneeId: "a1", assigneeName: "Ravi Kumar", actions: { start: status === "READY", complete: status === "READY" || status === "IN_PROGRESS", send: false }, ...over });
    const order = (i, ready = false) => ({
      _id: `po${i}`, processNo: `PRO-2026-000${i}`, status: "OPEN", date: "2026-10-15", dueDate: "2026-10-24",
      finished: { stockId: "s1", itemId: "ITM001", itemName: "Car keychain holder (finished, matt black)", qty: 100 },
      materials: [{ _id: "pm1", stockId: "s2", itemId: "ITM002", itemName: "Car keychain holder (raw, zinc alloy)", qty: 100 }],
      steps: ready ? [st(1, "Cutting", "DONE"), st(2, "Bending", "DONE"), st(3, "Packing", "DONE")]
        : [st(1, "Cutting", "DONE"), st(2, "Bending", "IN_PROGRESS"), st(3, "Powder coating", "WAITING", { mode: "job_work", assigneeId: null, assigneeName: null, jobWorkerName: "Shine Powder Coaters and Industrial Finishers" }), st(4, "Packing", "WAITING")],
      current: ready ? null : { _id: "st2", name: "Bending", seq: 2, status: "IN_PROGRESS" }, readyToFinish: ready, finishedQty: ready ? 96 : 0,
      actions: { edit: false, delete: false, release: false, cancel: true, finish: ready, reopen: false, addCost: true },
      costs: ready ? [] : [{ _id: "pc1", stepId: "st3", stepName: "Powder coating", accountId: "e1", accountName: "Powder Coating Charges", amount: 4500, voucherId: "v1", voucherNo: "EV-2026-0004", narration: "Matt black RAL 9005" }],
      costTotal: ready ? 0 : 4500,
    });
    const card = (o, s) => ({ orderId: o._id, processNo: o.processNo, itemName: o.finished.itemName, qty: 100, orderDue: "2026-10-24", stepId: s._id, stepName: s.name, stepSeq: s.seq, stepCount: o.steps.length, status: s.status, mode: s.mode, who: s.assigneeName || s.jobWorkerName, assigneeId: s.assigneeId, plannedQty: 96, jobWorkNo: null, due: s.dueDate, dueState: s.dueState });
    const a = order(1), b = order(2, true);
    if (p.endsWith("/board")) {
      const c1 = card(a, a.steps[1]);
      const c2 = { ...card(b, b.steps[2]), stepId: null, stepName: "Ready to finish", stepSeq: null, status: "READY_TO_FINISH", dueState: "none" };
      return { today: "2026-10-19", counts: { orders: 2, pending: 0, inProgress: 1, doneToday: 2, overdue: 1, dueToday: 0, dueTomorrow: 0, readyToFinish: 1 },
        columns: [{ name: "Bending", order: 2, cards: [c1] }, { name: "Ready to finish", order: 99, cards: [c2] }], overdue: [c1], dueToday: [], dueTomorrow: [], mine: [c1],
        withJobWorkers: [{ jobWorkId: "jw2", jobWorkNo: "JWC-2026-0002", worker: "Shine Powder Coaters and Industrial Finishers", processNo: "PRO-2026-0003", items: [{ name: "Car keychain holder (raw, zinc alloy)", out: 50 }], sent: "2026-10-16", daysOut: 3, returnBy: "2027-10-16", overdue: false, value: 2500 }] };
    }
    if (p.endsWith("/assignees")) return [{ id: "a1", name: "Ravi Kumar" }, { id: "a2", name: "Sunita Patil" }];
    if (p.endsWith("/my-work")) return { count: 1 };
    if (p.endsWith("/expense-vouchers")) return [{ id: "v1", voucherNo: "EV-2026-0004", date: "2026-10-16", accountId: "e1", accountName: "Powder Coating Charges", party: "Shine Powder Coaters and Industrial Finishers", description: "Coating, 100 pcs", net: 9000, used: 4500, left: 4500 }];
    if (p.endsWith("/analysis")) {
      const row = (key, label, done, wait, work, late, withDue, rejected, extra = {}) => ({ key, label, done, good: done * 95, rejected, rejectPct: rejected ? Math.round((rejected / (done * 95 + rejected)) * 1000) / 10 : null, waitHours: wait, workHours: work, late, withDue, latePct: withDue ? Math.round((late / withDue) * 1000) / 10 : null, ...extra });
      return {
        period: { from: "2026-10-01", to: "2026-10-19" },
        orders: { finished: 6, unitsOrdered: 600, unitsMade: 571, yieldPct: 95.2, avgLeadDays: 6.4, withDue: 6, onTime: 4, onTimePct: 66.7 },
        steps: [row("Cutting", "Cutting", 7, 3.5, 5, 0, 7, 9), row("Bending", "Bending", 7, 20, 9.5, 2, 7, 14), row("Powder coating", "Powder coating", 6, 2, 96, 1, 6, 4), row("Packing", "Packing", 6, 6, 2, 0, 6, 0)],
        people: [row("in_house:a1", "Ravi Kumar", 14, 11.5, 7.2, 2, 14, 23, { mode: "in_house" }), row("job_work:v9", "Shine Powder Coaters and Industrial Finishers", 6, 2, 96, 1, 6, 4, { mode: "job_work" }), row("in_house:a2", "Sunita Patil", 6, 6, 2, 0, 6, 0, { mode: "in_house" })],
        reasons: [{ reason: "Bent or cracked", qty: 14 }, { reason: "Dimension out of tolerance", qty: 9 }, { reason: "Coating defect", qty: 4 }],
        daily: [["2026-10-13", 3, 0], ["2026-10-14", 4, 95], ["2026-10-15", 2, 0], ["2026-10-16", 5, 190], ["2026-10-17", 3, 96], ["2026-10-18", 4, 190]].map(([day, stepsDone, unitsFinished]) => ({ day, stepsDone, unitsFinished })),
      };
    }
    if (p.endsWith("/last-steps")) return [];
    if (p.endsWith("/process-orders/po2")) return b;
    if (p.split("/process-orders/")[1]) return a;
    return [a, b];
  }

  // Saved routes (Inventory > Production > Routes): one product's way through the shop, and the plan a new order gets
  if (p.includes("/process-routes")) {
    const route = {
      _id: "pr1", finished: { stockId: "it1", itemId: "ITM001", itemName: "Car keychain holder (finished, matt black)" }, batchQty: 100,
      materials: [{ stockId: "it2", itemId: "ITM002", itemName: "Car keychain holder (raw, zinc alloy)", qty: 100 }],
      steps: [
        { name: "Cutting", mode: "in_house", assigneeId: "a1", assigneeName: "Ravi Kumar", days: 1 },
        { name: "Bending", mode: "in_house", assigneeId: "a1", assigneeName: "Ravi Kumar", days: 1 },
        { name: "Powder coating", mode: "job_work", jobWorkerId: "v9", jobWorkerName: "Shine Powder Coaters and Industrial Finishers", days: 4 },
        { name: "Packing", mode: "in_house", assigneeId: "a2", assigneeName: "Sunita Patil", days: 1 },
      ],
      totalDays: 7,
    };
    if (p.endsWith("/plan")) return { route, order: null };
    if (p.split("/process-routes/")[1]) return route;
    return [route, { ...route, _id: "pr2", finished: { stockId: "s3", itemId: "ITM003", itemName: "Bottle opener keyring" }, steps: route.steps.slice(0, 2), totalDays: 2 }];
  }

  // Job work (Inventory > Production > Job work): a job half back, its challan, and what is with job workers
  if (p.includes("/job-work")) {
    if (p.endsWith("/with-job-worker")) return { s2: 4 };
    const job = (i, status = "PARTLY_RECEIVED") => ({
      _id: `jw${i}`, jobWorkNo: `JWC-2026-000${i}`, status, date: "2026-10-1" + i, returnBy: "2027-10-1" + i, overdue: i === 3,
      purpose: "Powder coating, matt black RAL 9005", vehicleNo: "MH12AB1234",
      jobWorker: { name: "Shine Powder Coaters and Industrial Finishers", code: "V009", address: "Plot 44, MIDC Bhosari, Pune 411026", taxId: "27ABCDE1234F1Z5", phone: "+91 98200 00000" },
      lines: [{ _id: "l1", rawStockId: "s2", rawItemId: "ITM002", rawName: "Car keychain holder (raw, zinc alloy)", qtySent: 100, unitValue: 50, finishedStockId: "s1", finishedName: "Car keychain holder", finishedPerRaw: 1 }],
      receipts: [{ _id: "r1", date: "2026-10-15", workerRef: "SPC/118", productions: [{ id: "prd1", no: "PRD-2026-0001" }], lines: [{ lineId: "l1", finishedQty: 60, rawConsumed: 60 }] }],
      progress: { atWorker: 40, status, lines: [{ lineId: "l1", qtySent: 100, expectedFinished: 100, finished: 60, consumed: 60, returned: 0, atWorker: 40 }] },
      atWorker: 40,
      actions: { edit: false, delete: false, send: false, receive: true, cancel: false, challan: true },
    });
    if (/\/job-work\/[^/]+$/.test(p)) return job(1);
    return [job(1), job(2, "SENT"), job(3, "SENT"), job(4, "RECEIVED")];
  }

  // Productions (Inventory > Production): the list, one posted production with materials and three costs, the cost report
  if (p.includes("/productions")) {
    const prod = (i, status = "POSTED") => ({
      _id: `prd${i}`, productionNo: `PRD-2026-000${i}`, date: "2026-10-1" + i, status, ledgerPosted: status !== "DRAFT",
      finished: { stockId: "s1", itemId: "ITM001", itemName: "Coated steel bracket, powder finish, 40 mm", qty: 12 },
      materials: [{ _id: "m1", stockId: "s2", itemId: "ITM002", itemName: "Raw steel bracket 40 mm", qty: 12, cost: 600 }],
      costs: [
        { _id: "c1", accountId: "a1", accountName: "Travelling", amount: 50 },
        { _id: "c2", accountId: "a2", accountName: "Metal Coating Powder", amount: 50, narration: "2 kg of powder, RAL 9005" },
        { _id: "c3", accountId: "a3", accountName: "Packing", amount: 20 },
      ],
      totals: { materials: 600, costs: 120, total: 720, unitCost: 60 },
      actions: { edit: status === "DRAFT", delete: status === "DRAFT", post: status === "DRAFT", reverse: status === "POSTED" },
    });
    if (p.endsWith("/cost-report")) {
      const r = prod(1);
      return {
        items: [{ stockId: "s1", itemId: "ITM001", itemName: r.finished.itemName, qty: 24, count: 2, materials: 1200, costs: 240, total: 1440, unitCost: 60,
          materialLines: [{ stockId: "s2", itemName: "Raw steel bracket 40 mm", qty: 24, cost: 1200 }],
          costLines: r.costs.map((c) => ({ accountId: c.accountId, accountName: c.accountName, accountCode: "EXP-90" + c._id.slice(1), amount: c.amount * 2 })),
          productions: [{ _id: "prd1", productionNo: "PRD-2026-0001" }, { _id: "prd2", productionNo: "PRD-2026-0002" }] }],
        totals: { materials: 1200, costs: 240, total: 1440 },
      };
    }
    if (/\/productions\/[^/]+$/.test(p)) return prod(1);
    return [prod(1), prod(2), prod(3, "DRAFT"), prod(4, "REVERSED")];
  }

  // Goods received: the same, plus the not-invoiced worklist and what is left to receive on an order
  if (p.includes("/goods-receipts")) {
    if (p.endsWith("/summary")) return { byStatus: { DRAFT: 1, RECEIVED: 3, CANCELLED: 1 }, uninvoiced: { count: 2, value: 18522 } };
    if (p.endsWith("/activity")) return { rows: activityRows(), total: 3, page: 1, pages: 1 };
    if (p.includes("/from-order/")) {
      return {
        order: { id: "to2", no: "PORD-2026-0002", status: "CONFIRMED", date: "2026-10-02", reference: "LPO-1" }, party: { vendorName: "Gulf Mill 2", vendorId: "V002" },
        lines: n(docLine, 3).map((l) => ({ sourceLineId: l._id, itemId: l.itemId, itemCode: l.itemCode, description: l.description, stockDetails, price: 42, ordered: l.qty * 2, received: l.qty / 2, onTheWay: 0, toReceive: l.qty * 1.5 })),
      };
    }
    if (/\/goods-receipts\/[^/]+$/.test(p)) return goodsReceiptDoc();
    return n(goodsReceipt, 5);
  }

  // Delivery notes: the same, plus the report of what is delivered and not invoiced, and stock availability
  if (p.includes("/delivery-notes")) {
    if (p.endsWith("/summary")) {
      return { byStatus: { DRAFT: 1, DISPATCHED: 1, DELIVERED: 3, CANCELLED: 1 }, uninvoiced: { count: 2, value: 18522 }, clock: { count: 2, within: 0, dueSoon: 1, pastStandard: 0, overdue: 1 } };
    }
    if (p.endsWith("/uninvoiced")) return { rows: [], summary: { count: 0, value: 0, within: 0, dueSoon: 0, pastStandard: 0, overdue: 0 } };
    if (p.endsWith("/availability")) return [];
    if (p.endsWith("/activity")) return { rows: activityRows(), total: 3, page: 1, pages: 1 };
    if (p.includes("/from-order/")) {
      return { order: { id: "o1", no: "SO-2026-0042", status: "DRAFT", date: "2026-10-02", reference: "LPO-1" }, party: { customerName: "Al Noor Trading", customerId: "C001" }, deliveryAddress: "Al Quoz", lines: n(docLine, 3).map((l) => ({ sourceLineId: l._id, itemId: l.itemId, itemCode: l.itemCode, description: l.description, stockDetails, price: 42, ordered: l.qty * 2, delivered: l.qty / 2, pending: 0, remaining: l.qty * 1.5, over: false })) };
    }
    if (p.endsWith("/pick-list")) return { deliveryNoteNo: "DLN-2026-0002", customer: "Al Noor Trading 2", date: "2026-10-02", minShelfLifeDays: 30, lines: [{ lineId: "l1", itemCode: "ITM001", description: "Basmati Rice 5kg", unit: "BAG", qty: 10, basis: "suggested", unallocated: 0, batches: [{ batchNumber: "B-2026-1", expiryDate: "2027-03-01", qty: 10 }] }] };
    if (/\/delivery-notes\/[^/]+$/.test(p)) return deliveryNoteDoc();
    return n(deliveryNote);
  }

  // { cashAccounts, bankAccounts, cards } - the payment options CashAndBank is built from
  if (p.includes("payment-options") || p.includes("payment-modes")) {
    return { cashAccounts: n(account, 3), bankAccounts: n(account, 3), cards: [], modes: ["cash", "bank", "cheque"] };
  }

  // the chart is categories > groups > accounts
  if (p.includes("/chart")) {
    const group = (id, name, code) => ({
      // the server sends `prefix` (the account form prints "Code will start with ..."), not only a code
      _id: id, name, code, prefix: code, children: [], ungrouped: [], role: null,
      accounts: n(account, 3).map((a) => ({ ...a, isActive: true })),
      totals: { opening: 0, debit: 0, credit: 0, closing: 0 },
    });
    return {
      categories: [
        { category: "Assets", groups: [group("g1", "Current assets", "1000"), { ...group("g3", "Bank", "1100"), role: "bank" }], ungrouped: [] },
        { category: "Income", groups: [group("g2", "Revenue", "4000")], ungrouped: [] },
      ],
      counts: { accounts: 6, groups: 2, inactive: 0 },
      ledgerPosting: true,
    };
  }

  if (p.includes("einvoic") || p.includes("e-invoic")) {
    if (p.endsWith("/settings")) return { enabled: true, provider: "sandbox", environment: "sandbox", participantId: "0235:100123456700003", dueDays: 0, retryMax: 5, connected: false, hasWebhookSecret: true };
    if (p.endsWith("/readiness")) {
      return {
        ready: false,
        seller: [{ key: "trn", label: "Company TRN (15 digits)", ok: false }, { key: "legalName", label: "Company legal name", ok: true }],
        parties: { total: 2, ready: 1, notReady: [{ _id: "c2", customerName: "Incomplete Trading LLC", missing: ["City"], problems: ["VAT Number must be 15 digits"] }] },
      };
    }
    if (p.endsWith("/dashboard")) {
      return {
        outbound: { total: 6, byStatus: { REPORTED: 3, FAILED: 1, REJECTED: 1 }, net: 1000, tax: 50, payable: 1050, successRate: 60, needsAttention: 2 },
        inbound: { RECEIVED: 4 }, recent: [{ _id: "r1", documentNo: "SO-2026-0001", buyerName: "Al Noor Trading", status: "REPORTED", updatedAt: "2026-10-04T08:00:00Z" }],
      };
    }
    if (p.endsWith("/documents")) {
      const d = (i, status, over = {}) => ({ _id: `d${i}`, transactionNo: `SO-2026-000${i}`, type: "sales_order", invoiceTypeCode: "380", date: "2026-10-0" + i, customer: `Al Noor Trading ${i}`, total: 1050 * i, status, partyReady: true, partyMissing: [], submissionId: null, lastError: null, overdue: false, ...over });
      return [d(1, "NOT_SENT"), d(2, "REPORTED", { submissionId: "s1" }), d(3, "FAILED", { submissionId: "s2", lastError: "Timed out" }), d(4, "NOT_SENT", { partyReady: false, partyMissing: ["City", "Participant ID"] })];
    }
    return {
      counts: { RECEIVED: 4, NOT_SENT: 3, QUEUED: 1, SUBMITTED: 2, ACKNOWLEDGED: 2, REPORTED: 5, FAILED: 1, REJECTED: 0 },
      inbound: { RECEIVED: 4, QUEUED: 0, SUBMITTED: 0, ACKNOWLEDGED: 2, REPORTED: 3, FAILED: 0, REJECTED: 0 },
      outbound: { NOT_SENT: 3, QUEUED: 1, SUBMITTED: 2, ACKNOWLEDGED: 2, REPORTED: 5, FAILED: 1, REJECTED: 0 },
      rows: n(doc), enabled: false, readiness: { ready: 4, blocked: 1, checks: [] }, mandate: [],
    };
  }

  // The dashboard is five calls (summary, analytics, sales, inventory, reports) and every tile
  // reads a nested figure, so this is the one shape worth writing out in full - a missing key
  // here reads as a blank page and hides whatever the harness was meant to catch.
  if (p.includes("dashboard")) {
    const AGEING = [
      { key: "current", label: "Not yet due", receivables: 120000, payables: 64000 }, { key: "d1_30", label: "1-30 days", receivables: 48000, payables: 12000 },
      { key: "d31_60", label: "31-60 days", receivables: 0, payables: 0 }, { key: "d61_90", label: "61-90 days", receivables: 0, payables: 0 },
      { key: "d90plus", label: "Over 90 days", receivables: 4700, payables: 0 },
    ];
    const months = (n2 = 8) =>
    Array.from({ length: n2 }, (_, i) => ({
      month: `2026-0${(i % 9) + 1}`, revenue: 80000 + i * 9000, purchases: 60000 + i * 7000,
      sales: 80000 + i * 9000, cogs: 50000 + i * 5000, value: 80000 + i * 9000,
    }));
    const period = { id: "month", label: "This month", from: "2026-10-01", to: "2026-10-31" };
    const change = (v) => ({ value: v, changePct: 12.5 });

    if (p.includes("/sales")) {
      return {
        period, monthly: months(),
        daily: Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-0${i + 1}`, revenue: 12000 + i * 900, orders: 3 + i })),
        topCustomers: n(party, 5).map((x) => ({ partyId: x._id, name: x.name, netRevenue: 42000 })),
        // the server's shape (dashboardService): the tile is keyed by itemId, and a null change is drawn as no figure at all
        bestSellers: n(batch, 5).map((b, i) => ({ itemId: `IT00${i + 1}`, name: b.itemName, revenue: 24000 - i * 1500, changePct: i === 2 ? null : 6 - i * 3, fillPct: 100 - i * 14 })),
        orders: { count: 142, changePct: 8.2 }, averageOrder: change(1250),
        approvedShare: { pct: 0, changePct: null }, returns: { count: 2, value: 3400 },
      };
    }
    if (p.includes("/inventory")) {
      return {
        // the server's shapes (dashboardService.inventory): the tiles, the mix and both alert lists are keyed by `key`, `stockId`
        // and `batchId`, and the trend draws only when `available`
        period, stockValueTrend: { available: true, months: months(6) },
        categories: n(batch, 4).map((b, i) => ({ key: `c${i}`, name: `Category ${i + 1}`, items: 12 - i * 2, value: 60000 - i * 8000, sharePct: 38 - i * 6 })),
        mix: n(batch, 4).map((b, i) => ({ key: `c${i}`, name: b.itemName, value: 40000 - i * 6000, sharePct: 34 - i * 6 })),
        lowStock: n(batch, 3).map((b) => ({ stockId: b._id, itemName: b.itemName, qty: 4, unit: "kg", reorderLevel: 20, status: "below" })),
        batches: n(batch, 3).map((b) => ({ batchId: b._id, stockId: `s${b._id}`, itemName: b.itemName, batchNumber: b.batchNumber, qtyOnHand: b.qtyOnHand, unit: "kg", expiryDate: b.expiryDate, daysToExpiry: 12, expired: false })),
        totals: { value: 480000, items: 128, reorderItems: 3, expiring: 2, expired: 0, agreesWithLedger: true },
        stockFlow: { from: "2026-10-01", to: "2026-10-31", opening: 410000, purchases: 260000, salesReturns: 6000, adjustments: -4000, purchaseReturns: 9000, sales: 168000, writeOffs: 15000, closing: 480000 },
      };
    }
    if (p.includes("/reports")) {
      return {
        currency: "AED", period, grossProfit: 464000, netProfit: 284000,
        vat: { from: "2026-10-01", to: "2026-10-31", outputVat: 64200, recoverableVat: 41000, net: 23200, position: "payable", hasActivity: true },
        valueGrowth: months().map(({ month }, i) => ({ month, grossProfit: 30000 + i * 9000, netProfit: i === 2 ? -12000 : 8000 + i * 5000, revenue: 80000 + i * 9000 })),
        profitFlow: { revenue: 1284000, directCosts: 820000, grossProfit: 464000, operatingExpenses: 196000, otherIncome: 16000, netProfit: 284000 },
        expenses: {
          total: 196000,
          rows: [["Salaries", 82000], ["Rent", 36000], ["Utilities", 21000], ["Marketing", 18000], ["Transport", 15000], ["Other", 24000]].map(([name, amount], i) => ({ key: i === 5 ? "others" : "g" + i, name, amount, sharePct: Math.round((amount / 196000) * 1000) / 10 })),
        },
        vouchers: [{ voucherType: "receipt", amount: 930000 }, { voucherType: "payment", amount: 520000 }, { voucherType: "journal", amount: 40000 }, { voucherType: "contra", amount: 120000 }, { voucherType: "expense", amount: 64000 }],
        ageing: AGEING,
      };
    }
    if (p.includes("/analytics")) {
      return {
        period,
        // net profit with every month, as the server sends it (the month-by-month view needs it)
        monthly: months().map((m, i) => ({ ...m, grossProfit: Math.round(m.sales * 0.16), netProfit: [-9000, 4200, 6100, 5300, 9800, 7400, 11200, 13100][i] ?? 6000 })),
        weekly: Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-0${i + 1}`, revenue: 12000 + i * 800, orders: 3 + i })),
        performance: { collectionRatePct: 72.4, grossMarginPct: 18.4, stockAvailabilityPct: 94.1 },
        // every list below carries the `key` the server gives it: the screens key their rows by it, and a stub without it
        // makes React warn about every list (which then hides a real warning among the noise)
        customerMix: { total: 160000, rows: n(party, 4).map((x) => ({ key: x._id, name: x.name, value: 40000, sharePct: 25 })) },
        categorySales: { rows: [{ name: "Rice", current: 82000, previous: 74000 }, { name: "Oil", current: 61000, previous: 65000 }] },
        categoryMonths: { months: ["2026-08", "2026-09", "2026-10"], rows: [{ name: "Rice", values: [24000, 28000, 30000] }, { name: "Oil", values: [19000, 21000, 21000] }] },
        cashFlow: { months: months(6).map((m) => ({ month: m.month, inflow: m.revenue, outflow: m.purchases })), accounts: n(account, 3) },
        kpis: [
          { key: "open-sales", label: "Open sales orders", value: 186000, count: 7, to: "/sales-order" },
          { key: "open-purchases", label: "Open purchase orders", value: 94000, count: 3, to: "/purchase-order" },
          { key: "receipts-week", label: "Receipts this week", value: 41200, previous: 36800, changePct: 12, to: "/receipt-voucher" },
          { key: "payments-week", label: "Payments this week", value: 18700, previous: 21000, changePct: -11, to: "/payment-voucher" },
        ],
        pipeline: [["created", "Created"], ["approved", "Approved"], ["paid-in-part", "Part-paid or paid"], ["paid", "Fully paid"]].map(([key, label], i) => ({ key, label, value: 40 - i * 8 })),
        settlement: [["paid", "Paid"], ["part-paid", "Part-paid"], ["overdue", "Unpaid, overdue"], ["not-due", "Unpaid, not yet due"]].map(([key, label], i) => ({ key, label, count: 12 - i * 3, amount: 48000 - i * 9000 })),
        topCustomers: n(party, 5).map((x) => ({ partyId: x._id, name: x.name, netRevenue: 42000 })),
        // categories and metrics go together: a radar with categories and no metrics draws empty polygons (`<path d="Z">`)
        radar: {
          categories: [{ key: "c0", name: "Rice" }, { key: "c1", name: "Oil" }, { key: "c2", name: "Sugar" }],
          metrics: ["Volume", "Revenue", "Margin", "Stock value", "Customers served"].map((metric, i) => ({ metric, c0: 100 - i * 6, c1: 70 - i * 4, c2: 45 + i * 5 })),
        },
        ageing: AGEING,
        topVendors: [{ partyId: "v2", name: "Delta Foods", purchases: 100000, previous: 80000, changePct: 25 }, { partyId: "v1", name: "Gulf Mills", purchases: 50000, previous: 0, changePct: null }],
        collections: ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].map((weekStart, i) => ({ weekStart, receipts: i * 10000, invoiced: i * 20000 })),
        // long, real-looking names: the tile has to wrap and shorten them, never cut a word in half
        treemap: [
          ["Sunflower Oil - 1.5L x 6 Carton", 640000], ["Sunflower Oil - 18L Tin", 420000], ["Black Tea CTC - 400g x 24 Pack", 300000], ["Red Lentils Masoor - 25kg Bag", 260000],
          ["Toor Dal - 25kg Bag", 210000], ["White Long Grain Basmati Rice - 5kg", 120000], ["Pure Ghee - 1kg Tin", 90000], ["Whole Wheat Atta - 10kg Bag", 70000],
        ].map(([name, size], i) => ({ itemId: "SKU" + i, name, size })),
        businessFlow: {
          statement: { revenue: 302451, directCosts: 264305, grossProfit: 38146, operatingExpenses: 14051, otherIncome: 0, netProfit: 24095 },
          previous: { revenue: 1140000, netProfit: 241000, revenueChangePct: 12.6, statement: { revenue: 1140000, directCosts: 760000, grossProfit: 380000, operatingExpenses: 140000, otherIncome: 1000, netProfit: 241000 } },
          stages: { bought: 760000, stock: 480000, sold: 1284000, collected: 930000, owedByCustomers: 372000, owedToVendors: 210000 },
          cycle: { from: "2026-07-14", to: "2026-10-10", days: 89, minDays: 14, enough: true, dso: 38.4, dpo: 24.1, dio: 52.7, cycleDays: 67, receivables: 372000, payables: 210000, stockValue: 480000, invoiced: 870000, purchased: 775000, cogs: 810000 },
        },
        categoryMargin: { averagePct: 18.4, rows: [{ key: "k1", name: "Oils & Fats", revenue: 1060000, marginPct: 24.6 }, { key: "k2", name: "Tea & Beverages", revenue: 300000, marginPct: 31.2 }, { key: "k3", name: "Pulses", revenue: 470000, marginPct: 12.9 }, { key: "k4", name: "Rice & Grains", revenue: 190000, marginPct: -3.5 }] },
        hourly: [{ hour: 8, mon: 1, tue: 0, wed: 2, thu: 0, fri: 0, weekend: 0 }, { hour: 10, mon: 0, tue: 0, wed: 0, thu: 3, fri: 0, weekend: 1 }],
      };
    }

    // the summary: the header figures, ops, collection, trend, top product, VAT and activity
    return {
      period,
      headline: { revenue: 1284000, grossMarginPct: 18.4, averageInvoice: 9042, changePct: 6.1 },
      collection: { ratePct: 72.4, receipts: 930000, invoiced: 1284000 },
      monthly: months(),
      peak: { month: "2026-07", revenue: 152000 },
      topProduct: {
        stockId: "bt1", name: "Basmati Rice 1kg", revenue: 184000, changePct: 9.3,
        spark: months(7).map((m) => ({ month: m.month, revenue: m.revenue })),
      },
      vat: { hasActivity: true, position: "payable", net: 15000, outputVat: 24000, recoverableVat: 9000 },
      // opsRows destructures { count, total } out of each of these four
      ops: {
        activeOrders: { count: 6, total: 18 },
        pendingPurchaseOrders: { count: 2, total: 9 },
        lowStock: { count: 3, total: 128 },
        newCustomers: { count: 4, total: 42 },
      },
      attention: [], recent: [{"voucherId":"rv0","voucherType":"payment","typeLabel":"Payment","voucherNo":"PV-2026-0068","party":"Al Safa Edible Oils Trading FZCO","narration":"","amount":1000,"status":"Posted","date":"2026-10-08"},{"voucherId":"rv1","voucherType":"contra","typeLabel":"Contra","voucherNo":"CV-2026-0033","party":"Transfer to Emirates NBD - Current Account (AED)","narration":"","amount":1150,"status":"Posted","date":"2026-10-07"},{"voucherId":"rv2","voucherType":"sales_order","typeLabel":"Sales invoice","voucherNo":"SO-2026-0096","party":"Bright Star Wholesale LLC","narration":"","amount":1300,"status":"Unpaid","date":"2026-10-06"},{"voucherId":"rv3","voucherType":"receipt","typeLabel":"Receipt","voucherNo":"RV-2026-0106","party":"Al Madina Fresh Supermarket LLC","narration":"","amount":1450,"status":"Posted","date":"2026-10-05"},{"voucherId":"rv4","voucherType":"receipt","typeLabel":"Receipt","voucherNo":"RV-2026-0105","party":"Al Reef Trading Co. LLC","narration":"","amount":1600,"status":"Posted","date":"2026-10-04"},{"voucherId":"rv5","voucherType":"purchase_order","typeLabel":"Purchase order","voucherNo":"PO-2026-0071","party":"Gulf Mills & Edible Commodities Trading LLC","narration":"","amount":1750,"status":"Unpaid","date":"2026-10-03"},{"voucherId":"rv6","voucherType":"sales_order","typeLabel":"Sales invoice","voucherNo":"SO-2026-0095","party":"Noor Al Sham Cash & Carry Wholesale","narration":"","amount":1900,"status":"Paid","date":"2026-10-02"},{"voucherId":"rv7","voucherType":"journal","typeLabel":"Journal","voucherNo":"JV-2026-0019","party":"Month-end accrual: warehouse rent and utilities","narration":"","amount":2050,"status":"Posted","date":"2026-10-01"}],
      counts: { customers: 42, vendors: 18, items: 128 },
    };
  }

  if (p.includes("account-configuration") || p.includes("posting")) {
    const row = (configKey, displayName, accountCategory, targetKind, parentConfigKey = null) => ({ configKey, displayName, accountCategory, targetKind, parentConfigKey, isActive: true, targetGroup: null, targetAccount: null });
    return {
      ledgerPostingEnabled: true,
      accountConfiguration: [
        row("cash-account-group", "Cash accounts", "ASSET", "group"), row("bank-account-group", "Bank accounts", "ASSET", "group"),
        row("share-capital-group", "Share capital & equity", "EQUITY", "none"), row("pdc-receipt", "Cheques in hand (received, not yet cleared)", "ASSET", "account"),
        row("card-charges", "Card processing fees", "EXPENSE", "account"), row("bank-charges", "Bank charges", "EXPENSE", "account"),
        row("bank-interest", "Bank interest income", "INCOME", "account"), row("purchase-group", "Purchase postings", null, "none"),
        row("vat-purchase", "Input VAT", "ASSET", "account", "purchase-group"), row("sales-group", "Sales postings", null, "none"),
        row("vat-sales", "Output VAT", "LIABILITY", "account", "sales-group"),
      ],
    };
  }

  // closing or reopening a MONTH of an open year: what it would do (services/financial/periodCloseService.js; the shape is
  // pinned by MonthClose.test.jsx). February is the latest closed month (reopen), March the next to close.
  if (p.includes("/months/")) {
    const c = (code, level, title, detail = "") => ({ code, level, title, detail });
    const feb = p.endsWith("2026-02");
    const month = feb
      ? { key: "2026-02", label: "February 2026", startDay: "2026-02-01", endDay: "2026-02-28", status: "closed", canClose: false, canReopen: true }
      : { key: "2026-03", label: "March 2026", startDay: "2026-03-01", endDay: "2026-03-31", status: "open", canClose: true, canReopen: false };
    return {
      year: { _id: "fy1", code: "2026", status: "open", startDay: "2026-01-01", endDay: "2026-12-31", lockedThrough: "2026-02-28" },
      month, currency: "AED",
      checks: feb ? [] : [
        c("ALL_BRANCHES", "ok", "Every branch is included"),
        c("EARLIER_MONTHS_CLOSED", "ok", "No earlier month is left open"),
        c("DOCUMENTS_FINISHED", "ok", "Every document dated in March 2026 is approved, rejected or cancelled"),
        c("LEDGER_BALANCED", "ok", "Debits equal credits up to 31 Mar 2026"),
        c("MONTH_NOT_ENDED", "warning", "March 2026 has not ended", "It runs until 31 Mar 2026. Closing now locks the days that are left: nothing dated up to 31 Mar 2026 can be posted until the month is reopened."),
        c("BANK_NOT_RECONCILED", "warning", "2 bank accounts are not reconciled to 31 Mar 2026", "Emirates NBD Current (to 28 Feb 2026); Mashreq Business Account (never reconciled). A bank line dated in a closed month cannot be posted for later."),
        c("STOCK_NOT_RECONCILED", "warning", "Stock differs from the Inventory ledger by AED 1,234.50", "At 31 Mar 2026 the stock is worth AED 98,765.40 and Inventory shows AED 97,530.90. Largest: Journals and other vouchers posted to Inventory (stock 0.00, ledger 1,234.50)."),
      ],
      blockers: [],
      warnings: feb ? [] : [c("MONTH_NOT_ENDED", "warning", "March 2026 has not ended"), c("BANK_NOT_RECONCILED", "warning", "2 bank accounts are not reconciled"), c("STOCK_NOT_RECONCILED", "warning", "Stock differs")],
      canClose: !feb,
      reopen: { canReopen: feb, blockers: [] },
      stock: {
        available: true, reconciles: false, stockValue: 98765.4, ledgerBalance: 97530.9, difference: 1234.5, accountName: "Inventory", basis: "history", exact: false, asOn: "2026-03-31",
        note: "Worked out from the live stock movements dated up to that day, as the books stand now. A document reversed, changed or back-dated since is counted as it is today, not as it was that day, and a quantity written to an item without a movement can only be seen for today.",
        sources: [{ key: "journals", label: "Journals and other vouchers posted to Inventory", stock: 0, ledger: 1234.5, difference: -1234.5 }, { key: "purchases", label: "Purchases", stock: 120000, ledger: 120000, difference: 0.01 }],
      },
    };
  }

  // closing or reopening a fiscal year: what it would do (services/financial/yearEndService.js; the shape is pinned by YearEnd.test.jsx)
  if (p.includes("/year-end")) {
    const c = (code, level, title, detail = "") => ({ code, level, title, detail });
    const closed = p.includes("fy0");
    return {
      year: { _id: closed ? "fy0" : "fy1", code: closed ? "2025" : "2026", status: closed ? "closed" : "open", startDay: closed ? "2025-01-01" : "2026-01-01", endDay: closed ? "2025-12-31" : "2026-12-31" },
      currency: "AED",
      checks: closed ? [] : [
        c("ALL_BRANCHES", "ok", "Every branch is included"),
        c("EARLIER_YEARS_CLOSED", "ok", "No earlier year is left open"),
        c("UNFINISHED_DOCUMENTS", "blocker", "3 documents and 1 voucher dated in 2026 are not approved", "Approve, reject or delete them, or change their date. Once the year is closed they can no longer be approved."),
        c("LEDGER_BALANCED", "ok", "Debits equal credits"),
        c("RETAINED_EARNINGS", "ok", "The profit goes to Retained Earnings"),
        c("YEAR_NOT_ENDED", "warning", "2026 runs until 31 Dec 2026", "Closing now locks the days that are left: nothing dated up to the end of the year can be posted until the year is reopened."),
        c("BANK_NOT_RECONCILED", "warning", "2 bank accounts are not reconciled to 31 Dec 2026", "Emirates NBD Current (to 30 Sep 2026); Mashreq Business Account (never reconciled)"),
        c("STOCK_NOT_RECONCILED", "warning", "Stock differs from the Inventory ledger by AED 1,234.50", "At 31 Dec 2026 the stock is worth AED 98,765.40 and Inventory shows AED 97,530.90."),
        c("NEXT_YEAR_CREATED", "ok", "2027 will be created", "The balances close into it, so posting carries on without a gap."),
      ],
      blockers: closed ? [] : [c("UNFINISHED_DOCUMENTS", "blocker", "3 documents and 1 voucher dated in 2026 are not approved")],
      warnings: closed ? [] : [c("YEAR_NOT_ENDED", "warning", "2026 runs until 31 Dec 2026"), c("BANK_NOT_RECONCILED", "warning", "2 bank accounts are not reconciled"), c("STOCK_NOT_RECONCILED", "warning", "Stock differs from the Inventory ledger")],
      canClose: false,
      reopen: { canReopen: closed, blockers: [] },
      figures: { income: 1234567.5, expenses: 987654.25, profit: 246913.25, accounts: 14, yearIncome: 1134567.5, yearExpenses: 887654.25, yearProfit: 246913.25, broughtForward: 100000, carriedForward: { assets: 5234567.8, liabilities: 1834567.4, equity: 3400000.4, balanced: true } },
      branches: [{ branchId: "main", name: "Head office", profit: 300000 }, { branchId: "shj", name: "Sharjah branch", profit: -53086.75 }],
      retained: { accountName: "Retained Earnings" },
      next: { code: "2027", exists: false, startDay: "2027-01-01", endDay: "2027-12-31" },
      willPost: true,
      stock: closed ? null : { available: true, reconciles: false, stockValue: 98765.4, ledgerBalance: 97530.9, difference: 1234.5, accountName: "Inventory", basis: "today", exact: true, asOn: "2026-12-31", note: "Worked out from every live stock movement up to now, valued at the cost that moved with it. The item records agree with it, so it is exact.", sources: [{ key: "journals", label: "Journals and other vouchers posted to Inventory", stock: 0, ledger: 1234.5, difference: -1234.5 }] },
      closing: closed ? { posted: true, profit: 246913.25, voucherNo: "YEC-2025-0001", retainedAccountName: "Retained Earnings", nextYear: "2026", nextYearCreated: false } : null,
    };
  }
  if (p.includes("fiscal-year")) {
    // the open year's twelve months: January and February closed (February is the one that may be reopened), March next
    const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const lastDay = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const months = names.map((name, i) => {
      const n = String(i + 1).padStart(2, "0");
      const closed = i < 2;
      return { key: `2026-${n}`, label: `${name} 2026`, startDay: `2026-${n}-01`, endDay: `2026-${n}-${lastDay[i]}`, status: closed ? "closed" : "open", closedAt: closed ? "2026-03-03T08:00:00Z" : null, closedBy: closed ? "Mariam Al Hashimi" : null, canClose: i === 2, canReopen: i === 1 };
    });
    return [
      { _id: "fy1", code: "2026", startDate: "2026-01-01", endDate: "2026-12-31", status: "open", lockedThrough: "2026-02-28", months },
      { _id: "fy0", code: "2025", startDate: "2025-01-01", endDate: "2025-12-31", status: "closed", closing: { posted: true, profit: 246913.25, voucherNo: "YEC-2025-0001", retainedAccountName: "Retained Earnings", nextYear: "2026" }, months: [] },
    ];
  }
  if (p.includes("number-series")) return n(account, 3).map((a, i) => ({ _id: `s${i}`, series: "SO", fiscalYear: "2026", scope: "Year 2026", branchId: "main", prefix: "SO", next: 42 + i }));
  // Numbering: how every kind of document is named and numbered, and the register of numbers given out.
  if (p.includes("voucher-types")) {
    const vt = (over) => ({
      key: "SO", name: "Sales invoice", kind: "trade", postsAs: "sales_order", parentKey: null, statutory: true,
      prefix: "SO", suffix: "", separator: "-", includeYear: true, numberLength: 4, resetPolicy: "yearly",
      branchPrefix: "auto", branchPrefixes: [], method: "auto", allowReuse: false, isSystem: true, isActive: true, ...over,
    });
    return {
      types: [
        // The sales invoice allows a typed number here on purpose, so the order form's Auto / Manual
        // switch is drawn and swept. It is `auto` for a real organisation until somebody turns it on.
        vt({ method: "auto_override" }),
        vt({ key: "PO", name: "Purchase invoice", postsAs: "purchase_order", prefix: "PO", statutory: false }),
        vt({ key: "RV", name: "Receipt", kind: "voucher", postsAs: "receipt", prefix: "RV", statutory: false }),
        vt({ key: "JV", name: "Journal", kind: "voucher", postsAs: "journal", prefix: "JV", statutory: false, allowReuse: true }),
        vt({ key: "SA", name: "Stock adjustment", kind: "inventory", postsAs: null, prefix: "SA", statutory: false }),
        vt({ key: "LD", name: "Lead", kind: "crm", postsAs: null, prefix: "LD", statutory: false }),
        vt({ key: "YEC", name: "Year-end closing", kind: "system", postsAs: null, prefix: "YEC", statutory: false }),
      ],
      branches: [{ code: "main", name: "Head office", isHeadOffice: true, isActive: true }, { code: "shj", name: "Sharjah", isActive: true }],
    };
  }
  if (p.includes("number-register/gaps")) {
    return {
      series: "SO", name: "Sales invoice",
      scopes: [{ branchId: "main", label: "2026", scope: "Year 2026", counter: 44, issued: 42, continuous: false, gaps: [{ seq: 41, code: "CANCELLED", reason: "Raised against the wrong customer" }], rows: [] }],
    };
  }
  if (p.includes("number-register")) {
    return {
      rows: [
        { _id: "r1", number: "SO-2026-0041", typeName: "Sales invoice", series: "SO", status: "cancelled", reason: "Raised against the wrong customer", endedAt: "2026-10-20T09:00:00.000Z", endedBy: "Olivia" },
        { _id: "r2", number: "JV-2026-0007", typeName: "Journal", series: "JV", status: "released", reason: "Entered twice", endedAt: "2026-10-21T09:00:00.000Z", endedBy: "Olivia" },
      ],
      total: 2, page: 1, pages: 1, summary: { issued: 42, released: 1, cancelled: 1 },
    };
  }
  if (p.includes("tax-code")) return [{ _id: "t1", name: "Standard 5%", kind: "standard", ratePercent: 5, isActive: true, isDefault: true, rateHistory: [] }, { _id: "t2", name: "Reverse charge 5%", kind: "reverse_charge", ratePercent: 5, isActive: true, isDefault: false, rateHistory: [] }];
  if (p.includes("audit-log")) return { rows: [], pagination: { total: 0, current: 1, pages: 1 } };

  // The audit trail: the whole posting picture behind one document or voucher. Its shape is
  // pinned by src/components/audit/__tests__/AuditTrail.test.jsx.
  if (p.endsWith("/audit")) {
    const entry = (id, code, name, dr, cr) => ({ _id: id, accountCode: code, accountName: name, debit: dr, credit: cr, narration: "" });
    return {
      document: {
        _id: "t1", transactionNo: "SO-2026-0001", type: "sales_order", typeLabel: "Sales order",
        status: "APPROVED", date: "2026-10-04T00:00:00.000Z", totalAmount: 1312.5,
        paidAmount: 312.5, outstandingAmount: 1000, items: 1, isOpening: false,
      },
      voucher: {
        _id: "v1", voucherNo: "RV-2026-0004", voucherType: "receipt", typeLabel: "Receipt",
        date: "2026-10-05T00:00:00.000Z", totalAmount: 312.5, status: "approved",
        paymentMode: "bank", ledgerBased: true, onAccountAmount: 0,
      },
      party: { _id: "c1", type: "Customer", name: "Al Noor Trading" },
      ledger: {
        postingEnabled: true, posted: true, isReversed: false, reversedAt: null, note: null,
        entries: [
          entry("l1", "ARA0001", "Customer - Al Noor Trading", 1312.5, 0),
          entry("l2", "INC0001", "Sales Revenue", 0, 1250),
          entry("l3", "TAXL0001", "Output VAT", 0, 62.5),
        ],
        reversals: [],
        totals: { debit: 1312.5, credit: 1312.5 },
        balanced: true,
      },
      stock: {
        movements: [{
          _id: "m1", itemId: "RICE5", itemName: "Rice 5kg", eventType: "SALES_DISPATCH", quantity: -5,
          previousStock: 100, newStock: 95, unitCost: 9.2, totalValue: 46, cogsAmount: 46,
          costBasis: "sale", batchNumber: "LOT-1", date: "2026-10-04T00:00:00.000Z", isReversed: false,
        }],
      },
      partyBalance: {
        rows: [{ _id: "p1", type: "sales_order", date: "2026-10-04T00:00:00.000Z", invNo: "SO-2026-0001", amount: -1312.5, paid: 0, balance: -1312.5, status: "UNPAID", isReversal: false }],
      },
      settlements: [{ _id: "v1", voucherNo: "RV-2026-0004", voucherType: "receipt", date: "2026-10-05T00:00:00.000Z", paymentMode: "bank", status: "approved", allocatedAmount: 312.5, previousBalance: 1312.5, newBalance: 1000 }],
      allocations: [{ _id: "i1", invoiceId: "i1", typeLabel: "Sales order", outstandingNow: 1000, transactionNo: "SO-2026-0001", date: "2026-10-04T00:00:00.000Z", allocatedAmount: 312.5, previousBalance: 1312.5, newBalance: 1000 }],
      einvoice: null,
      cheque: null,
      activity: [
        { _id: "a1", at: "2026-10-04T06:00:00.000Z", action: "TRANSACTION_CREATED", username: "boss@test.uae", summary: "Sales order SO-2026-0001 - 1312.50 saved as DRAFT", before: null, after: { status: "DRAFT" } },
        { _id: "a2", at: "2026-10-04T06:05:00.000Z", action: "TRANSACTION_APPROVED", username: "boss@test.uae", summary: "Sales order SO-2026-0001 - 1312.50 approved - 3 ledger entries, 1 stock movements, 1 party balance rows", before: null, after: { effects: { ledgerEntries: 3 } } },
      ],
    };
  }

  // ---- reports: each returns its own summary object, so each gets its own shape ----

  const grp = (name) => ({
    _id: `g-${name}`, groupId: `g-${name}`, name, code: "1000", category: "Assets", children: [], ungrouped: [],
    // the general ledger keys its rows by `accountId` / `groupId`, as the server sends them
    accounts: n(account, 3).map((a) => ({ ...a, accountId: a._id, isActive: true, opening: 1000, debit: 500, credit: 200, closing: 1300 })),
    totals: { opening: 3000, debit: 1500, credit: 600, closing: 3900 },
  });

  if (p.includes("/reports/profit-loss")) {
    const group = (id, name, total, code, account) => ({ groupId: id, name, total, accounts: [{ accountId: `${id}a`, accountCode: code, accountName: account, amount: total }] });
    return {
      revenue: {
        groups: [
          group("g1", "Sales Income", 1284000, "SAL0001", "Sales Revenue"),
          { ...group("sales-discounts", "Less: sales discounts and rebates", -12000, "DSC0001", "Sales Discount"), synthetic: true },
        ],
        total: 1272000,
      },
      directCosts: { groups: [group("g2", "Cost of Goods Sold", 820000, "COGS0001", "Cost of Goods Sold")], total: 820000 },
      grossProfit: 452000, grossMargin: 35.5,
      otherIncome: { groups: [], total: 0 },
      operatingExpenses: { groups: [group("g3", "Operating Expenses", 180000, "OPEX0001", "Rent")], total: 180000 },
      netProfit: 272000,
    };
  }
  if (p.includes("/reports/day-book")) {
    return {
      total: 3, page: 1, limit: 50,
      byType: [{ voucherType: "sales_order", label: "Sales invoice", amount: 210, count: 1 }, { voucherType: "receipt", label: "Receipt", amount: 100, count: 1 }],
      rows: n(voucher, 3).map((v, i) => ({ voucherId: `v${i}`, date: "2026-10-04T08:00:00Z", voucherNo: `SO-2026-000${i + 1}`, voucherType: i ? "receipt" : "sales_order", typeLabel: i ? "Receipt" : "Sales invoice", party: "Al Noor Trading", narration: i ? "" : "Month-end accrual", amount: 210 - i * 100, balanced: true, lines: [{ accountId: "a", accountCode: "OPEX0006", accountName: "Rent Expense", debit: 210 - i * 100, credit: 0 }, { accountId: "b", accountCode: "CASH0001", accountName: "Cash in Hand", debit: 0, credit: 210 - i * 100 }] })),
    };
  }
  if (p.includes("/reports/cash-book")) {
    return {
      rows: [
        { accountId: "a1", accountCode: "CASH0001", accountName: "Cash in Hand", kind: "cash", opening: 0, receipts: 5100, payments: 1510, closing: 3590 },
        { accountId: "a2", accountCode: "BANK0002", accountName: "Emirates NBD Current", kind: "bank", opening: 0, receipts: 1000, payments: 0, closing: 1000 },
      ],
      totals: { cash: { opening: 0, receipts: 5100, payments: 1510, closing: 3590 }, bank: { opening: 0, receipts: 1000, payments: 0, closing: 1000 }, all: { opening: 0, receipts: 6100, payments: 1510, closing: 4590 } },
    };
  }
  if (p.includes("/stock-reports/slow-moving")) {
    return {
      days: 90, asOn: "2026-10-04",
      rows: [
        { stockId: "s2", itemId: "OIL", sku: "OIL-1L", itemName: "Sunflower Oil 1L", unit: "ltr", categoryName: "Oils", qty: 45, avgCost: 20.67, value: 930, lastSaleDate: "2026-06-01T08:00:00.000Z", neverSold: false, daysSince: 125 },
        { stockId: "s3", itemId: "SALT", sku: "SALT-1KG", itemName: "Sea Salt 1kg", unit: "kg", categoryName: "Spices", qty: 30, avgCost: 2, value: 60, lastSaleDate: null, neverSold: true, daysSince: 100 },
      ],
      totals: { items: 2, value: 990, neverSold: 1, pctOfStockValue: 43.5, stockValue: 2276.15 },
    };
  }
  if (p.includes("/stock-reports/reorder")) {
    return {
      rows: [
        { stockId: "s1", itemId: "RICE", sku: "RICE-5KG", itemName: "Basmati Rice 5kg", unit: "kg", categoryName: "Grains", qty: 0, reorderLevel: 150, shortfall: 150, avgCost: 11.69, shortfallValue: 1753.85, status: "out", vendorName: "Gulf Mills" },
        { stockId: "s3", itemId: "SALT", sku: "SALT-1KG", itemName: "Sea Salt 1kg", unit: "kg", categoryName: "Spices", qty: 20, reorderLevel: 30, shortfall: 10, avgCost: 2, shortfallValue: 20, status: "below", vendorName: "" },
      ],
      totals: { items: 2, outOfStock: 1, shortfallValue: 1773.85 },
    };
  }
  if (p.includes("/stock-reports/expiry")) {
    const batch = (over) => ({ batchId: "b", batchNumber: "O1", stockId: "s2", itemId: "OIL", sku: "OIL-1L", itemName: "Sunflower Oil 1L", unit: "ltr", categoryName: "Oils", qtyOnHand: 40, expiryDate: "2026-10-29T00:00:00.000Z", daysToExpiry: 25, expired: false, fefoRank: 2, unitCost: 20.67, receiptCost: 20, valueAtCost: 826.67, ...over });
    return {
      withinDays: 30, asOn: "2026-10-04",
      rows: [
        batch({ batchId: "b1", batchNumber: "O-OLD", qtyOnHand: 5, expiryDate: "2026-10-01T00:00:00.000Z", daysToExpiry: -3, expired: true, fefoRank: 1, valueAtCost: 103.33 }),
        batch({ batchId: "b2" }),
        batch({ batchId: "b3", batchNumber: "O2", qtyOnHand: 3, daysToExpiry: 5, fefoRank: 3, valueAtCost: 62 }),
      ],
      totals: { batches: 3, items: 1, qty: 48, value: 992, expired: { batches: 1, qty: 5, value: 103.33 }, expiring: { batches: 2, qty: 43, value: 888.67 } },
    };
  }
  if (p.includes("/reports/cash-flow")) {
    return {
      opening: 120000, totalIn: 640000, totalOut: 520000, net: 120000, closing: 240000, closingPerLedger: 240000, reconciles: true, accounts: 3,
      lines: [
        { voucherType: "receipt", label: "Received from customers", inflow: 640000, outflow: 0, net: 640000, count: 31 },
        { voucherType: "payment", label: "Paid to vendors", inflow: 0, outflow: 520000, net: -520000, count: 24 },
      ],
    };
  }
  // the day book by day, and the day-end cash and bank report (the shapes are pinned by Reports/__tests__/DayReports.test.jsx)
  if (p.includes("/reports/daily-summary")) {
    const types = [["sales_order", "Sales invoice"], ["sales_return", "Sales return"], ["purchase_order", "Purchase invoice"], ["receipt", "Receipt"], ["payment", "Payment"], ["expense", "Expense"], ["journal", "Journal"], ["contra", "Contra"]];
    const day = (d, extra = {}) => ({ day: d, count: 14, unbalanced: 0, byType: Object.fromEntries(types.map(([t], i) => [t, { count: 2 + i, amount: 12345.5 + i * 1111 }])), ...extra });
    return {
      types: types.map(([voucherType, label]) => ({ voucherType, label })),
      days: [day("2026-10-04"), day("2026-10-03", { unbalanced: 1 }), day("2026-10-02"), day("2026-10-01")],
      totals: { count: 56, unbalanced: 1, byType: Object.fromEntries(types.map(([t], i) => [t, { count: 8 + i * 4, amount: 49382 + i * 4444 }])) },
    };
  }
  if (p.includes("/reports/day-end/register")) {
    const d = (day, c) => ({ day, cash: { in: 5200.5, out: 3100, closing: 120000 + c }, bank: { in: 40000, out: 12500.75, closing: 310000 + c }, closing: 430000 + 2 * c });
    return {
      from: "2026-09-21", to: "2026-10-04", opening: { cash: 118000, bank: 290000, all: 408000 },
      days: [d("2026-10-01", 0), d("2026-10-02", 2100), d("2026-10-03", 4200), d("2026-10-04", 6300)],
      closing: { cash: 126300, bank: 316300, all: 442600 },
    };
  }
  if (p.includes("/reports/day-end")) {
    const acct = (id, code, name, kind, o, r, pay) => ({ accountId: id, accountCode: code, accountName: name, kind, opening: o, receipts: r, payments: pay, closing: o + r - pay, vouchers: 6 });
    const accounts = [acct("a1", "CASH0001", "Cash in Hand", "cash", 120000, 5200.5, 3100), acct("a2", "CASH0002", "Petty Cash", "cash", 2500, 0, 450), acct("a3", "BANK0001", "Emirates NBD Current Account", "bank", 290000, 40000, 12500.75)];
    const sum = (list) => list.reduce((t, a) => ({ opening: t.opening + a.opening, receipts: t.receipts + a.receipts, payments: t.payments + a.payments, closing: t.closing + a.closing }), { opening: 0, receipts: 0, payments: 0, closing: 0 });
    return {
      date: "2026-10-04", accounts,
      totals: { cash: sum(accounts.slice(0, 2)), bank: sum(accounts.slice(2)), all: sum(accounts) },
      sources: [
        { voucherType: "receipt", label: "Received from customers", inflow: 35200.5, outflow: 0, net: 35200.5, count: 9 },
        { voucherType: "sales_order", label: "Sales settled at once", inflow: 10000, outflow: 0, net: 10000, count: 3 },
        { voucherType: "payment", label: "Paid to vendors", inflow: 0, outflow: 14050.75, net: -14050.75, count: 4 },
        { voucherType: "expense", label: "Expenses paid", inflow: 0, outflow: 1500, net: -1500, count: 2 },
      ],
      moneyIn: 45200.5, moneyOut: 15550.75, movedBetweenAccounts: 2000, hadActivity: true, closingPerLedger: 442600, reconciles: true,
    };
  }
  // trade reports: sales / purchases by party, item, party and item, month; the line register; receivables movement
  if (p.includes("/trade-reports/summary")) {
    const by = (new URL(p, "http://x").searchParams.get("groupBy")) || "party";
    const mo = (net) => ({ "2026-09": { quantity: 20, net: net * 0.4 }, "2026-10": { quantity: 30, net: net * 0.6 } });
    const row = (k, over) => ({ key: k, documents: 3, quantity: 50, soldQty: 56, returnedQty: 6, gross: 6500, returns: 500, net: 6000, vat: 300, total: 6300, avgPrice: 120, sharePct: 60, firstDate: "2026-09-02T00:00:00.000Z", lastDate: "2026-10-04T00:00:00.000Z", monthly: mo(6000), ...over });
    const party = { partyId: "p1", partyName: "Al Noor Trading Company LLC", partyCode: "CUST2026001", vatStatus: "registered", trn: "100123456700003" };
    const item = { itemId: "i1", itemName: "Basmati rice 5kg, long grain, premium export pack", itemCode: "RICE-5KG", category: "Grains" };
    const rows = by === "item" ? [row("i1", { ...item, parties: 3 })] : by === "party_item" ? [row("p1|i1", { ...party, ...item })] : by === "month" ? [row("2026-10", { month: "2026-10" })] : [row("p1", { ...party, items: 4 })];
    return { direction: "sales", groupBy: by, from: "2026-09-01", to: "2026-10-04", months: ["2026-09", "2026-10"], monthly: true, partyLabel: "Customer", rows, totals: { quantity: 50, gross: 6500, returns: 500, net: 6000, vat: 300, total: 6300, documents: 3, parties: 1, items: 1 }, truncated: false };
  }
  if (p.includes("/trade-reports/register")) {
    return {
      direction: "sales", from: "2026-09-01", to: "2026-10-04", partyLabel: "Customer",
      rows: [{ date: "2026-10-04T00:00:00.000Z", documentNo: "SO-2026-0041", kind: "invoice", reference: "LPO-7", partyId: "p1", partyName: "Al Noor Trading Company LLC", itemId: "i1", itemName: "Basmati rice 5kg, long grain, premium export pack", itemCode: "RICE-5KG", category: "Grains", quantity: 24, price: 120, net: 2880, vat: 144, total: 3024 }],
      totals: { lines: 1, quantity: 24, net: 2880, vat: 144, total: 3024 }, pagination: { page: 1, pages: 1, limit: 100, total: 1 }, truncated: false,
    };
  }
  if (p.includes("/trade-reports/party-movement")) {
    return {
      type: "customer", from: "2026-09-01", to: "2026-10-04",
      rows: [{ partyId: "p1", partyName: "Al Noor Trading Company LLC", partyCode: "CUST2026001", vatStatus: "registered", trn: "100123456700003", paymentTerms: "Net 30", opening: 1000, invoiced: 6300, returns: 525, settled: 2000, other: 0, closing: 4775, overdue: 900 }],
      totals: { opening: 1000, invoiced: 6300, returns: 525, settled: 2000, other: 0, closing: 4775, overdue: 900, parties: 1 },
    };
  }
  if (p.includes("/stock-reports/sales-analysis")) {
    return {
      from: "2026-10-01", to: "2026-10-04", groupBy: "item", direction: "sales",
      rows: [
        { key: "RICE", name: "Basmati Rice 5kg", code: "RICE-5KG", quantity: 70, soldQty: 80, returnedQty: 10, revenue: 1460, returns: 180, netRevenue: 1280, cogs: 833.85, grossProfit: 446.15, marginPct: 34.9, sharePct: 81, documents: 3 },
        { key: "OIL", name: "Sunflower Oil 1L", code: "OIL-1L", quantity: 10, soldQty: 10, returnedQty: 0, revenue: 300, returns: 0, netRevenue: 300, cogs: 200, grossProfit: 100, marginPct: 33.3, sharePct: 19, documents: 1 },
      ],
      totals: { quantity: 80, revenue: 1760, returns: 180, netRevenue: 1580, cogs: 1033.85, grossProfit: 546.15, marginPct: 34.6, documents: 3 },
    };
  }
  if (p.includes("/stock-reports/movement")) {
    const mv = (qty, value) => ({ qty, value });
    const row = (id, name, cat, o, pur, sal, c) => ({ stockId: id, itemId: id.toUpperCase(), sku: `${id}-SKU`, itemName: name, categoryName: cat, opening: mv(o, o * 12), purchases: mv(pur, pur * 12), salesReturns: mv(0, 0), purchaseReturns: mv(0, 0), sales: mv(sal, sal * 12), writeOffs: mv(0, 0), adjustments: mv(0, 0), closing: mv(c, c * 12) });
    return {
      from: "2026-10-01", to: "2026-10-04",
      rows: [row("s1", "Basmati Rice 5kg", "Grains", 200, 0, 60, 140), row("s2", "Sunflower Oil 1L", "Oils", 50, 20, 10, 60)],
      totals: { opening: mv(250, 3000), purchases: mv(20, 240), salesReturns: mv(0, 0), purchaseReturns: mv(0, 0), sales: mv(70, 840), writeOffs: mv(0, 0), adjustments: mv(0, 0), closing: mv(200, 2400) },
      reconciliation: { available: true, stockValue: 2400, ledgerBalance: 2400, difference: 0, reconciles: true, account: { name: "Inventory Stock" } },
    };
  }
  // The Statements screen: trial balance, profit and loss, cash flow, balance sheet. They share one
  // endpoint and are told apart by reportType. Without these the page drew nothing and the sweep
  // happily called it ok - the blank-page trap the header comment above warns about.
  if (p.includes("/vouchers/reports/financial")) {
    const acc = (id, code, name, category, group, path, dr, cr, closeDr, closeCr) => ({
      _id: id, accountCode: code, accountName: name, accountType: category.toLowerCase(), category,
      groupName: group, groupId: `g-${group}`, groupPath: path,
      openingBalance: 0, totalDebits: dr, totalCredits: cr, balance: closeDr - closeCr,
      closingDebit: closeDr, closingCredit: closeCr,
    });
    // Deliberately lopsided: three customers of which two have settled in full, so the group view,
    // the group filter and the "with a closing balance" rule all have something to bite on.
    const rows = [
      acc("t3", "AR0001", "Customer - Al Madina Fresh Supermarket LLC", "ASSET", "Accounts Receivable", ["Current Assets", "Accounts Receivable"], 197689, 0, 197689, 0),
      acc("t4", "AR0004", "Customer - Spice Garden Restaurant LLC", "ASSET", "Accounts Receivable", ["Current Assets", "Accounts Receivable"], 74706, 74706, 0, 0),
      acc("t5", "AR0009", "Customer - Bright Star Wholesale LLC", "ASSET", "Accounts Receivable", ["Current Assets", "Accounts Receivable"], 41860, 41860, 0, 0),
      acc("t6", "INV0001", "Inventory Stock", "ASSET", "Inventory", ["Current Assets", "Inventory"], 353064, 0, 353064, 0),
      acc("t1", "CASH0001", "Cash in Hand", "ASSET", "Cash", ["Current Assets", "Cash"], 96792, 0, 96792, 0),
      acc("t2", "BANK0002", "Emirates NBD - Current Account", "ASSET", "Bank", ["Current Assets", "Bank"], 434644, 0, 434644, 0),
      acc("t7", "FA0002", "Vehicles", "ASSET", "Fixed Assets", ["Fixed Assets"], 168000, 0, 168000, 0),
      acc("t8", "AP0001", "Vendor - Gulf Grain Importers LLC", "LIABILITY", "Accounts Payable", ["Current Liabilities", "Accounts Payable"], 0, 268325, 0, 268325),
      acc("t9", "LTL0001", "Bank Loan", "LIABILITY", "Long-term Liabilities", ["Long-term Liabilities"], 0, 132432, 0, 132432),
      acc("t10", "EQ0001", "Owner's Capital", "EQUITY", "Equity", ["Equity"], 0, 904100, 0, 904100),
      acc("t11", "EQ0004", "Owner's Drawings", "EQUITY", "Equity", ["Equity"], 90000, 0, 90000, 0),
      acc("t12", "SAL0001", "Sales Revenue", "INCOME", "Sales Income", ["Sales Income"], 0, 820000, 0, 820000),
      acc("t13", "COGS0001", "Cost of Goods Sold", "EXPENSE", "Cost of Goods Sold", ["Cost of Goods Sold"], 612000, 0, 612000, 0),
      acc("t14", "OE0004", "Rent Expense", "EXPENSE", "Operating Expenses", ["Operating Expenses"], 144000, 0, 144000, 0),
      acc("t15", "OE0009", "Utilities", "EXPENSE", "Operating Expenses", ["Operating Expenses"], 28668, 0, 28668, 0),
    ];
    const add = (k) => rows.reduce((t, r) => t + r[k], 0);
    if (q.get("reportType") === "trial_balance") {
      return { report: { trialBalance: rows, summary: { totalDebits: add("totalDebits"), totalCredits: add("totalCredits"), closingDebit: add("closingDebit"), closingCredit: add("closingCredit"), isBalanced: add("closingDebit") === add("closingCredit") } } };
    }
    if (q.get("reportType") === "balance_sheet") {
      const flat = (cat) => rows.filter((r) => r.category === cat).map((r) => ({ _id: r._id, accountCode: r.accountCode, accountName: r.accountName, groupName: r.groupName, amount: r.category === "ASSET" ? r.closingDebit : r.closingCredit - r.closingDebit, nonCurrent: r.groupPath[0] === "Fixed Assets" || r.groupPath[0] === "Long-term Liabilities" }));
      const assets = flat("ASSET"); const liabilities = flat("LIABILITY"); const equity = flat("EQUITY");
      const sum = (l) => l.reduce((t, a) => t + a.amount, 0);
      const profit = 820000 - 612000 - 144000 - 28668;
      const sec = (label, list) => ({ label, groups: [...new Set(list.map((a) => a.groupName))].map((name) => ({ name, accounts: list.filter((a) => a.groupName === name), amount: sum(list.filter((a) => a.groupName === name)), comparative: null })), amount: sum(list), comparative: null });
      const side = (word, list) => ({ nonCurrent: sec(`Non-current ${word}`, list.filter((a) => a.nonCurrent)), current: sec(`Current ${word}`, list.filter((a) => !a.nonCurrent)), amount: sum(list), comparative: null });
      const equitySection = sec("Equity", equity);
      equitySection.groups.push({ name: "Profit for the period", synthetic: true, accounts: [], amount: profit, comparative: null });
      equitySection.amount = sum(equity) + profit;
      return { report: {
        asOf: null, assets, liabilities, equity, profitToDate: profit, profitBroughtForward: 0, profitForPeriod: profit,
        totalAssets: sum(assets), totalLiabilities: sum(liabilities), totalEquity: sum(equity) + profit,
        totalLiabilitiesAndEquity: sum(liabilities) + sum(equity) + profit,
        isBalanced: Math.abs(sum(assets) - (sum(liabilities) + sum(equity) + profit)) < 0.01,
        sections: { assets: side("assets", assets), liabilities: side("liabilities", liabilities), equity: equitySection, equityAndLiabilities: { amount: sum(liabilities) + sum(equity) + profit, comparative: null } },
        comparative: null,
      } };
    }
    return { report: {} };
  }

  if (p.includes("/accounting/reports/profit-loss")) {
    const g = (name, accounts) => ({ groupId: `g-${name}`, name, accounts });
    const a = (code, name, amount) => ({ accountId: code, accountCode: code, accountName: name, amount });
    const section = (groups) => ({ groups, total: groups.flatMap((x) => x.accounts).reduce((t, x) => t + x.amount, 0) });
    const revenue = section([g("Sales Income", [a("SAL0001", "Sales Revenue", 820000)])]);
    const direct = section([g("Cost of Goods Sold", [a("COGS0001", "Cost of Goods Sold", 612000)])]);
    const other = section([g("Other Income", [a("OI0001", "Other Income", 4200)])]);
    const operating = section([g("Operating Expenses", [a("OE0004", "Rent Expense", 144000), a("OE0009", "Utilities", 28668)])]);
    const gross = revenue.total - direct.total;
    return { revenue, directCosts: direct, otherIncome: other, operatingExpenses: operating, grossProfit: gross, grossMargin: (gross / revenue.total) * 100, netProfit: gross + other.total - operating.total };
  }

  if (p.includes("/accounting/settings")) {
    return { creditControl: { mode: "warn", overdueBlockDays: 30 }, returnWindowDays: 14, requireReturnLink: false, approvals: { separateApprover: false, secondApprovalAbove: null }, profile: { legalName: "Harbour Trading LLC", trn: "100123456700003" } };
  }
  if (p.includes("general-ledger")) {
    return {
      groups: [grp("Current assets"), grp("Revenue")],
      totals: { opening: 6000, debit: 3000, credit: 1200, closing: 7800 },
      rows: [], entries: [],
    };
  }

  if (p.includes("party-balances")) {
    return {
      // one party holds an advance, so the On account column is drawn
      rows: n(party).map((x, i) => ({ ...x, onAccount: i === 0 ? 12000 : 0 })), parties: n(party),
      totals: { owed: 342000, overdue: 48000, count: 6, advance: 12000, advances: 4500, onAccount: 12000 },
    };
  }

  if (p.includes("ageing")) {
    // the server's bucket keys (ageingService.js): the screen tones the older buckets by them, and keys that match nothing
    // would leave that styling unexercised
    const buckets = [
      { key: "current", label: "Current" }, { key: "d1_30", label: "1-30 days" },
      { key: "d31_60", label: "31-60 days" }, { key: "d61_90", label: "61-90 days" }, { key: "d90plus", label: "Over 90 days" },
    ];
    const amounts = { current: 1000, d1_30: 2000, d31_60: 500, d61_90: 0, d90plus: 250 };
    return {
      buckets,
      rows: n(party).map((x) => ({ ...x, partyId: x._id, buckets: amounts, total: 3750, paymentTerms: "30 days", invoices: [] })),
      totals: { current: 6000, d1_30: 12000, d31_60: 3000, d61_90: 0, d90plus: 1500, total: 22500 },
      reconciliation: { ledger: 21300, ageing: 22500, unapplied: -1200 },
    };
  }

  if (p.includes("opening-balances")) {
    return {
      goLive: "2026-01-01", postedAt: null, equity: { id: "obe", accountName: "Opening Balance Equity" },
      sections: {
        accounts: { rows: 4, vouchers: 1, debit: 120000, credit: 120000, difference: 0 },
        customers: { rows: 6, parties: 4, total: 84000, outstanding: 84000 },
        vendors: { rows: 3, parties: 2, total: 42000, outstanding: 42000 },
        stock: { rows: 12, items: 12, vouchers: 1, value: 196000 },
      },
      trialBalance: { debit: 120000, credit: 120000, entries: 4, balanced: true, equity: { accountName: "Opening Balance Equity", openingBalance: 0, balance: 0 } },
      stockReconciliation: { available: true, stockValue: 196000, ledgerBalance: 196000, difference: 0, reconciles: true, account: { name: "Inventory Stock" } },
      warnings: [], missing: [],
    };
  }

  if (p.includes("vat-return") || p.includes("/vat")) {
    if (p.endsWith("/returns")) return [];
    if (p.endsWith("/detail")) {
      const doc = (i, direction, kinds, taxable, vat) => ({ source: "invoice", docId: `v${i}`, date: "2026-09-0" + i, docNo: `SO-2026-000${i}`, direction, partyName: `Al Noor Trading ${i}`, trn: "100123456700003", kinds, taxable, vat });
      return { total: 3, totals: { taxable: 21000, vat: 1000 }, rows: [doc(1, "output", ["standard"], 10000, 500), doc(2, "output", ["standard", "zero_rated"], 8000, 400), doc(3, "input", ["standard"], 3000, 100)] };
    }
    const box = (id, label, amount = 0, vat = 0) => ({ box: id, label, amount, vat });
    return {
      from: "2026-07-01", to: "2026-09-30", emirate: "Dubai", emirateAssumed: true, currency: "AED",
      boxes: [
        box("1a", "Standard-rated supplies in Abu Dhabi"), box("1b", "Standard-rated supplies in Dubai", 480000, 24000), box("1c", "Standard-rated supplies in Sharjah"),
        box("1d", "Standard-rated supplies in Ajman"), box("1e", "Standard-rated supplies in Umm Al Quwain"), box("1f", "Standard-rated supplies in Ras Al Khaimah"),
        box("1g", "Standard-rated supplies in Fujairah"), box("3", "Supplies subject to the reverse charge", 40000, 2000), box("4", "Zero-rated supplies", 12000),
        box("5", "Exempt supplies", 8000), box("8", "Total supplies", 540000, 26000), box("9", "Standard-rated expenses", 180000, 9000),
        box("10", "Expenses subject to the reverse charge", 40000, 2000), box("11", "Total expenses", 220000, 11000), box("12", "Total VAT due", 0, 26000),
        box("13", "Recoverable input VAT", 0, 11000), box("14", "Net VAT payable", 0, 15000),
      ],
      totals: { outputVat: 26000, recoverableVat: 11000, netPayable: 15000 },
      unclassified: { count: 0, amount: 0, vat: 0, lines: [] },
      notReported: { count: 1, amount: 3000 },
      customerAccounts: { count: 1, amount: 3000 },
      notTracked: [{ box: "2", label: "Tax refunds provided to tourists" }, { box: "6", label: "Goods imported into the UAE" }, { box: "7", label: "Import adjustments" }],
      reconciliation: { rows: [{ label: "Output VAT", documents: 24000, ledger: 24000, difference: 0, agrees: true }, { label: "Input VAT", documents: 11000, ledger: 10995, difference: 5, agrees: false }, { label: "Reverse-charge VAT (self-assessed)", documents: 2000, ledger: 2000, difference: 0, agrees: true }] },
    };
  }

  // The item list, and the postable accounts a service may name (the item form's two pickers)
  if (p.endsWith("/stock/stock")) return { stocks: [...n(stockItem, 4), serviceItem] };
  if (p.endsWith("/accounts/postable")) {
    return [
      { _id: "a1", accountCode: "4100", accountName: "Consulting income", category: "INCOME", groupName: "Sales Income", path: "Sales Income" },
      { _id: "a2", accountCode: "5200", accountName: "Subcontractors", category: "EXPENSE", groupName: "Operating Expenses", path: "Operating Expenses" },
    ];
  }

  if (p.includes("valuation") || p.includes("stock-report")) {
    // a valuation row is keyed by its stock id (StockReports.jsx `rowKey`)
    const valued = n(batch).map((b) => ({ ...b, stockId: b._id, itemId: b.itemCode }));
    return {
      rows: valued, items: valued, negativeItems: [], expiring: n(batch, 2), slowMoving: [],
      totals: { quantity: 1200, value: 196000, cost: 180000, margin: 8.9 },
    };
  }

  if (p.includes("lookups")) return { items: n(batch), categories: [], warehouses: [], units: [] };

  if (p.includes("/ifrs/")) {
    if (p.endsWith("/financial-position")) return POSITION;
    if (p.endsWith("/profit-or-loss")) return PROFIT;
    if (p.endsWith("/changes-in-equity")) return EQUITY;
    if (p.endsWith("/cash-flows")) return CASH;
    if (p.endsWith("/notes")) return NOTES;
    return {};
  }

  if (p.includes("document-expiry") || p.includes("kyc")) {
    return {
      rows: n(party).map((x, i) => ({
        partyId: x._id, documentId: `d${i}`, partyName: x.name, partyCode: x.code,
        partyType: i % 2 ? "customer" : "vendor", documentType: "Trade licence",
        number: `TL-9900${i}`, expiryDate: "2026-11-1" + (i % 9), daysLeft: 12 + i, status: i % 3 === 0 ? "EXPIRED" : "EXPIRING",
      })),
      summary: { expired: 2, expiring: 4, total: 6 },
    };
  }

  if (p.includes("dashboard-summary") || p.includes("/analytics")) {
    return {
      headline: { revenue: 1284000, margin: 18.4, orders: 142, receivable: 342000, payable: 128000 },
      series: [], top: n(party, 4).map((x) => ({ ...x, value: 42000 })),
      lowStock: n(batch, 3), recent: n(doc, 5), alerts: [], byMonth: [], byCategory: [],
      totals: { sales: 1284000, purchases: 840000, cash: 220000, stock: 196000 },
    };
  }

  // Everything else is a list, and a list comes back as an array.
  if (p.includes("voucher")) return n(voucher);
  if (p.includes("transaction") || p.includes("order")) return n(doc);
  if (p.includes("customer") || p.includes("vendor") || p.includes("part")) return n(party);
  if (p.includes("batch")) return n(batch);
  if (p.includes("bank") || p.includes("card")) return p.includes("card") ? n(bank) : n(bank);
  if (p.includes("account") || p.includes("ledger")) return n(account);
  if (p.includes("stock") || p.includes("item") || p.includes("inventor")) return n(batch);
  if (p.includes("currenc")) return [];
  void page;
  return [];
}

const api = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${API_PORT}`);
  // The app sends credentials, and a wildcard origin is refused for those - echo the caller.
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  // SHOT_HOLD=<regex> leaves the matching reads unanswered, so a run captures the LOADING state a
  // person sees on a slow line instead of the instant one a stub gives. Off unless it is set.
  if (process.env.SHOT_HOLD && new RegExp(process.env.SHOT_HOLD).test(url.pathname)) return;
  res.setHeader("Content-Type", "application/json");
  const data = stubFor(url.pathname, url.search);
  res.end(
    JSON.stringify({
      success: true,
      data,
      // vouchers.list reads these as siblings of data, not inside it
      pagination: { total: Array.isArray(data) ? data.length : 6, current: 1, pages: 1, limit: 25 },
      results: Array.isArray(data) ? data.length : 1,
      message: "ok",
    })
  );
});

// ---------------------------------------------------------------- run

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await wait(500);
  }
  return false;
}

const only = process.argv.slice(2).filter((a) => a.startsWith("/"));
const pages = only.length ? only.map((p) => [p.replace(/\W+/g, "-").replace(/^-|-$/g, "") || "root", p]) : PAGES;

mkdirSync(OUT, { recursive: true });
api.listen(API_PORT);

const vite = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "--port", String(WEB_PORT), "--strictPort"],
  { cwd: ROOT, env: { ...process.env, VITE_API_URL: `http://localhost:${API_PORT}/api/v1` }, stdio: "ignore", shell: process.platform === "win32" }
);

const stop = async (code) => {
  // On Windows Vite is started through npx and cmd, and killing the first of them leaves the server
  // itself running (port 5177 stayed taken after every run), so the whole tree goes. It is waited for:
  // this process exits straight afterwards, and a kill that has not run yet is a kill that never runs.
  try {
    if (process.platform === "win32" && vite.pid) spawnSync("taskkill", ["/pid", String(vite.pid), "/T", "/F"], { stdio: "ignore" });
    else vite.kill();
  } catch { /* already gone */ }
  api.close();
  process.exit(code);
};

if (!(await waitForServer(`http://localhost:${WEB_PORT}/`))) {
  console.error("vite did not start");
  await stop(1);
}

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const results = [];

for (const vp of VIEWPORTS) {
  if (process.env.SHOT_VIEWPORT && process.env.SHOT_VIEWPORT !== vp.name) continue;
  const page = await browser.newPage();
  await page.setViewport(vp);

  // The token itself lives in memory and comes from /refresh-token (stubbed above); these
  // keys are the previous scheme and are harmless, kept only for anything still reading them.
  await page.evaluateOnNewDocument(() => {
    sessionStorage.setItem("accessToken", "stub");
    sessionStorage.setItem("refreshToken", "stub");
    sessionStorage.setItem("role", "Admin");
    sessionStorage.setItem("user", JSON.stringify({ name: "Super Admin", email: "admin@test.uae", role: "Admin" }));
    // the developer console keeps its own sign-in (see src/platform/platformSession.js)
    sessionStorage.setItem("zarvia.console", JSON.stringify({ token: "stub-console-token", user: { email: "dev@zarvia.test", name: "Dev One" } }));
  });

  // A blank screenshot is almost always a thrown render, so the console is part of the check.
  const problems = [];
  const firstLine = (text) => String(text).split(/\r?\n/)[0].slice(0, 300);
  page.on("pageerror", (err) => problems.push(`pageerror: ${firstLine(err.message)}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console: ${firstLine(msg.text())}`);
  });
  page.on("response", (res) => {
    if (res.url().includes("/api/") && res.status() >= 400) {
      problems.push(`api ${res.status()} ${new URL(res.url()).pathname}`);
    }
  });
  page.on("requestfailed", (req) => {
    if (req.url().includes("/api/")) problems.push(`api failed ${new URL(req.url()).pathname}: ${req.failure()?.errorText}`);
  });
  // A screen with unsaved work asks "Leave site?" when the page is navigated away (the CRM setup does, on purpose), and
  // that native prompt BLOCKS the navigation until somebody answers it - the sweep reloads the page after every deep
  // step, so without an answer it waits out its 30 seconds and reports a failure that is really the app working.
  // Accepting is what a person clicking "Leave" does. The prompt is NOT hidden from the run: it is written down, so a
  // screen that starts asking it where it should not can still be noticed.
  page.on("dialog", (dialog) => {
    if (dialog.type() === "beforeunload") problems.push("asked 'Leave site?' (unsaved work)");
    dialog.accept().catch(() => {});
  });

  for (const [name, path] of pages) {
    const file = join(OUT, `${name}-${vp.name}.png`);
    problems.length = 0;
    try {
      await page.goto(`http://localhost:${WEB_PORT}${path}`, { waitUntil: "networkidle2", timeout: 30000 });
      await wait(900); // let charts and async loaders settle
      // Anything wider than the window is the defect this harness is really looking for.
      const overflow = await page.evaluate(() => {
        // The app is a fixed-height shell with its own scrolling pane, so the symptom a person
        // sees is <main> scrolling sideways - the document never scrolls at all.
        const pane = document.querySelector("main") || document.documentElement;
        // 4px of tolerance: sub-pixel rounding on borders and scrollbar gutters shows up as
        // one or two pixels of "overflow" that nothing on the page actually causes.
        const paneBleeds = pane.scrollWidth > pane.clientWidth + 4;
        const docWidth = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll("body *")]
          .filter((el) => el.getBoundingClientRect().width > docWidth + 1)
          .filter((el) => {
            const s = getComputedStyle(el);
            // a pane that scrolls sideways on purpose is not an overflow
            return s.overflowX !== "auto" && s.overflowX !== "scroll" && s.position !== "fixed";
          })
          // Report it even inside a scroll pane: if the document itself scrolls, the pane is
          // not actually clipping and the element is the reason why.
          .slice(0, 5)
          .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ").slice(0, 3).join(".")} ${Math.round(el.getBoundingClientRect().width)}px`);
        // When the pane scrolls sideways, say WHICH element first crosses its right edge: the outermost one
        // whose parent still fits. A wide table inside its own scroller is not the culprit, and naming it
        // sent a search the wrong way.
        if (paneBleeds) {
          const edge = pane.getBoundingClientRect().right + 4;
          const crossing = [...pane.querySelectorAll("*")]
            .filter((el) => el.getBoundingClientRect().right > edge && el.getBoundingClientRect().width > 0)
            .filter((el) => !el.parentElement || el.parentElement === pane || el.parentElement.getBoundingClientRect().right <= edge)
            .slice(0, 3)
            .map((el) => `crossing ${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ").slice(0, 4).join(".")} right=${Math.round(el.getBoundingClientRect().right)} (pane ${Math.round(edge - 4)})`);
          wide.push(...crossing);
        }
        // ---- defects a page can have without the pane overflowing at all ----

        const visible = (el) => {
          const r = el.getBoundingClientRect();
          const st = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none" && st.opacity !== "0";
        };

        // Text cut off inside its own box. A deliberate truncation sets text-overflow: ellipsis
        // (Tailwind's `truncate`), so only the rest is a defect - that is how "AED 1,250.00"
        // was being sliced in half while the page itself fitted.
        const clipped = [...document.querySelectorAll("main *")]
          .filter((el) => !el.children.length && el.textContent.trim())
          .filter(visible)
          .filter((el) => {
            const st = getComputedStyle(el);
            // sr-only is a 1px clipped box on purpose - that is the whole technique
            if (el.clientWidth <= 4 || el.clientHeight <= 4) return false;
            if (st.textOverflow === "ellipsis") return false;
            if (st.overflowX === "auto" || st.overflowX === "scroll") return false;
            if (st.overflowX === "visible") return false;
            return el.scrollWidth > el.clientWidth + 2;
          })
          .slice(0, 5)
          .map((el) => `"${el.textContent.trim().slice(0, 28)}" ${el.scrollWidth}>${el.clientWidth}`);

        // Anything you tap should be about a finger wide. 40px is the lenient floor; the
        // guideline is 44.
        const SMALL = 40;
        const tiny = [...document.querySelectorAll("main a[href], main button, main [role='button'], main input[type='checkbox'], main input[type='radio']")]
          .filter(visible)
          .filter((el) => {
            const r = el.getBoundingClientRect();
            // sr-only again, and a link inside a sentence is text, not a button
            if (r.width <= 4 || r.height <= 4) return false;
            if (el.tagName === "A" && el.parentElement && getComputedStyle(el).display === "inline") return false;
            return r.width < SMALL || r.height < SMALL;
          })
          .slice(0, 5)
          .map((el) => {
            const r = el.getBoundingClientRect();
            const what = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent.trim() || el.tagName).slice(0, 22);
            const cls = (el.className || "").toString().split(" ").filter(Boolean).slice(0, 3).join(".");
            return `${what}[${cls}] ${Math.round(r.width)}x${Math.round(r.height)}`;
          });

        return {
          docWidth, paneBleeds, paneWidth: pane.clientWidth, paneScroll: pane.scrollWidth,
          scrollWidth: document.documentElement.scrollWidth, wide, clipped, tiny,
        };
      });
      const cutOff = [...(await page.evaluate(findCutOff, "main")), ...(await page.evaluate(findGhostScroll, "main"))];
      // The shell is a fixed frame and only <main> scrolls. When the DOCUMENT can scroll as well, a person who reaches the end
      // of a long list and keeps going (scroll chaining) slides the whole shell up: the bottom bar floats mid-window over an
      // empty grey block. The usual cause is an absolutely positioned element deep in the page whose containing block is the
      // window, not the shell, so the shell's overflow-hidden does not clip it and it makes the document taller.
      const docScroll = await page.evaluate(() => {
        // Only the app shell is a fixed frame. The sign-in page, the developer console and the customer's document page are
        // ordinary pages that are meant to scroll as a whole.
        const bar = document.querySelector("nav[aria-label='Modules']");
        if (!bar) return [];
        const root = document.scrollingElement || document.documentElement;
        const spare = root.scrollHeight - window.innerHeight;
        window.scrollTo(0, 1e6);
        const moved = Math.round(window.scrollY);
        const barBottom = Math.round(bar.getBoundingClientRect().bottom);
        window.scrollTo(0, 0);
        if (spare <= 1 && moved === 0) return [];
        const culprits = [...document.querySelectorAll("body *")]
          .filter((n) => getComputedStyle(n).position === "absolute" && (!n.offsetParent || n.offsetParent === document.body))
          .filter((n) => n.getBoundingClientRect().bottom + window.scrollY > window.innerHeight + 1)
          .slice(0, 4)
          .map((n) => `${n.tagName.toLowerCase()}.${(n.className || "").toString().split(" ").slice(0, 3).join(".")} bottom=${Math.round(n.getBoundingClientRect().bottom + window.scrollY)}`);
        return [`the document scrolls ${Math.max(spare, moved)}px past the window${barBottom < window.innerHeight - 1 ? ` (bottom bar ends at ${barBottom} of ${window.innerHeight})` : ""}`, ...culprits];
      });
      await page.screenshot({ path: file, fullPage: false });
      const bleeds = overflow.paneBleeds;
      // An empty <main> means the page rendered nothing at all.
      const blank = await page.evaluate(() => {
        const main = document.querySelector("main") || document.getElementById("root");
        return (main?.innerText || "").trim().length < 10;
      });
      // The sign-in page fits a phone perfectly, so a session that drops lands every route on
      // it and the whole run reads "ok" while measuring nothing. Treat that as a failure.
      const landed = await page.evaluate(() => window.location.pathname);
      if (path !== "/" && landed === "/") {
        results.push({ page: name, vp: vp.name, redirected: true });
        console.log(`LOGIN  ${vp.name.padEnd(8)} ${name.padEnd(18)} asked for ${path}, got the sign-in page`);
        continue;
      }
      const errs = [...new Set(problems)];
      results.push({
        page: name, vp: vp.name, bleeds, blank, widest: overflow.wide,
        clipped: overflow.clipped, cutOff, docScroll, tiny: overflow.tiny, errors: errs,
      });
      const flag = blank ? "BLANK " : bleeds ? "BLEEDS" : docScroll.length ? "DOCSCR" : cutOff.length ? "CUT   " : overflow.clipped.length ? "CLIP  " : "ok    ";
      console.log(`${flag} ${vp.name.padEnd(8)} ${name.padEnd(18)} ${bleeds ? `pane ${overflow.paneScroll} > ${overflow.paneWidth}  ${overflow.wide.join(" | ")}` : ""}`);
      if (docScroll.length) console.log(`         ${docScroll.join(" | ")}`);
      if (overflow.clipped.length) console.log(`         clipped: ${overflow.clipped.join(" | ")}`);
      if (cutOff.length) console.log(`         cut off: ${cutOff.join(" | ")}`);
      // touch targets only matter where there is a thumb
      if (vp.isMobile && overflow.tiny.length) console.log(`         small taps: ${overflow.tiny.join(" | ")}`);
      for (const e of errs.slice(0, 3)) console.log(`         ${e}`);

      // Some of the densest screens are behind a tap: a record opens a dialog, and that dialog
      // opens another. A page list alone never reaches them, so the drill-downs are spelled
      // out - the audit trail's posting table was unreadable on a phone for exactly that long.
      for (const step of DEEP[name] || []) {
        // a step marked `cards` is about the card layout (a phone): from md up the list is a table, where these buttons are in a row menu
        if (step.cards && vp.width >= 768) continue;
        try {
          problems.length = 0;
          for (const label of step.clicks) {
            const hit = await findByText(page, label);
            if (!hit) {
              const seen = await page.evaluate(() => {
                const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
                const scope = dlg || document;
                return {
                  dialogs: document.querySelectorAll('[role="dialog"]').length,
                  // the shell's own controls come first (a dozen on a phone), so the page's are behind them
                  inScope: [...scope.querySelectorAll("button, a[href], [role='button']")]
                    .slice(0, 40)
                    .map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 20)),
                };
              });
              throw new Error(`nothing matching ${label}; dialogs=${seen.dialogs}; in scope: ${seen.inScope.join(" / ")}`);
            }
            await hit.click();
            await wait(step.settle ?? 1000);
          }
          // `upload`: choose a fixture file in the open dialog's file input, then `after` are the clicks that follow it
          if (step.upload) {
            const input = await page.$('[role="dialog"] input[type="file"]');
            if (!input) throw new Error(`no file input in the dialog to upload ${step.upload} to`);
            await input.uploadFile(FIXTURES[step.upload]);
            await wait(step.settle ?? 1000);
            for (const label of step.after || []) {
              const next = await findByText(page, label);
              if (!next) throw new Error(`nothing matching ${label} after the upload`);
              await next.click();
              await wait(step.settle ?? 1000);
            }
          }
          // `type`: put something in a field before the screenshot, so a step can show what a filled-in
          // form looks like (an amount field draws its own grouping as the digits arrive: 20,000).
          // Each pair is [what names the field (its placeholder, aria-label or linked label), what to type].
          for (const [names, text] of step.type || []) {
            const field = await page.evaluateHandle((t) => {
              const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
              const re = new RegExp(t, 'i');
              return [...(dlg || document).querySelectorAll('input, textarea')].find((el) => {
                if (el.offsetParent === null || el.disabled) return false;
                const label = el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : "";
                return re.test(el.placeholder || "") || re.test(el.getAttribute("aria-label") || "") || re.test(label || "");
              }) || null;
            }, names);
            const el = field.asElement();
            if (!el) throw new Error(`no field matching ${names} to type into`);
            await el.click();
            await page.keyboard.type(String(text), { delay: 25 });
            await wait(200);
          }
          // `reveal`: scroll the first element whose text matches into view, so the screenshot shows the part
          // of a long page the step is about
          if (step.reveal) {
            await page.evaluate((t) => {
              const el = [...document.querySelectorAll('label, legend, h2, h3, h4, p, span')].find((e) => e.getBoundingClientRect().height > 0 && new RegExp(t, 'i').test((e.textContent || '').trim()));
              el?.scrollIntoView({ block: 'start' });
            }, step.reveal);
            await wait(300);
          }
          let o = await measureDialog(page);
          // A slow lazy chunk is not a blank page: if nothing is there yet, give it a moment and look once more. A page that
          // really is blank is still blank, so this removes a false alarm without hiding the real thing.
          if ((!step.page && !o.opened) || o.text < 40) {
            await wait(2500);
            o = await measureDialog(page);
          }
          await page.screenshot({ path: join(OUT, `${name}-${step.name}-${vp.name}.png`) });
          const deepErrs = [...new Set(problems)];
          // "No dialog" and "an empty one" both have to fail loudly: a blank screenshot that
          // reports ok is worse than no check at all.
          const broke = (!step.page && !o.opened) || o.text < 40;
          results.push({ page: `${name}>${step.name}`, vp: vp.name, bleeds: o.bleeds, blank: broke, widest: o.wide, cutOff: o.cutOff, errors: deepErrs });
          const flag = broke ? "BLANK " : o.bleeds ? "BLEEDS" : o.cutOff.length ? "CUT   " : "ok    ";
          console.log(`${flag} ${vp.name.padEnd(8)} ${`${name}>${step.name}`.padEnd(26)} ${broke ? `dialog=${o.opened} text=${o.text}` : o.bleeds ? `${o.what} ${o.sw} > ${o.w}  ${o.wide.join(" | ")}` : ""}`);
          if (o.cutOff.length) console.log(`         cut off: ${o.cutOff.join(" | ")}`);
          for (const e of deepErrs.slice(0, 2)) console.log(`         ${e}`);
        } catch (err) {
          console.log(`SKIP   ${vp.name.padEnd(8)} ${`${name}>${step.name}`.padEnd(26)} ${err.message}`);
        }
        // back to a clean page for the next step
        await page.goto(`http://localhost:${WEB_PORT}${path}`, { waitUntil: "networkidle2", timeout: 30000 });
        await wait(700);
      }

      // A tabbed screen hides most of itself behind its tabs, and the panel that is not open
      // is the one nobody looks at. Click each one and measure it the same way - this is how
      // the Sales tab's over-wide tiles were missed the first time round.
      const tabs = await page.$$('[role="tab"]');
      for (let t = 1; t < tabs.length; t++) {
        const label = (await page.evaluate((el) => el.textContent.trim().slice(0, 20), tabs[t])) || `tab${t}`;
        const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        try {
          problems.length = 0;
          await tabs[t].click();
          await wait(700);
          const o = await page.evaluate(() => {
            const pane = document.querySelector("main") || document.documentElement;
            const wide = [...document.querySelectorAll("main *")]
              .filter((el) => el.getBoundingClientRect().width > pane.clientWidth + 1)
              .filter((el) => {
                const st = getComputedStyle(el);
                return st.overflowX !== "auto" && st.overflowX !== "scroll" && st.position !== "fixed";
              })
              .slice(0, 4)
              .map((el) => `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ").slice(0, 3).join(".")} ${Math.round(el.getBoundingClientRect().width)}px`);
            return { bleeds: pane.scrollWidth > pane.clientWidth + 4, w: pane.clientWidth, sw: pane.scrollWidth, wide };
          });
          const tabCut = await page.evaluate(findCutOff, "main");
          await page.screenshot({ path: join(OUT, `${name}-${slug}-${vp.name}.png`) });
          const tabErrs = [...new Set(problems)];
          results.push({ page: `${name}:${slug}`, vp: vp.name, bleeds: o.bleeds, widest: o.wide, cutOff: tabCut, errors: tabErrs });
          console.log(`${o.bleeds ? "BLEEDS" : tabCut.length ? "CUT   " : "ok    "} ${vp.name.padEnd(8)} ${`${name}:${slug}`.padEnd(26)} ${o.bleeds ? `pane ${o.sw} > ${o.w}  ${o.wide.join(" | ")}` : ""}`);
          if (tabCut.length) console.log(`         cut off: ${tabCut.join(" | ")}`);
          for (const e of tabErrs.slice(0, 2)) console.log(`         ${e}`);
        } catch {
          // a tab that cannot be clicked (disabled, or it navigated away) is not a layout fault
        }
      }
    } catch (err) {
      console.log(`FAIL   ${vp.name.padEnd(8)} ${name.padEnd(18)} ${err.message.split("\n")[0]}`);
      results.push({ page: name, vp: vp.name, error: err.message });
    }
  }
  await page.close();
}

await browser.close();
writeFileSync(join(OUT, "report.json"), JSON.stringify(results, null, 2));
console.log(`\nShots in ${OUT}`);
// A screen that throws is not "ok" just because something else is still drawn: a tab that throws inside its
// panel hides the layout the sweep exists to check. The page error boundary catches it and shows "Something went
// wrong on this page" instead of a blank window, so the crash arrives as a console error, not a page error.
const threw = (r) => (r.errors || []).some((e) => /^pageerror/.test(e) || /^console: Page crashed:/.test(e));
const broken = results.filter((r) => r.bleeds || r.blank || r.error || threw(r) || (r.cutOff && r.cutOff.length) || (r.docScroll && r.docScroll.length));
for (const r of broken.filter((x) => threw(x) && !x.bleeds && !x.blank)) console.log(`THREW  ${r.vp.padEnd(8)} ${r.page}  ${r.errors.find((e) => /^pageerror|^console: Page crashed:/.test(e))}`);
await stop(broken.length ? 1 : 0);
