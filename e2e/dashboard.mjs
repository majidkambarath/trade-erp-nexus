// End to end: the home dashboard, whole. A throwaway backend with real documents (a purchase, three sales invoices - one of
// them older than this month - a receipt and an expense), the real frontend, a real browser. It walks every tab and every view
// and checks that what the SCREEN says is what the SERVER sent, that the figures are the ones the documents make, and that the
// page behaves on a phone, with reduced motion, and in dark mode. Run it with `npm run e2e -- dashboard`.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { FE as WEB_DIR, BE as NODE_DIR, OUT as OUT_ROOT } from "./paths.mjs";
const OUT = `${OUT_ROOT}/dashboard`;
mkdirSync(OUT, { recursive: true });

process.env.TENANT_LEGACY_DEFAULT = "1"; // this process makes its first documents through the models, as the test suites do
const requireWeb = createRequire(`${WEB_DIR}/package.json`);
const requireNode = createRequire(`${NODE_DIR}/package.json`);
const puppeteer = requireWeb("puppeteer");
const mongoose = requireNode("mongoose");
requireNode("dotenv").config({ path: `${NODE_DIR}/.env` });

const DB = `erp_ui_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const API_PORT = Number(process.env.E2E_API_PORT) || 3421;
const WEB_PORT = Number(process.env.E2E_WEB_PORT) || 5241;
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
  }
};
const must = (cond, message) => {
  if (!cond) throw new Error(message);
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

// ---- days ----------------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
const dayOf = (offset = 0) => {
  const d = new Date(Date.now() + 4 * 3600e3 + offset * 86400e3); // the Dubai calendar day, as the server reads it
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const TODAY = dayOf(0);
const MONTH_START = `${TODAY.slice(0, 7)}-01`;
// the first sale: 40 days back, but never before 1 January (a fiscal year starts there)
const FIRST = dayOf(-40) < `${TODAY.slice(0, 4)}-01-01` ? `${TODAY.slice(0, 4)}-01-01` : dayOf(-40);

// ---- page helpers --------------------------------------------------------------------------
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const plainText = async () => (await page.evaluate(() => document.body.innerText)).replace(/ /g, " ");
const waitForText = (text, timeout = 30000) => page.waitForFunction((t) => document.body.innerText.replace(/ /g, " ").includes(t), { timeout }, text);
const cardText = (title) =>
  page.evaluate((title) => {
    const h = [...document.querySelectorAll("h3, h2")].find((n) => n.textContent.trim() === title);
    return (h?.closest("[data-slot='card']")?.innerText || "").replace(/ /g, " ");
  }, title);
const clickByText = async (selector, text, scopeSelector) => {
  const h = await page.evaluateHandle(
    (selector, text, scopeSelector) => {
      const root = scopeSelector ? document.querySelector(scopeSelector) : document;
      return [...(root?.querySelectorAll(selector) || [])].find((el) => el.textContent.trim() === text && el.getBoundingClientRect().width > 1) || null;
    },
    selector, text, scopeSelector,
  );
  const el = h.asElement();
  if (!el) throw new Error(`no ${selector} reading "${text}"`);
  await el.evaluate((n) => n.scrollIntoView({ block: "center" }));
  await el.click();
};
const openTab = async (name) => {
  await clickByText("[role='tab']", name);
  await page.waitForFunction((n) => [...document.querySelectorAll("[role='tab']")].some((t) => t.textContent.trim() === n && t.getAttribute("aria-selected") === "true"), { timeout: 15000 }, name);
  await wait(900);
};
const flowSection = "section[aria-labelledby='business-flow-title']";
const whole = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.round(n).toLocaleString("en-US"));
const near = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;

// ---- start everything ----------------------------------------------------------------------
const S = {};
async function boot() {
  backend = spawn(process.execPath, ["server.js"], { cwd: NODE_DIR, env: { ...process.env, MONGO_URI: uri, PORT: String(API_PORT), LOG_SILENT: "1", TENANT_LEGACY_DEFAULT: "0", CORS_ORIGINS: WEB }, stdio: ["ignore", "pipe", "pipe"] });
  backend.stdout.on("data", (d) => (logs.api += d));
  backend.stderr.on("data", (d) => (logs.api += d));
  children.push(backend);

  await mongoose.connect(uri);
  const M = {
    Admin: requireNode("./models/core/adminModel"),
    Customer: requireNode("./models/modules/customerModel"),
    Vendor: requireNode("./models/modules/vendorModel"),
    Stock: requireNode("./models/modules/stockModel"),
    Financial: requireNode("./models/modules/financial/financialModels"),
  };
  await mongoose.connection.syncIndexes();
  for (let i = 0; ; i++) {
    // `ready` is false while the server builds a fresh database and adopts its first organisation (30 s or more on a new one):
    // a sign-in in that window is refused, so wait for it rather than for the first answer.
    try { const h = await fetch(`${API}/health`); if (h.ok && (await h.json().catch(() => ({}))).ready !== false) break; } catch { /* not up */ }
    if (i > 300) throw new Error(`backend did not start\n${logs.api.slice(-800)}`);
    await wait(400);
  }
  await new M.Admin({ name: "Boss", email: "boss@test.uae", password: "12312312", type: "super_admin", status: "active", isActive: true }).save();
  const login = await api("POST", "/login", { email: "boss@test.uae", password: "12312312" });
  // say what the server answered when it did not sign the first person in (a wrong server on the port, an organisation not adopted)
  if (!login.body?.tokens?.accessToken) throw new Error(`the first sign-in failed: ${login.status} ${JSON.stringify(login.raw).slice(0, 300)}`);
  token = login.body.tokens.accessToken;
  await api("GET", "/accounting/chart");

  const cat = new mongoose.Types.ObjectId();
  const cust = await M.Customer.create({ customerId: "C1", customerName: "Al Noor Grocery", contactPerson: "Ali Hassan", phone: "050 111 2222", shippingAddress: "Warehouse 4, Al Quoz", paymentTerms: "Net 30", creditLimit: 1e7 });
  const vend = await M.Vendor.create({ vendorId: "V1", vendorName: "Gulf Supply", contactPerson: "x", address: "y" });
  const rice = await M.Stock.create({ itemId: "ITM1", sku: "SKU1", itemName: "Basmati Rice 5kg", category: cat, salesPrice: 20, purchasePrice: 10 });

  const order = async (type, party, partyType, qty, price, date) => {
    const made = await api("POST", "/transactions/transactions", { type, partyId: party._id, partyType, date, items: [{ itemId: rice._id, description: "Basmati Rice 5kg", qty, price, rate: price, vatPercent: 5 }] });
    if (made.status !== 201) throw new Error(`${type} ${made.status} ${JSON.stringify(made.raw).slice(0, 220)}`);
    const ok = await api("PATCH", `/transactions/transactions/${made.body._id}/process`, { action: "approve" });
    if (ok.status !== 200) throw new Error(`approve ${ok.status} ${JSON.stringify(ok.raw).slice(0, 220)}`);
    return made.body;
  };
  // 500 bags bought at 10 (the stock the sales draw on), then three sales of 100 bags at 20: the first is older than this month
  await order("purchase_order", vend, "Vendor", 500, 10, FIRST);
  await order("sales_order", cust, "Customer", 100, 20, FIRST);
  await order("sales_order", cust, "Customer", 100, 20, TODAY);
  await order("sales_order", cust, "Customer", 100, 20, TODAY);

  const receipt = await api("POST", "/vouchers/vouchers", { voucherType: "receipt", customerId: cust._id, totalAmount: 3000, date: TODAY, paymentMode: "cash" });
  if (receipt.status !== 201) throw new Error(`receipt ${receipt.status} ${JSON.stringify(receipt.raw).slice(0, 220)}`);

  // an expense: rent, 600, from cash, as a journal (the ledger-based way)
  const rent = await M.Financial.LedgerAccount.findOne({ accountName: "Rent Expense" });
  const cash = await M.Financial.LedgerAccount.findOne({ accountName: "Cash in Hand" });
  if (!rent || !cash) throw new Error("the default chart has no Rent Expense / Cash in Hand");
  const journal = await api("POST", "/vouchers/vouchers", { voucherType: "journal", ledgerBased: true, date: TODAY, narration: "Warehouse rent", lines: [{ accountId: rent._id, debit: 600 }, { accountId: cash._id, credit: 600 }] });
  if (journal.status !== 201) throw new Error(`journal ${journal.status} ${JSON.stringify(journal.raw).slice(0, 220)}`);

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
  page.on("console", (m) => { if (m.type() === "error") bad.push(`console: ${m.text().slice(0, 200)}`); });
  page.__bad = bad;
}

const analytics = async (query = "") => (await api("GET", `/dashboard-summary/analytics${query}`)).body;

try {
  await step("start a throwaway backend, make a business with real documents, start the real frontend", boot);

  await step("the server's own answer: the business flow carries the period, the one before it, and the cash cycle", async () => {
    S.a = await analytics();
    const f = S.a.businessFlow;
    must(f, "analytics has no businessFlow");
    const inPeriod = [FIRST, TODAY, TODAY].filter((d) => d >= MONTH_START).length;
    must(near(f.statement.revenue, 2000 * inPeriod), `revenue ${f.statement.revenue}, the documents make ${2000 * inPeriod}`);
    must(near(f.statement.directCosts, 1000 * inPeriod), `cost of goods ${f.statement.directCosts}, the documents make ${1000 * inPeriod}`);
    must(near(f.statement.operatingExpenses, 600), `operating expenses ${f.statement.operatingExpenses}, the journal made 600`);
    must(near(f.statement.netProfit, 1000 * inPeriod - 600), `net profit ${f.statement.netProfit}`);
    // 3 invoices of 2,100 less the 3,000 received on account is 3,300 owed (open invoices alone would say 6,300); 5,250 to the vendor
    must(near(f.stages.owedByCustomers, 3300), `customers owe ${f.stages.owedByCustomers}: the receipt on account was not netted`);
    must(near(f.stages.owedToVendors, 5250), `vendors are owed ${f.stages.owedToVendors}`);
    must(f.previous?.statement && "directCosts" in f.previous.statement, "previous.statement is missing: the period before's shares cannot be compared");
    must(f.cycle.enough === true && f.cycle.days >= 14, `the cycle window is ${f.cycle.days} days: the first sale was ${FIRST}`);
    must(Array.isArray(S.a.monthly) && S.a.monthly.every((m) => Number.isFinite(m.netProfit)), "analytics.monthly has no netProfit");
    return `revenue ${f.statement.revenue}, net ${f.statement.netProfit}, cycle ${f.cycle.cycleDays} days`;
  });

  await step("sign in the way a returning browser does and open the dashboard", async () => {
    await page.goto(`${WEB}/`, { waitUntil: "networkidle2" });
    const status = await page.evaluate(async (api) => {
      const r = await fetch(`${api}/login`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "boss@test.uae", password: "12312312" }) });
      return r.status;
    }, API);
    must(status === 200, `login answered ${status}`);
    await page.goto(`${WEB}/dashboard`, { waitUntil: "networkidle2" });
    must(new URL(page.url()).pathname !== "/", "the app did not restore the session");
    await waitForText("From buying to cash");
    // the heading is there while the figures still load; the sentence only exists once the server has answered
    await waitForText("Of every AED 100 you sell", 90000);
    await wait(1500);
    await shot("01-dashboard");
  });

  await step("the stage strip says what the server sent, and every tile opens its page", async () => {
    const f = S.a.businessFlow;
    const text = await plainText();
    const want = [
      ["Bought", f.stages.bought], ["In stock", f.stages.stock], ["Sold", f.stages.sold], ["Collected", f.stages.collected],
      ["Customers still owe you", f.stages.owedByCustomers], ["You still owe vendors", f.stages.owedToVendors],
    ];
    for (const [label, value] of want) {
      // the figures count up from zero when they arrive (CountUp): read a tile once it has settled on the server's figure, not
      // halfway (it once read "AED 1,456" on its way to 2,000). A tile that never settles is reported below with what it says.
      await page
        .waitForFunction(
          (label, shown) => {
            const a = [...document.querySelectorAll("section a")].find((n) => n.innerText.trim().startsWith(label));
            return Boolean(a) && a.innerText.replace(/\s/g, " ").includes(shown);
          },
          { timeout: 15000 },
          label,
          whole(value),
        )
        .catch(() => {});
      const tile = await page.evaluate((label) => {
        const a = [...document.querySelectorAll("section a")].find((n) => n.innerText.trim().startsWith(label));
        return a ? { text: a.innerText.replace(/ /g, " "), href: a.getAttribute("href") } : null;
      }, label);
      must(tile, `no tile "${label}"`);
      must(tile.text.includes(whole(value)), `"${label}" should show ${whole(value)}, it says: ${tile.text.replace(/\n/g, " ")} (the server said ${JSON.stringify(f.stages)}; asked again now: ${JSON.stringify((await analytics()).businessFlow?.stages)})`);
      must(tile.href && tile.href.startsWith("/"), `"${label}" does not open a page`);
    }
    must(text.includes("Every tile opens its report"), "the hint is missing");
  });

  await step("Split (the opening view): the sentence, the ring, and each part's figure from the server", async () => {
    const f = S.a.businessFlow;
    const st = f.statement;
    const profit = ((st.netProfit / st.revenue) * 100).toFixed(2);
    const card = await cardText("Where the revenue went");
    must(card.includes(`Of every AED 100 you sell, AED ${profit} is profit.`), `the sentence should say AED ${profit}:\n${card.slice(0, 300)}`);
    for (const label of ["Goods you sold", "Running the business", "Profit"]) must(card.includes(label), `missing "${label}"`);
    const radios = await page.evaluate(() => [...document.querySelectorAll("[role='radio']")].map((r) => `${r.textContent.trim()}:${r.getAttribute("aria-checked")}`));
    must(radios.join("|") === "Split:true|Month by month:false|Flow:false", `the switch reads ${radios.join("|")}`);
    await shot("02-split");
  });

  await step("hovering a row puts that part in the centre of the ring; moving away gives the profit back", async () => {
    const rowHandle = await page.evaluateHandle(() => [...document.querySelectorAll("li")].find((li) => li.innerText.startsWith("Goods you sold")) || null);
    const row = rowHandle.asElement();
    must(row, "no Goods you sold row");
    await row.hover();
    await wait(250);
    const centre = async () => (await page.evaluate(() => document.querySelector("[aria-live='polite']")?.innerText || "")).replace(/ /g, " ");
    const during = await centre();
    must(/Goods you sold/.test(during) && /% of revenue/.test(during), `the centre should show the goods: ${during.replace(/\n/g, " ")}`);
    await shot("03-split-hover");
    await page.mouse.move(5, 5);
    await wait(250);
    must(/Net profit/.test(await centre()), "the centre did not go back to the profit");
    const tooltip = await page.evaluate(() => Boolean(document.querySelector(".recharts-tooltip-wrapper[style*='visibility: visible']")));
    must(!tooltip, "a floating tooltip is drawn over the ring");
  });

  await step("Month by month: eight columns, and this month's revenue is in the chart's own description", async () => {
    await clickByText("[role='radio']", "Month by month");
    await wait(900);
    const label = await page.evaluate(() => [...document.querySelectorAll("[role='img']")].map((n) => n.getAttribute("aria-label") || "").find((l) => /revenue AED/.test(l)) || "");
    const monthRows = label.split(";").length;
    must(monthRows === 8, `the columns describe ${monthRows} months`);
    const now = S.a.monthly.at(-1);
    must(label.replace(/ /g, " ").includes(`revenue AED ${now.sales.toLocaleString("en-US", { minimumFractionDigits: 2 })}`), `this month's revenue is not in: ${label.slice(-160)}`);
    await shot("04-months");
  });

  await step("Flow: six blocks and their ribbons; a block opens the profit and loss from the keyboard", async () => {
    await clickByText("[role='radio']", "Flow");
    await wait(1500);
    const counts = await page.evaluate(() => ({ nodes: document.querySelectorAll("[data-node]").length, links: document.querySelectorAll("[data-link]").length }));
    must(counts.nodes >= 5 && counts.links >= 4, `the diagram has ${counts.nodes} bars and ${counts.links} ribbons`);
    const hasLoud = await page.evaluate(() => [...document.querySelectorAll("[data-node]")].some((n) => /Net profit/.test(n.getAttribute("aria-label") || "")));
    must(hasLoud, "no Net profit bar");
    await shot("05-flow");
    const node = (await page.evaluateHandle(() => [...document.querySelectorAll("[data-node]")].find((n) => /^Gross profit/.test(n.getAttribute("aria-label"))) || null)).asElement();
    must(node, "no Gross profit bar");
    // an SVG element: puppeteer's own focus() only takes HTML elements, the element's focus() is what Tab would do
    await node.evaluate((n) => n.focus());
    must(await page.evaluate(() => document.activeElement?.hasAttribute("data-node")), "the bar did not take keyboard focus");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => location.pathname.includes("financial-statements"), { timeout: 15000 });
    await page.goBack({ waitUntil: "networkidle2" });
    await waitForText("From buying to cash");
  });

  await step("the choice is remembered when you come back to the page", async () => {
    await wait(1200);
    const radios = await page.evaluate(() => [...document.querySelectorAll("[role='radio']")].map((r) => `${r.textContent.trim()}:${r.getAttribute("aria-checked")}`));
    must(radios.includes("Flow:true"), `after coming back the switch reads ${radios.join("|")}`);
    await clickByText("[role='radio']", "Split");
  });

  await step("the cash cycle card shows the server's days and the sentence that goes with them", async () => {
    const c = S.a.businessFlow.cycle;
    const card = await cardText("Cash cycle");
    const days = (n) => `${n % 1 === 0 ? n : n.toFixed(1)} day`;
    for (const key of ["dio", "dso", "dpo"]) if (c[key] !== null) must(card.includes(days(c[key])), `${key} ${c[key]} is not on the card:\n${card.slice(0, 400)}`);
    must(c.cycleDays === null || /tied up|Vendors fund you|on the day you pay/.test(card), `no sentence about the cycle:\n${card.slice(0, 400)}`);
    await shot("06-cash-cycle");
  });

  await step("Sales, Inventory and Reports tabs open, and each says what the server sent", async () => {
    await openTab("Sales");
    must((await plainText()).includes("Best sellers"), "the Sales tab has no Best sellers");
    await shot("07-sales");
    await openTab("Inventory");
    const inv = (await api("GET", "/dashboard-summary/inventory")).body;
    const flowLabel = await page.evaluate(() => [...document.querySelectorAll("[role='img']")].map((n) => n.getAttribute("aria-label") || "").find((l) => /^Opening stock/.test(l)) || "");
    must(flowLabel, "the Inventory tab has no stock flow");
    const closing = inv.stockFlow.closing.toLocaleString("en-US", { minimumFractionDigits: 2 });
    must(flowLabel.replace(/ /g, " ").includes(`Closing stock AED ${closing}`), `closing stock should read AED ${closing}: ${flowLabel.slice(-120)}`);
    await shot("08-inventory");
    await openTab("Reports");
    const rep = (await api("GET", "/dashboard-summary/reports")).body;
    const walk = await page.evaluate(() => [...document.querySelectorAll("[role='img']")].map((n) => n.getAttribute("aria-label") || "").find((l) => /^Revenue /.test(l)) || "");
    must(walk, "the Reports tab has no profit flow");
    const rev = rep.profitFlow.revenue.toLocaleString("en-US", { minimumFractionDigits: 2 });
    must(walk.replace(/ /g, " ").startsWith(`Revenue AED ${rev}`), `the profit flow should open on AED ${rev}: ${walk.slice(0, 80)}`);
    await shot("09-reports");
    await openTab("Dashboard");
  });

  await step("a different period is asked of the server and the page keeps working", async () => {
    const asked = [];
    const onRequest = (r) => { if (r.url().includes("/dashboard-summary")) asked.push(r.url()); };
    page.on("request", onRequest);
    const picked = await page.evaluate(() => {
      const select = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => /quarter/i.test(o.textContent)));
      if (!select) return null;
      const option = [...select.options].find((o) => /quarter/i.test(o.textContent) && !/specific|last|previous/i.test(o.textContent)) || [...select.options].find((o) => /quarter/i.test(o.textContent));
      return option.value;
    });
    must(picked, "no period list offers a quarter");
    const selectHandle = await page.evaluateHandle(() => [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => /quarter/i.test(o.textContent))));
    await selectHandle.asElement().select(picked);
    await wait(2500);
    page.off("request", onRequest);
    must(asked.some((u) => /period=quarter|from=|month=/.test(u)), `no request carried the new period: ${asked.slice(0, 3).join(" ")}`);
    must((await plainText()).includes("From buying to cash"), "the business flow disappeared after the period changed");
    await shot("10-quarter");
  });

  await step("on a phone: nothing is wider than the screen on any tab, and the flow is a waterfall", async () => {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await page.goto(`${WEB}/dashboard`, { waitUntil: "networkidle2" });
    await waitForText("Of every AED 100 you sell", 90000);
    await wait(1200);
    for (const tab of ["Dashboard", "Sales", "Inventory", "Reports"]) {
      await openTab(tab);
      const o = await page.evaluate(() => {
        const main = document.querySelector("main") || document.documentElement;
        return { bleeds: main.scrollWidth > main.clientWidth + 4, w: main.scrollWidth, vw: main.clientWidth };
      });
      must(!o.bleeds, `${tab}: the page is ${o.w}px wide on a ${o.vw}px screen`);
    }
    await openTab("Dashboard");
    await clickByText("[role='radio']", "Flow");
    await wait(900);
    const nodes = await page.evaluate(() => document.querySelectorAll("[data-node]").length);
    const walk = await page.evaluate(() => [...document.querySelectorAll("[role='img']")].map((n) => n.getAttribute("aria-label") || "").some((l) => /^Revenue .*Net profit/.test(l)));
    must(nodes === 0 && walk, `on a phone the flow should be a waterfall (bars: ${nodes}, waterfall: ${walk})`);
    await shot("11-phone-flow");
    await page.setViewport({ width: 1440, height: 1000 });
  });

  await step("with reduced motion the figures are there at once, not counting up from zero", async () => {
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.goto(`${WEB}/dashboard`, { waitUntil: "domcontentloaded" });
    // read the tile in the same breath the data arrives: that is when a count-up would still be on its way from zero
    await page.waitForFunction(() => [...document.querySelectorAll("section a")].some((a) => a.innerText.trim().startsWith("Sold") && /d/.test(a.innerText)), { timeout: 90000 });
    const f = S.a.businessFlow;
    const t0 = Date.now();
    const seen = await page.evaluate((want) => {
      const a = [...document.querySelectorAll("section a")].find((n) => n.innerText.trim().startsWith("Sold"));
      return a ? a.innerText.replace(/ /g, " ").includes(want) : false;
    }, whole(f.stages.sold));
    must(seen, `"Sold" did not show ${whole(f.stages.sold)} straight away (${Date.now() - t0}ms after the section appeared)`);
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  });

  await step("dark mode: the new views draw and nothing is unreadable (look at the screenshot)", async () => {
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.goto(`${WEB}/dashboard`, { waitUntil: "networkidle2" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await waitForText("Of every AED 100 you sell", 90000);
    await wait(1500);
    await shot("12-dark-split");
    await clickByText("[role='radio']", "Flow");
    await wait(1500);
    await shot("13-dark-flow");
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
  });

  await step("no page error and no failed request anywhere in the run", async () => {
    const bad = [...new Set(page.__bad)].filter((b) => !/Failed to load resource.*(401|404)/.test(b));
    must(bad.length === 0, bad.join(" | "));
  });
} catch (e) {
  console.log("\nstopped:", String(e.message).split("\n")[0]);
  try { await shot("zz-failure"); console.log("page text at failure:\n" + (await plainText()).slice(0, 700)); } catch (e2) { console.log("could not capture the page:", String(e2.message).split("\n")[0]); }
  if (page?.__bad?.length) console.log("browser/API problems:", [...new Set(page.__bad)].join(" | "));
  if (logs.api) console.log("backend tail:\n" + logs.api.slice(-600));
} finally {
  await shutdown();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed. Screenshots in ${OUT}`);
process.exit(failed.length ? 1 : 0);
