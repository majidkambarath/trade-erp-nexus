// A real-browser check of roles: a throwaway backend (own database) and a throwaway Vite, a real owner who makes roles and
// people on the Users and roles screen, then each person signed in to see what the screens offer. Nothing here touches
// the developer's own servers or database.
// Run it with `npm run e2e -- rbac-screens` (see e2e/README.md). It catches what fixtures cannot: the two sides disagreeing about a shape.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

import { FE, BE, OUT } from "./paths.mjs";
const SHOTS = `${OUT}/rbac-screens`;
mkdirSync(SHOTS, { recursive: true });
const rqBE = createRequire(`${BE}/package.json`);
const rqFE = createRequire(`${FE}/package.json`);

process.env.TENANT_LEGACY_DEFAULT = "1"; // this process calls services directly, as the test suites do
rqBE("dotenv").config({ path: `${BE}/.env` });
const mongoose = rqBE("mongoose");
const puppeteer = rqFE("puppeteer");

const API_PORT = Number(process.env.E2E_API_PORT) || 4611;
const WEB_PORT = Number(process.env.E2E_WEB_PORT) || 5611;
const DB = `erp_ui_rbac_${Date.now()}`;
const uri = process.env.MONGO_URI.replace(/\/([^/?]*)\?/, `/${DB}?`);
const PASSWORD = "Passw0rd-123";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  - " + detail : ""}`);
};

let api, vite, browser;
const killTree = (child) => {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill();
  } catch { /* gone */ }
};
const finish = async (code) => {
  try { await browser?.close(); } catch { /* */ }
  killTree(vite);
  killTree(api);
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === DB) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  } catch { /* */ }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(code ?? (failed ? 1 : 0));
};
process.on("SIGINT", () => finish(1));

