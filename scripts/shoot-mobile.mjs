// Screenshots the app at phone, tablet and desktop width, against a stub API, so the layout
// can be looked at without a database behind it.
//
//   node scripts/shoot-mobile.mjs                  all three widths, default page list
//   node scripts/shoot-mobile.mjs /sales-order     one page
//
// The stub answers every /api/v1 call with a small, plausible payload: enough rows to show a
// list, a party, a voucher. It is for looking at layout, nothing else.
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import puppeteer from "puppeteer";
// the same responses the screen tests use, so the sweep and the tests cannot drift apart
import { POSITION, PROFIT, EQUITY, CASH, NOTES } from "../src/lib/__tests__/ifrsFixtures.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.SHOT_DIR || join(ROOT, ".shots");
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
    sales: ["view", "create", "edit", "approve", "delete", "send", "creditOverride"], purchase: ["view", "create", "edit", "approve", "delete"],
    inventory: ["view", "create", "edit", "delete", "adjust"], finance: ["view", "create", "edit", "approve", "delete"], banking: ["view", "manage", "reconcile"],
    accounts: ["view", "manage", "close"], reports: ["view", "financial", "vat"], users: ["view", "manage"], settings: ["view", "manage"],
    audit: ["view"], lookups: ["view"],
  }).flatMap(([m, actions]) => actions.map((a) => `${m}.${a}`)),
])];
const DEEP = {
  // Users and roles: the dialogs behind the two tabs. The role editor is the tallest form in the product (every module's boxes).
  "people-users-and-roles": [
    { name: "add-person", clicks: ["Add a person"], settle: 900 },
    { name: "change-person", clicks: ["^Change"], settle: 900 },
    // "Different role in a branch": two rows on a phone is the tallest the section gets; Imran Ali already holds one
    { name: "add-person-branch-roles", clicks: ["Add a person", "Add a branch", "Add a branch"], settle: 900 },
    { name: "change-person-branch-roles", clicks: ["^Change Imran"], settle: 900 },
    { name: "roles", page: true, clicks: ["^Roles$"], settle: 900 },
    { name: "new-role", clicks: ["^Roles$", "New role"], settle: 1100 },
    { name: "built-in-role", clicks: ["^Roles$", "^View$"], settle: 1100 },
  ],
  // The cheque register puts "Audit trail" on the row itself, so the densest dialog in the
  // app is one tap away - the posting table inside it is what this check exists for.
  "finance-cheques": [{ name: "audit", clicks: ["Audit trail"], settle: 1400 }],
  // A quotation and a delivery note are each a printed document with a row of actions above it, and
  // dialogs behind those. `page: true` means the step lands on a page, not a dialog.
  // The Sending tab with "your own mail server" chosen: five more fields and a warning, on a phone.
  "settings-settings": [
    { name: "smtp", page: true, clicks: ["^Sending$", "Your own mail server"], settle: 800, reveal: "^Mail server" },
    // Branches: the list, then the add dialog (a form someone fills in on a phone).
    { name: "branches", page: true, clicks: ["^Branches$"], settle: 1000 },
    { name: "add-branch", clicks: ["^Branches$", "Add a branch"], settle: 900 },
  ],

  "sales-quotations": [
    { name: "document", page: true, clicks: ["^View$"], settle: 1500 },
    { name: "convert", clicks: ["^View$", "Convert to sales order"], settle: 1300 },
    // the shared order form, configured as a quotation (valid until, terms, reference)
    { name: "form", page: true, clicks: ["^New quotation"], settle: 1500 },
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
  // The page opens on its dashboard, so the first tap is "View all orders". A row's View is the eye (labelled
  // with the number) on a wide screen and the word View on a card, so the match is "View" then a number or the end.
  "sales-orders": [
    { name: "list", page: true, clicks: ["^View all orders"], settle: 1200 },
    { name: "document", page: true, clicks: ["^View all orders", "^View( [0-9]|$)"], settle: 1600 },
    { name: "send", clicks: ["^View all orders", "^View( [0-9]|$)", "^Send$"], settle: 1800 },
    { name: "send-row", clicks: ["^View all orders", "^Send (SO|[0-9])"], settle: 1600 },
    { name: "history", clicks: ["^View all orders", "^View( [0-9]|$)", "^Send history$"], settle: 1500 },
    // the audit trail, from the button on a card
    { name: "audit", clicks: ["^View all orders", "^Audit trail$"], settle: 1600 },
  ],
  // The other three order modules have the same dashboard-then-list shape, the same cards, and the same dialogs behind them.
  "purchase-orders": [
    { name: "list", page: true, clicks: ["^View all purchase orders"], settle: 1200 },
    { name: "document", page: true, clicks: ["^View all purchase orders", "^View( [0-9]|$)"], settle: 1600 },
    { name: "audit", clicks: ["^View all purchase orders", "^Audit trail$"], settle: 1600 },
  ],
  "sales-returns": [
    { name: "list", page: true, clicks: ["^View all sales returns"], settle: 1200 },
    { name: "audit", clicks: ["^View all sales returns", "^Audit trail$"], settle: 1600 },
  ],
  "purchase-returns": [
    { name: "list", page: true, clicks: ["^View all purchase returns"], settle: 1200 },
    { name: "audit", clicks: ["^View all purchase returns", "^Audit trail$"], settle: 1600 },
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
DEEP["bank-reconciliation"] = DEEP["finance-reconcile"];
DEEP["sales-order"] = DEEP["sales-orders"]; // a single-page run (check:mobile -- /sales-order)
DEEP["delivery-notes"] = DEEP["sales-delivery-notes"]; // a single page run (check:mobile -- /delivery-notes) is named by its path
DEEP["settings"] = DEEP["settings-settings"]; // check:mobile -- /settings
DEEP["users"] = DEEP["people-users-and-roles"]; // check:mobile -- /users

/** The first visible, enabled control whose text or label matches. */
async function findByText(page, label) {
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
  return null;
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
  ["console-activity", "/platform/activity"],
];
const PAGES = [
  ["login", "/"],
  ...MODULES.flatMap((m) =>
    m.tabs.map((t) => [`${m.id}-${t.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, t.to])
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
  _id: `d${i}`, id: `d${i}`, transactionNo: `SO-2026-004${i}`, date: "2026-10-0" + ((i % 9) + 1),
  deliveryDate: "2026-10-1" + ((i % 9) + 1), customerName: `Al Noor Trading ${i}`,
  vendorName: `Gulf Supply ${i}`, status: ["APPROVED", "APPROVED", "DRAFT"][i % 3], lastSend: SENDS[i] || null,
  totalAmount: 12480.5 * i,
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

const batch = (i) => ({
  _id: `bt${i}`, batchNumber: `B-20260${i}`, itemName: `Basmati Rice ${i}`, sku: `SKU-00${i}`,
  itemCode: `IT00${i}`, receivedAt: "2026-09-1" + ((i % 9) + 1), expiryDate: "2027-03-1" + ((i % 9) + 1),
  qtyOnHand: 120 * i, receivedQty: 200 * i, expired: false, sourceTransactionNo: `PO-2026-001${i}`,
});

const n = (f, count = 6) => Array.from({ length: count }, (_, i) => f(i + 1));

// lib/accountingApi.js hands callers `res.data.data` as-is, so the shape here has to be the
// shape each screen actually reads - an array for most lists, an object where the screen wants
// a summary beside its rows. Getting this wrong shows up as a blank page, which is exactly what
// the harness is watching for, so it has to be right for the check to mean anything.
function stubFor(pathname) {
  const p = pathname;
  const page = { total: 6, current: 1, pages: 1, limit: 20 };

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
      features: { quotations: true, deliveryNotes: true, batches: true, banking: true, reconciliation: true, currencies: true, vatReturn: true, ifrsStatements: true, einvoicing: true, messaging: true, multiBranch: true },
      limits: { users: 50, branches: 20, documentsPerMonth: 20000 },
      usage: { users: 4, branches: 1, documentsPerMonth: 120 },
      room: {},
      support: { contact: "help@zarvia.example" },
      // Who is signed in and what the role holds. The sweep signs in as an administrator who holds every permission any page
      // asks for, so every page is still measured; the Users and roles screen needs a rank to offer anything.
      branches: [{ code: "main", name: "Head office", isHeadOffice: true }, { code: "shj", name: "Sharjah Warehouse" }],
      branch: { code: "main", name: "Head office", canSwitch: true, canViewAll: true },
      me: { id: "a1", name: "Super Admin", role: { key: "admin", name: "Administrator", rank: 80, approvalLimit: null }, grants: ALL_GRANTS, homeBranch: "main", branchRoles: [] },
      // Who must approve what (Settings -> Business rules -> Approvals); off until the organisation sets it.
      policy: { approvals: { separateApprover: false, secondApprovalAbove: null } },
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
  if (p.includes("/access/users")) {
    const person = (i, name, key, roleName, rank, over = {}) => ({ id: `u${i}`, name, email: `user${i}@gulffresh.example`, role: { key, name: roleName, rank, builtIn: true, active: true }, branchId: i % 2 ? "main" : "shj", branchRoles: [], isActive: true, status: "active", lastLogin: "2026-10-06T08:00:00.000Z", ...over });
    return [
      person(1, "Owner One", "super_admin", "Owner", 100),
      person(2, "Super Admin", "admin", "Administrator", 80, { id: "a1" }),
      // holds another role in a branch: the list says so under the role, and Change opens the dialog with a row
      person(3, "Imran Ali", "manager", "Manager", 60, { branchRoles: [{ branchId: "shj", role: { key: "viewer", name: "Viewer", rank: 20, builtIn: true, active: true } }] }),
      person(4, "Sara Khan", "supervisor", "Sales supervisor", 55, { role: { key: "supervisor", name: "Sales supervisor", rank: 55, builtIn: false, active: true } }),
      person(5, "Lina Haddad", "viewer", "Viewer", 20, { isActive: false, status: "inactive" }),
    ];
  }

  // The developer console (/api/v1/platform/*).
  if (p.includes("/platform/")) {
    const org = (over) => ({ code: "gulf-fresh", legalName: "Gulf Fresh Foods LLC", country: "AE", baseCurrency: "AED", timezone: "Asia/Dubai", planCode: "standard", status: "active", featureOverrides: { einvoicing: true }, limitOverrides: { users: 25 }, subscription: { endsAt: "2026-12-31T23:59:59.999Z", graceDays: 7, onExpiry: "block" }, provisioning: { complete: true, steps: { settings: { state: "done" }, chart: { state: "done" }, taxCodes: { state: "done" } } }, ...over });
    if (p.endsWith("/catalog")) {
      return {
        plans: [
          { code: "trial", name: "Trial", trialDays: 14, features: { quotations: true, deliveryNotes: true, batches: true }, limits: { users: 3, branches: 1, documentsPerMonth: 200 } },
          { code: "standard", name: "Standard", features: { quotations: true, deliveryNotes: true, batches: true, banking: true, currencies: true, vatReturn: true, messaging: true }, limits: { users: 10, branches: 3, documentsPerMonth: 2000 } },
          { code: "premium", name: "Premium", features: { quotations: true, deliveryNotes: true, batches: true, banking: true, reconciliation: true, currencies: true, vatReturn: true, ifrsStatements: true, einvoicing: true, messaging: true, multiBranch: true }, limits: { users: 50, branches: 20, documentsPerMonth: 20000 } },
        ],
        features: [["quotations", "Quotations"], ["deliveryNotes", "Delivery notes"], ["batches", "Batches and expiry"], ["banking", "Banks, cards and cheques"], ["reconciliation", "Bank and card reconciliation"], ["currencies", "Foreign currency"], ["vatReturn", "VAT return"], ["ifrsStatements", "IFRS statements"], ["einvoicing", "E-invoicing"], ["messaging", "Send documents to customers"], ["multiBranch", "More than one branch"]].map(([key, label]) => ({ key, label })),
        limits: ["users", "branches", "documentsPerMonth"],
        currencies: [{ code: "AED", name: "UAE Dirham" }, { code: "SAR", name: "Saudi Riyal" }, { code: "USD", name: "US Dollar" }],
        unsupportedCurrencies: ["KWD", "BHD", "OMR"],
        timezones: ["Asia/Dubai", "Asia/Riyadh", "Europe/London"],
        accountTypes: ["super_admin", "admin", "manager", "operator", "viewer"],
      };
    }
    if (p.endsWith("/audit")) return { total: 3, rows: n((i) => ({ _id: `pa${i}`, at: `2026-10-0${i}T09:30:00.000Z`, action: ["ORGANISATION_CREATED", "SUBSCRIPTION_EXTENDED", "USER_CREATED"][i - 1], organisation: "gulf-fresh", summary: ["Organisation created on the standard plan, books in AED", "Subscription now ends 2026-12-31", "Account created for owner@gulffresh.example (super_admin)"][i - 1], by: "dev@zarvia.test" }), 3) };
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
      _id: id, name, code, children: [], ungrouped: [], role: null,
      accounts: n(account, 3).map((a) => ({ ...a, isActive: true })),
      totals: { opening: 0, debit: 0, credit: 0, closing: 0 },
    });
    return {
      categories: [
        { category: "Assets", groups: [group("g1", "Current assets", "1000")], ungrouped: [] },
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
        topCustomers: n(party, 5).map((x) => ({ name: x.name, netRevenue: 42000 })),
        bestSellers: n(batch, 5).map((b, i) => ({ name: b.itemName, qty: 120 - i * 8, revenue: 24000 - i * 1500, stockId: b._id })),
        orders: { count: 142, changePct: 8.2 }, averageOrder: change(1250),
        approvedShare: { pct: 0, changePct: null }, returns: { count: 2, value: 3400 },
      };
    }
    if (p.includes("/inventory")) {
      return {
        period, stockValueTrend: { months: months(6), total: 480000 },
        categories: n(batch, 4).map((b, i) => ({ name: `Category ${i + 1}`, value: 60000 - i * 8000 })),
        mix: n(batch, 4).map((b, i) => ({ name: b.itemName, value: 40000 - i * 6000 })),
        lowStock: n(batch, 3).map((b) => ({ ...b, currentStock: 4, reorderLevel: 20 })),
        batches: n(batch, 3), totals: { value: 480000, items: 128, lowStock: 3, expiring: 2 },
      };
    }
    if (p.includes("/reports")) {
      return {
        currency: "AED", period, grossProfit: 464000, netProfit: 284000,
        vat: { from: "2026-10-01", to: "2026-10-31", outputVat: 64200, recoverableVat: 41000, net: 23200, position: "payable", hasActivity: true },
        valueGrowth: months().map(({ month }, i) => ({ month, grossProfit: 30000 + i * 9000 })),
        vouchers: [{ voucherType: "receipt", amount: 930000 }, { voucherType: "payment", amount: 520000 }, { voucherType: "journal", amount: 40000 }, { voucherType: "contra", amount: 120000 }, { voucherType: "expense", amount: 64000 }],
        ageing: AGEING,
      };
    }
    if (p.includes("/analytics")) {
      const named = (labels) => labels.map((label, i) => ({ label, name: label, value: 40 - i * 8 }));
      return {
        period, monthly: months(),
        weekly: Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-0${i + 1}`, revenue: 12000 + i * 800, orders: 3 + i })),
        performance: { collectionRatePct: 72.4, grossMarginPct: 18.4, stockAvailabilityPct: 94.1 },
        customerMix: { rows: n(party, 4).map((x) => ({ name: x.name, value: 40000 })) },
        categorySales: { rows: [{ name: "Rice", current: 82000, previous: 74000 }, { name: "Oil", current: 61000, previous: 65000 }] },
        categoryMonths: { months: ["2026-08", "2026-09", "2026-10"], rows: [{ name: "Rice", values: [24000, 28000, 30000] }, { name: "Oil", values: [19000, 21000, 21000] }] },
        cashFlow: { months: months(6).map((m) => ({ month: m.month, inflow: m.revenue, outflow: m.purchases })), accounts: n(account, 3) },
        pipeline: named(["Draft", "Approved", "Invoiced", "Paid"]),
        settlement: named(["Cash", "Bank", "Cheque", "Card"]),
        topCustomers: n(party, 5).map((x) => ({ name: x.name, netRevenue: 42000 })),
        radar: { categories: [{ name: "Rice", value: 80 }, { name: "Oil", value: 62 }, { name: "Sugar", value: 45 }] },
        ageing: AGEING,
        topVendors: [{ partyId: "v2", name: "Delta Foods", purchases: 100000, previous: 80000, changePct: 25 }, { partyId: "v1", name: "Gulf Mills", purchases: 50000, previous: 0, changePct: null }],
        collections: ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"].map((weekStart, i) => ({ weekStart, receipts: i * 10000, invoiced: i * 20000 })),
        treemap: [{ itemId: "RICE", name: "Rice", size: 640000 }, { itemId: "OIL", name: "Oil", size: 300000 }],
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
      attention: [], recent: n(doc, 5),
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

  if (p.includes("fiscal-year")) return [{ _id: "fy1", code: "2026", startDate: "2026-01-01", endDate: "2026-12-31", status: "open" }];
  if (p.includes("number-series")) return n(account, 3).map((a, i) => ({ _id: `s${i}`, series: "SO", fiscalYear: "2026", prefix: "SO-2026-", next: 42 + i }));
  if (p.includes("tax-code")) return [{ _id: "t1", name: "Standard 5%", kind: "standard", ratePercent: 5, isActive: true, isDefault: true, rateHistory: [] }];
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
    _id: `g-${name}`, name, code: "1000", category: "Assets", children: [], ungrouped: [],
    accounts: n(account, 3).map((a) => ({ ...a, isActive: true, opening: 1000, debit: 500, credit: 200, closing: 1300 })),
    totals: { opening: 3000, debit: 1500, credit: 600, closing: 3900 },
  });

  if (p.includes("/reports/profit-loss")) {
    const group = (id, name, total, code, account) => ({ groupId: id, name, total, accounts: [{ accountId: `${id}a`, accountCode: code, accountName: account, amount: total }] });
    return {
      revenue: { groups: [group("g1", "Sales Income", 1284000, "SAL0001", "Sales Revenue")], total: 1284000 },
      directCosts: { groups: [group("g2", "Cost of Goods Sold", 820000, "COGS0001", "Cost of Goods Sold")], total: 820000 },
      grossProfit: 464000, grossMargin: 36.1,
      otherIncome: { groups: [], total: 0 },
      operatingExpenses: { groups: [group("g3", "Operating Expenses", 180000, "OPEX0001", "Rent")], total: 180000 },
      netProfit: 284000,
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
      rows: n(party), parties: n(party),
      totals: { owed: 342000, overdue: 48000, count: 6, advance: 12000 },
    };
  }

  if (p.includes("ageing")) {
    const buckets = [
      { key: "current", label: "Current" }, { key: "d30", label: "1-30" },
      { key: "d60", label: "31-60" }, { key: "d90", label: "61-90" }, { key: "d90p", label: "90+" },
    ];
    const amounts = { current: 1000, d30: 2000, d60: 500, d90: 0, d90p: 250 };
    return {
      buckets,
      rows: n(party).map((x) => ({ ...x, buckets: amounts, total: 3750, paymentTerms: "30 days", invoices: [] })),
      totals: { current: 6000, d30: 12000, d60: 3000, d90: 0, d90p: 1500, total: 22500 },
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
      from: "2026-07-01", to: "2026-09-30", emirate: "Dubai", currency: "AED",
      boxes: [
        box("1a", "Standard-rated supplies in Abu Dhabi"), box("1b", "Standard-rated supplies in Dubai", 480000, 24000), box("1c", "Standard-rated supplies in Sharjah"),
        box("1d", "Standard-rated supplies in Ajman"), box("1e", "Standard-rated supplies in Umm Al Quwain"), box("1f", "Standard-rated supplies in Ras Al Khaimah"),
        box("1g", "Standard-rated supplies in Fujairah"), box("3", "Supplies subject to the reverse charge"), box("4", "Zero-rated supplies", 12000),
        box("5", "Exempt supplies", 8000), box("8", "Total supplies", 500000, 24000), box("9", "Standard-rated expenses", 180000, 9000),
        box("10", "Expenses subject to the reverse charge"), box("11", "Total expenses", 180000, 9000), box("12", "Total VAT due", 0, 24000),
        box("13", "Recoverable input VAT", 0, 9000), box("14", "Net VAT payable", 0, 15000),
      ],
      totals: { outputVat: 24000, recoverableVat: 9000, netPayable: 15000 },
      unclassified: { count: 0, amount: 0, vat: 0, lines: [] },
      notReported: { count: 0, amount: 0 },
      notTracked: [{ box: "2", label: "Tax refunds provided to tourists" }, { box: "6", label: "Goods imported into the UAE" }, { box: "7", label: "Import adjustments" }],
      reconciliation: { rows: [{ label: "Output VAT", documents: 24000, ledger: 24000, difference: 0, agrees: true }, { label: "Input VAT", documents: 9000, ledger: 8995, difference: 5, agrees: false }] },
    };
  }

  if (p.includes("valuation") || p.includes("stock-report")) {
    return {
      rows: n(batch), items: n(batch), negativeItems: [], expiring: n(batch, 2), slowMoving: [],
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
  res.setHeader("Content-Type", "application/json");
  const data = stubFor(url.pathname);
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
      const cutOff = await page.evaluate(findCutOff, "main");
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
        clipped: overflow.clipped, cutOff, tiny: overflow.tiny, errors: errs,
      });
      const flag = blank ? "BLANK " : bleeds ? "BLEEDS" : cutOff.length ? "CUT   " : overflow.clipped.length ? "CLIP  " : "ok    ";
      console.log(`${flag} ${vp.name.padEnd(8)} ${name.padEnd(18)} ${bleeds ? `pane ${overflow.paneScroll} > ${overflow.paneWidth}  ${overflow.wide.join(" | ")}` : ""}`);
      if (overflow.clipped.length) console.log(`         clipped: ${overflow.clipped.join(" | ")}`);
      if (cutOff.length) console.log(`         cut off: ${cutOff.join(" | ")}`);
      // touch targets only matter where there is a thumb
      if (vp.isMobile && overflow.tiny.length) console.log(`         small taps: ${overflow.tiny.join(" | ")}`);
      for (const e of errs.slice(0, 3)) console.log(`         ${e}`);

      // Some of the densest screens are behind a tap: a record opens a dialog, and that dialog
      // opens another. A page list alone never reaches them, so the drill-downs are spelled
      // out - the audit trail's posting table was unreadable on a phone for exactly that long.
      for (const step of DEEP[name] || []) {
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
                  inScope: [...scope.querySelectorAll("button, a[href], [role='button']")]
                    .slice(0, 12)
                    .map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 20)),
                };
              });
              throw new Error(`nothing matching ${label}; dialogs=${seen.dialogs}; in scope: ${seen.inScope.join(" / ")}`);
            }
            await hit.click();
            await wait(step.settle ?? 1000);
          }
          // `reveal`: scroll the first element whose text matches into view, so the screenshot shows the part
          // of a long page the step is about
          if (step.reveal) {
            await page.evaluate((t) => {
              const el = [...document.querySelectorAll('label, legend, h2, h3, p, span')].find((e) => e.getBoundingClientRect().height > 0 && new RegExp(t, 'i').test((e.textContent || '').trim()));
              el?.scrollIntoView({ block: 'start' });
            }, step.reveal);
            await wait(300);
          }
          const o = await measureDialog(page);
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
const broken = results.filter((r) => r.bleeds || r.blank || r.error || threw(r) || (r.cutOff && r.cutOff.length));
for (const r of broken.filter((x) => threw(x) && !x.bleeds && !x.blank)) console.log(`THREW  ${r.vp.padEnd(8)} ${r.page}  ${r.errors.find((e) => /^pageerror|^console: Page crashed:/.test(e))}`);
await stop(broken.length ? 1 : 0);
