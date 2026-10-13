import puppeteer from "puppeteer";
const WEB = "http://localhost:5173";
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
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await page.goto(`${WEB}/`, { waitUntil: "networkidle2" });
await sleep(1200);
const f = await page.$$("input");
await f[0].type("admin@test.com"); await f[1].type("12312312");
await click(page, "Sign in|Log in|Login");
await sleep(3500);
for (const [path, clicks] of JSON.parse(process.env.STEPS)) {
  await page.goto(`${WEB}${path}`, { waitUntil: "networkidle2" });
  await sleep(2500);
  for (const c of clicks) { const ok = await click(page, c); if (!ok) console.log("  NOT FOUND:", c); await sleep(2200); }
  const o = await page.evaluate(() => {
    const pane = document.querySelector("main") || document.documentElement;
    const edge = pane.getBoundingClientRect().right + 4;
    const out = [...pane.querySelectorAll("*")]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > edge; })
      .filter((el) => !el.parentElement || el.parentElement === pane || el.parentElement.getBoundingClientRect().right <= edge)
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className||"").split(" ").slice(0,4).join(".")} w=${Math.round(el.getBoundingClientRect().width)} right=${Math.round(el.getBoundingClientRect().right)} "${(el.textContent||"").trim().slice(0,40)}"`);
    return { bleeds: pane.scrollWidth > pane.clientWidth + 4, w: pane.clientWidth, sw: pane.scrollWidth, out };
  });
  console.log(`\n${path} ${clicks.join(" > ")} -> pane ${o.sw} > ${o.w} bleeds=${o.bleeds}`);
  o.out.forEach((x) => console.log("   ", x));
}
await browser.close();
