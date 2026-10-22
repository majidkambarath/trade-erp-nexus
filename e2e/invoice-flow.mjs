// End to end: the way a person actually reaches a sales invoice - the list, the document, Back to list, Home, and back
// again - with a real frontend (Vite) driving a real backend on its own throwaway database, in a real browser.
// Run it with `npm run e2e -- invoice-flow` (see e2e/README.md).
//
// What it is here to prove: the figures on the paper are the server's own, at every door into the document. The lists
// PRINT (Download, the Send attachment and the invoice screen are all built out of the list row), so a row that does not
// carry `pricing` makes the sheet fall back to summing the lines: the header charge, the header discount and the
// round-off come off the paper while the Amount column beside it still reads the real total.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { FE as WEB_DIR, BE as NODE_DIR, OUT as OUT_ROOT } from "./paths.mjs";
const OUT = `${OUT_ROOT}/invoice-flow`;
mkdirSync(OUT, { recursive: true });

process.env.TENANT_LEGACY_DEFAULT = "1"; // this process makes its first records through the models, as the test suites do
const requireWeb = createRequire(`${WEB_DIR}/package.json`);
const requireNode = createRequire(`${NODE_DIR}/package.json`);
const puppeteer = requireWeb("puppeteer");
const mongoose = requireNode("mongoose");
requireNode("dotenv").config({ path: `${NODE_DIR}/.env` });

const DB = `erp_ui_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const API_PORT = Number(process.env.E2E_API_PORT) || 3414;
const WEB_PORT = Number(process.env.E2E_WEB_PORT) || 5234;
const API = `http://localhost:${API_PORT}/api/v1`;
const WEB = `http://localhost:${WEB_PORT}`;
const uri = process.env.MONGO_URI.replace(/\/([^/?]*)\?/, `/${DB}?`);
if (!uri.includes(DB)) throw new Error("could not point at the throwaway database");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const step = async (name, fn) => {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${note ? `  (${note})` : ""}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log(`FAIL  ${name}\n      ${String(e.message).split("\n")[0]}`);
    throw e;
  }
};

let backend, vite, browser, page, token;
const children = [];
const logs = { api: "", web: "" };

async function shutdown() {
  try { await browser?.close(); } catch { /* gone */ }
  for (const c of children) {
    try { if (process.platform === "win32") spawn("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" }); else c.kill(); } catch { /* gone */ }
  }
  try {
    if (mongoose.connection.readyState === 1) {
      if (mongoose.connection.name !== DB) throw new Error("refusing to drop anything but the throwaway database");
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  } catch (e) { console.log("cleanup:", e.message); }
}

