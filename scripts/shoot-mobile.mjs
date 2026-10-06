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
const DEEP = {
  // The cheque register puts "Audit trail" on the row itself, so the densest dialog in the
  // app is one tap away - the posting table inside it is what this check exists for.
  "finance-cheques": [{ name: "audit", clicks: ["Audit trail"], settle: 1400 }],
  // A quotation and a delivery note are each a printed document with a row of actions above it, and
  // dialogs behind those. `page: true` means the step lands on a page, not a dialog.
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
};

/** The first visible, enabled control whose text or label matches. */
async function findByText(page, label) {
  const handles = await page.$$("button, a[href], [role='button']");
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

/** Measure the topmost dialog the way a pane is measured. */
async function measureDialog(page) {
  return page.evaluate(() => {
    const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
    const box = dlg || document.querySelector("main") || document.documentElement;
    const opened = Boolean(dlg);
    const text = (box.innerText || "").trim().length;
    // the dialog's own scrolling body is what overflows, not the dialog element
    const panes = [box, ...box.querySelectorAll("*")].filter((el) => {
      // an A4 preview is a fixed 210mm sheet in a pane that scrolls on purpose; it is the page
      // around it that has to fit
      if (el.closest("[data-print-preview]")) return false;
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
    return { opened, text, bleeds: worst.sw > worst.w + 4, sw: worst.sw, w: worst.w, what: worst.what, wide };
  });
}

const PAGES = [
  ["login", "/"],
  ...MODULES.flatMap((m) =>
    m.tabs.map((t) => [`${m.id}-${t.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, t.to])
  ),
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

const doc = (i) => ({
  _id: `d${i}`, id: `d${i}`, transactionNo: `SO-2026-004${i}`, date: "2026-10-0" + ((i % 9) + 1),
  deliveryDate: "2026-10-1" + ((i % 9) + 1), customerName: `Al Noor Trading ${i}`,
  vendorName: `Gulf Supply ${i}`, status: ["APPROVED", "DRAFT", "APPROVED"][i % 3],
  totalAmount: 12480.5 * i, items: [{}, {}, {}], priority: "normal", createdBy: "Admin",
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
        period, monthly: months(),
        pnl: { revenue: 1284000, cogs: 820000, grossProfit: 464000, expenses: 180000, netProfit: 284000 },
        cash: { opening: 120000, inflow: 640000, outflow: 520000, closing: 240000 },
        receivables: { total: 342000, overdue: 48000 }, payables: { total: 128000, overdue: 12000 },
        rows: [], links: [],
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
    return { map: [], keys: [], accounts: n(account, 4), unmapped: [], configured: [] };
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
      goLiveDate: "2026-01-01", locked: false, balanced: true, difference: 0,
      sections: {
        accounts: { rows: 4, debit: 120000, credit: 120000 },
        customers: { rows: 6, total: 84000 },
        vendors: { rows: 3, total: 42000 },
        stock: { rows: 12, value: 196000 },
      },
    };
  }

  if (p.includes("vat-return") || p.includes("/vat")) {
    return {
      boxes: [
        { box: "1", label: "Standard rated supplies", amount: 480000, vat: 24000 },
        { box: "4", label: "Standard rated expenses", amount: 180000, vat: 9000 },
      ],
      rows: [], lines: [], totals: { output: 24000, input: 9000, payable: 15000 },
      unclassified: { count: 0, amount: 0, lines: [] },
      emirates: [], adjustments: [],
      reconciliation: { matched: true, difference: 0 }, saved: null, returns: [],
    };
  }

  if (p.includes("valuation") || p.includes("stock-report")) {
    return {
      rows: n(batch), items: n(batch), negativeItems: [], expiring: n(batch, 2), slowMoving: [],
      totals: { quantity: 1200, value: 196000, cost: 180000, margin: 8.9 },
    };
  }

  if (p.includes("lookups")) return { items: n(batch), categories: [], warehouses: [], units: [] };

  if (p.includes("ifrs")) {
    const section = () => ({ current: n(account, 2), nonCurrent: n(account, 2), total: 240000, lines: n(account, 3) });
    return {
      assets: section(), liabilities: section(), equity: section(),
      profitOrLoss: { lines: n(account, 4), total: 84000 },
      cashFlows: { operating: [], investing: [], financing: [], total: 0 },
      changesInEquity: { rows: [] }, notes: [], comparative: null,
    };
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
        clipped: overflow.clipped, tiny: overflow.tiny, errors: errs,
      });
      const flag = blank ? "BLANK " : bleeds ? "BLEEDS" : overflow.clipped.length ? "CLIP  " : "ok    ";
      console.log(`${flag} ${vp.name.padEnd(8)} ${name.padEnd(18)} ${bleeds ? `pane ${overflow.paneScroll} > ${overflow.paneWidth}  ${overflow.wide.join(" | ")}` : ""}`);
      if (overflow.clipped.length) console.log(`         clipped: ${overflow.clipped.join(" | ")}`);
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
          const o = await measureDialog(page);
          await page.screenshot({ path: join(OUT, `${name}-${step.name}-${vp.name}.png`) });
          const deepErrs = [...new Set(problems)];
          // "No dialog" and "an empty one" both have to fail loudly: a blank screenshot that
          // reports ok is worse than no check at all.
          const broke = (!step.page && !o.opened) || o.text < 40;
          results.push({ page: `${name}>${step.name}`, vp: vp.name, bleeds: o.bleeds, blank: broke, widest: o.wide, errors: deepErrs });
          const flag = broke ? "BLANK " : o.bleeds ? "BLEEDS" : "ok    ";
          console.log(`${flag} ${vp.name.padEnd(8)} ${`${name}>${step.name}`.padEnd(26)} ${broke ? `dialog=${o.opened} text=${o.text}` : o.bleeds ? `${o.what} ${o.sw} > ${o.w}  ${o.wide.join(" | ")}` : ""}`);
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
          await page.screenshot({ path: join(OUT, `${name}-${slug}-${vp.name}.png`) });
          const tabErrs = [...new Set(problems)];
          results.push({ page: `${name}:${slug}`, vp: vp.name, bleeds: o.bleeds, widest: o.wide, errors: tabErrs });
          console.log(`${o.bleeds ? "BLEEDS" : "ok    "} ${vp.name.padEnd(8)} ${`${name}:${slug}`.padEnd(26)} ${o.bleeds ? `pane ${o.sw} > ${o.w}  ${o.wide.join(" | ")}` : ""}`);
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
await stop(results.some((r) => r.bleeds || r.blank || r.error) ? 1 : 0);
