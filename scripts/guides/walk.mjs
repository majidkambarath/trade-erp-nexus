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
const manifestPath = opt("manifest", ""); // for the video recorder: one entry per step with its screenshot and card wording
const email = process.env.GUIDE_EMAIL || "test@gmail.com";
const password = process.env.GUIDE_PASSWORD;
if (!flowId) { console.error("usage: walk.mjs <flow id> [--lang=en]"); process.exit(2); }
if (!password) { console.error("Set GUIDE_PASSWORD (and GUIDE_EMAIL) to a demo company's sign-in."); process.exit(2); }
if (shots || manifestPath) fs.mkdirSync(shots || ".", { recursive: true });
const manifest = [];

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
// a new person is welcomed with a choice of journeys (WelcomeGuide); the walker chooses the guide itself, so it says "not now"
await wait(600);
await page.evaluate(() => document.querySelector("[data-welcome-later]")?.click());

// start in the wanted language first (the choice is remembered per person), then start the guide
await page.click('[data-guide="guide-me"]'); await wait(400);
const started = await page.evaluate((id) => {
  const items = [...document.querySelectorAll("[data-flow]")];
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
  const region = o.querySelector("[role=region]");
  const ps = region ? [...region.querySelectorAll("p")] : [];
  const partsOf = (el) => (el ? [...el.childNodes].map((n) => ({ fixed: n.nodeType === 1 && n.hasAttribute("data-guide-fixed"), s: n.textContent })).filter((x) => x.s) : []);
  return { title: ps.find((p) => p.className.includes("font-semibold"))?.textContent || "", parts: partsOf(ps.find((p) => p.className.includes("leading-relaxed"))), step: o.dataset.guideStep, kind: o.dataset.guideKind, sample: o.dataset.guideSample, card: o.querySelector("[role=region]")?.innerText.replace(/\n+/g, " | "), hasTarget: Boolean(cur), tag: cur?.tagName, role: cur?.getAttribute("role") };
});

const log = [];
const typed = new Set(); // a step is typed into once: a slow advance must not type it twice
let last = null; let since = Date.now();
for (let n = 0; n < 80; n += 1) {
  const s = await read();
  if (!s) { console.log("guide closed"); break; }
  if (s.step !== last) {
    last = s.step; since = Date.now();
    log.push({ step: s.step, kind: s.kind, card: s.card });
    console.log(`${String(log.length).padStart(2)}. ${s.step}  [${s.kind}]  ${s.card?.slice(0, 90)}`);
    if (shots || manifestPath) {
      if (manifestPath) await wait(700); // let the spotlight settle before the picture is taken
      const file = `${shots || "."}/${flowId}-${lang}-${String(log.length).padStart(2)}-${s.step.split(".")[1]}.png`;
      await page.screenshot({ path: file });
      manifest.push({ step: s.step, kind: s.kind, title: s.title, parts: s.parts, shot: file });
    }
  }
  if (s.kind === "done") { console.log("DONE"); break; }
  if (Date.now() - since > 14000) { problems.push(`stuck on ${s.step} (${s.kind}): target ${s.hasTarget ? "found but the step did not advance" : "never found"}`); break; }

  if (s.kind === "click" && s.hasTarget) {
    const h = await page.$("[data-guide-current]");
    if (h) { await h.evaluate((e) => e.scrollIntoView({ block: "center" })); await wait(300); await h.click().catch(() => {}); await wait(700); }
  } else if (s.kind === "fill" && s.hasTarget) {
    const h = await page.$("[data-guide-current]");
    if (h && s.sample && !typed.has(s.step)) {
      typed.add(s.step);
      if (s.tag === "SELECT") { const pick = await h.evaluate((e, want) => { const o = [...e.options].filter((x) => x.value); const hit = o.find((x) => want && (x.value.toLowerCase() === want.toLowerCase() || x.text.toLowerCase() === want.toLowerCase())); return (hit || o[0])?.value; }, s.sample); if (pick) await h.select(pick); }
      else if (s.tag === "INPUT" || s.tag === "TEXTAREA" || (await h.$("input:not([type=hidden])"))) {
        // a guide may highlight the box around a searchable list: type into the input inside it
        const box = s.tag === "INPUT" || s.tag === "TEXTAREA" ? h : await h.$("input:not([type=hidden])");
        const combo = s.role === "combobox" || s.tag !== "INPUT" && s.tag !== "TEXTAREA";
        await box.click({ clickCount: 3 }).catch(() => {}); await box.type(s.sample, { delay: 15 }).catch(() => {});
        if (combo) { await wait(600); await page.waitForFunction(() => document.querySelector("[role=option]") && !/loading/i.test(document.querySelector("[class*=menu], [role=listbox]")?.textContent || ""), { timeout: 8000 }).catch(() => {}); await wait(300); await page.keyboard.press("Enter"); await wait(300); } // a searchable list: take the first match
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

if (manifestPath) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
await browser.close();
if (problems.length) { console.error("\nFAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log(`\nwalked ${log.length} steps of ${flowId} in ${lang}: no problems`);