const api = async (method, url, body) => {
  const res = await fetch(`${API}${url}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  return { status: res.status, body: json?.data ?? json, raw: json };
};

// ---- page helpers -------------------------------------------------------------------------
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const textOf = () => page.evaluate(() => document.body.innerText);
const waitForText = (text, timeout = 60000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);

async function findButton(label, { scope = "document" } = {}) {
  const handle = await page.evaluateHandle((label, scope) => {
    const root = scope === "dialog" ? [...document.querySelectorAll('[role="dialog"]')].pop() : document;
    if (!root) return null;
    const want = new RegExp(label, "i");
    return [...root.querySelectorAll("button, a[href], [role='button']")].find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1 && !el.disabled && want.test(((el.getAttribute("aria-label") || "") + " " + (el.textContent || "")).trim());
    }) || null;
  }, label, scope);
  const el = handle.asElement();
  if (!el) throw new Error(`no button matching /${label}/ in ${scope}`);
  return el;
}
// A person's eye waits for the button to appear (the list refreshes just after it is asked for); so does this.
async function click(label, opts) {
  let el, last;
  for (let i = 0; i < 160 && !el; i++) {
    try { el = await findButton(label, opts); } catch (e) { last = e; await wait(250); }
  }
  if (!el) throw last;
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  await el.click();
}

// The text of the list row (table) or card that names this document, whichever the width drew.
const rowText = (no) => page.evaluate((no) => {
  const holder = [...document.querySelectorAll("tr, article, li")].find((el) => el.innerText?.includes(no));
  return holder ? holder.innerText : "";
}, no);

// Every "1,234.56" in a piece of text, as numbers.
const moneyIn = (text) => [...text.matchAll(/-?\d[\d,]*\.\d{2}/g)].map((m) => Number(m[0].replace(/,/g, "")));
// What the sheet prints as the grand total: the figure on the "Grand total" line.
const grandTotalOn = (text) => {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /grand total/i.test(l));
  if (i < 0) throw new Error(`the sheet has no Grand total line:\n${text.slice(0, 800)}`);
  // the figure is on that line, or on the next one when the label and the amount are separate cells
  const nums = moneyIn([lines[i], lines[i + 1] || ""].join(" "));
  if (!nums.length) throw new Error(`no figure beside "Grand total":\n${text.slice(0, 800)}`);
  return nums.at(-1);
};
// Go to a module and then one of its tabs, the way a person does: the rail, then the tab strip.
async function navigate(module, tab) {
  await click(`^${module}$`);
  if (tab) await click(`^${tab}$`);
  // A page is lazy and its list is a period of documents: the first visit compiles the chunk and reads a cold
  // index, which is slow enough on a new database that looking once would call a working screen broken.
  await page.waitForFunction(() => {
    const t = (document.querySelector("main")?.innerText || "").trim();
    return t.length > 0 && !/Loading$/i.test(t);
  }, { timeout: 90000 });
  await wait(900);
}

// ---- start everything ----------------------------------------------------------------------
async function boot() {
  backend = spawn(process.execPath, ["server.js"], { cwd: NODE_DIR, env: { ...process.env, MONGO_URI: uri, PORT: String(API_PORT), TENANT_LEGACY_DEFAULT: "0", ATTACHMENT_STORAGE: "disk", CORS_ORIGINS: `http://localhost:${WEB_PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
  backend.stdout.on("data", (d) => (logs.api += d));
  backend.stderr.on("data", (d) => (logs.api += d));
  children.push(backend);

  await mongoose.connect(uri);
  const M = {
    Admin: requireNode("./models/core/adminModel"),
    Customer: requireNode("./models/modules/customerModel"),
    Vendor: requireNode("./models/modules/vendorModel"),
    Stock: requireNode("./models/modules/stockModel"),
    Transaction: requireNode("./models/modules/transactionModel"),
  };
  await mongoose.connection.syncIndexes();
  for (let i = 0; ; i++) {
    // `ready` is false while the server builds a fresh database and adopts its first organisation (30 s or more)
    try { const h = await fetch(`${API}/health`); if (h.ok && (await h.json().catch(() => ({}))).ready !== false) break; } catch { /* not up */ }
    if (i > 300) throw new Error(`backend did not start\n${logs.api.slice(-800)}`);
    await wait(400);
  }
  await new M.Admin({ name: "Boss", email: "boss@test.uae", password: "12312312", type: "super_admin", status: "active", isActive: true }).save();
  const login = await api("POST", "/login", { email: "boss@test.uae", password: "12312312" });
  if (!login.body?.tokens?.accessToken) throw new Error(`the first sign-in failed: ${login.status} ${JSON.stringify(login.raw).slice(0, 300)}`);
  token = login.body.tokens.accessToken;
  await api("GET", "/accounting/chart");
  const cat = new mongoose.Types.ObjectId();
  const cust = await M.Customer.create({ customerId: "C1", customerName: "Hisham Traders", contactPerson: "Hisham", phone: "050 111 2222", billingAddress: "Al Quoz", paymentTerms: "Net 30" });
  const vend = await M.Vendor.create({ vendorId: "V1", vendorName: "Gulf Supply", contactPerson: "x", address: "y" });
  const car = await M.Stock.create({ itemId: "ITM1", sku: "FRO7588", itemName: "Fronz car", category: cat, salesPrice: 200, purchasePrice: 120 });
  const buy = await api("POST", "/transactions/transactions", { type: "purchase_order", partyId: vend._id, partyType: "Vendor", items: [{ itemId: car._id, description: "Fronz car", qty: 50, price: 120, rate: 120, vatPercent: 5 }] });
  await api("PATCH", `/transactions/transactions/${buy.body._id}/process`, { action: "approve" });

  vite = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "--port", String(WEB_PORT), "--strictPort"], {
    cwd: WEB_DIR, env: { ...process.env, VITE_API_URL: API }, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32",
  });
  vite.stdout.on("data", (d) => (logs.web += d));
  vite.stderr.on("data", (d) => (logs.web += d));
  children.push(vite);
  for (let i = 0; ; i++) {
    try { if ((await fetch(WEB)).ok) break; } catch { /* not up */ }
    if (i > 150) throw new Error(`vite did not start\n${logs.web.slice(-800)}`);
    await wait(400);
  }
  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-gpu", "--disable-extensions", "--disable-dev-shm-usage", "--renderer-process-limit=1", "--js-flags=--max-old-space-size=512"] });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.setDefaultTimeout(60000);
  const bad = [];
  page.on("pageerror", (e) => bad.push(`pageerror: ${e.message.split("\n")[0]}`));
  page.on("response", (r) => { if (r.url().includes("/api/v1") && r.status() >= 400 && !r.url().includes("/refresh-token")) bad.push(`api ${r.status()} ${new URL(r.url()).pathname}`); });
  page.on("console", (m) => { if (/Page crashed/i.test(m.text())) bad.push(`crash: ${m.text().slice(0, 200)}`); });
  page.__bad = bad;
  return { customer: cust, stock: car, Transaction: M.Transaction };
}

