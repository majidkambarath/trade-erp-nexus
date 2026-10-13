import puppeteer from "puppeteer";
const WEB = "http://localhost:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (page, src, patience = 12000) => {
  const until = Date.now() + patience;
  while (Date.now() < until) {
    const h = await page.evaluateHandle((s) => {
      const rx = new RegExp(s);
      return [...document.querySelectorAll("button, a, [role=button]")].find((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.disabled && rx.test((el.innerText || el.getAttribute("aria-label") || "").trim()); }) || null;
    }, src);
    const el = h.asElement();
    if (el) { await el.click(); return true; }
    await sleep(400);
  }
  return false;
};
const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const bad = [];
page.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.request().method()} ${r.url().replace(/.*\/api\/v1/, "")}`); });
await page.goto(`${WEB}/`, { waitUntil: "networkidle2" });
await sleep(1200);
const f = await page.$$("input");
await f[0].type("admin@test.com"); await f[1].type("12312312");
await click(page, "Sign in|Log in|Login");
await sleep(3500);
bad.length = 0;
for (const p of (process.env.PAGES || "/sales-order").split(",")) {
  bad.length = 0;
  await page.goto(`${WEB}${p}`, { waitUntil: "networkidle2" });
  await sleep(3000);
  await click(page, process.env.CLICK || "^New sales invoice");
  await sleep(3000);
  console.log(p, "->", [...new Set(bad)].slice(0, 12));
}
await browser.close();
