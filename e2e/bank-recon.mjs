// End to end (bank reconciliation): the real frontend (Vite) driving the real backend (own throwaway database) in a real browser.
// Run it with `npm run e2e -- bank-recon` (see e2e/README.md). It catches what fixtures cannot: the two sides disagreeing about a shape.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { FE as WEB_DIR, BE as NODE_DIR, OUT as OUT_ROOT } from "./paths.mjs";
const OUT = `${OUT_ROOT}/bank-recon`;
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

// ---- start everything (bank reconciliation) ------------------------------------------------
const dayOf = (n) => new Date(Date.now() + 4 * 3600000 + n * 86400000).toISOString().slice(0, 10); // Dubai calendar day
const dmy = (d) => d.split("-").reverse().join("/");

// What the bank says, oldest first: [days from today, description, signed amount]
const OPENING = 1000;
const SPEC = [
  [-8, "TRANSFER FROM AL NOOR GROCERY TRF-9001", 1050],
  [-7, "CHQ DEP 000777 AL NOOR", 500],
  [-6, "IPP PAY-1 GULF SUPPLY", -300],
  [-3, "NETWORK INTL SETTLEMENT 0099", 293.7],
  [-2, "BANK CHARGES INCL VAT", -21],
  [-2, "CREDIT INTEREST", 4.2],
  [-1, "TRANSFER TO SAVINGS", -250],
  [-1, "UNKNOWN DEPOSIT", 80],
  [0, "DUPLICATE FEE", -15],
];
const round2 = (n) => Math.round(n * 100) / 100;
const csvText = () => {
  let run = OPENING;
  const body = SPEC.map(([n, text, amount]) => {
    run = round2(run + amount);
    return [dmy(dayOf(n)), `"${text}"`, amount < 0 ? Math.abs(amount).toFixed(2) : "", amount > 0 ? amount.toFixed(2) : "", run.toFixed(2)].join(",");
  });
  return ["Emirates Bank - Account Statement,,,,", "Account 1234567,,,,", "Date,Description,Debit,Credit,Balance", ...body, ",Total,,,"].join("\n");
};
const CLOSING = round2(OPENING + SPEC.reduce((t, s) => t + s[2], 0));

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
    AccountGroup: requireNode("./models/modules/financial/accountGroupModel"),
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

  const cust = await M.Customer.create({ customerId: "C1", customerName: "Al Noor Grocery", contactPerson: "Ali Hassan", creditLimit: 1e6 });
  const vend = await M.Vendor.create({ vendorId: "V1", vendorName: "Gulf Supply", contactPerson: "x", address: "y" });
  const group = await M.AccountGroup.findOne({ name: "Bank" });
  const bank = (await api("POST", "/accounting/accounts", { accountName: "Recon Bank", groupId: group._id })).body;
  const savings = (await api("POST", "/accounting/accounts", { accountName: "Savings Bank", groupId: group._id })).body;
  if (!bank?._id || !savings?._id) throw new Error("could not create the bank accounts");
  const visa = (await api("POST", "/banking/card-types", { name: "Visa", feePercent: 2 })).body;
  const terminal = (await api("POST", "/banking/cards", { label: "POS 1", kind: "terminal", cardTypeId: visa._id, accountId: bank._id, terminalId: "T-001" })).body;
  if (!terminal?._id) throw new Error("could not create the card terminal");

  // what the books already hold (through the real voucher route)
  const rv = async (extra) => {
    const r = await api("POST", "/vouchers/vouchers", { voucherType: "receipt", customerId: cust._id, ...extra });
    if (r.status !== 201) throw new Error(`receipt ${r.status} ${JSON.stringify(r.raw).slice(0, 200)}`);
    return r.body;
  };
  await rv({ totalAmount: 1000, date: dayOf(-40), paymentMode: "bank", paymentDetails: { accountId: bank._id, reference: "OPENING-1" } });
  const transfer = await rv({ totalAmount: 1050, date: dayOf(-8), paymentMode: "transfer", paymentDetails: { accountId: bank._id, reference: "TRF-9001", referenceDate: dayOf(-8) } });
  await rv({ totalAmount: 500, date: dayOf(-9), paymentMode: "cheque", paymentDetails: { accountId: bank._id, chequeNo: "000777", chequeDate: dayOf(-9), drawnOnBankName: "ENBD" } });
  const pay = await api("POST", "/vouchers/vouchers", { voucherType: "payment", vendorId: vend._id, totalAmount: 300, date: dayOf(-6), paymentMode: "transfer", paymentDetails: { accountId: bank._id, reference: "PAY-1" } });
  if (pay.status !== 201) throw new Error(`payment ${pay.status} ${JSON.stringify(pay.raw).slice(0, 200)}`);
  await rv({ totalAmount: 100, date: dayOf(-5), paymentMode: "card", paymentDetails: { cardId: terminal._id, approvalCode: "A100" } });
  await rv({ totalAmount: 200, date: dayOf(-4), paymentMode: "card", paymentDetails: { cardId: terminal._id, approvalCode: "A200" } });
  await rv({ totalAmount: 77, date: dayOf(-1), paymentMode: "bank", paymentDetails: { accountId: bank._id, reference: "SLIP-77" } });

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
  page.setDefaultTimeout(30000);
  const bad = [];
  page.on("pageerror", (e) => bad.push(`pageerror: ${e.message.split("\n")[0]}`));
  page.on("response", (r) => { if (r.url().includes("/api/v1") && r.status() >= 400 && !r.url().includes("/refresh-token")) bad.push(`api ${r.status()} ${new URL(r.url()).pathname}`); });
  page.__bad = bad;
  return { customer: cust, bank, savings, terminal, transfer };
}

