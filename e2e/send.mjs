// End to end: the real frontend (Vite) driving the real backend (own throwaway database) in a real browser.
// Run it with `npm run e2e -- send` (see e2e/README.md). It catches what fixtures cannot: the two sides disagreeing about a shape.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { FE as WEB_DIR, BE as NODE_DIR, OUT as OUT_ROOT } from "./paths.mjs";
const OUT = `${OUT_ROOT}/send`;
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
  // a page that re-renders between finding a button and pressing it detaches the button: look again
  let last;
  for (let i = 0; i < 40; i++) {
    try {
      const el = await findButton(label, opts);
      await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
      await el.click();
      return;
    } catch (e) { last = e; await wait(250); }
  }
  throw last;
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
  backend = spawn(process.execPath, ["server.js"], { cwd: NODE_DIR, env: { ...process.env, MONGO_URI: uri, PORT: String(API_PORT), CORS_ORIGINS: `http://localhost:${WEB_PORT}`, PUBLIC_APP_URL: WEB }, stdio: ["ignore", "pipe", "pipe"] });
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
  await new M.Admin({ name: "Boss", email: "boss@test.uae", password: "12312312", type: "super_admin", status: "active", isActive: true, companyInfo: { companyName: "Harbour Trading LLC", addressLine1: "Al Quoz, Dubai", phoneNumber: "04 123 4567", emailAddress: "accounts@harbour.ae", vatNumber: "100123456700003" } }).save();
  const login = await api("POST", "/login", { email: "boss@test.uae", password: "12312312" });
  token = login.body.tokens.accessToken;
  await api("GET", "/accounting/chart");
  const cat = new mongoose.Types.ObjectId();
  const cust = await M.Customer.create({ customerId: "C1", customerName: "Al Noor Grocery", contactPerson: "Ali Hassan", email: "ali@alnoor.ae", phone: "050 111 2222", shippingAddress: "Warehouse 4, Al Quoz", paymentTerms: "Net 30" });
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
    // every answer to a send, kept, so the link can be opened in a second browser later
    page.__sends = [];
    page.on("response", async (r) => {
      if (/\/messaging\/(send|handoff)$/.test(r.url()) && r.request().method() === "POST") {
        try { page.__sends.push({ status: r.status(), body: await r.json() }); } catch { /* not json */ }
      }
    });
  });

  await step("an approved invoice and a draft order exist", async () => {
    const line = (qty) => ({ itemId: S.fx.stock._id, description: "Basmati Rice 5kg", qty, price: 20, rate: qty * 20, vatPercent: 5 });
    const mk = async () => (await api("POST", "/transactions/transactions", { type: "sales_order", partyId: S.fx.customer._id, partyType: "Customer", items: [line(10)], lpono: "LPO-77" })).body;
    const tax = await api("PUT", "/accounting/settings", { profile: { trn: "100123456700003", legalName: "Harbour Trading LLC" } });
    if (tax.status !== 200) throw new Error("tax identity: " + JSON.stringify(tax.raw));
    S.invoice = await mk();
    const ok = await api("PATCH", `/transactions/transactions/${S.invoice._id}/process`, { action: "approve" });
    if (ok.status !== 200) throw new Error("approve: " + JSON.stringify(ok.raw));
    S.draft = await mk();
    return `${S.invoice.transactionNo} approved, ${S.draft.transactionNo} draft`;
  });

  await step("Settings, Sending: email is off, WhatsApp still works; switching on says it is recording only", async () => {
    await page.goto(`${WEB}/settings?tab=sending`, { waitUntil: "networkidle2" });
    await waitForText("Sending documents");
    await waitForText("Email is switched off. WhatsApp still works.");
    await shot("40-settings-sending-off");
    await click("^switch on$");
    await waitForText("recording only: nothing is actually emailed");
    const put = await api("PUT", "/messaging/settings", { fromName: "Harbour Trading LLC", fromEmail: "accounts@harbour.ae" });
    if (put.status !== 200) throw new Error("settings: " + JSON.stringify(put.raw));
    await page.reload({ waitUntil: "networkidle2" });
    await waitForText("Email connection");
    await shot("41-settings-sending-on");
  });

  await step("the sales order list: a Send button only on the approved invoice, and 'Not sent' under it", async () => {
    await page.goto(`${WEB}/sales-order`, { waitUntil: "networkidle2" });
    await click("^view all orders");
    await waitForText("Not sent");
    const sends = await page.$$eval("button", (bs) => bs.filter((b) => /^Send .* to the customer$/.test(b.getAttribute("aria-label") || "")).map((b) => b.getAttribute("aria-label")));
    if (sends.length !== 1) throw new Error(`exactly one Send button expected (the draft has none), found ${sends.length}: ${sends}`);
    await shot("42-orders-list-not-sent");
  });

  await step("Send: the dialog opens with the customer's address, draws a real PDF in Chrome, and describes it", async () => {
    await click("^send .* to the customer$");
    await waitForText("Send tax invoice");
    await waitForText("ali@alnoor.ae");
    await page.waitForFunction(() => /Customer copy · 1 page · \d+ KB/.test([...document.querySelectorAll('[role="dialog"]')].pop()?.innerText || ""), { timeout: 60000 });
    const t = await dialogText();
    for (const want of ["Email", "WhatsApp", "To", "Subject", "Attach the PDF", "stops working after 30 days"]) if (!t.includes(want)) throw new Error(`the dialog should say "${want}":\n${t}`);
    S.pdfLine = t.match(/Customer copy · 1 page · \d+ KB/)[0];
    await shot("43-send-dialog");
    return S.pdfLine;
  });

  await step("press Send email: it goes, the dialog closes, the list says Emailed", async () => {
    await click("^send email$", { scope: "dialog" });
    await waitForText("emailed to ali@alnoor.ae");
    await waitGone("Send tax invoice");
    await waitForText("Emailed ");
    await shot("44-orders-list-emailed");
    const sent = page.__sends.find((s) => s.body?.data?.send);
    if (!sent || sent.status !== 201) throw new Error("the send did not answer 201: " + JSON.stringify(page.__sends));
    S.link = sent.body.data.share.url;
    if (!S.link.startsWith(`${WEB}/d/`)) throw new Error(`the link should open this app: ${S.link}`);
    const row = (await api("GET", `/messaging/sends?sourceType=Transaction&sourceId=${S.invoice._id}`)).body.rows[0];
    if (row.status !== "SENT" || row.provider !== "console") throw new Error("log row: " + JSON.stringify(row));
    if (!(row.attachment.bytes > 4000)) throw new Error(`the attachment looks too small to be a drawn page: ${row.attachment.bytes} bytes`);
    if (row.pending) throw new Error("the message must not be held once it has gone");
    return `${row.attachment.bytes} bytes attached, link ${S.link.slice(0, 40)}...`;
  });

  // ---------------------------------------- the customer's side: a different, logged-out browser ----------------
  const asCustomer = async (viewport, fn) => {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport(viewport);
    p.setDefaultTimeout(30000);
    const bad = [];
    p.on("pageerror", (e) => bad.push(`pageerror: ${e.message.split("\n")[0]}`));
    try { return await fn(p, bad); } finally { await ctx.close(); }
  };
  const pageText = (p) => p.evaluate(() => document.body.innerText);

  await step("the customer opens the link with no sign-in: the invoice, the company, no menu, nothing of ours", async () => {
    await asCustomer({ width: 1440, height: 1000 }, async (p, bad) => {
      await p.goto(S.link, { waitUntil: "networkidle2" });
      await p.waitForFunction(() => document.body.innerText.includes("TAX INVOICE"), { timeout: 30000 });
      const t = await pageText(p);
      for (const want of ["Harbour Trading LLC", "Al Noor Grocery", "Basmati Rice 5kg", "Download PDF", "CUSTOMER COPY", "sent to you by Harbour Trading LLC"]) if (!t.includes(want)) throw new Error(`the customer page should say "${want}":\n${t.slice(0, 600)}`);
      for (const nope of ["Dashboard", "Sales", "Inventory", "Settings", "Sign in", "INTERNAL COPY"]) if (t.includes(nope)) throw new Error(`the customer page must not show "${nope}"`);
      const nav = await p.evaluate(() => Boolean(document.querySelector("nav")));
      if (nav) throw new Error("a menu is showing on the customer's page");
      if (new URL(p.url()).pathname === "/") throw new Error("the customer was sent to the sign-in page");
      await p.screenshot({ path: join(OUT, "45-customer-page.png") });
      if (bad.length) throw new Error(bad.join(" | "));
    });
  });

  await step("opening the page counts as opened by the customer, once it has really loaded", async () => {
    let shares;
    for (let i = 0; i < 40; i++) {
      shares = (await api("GET", `/messaging/shares?sourceType=Transaction&sourceId=${S.invoice._id}`)).body;
      if (shares[0]?.viewCount >= 1) break;
      await wait(250);
    }
    if (!(shares[0]?.viewCount >= 1)) throw new Error("the page loaded but was never counted: " + JSON.stringify(shares));
    if (!shares[0].firstViewedAt) throw new Error("no first-opened time");
    if (JSON.stringify(shares).includes("secretHash") || JSON.stringify(shares).includes("snapshot")) throw new Error("the share list leaked internals");
    await page.goto(`${WEB}/sales-order`, { waitUntil: "networkidle2" });
    await click("^view all orders");
    await waitForText("Opened ");
    await shot("46-orders-list-opened");
  });

  await step("on a phone the customer's page shows the whole invoice, with no sideways scroll", async () => {
    await asCustomer({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, async (p) => {
      await p.goto(S.link, { waitUntil: "networkidle2" });
      await p.waitForFunction(() => document.body.innerText.includes("TAX INVOICE"), { timeout: 30000 });
      await wait(500);
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: window.innerWidth, sheet: document.querySelector("[data-print-preview] > div")?.getBoundingClientRect().width }));
      if (o.sw > o.vw + 1) throw new Error(`the page scrolls sideways: ${o.sw} > ${o.vw}`);
      if (!(o.sheet > 200 && o.sheet <= o.vw)) throw new Error(`the invoice should be scaled to the screen: ${o.sheet}px on a ${o.vw}px screen`);
      await p.screenshot({ path: join(OUT, "47-customer-page-phone.png") });
      return `${Math.round(o.sheet)}px of ${o.vw}px`;
    });
  });

  await step("the invoice's own screen: Send, Send history, and what happened, in words", async () => {
    await page.goto(`${WEB}/sales-order`, { waitUntil: "networkidle2" });
    await click("^view all orders");
    await click("^view [0-9]");
    await waitForText("APPROVED");
    await waitForText("Opened by customer");
    // the company is read after the page opens, so wait for it before judging what the sheet says about it
    await page.waitForFunction(() => document.querySelector("[data-print-preview]")?.innerText.includes("Harbour Trading LLC"), { timeout: 30000 });
    await wait(800);
    const t = await textOf();
    if (/Your TRN is not set/.test(t)) throw new Error("the company TRN is saved under Business rules, so the invoice must not say it is missing");
    if (!t.includes("100123456700003")) throw new Error("the seller's TRN must print on a tax invoice");
    if (!/Emailed to ali@alnoor\.ae on .* Opened /.test(t)) throw new Error("the header should say where it went and that it was opened:\n" + t.slice(0, 500));
    await shot("48-invoice-screen-sent");
    await click("^send history$");
    await page.waitForFunction(() => /ali@alnoor.ae/.test([...document.querySelectorAll('[role="dialog"]')].pop()?.innerText || ""), { timeout: 30000 });
    const h = await dialogText();
    for (const want of ["ali@alnoor.ae", "Opened by customer", "opened 2 times", "Link works until", "Withdraw link"]) if (!h.includes(want)) throw new Error(`the history should say "${want}":\n${h}`);
    await shot("49-send-history");
  });

  await step("withdraw the link: the customer's page then says so, in plain words", async () => {
    await click("^withdraw link$", { scope: "dialog" });
    await waitForText("Withdraw this link?");
    await click("^withdraw link$", { scope: "dialog" });
    await waitForText("The link was withdrawn");
    await asCustomer({ width: 1440, height: 1000 }, async (p) => {
      await p.goto(S.link, { waitUntil: "networkidle2" });
      await p.waitForFunction(() => document.body.innerText.includes("This link has been withdrawn"), { timeout: 30000 });
      const t = await pageText(p);
      if (!t.includes("Harbour Trading LLC withdrew this link")) throw new Error("it should name who to ask:\n" + t);
      if (t.includes("Basmati") || t.includes("Al Noor")) throw new Error("a withdrawn link must show nothing of the document");
      await p.screenshot({ path: join(OUT, "50-customer-link-withdrawn.png") });
    });
  });

  await step("a link that was never real says nothing about why", async () => {
    await asCustomer({ width: 1440, height: 1000 }, async (p) => {
      await p.goto(`${WEB}/d/ZZZZZZZZZZZ.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`, { waitUntil: "networkidle2" });
      await p.waitForFunction(() => document.body.innerText.includes("This link does not work"), { timeout: 30000 });
      const t = await pageText(p);
      if (/Harbour|Al Noor|INV|SO-/.test(t)) throw new Error("it must not name anything:\n" + t);
    });
  });

  await step("WhatsApp: the number is read, the message and link are written, and nothing claims it was sent", async () => {
    await page.goto(`${WEB}/sales-order`, { waitUntil: "networkidle2" });
    await click("^view all orders");
    await click("^send .* to the customer$");
    await waitForText("Send tax invoice");
    await page.evaluate(() => { window.__opened = []; window.open = (...a) => { window.__opened.push(a); return null; }; });
    await click("^whatsapp$", { scope: "dialog" });
    await waitForText("Opens WhatsApp for +971501112222.");
    const t = await dialogText();
    for (const want of ["cannot tell whether it was sent", "given on whatsapp"]) if (!t.toLowerCase().includes(want)) throw new Error(`the WhatsApp page of the dialog should say "${want}":\n${t}`);
    await shot("51-send-dialog-whatsapp");
    await click("^open whatsapp$", { scope: "dialog" });
    await page.waitForFunction(() => window.__opened?.length === 1, { timeout: 20000 });
    const [url, target, features] = await page.evaluate(() => window.__opened[0]);
    if (!url.startsWith("https://wa.me/971501112222?text=")) throw new Error("wrong WhatsApp address: " + url);
    const text = decodeURIComponent(url.split("?text=")[1]);
    const handed = page.__sends.filter((s) => s.body?.data?.waUrl).pop();
    if (!handed) throw new Error("no hand-over answer was seen");
    if (!text.includes(handed.body.data.share.url)) throw new Error("the message should carry the link:\n" + text);
    if (!/^Dear Ali Hassan, tax invoice .* from Harbour Trading LLC for 210\.00 AED\./.test(text)) throw new Error("the message reads wrongly:\n" + text);
    if (target !== "_blank" || features !== "noopener") throw new Error(`opened unsafely: ${target} ${features}`);
    await waitGone("Send tax invoice");
    await waitForText("Given on WhatsApp");
    await shot("52-orders-list-whatsapp");
    const row = (await api("GET", `/messaging/sends?channel=whatsapp&sourceId=${S.invoice._id}`)).body.rows[0];
    if (row.status !== "HANDED_OFF") throw new Error("a WhatsApp hand-over must be HANDED_OFF, never SENT: " + row.status);
  });

  await step("a send that fails shows the reason inside the dialog, which stays open with what was typed", async () => {
    await page.goto(`${WEB}/sales-order`, { waitUntil: "networkidle2" });
    await click("^view all orders");
    await click("^send .* to the customer$");
    await waitForText("Send tax invoice");
    await page.waitForFunction(() => /Customer copy · 1 page/.test([...document.querySelectorAll('[role="dialog"]')].pop()?.innerText || ""), { timeout: 60000 });
    await click("Remove ali@alnoor.ae", { scope: "dialog" });
    await typeIn('[role="dialog"] input[type="email"]', "badaddr@example.com");
    await page.keyboard.press("Enter");
    await typeIn('[role="dialog"] textarea', "Please pay by Friday", { clear: false });
    await click("^send email$", { scope: "dialog" });
    await waitForText("refused one of the addresses");
    const t = await dialogText();
    const typed = await page.$eval('[role="dialog"] textarea', (el) => el.value);
    if (!t.includes("badaddr@example.com") || typed !== "Please pay by Friday") throw new Error("what was typed was lost: message [" + typed + "] " + t);
    await shot("53-send-refused");
    const open = await page.$('[role="dialog"]');
    if (!open) throw new Error("the dialog closed on a refusal");
    const log = (await api("GET", `/messaging/sends?sourceId=${S.invoice._id}&status=FAILED`)).body.rows[0];
    if (!log || log.lastErrorCode !== "INVALID_ADDRESS") throw new Error("the failure is not in the history: " + JSON.stringify(log));
    await click("^cancel$", { scope: "dialog" });
  });

  await step("on a phone the Send dialog is a bottom sheet that fits, with a thumb-sized button", async () => {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${WEB}/sales-order`, { waitUntil: "networkidle2" });
    await click("^view all orders");
    await click("^send .* to the customer");
    await waitForText("Send tax invoice");
    await page.waitForFunction(() => /Customer copy · 1 page/.test([...document.querySelectorAll('[role="dialog"]')].pop()?.innerText || ""), { timeout: 60000 });
    const o = await page.evaluate(() => {
      const d = [...document.querySelectorAll('[role="dialog"]')].pop();
      const r = d.getBoundingClientRect();
      const send = [...d.querySelectorAll("button")].find((b) => /^send email$/i.test(b.textContent.trim()));
      const remove = [...d.querySelectorAll("button")].find((b) => /^Remove /.test(b.getAttribute("aria-label") || ""));
      return { w: r.width, vw: window.innerWidth, bottom: Math.round(r.bottom), vh: window.innerHeight, sendH: send?.getBoundingClientRect().height, removeW: remove?.getBoundingClientRect().width, overflow: d.scrollWidth > d.clientWidth + 2 };
    });
    await shot("54-send-dialog-phone");
    if (o.w > o.vw + 1 || o.overflow) throw new Error("the dialog overflows: " + JSON.stringify(o));
    if (o.sendH < 40) throw new Error(`the Send button is too small to tap: ${o.sendH}px`);
    if (o.removeW && o.removeW < 40) throw new Error(`the remove-address target is too small to tap: ${o.removeW}px`);
    await click("^cancel$", { scope: "dialog" });
    await page.setViewport({ width: 1440, height: 1000 });
  });

  await step("a draft order has no Send anywhere, on its list row or on its own screen", async () => {
    await page.goto(`${WEB}/sales-order?search=${encodeURIComponent(S.draft.transactionNo)}`, { waitUntil: "networkidle2" });
    await waitForText(S.draft.transactionNo);
    const sends = await page.$$eval("button", (bs) => bs.filter((b) => /^Send /.test(b.getAttribute("aria-label") || "")).length);
    if (sends) throw new Error(`a draft must not offer Send (found ${sends})`);
    const t = await textOf();
    if (/Coming soon/i.test(t)) throw new Error("a Coming soon pill is still on the screen");
  });

  await step("no page error and no unexpected failed request in the whole run", async () => {
    const expected = /\/messaging\/send|\/share\//;
    const bad = [...new Set(page.__bad)].filter((b) => !(expected.test(b) && /api (4|5)\d\d/.test(b)));
    if (bad.length) throw new Error(bad.join(" | "));
  });
} catch (e) {
  console.log("\nstopped:", String(e.message).split("\n")[0]);
  try { await shot("zz-failure"); console.log("page text at failure:\n" + (await textOf()).slice(0, 800)); } catch (e2) { console.log("could not capture the page:", String(e2.message).split("\n")[0]); }
  if (page?.__bad?.length) console.log("browser/API problems:", [...new Set(page.__bad)].join(" | "));
  if (logs.api) console.log("backend tail:\n" + logs.api.slice(-500));
} finally {
  await shutdown();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
