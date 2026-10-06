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
import { spawn } from "node:child_process";
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
  if (p.includes("audit")) return { rows: [], pagination: { total: 0, current: 1, pages: 1 } };

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
  try { vite.kill(); } catch { /* already gone */ }
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

  // signed in, so the shell renders instead of the login page
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
