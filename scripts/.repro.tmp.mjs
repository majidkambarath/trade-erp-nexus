// Reproduce the reported crash: open a page at phone size against the REAL backend, click a button, report
// every console error, page error and what the screen says.
import puppeteer from "puppeteer";

const WEB = process.env.WEB || "http://localhost:5173";
const EMAIL = process.env.EMAIL || "admin@test.com";
const PASSWORD = process.env.PASSWORD || "12312312";
const PATHS = (process.env.PATHS || "/sales-order,/sales-orders").split(",");
const CLICKS = (process.env.CLICKS || "New sales invoice|New sales order").split(",");
const OUT = process.env.OUT || ".";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const clickByText = async (page, re, patience = 15000) => {
  const until = Date.now() + patience;
  while (Date.now() < until) {
    if (await clickOnce(page, re)) return true;
    await sleep(500);
  }
  return false;
};

const clickOnce = async (page, re) => {
  const rx = new RegExp(re);
  const handle = await page.evaluateHandle((src) => {
    const rx = new RegExp(src);
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const nodes = [...document.querySelectorAll("button, a, [role=button]")];
    return nodes.find((el) => vis(el) && !el.disabled && rx.test((el.innerText || el.getAttribute("aria-label") || "").trim())) || null;
  }, re.source || re);
  const el = handle.asElement();
  if (!el) return false;
  await el.click();
  return true;
};

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const problems = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text().slice(0, 400)}`); });
page.on("pageerror", (e) => problems.push(`PAGEERROR: ${e.message.split("\n").slice(0, 3).join(" | ")}`));
page.on("requestfailed", (r) => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

// sign in
await page.goto(`${WEB}/`, { waitUntil: "networkidle2", timeout: 60000 });
await sleep(1500);
const fields = await page.$$("input");
if (fields.length >= 2) {
  await fields[0].type(EMAIL);
  await fields[1].type(PASSWORD);
  await clickByText(page, "Sign in|Log in|Login");
  await sleep(4000);
}
console.log("after sign-in:", page.url());
if (/\/$|\/login/.test(new URL(page.url()).pathname) && !/dashboard/.test(page.url())) {
  console.log("SIGN-IN TEXT:", (await page.evaluate(() => document.body.innerText)).slice(0, 400));
}

for (let i = 0; i < PATHS.length; i++) {
  const path = PATHS[i];
  const click = CLICKS[i] || CLICKS[0];
  problems.length = 0;
  await page.goto(`${WEB}${path}`, { waitUntil: "networkidle2", timeout: 60000 });
  await sleep(3000);
  const before = await page.evaluate(() => document.body.innerText.slice(0, 200));
  const hit = await clickByText(page, click);
  await sleep(3500);
  const text = await page.evaluate(() => document.body.innerText);
  const crashed = /Something went wrong|went wrong on this page|newer version is available|Try again/i.test(text);
  console.log(`\n=== ${path}  click "${click}" (${hit ? "clicked" : "BUTTON NOT FOUND"}) ===`);
  console.log("page starts:", before.replace(/\n/g, " / ").slice(0, 140));
  console.log("CRASH SCREEN:", crashed);
  console.log("text now:", text.replace(/\n/g, " / ").slice(0, 500));
  for (const p of problems.slice(0, 25)) console.log("  -", p);
  await page.screenshot({ path: `${OUT}/repro-${path.replace(/\W+/g, "_")}.png`, fullPage: true });
}

await browser.close();
