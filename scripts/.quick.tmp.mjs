// The quick-create dialog a phone user reaches from the picker ("Create customer ..."), measured at 390px.
import puppeteer from "puppeteer";
const WEB = "http://localhost:5173";
const OUT = process.env.OUT || ".";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const click = async (page, src, patience = 12000) => {
  const until = Date.now() + patience;
  while (Date.now() < until) {
    const h = await page.evaluateHandle((s) => {
      const rx = new RegExp(s);
      return [...document.querySelectorAll("button, a, [role=button]")].find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !el.disabled && rx.test((el.innerText || el.getAttribute("aria-label") || "").trim());
      }) || null;
    }, src);
    const el = h.asElement();
    if (el) { await el.click(); return true; }
    await sleep(400);
  }
  return false;
};
const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errs = [];
page.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.split("\n")[0]));
await page.goto(`${WEB}/`, { waitUntil: "networkidle2" });
await sleep(1200);
const f = await page.$$("input");
await f[0].type("admin@test.com"); await f[1].type("12312312");
await click(page, "Sign in|Log in|Login");
await sleep(3500);
await page.goto(`${WEB}/sales-order`, { waitUntil: "networkidle2" });
await sleep(2500);
await click(page, "^New sales invoice");
await sleep(2500);
// the customer picker: type a name nobody has, then take the "Create customer" option
const input = await page.$('input[id$="-partyId"]');
if (!input) { console.log("picker not found"); await browser.close(); process.exit(0); }
await input.click();
await input.type("Zzz Test Customer");
await sleep(1200);
await page.keyboard.press("Enter");
await sleep(1800);
const o = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('[role="dialog"]')].pop();
  const box = dlg || document.querySelector("main");
  const panes = [box, ...box.querySelectorAll("*")].filter((el) => {
    const st = getComputedStyle(el);
    return st.overflowX === "auto" || st.overflowX === "scroll";
  });
  let worst = { sw: 0, w: 1 };
  for (const el of [box, ...panes]) if (el.scrollWidth - el.clientWidth > worst.sw - worst.w) worst = { sw: el.scrollWidth, w: el.clientWidth };
  const r = box.getBoundingClientRect();
  return { dialog: Boolean(dlg), worst, rect: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) }, text: box.innerText.replace(/\n/g, " / ").slice(0, 220), innerH: window.innerHeight };
});
console.log(JSON.stringify(o, null, 1), errs);
await page.screenshot({ path: `${OUT}/quickcreate.png` });
await browser.close();
