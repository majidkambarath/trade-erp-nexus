// End to end: a small trading company, on throwaway servers (own database, own ports). The owner makes roles and adds
// people on the real Users and roles screen. Then each person signs in and does their job - or tries to do someone
// else's. Screens are checked in a real browser; documents are made and changed over HTTP with each person's real login
// (the order form is a keyboard grid), and every claim about stock, balances and the audit trail is read from the database.
// Run it with `npm run e2e -- rbac` (see e2e/README.md). It catches what fixtures cannot: the two sides disagreeing about a shape.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

import { FE, BE, OUT } from "./paths.mjs";
const SHOTS = `${OUT}/rbac`;
mkdirSync(SHOTS, { recursive: true });
const rqBE = createRequire(`${BE}/package.json`);
const rqFE = createRequire(`${FE}/package.json`);
process.env.TENANT_LEGACY_DEFAULT = "1";
rqBE("dotenv").config({ path: `${BE}/.env` });
const mongoose = rqBE("mongoose");
const puppeteer = rqFE("puppeteer");

const API_PORT = Number(process.env.E2E_API_PORT) || 4621;
const WEB_PORT = Number(process.env.E2E_WEB_PORT) || 5621;
const API = `http://localhost:${API_PORT}/api/v1`;
const WEB = `http://localhost:${WEB_PORT}`;
const DB = `erp_ui_e2e_${Date.now()}`;
const uri = process.env.MONGO_URI.replace(/\/([^/?]*)\?/, `/${DB}?`);
const PASSWORD = "Passw0rd-123";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  - " + detail : ""}`);
};
const section = (title) => console.log(`\n== ${title}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let api, vite, browser, M, ctx;
const killTree = (child) => {
  if (!child?.pid) return;
  try { if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); else child.kill(); } catch { /* gone */ }
};
const finish = async (code) => {
  try { await browser?.close(); } catch { /* */ }
  killTree(vite);
  killTree(api);
  try { if (mongoose.connection.readyState === 1 && mongoose.connection.name === DB) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); } catch { /* */ }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(code ?? (failed ? 1 : 0));
};
process.on("SIGINT", () => finish(1));

const waitHealthy = async (url, ms = 120000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) { const j = await r.json().catch(() => ({})); if (j.ready !== false) return true; } } catch { /* not yet */ }
    await sleep(500);
  }
  return false;
};
// a step that fails does not stop the story: the rest still runs and reports
const step = async (name, fn) => { try { await fn(); } catch (e) { check(`${name} (could not run)`, false, String(e.message || e).slice(0, 200)); } };

// ---- real HTTP as a real person
const tokens = {};
const login = async (email) => {
  await settle(email);
  const r = await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  const j = await r.json().catch(() => ({}));
  const t = j?.data?.tokens?.accessToken;
  if (!t) throw new Error(`cannot sign in as ${email}: ${r.status} ${JSON.stringify(j).slice(0, 120)}`);
  tokens[email] = t;
  return t;
};
const http = async (who, method, path, body) => {
  const headers = { Authorization: `Bearer ${tokens[who]}` };
  if (body) headers["Content-Type"] = "application/json";
  const r = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, code: j.errorCode, message: j.message, data: j.data, details: j.details, raw: j };
};
const refused = (r) => r.status === 403 && r.code === "PERMISSION_DENIED";

// Everyone added through the product's own screens arrives with a password somebody else chose, so the product stops them
// until they pick their own. Sections 1-10 are about people already past that, so they are let through here; the person in
// GATE_PEOPLE is not, and section 11 is about exactly him.
const GATE_PEOPLE = new Set(["wes@acc.test"]);
const settle = async (email) => {
  if (GATE_PEOPLE.has(email)) return;
  await ctx.runUnscoped("test: a person who has already chosen their own password", async () => { await M.Admin.updateOne({ email }, { $set: { mustChangePassword: false } }); });
};

try {
  // ============================================================ the company, on throwaway servers
  api = spawn(process.execPath, ["server.js"], { cwd: BE, env: { ...process.env, MONGO_URI: uri, PORT: String(API_PORT), LOG_SILENT: "1", TENANT_LEGACY_DEFAULT: "0", CORS_ORIGINS: WEB }, stdio: "ignore" });
  await mongoose.connect(uri);
  M = {
    Admin: rqBE(`${BE}/models/core/adminModel`), Customer: rqBE(`${BE}/models/modules/customerModel`), Stock: rqBE(`${BE}/models/modules/stockModel`),
    Transaction: rqBE(`${BE}/models/modules/transactionModel`), Activity: rqBE(`${BE}/models/modules/financial/activityLogModel`),
    Ledger: rqBE(`${BE}/models/modules/financial/financialModels`), Role: rqBE(`${BE}/models/core/roleModel`),
  };
  const Org = rqBE(`${BE}/services/core/organisationService`);
  ctx = rqBE(`${BE}/utils/tenantContext`);
  await mongoose.connection.syncIndexes();
  if (!(await waitHealthy(`${API}/health`))) throw new Error("backend did not start");
  const org = await Org.create({ legalName: "Acc Trading LLC", code: "acc", country: "AE", baseCurrency: "AED", timezone: "Asia/Dubai", planCode: "premium" });
  if (!org.provisioning.complete) throw new Error("organisation set-up incomplete");
  const as = (fn) => ctx.runWithTenant({ companyId: "acc", branchId: "main" }, fn);
  await as(() => new M.Admin({ name: "Olivia Owner", email: "owner@acc.test", password: PASSWORD, status: "active", isActive: true, type: "super_admin" }).save());
  const customer = await as(() => new M.Customer({ customerId: "CUST001", customerName: "Al Noor Trading", contactPerson: "Ali Hassan", email: "ali@alnoor.test", phone: "0501234567", paymentTerms: "Net 30", creditLimit: 1000000, trnNumber: "100999888700003", billingAddress: "Deira, Dubai" }).save());
  const item = await as(() => new M.Stock({ itemId: "RICE5", sku: "RICE5", itemName: "Rice 5kg", category: new mongoose.Types.ObjectId(), currentStock: 50 }).save());
  await login("owner@acc.test");
  const taxId = (await http("owner@acc.test", "GET", "/accounting/tax-codes")).data.find((c) => c.kind === "standard")?._id;
  if (!taxId) throw new Error("no standard tax code");

  vite = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "--port", String(WEB_PORT), "--strictPort"], { cwd: FE, env: { ...process.env, VITE_API_URL: API }, stdio: "ignore", shell: process.platform === "win32" });
  { const end = Date.now() + 90000; let up = false; while (Date.now() < end && !up) { try { up = (await fetch(`${WEB}/`)).ok; } catch { await sleep(500); } } if (!up) throw new Error("vite did not start"); }
  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  // ---- browser helpers
  const openPage = async (email) => {
    await settle(email);
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    page.on("pageerror", (e) => console.log("   [pageerror]", String(e).slice(0, 200)));
    await page.goto(`${WEB}/`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#email", { timeout: 30000 });
    await page.type("#email", email);
    await page.type("#password", PASSWORD);
    await Promise.all([page.waitForFunction(() => location.pathname !== "/", { timeout: 40000 }), page.click("button[type=submit]")]);
    await sleep(1200);
    return page;
  };
  const go = async (page, path) => { await page.goto(`${WEB}${path}`, { waitUntil: "domcontentloaded" }); await sleep(1800); };
  const labelOf = `(b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").trim()`;
  const offers = (page, re) => page.evaluate((src) => { const re = new RegExp(src, "i"); return [...document.querySelectorAll("button, a")].some((b) => re.test((b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").trim()) && b.offsetParent !== null); }, re.source);
  const click = async (page, re, scope = "button, a, [role=tab]") => {
    const ok = await page.evaluate((src, scope) => {
      const re = new RegExp(src, "i");
      const el = [...document.querySelectorAll(scope)].find((b) => re.test((b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").trim()) && b.offsetParent !== null);
      if (el) el.click();
      return Boolean(el);
    }, re.source, scope);
    if (!ok) throw new Error(`nothing to click for ${re}`);
    await sleep(700);
  };
  const clickInRow = async (page, rowText, re) => {
    await ready(page, rowText);
    await sleep(500);
    const ok = await page.evaluate((rowText, src) => {
      const re = new RegExp(src, "i");
      const row = [...document.querySelectorAll("tr, li")].find((r) => r.textContent.includes(rowText));
      const el = row && [...row.querySelectorAll("button, a")].find((b) => re.test((b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").trim()));
      if (el) el.click();
      return Boolean(el);
    }, rowText, re.source);
    if (!ok) throw new Error(`nothing to click in the row "${rowText}" for ${re}`);
    await sleep(900);
  };
  const tick = async (page, label) => {
    const ok = await page.evaluate((l) => { const el = document.querySelector(`input[aria-label="${l}"]`); if (!el || el.disabled) return false; el.click(); return true; }, label);
    if (!ok) throw new Error(`cannot tick ${label}`);
  };
  const box = (page, label) => page.evaluate((l) => { const el = document.querySelector(`input[aria-label="${l}"]`); return el ? { checked: el.checked, disabled: el.disabled } : null; }, label);
  const chooseOption = (page, optionText) => page.evaluate((optionText) => {
    const sel = [...document.querySelectorAll("[role=dialog] select")].find((s) => [...s.options].some((o) => o.textContent.trim() === optionText));
    if (!sel) return false;
    const opt = [...sel.options].find((o) => o.textContent.trim() === optionText);
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, opt.value);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, optionText);
  const text = (page) => page.evaluate(() => document.body.innerText);
  const ready = async (page, needle, ms = 25000) => { try { await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: ms }, needle); return true; } catch { return false; } };
  const gone = async (page, needle, ms = 25000) => { try { await page.waitForFunction((t) => !document.body.innerText.includes(t), { timeout: ms }, needle); return true; } catch { return false; } };
  // the list is loaded when a row has its own "View" control: only then does "no Edit button" mean anything
  const rowLoaded = async (page, ms = 40000) => { try { await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.getAttribute("title") === "View Details" || /^View (SO|[A-Z]{2,4}-)/.test(b.getAttribute("aria-label") || "")), { timeout: ms }); return true; } catch { return false; } };
  const openOrders = async (page, who) => {
    await go(page, "/sales-order");
    let loaded = false;
    const until = Date.now() + 45000;
    while (Date.now() < until && !loaded) {
      loaded = await rowLoaded(page, 1500);
      if (loaded) break;
      try { await click(page, /^View all orders/); } catch { /* the page is still arriving */ }
      await sleep(800);
    }
    check(`${who}: the order LIST is open with a row on it (so "no such button" means something)`, loaded);
    await sleep(500);
    return loaded;
  };

  // ============================================================ 1. the owner builds the roles and the people on the real screen
  section("1. The owner makes roles and adds people on the Users and roles screen");
  const owner = await openPage("owner@acc.test");
  await go(owner, "/users?tab=roles");
  const makeRole = async (name, ticks) => {
    await click(owner, /^New role$/);
    await owner.waitForSelector('input[aria-label="Sales: View"]', { timeout: 10000 });
    await owner.type("[role=dialog] input:not([type=checkbox])", name);
    for (const t of ticks) await tick(owner, t);
    await click(owner, /^Create role$/);
    await sleep(1500);
    check(`role "${name}" is saved and listed`, (await text(owner)).includes(name));
  };
  await step("roles", async () => {
    await makeRole("Order clerk", ["Sales: Add"]);
    await makeRole("Order corrector", ["Sales: Edit", "Inventory: Edit"]);
    await makeRole("Order approver", ["Sales: Approve"]);
    await makeRole("Order cleaner", ["Sales: Delete approved"]);
    await makeRole("People manager", ["Users and roles: Manage people and roles"]);
  });
  const addPerson = async (name, email, roleName) => {
    await go(owner, "/users");
    await click(owner, /Add a person/);
    await owner.waitForSelector("[role=dialog] input", { timeout: 10000 });
    const inputs = await owner.$$("[role=dialog] input");
    await inputs[0].type(name);
    await inputs[1].type(email);
    await inputs[2].type(PASSWORD);
    if (!(await chooseOption(owner, roleName))) throw new Error(`role "${roleName}" is not offered`);
    await click(owner, /^Add person$/);
    await sleep(1500);
  };
  await step("people", async () => {
    await addPerson("Cyrus Clerk", "cyrus@acc.test", "Order clerk");
    await addPerson("Carla Corrector", "carla@acc.test", "Order corrector");
    await addPerson("Arun Approver", "arun@acc.test", "Order approver");
    await addPerson("Dina Cleaner", "dina@acc.test", "Order cleaner");
    await addPerson("Pam Manager", "pam@acc.test", "People manager");
    await addPerson("Vera Viewer", "vera@acc.test", "Viewer");
    await go(owner, "/users");
    await ready(owner, "Vera Viewer");
    await sleep(500);
    const t = await text(owner);
    check("all six people are listed with their roles", ["Cyrus Clerk", "Carla Corrector", "Arun Approver", "Dina Cleaner", "Pam Manager", "Vera Viewer", "Order clerk", "Order approver", "People manager", "Viewer"].every((s) => t.includes(s)));
    await owner.screenshot({ path: `${SHOTS}/01-people.png` });
  });
  for (const who of ["cyrus", "carla", "arun", "dina", "pam", "vera"]) await step(`sign in ${who}`, () => login(`${who}@acc.test`));

  const order = (qty, price = 20) => ({ type: "sales_order", partyId: String(customer._id), partyType: "Customer", partyTypeRef: "Customer", createdBy: "e2e", items: [{ itemId: String(item._id), description: "Rice 5kg", qty, price, rate: price, vatPercent: 5, taxCodeId: taxId }] });
  const until = async (fn, ms = 30000) => { const end = Date.now() + ms; for (;;) { const v = await fn(); if (v || Date.now() > end) return v; await sleep(500); } };
  const dbOrder = (id) => as(() => M.Transaction.findById(id).lean());
  const dbStock = async () => (await as(() => M.Stock.findById(item._id).lean())).currentStock;
  const dbCustomer = async () => (await as(() => M.Customer.findById(customer._id).lean())).cashBalance;
  const arAccount = async () => (await as(() => M.Ledger.LedgerAccount.findOne({ accountName: /Al Noor/ }).lean()))?.currentBalance;

  let so1, so2;

  // ============================================================ 2. the clerk adds
  section("2. The clerk adds an order - and can do nothing else to it");
  await step("clerk adds", async () => {
    const r = await http("cyrus@acc.test", "POST", "/transactions/transactions", order(5));
    check("clerk adds a draft sales order (201)", r.status === 201, `${r.status} ${r.message || ""}`);
    so1 = r.data?._id;
    check("it is a DRAFT with a document number", (await dbOrder(so1))?.status === "DRAFT" && /SO-/.test((await dbOrder(so1))?.transactionNo || ""));
    check("clerk cannot change it", refused(await http("cyrus@acc.test", "PUT", `/transactions/transactions/${so1}`, order(7))));
    check("clerk cannot approve it", refused(await http("cyrus@acc.test", "PATCH", `/transactions/transactions/${so1}/process`, { action: "approve" })));
    check("clerk cannot delete it", refused(await http("cyrus@acc.test", "DELETE", `/transactions/transactions/${so1}`)));
    check("clerk cannot touch stock quantity", refused(await http("cyrus@acc.test", "PATCH", `/stock/stock/${item._id}/quantity`, { quantity: 1 })));
    check("clerk cannot open the books", refused(await http("cyrus@acc.test", "GET", "/vouchers/vouchers")));
  });
  const cyrus = await openPage("cyrus@acc.test");
  await step("clerk's screen", async () => {
    await openOrders(cyrus, "clerk");
    await cyrus.screenshot({ path: `${SHOTS}/02-clerk-orders.png` });
    check("clerk's screen: the order is listed", (await text(cyrus)).includes("Al Noor"));
    check("clerk's screen: New sales order is offered", await offers(cyrus, /New sales order/));
    check("clerk's screen: no Edit, no Confirm", !(await offers(cyrus, /^Edit$/)) && !(await offers(cyrus, /^Confirm$/)));
    check("clerk's screen: no Delete", !(await offers(cyrus, /^Delete$/)));
  });

  // ============================================================ 3. the viewer
  section("3. A viewer sees it and changes nothing");
  const vera = await openPage("vera@acc.test");
  await step("viewer", async () => {
    check("viewer reads the orders over the API", (await http("vera@acc.test", "GET", `/transactions/transactions/${so1}`)).status === 200);
    for (const [m, p, b] of [["POST", "/transactions/transactions", order(1)], ["PUT", `/transactions/transactions/${so1}`, order(1)], ["PATCH", `/transactions/transactions/${so1}/process`, { action: "approve" }], ["DELETE", `/transactions/transactions/${so1}`], ["POST", "/customers", {}], ["PATCH", `/stock/stock/${item._id}/quantity`, { quantity: 1 }]]) {
      check(`viewer refused: ${m} ${p.split("/").slice(0, 3).join("/")}`, refused(await http("vera@acc.test", m, p, b)));
    }
    await openOrders(vera, "viewer");
    await vera.screenshot({ path: `${SHOTS}/03-viewer-orders.png` });
    check("viewer's screen: the order is listed", (await text(vera)).includes("Al Noor"));
    check("viewer's screen: no New, Edit, Confirm or Delete", !(await offers(vera, /New sales order/)) && !(await offers(vera, /^Edit$/)) && !(await offers(vera, /^Confirm$/)) && !(await offers(vera, /^Delete$/)));
  });

  // ============================================================ 4. the corrector edits
  section("4. The corrector fixes the draft - and cannot add, approve or move stock");
  const carla = await openPage("carla@acc.test");
  await step("corrector", async () => {
    const r = await http("carla@acc.test", "PUT", `/transactions/transactions/${so1}`, order(6));
    check("corrector changes the draft (200)", r.status === 200, `${r.status} ${r.message || ""}`);
    check("the change is stored (quantity 6)", (await dbOrder(so1))?.items?.[0]?.qty === 6);
    check("corrector cannot add a new order", refused(await http("carla@acc.test", "POST", "/transactions/transactions", order(1))));
    check("corrector cannot approve", refused(await http("carla@acc.test", "PATCH", `/transactions/transactions/${so1}/process`, { action: "approve" })));
    check("corrector cannot delete", refused(await http("carla@acc.test", "DELETE", `/transactions/transactions/${so1}`)));
    const rename = await http("carla@acc.test", "PUT", `/stock/stock/${item._id}`, { itemName: "Rice 5kg (bag)", currentStock: 50 });
    check("corrector renames the item, sending the quantity unchanged (200)", rename.status === 200, `${rename.status} ${rename.message || ""}`);
    const sneak = await http("carla@acc.test", "PUT", `/stock/stock/${item._id}`, { currentStock: 5 });
    check("corrector cannot correct the quantity through an item edit", refused(sneak) && sneak.details?.required?.[0] === "inventory.adjust");
    check("the quantity is still 50", (await dbStock()) === 50);
    await openOrders(carla, "corrector");
    await carla.screenshot({ path: `${SHOTS}/04-corrector-orders.png` });
    check("corrector's screen: Edit offered; no New, no Confirm, no Delete", (await offers(carla, /^Edit$/)) && !(await offers(carla, /New sales order/)) && !(await offers(carla, /^Confirm$/)) && !(await offers(carla, /^Delete$/)));
  });

  // ============================================================ 5. the approver approves on the real screen
  section("5. The approver approves it on the real screen - stock and the books move");
  const arun = await openPage("arun@acc.test");
  await step("approver", async () => {
    const stockBefore = await dbStock();
    const balanceBefore = await dbCustomer();
    await openOrders(arun, "approver");
    check("approver's screen: Confirm offered; no Edit, no New, no Delete", (await offers(arun, /^Confirm$/)) && !(await offers(arun, /^Edit$/)) && !(await offers(arun, /New sales order/)) && !(await offers(arun, /^Delete$/)));
    await arun.screenshot({ path: `${SHOTS}/05-approver-before.png` });
    await click(arun, /^Confirm$/);
    await until(async () => (await dbOrder(so1))?.status === "APPROVED");
    await arun.screenshot({ path: `${SHOTS}/06-approver-after.png` });
    const approved = await dbOrder(so1);
    check("the order is APPROVED", approved?.status === "APPROVED", approved?.status);
    const stockAfter = await dbStock();
    check("stock fell by the quantity ordered (50 -> 44)", stockAfter === stockBefore - 6, `${stockBefore} -> ${stockAfter}`);
    const after = await dbCustomer();
    check("the customer now owes 126.00 (6 x 20 + 5% VAT)", Math.abs(Math.abs(after - balanceBefore) - 126) < 0.01, `${balanceBefore} -> ${after}`);
    check("the ledger account for the customer moved by the same amount", Math.abs(Math.abs((await arAccount()) ?? 0) - 126) < 0.01, String(await arAccount()));
    check("approver cannot edit an approved order", refused(await http("arun@acc.test", "PUT", `/transactions/transactions/${so1}`, order(1))));
    check("approver cannot delete it", refused(await http("arun@acc.test", "DELETE", `/transactions/transactions/${so1}`)));
    check("approver cannot acknowledge a credit-limit warning", refused(await http("arun@acc.test", "PATCH", `/transactions/transactions/${so1}/process`, { action: "approve", riskAck_limit_party_credit: true })));
    check("approver still cannot add an order", refused(await http("arun@acc.test", "POST", "/transactions/transactions", order(1))));
  });

  // ============================================================ 6. the cleaner deletes - a draft on the screen, an approved invoice over the API
  section("6. The cleaner deletes - a draft on the screen, then an approved invoice (reversed in stock and ledger)");
  const dina = await openPage("dina@acc.test");
  await step("cleaner", async () => {
    const draft = await http("cyrus@acc.test", "POST", "/transactions/transactions", order(2));
    so2 = draft.data?._id;
    check("the clerk adds a second draft", draft.status === 201);
    await openOrders(dina, "cleaner");
    await dina.screenshot({ path: `${SHOTS}/07-cleaner-orders.png` });
    check("cleaner's screen: Delete offered on the draft; no Edit, no Confirm, no New", (await offers(dina, /^Delete$/)) && !(await offers(dina, /^Edit$/)) && !(await offers(dina, /^Confirm$/)) && !(await offers(dina, /New sales order/)));
    await click(dina, /^Delete$/);
    await dina.waitForSelector("[role=dialog] input", { timeout: 10000 });
    await dina.type("[role=dialog] input", "delete");
    await dina.screenshot({ path: `${SHOTS}/07b-cleaner-confirm.png` });
    await click(dina, /^Delete$/, "[role=dialog] button");
    await until(async () => (await dbOrder(so2)) === null);
    check("the draft is gone", (await dbOrder(so2)) === null);
    const stockBefore = await dbStock();
    const r = await http("dina@acc.test", "DELETE", `/transactions/transactions/${so1}`);
    check("cleaner deletes the approved invoice (200 or 204)", r.status === 200 || r.status === 204, `${r.status} ${r.message || ""}`);
    check("stock is back to 50", (await dbStock()) === 50, `${stockBefore} -> ${await dbStock()}`);
    check("the customer owes nothing again", Math.abs(await dbCustomer()) < 0.01, String(await dbCustomer()));
    check("the ledger account is back to zero", Math.abs((await arAccount()) ?? 0) < 0.01, String(await arAccount()));
    check("cleaner cannot add or edit", refused(await http("dina@acc.test", "POST", "/transactions/transactions", order(1))));

    // The decision: deleting an APPROVED invoice reverses stock and ledger, so Delete alone is not enough.
    await http("owner@acc.test", "POST", "/access/roles", { key: "draft_deleter", name: "Draft deleter", rank: 30, permissions: ["sales.delete"] });
    const added = await http("owner@acc.test", "POST", "/access/users", { name: "Dee Deleter", email: "dee@acc.test", password: PASSWORD, role: "draft_deleter" });
    check("a Delete-only person is added", added.status === 201, JSON.stringify(added.message || added.code));
    await login("dee@acc.test");
    const d4 = await http("cyrus@acc.test", "POST", "/transactions/transactions", order(2));
    const so4 = d4.data?._id;
    const ap = await http("arun@acc.test", "PATCH", `/transactions/transactions/${so4}/process`, { action: "approve" });
    check("an approved invoice is ready for the Delete-only check", ap.status === 200 && (await dbOrder(so4))?.status === "APPROVED", `${ap.status} ${ap.message || ""}`);
    const held = await dbStock();
    const no = await http("dee@acc.test", "DELETE", `/transactions/transactions/${so4}`);
    check("a Delete-only role is refused on an approved invoice, and the refusal names what is missing", no.status === 403 && no.code === "PERMISSION_DENIED" && JSON.stringify(no.details).includes("sales.deletePosted"), `${no.status} ${no.code} ${JSON.stringify(no.details)}`);
    check("nothing moved: still approved, stock as it was", (await dbOrder(so4))?.status === "APPROVED" && (await dbStock()) === held, `${(await dbOrder(so4))?.status} ${held} -> ${await dbStock()}`);
    const d5 = await http("cyrus@acc.test", "POST", "/transactions/transactions", order(1));
    const yes = await http("dee@acc.test", "DELETE", `/transactions/transactions/${d5.data?._id}`);
    check("the same role still deletes a draft", yes.status === 200 || yes.status === 204, `${yes.status} ${yes.message || ""}`);
    const undo = await http("dina@acc.test", "DELETE", `/transactions/transactions/${so4}`);
    check("and the cleaner, who holds Delete approved, reverses the invoice", (undo.status === 200 || undo.status === 204) && (await dbStock()) === held + 2, `${undo.status} stock ${held} -> ${await dbStock()}`);
  });

  // ============================================================ 7. who may manage people, and how far
  section("7. A people manager cannot build or hand out more power than they hold");
  const pam = await openPage("pam@acc.test");
  await step("people manager", async () => {
    check("pam adds a viewer (201)", (await http("pam@acc.test", "POST", "/access/users", { name: "Wes Watcher", email: "wes@acc.test", password: PASSWORD, role: "viewer" })).status === 201);
    const toAdmin = await http("pam@acc.test", "POST", "/access/users", { name: "Xavier Admin", email: "x@acc.test", password: PASSWORD, role: "admin" });
    check("pam cannot make anyone an administrator", toAdmin.status === 403 && toAdmin.code !== "NAME_REQUIRED", `${toAdmin.status} ${toAdmin.code} ${toAdmin.message || ""}`);
    const toManager = await http("pam@acc.test", "POST", "/access/users", { name: "Yara Manager", email: "y@acc.test", password: PASSWORD, role: "manager" });
    check("pam cannot give a role above her own (manager)", toManager.status === 403 && toManager.code !== "NAME_REQUIRED", `${toManager.status} ${toManager.code} ${toManager.message || ""}`);
    const up = await http("pam@acc.test", "POST", "/access/roles", { key: "boss", name: "Boss", rank: 60, permissions: ["sales.view"] });
    check("pam cannot make a role that ranks above her own", up.status >= 400 && up.status < 500, `${up.status} ${up.code}`);
    const more = await http("pam@acc.test", "POST", "/access/roles", { key: "sneaky", name: "Sneaky", rank: 20, permissions: ["finance.approve"] });
    check("pam cannot make a role that grants what she does not hold", more.status >= 400 && more.status < 500, `${more.status} ${more.code} ${more.message || ""}`);
    check("pam cannot change the owner", (await http("pam@acc.test", "PATCH", `/access/users/${(await as(() => M.Admin.findOne({ email: "owner@acc.test" }).lean()))._id}`, { name: "Hacked" })).status === 403);
    check("pam cannot open Finance", refused(await http("pam@acc.test", "GET", "/vouchers/vouchers")));
    await go(pam, "/users?tab=roles");
    await click(pam, /^New role$/);
    await pam.waitForSelector('input[aria-label="Sales: View"]', { timeout: 10000 });
    await pam.screenshot({ path: `${SHOTS}/08-people-manager-editor.png` });
    const approve = await box(pam, "Sales: Approve");
    check("pam's role editor: Sales: Approve is disabled (she does not hold it)", approve?.disabled === true, JSON.stringify(approve));
    const own = await box(pam, "Users and roles: Manage people and roles");
    check("pam's role editor: a box she does hold is free", own?.disabled === false, JSON.stringify(own));
    const ranks = await pam.evaluate(() => [...document.querySelectorAll("[role=dialog] select option")].map((o) => o.value));
    check("pam's rank choices are all below her own (40)", ranks.length > 0 && ranks.every((v) => Number(v) < 40), JSON.stringify(ranks));
  });

  // ============================================================ 8. a change of role bites at once
  section("8. The owner changes a person's role: it takes effect on their next request");
  await step("demotion", async () => {
    const draft = await http("cyrus@acc.test", "POST", "/transactions/transactions", order(3));
    const so3 = draft.data?._id;
    check("the clerk adds a third draft for the demotion check", draft.status === 201, String(draft.status));
    await openOrders(carla, "corrector (before)");
    check("before: carla's screen offers Edit on the draft", await offers(carla, /^Edit$/));
    const stillWorks = await http("carla@acc.test", "PUT", `/transactions/transactions/${so3}`, order(4));
    check("before: carla's edit really works (200)", stillWorks.status === 200, `${stillWorks.status} ${stillWorks.message || ""}`);
    await go(owner, "/users");
    await clickInRow(owner, "Carla Corrector", /Change/);
    await owner.waitForSelector("[role=dialog] select", { timeout: 10000 });
    if (!(await chooseOption(owner, "Viewer"))) throw new Error("Viewer is not offered");
    await click(owner, /^Save$/);
    await sleep(1800);
    check("after: carla's SAME session is refused straight away", refused(await http("carla@acc.test", "PUT", `/transactions/transactions/${so3}`, order(5))));
    check("after: the draft is unchanged (still 4)", (await dbOrder(so3))?.items?.[0]?.qty === 4);
    await openOrders(carla, "demoted corrector");
    await carla.screenshot({ path: `${SHOTS}/09-carla-demoted.png` });
    check("after: carla's screen no longer shows Edit on that same draft", !(await offers(carla, /^Edit$/)));
  });

  // ============================================================ 9. roles in use cannot be pulled away
  section("9. A role in use cannot be removed; once nobody holds it, it can");
  await step("removal", async () => {
    await go(owner, "/users?tab=roles");
    await ready(owner, "Order approver");
    await sleep(600);
    const disabled = await owner.evaluate(() => document.querySelector('button[aria-label="Remove Order approver"]')?.disabled);
    check("the Remove button for a role someone holds is disabled", disabled === true, String(disabled));
    const r = await http("owner@acc.test", "DELETE", "/access/roles/order_approver");
    check("the server refuses too", r.status >= 400 && r.status < 500, `${r.status} ${r.code} ${r.message || ""}`);
    const arunId = (await as(() => M.Admin.findOne({ email: "arun@acc.test" }).lean()))._id;
    check("owner moves arun to Viewer (200)", (await http("owner@acc.test", "PATCH", `/access/users/${arunId}`, { role: "viewer" })).status === 200);
    check("arun, still signed in, can no longer approve", refused(await http("arun@acc.test", "PATCH", `/transactions/transactions/${so1 ?? "x"}/process`, { action: "approve" })));
    const gone = await http("owner@acc.test", "DELETE", "/access/roles/order_approver");
    check("now the role can be removed (200)", gone.status === 200, `${gone.status} ${gone.message || ""}`);
    check("and it is no longer listed", !(await http("owner@acc.test", "GET", "/access/roles")).data.roles.some((x) => x.key === "order_approver"));
  });

  // ============================================================ 10. the trail
  section("10. Everything is on the record");
  await step("audit", async () => {
    const denied = await as(() => M.Activity.find({ action: "PERMISSION_DENIED" }).lean());
    check("the refusals are written to the activity trail", denied.length >= 10, `${denied.length} rows`);
    check("each names who tried", denied.every((d) => d.username), [...new Set(denied.map((d) => d.username))].join(", "));
    const who = new Set(denied.map((d) => d.username));
    check("the trail names more than one person (clerk, viewer, approver ...)", who.size >= 3, [...who].join(", "));
    const actions = await as(() => M.Activity.find({ action: { $regex: /^TRANSACTION_/ } }).lean());
    check("the document changes are recorded with who made them", actions.length >= 3 && actions.some((a) => /cyrus/.test(a.username || "")) && actions.some((a) => /arun/.test(a.username || "")), actions.map((a) => `${a.action}:${(a.username || "").split("@")[0]}`).join(" "));
  });

  // ============================================================ 11. a password somebody else chose
  section("11. A person added by an administrator must choose their own password before anything else");
  await step("first sign-in", async () => {
    const NEW_PASSWORD = "Wes-chose-this-77";
    const flag = async () => (await as(() => M.Admin.findOne({ email: "wes@acc.test" }).select("mustChangePassword").lean()))?.mustChangePassword;
    check("wes was added with a password pam chose, so he is marked as needing his own", (await flag()) === true, String(await flag()));

    await login("wes@acc.test");
    const shut = await http("wes@acc.test", "GET", "/customers/customers");
    check("over the API: everything but the password change is refused (403 PASSWORD_CHANGE_REQUIRED)", shut.status === 403 && shut.code === "PASSWORD_CHANGE_REQUIRED", `${shut.status} ${shut.code}`);
    const status = await http("wes@acc.test", "GET", "/organisation/status");
    check("but the status still answers, and says why", status.status === 200 && status.data?.me?.mustChangePassword === true, `${status.status} ${JSON.stringify(status.data?.me?.mustChangePassword)}`);

    const wes = await openPage("wes@acc.test");
    await wes.waitForFunction(() => /Choose your own password/.test(document.body.innerText), { timeout: 30000 });
    await wes.screenshot({ path: `${SHOTS}/11-first-sign-in.png` });
    check("in the browser: the whole app is replaced by one page asking for a password of his own", (await offers(wes, /Save my password/)) && (await offers(wes, /Sign out/)) && !(await offers(wes, /Dashboard|Customers|Sales|Finance|Inventory/)));

    const fill = async (current, next, again) => {
      const inputs = await wes.$$("form input[autocomplete]");
      if (inputs.length !== 3) throw new Error(`expected 3 password boxes, found ${inputs.length}`);
      for (const [box, text] of [[inputs[0], current], [inputs[1], next], [inputs[2], again]]) { await box.evaluate((node) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(node, ""); node.dispatchEvent(new Event("input", { bubbles: true })); }); await box.click(); await box.type(text); }
    };
    await fill("Not-his-password-1", NEW_PASSWORD, NEW_PASSWORD);
    await click(wes, /^Save my password$/);
    await wes.waitForSelector("[role=alert]", { timeout: 15000 });
    const said = await wes.evaluate(() => document.querySelector("[role=alert]")?.textContent || "");
    check("a wrong current password is refused in the server's words, and he stays on the page", /incorrect/i.test(said) && /Choose your own password/.test(await wes.evaluate(() => document.body.innerText)), said);
    check("and nothing changed", (await flag()) === true);

    await fill(PASSWORD, "short", "short");
    await click(wes, /^Save my password$/);
    await sleep(500);
    check("a password under 8 characters is refused on the page, before any request", /at least 8 characters/i.test(await wes.evaluate(() => document.body.innerText)) && (await flag()) === true);

    await fill(PASSWORD, NEW_PASSWORD, NEW_PASSWORD);
    await click(wes, /^Save my password$/);
    await wes.waitForFunction(() => !/Choose your own password/.test(document.body.innerText), { timeout: 30000 });
    await sleep(1500);
    await wes.screenshot({ path: `${SHOTS}/12-after-choosing.png` });
    check("the right current password and a good new one: the gate lifts, with no second sign-in", !(await wes.evaluate(() => /Choose your own password/.test(document.body.innerText))) && (await wes.evaluate(() => location.pathname)) !== "/");
    check("the mark is cleared in the database", (await flag()) === false, String(await flag()));
    const open = await http("wes@acc.test", "GET", "/customers/customers");
    check("the same token now works (a viewer can read customers)", open.status === 200, `${open.status} ${open.code || ""}`);

    const signIn = async (password) => (await fetch(`${API}/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "wes@acc.test", password }) })).status;
    check("the new password signs in, and the one pam chose no longer does", (await signIn(NEW_PASSWORD)) === 200 && (await signIn(PASSWORD)) === 401);
    const reset = await http("pam@acc.test", "PATCH", `/access/users/${(await as(() => M.Admin.findOne({ email: "wes@acc.test" }).lean()))._id}`, { password: "Pam-reset-it-88" });
    check("when pam resets his password he is stopped again", reset.status === 200 && (await flag()) === true, `${reset.status} ${reset.code || ""} ${await flag()}`);
  });

  // ============================================================ 12. who may approve what
  section("12. Approval limits, and a second approver above an amount");
  await step("approvals", async () => {
    const rowButtons = (page, rowText) => page.evaluate((t) => {
      const row = [...document.querySelectorAll("tr, li")].find((r) => r.textContent.includes(t));
      return row ? [...row.querySelectorAll("button, a")].map((b) => (b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").trim()) : null;
    }, rowText);
    const offersConfirm = async (page, rowText) => ((await rowButtons(page, rowText)) || []).some((b) => /^Confirm$/.test(b));
    const rowShown = (page, rowText) => until(async () => (await rowButtons(page, rowText)) !== null, 40000);
    const addPersonApi = async (name, email, role) => {
      const r = await http("owner@acc.test", "POST", "/access/users", { name, email, password: PASSWORD, role });
      if (r.status !== 201) throw new Error(`cannot add ${email}: ${r.status} ${r.message || ""}`);
      await login(email);
    };

    // a role with an approval limit, made on the real role editor
    await go(owner, "/users?tab=roles");
    await click(owner, /^New role$/);
    await owner.waitForSelector('input[aria-label="Sales: View"]', { timeout: 10000 });
    await owner.type("[role=dialog] input:not([type=checkbox])", "Junior approver");
    await tick(owner, "Sales: Approve");
    await owner.waitForSelector('[role=dialog] input[placeholder="No limit"]', { timeout: 10000 });
    await owner.type('[role=dialog] input[placeholder="No limit"]', "500");
    await owner.screenshot({ path: `${SHOTS}/13-role-with-limit.png` });
    await click(owner, /^Create role$/);
    await sleep(1500);
    const junior = (await http("owner@acc.test", "GET", "/access/roles")).data.roles.find((r) => r.name === "Junior approver");
    check("the role editor saves an approval limit of 500", junior?.approvalLimit === 500, JSON.stringify(junior?.approvalLimit));

    // the organisation's rule, set on the real Settings screen: a second approver above 100
    await go(owner, "/settings?tab=rules");
    await owner.waitForSelector('input[placeholder="No second approver"]', { timeout: 30000 });
    await owner.type('input[placeholder="No second approver"]', "100");
    await owner.screenshot({ path: `${SHOTS}/14-approval-rules.png` });
    await click(owner, /^Save approval rules$/);
    const saved = await until(async () => (await http("owner@acc.test", "GET", "/accounting/settings")).data?.approvals?.secondApprovalAbove === 100, 20000);
    check("Settings saves a second-approver threshold of 100", saved);

    await addPersonApi("Mia Manager", "mia@acc.test", "manager");
    await addPersonApi("Max Manager", "max@acc.test", "manager");
    await addPersonApi("Jo Junior", "jo@acc.test", junior.key);

    const big = await http("cyrus@acc.test", "POST", "/transactions/transactions", order(40)); // 40 x 20 + 5% = 840
    const bigId = big.data?._id;
    const bigNo = big.data?.transactionNo;
    check("the clerk prepares an 840.00 order", big.status === 201 && Boolean(bigNo), `${big.status} ${big.message || ""}`);
    const stockBefore = await dbStock();

    // the first approver, on the real screen
    const mia = await openPage("mia@acc.test");
    await openOrders(mia, "first approver");
    await rowShown(mia, bigNo);
    check("mia is offered Confirm on the 840.00 order", await offersConfirm(mia, bigNo));
    await clickInRow(mia, bigNo, /^Confirm$/);
    const toast = await ready(mia, "First approval recorded", 15000);
    await until(async () => ((await dbOrder(bigId))?.approvals || []).length === 1);
    await mia.screenshot({ path: `${SHOTS}/15-first-approval.png` });
    const afterFirst = await dbOrder(bigId);
    check("the first approval is recorded, and the order is NOT approved", afterFirst.status === "DRAFT" && afterFirst.approvals.length === 1 && afterFirst.approvals[0].name === "Mia Manager", `${afterFirst.status} ${JSON.stringify(afterFirst.approvals)}`);
    check("nothing moved: the stock is as it was", (await dbStock()) === stockBefore, `${stockBefore} -> ${await dbStock()}`);
    check("the screen says the first approval was recorded, not that it was approved", toast);
    check("and marks the order as awaiting a second approver", await ready(mia, "Awaiting second approval", 15000));
    check("mia is no longer offered Confirm on it (she gave the first)", await until(async () => !(await offersConfirm(mia, bigNo)), 15000));
    const again = await http("mia@acc.test", "PATCH", `/transactions/transactions/${bigId}/process`, { action: "approve" });
    check("and the server refuses a second approval from her", again.status === 403 && again.code === "SECOND_APPROVER_REQUIRED", `${again.status} ${again.code}`);

    // someone whose limit is below the order
    const jo = await openPage("jo@acc.test");
    await openOrders(jo, "limited approver");
    await rowShown(jo, bigNo);
    check("jo (limit 500) is not offered Confirm on an 840.00 order", !(await offersConfirm(jo, bigNo)));
    const joTry = await http("jo@acc.test", "PATCH", `/transactions/transactions/${bigId}/process`, { action: "approve" });
    check("and the server refuses him, naming the limit", joTry.status === 403 && joTry.code === "APPROVAL_LIMIT_EXCEEDED" && joTry.details?.limit === 500, `${joTry.status} ${joTry.code} ${JSON.stringify(joTry.details)}`);

    // a different person finishes it
    const max = await openPage("max@acc.test");
    await openOrders(max, "second approver");
    await rowShown(max, bigNo);
    check("max is offered Confirm on it", await offersConfirm(max, bigNo));
    await clickInRow(max, bigNo, /^Confirm$/);
    await until(async () => (await dbOrder(bigId))?.status === "APPROVED");
    const final = await dbOrder(bigId);
    check("the second, different person's approval approves it", final.status === "APPROVED" && final.approvals.length === 2 && final.approvals.map((a) => a.name).join() === "Mia Manager,Max Manager", `${final.status} ${JSON.stringify(final.approvals)}`);
    check("only now does the stock move (40 out)", (await dbStock()) === stockBefore - 40, `${stockBefore} -> ${await dbStock()}`);

    // under the threshold one approval is enough, as before
    const small = await http("cyrus@acc.test", "POST", "/transactions/transactions", order(1)); // 21.00
    const one = await http("mia@acc.test", "PATCH", `/transactions/transactions/${small.data?._id}/process`, { action: "approve" });
    check("a small order (21.00) is approved by one person, as before", one.status === 200 && (await dbOrder(small.data?._id))?.status === "APPROVED");

    // put things back
    await http("owner@acc.test", "DELETE", `/transactions/transactions/${bigId}`);
    await http("owner@acc.test", "DELETE", `/transactions/transactions/${small.data?._id}`);
    await http("owner@acc.test", "PUT", "/accounting/settings", { approvals: { secondApprovalAbove: "" } });
    check("and the threshold is switched off again", (await http("owner@acc.test", "GET", "/accounting/settings")).data?.approvals?.secondApprovalAbove === null);
  });

  // ============================================================ 13. a different role in a branch
  section("13. A different role in a branch: set on the Users screen, used through the branch switcher");
  await step("branch roles", async () => {
    const rowButtonsOf = (page, rowText) => page.evaluate((t) => {
      const row = [...document.querySelectorAll("tr, li")].find((r) => r.textContent.includes(t));
      return row ? [...row.querySelectorAll("button, a")].map((b) => (b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").trim()) : null;
    }, rowText);
    void rowButtonsOf;
    const made = await http("owner@acc.test", "POST", "/branches", { code: "shj", name: "Sharjah" });
    check("a second branch exists", made.status === 201, `${made.status} ${made.message || ""}`);

    await go(owner, "/users");
    await clickInRow(owner, "Vera Viewer", /Change/);
    await owner.waitForSelector("[role=dialog] input", { timeout: 10000 });
    await click(owner, /Add a branch/);
    await owner.waitForSelector('[aria-label="Row 1: branch"]', { timeout: 10000 });
    const pick = (label, optionText) => owner.evaluate((l, t) => {
      const sel = document.querySelector(`[aria-label="${l}"]`);
      const opt = sel && [...sel.options].find((o) => o.textContent.trim() === t);
      if (!opt) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, opt.value);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, label, optionText);
    check("the dialog offers Sharjah, and the Order clerk role", (await pick("Row 1: branch", "Sharjah")) && (await pick("Row 1: role", "Order clerk")));
    await owner.screenshot({ path: `${SHOTS}/16-branch-role-dialog.png` });
    await click(owner, /^Save$/);
    await sleep(1800);
    const veraRow = (await http("owner@acc.test", "GET", "/access/users")).data.find((u) => u.email === "vera@acc.test");
    check("the role in Sharjah is saved", veraRow?.branchRoles?.length === 1 && veraRow.branchRoles[0].branchId === "shj" && veraRow.branchRoles[0].role.name === "Order clerk", JSON.stringify(veraRow?.branchRoles));
    await go(owner, "/users");
    check("and the list says where she holds another role", await ready(owner, "Order clerk in Sharjah", 20000));

    // vera, a viewer at head office, in the browser
    const vera = await openPage("vera@acc.test");
    const veraToken = tokens["vera@acc.test"];
    await openOrders(vera, "viewer at head office");
    check("at head office vera (a viewer) is not offered New sales order", !(await offers(vera, /New sales order/)));
    await vera.click('button[aria-label^="Branch:"]');
    await vera.waitForSelector("[role=menuitem]", { timeout: 10000 });
    const items = await vera.$$eval("[role=menuitem]", (els) => els.map((e) => e.textContent.trim()));
    check("her switcher lists the branches and does NOT offer All branches", items.some((t) => /Sharjah/.test(t)) && items.some((t) => /Head office/i.test(t)) && !items.some((t) => /All branches/i.test(t)), JSON.stringify(items));
    for (const handle of await vera.$$("[role=menuitem]")) {
      if (/Sharjah/.test(await handle.evaluate((e) => e.textContent))) { await handle.click(); break; }
    }
    const offered = await until(async () => offers(vera, /New sales order/), 40000);
    await vera.screenshot({ path: `${SHOTS}/17-vera-in-sharjah.png` });
    check("in Sharjah she holds the clerk role: New sales order is offered", offered);
    check("the choice is remembered for the tab", (await vera.evaluate(() => sessionStorage.getItem("zarvia.branch"))) === "shj");

    const postAs = (branch) => fetch(`${API}/transactions/transactions`, { method: "POST", headers: { Authorization: `Bearer ${veraToken}`, "Content-Type": "application/json", ...(branch ? { "X-Branch": branch } : {}) }, body: JSON.stringify(order(1)) });
    const atMain = await postAs(null);
    check("the server refuses her at head office (a viewer)", atMain.status === 403, String(atMain.status));
    const atShj = await postAs("shj");
    const body = await atShj.json().catch(() => ({}));
    check("and lets her add in Sharjah (a clerk)", atShj.status === 201, `${atShj.status} ${body.message || ""}`);

    // taking it away bites on the next request with the same token
    const veraId = (await as(() => M.Admin.findOne({ email: "vera@acc.test" }).lean()))._id;
    check("the owner takes the Sharjah role away", (await http("owner@acc.test", "PATCH", `/access/users/${veraId}`, { branchRoles: [] })).status === 200);
    const after = await postAs("shj");
    check("and the same token is a viewer there again", after.status === 403, String(after.status));
  });

  await finish();
} catch (error) {
  console.error("FAILED TO RUN:", error);
  results.push({ name: "harness", ok: false });
  await finish(1);
}
