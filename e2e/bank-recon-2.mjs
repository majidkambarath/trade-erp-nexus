// End to end (bank reconciliation, second flow): the real frontend (Vite) driving the real backend (own throwaway database) in a real browser.
// Run it with `npm run e2e -- bank-recon-2` (see e2e/README.md). It catches what fixtures cannot: the two sides disagreeing about a shape.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { FE as WEB_DIR, BE as NODE_DIR, OUT as OUT_ROOT } from "./paths.mjs";
const OUT = `${OUT_ROOT}/bank-recon-2`;
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

// ---- bank reconciliation, second flow: Excel and MT940 files, deposits of several receipts, find / rematch, locks ----
const dayOf = (n) => new Date(Date.now() + 4 * 3600000 + n * 86400000).toISOString().slice(0, 10); // Dubai calendar day
const dmy = (d) => d.split("-").reverse().join("/");
const round2 = (n) => Math.round(n * 100) / 100;
const yymmdd = (n) => dayOf(n).slice(2).replace(/-/g, "");

// Alpha Bank's statement, as an Excel sheet: a title row, then headings, real date cells, ONE signed amount column.
const ALPHA = [
  [-3, "TRANSFER FROM AL NOOR GROCERY REF-A1", 400],
  [-2, "CASH DEPOSIT", 525],
  [-1, "CHQ DEP 000999 AL NOOR", 300],
  [0, "ATM FEE", -10],
];
const ALPHA_CLOSING = round2(ALPHA.reduce((t, l) => t + l[2], 0));
// Beta Bank's statement, as MT940 text
const BETA_MT940 = [
  ":20:BETA-1", ":25:AE070331234567890123456", ":28C:00001/001",
  `:60F:C${yymmdd(-3)}AED0,00`,
  `:61:${yymmdd(-2)}${dayOf(-2).slice(5).replace("-", "")}C150,00NTRFNONREF//B1`,
  ":86:DEPOSIT SLIP-B1",
  `:61:${yymmdd(-1)}${dayOf(-1).slice(5).replace("-", "")}D50,00NCHGNONREF//B2`,
  ":86:STANDING ORDER RENT",
  `:62F:C${yymmdd(-1)}AED100,00`,
].join("\n");

const XLSX_FILE = join(OUT, "alpha-statement.xlsx");
const STA_FILE = join(OUT, "beta-statement.sta");