const waitFor = async (url, ms = 120000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) { const j = await r.json().catch(() => ({})); if (j.ready !== false) return true; } } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // ---- the throwaway backend, an organisation, an owner, one customer and one item
  api = spawn(process.execPath, ["server.js"], { cwd: BE, env: { ...process.env, MONGO_URI: uri, PORT: String(API_PORT), LOG_SILENT: "1", TENANT_LEGACY_DEFAULT: "0", CORS_ORIGINS: `http://localhost:${WEB_PORT}` }, stdio: "ignore" });
  await mongoose.connect(uri);
  const Admin = rqBE(`${BE}/models/core/adminModel`);
  const Customer = rqBE(`${BE}/models/modules/customerModel`);
  const Stock = rqBE(`${BE}/models/modules/stockModel`);
  const Org = rqBE(`${BE}/services/core/organisationService`);
  const ctx = rqBE(`${BE}/utils/tenantContext`);
  await mongoose.connection.syncIndexes();
  if (!(await waitFor(`http://localhost:${API_PORT}/api/v1/health`))) throw new Error("backend did not start");
  const org = await Org.create({ legalName: "Acc Trading LLC", code: "acc", country: "AE", baseCurrency: "AED", timezone: "Asia/Dubai", planCode: "premium" });
  if (!org.provisioning.complete) throw new Error("organisation set-up incomplete");
  const as = (fn) => ctx.runWithTenant({ companyId: "acc", branchId: "main" }, fn);
  await as(() => new Admin({ name: "Olivia Owner", email: "owner@acc.test", password: PASSWORD, status: "active", isActive: true, type: "super_admin" }).save());
  await as(() => new Customer({ customerId: "CUST001", customerName: "Al Noor Trading", contactPerson: "Ali Hassan", email: "ali@alnoor.test", phone: "0501234567" }).save());
  await as(() => new Stock({ itemId: "RICE5", sku: "RICE5", itemName: "Rice 5kg", category: new mongoose.Types.ObjectId(), currentStock: 25 }).save());

  vite = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["vite", "--port", String(WEB_PORT), "--strictPort"], { cwd: FE, env: { ...process.env, VITE_API_URL: `http://localhost:${API_PORT}/api/v1` }, stdio: "ignore", shell: process.platform === "win32" });
  if (!(await waitFor(`http://localhost:${WEB_PORT}/`, 90000).catch(() => false))) {
    // Vite answers HTML, not JSON: any 200 is enough
    const end = Date.now() + 60000;
    let up = false;
    while (Date.now() < end && !up) { try { up = (await fetch(`http://localhost:${WEB_PORT}/`)).ok; } catch { await sleep(500); } }
    if (!up) throw new Error("vite did not start");
  }

  browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const WEB = `http://localhost:${WEB_PORT}`;

  const signIn = async (email) => {
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
  const has = (page, selectorOrText) => page.evaluate((s) => {
    const isText = !/^[.#\[a-z]/i.test(s) || s.includes(" ") === false && s.length < 0;
    void isText;
    return false;
  }, selectorOrText);
  void has;
  const buttonNamed = (page, re) => page.evaluate((src) => {
    const re = new RegExp(src, "i");
    return [...document.querySelectorAll("button, a")].some((b) => {
      const label = (b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").trim();
      return re.test(label) && b.offsetParent !== null;
    });
  }, re.source);
  const clickText = async (page, re) => {
    const ok = await page.evaluate((src) => {
      const re = new RegExp(src, "i");
      const el = [...document.querySelectorAll("button, a, [role=tab]")].find((b) => re.test((b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "").trim()) && b.offsetParent !== null);
      if (el) el.click();
      return Boolean(el);
    }, re.source);
    if (!ok) throw new Error(`nothing to click for ${re}`);
    await sleep(700);
  };
  const tick = async (page, label) => {
    const ok = await page.evaluate((l) => { const el = document.querySelector(`input[aria-label="${l}"]`); if (!el || el.disabled) return false; el.click(); return true; }, label);
    if (!ok) throw new Error(`cannot tick ${label}`);
  };
  const state = (page, label) => page.evaluate((l) => { const el = document.querySelector(`input[aria-label="${l}"]`); return el ? { checked: el.checked, disabled: el.disabled } : null; }, label);

  // ---- the owner makes two roles and two people on the real screen
  const owner = await signIn("owner@acc.test");
  await go(owner, "/users?tab=roles");
  await owner.screenshot({ path: `${SHOTS}/01-roles-list.png` });

  const makeRole = async (name, ticks) => {
    await clickText(owner, /^New role$/);
    await owner.waitForSelector('input[aria-label="Sales: View"]', { timeout: 10000 });
    await owner.type('[role=dialog] input:not([type=checkbox])', name);
    for (const t of ticks) await tick(owner, t);
    return name;
  };

  await makeRole("Order corrector", ["Sales: Edit", "Inventory: Edit"]);
  const view = await state(owner, "Sales: View");
  check("ticking Sales: Edit ticks and locks Sales: View in the real editor", view?.checked === true && view?.disabled === true, JSON.stringify(view));
  const add = await state(owner, "Sales: Add");
  check("Sales: Add stays unticked and free", add?.checked === false && add?.disabled === false, JSON.stringify(add));
  await owner.screenshot({ path: `${SHOTS}/02-role-editor-edit-only.png` });
  await clickText(owner, /^Create role$/);
  await sleep(1500);
  check("the role is saved and listed", await owner.evaluate(() => document.body.innerText.includes("Order corrector")));

  await makeRole("Order clerk", ["Sales: Add", "Inventory: Add"]);
  await clickText(owner, /^Create role$/);
  await sleep(1500);
  check("a second role (add only) is saved", await owner.evaluate(() => document.body.innerText.includes("Order clerk")));

  const addPerson = async (name, email, roleName) => {
    await go(owner, "/users");
    await clickText(owner, /Add a person/);
    await owner.waitForSelector("[role=dialog] input", { timeout: 10000 });
    const inputs = await owner.$$("[role=dialog] input");
    await inputs[0].type(name);
    await inputs[1].type(email);
    await inputs[2].type(PASSWORD);
    const picked = await owner.evaluate((roleName) => {
      const sel = [...document.querySelectorAll("[role=dialog] select")].find((s) => [...s.options].some((o) => o.textContent.trim() === roleName));
      if (!sel) return false;
      const opt = [...sel.options].find((o) => o.textContent.trim() === roleName);
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
      setter.call(sel, opt.value);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }, roleName);
    if (!picked) throw new Error(`role ${roleName} is not offered in the person dialog`);
    await clickText(owner, /^Add person$/);
    await sleep(1500);
  };
  await addPerson("Carla Corrector", "carla@acc.test", "Order corrector");
  await addPerson("Cyrus Clerk", "cyrus@acc.test", "Order clerk");
  await go(owner, "/users");
  check("both people are listed with their roles", await owner.evaluate(() => { const t = document.body.innerText; return t.includes("Carla Corrector") && t.includes("Order corrector") && t.includes("Cyrus Clerk") && t.includes("Order clerk"); }));
  await owner.screenshot({ path: `${SHOTS}/03-people.png` });

  // ---- the owner sees everything on the customer page
  await go(owner, "/customer-creation");
  check("owner: Add, Edit and Delete are all offered on the customer page", (await buttonNamed(owner, /Add Customer/)) && (await buttonNamed(owner, /Edit customer/)) && (await buttonNamed(owner, /Delete customer/)));

  // ---- the person who may only EDIT
  const carla = await signIn("carla@acc.test");
  await go(carla, "/customer-creation");
  await carla.screenshot({ path: `${SHOTS}/04-edit-only-customers.png` });
  check("edit-only: the customer page opens", await carla.evaluate(() => document.body.innerText.includes("Al Noor Trading")));
  check("edit-only: no Add Customer button", !(await buttonNamed(carla, /Add Customer/)));
  check("edit-only: the Edit button is offered", await buttonNamed(carla, /Edit customer/));
  check("edit-only: no Delete button", !(await buttonNamed(carla, /Delete customer/)));
  await go(carla, "/stock-item-creation");
  check("edit-only: no Add Stock Item button", !(await buttonNamed(carla, /Add Stock Item/)));
  check("edit-only: the item Edit button is offered", await buttonNamed(carla, /Edit item/));
  await clickText(carla, /Edit item/);
  await sleep(1200);
  const qty = await carla.evaluate(() => { const el = document.querySelector('input[name="currentStock"]'); return el ? { disabled: el.disabled, value: el.value } : null; });
  check("edit-only: the quantity box is read-only on the item form (no stock adjustment)", qty?.disabled === true && qty?.value === "25", JSON.stringify(qty));
  await carla.screenshot({ path: `${SHOTS}/05-edit-only-item-form.png` });
  await go(carla, "/sales-order");
  check("edit-only: no New sales order button", !(await buttonNamed(carla, /New sales order/)));
  await go(carla, "/vouchers/payment");
  await go(carla, "/chart-of-accounts");
  check("edit-only: Accounts is not theirs - the not-allowed page says so", await carla.evaluate(() => document.body.innerText.includes("You do not have access to this page")));
  await carla.screenshot({ path: `${SHOTS}/06-edit-only-not-allowed.png` });

  // ---- the person who may only ADD
  const cyrus = await signIn("cyrus@acc.test");
  await go(cyrus, "/customer-creation");
  await cyrus.screenshot({ path: `${SHOTS}/07-add-only-customers.png` });
  check("add-only: the Add Customer button is offered", await buttonNamed(cyrus, /Add Customer/));
  check("add-only: no Edit button", !(await buttonNamed(cyrus, /Edit customer/)));
  check("add-only: no Delete button", !(await buttonNamed(cyrus, /Delete customer/)));
  await go(cyrus, "/sales-order");
  check("add-only: the New sales order button is offered", await buttonNamed(cyrus, /New sales order/));
  await go(cyrus, "/users");
  check("add-only: the people screen is theirs to look at? no - it is refused", await cyrus.evaluate(() => document.body.innerText.includes("You do not have access to this page")));

  // ---- what the server says if the screen is bypassed: the edit-only person tries to add a customer through the API
  const token = await carla.evaluate(async () => {
    const r = await fetch("http://localhost:4611/api/v1/refresh-token", { method: "POST", credentials: "include" });
    const j = await r.json().catch(() => ({}));
    return j?.data?.accessToken || j?.accessToken || null;
  });
  if (token) {
    const r = await fetch(`http://localhost:${API_PORT}/api/v1/customers`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ customerName: "x" }) });
    const j = await r.json().catch(() => ({}));
    check("bypassing the screen: the server refuses the edit-only person's Add with PERMISSION_DENIED", r.status === 403 && j.errorCode === "PERMISSION_DENIED", `${r.status} ${j.errorCode}`);
  } else {
    console.log("   (could not read an access token in the page: API bypass check skipped)");
  }

  await finish();
} catch (error) {
  console.error("FAILED TO RUN:", error);
  results.push({ name: "harness", ok: false });
  await finish(1);
}
