// Walk a guide on the real screens, the way a person would, and prove every step's target exists.
//   node scripts/guides/walk.mjs add-customer [--lang=en|ar|hi|ml] [--shots=<dir>] [--base=http://localhost:5173]
// Env: GUIDE_EMAIL / GUIDE_PASSWORD (a demo company's sign-in; the walker creates real records there, so use a demo company).
// It starts the guide from the Guide me menu, then at each step acts on the element the guide is pointing at
// ([data-guide-current]): clicks it, or types the step's `sample`, then presses Next. It fails, naming the step, when
// a card sits on the same step for too long (the target was never found). Exit code 1 on any failure.
import puppeteer from "puppeteer";
import fs from "node:fs";

const args = process.argv.slice(2);
const flowId = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=").slice(1).join("=");
const lang = opt("lang", "en");
const base = opt("base", "http://localhost:5173");
const shots = opt("shots", "");
const email = process.env.GUIDE_EMAIL || "test@gmail.com";
const password = process.env.GUIDE_PASSWORD;
if (!flowId) { console.error("usage: walk.mjs <flow id> [--lang=en]"); process.exit(2); }
if (!password) { console.error("Set GUIDE_PASSWORD (and GUIDE_EMAIL) to a demo company's sign-in."); process.exit(2); }
if (shots) fs.mkdirSync(shots, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));

await page.goto(base, { waitUntil: "networkidle2" });
await page.type('input[type="email"], input[name="email"]', email);
await page.type('input[type="password"]', password);
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => {}), page.keyboard.press("Enter")]);
await page.waitForSelector('[data-guide="guide-me"]', { timeout: 60000 });

// start in the wanted language first (the choice is remembered per person), then start the guide
await page.click('[data-guide="guide-me"]'); await wait(400);
const started = await page.evaluate((id) => {
  const items = [...document.querySelectorAll("[role=menuitem]")];
  const el = items.find((e) => e.getAttribute("data-flow") === id);
  if (!el) return false; el.click(); return true;
}, flowId);
if (!started) { console.error(`the guide "${flowId}" is not in the Guide me menu for this person`); await browser.close(); process.exit(1); }
await page.waitForSelector("[data-guide-overlay]", { timeout: 15000 });
if (lang !== "en") {
  await page.evaluate((code) => document.querySelector(`[data-guide-overlay] button[data-lang="${code}"]`)?.click(), lang);
  await wait(800);
}

const read = () => page.evaluate(() => {
  const o = document.querySelector("[data-guide-overlay]");
  if (!o) return null;
  const cur = document.querySelector("[data-guide-current]");
  return { step: o.dataset.guideStep, kind: o.dataset.guideKind, sample: o.dataset.guideSample, card: o.querySelector("[role=region]")?.innerText.replace(/\n+/g, " | "), hasTarget: Boolean(cur), tag: cur?.tagName, role: cur?.getAttribute("role") };
});

const log = [];
let last = null; let since = Date.now();
for (let n = 0; n < 80; n += 1) {
  const s = await read();
  if (!s) { console.log("guide closed"); break; }
  if (s.step !== last) {
    last = s.step; since = Date.now();
    log.push({ step: s.step, kind: s.kind, card: s.card });
    console.log(`${String(log.length).padStart(2)}. ${s.step}  [${s.kind}]  ${s.card?.slice(0, 90)}`);
    if (shots) await page.screenshot({ path: `${shots}/${flowId}-${lang}-${String(log.length).padStart(2)}-${s.step.split(".")[1]}.png` });
  }
  if (s.kind === "done") { console.log("DONE"); break; }
  if (Date.now() - since > 14000) { problems.push(`stuck on ${s.step} (${s.kind}): target ${s.hasTarget ? "found but the step did not advance" : "never found"}`); break; }

  if (s.kind === "click" && s.hasTarget) {
    const h = await page.$("[data-guide-current]");
    if (h) { await h.evaluate((e) => e.scrollIntoView({ block: "center" })); await wait(300); await h.click().catch(() => {}); await wait(700); }
  } else if (s.kind === "fill" && s.hasTarget) {
    const h = await page.$("[data-guide-current]");
    if (h && s.sample) {
      if (s.tag === "SELECT") { const pick = await h.evaluate((e, want) => { const o = [...e.options].filter((x) => x.value); const hit = o.find((x) => want && (x.value.toLowerCase() === want.toLowerCase() || x.text.toLowerCase() === want.toLowerCase())); return (hit || o[0])?.value; }, s.sample); if (pick) await h.select(pick); }
      else if (s.tag === "INPUT" || s.tag === "TEXTAREA") {
        await h.click({ clickCount: 3 }).catch(() => {}); await h.type(s.sample, { delay: 15 }).catch(() => {});
        if (s.role === "combobox") { await wait(900); await page.keyboard.press("Enter"); await wait(300); } // a searchable list: take the first match
      }
    }
    await wait(300);
    await page.evaluate(() => [...document.querySelectorAll("[data-guide-overlay] button")].find((b) => /^(next|skip)/i.test(b.getAttribute("data-action") || ""))?.click());
    await wait(500);
  } else if (s.kind === "info") {
    await page.evaluate(() => [...document.querySelectorAll("[data-guide-overlay] button")].find((b) => b.getAttribute("data-action") === "next")?.click());
    await wait(500);
  } else if (s.kind === "fill" || s.kind === "click") {
    await wait(500); // the target may still be on its way (a dialog opening, a page loading)
  } else { await wait(400); }
}

await browser.close();
if (problems.length) { console.error("\nFAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log(`\nwalked ${log.length} steps of ${flowId} in ${lang}: no problems`);
