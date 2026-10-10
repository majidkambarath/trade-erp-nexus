// End to end: the real frontend (Vite) driving the real backend (own throwaway database) in a real browser.
// Run it with `npm run e2e -- sales-docs` (see e2e/README.md). It catches what fixtures cannot: the two sides disagreeing about a shape.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { FE as WEB_DIR, BE as NODE_DIR, OUT as OUT_ROOT } from "./paths.mjs";
const OUT = `${OUT_ROOT}/sales-docs`;
mkdirSync(OUT, { recursive: true });

const requireWeb = createRequire(`${WEB_DIR}/package.json`);
const requireNode = createRequire(`${NODE_DIR}/package.json`);
const puppeteer = requireWeb("puppeteer");
const mongoose = requireNode("mongoose");
requireNode("dotenv").config({ path: `${NODE_DIR}/.env` });

const DB = `erp_ui_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const API_PORT = Number(process.env.E2E_API_PORT) || 3411;
// A port nothing else uses: another Vite can already hold 5173 on the other address family, and the
// browser would then land on it half the time. The backend is told to allow this origin.
const WEB_PORT = Number(process.env.E2E_WEB_PORT) || 5231;
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
  // npx and cmd leave the real server as a grandchild, so the whole tree goes
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
const waitForText = (text, timeout = 30000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
const waitGone = (text, timeout = 30000) => page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout }, text);

// A visible button whose text matches. `scope` narrows to the open dialog.
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
// A person's eye waits for the button to appear (the screen refreshes just after a toast); so does this.
async function click(label, opts) {
  let el, last;
  for (let i = 0; i < 40 && !el; i++) {
    try { el = await findButton(label, opts); } catch (e) { last = e; await wait(250); }
  }
  if (!el) throw last;
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  await el.click();
}
async function typeIn(selector, text, { clear = true } = {}) {
  await page.waitForSelector(selector, { visible: true, timeout: 20000 });
  // select() works in number fields, where a triple-click does not select anything
  if (clear) { await page.focus(selector); await page.$eval(selector, (el) => el.select?.()); await page.keyboard.press("Backspace"); }
  await page.type(selector, text);
}
// A react-select: open it, type, take the first match.
async function pick(inputSelector, text) {
  await page.waitForSelector(inputSelector, { visible: true, timeout: 20000 });
  await page.click(inputSelector);
  await page.type(inputSelector, text);
  await page.waitForSelector('[class*="option"], [id*="-option-"]', { visible: true, timeout: 20000 });
  await wait(250);
  await page.keyboard.press("Enter");
  await wait(300);
}
const dialogText = () => page.evaluate(() => ([...document.querySelectorAll('[role="dialog"]')].pop()?.innerText || ""));

// ---- start everything ----------------------------------------------------------------------
async function boot() {
  backend = spawn(process.execPath, ["server.js"], { cwd: NODE_DIR, env: { ...process.env, MONGO_URI: uri, PORT: String(API_PORT), CORS_ORIGINS: `http://localhost:${WEB_PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
  backend.stdout.on("data", (d) => (logs.api += d));
  backend.stderr.on("data", (d) => (logs.api += d));
  children.push(backend);

  await mongoose.connect(uri);
  const M = {
    Admin: requireNode("./models/core/adminModel"),
    Customer: requireNode("./models/modules/customerModel"),
    Vendor: requireNode("./models/modules/vendorModel"),
    Stock: requireNode("./models/modules/stockModel"),
  };
  await mongoose.connection.syncIndexes();
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${API}/health`)).ok) break; } catch { /* not up */ }
    if (i > 150) throw new Error(`backend did not start\n${logs.api.slice(-800)}`);
    await wait(400);
  }
  await new M.Admin({ name: "Boss", email: "boss@test.uae", password: "12312312", type: "super_admin", status: "active", isActive: true }).save();
  const login = await api("POST", "/login", { email: "boss@test.uae", password: "12312312" });
  token = login.body.tokens.accessToken;
  await api("GET", "/accounting/chart");
  const cat = new mongoose.Types.ObjectId();
  const cust = await M.Customer.create({ customerId: "C1", customerName: "Al Noor Grocery", contactPerson: "Ali Hassan", phone: "050 111 2222", shippingAddress: "Warehouse 4, Al Quoz", paymentTerms: "Net 30" });
  const vend = await M.Vendor.create({ vendorId: "V1", vendorName: "Gulf Supply", contactPerson: "x", address: "y" });
  const rice = await M.Stock.create({ itemId: "ITM1", sku: "SKU1", itemName: "Basmati Rice 5kg", category: cat, salesPrice: 20, purchasePrice: 10 });
  const buy = await api("POST", "/transactions/transactions", { type: "purchase_order", partyId: vend._id, partyType: "Vendor", items: [{ itemId: rice._id, description: "Basmati Rice 5kg", qty: 500, price: 10, rate: 10, vatPercent: 5 }] });
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
  // light on memory: the machine is shared with an editor and a browser
  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-gpu", "--disable-extensions", "--disable-dev-shm-usage", "--renderer-process-limit=1", "--js-flags=--max-old-space-size=512"] });
  page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  page.setDefaultTimeout(30000);
  const bad = [];
  page.on("pageerror", (e) => bad.push(`pageerror: ${e.message.split("\n")[0]}`));
  page.on("response", (r) => { if (r.url().includes("/api/v1") && r.status() >= 400 && !r.url().includes("/refresh-token")) bad.push(`api ${r.status()} ${new URL(r.url()).pathname}`); });
  page.__bad = bad;
  page.__console = [];
  page.on("console", (m) => page.__console.push(m.type() + ": " + m.text().slice(0, 300)));
  return { customer: cust, stock: rice };
}

const S = {};

try {
  await step("start a throwaway backend and the real frontend", async () => { S.fx = await boot(); });

  await step("sign in: the session cookie is set, and the app restores the session on load", async () => {
    // The real login form was exercised separately; here the session is established the way a returning
    // user's browser has it (an httpOnly cookie), and the app must restore it itself through /refresh-token.
    await page.goto(`${WEB}/`, { waitUntil: "networkidle2" });
    const status = await page.evaluate(async (api) => {
      const r = await fetch(`${api}/login`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "boss@test.uae", password: "12312312" }) });
      return r.status;
    }, API);
    if (status !== 200) throw new Error(`login answered ${status}`);
    await page.goto(`${WEB}/dashboard`, { waitUntil: "networkidle2" });
    if (new URL(page.url()).pathname === "/") throw new Error("the app did not restore the session from the cookie");
    await waitForText("Zarvia");
    return page.url().replace(WEB, "");
  });

  // ======================================= quotation =======================================
  await step("quotations: the empty list loads from the real server", async () => {
    await page.goto(`${WEB}/quotations`, { waitUntil: "networkidle2" });
    await waitForText("No quotations yet");
    await shot("01-quotations-empty");
  });

  await step("write a quotation in the real order form and save it", async () => {
    await click("^new quotation");
    await waitForText("Create quotation");
    await pick('input[id$="-partyId"]', "Al Noor");
    await pick("#item-0", "Basmati");
    await typeIn('[aria-label="Qty, row 1"]', "10");
    await typeIn('input[id$="-reference"]', "RFQ-77", { clear: true });
    await shot("02-quotation-form");
    await click("^save quotation");
    await waitForText("QT-2026-0001");
    await waitForText("210.00"); // 10 x 20 + 5% VAT, priced by the server
    S.quoteNo = (await textOf()).match(/QT-\d{4}-\d{4}/)[0];
    await shot("03-quotation-document");
    return S.quoteNo;
  });

  await step("the server priced it: 10 x 20 + 5% = 210, on its own QT series", async () => {
    const list = await api("GET", "/quotations");
    const q = list.body.find((x) => x.quotationNo === S.quoteNo);
    if (!q) throw new Error("not in the list");
    S.quoteId = q._id;
    if (q.totalAmount !== 210) throw new Error(`total ${q.totalAmount}`);
    if (q.status !== "DRAFT") throw new Error(`status ${q.status}`);
    if (q.reference !== "RFQ-77") throw new Error(`reference ${q.reference}`);
  });

  await step("mark as sent, then accept it", async () => {
    await click("^mark as sent");
    await waitForText("not available yet"); // the honest note about email
    await click("^mark as sent$", { scope: "dialog" });
    await waitForText("marked as sent");
    await waitForText("Sent");
    await click("^accept$");
    await typeIn('[role="dialog"] input', "Mr Ali, LPO 991");
    await click("record acceptance", { scope: "dialog" });
    await waitForText("Accepted by Mr Ali, LPO 991");
    await shot("04-quotation-accepted");
  });

  await step("convert it to a sales order: one draft order, the offer is spent", async () => {
    await click("^convert to sales order");
    await waitForText("Nothing moves in stock or the ledger");
    await click("create sales order", { scope: "dialog" });
    await waitForText("created from " + S.quoteNo);
    const orders = (await api("GET", "/transactions/transactions?type=sales_order")).body;
    const so = orders.find((o) => o.quoteRef === S.quoteNo);
    if (!so) throw new Error("no sales order carries the quotation number");
    if (so.status !== "DRAFT") throw new Error(`order is ${so.status}`);
    if (so.totalAmount !== 210) throw new Error(`order total ${so.totalAmount}`);
    S.order = so;
    const q = (await api("GET", `/quotations/${S.quoteId}`)).body;
    if (q.status !== "CONVERTED" || q.convertedTo.no !== so.transactionNo) throw new Error("quotation not marked converted");
    await waitForText("Became " + so.transactionNo);
    await shot("05-quotation-converted");
    return so.transactionNo;
  });

  await step("the sales order list opens narrowed to the order the quotation made", async () => {
    await page.goto(`${WEB}/sales-order?search=${S.order.transactionNo}`, { waitUntil: "networkidle2" });
    await waitForText(S.order.transactionNo);
    await shot("06-sales-order-narrowed");
  });

  // =============================== delivery note against the order ===============================
  await step("from the order's row menu, start a delivery note against it", async () => {
    // the menu opens on hover/focus; the item is in the DOM either way
    await page.evaluate(() => {
      const item = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Delivery note");
      if (!item) throw new Error("no 'Delivery note' item in the row menu");
      item.click();
    });
    await waitForText("Delivery note against a sales order");
    await waitForText("What goes on this note");
    await shot("07-dn-against-order");
    return page.url().replace(WEB, "");
  });

  await step("deliver part of the order: 6 of 10, with the order's own price", async () => {
    await typeIn('[aria-label="Quantity of Basmati Rice 5kg on this note"]', "6");
    await click("^save delivery note");
    await waitForText("DLN-2026-0001");
    S.dnNo = "DLN-2026-0001";
    const dn = (await api("GET", "/delivery-notes")).body[0];
    S.dnId = dn._id;
    if (dn.totalAmount !== 126) throw new Error(`value ${dn.totalAmount}`); // 6 x 20 + 5%
    if (dn.source.no !== S.order.transactionNo) throw new Error("not against the order");
    if (dn.invoiceStatus !== "DRAFT") throw new Error(`invoice state ${dn.invoiceStatus}`);
    await shot("08-dn-document");
  });

  await step("a second note against the same order starts from what is left, and refuses more", async () => {
    await page.goto(`${WEB}/delivery-notes?order=${S.order._id}`, { waitUntil: "networkidle2" });
    await waitForText("What goes on this note");
    const sel = '[aria-label="Quantity of Basmati Rice 5kg on this note"]';
    // 10 ordered, 6 already on the first note: 4 left, and the field starts there
    await page.waitForSelector(sel, { timeout: 30000 });
    const start = await page.$eval(sel, (i) => i.value);
    if (start !== "4") throw new Error(`the quantity starts at ${start}, expected 4`);
    await typeIn(sel, "5");
    await click("^save delivery note");
    await waitForText("Only 4 is left on the order");
    const notes = (await api("GET", "/delivery-notes")).body;
    if (notes.length !== 1) throw new Error(`a second note was saved (${notes.length} notes)`);
    await shot("08b-over-delivery-refused");
  });

  await step("dispatch it with a vehicle and driver", async () => {
    await page.goto(`${WEB}/delivery-notes?open=${S.dnId}`, { waitUntil: "networkidle2" });
    await waitForText(S.dnNo);
    await click("^dispatch");
    const inputs = await page.$$('[role="dialog"] input');
    await inputs[0].type("DXB A 12345");
    await inputs[1].type("Raju");
    await click("^dispatch$", { scope: "dialog" });
    await waitForText("On the road");
    await shot("09-dn-dispatched");
  });

  await step("confirm delivery: 5 of 6 accepted, who signed, and why one was short", async () => {
    await click("^mark delivered");
    await waitForText("Confirm delivery of");
    await typeIn('[role="dialog"] input[data-autofocus], [role="dialog"] input', "Store keeper", { clear: false });
    await typeIn('[role="dialog"] input[type="number"]', "5");
    await page.type('[aria-label="Reason for the shortage of Basmati Rice 5kg"]', "1 bag torn");
    await shot("10-dn-deliver-dialog");
    await click("^mark delivered$", { scope: "dialog" });
    await waitGone("Confirm delivery of");
    // the screen has caught up when the status pill reads Delivered; then read the server's own record
    await waitForText("Delivered");
    const dn = (await api("GET", `/delivery-notes/${S.dnId}`)).body;
    if (dn.status !== "DELIVERED") throw new Error(`status ${dn.status}`);
    if (dn.items[0].deliveredQty !== 5) throw new Error(`delivered ${dn.items[0].deliveredQty}`);
    if (dn.totalAmount !== 105) throw new Error(`value ${dn.totalAmount}`); // worth what was accepted: 5 x 20 + 5%
    if (dn.receivedBy !== "Store keeper") throw new Error(`receivedBy ${dn.receivedBy}`);
    if (!dn.clock) throw new Error("no invoice clock on a delivered, uninvoiced note");
    await waitForText("left to invoice");
    await shot("11-dn-delivered-clock");
    return dn.clock.clock;
  });

  await step("approving the order is what invoices the goods: the note closes and the clock stops", async () => {
    const before = (await api("GET", "/stock/stock")).body;
    const stockBefore = (before.stocks || before)[0].currentStock;
    const r = await api("PATCH", `/transactions/transactions/${S.order._id}/process`, { action: "approve" });
    if (r.status !== 200) throw new Error(`approve ${r.status} ${JSON.stringify(r.raw).slice(0, 200)}`);
    const after = (await api("GET", "/stock/stock")).body;
    const stockAfter = (after.stocks || after)[0].currentStock;
    if (stockBefore - stockAfter !== 10) throw new Error(`stock moved ${stockBefore - stockAfter}, expected the order's 10`);
    await page.reload({ waitUntil: "networkidle2" });
    await waitForText("approved and invoiced");
    const text = await textOf();
    if (text.includes("left to invoice")) throw new Error("the clock is still running on an invoiced note");
    await shot("12-dn-invoiced");
    return `stock -${stockBefore - stockAfter}`;
  });

  // =============================== delivery first, invoice after ===============================
  const makeLooseNote = async (qty) => {
    await page.goto(`${WEB}/delivery-notes`, { waitUntil: "networkidle2" });
    await waitForText("Delivery notes");
    await click("^new delivery note");
    await waitForText("How are these goods being sent");
    await click("^on its own");
    await waitForText("Create delivery note");
    await pick('input[id$="-partyId"]', "Al Noor");
    await pick("#item-0", "Basmati");
    await typeIn('[aria-label="Qty, row 1"]', String(qty));
    await click("^save delivery note");
    await waitForText("DLN-2026-");
    return (await textOf()).match(/DLN-\d{4}-\d{4}/g).pop();
  };
  const deliverOpenNote = async () => {
    await click("^mark delivered");
    await waitForText("Confirm delivery of");
    await typeIn('[role="dialog"] input', "Ali", { clear: false });
    await click("^mark delivered$", { scope: "dialog" });
    await waitGone("Confirm delivery of");
    await wait(600);
  };

  await step("a note on its own, made in the real form, and signed for", async () => {
    S.n1 = await makeLooseNote(4);
    await shot("13-loose-note-form-saved");
    await deliverOpenNote();
    return S.n1;
  });

  await step("a second one, so a month's deliveries can go on one invoice", async () => {
    S.n2 = await makeLooseNote(3);
    await deliverOpenNote();
    return S.n2;
  });

  await step("the Not invoiced tab lists both with their 14-day clock", async () => {
    await page.goto(`${WEB}/delivery-notes?status=UNINVOICED`, { waitUntil: "networkidle2" });
    await waitForText(S.n1);
    await waitForText(S.n2);
    const t = await textOf();
    if (!/left to invoice|Invoice due/.test(t)) throw new Error("no clock shown");
    await shot("14-not-invoiced-tab");
  });

  await step("tick both and invoice them together: one draft order at the quantities accepted", async () => {
    const boxes = await page.$$('input[type="checkbox"][aria-label^="Select DLN"]');
    if (boxes.length < 2) throw new Error(`only ${boxes.length} selectable`);
    for (const b of boxes) await b.click();
    await waitForText("2 selected");
    await shot("15-two-selected");
    await click("^create invoice");
    await waitForText("Invoice 2 delivery notes");
    await click("create sales order", { scope: "dialog" });
    await waitForText("created from 2 delivery notes");
    const orders = (await api("GET", "/transactions/transactions?type=sales_order&status=DRAFT")).body;
    const so = orders.find((o) => (o.linkedRef || "").includes(S.n1) && (o.linkedRef || "").includes(S.n2));
    if (!so) throw new Error("no draft order links both notes");
    if (so.totalAmount !== 147) throw new Error(`invoice total ${so.totalAmount}`); // (4 + 3) x 20 + 5%
    const notes = (await api("GET", "/delivery-notes?limit=50")).body.filter((n) => [S.n1, S.n2].includes(n.deliveryNoteNo));
    if (!notes.every((n) => n.invoiceStatus === "DRAFT" && n.invoice?.no === so.transactionNo)) throw new Error("notes not linked to the new invoice");
    await shot("16-consolidated");
    return `${so.transactionNo} = ${so.totalAmount}`;
  });

  // =========================== the customer profile: the flow of each deal ===========================
  await step("the customer's Documents tab: the server's deals, opening on what needs doing", async () => {
    const id = S.fx.customer._id;
    const flow = (await api("GET", `/document-flow/customer/${id}`)).body;
    if (flow.chains.length !== 2) throw new Error(`expected 2 deals, the server sent ${flow.chains.length}`);
    await page.goto(`${WEB}/credit-accounts/customer/${id}?tab=documents`, { waitUntil: "networkidle2" });
    await waitForText("Out with the customer");
    await waitForText("Needs action");
    const t = await textOf();
    // deal 2: two loose notes put on one draft invoice - goods first, so no separate order step
    for (const want of [S.n1, S.n2, "Draft invoice", "Approve the invoice", "Delivery"]) if (!t.includes(want)) throw new Error(`missing "${want}"`);
    // deal 1: invoiced, but only 5 of the 10 bags have gone out (4 never sent, 1 torn): not finished
    for (const want of ["Still to deliver: 5 x Basmati Rice 5kg", "Deliver the rest"]) if (!t.includes(want)) throw new Error(`the part-delivered deal should say "${want}"`);
    const rest = flow.chains.find((c) => c.order?._id === S.order._id);
    if (!rest || rest.delivery?.complete !== false || rest.delivery.remaining[0]?.qty !== 5) throw new Error(`server delivery state: ${JSON.stringify(rest?.delivery)}`);
    // both deals are on the list now (the part-delivered one needs the rest sent), so look at the goods-first card alone
    const goodsFirst = await page.$$eval('article[aria-label^="Draft invoice"] ol[aria-label="Steps of this deal"] > li', (els) => els.map((e) => e.innerText));
    if (goodsFirst.length !== 3) throw new Error(`a goods-first deal reads Quotation, Delivery, Invoice (3 steps); found ${goodsFirst.length}`);
    await shot("17-profile-documents-needs-action");
    // the part-delivered deal, below the fold: once at desktop width and once on a phone
    const showPartCard = () => page.evaluate(() => [...document.querySelectorAll("article")].find((a) => a.innerText.includes("Deliver the rest"))?.scrollIntoView({ block: "center" }));
    await showPartCard(); await wait(300); await shot("17c-part-delivered-desktop");
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${WEB}/credit-accounts/customer/${id}?tab=documents`, { waitUntil: "networkidle2" });
    await waitForText("Deliver the rest");
    await showPartCard(); await wait(400); await shot("17d-part-delivered-phone");
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(`${WEB}/credit-accounts/customer/${id}?tab=documents`, { waitUntil: "networkidle2" });
    await waitForText("Needs action");
    return "2 deals";
  });

  await step("a short delivery is not Done: the button leads to a note that starts from what is left", async () => {
    await click("^deliver the rest");
    await page.waitForFunction((id) => location.pathname === "/delivery-notes" && location.search.includes("order=" + id), { timeout: 30000 }, S.order._id);
    await waitForText("What goes on this note");
    const sel = '[aria-label="Quantity of Basmati Rice 5kg on this note"]';
    await page.waitForSelector(sel, { timeout: 30000 }); // the heading shows before the lines do
    const start = await page.$eval(sel, (i) => i.value);
    if (start !== "5") throw new Error(`the second delivery starts at ${start}, expected 5`);
    await click("^save delivery note");
    await waitForText("DLN-2026-"); // it is the fourth note of the run (two loose ones came first), so read its number, do not guess it
    const second = (await api("GET", "/delivery-notes")).body.find((n) => n.source?.no === S.order.transactionNo && n.deliveryNoteNo !== S.dnNo);
    if (!second) throw new Error("the second note is not against the order");
    S.dn2Id = second._id;
    S.dn2No = second.deliveryNoteNo;
    await shot("17b-deliver-the-rest");
    return start + " left";
  });

  await step("the rest goes out and is signed for: the deal moves to Done and reads in full", async () => {
    let r = await api("POST", `/delivery-notes/${S.dn2Id}/dispatch`, { vehicleNo: "DXB A 12345", driverName: "Raju" });
    if (r.status !== 200) throw new Error(`dispatch ${r.status} ${JSON.stringify(r.raw).slice(0, 200)}`);
    r = await api("POST", `/delivery-notes/${S.dn2Id}/deliver`, { receivedBy: "Store keeper" });
    if (r.status !== 200) throw new Error(`deliver ${r.status} ${JSON.stringify(r.raw).slice(0, 200)}`);
    const flow = (await api("GET", `/document-flow/customer/${S.fx.customer._id}`)).body;
    const deal = flow.chains.find((c) => c.order?._id === S.order._id);
    if (!deal.delivery.complete || deal.delivery.remaining.length) throw new Error(`still not complete: ${JSON.stringify(deal.delivery)}`);
    await page.goto(`${WEB}/credit-accounts/customer/${S.fx.customer._id}?tab=documents`, { waitUntil: "networkidle2" });
    await waitForText("Needs action");
    await click("^done");
    await waitForText(S.quoteNo);
    const t = await textOf();
    for (const want of [S.order.transactionNo, S.dnNo, S.dn2No, "Tax invoice", "Quotation", "Sales order", "Delivery", "Invoice", "Converted", "Approved"]) {
      if (!t.includes(want)) throw new Error(`missing "${want}" in the finished deal`);
    }
    if (t.includes("Still to deliver")) throw new Error("a finished deal should not say there is more to deliver");
    if (t.includes("Next:")) throw new Error("a finished deal should have nothing next");
    await shot("18-profile-documents-done");
  });

  await step("the next-step button goes to where it is done", async () => {
    await click("^in progress|^needs action");
    await click("^needs action");
    await waitForText("Approve the invoice");
    await click("^approve the invoice");
    await page.waitForFunction(() => location.pathname === "/sales-order", { timeout: 30000 });
    await waitForText("SO-2026-0002");
    return page.url().replace(WEB, "");
  });

  await step("on a phone the deals stack and nothing runs off the screen", async () => {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${WEB}/credit-accounts/customer/${S.fx.customer._id}?tab=documents`, { waitUntil: "networkidle2" });
    await waitForText("Needs action");
    await wait(600);
    const o = await page.evaluate(() => {
      const pane = document.querySelector("main") || document.documentElement;
      return { sw: pane.scrollWidth, cw: pane.clientWidth, steps: document.querySelectorAll('ol[aria-label="Steps of this deal"] > li').length };
    });
    await page.evaluate(() => document.querySelector('ol[aria-label="Steps of this deal"]')?.scrollIntoView({ block: "center" }));
    await wait(300);
    await shot("19-profile-documents-phone");
    if (o.sw > o.cw + 4) throw new Error(`the page scrolls sideways: ${o.sw} > ${o.cw}`);
    if (o.steps < 3) throw new Error(`steps missing: ${o.steps}`);
    await page.setViewport({ width: 1440, height: 1000 });
    return `${o.steps} steps, no overflow`;
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
