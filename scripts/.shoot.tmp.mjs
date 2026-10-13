// Open a page, click through, then screenshot the scroller from top to bottom at phone size.
import puppeteer from "puppeteer";
const WEB = "http://localhost:5173";
const OUT = process.env.OUT || ".";
const PATH_ = process.env.PATH_ || "/sales-order";
const CLICKS = (process.env.CLICKS || "New sales invoice").split(";;");
const NAME = process.env.NAME || "shot";
const W = Number(process.env.W || 390), H = Number(process.env.H || 844);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (page, src, patience = 15000) => {
  const until = Date.now() + patience;
  while (Date.now() < until) {
    const h = await page.evaluateHandle((s) => {
      const rx = new RegExp(s);
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      return [...document.querySelectorAll("button, a, [role=button]")].find((el) => vis(el) && !el.disabled && rx.test((el.innerText || el.getAttribute("aria-label") || "").trim())) || null;
    }, src);
    const el = h.asElement();
    if (el) { await el.click(); return true; }
    await sleep(400);
  }
  return false;
};
const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2, isMobile: W < 700, hasTouch: W < 700 });
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.split("\n")[0]));
page.on("console", (m) => { if (m.type() === "error") errs.push("console " + m.text().slice(0, 200)); });
await page.goto(`${WEB}/`, { waitUntil: "networkidle2" });
await sleep(1200);
const f = await page.$$("input");
await f[0].type("admin@test.com"); await f[1].type("12312312");
await click(page, "Sign in|Log in|Login");
await sleep(3500);
await page.goto(`${WEB}${PATH_}`, { waitUntil: "networkidle2" });
await sleep(2500);
for (const c of CLICKS) { const ok = await click(page, c); if (!ok) console.log("NOT FOUND:", c); await sleep(2500); }
const box = await page.evaluate(() => {
  const main = document.querySelector("main") || document.scrollingElement;
  return { h: main.scrollHeight, v: main.clientHeight };
});
const steps = Math.min(6, Math.ceil(box.h / box.v));
for (let i = 0; i < steps; i++) {
  await page.evaluate((i) => { const m = document.querySelector("main") || document.scrollingElement; m.scrollTop = i * (m.clientHeight - 60); }, i);
  await sleep(600);
  await page.screenshot({ path: `${OUT}/${NAME}-${i}.png` });
}
console.log("scroller", box, "steps", steps, "errors", errs.slice(0, 10));
await browser.close();