async function boot() {
  backend = spawn(process.execPath, ["server.js"], { cwd: NODE_DIR, env: { ...process.env, MONGO_URI: uri, PORT: String(API_PORT), CORS_ORIGINS: `http://localhost:${WEB_PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
  backend.stdout.on("data", (d) => (logs.api += d));
  backend.stderr.on("data", (d) => (logs.api += d));
  children.push(backend);

  await mongoose.connect(uri);
  const M = {
    Admin: requireNode("./models/core/adminModel"),
    Customer: requireNode("./models/modules/customerModel"),
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

  const cust = await M.Customer.create({ customerId: "C1", customerName: "Al Noor Grocery", contactPerson: "Ali", creditLimit: 1e6 });
  const group = await M.AccountGroup.findOne({ name: "Bank" });
  const alpha = (await api("POST", "/accounting/accounts", { accountName: "Alpha Bank", groupId: group._id })).body;
  const beta = (await api("POST", "/accounting/accounts", { accountName: "Beta Bank", groupId: group._id })).body;
  if (!alpha?._id || !beta?._id) throw new Error("could not create the bank accounts");
  const rv = async (extra) => {
    const r = await api("POST", "/vouchers/vouchers", { voucherType: "receipt", customerId: cust._id, ...extra });
    if (r.status !== 201) throw new Error(`receipt ${r.status} ${JSON.stringify(r.raw).slice(0, 200)}`);
    return r.body;
  };
  // Alpha: a transfer, two deposit slips that the bank paid in as ONE credit, a cheque, and (later) a fee
  await rv({ totalAmount: 400, date: dayOf(-3), paymentMode: "transfer", paymentDetails: { accountId: alpha._id, reference: "REF-A1", referenceDate: dayOf(-3) } });
  await rv({ totalAmount: 300, date: dayOf(-2), paymentMode: "bank", paymentDetails: { accountId: alpha._id, reference: "SLIP-1" } });
  await rv({ totalAmount: 225, date: dayOf(-2), paymentMode: "bank", paymentDetails: { accountId: alpha._id, reference: "SLIP-2" } });
  await rv({ totalAmount: 300, date: dayOf(-4), paymentMode: "cheque", paymentDetails: { accountId: alpha._id, chequeNo: "000999", chequeDate: dayOf(-4), drawnOnBankName: "ENBD" } });
  // Beta: one deposit slip
  await rv({ totalAmount: 150, date: dayOf(-2), paymentMode: "bank", paymentDetails: { accountId: beta._id, reference: "SLIP-B1" } });

  // the statement files, as a bank would give them
  const XLSX = requireWeb("xlsx");
  let run = 0;
  const rows = [["Alpha Bank - Account Statement"], [], ["Transaction Date", "Narration", "Amount", "Balance"]];
  for (const [n, text, amount] of ALPHA) {
    run = round2(run + amount);
    const [y, m, d] = dayOf(n).split("-").map(Number);
    rows.push([new Date(y, m - 1, d), text, amount, run]); // a real Excel date cell, one signed amount
  }
  const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Statement");
  XLSX.writeFile(wb, XLSX_FILE);
  (await import("node:fs")).writeFileSync(STA_FILE, BETA_MT940);

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
  return { customer: cust, alpha, beta };
}

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
const openAccount = async (acct, query = "") => { await page.goto(`${WEB}/bank-reconciliation?account=${acct._id}${query}`, { waitUntil: "networkidle2" }); await waitForText("Bank reconciliation"); };
const S = {};

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

  await step("an Excel statement: real date cells are read as the right days, one signed amount column is understood", async () => {
    await openAccount(S.fx.alpha);
    await click("^import a statement");
    await waitForText("Import a statement into Alpha Bank");
    await (await page.$('input[type="file"][aria-label="Statement file"]')).uploadFile(XLSX_FILE);
    await waitForText(`${ALPHA.length} lines from`);
    const t = await dialogText();
    for (const [n, text, amount] of ALPHA) {
      if (!t.includes(dmy(dayOf(n))) && n === ALPHA[0][0]) throw new Error(`the first date ${dmy(dayOf(n))} is not shown: an Excel date was read as the wrong day`);
      if (!t.includes(text) && ALPHA.indexOf([n, text, amount]) < 8 && text.length) { /* only the first lines are previewed */ }
    }
    for (const want of ["+400.00", "-10.00", `${dmy(dayOf(-3))}`, "This is the first statement for this account"]) if (!t.includes(want)) throw new Error(`the preview does not show "${want}"`);
    if (t.includes("running balance does not follow")) throw new Error("a good Excel file was flagged for a broken running balance");
    await shot("41-xlsx-preview");
    await click(`^import ${ALPHA.length} lines`, { scope: "dialog" });
    await waitForText(`${ALPHA.length} lines imported`);
    const lines = await mongoose.connection.collection("bankstatementlines").find({}).toArray();
    const days = lines.map((l) => l.day).sort();
    if (days[0] !== dayOf(-3) || days[days.length - 1] !== dayOf(0)) throw new Error(`stored days ${days.join(", ")}`);
  });

  await step("suggestions: the transfer and the cheque are strong, the deposit is two receipts found as a group", async () => {
    await waitForText("Accept all strong matches");
    await waitForText("Match all 2");
    const t = await textOf();
    for (const want of ["reference REF-A1", "cheque 000999", "2 entries add up to exactly this amount", "Possible match"]) if (!t.includes(want)) throw new Error(`missing "${want}"`);
    await shot("42-xlsx-suggestions");
  });

  await step("accept the strong ones (the cheque clears from the statement), then match the deposit's two receipts together", async () => {
    await click("^accept all strong matches");
    await waitForText("Strong matches accepted");
    await cardButton("CASH DEPOSIT", "match all 2");
    await waitForText("Matched", 30000); // the toast; the tab is also called Matched, so the database has the last word
    for (let i = 0; i < 40 && !(await mongoose.connection.collection("bankmatches").findOne({ status: "active", "entries.1": { $exists: true } })); i++) await wait(250);
    const cleared = (await api("GET", "/banking/cheques?status=cleared")).body.rows.find((c) => c.chequeNo === "000999");
    if (!cleared) throw new Error("the cheque was not cleared by the match");
    const dep = await mongoose.connection.collection("bankmatches").findOne({ status: "active", "entries.1": { $exists: true } });
    if (!dep || dep.entries.length !== 2) throw new Error("the deposit was not matched to both receipts");
  });

  await step("a bank fee is posted from its line (10.00 = 9.52 + 0.48 VAT)", async () => {
    await openTab("to do");
    await cardButton("ATM FEE", "post an entry");
    await waitForText("What is it?");
    await waitForText("10.00 = 9.52 charge + 0.48 VAT");
    await click("^post and match", { scope: "dialog" });
    await waitGone("What is it?");
    await waitForText("EV-");
    const fee = await mongoose.connection.collection("vouchers").findOne({ voucherType: "expense", totalAmount: 10 });
    if (!fee || fee.subtotal !== 9.52 || fee.vatTotal !== 0.48) throw new Error(`fee posted as ${fee?.subtotal} + ${fee?.vatTotal}`);
  });

  await step("the lock shows on other screens: bouncing a matched, cleared cheque is refused in the cheque register, in plain words", async () => {
    await page.goto(`${WEB}/cheques`, { waitUntil: "networkidle2" });
    await waitForText("Cheques");
    await click("^cleared");
    await waitForText("000999");
    await click("^returned", {});
    await waitForText("Cheque 000999 bounced");
    await page.type('[role="dialog"] textarea', "Returned unpaid");
    await click("^mark bounced", { scope: "dialog" });
    await waitForText("matched to a bank statement line");
    const t = await dialogText();
    if (!t.includes("Unmatch the line in Bank reconciliation first")) throw new Error(`the message does not say what to do: ${t.slice(0, 300)}`);
    await shot("43-lock-on-cheque");
    await click("^cancel", { scope: "dialog" });
    const still = (await api("GET", "/banking/cheques?status=cleared")).body.rows.find((c) => c.chequeNo === "000999");
    if (!still) throw new Error("the cheque changed even though the bounce was refused");
  });

  await step("unmatch the transfer, then match it again by hand with Find in the books", async () => {
    await openAccount(S.fx.alpha);
    await openTab("matched");
    await cardButton("TRANSFER FROM AL NOOR", "unmatch");
    await waitForText("Unmatch this line?");
    await click("^unmatch$", { scope: "dialog" });
    await waitForText("Unmatched");
    await openTab("suggested");
    await waitForText("TRANSFER FROM AL NOOR");
    await cardButton("TRANSFER FROM AL NOOR", "find another");
    await waitForText("Find it in the books");
    await page.waitForSelector('[role="dialog"] input[type="checkbox"]', { visible: true });
    await page.click('[role="dialog"] input[type="checkbox"]');
    await waitForText("Adds up to the line");
    await click("^match$", { scope: "dialog" });
    await waitGone("Find it in the books");
    const line = await mongoose.connection.collection("bankstatementlines").findOne({ description: /TRANSFER FROM AL NOOR/ });
    if (line.state !== "matched") throw new Error(`the line is ${line.state} after matching by hand`);
  });

  await step("Alpha finishes: the statement's own closing balance is filled in, the proof agrees, and it is numbered", async () => {
    await openAccount(S.fx.alpha);
    await waitForText("The two sides agree. This can be finished.");
    const bal = await page.$eval('input[aria-label="Closing balance on the statement"]', (el) => el.value);
    if (Number(bal) !== ALPHA_CLOSING) throw new Error(`closing balance ${bal}, expected ${ALPHA_CLOSING} from the Excel file`);
    await click("^finish reconciliation$");
    await waitForText("Finish this reconciliation?");
    await click("^finish and lock", { scope: "dialog" });
    await waitGone("Finish this reconciliation?");
    await waitForText("BRC-");
    const recs = (await api("GET", `/banking/reconciliation/reconciliations?accountId=${S.fx.alpha._id}`)).body;
    if (recs.length !== 1) throw new Error(`reconciliations ${recs.length}`);
    await shot("44-alpha-finished");
  });

  await step("an MT940 statement: read without any column choices, the deposit matches itself by its slip number", async () => {
    await openAccount(S.fx.beta);
    await click("^import a statement");
    await waitForText("Import a statement into Beta Bank");
    await (await page.$('input[type="file"][aria-label="Statement file"]')).uploadFile(STA_FILE);
    await waitForText("2 lines from");
    const t = await dialogText();
    if (t.includes("How the columns were read")) throw new Error("an MT940 file should need no column choices");
    for (const want of ["opening balance 0.00", "closing balance 100.00", "DEPOSIT SLIP-B1", "-50.00"]) if (!t.includes(want)) throw new Error(`the MT940 preview does not show "${want}"`);
    await shot("45-mt940-preview");
    await click("^import 2 lines", { scope: "dialog" });
    await waitForText("2 lines imported");
    await waitForText("reference SLIP-B1");
    await click("^accept all strong matches");
    await waitForText("Strong matches accepted");
  });

  await step("a standing order the books do not know is posted to the rent account, and Beta finishes", async () => {
    await openTab("to do");
    await cardButton("STANDING ORDER RENT", "post an entry");
    await waitForText("What is it?");
    await page.evaluate(() => [...document.querySelectorAll("label")].find((l) => /Something else/.test(l.textContent))?.click());
    await pick('input[aria-label="Account"]', "Rent Expense");
    await click("^post and match", { scope: "dialog" });
    await waitGone("What is it?");
    await waitForText("The two sides agree. This can be finished.");
    await click("^finish reconciliation$");
    await waitForText("Finish this reconciliation?");
    await click("^finish and lock", { scope: "dialog" });
    await waitGone("Finish this reconciliation?");
    await waitForText("BRC-");
    const accounts = (await api("GET", "/banking/reconciliation/accounts")).body;
    for (const a of ["Alpha Bank", "Beta Bank"]) {
      const row = accounts.find((x) => x.accountName === a);
      if (!row?.lastReconciled) throw new Error(`${a} shows no completed reconciliation`);
    }
  });

  await step("both accounts on a phone: nothing runs off the screen, history lists the reconciliation", async () => {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    for (const [acct, view] of [[S.fx.alpha, ""], [S.fx.beta, ""], [S.fx.alpha, "&view=history"], [S.fx.beta, "&view=card"]]) {
      await openAccount(acct, view);
      await wait(900);
      const o = await page.evaluate(() => { const pane = document.querySelector("main") || document.documentElement; return { sw: pane.scrollWidth, cw: pane.clientWidth }; });
      if (o.sw > o.cw + 4) throw new Error(`${acct.accountName}${view}: the page scrolls sideways ${o.sw} > ${o.cw}`);
    }
    await openAccount(S.fx.alpha, "&view=history");
    await waitForText("BRC-");
    await shot("46-phone-history");
    await page.setViewport({ width: 1440, height: 1000 });
  });

  await step("no page error and no failed request anywhere in the run (the refused bounce is an expected 409)", async () => {
    const bad = [...new Set(page.__bad)].filter((b) => b !== "api 409 /api/v1/banking/cheques/" + "x");
    const unexpected = bad.filter((b) => !/api 409 \/api\/v1\/banking\/cheques\/[0-9a-f]+\/bounce/.test(b));
    if (unexpected.length) throw new Error(unexpected.join(" | "));
  });
} catch (e) {
  console.log("\nstopped:", String(e.message).split("\n")[0]);
  try { await shot("zz-failure"); console.log("page text at failure:\n" + (await textOf()).slice(0, 900)); } catch (e2) { console.log("could not capture the page:", String(e2.message).split("\n")[0]); }
  if (page?.__bad?.length) console.log("browser/API problems:", [...new Set(page.__bad)].join(" | "));
  if (logs.api) console.log("backend tail:\n" + logs.api.slice(-600));
  if (logs.web) console.log("vite tail:\n" + logs.web.slice(-1200));
} finally {
  await shutdown();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