const S = {};

try {
  await step("start a throwaway backend and the real frontend", async () => { S.fx = await boot(); });

  await step("sign in the way a returning browser does", async () => {
    await page.goto(`${WEB}/`, { waitUntil: "networkidle2" });
    const status = await page.evaluate(async (api) => {
      const r = await fetch(`${api}/login`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "boss@test.uae", password: "12312312" }) });
      return r.status;
    }, API);
    if (status !== 200) throw new Error(`login answered ${status}`);
    await page.goto(`${WEB}/dashboard`, { waitUntil: "networkidle2" });
    if (new URL(page.url()).pathname === "/") throw new Error("the app did not restore the session");
  });

  // The document the owner showed: one line of 200, a header discount of 10, a courier charge of 60 -> 250.
  // And a plain one beside it, so a document with nothing in the header is pinned too.
  await step("a courier charge and a header discount on one invoice, a plain invoice beside it", async () => {
    const sale = async (body) => {
      const made = await api("POST", "/transactions/transactions", { type: "sales_order", partyId: S.fx.customer._id, partyType: "Customer", ...body });
      if (made.status !== 201) throw new Error("invoice: " + JSON.stringify(made.raw).slice(0, 300));
      const ok = await api("PATCH", `/transactions/transactions/${made.body._id}/process`, { action: "approve" });
      if (ok.status !== 200) throw new Error("approve: " + JSON.stringify(ok.raw).slice(0, 300));
      return made.body;
    };
    S.charged = await sale({
      items: [{ itemId: S.fx.stock._id, description: "Fronz car", qty: 1, price: 200, rate: 200, vatPercent: 0 }],
      discount: 10,
      charges: [{ description: "COURIER CHARGE", amount: 60, vatPercent: 0 }],
    });
    S.plain = await sale({ items: [{ itemId: S.fx.stock._id, description: "Fronz car", qty: 2, price: 100, rate: 100, vatPercent: 5 }] });
    // what the server itself says each one comes to: every figure below is compared with this, never with arithmetic done here
    const stored = async (id) => (await S.fx.Transaction.findById(id).lean()).pricing.grandTotal;
    S.charged.total = await stored(S.charged._id);
    S.plain.total = await stored(S.plain._id);
    if (S.charged.total !== 250) throw new Error(`the server priced the charged invoice at ${S.charged.total}, not 250`);
    if (S.plain.total !== 210) throw new Error(`the server priced the plain invoice at ${S.plain.total}, not 210`);
    return `${S.charged.transactionNo} = 250, ${S.plain.transactionNo} = 210`;
  });

  // The page opens on its Overview (the figures and the newest few); the rows are behind the table toggle.
  const invoiceList = async () => {
    await navigate("Sales", "Invoices");
    await click("Table view");
    await waitForText(S.charged.transactionNo);
  };

  await step("the Invoices list shows what the server priced", async () => {
    await invoiceList();
    await shot("10-invoices-list");
    for (const doc of [S.charged, S.plain]) {
      const text = await rowText(doc.transactionNo);
      const money = moneyIn(text);
      if (!money.includes(doc.total)) throw new Error(`the row for ${doc.transactionNo} should carry ${doc.total.toFixed(2)}:\n${text}`);
    }
  });

  // Opening a document from a row is the door the owner used, and the one that was wrong: the row is what the sheet is
  // built from, so anything the list leaves out simply is not on the paper.
  const openFromList = async (doc) => {
    await click(`View ${doc.transactionNo}`);
    await waitForText("Back to list");
    await waitForText(doc.transactionNo);
    return textOf();
  };

  await step("opening it from the row prints the charge, the discount and the same total", async () => {
    const text = await openFromList(S.charged);
    await shot("11-invoice-with-charge");
    // the sheet's own headings are drawn in capitals (CSS), so read it the way a person does: without case
    for (const want of ["courier charge", "net amount", "discount", "amount in words"]) {
      if (!text.toLowerCase().includes(want)) throw new Error(`the sheet should print "${want}":\n${text.slice(0, 1200)}`);
    }
    const printed = grandTotalOn(text);
    if (printed !== S.charged.total) throw new Error(`the sheet printed ${printed}, the server priced it ${S.charged.total}`);
    if (!/60\.00/.test(text)) throw new Error("the courier charge is not on the sheet");
    if (!/Two Hundred Fifty/i.test(text)) throw new Error(`the amount in words does not follow the total:\n${text.split("\n").find((l) => /Only/i.test(l))}`);
    return `printed ${printed.toFixed(2)}`;
  });

  await step("Back to list returns to the list, with the rows still on it", async () => {
    await click("Back to list");
    await waitForText(S.plain.transactionNo);
    if (!(await rowText(S.charged.transactionNo))) throw new Error("the list came back without its rows");
    await shot("12-back-to-list");
  });

  await step("the plain invoice, with nothing in its header, reads the same way", async () => {
    const text = await openFromList(S.plain);
    const printed = grandTotalOn(text);
    if (printed !== S.plain.total) throw new Error(`the sheet printed ${printed}, the server priced it ${S.plain.total}`);
    if (/COURIER/i.test(text)) throw new Error("the other invoice's charge is on this one");
    await click("Back to list");
    await waitForText(S.charged.transactionNo);
    return `printed ${printed.toFixed(2)}`;
  });

  await step("Home, then back to Invoices: the document still reads the same", async () => {
    await navigate("Home", "Dashboard");
    if (new URL(page.url()).pathname !== "/dashboard") throw new Error(`Home went to ${new URL(page.url()).pathname}`);
    await shot("13-home");
    await invoiceList();
    const text = await openFromList(S.charged);
    const printed = grandTotalOn(text);
    if (printed !== S.charged.total) throw new Error(`after Home and back the sheet printed ${printed}, not ${S.charged.total}`);
    if (!text.includes("COURIER CHARGE")) throw new Error("after Home and back the charge is missing from the sheet");
    await shot("14-invoice-after-home");
  });

  // The in-app "Back to list" and the browser's own Back are not the same thing: which document is open is view state on
  // the page, not part of the address, so the browser's Back leaves the page altogether. That is not a fault, but it must
  // land somewhere real - never a blank window or the sign-in page.
  await step("the browser's own Back from an open document lands on a real page", async () => {
    const before = new URL(page.url()).pathname;
    await page.goBack({ waitUntil: "networkidle2" });
    await wait(1200);
    const after = new URL(page.url()).pathname;
    const railStill = await page.evaluate(() => Boolean(document.querySelector('nav[aria-label="Main"]')));
    const text = await textOf();
    if (after === "/") throw new Error("the browser's Back dropped the person at the sign-in page");
    if (!railStill) throw new Error(`the menu disappeared on ${after}`);
    if (text.trim().length < 40) throw new Error(`${after} came back blank`);
    if (/Something went wrong on this page/.test(text)) throw new Error(`${after} showed the page error screen`);
    await shot("15-browser-back");
    return `${before} -> ${after} (the list's own view state is not in the address)`;
  });

  await step("reloading on an open document comes back to its list, not to nothing", async () => {
    await invoiceList();
    await openFromList(S.charged);
    await page.reload({ waitUntil: "networkidle2" });
    await waitForText(S.charged.transactionNo);
    const text = await textOf();
    if (/Something went wrong on this page/.test(text)) throw new Error("a reload on the document showed the error screen");
    await shot("16-after-reload");
    return "the list, with its rows";
  });

  await step("no page error and no failed request anywhere in the run", async () => {
    const bad = [...new Set(page.__bad)];
    if (bad.length) throw new Error(bad.join(" | "));
  });
} catch (e) {
  console.log("\nstopped:", String(e.message).split("\n")[0]);
  try { await shot("zz-failure"); console.log("page text at failure:\n" + (await textOf()).slice(0, 700)); } catch (e2) { console.log("could not capture the page:", String(e2.message).split("\n")[0]); }
  if (page?.__bad?.length) console.log("browser/API problems:", [...new Set(page.__bad)].join(" | "));
  if (logs.api) console.log("backend tail:\n" + logs.api.slice(-600));
} finally {
  await shutdown();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