// a button inside the card (article) that mentions `text`
async function cardButton(text, label) {
  for (let i = 0; i < 40; i++) {
    const handle = await page.evaluateHandle((text, label) => {
      const card = [...document.querySelectorAll("article")].find((a) => a.innerText.includes(text));
      if (!card) return null;
      const want = new RegExp(label, "i");
      return [...card.querySelectorAll("button")].find((b) => !b.disabled && want.test(b.textContent)) || null;
    }, text, label);
    const el = handle.asElement();
    if (el) { await el.evaluate((n) => n.scrollIntoView({ block: "center" })); await el.click(); return; }
    await wait(250);
  }
  throw new Error(`no "${label}" button on the card for "${text}"`);
}
const tabCount = (name) => page.evaluate((name) => {
  const t = [...document.querySelectorAll('[role="tab"]')].find((x) => x.textContent.trim().toLowerCase().startsWith(name.toLowerCase()));
  return t ? Number((t.textContent.match(/(\d+)\s*$/) || [0, 0])[1]) : -1;
}, name);
const openTab = async (name) => { await click(`^${name}`); await wait(700); };
const S = {};
const FILE = join(OUT, "oct-statement.csv");

try {
  await step("start a throwaway backend and the real frontend", async () => { S.fx = await boot(); });

  await step("sign in: the session cookie is set, and the app restores the session on load", async () => {
    await page.goto(`${WEB}/`, { waitUntil: "networkidle2" });
    const status = await page.evaluate(async (api) => {
      const r = await fetch(`${api}/login`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "boss@test.uae", password: "12312312" }) });
      return r.status;
    }, API);
    if (status !== 200) throw new Error(`login answered ${status}`);
    await page.goto(`${WEB}/dashboard`, { waitUntil: "networkidle2" });
    if (new URL(page.url()).pathname === "/") throw new Error("the app did not restore the session from the cookie");
    await waitForText("Zarvia");
  });

  await step("the Reconcile tab is in Finance, and a new account starts with the statement", async () => {
    await page.goto(`${WEB}/cash-and-bank`, { waitUntil: "networkidle2" });
    await waitForText("Savings Bank"); // the accounts have loaded
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="/bank-reconciliation"]')].map((e) => e.getAttribute("href")));
    if (links.length < 3) throw new Error(`expected the tab and a link per bank account, found ${links.length}`);
    await page.goto(`${WEB}/bank-reconciliation?account=${S.fx.bank._id}`, { waitUntil: "networkidle2" });
    await waitForText("Start with a bank statement");
    await shot("21-recon-empty");
  });

  await step("import the statement file: it is read, checked, and the first statement asks where it starts", async () => {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(FILE, csvText());
    await click("^import a statement");
    await waitForText("Import a statement into");
    const input = await page.$('input[type="file"][aria-label="Statement file"]');
    await input.uploadFile(FILE);
    await waitForText(`${SPEC.length} lines from`);
    await waitForText("This is the first statement for this account");
    await waitForText("The books show the same balance that day.");
    const t = await dialogText();
    if (!t.includes("TRANSFER FROM AL NOOR GROCERY")) throw new Error("the first lines are not previewed");
    if (t.includes("running balance does not follow")) throw new Error("a good file was flagged for a broken running balance");
    await shot("22-recon-import-preview");
    await click(`^import ${SPEC.length} lines`, { scope: "dialog" });
    await waitForText(`${SPEC.length} lines imported`);
  });

  await step("the worklist: three strong suggestions, with their reasons", async () => {
    await waitForText("Accept all strong matches");
    await waitForText("reference TRF-9001"); // the suggestions are drawn
    const t = await textOf();
    for (const want of ["Strong match", "same amount", "reference TRF-9001", "cheque 000777", "Matching clears this cheque"]) if (!t.includes(want)) throw new Error(`missing "${want}"`);
    const suggested = await tabCount("suggested");
    if (suggested !== 3) throw new Error(`expected 3 suggestions, the tab says ${suggested}`);
    await shot("23-recon-suggestions");
  });

  await step("accept the strong matches: the transfer and the payment match, and the cheque is cleared from the statement", async () => {
    await click("^accept all strong matches");
    await waitForText("Strong matches accepted");
    const cheques = (await api("GET", "/banking/cheques?status=cleared")).body;
    const cleared = cheques.rows.find((c) => c.chequeNo === "000777");
    if (!cleared) throw new Error("the cheque was not cleared by the match");
    if (String(cleared.clearedOn).slice(0, 10) !== dayOf(-7)) throw new Error(`cleared on ${cleared.clearedOn}, expected the day the bank credited it ${dayOf(-7)}`);
    await openTab("to do");
    const todo = await tabCount("to do");
    if (todo !== SPEC.length - 3) throw new Error(`expected ${SPEC.length - 3} lines left, the tab says ${todo}`);
  });

  await step("card settlement: both sales are ticked, the VAT the acquirer took is the whole difference, and it is recorded", async () => {
    await cardButton("NETWORK INTL SETTLEMENT", "card settlement");
    await waitForText("Commission already booked");
    await waitForText("The difference is fully explained.");
    const t = await dialogText();
    for (const want of ["300.00", "294.00", "293.70", "0.30"]) if (!t.includes(want)) throw new Error(`the settlement does not show ${want}`);
    await shot("24-recon-card-settle");
    await click("^record settlement", { scope: "dialog" });
    await waitForText("Card settlement recorded");
    const settle = (await api("GET", `/banking/reconciliation/card/settlements?accountId=${S.fx.bank._id}`)).body;
    if (settle.length !== 1 || settle[0].vat !== 0.3 || settle[0].extraCommission !== 0) throw new Error(`settlement ${JSON.stringify(settle[0])}`);
  });

  await step("a bank charge: the gross is split into 20.00 and 1.00 VAT, posted and matched in one step", async () => {
    await cardButton("BANK CHARGES INCL VAT", "post an entry");
    await waitForText("What is it?");
    await waitForText("21.00 = 20.00 charge + 1.00 VAT");
    await shot("25-recon-post-fee");
    await click("^post and match", { scope: "dialog" });
    await waitGone("What is it?"); // the dialog closes once it is posted (its own text also says "posted and matched")
    await waitForText("EV-");
    const fee = await mongoose.connection.collection("vouchers").findOne({ voucherType: "expense", totalAmount: 21 });
    if (!fee) throw new Error("the fee voucher was not found");
    if (fee.vatTotal !== 1 || fee.subtotal !== 20) throw new Error(`fee posted as ${fee.subtotal} + ${fee.vatTotal}`);
  });

  await step("interest, a transfer to the savings account, and a customer receipt that nobody booked", async () => {
    await cardButton("CREDIT INTEREST", "post an entry");
    await waitForText("What is it?");
    await click("Interest received", { scope: "dialog" }).catch(async () => { await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => /Interest received/.test(l.textContent))?.click()); });
    await wait(300);
    await click("^post and match", { scope: "dialog" });
    await waitGone("What is it?");

    await cardButton("TRANSFER TO SAVINGS", "post an entry");
    await waitForText("What is it?");
    await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => /To another account/.test(l.textContent))?.click());
    await pick('input[aria-label="Other account"]', "Savings");
    await click("^post and match", { scope: "dialog" });
    await waitGone("What is it?");

    await cardButton("UNKNOWN DEPOSIT", "post an entry");
    await waitForText("What is it?");
    await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => /Customer receipt/.test(l.textContent))?.click());
    await pick('input[aria-label="Customer"]', "Al Noor");
    await waitForText("kept on account");
    await click("^post and match", { scope: "dialog" });
    await waitGone("What is it?");
    const bal = (await api("GET", `/banking/reconciliation/accounts`)).body.find((a) => a._id === S.fx.bank._id);
    const savings = (await api("GET", `/banking/reconciliation/accounts`)).body.find((a) => a._id === S.fx.savings._id);
    if (round2(savings.bookBalance) !== 250) throw new Error(`the savings account holds ${savings.bookBalance}, expected 250`);
    S.bookBalance = bal.bookBalance;
  });

  await step("a bank error is ignored with a reason, and shows under Ignored", async () => {
    await cardButton("DUPLICATE FEE", "ignore");
    await waitForText("Ignore this line?");
    await click("Duplicate in the bank's own file", { scope: "dialog" });
    await click("^ignore$", { scope: "dialog" });
    await waitForText("Line ignored");
    await openTab("ignored");
    await waitForText("Left out: Duplicate in the bank's own file");
    await openTab("to do");
    await waitForText("Nothing left to do");
    await shot("26-recon-all-done");
  });

  await step("the proof: the two sides agree once the deposit in transit and the ignored line are allowed for", async () => {
    await waitForText("The two sides agree. This can be finished.");
    const t = await textOf();
    for (const want of ["Balance per bank statement", "Adjusted bank balance", "Adjusted book balance", "Difference"]) if (!t.includes(want)) throw new Error(`the proof does not show "${want}"`);
    const proof = (await api("GET", `/banking/reconciliation/proof?accountId=${S.fx.bank._id}&asOf=${dayOf(0)}&statementBalance=${CLOSING}`)).body;
    if (proof.difference !== 0 || proof.depositsInTransit.total !== 77 || proof.ignored.total !== -15) throw new Error(`proof ${JSON.stringify({ d: proof.difference, t: proof.depositsInTransit.total, i: proof.ignored.total })}`);
    await shot("27-recon-proof");
  });

  await step("finish: the reconciliation is numbered and the lines are locked", async () => {
    await click("^finish reconciliation$");
    await waitForText("Finish this reconciliation?");
    await click("^finish and lock", { scope: "dialog" });
    await waitGone("Finish this reconciliation?");
    await waitForText("BRC-"); // the toast names the reconciliation
    const recs = (await api("GET", `/banking/reconciliation/reconciliations?accountId=${S.fx.bank._id}`)).body;
    if (recs.length !== 1 || !/^BRC-\d{4}-0001$/.test(recs[0].number)) throw new Error(`reconciliations ${JSON.stringify(recs.map((r) => r.number))}`);
    S.rec = recs[0];
    await openTab("matched");
    await waitForText("Locked in a completed reconciliation");
    // nothing a reconciled line rests on can be changed quietly
    const fee = await mongoose.connection.collection("vouchers").findOne({ voucherType: "expense", totalAmount: 21 });
    const del = await api("DELETE", `/vouchers/vouchers/${fee._id}`);
    if (del.status !== 409 || del.raw.errorCode !== "BANK_RECONCILED") throw new Error(`deleting a reconciled voucher answered ${del.status} ${JSON.stringify(del.raw)}`);
    await shot("28-recon-locked");
  });

  await step("history: the reconciliation statement is kept, and opens", async () => {
    await page.goto(`${WEB}/bank-reconciliation?account=${S.fx.bank._id}&view=history`, { waitUntil: "networkidle2" });
    await waitForText(S.rec.number);
    await click("^statement$");
    await waitForText("Balance per bank statement");
    const t = await dialogText();
    for (const want of ["Add: receipts in the books the bank has not credited yet", "77.00", "Adjusted bank balance"]) if (!t.includes(want)) throw new Error(`the kept statement does not show "${want}"`);
    await shot("29-recon-statement");
    await click("^close$", { scope: "dialog" });
  });

  await step("reopen: the lines unlock and can be unmatched again", async () => {
    await click("^reopen");
    await waitForText(`Reopen ${S.rec.number}?`);
    await page.type('[role="dialog"] textarea', "Checking one more thing");
    await click("^reopen$", { scope: "dialog" });
    await waitGone(`Reopen ${S.rec.number}?`);
    await waitForText(`${S.rec.number} reopened`);
    await page.goto(`${WEB}/bank-reconciliation?account=${S.fx.bank._id}`, { waitUntil: "networkidle2" });
    await openTab("matched");
    await waitForText("Unmatch");
    const t = await textOf();
    if (t.includes("Locked in a completed reconciliation")) throw new Error("lines are still locked after reopening");
  });

  await step("the card tab: the settlement, and what the commission really costs", async () => {
    await page.goto(`${WEB}/bank-reconciliation?account=${S.fx.bank._id}&view=card`, { waitUntil: "networkidle2" });
    await waitForText("Commission booked");
    await waitForText("Commission taken");
    await waitForText("Card settlements");
    const t = await textOf();
    if (!t.includes("2.00%")) throw new Error("the booked commission rate (2.00%) is not shown");
    await shot("30-recon-card-tab");
  });

  await step("on a phone the worklist stacks and nothing runs off the screen", async () => {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${WEB}/bank-reconciliation?account=${S.fx.bank._id}`, { waitUntil: "networkidle2" });
    await waitForText("Bank reconciliation");
    await openTab("matched");
    await wait(600);
    const o = await page.evaluate(() => {
      const pane = document.querySelector("main") || document.documentElement;
      return { sw: pane.scrollWidth, cw: pane.clientWidth, cards: document.querySelectorAll("article").length };
    });
    await shot("31-recon-phone");
    if (o.sw > o.cw + 4) throw new Error(`the page scrolls sideways: ${o.sw} > ${o.cw}`);
    if (o.cards < 3) throw new Error(`lines are missing: ${o.cards}`);
    await page.setViewport({ width: 1440, height: 1000 });
    return `${o.cards} lines, no overflow`;
  });

  await step("no page error and no failed request anywhere in the run", async () => {
    const bad = [...new Set(page.__bad)];
    if (bad.length) throw new Error(bad.join(" | "));
  });
} catch (e) {
  console.log("\nstopped:", String(e.message).split("\n")[0]);
  try { await shot("zz-failure"); console.log("page text at failure:\n" + (await textOf()).slice(0, 900)); } catch (e2) { console.log("could not capture the page:", String(e2.message).split("\n")[0]); }
  if (page?.__bad?.length) console.log("browser/API problems:", [...new Set(page.__bad)].join(" | "));
  if (logs.api) console.log("backend tail:\n" + logs.api.slice(-600));
  if (logs.web) console.log("vite tail:\n" + logs.web.slice(-1800));
} finally {
  await shutdown();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
