// End to end: the real frontend (Vite) driving the real backend (own throwaway database) in a real browser.
// Run it with `npm run e2e -- close-short` (see e2e/README.md). It catches what fixtures cannot: the two sides disagreeing about a shape.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { FE as WEB_DIR, BE as NODE_DIR, OUT as OUT_ROOT } from "./paths.mjs";
const OUT = `${OUT_ROOT}/close-short`;
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

  // two orders of 10 bags; 6 delivered on each; the customer will not take the other 4
  const partDelivered = async (approve) => {
    const made = await api("POST", "/transactions/transactions", { type: "sales_order", partyId: S.fx.customer._id, partyType: "Customer", items: [{ itemId: S.fx.stock._id, description: "Basmati Rice 5kg", qty: 10, price: 20, rate: 20, vatPercent: 5 }] });
    if (made.status !== 201) throw new Error("order: " + JSON.stringify(made.raw));
    const order = made.body;
    const note = await api("POST", "/delivery-notes", { sourceTransactionId: order._id, items: [{ sourceLineId: order.items[0]._id, qty: 6 }] });
    if (note.status !== 201) throw new Error("note: " + JSON.stringify(note.raw));
    await api("POST", `/delivery-notes/${note.body._id}/dispatch`, { vehicleNo: "DXB A 1" });
    const done = await api("POST", `/delivery-notes/${note.body._id}/deliver`, { receivedBy: "Store keeper" });
    if (done.status !== 200) throw new Error("deliver: " + JSON.stringify(done.raw));
    if (approve) {
      const ok = await api("PATCH", `/transactions/transactions/${order._id}/process`, { action: "approve" });
      if (ok.status !== 200) throw new Error("approve: " + JSON.stringify(ok.raw));
    }
    return order;
  };
  const deals = () => page.goto(`${WEB}/credit-accounts/customer/${S.fx.customer._id}?tab=documents`, { waitUntil: "networkidle2" });
  const dealCard = (no) => page.evaluateHandle((no) => [...document.querySelectorAll("article")].find((a) => a.innerText.includes(no)) || null, no);
  const inCard = async (no, label) => {
    const card = (await dealCard(no)).asElement();
    if (!card) throw new Error(`no deal card for ${no}`);
    const btn = await card.evaluateHandle((c, label) => [...c.querySelectorAll("button, a")].find((b) => new RegExp(label, "i").test(b.textContent)) || null, label);
    const el = btn.asElement();
    if (!el) throw new Error(`no "${label}" in ${no}`);
    return el;
  };
  const cardText = async (no) => (await dealCard(no)).asElement().evaluate((c) => c.innerText);
  const showCard = async (no) => {
    await page.evaluate((no) => [...document.querySelectorAll("article")].find((a) => a.innerText.includes(no))?.scrollIntoView({ block: "center" }), no);
    await wait(300);
  };

  await step("set up a draft order and an invoiced order, each 6 of 10 delivered", async () => {
    S.draft = await partDelivered(false);
    S.invoiced = await partDelivered(true);
    return `${S.draft.transactionNo}, ${S.invoiced.transactionNo}`;
  });

  await step("the Documents tab offers Close order short beside Deliver the rest", async () => {
    await deals();
    await waitForText("Deliver the rest");
    for (const no of [S.draft.transactionNo, S.invoiced.transactionNo]) {
      await inCard(no, "close order short");
      await inCard(no, "deliver the rest");
    }
    await showCard(S.draft.transactionNo);
    await shot("20-deal-part-delivered");
  });

  await step("the dialog shows what fell short and what will happen, and will not go on without a reason", async () => {
    await (await inCard(S.draft.transactionNo, "close order short")).click();
    await waitForText(`Close ${S.draft.transactionNo} short`);
    await waitForText("NOT DELIVERED");
    const t = await dialogText();
    for (const want of ["Basmati Rice 5kg", "10", "6", "4", "cut down to what was delivered", "AED 210.00 to AED 126.00", "Why will the rest not be delivered?"]) {
      if (!t.includes(want)) throw new Error(`the dialog should say "${want}":\n${t}`);
    }
    const disabled = await page.evaluate(() => {
      const d = [...document.querySelectorAll('[role="dialog"]')].pop();
      const b = [...d.querySelectorAll("button")].find((x) => /^close order short$/i.test(x.textContent.trim()));
      return b ? b.disabled : null;
    });
    await shot("21-close-short-dialog");
    if (disabled !== true) throw new Error("the confirm button must wait for a reason");
  });

  await step("a reason in one tap, then it closes: the deal reads Closed short and moves on to the invoice", async () => {
    await click("^customer found another supplier$", { scope: "dialog" });
    await shot("22-close-short-reason");
    await click("^close order short$", { scope: "dialog" });
    await waitForText(`${S.draft.transactionNo} closed short`);
    await waitGone(`Close ${S.draft.transactionNo} short`);
    await wait(800);
    const t = await cardText(S.draft.transactionNo);
    for (const want of ["Closed short", "4 x Basmati Rice 5kg will not be delivered", "Customer found another supplier", "cut down to what was delivered", "Approve the order to invoice it", "Reopen"]) {
      if (!t.includes(want)) throw new Error(`the closed deal should say "${want}":\n${t}`);
    }
    if (t.includes("Deliver the rest")) throw new Error("a closed order must not still offer to deliver the rest");
    await showCard(S.draft.transactionNo);
    await shot("23-deal-closed-short-draft");
    const o = (await api("GET", `/transactions/transactions/${S.draft._id}`)).body.transaction;
    if (o.totalAmount !== 126 || o.items[0].qty !== 6) throw new Error(`the order should be 6 bags, 126.00: ${o.items[0].qty} / ${o.totalAmount}`);
    if (String(o.items[0]._id) !== String(S.draft.items[0]._id)) throw new Error("the line lost its id");
  });

  await step("reopening puts the order back to 10 bags", async () => {
    await (await inCard(S.draft.transactionNo, "^reopen$")).click();
    await waitForText(`Reopen ${S.draft.transactionNo}`);
    await shot("24-reopen-dialog");
    await click("^reopen order$", { scope: "dialog" });
    await waitForText(`${S.draft.transactionNo} reopened`);
    await wait(800);
    const t = await cardText(S.draft.transactionNo);
    if (!t.includes("Deliver the rest") || t.includes("Closed short")) throw new Error(`the order should be open again:\n${t}`);
    const o = (await api("GET", `/transactions/transactions/${S.draft._id}`)).body.transaction;
    if (o.totalAmount !== 210 || o.items[0].qty !== 10) throw new Error(`the order should be back at 10 bags, 210.00: ${o.items[0].qty} / ${o.totalAmount}`);
  });

  await step("an invoiced order: the dialog says it is left alone, and the deal then asks for a sales return", async () => {
    const stockBefore = (await api("GET", "/stock/stock")).body;
    S.stockBefore = JSON.stringify(stockBefore).length;
    await (await inCard(S.invoiced.transactionNo, "close order short")).click();
    await waitForText(`Close ${S.invoiced.transactionNo} short`);
    await waitForText("already invoiced in full");
    const t = await dialogText();
    for (const want of ["about AED 84.00 with VAT", "raise a sales return"]) if (!t.includes(want)) throw new Error(`the dialog should say "${want}":\n${t}`);
    await shot("25-close-short-invoiced-dialog");
    await click("^we cannot supply the rest$", { scope: "dialog" });
    await click("^close order short$", { scope: "dialog" });
    await waitForText(`${S.invoiced.transactionNo} closed short`);
    await wait(900);
    const card = await cardText(S.invoiced.transactionNo);
    for (const want of ["Closed short", "The invoice was not changed", "Raise a sales return", "4 x Basmati Rice 5kg was invoiced but never delivered"]) {
      if (!card.includes(want)) throw new Error(`the deal should say "${want}":\n${card}`);
    }
    await showCard(S.invoiced.transactionNo);
    await shot("26-deal-closed-short-invoiced");
    const o = (await api("GET", `/transactions/transactions/${S.invoiced._id}`)).body.transaction;
    if (o.totalAmount !== 210 || o.items[0].qty !== 10 || o.status !== "APPROVED") throw new Error("the invoice must not change");
  });

  await step("Raise a sales return goes to the returns screen", async () => {
    await (await inCard(S.invoiced.transactionNo, "raise a sales return")).click();
    await page.waitForFunction(() => location.pathname === "/sales-return", { timeout: 30000 });
    await wait(600);
    await shot("27-sales-return-screen");
  });

  await step("the audit trail names the closing and its reason", async () => {
    const trail = (await api("GET", `/transactions/transactions/${S.invoiced._id}/audit`)).body;
    const row = trail.activity.find((a) => a.action === "TRANSACTION_CLOSED_SHORT");
    if (!row || !/We cannot supply the rest/.test(row.summary)) throw new Error("the closing is not in the trail: " + JSON.stringify(trail.activity.map((a) => a.action)));
    await page.goto(`${WEB}/sales-order?search=${encodeURIComponent(S.invoiced.transactionNo)}`, { waitUntil: "networkidle2" });
    await waitForText("Closed short");
    await shot("27b-sales-order-list-closed-short");
  });

  await step("on a phone the dialog fits and the buttons are reachable", async () => {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await deals();
    await waitForText("Deliver the rest");
    await (await inCard(S.draft.transactionNo, "close order short")).click();
    await waitForText(`Close ${S.draft.transactionNo} short`);
    await waitForText("Basmati Rice 5kg");
    await wait(500);
    const o = await page.evaluate(() => {
      const d = [...document.querySelectorAll('[role="dialog"]')].pop();
      const r = d.getBoundingClientRect();
      const panes = [d, ...d.querySelectorAll("*")].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === "visible");
      return { w: r.width, vw: window.innerWidth, wide: panes.length };
    });
    await shot("28-close-short-dialog-phone");
    if (o.w > o.vw + 1) throw new Error(`the dialog is wider than the screen: ${o.w} > ${o.vw}`);
    if (o.wide) throw new Error(`${o.wide} element(s) overflow inside the dialog`);
    await click("^cancel$", { scope: "dialog" });
    await page.setViewport({ width: 1440, height: 1000 });
  });

  await step("a page that breaks shows a message, keeps the menu, and the next page opens", async () => {
    page.__bad.length = 0;
    await page.setRequestInterception(true);
    const onRequest = (req) => {
      if (req.url().includes("/document-flow/customer/") && req.method() === "OPTIONS") {
        return req.respond({ status: 204, headers: { "access-control-allow-origin": WEB, "access-control-allow-credentials": "true", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,OPTIONS" } });
      }
      if (req.url().includes("/document-flow/customer/")) {
        // a response of the wrong shape: the screen reads data.summary.outWithCustomer and breaks
        return req.respond({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": WEB, "access-control-allow-credentials": "true" }, body: JSON.stringify({ success: true, data: { chains: [{}], summary: null } }) });
      }
      return req.continue();
    };
    page.on("request", onRequest);
    page.on("requestfailed", (r) => console.log("  requestfailed:", r.url().slice(0, 90), r.failure()?.errorText));
    page.on("console", (m) => { if (/CORS|Access-Control|blocked/i.test(m.text())) console.log("  console:", m.text().slice(0, 220)); });
    await deals();
    await waitForText("Something went wrong on this page");
    const t = await textOf();
    for (const want of ["Reload page", "Go to dashboard", "Nothing you saved is lost", "Technical details"]) if (!t.includes(want)) throw new Error(`the error screen should say "${want}"`);
    const railStill = await page.evaluate(() => Boolean(document.querySelector('nav[aria-label="Main"]')));
    if (!railStill) throw new Error("the menu disappeared with the page");
    await shot("29-error-screen");
    page.off("request", onRequest);
    await page.setRequestInterception(false);
    // moving to another page clears it
    await page.evaluate(() => [...document.querySelectorAll('nav[aria-label="Main"] a')].find((a) => /Sales/.test(a.textContent))?.click());
    await waitGone("Something went wrong on this page");
    await wait(600);
    await shot("30-after-error-next-page");
    page.__bad.length = 0;
  });

  await step("no page error and no failed request anywhere else in the run", async () => {
    const bad = [...new Set(page.__bad)].filter((b) => !/sales-return/.test(b));
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
