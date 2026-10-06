// Verifies the installable bits against a real production build: the manifest parses and is
// served, the icons exist, and the service worker registers and takes control.
//
//   npm run build && node scripts/check-pwa.mjs
import { spawn } from "node:child_process";
import puppeteer from "puppeteer";

const PORT = 4178;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const preview = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "preview", "--port", String(PORT), "--strictPort"],
  { stdio: "ignore", shell: process.platform === "win32" }
);

const stop = (code) => { try { preview.kill(); } catch { /* gone */ } process.exit(code); };

for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break; } catch { /* starting */ }
  await wait(500);
}

const checks = [];
const check = (name, ok, detail = "") => { checks.push({ name, ok, detail }); console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`); };

const manifestRes = await fetch(`http://localhost:${PORT}/manifest.webmanifest`);
check("manifest is served", manifestRes.ok, `${manifestRes.status} ${manifestRes.headers.get("content-type")}`);
const manifest = manifestRes.ok ? await manifestRes.json() : {};
check("manifest has a name and start_url", Boolean(manifest.name && manifest.start_url), manifest.name || "");
check("manifest is standalone", manifest.display === "standalone");
check("manifest declares a maskable icon", (manifest.icons || []).some((i) => i.purpose === "maskable"));
check("manifest has app shortcuts", (manifest.shortcuts || []).length >= 2, `${(manifest.shortcuts || []).length} shortcuts`);

for (const icon of manifest.icons || []) {
  const r = await fetch(`http://localhost:${PORT}${icon.src}`);
  check(`icon ${icon.src} ${icon.sizes}`, r.ok && (r.headers.get("content-type") || "").includes("png"));
}
const apple = await fetch(`http://localhost:${PORT}/apple-touch-icon.png`);
check("apple-touch-icon is served", apple.ok);

const swRes = await fetch(`http://localhost:${PORT}/sw.js`);
const swBody = swRes.ok ? await swRes.text() : "";
check("service worker is served as javascript", swRes.ok && (swRes.headers.get("content-type") || "").includes("javascript"));
check("service worker never caches the API", /url\.pathname\.startsWith\("\/api"\)/.test(swBody));

const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle2" });

const registered = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return Boolean(r);
});
check("service worker registers", registered);

await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload({ waitUntil: "networkidle2" });
const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
check("service worker controls the page after a reload", controlled);

const cached = await page.evaluate(async () => {
  const names = await caches.keys();
  const out = {};
  for (const n of names) out[n] = (await (await caches.open(n)).keys()).length;
  return out;
});
check("the shell is cached", Object.values(cached).some((n) => n > 0), JSON.stringify(cached));

const apiCached = await page.evaluate(async () => {
  for (const n of await caches.keys()) {
    const keys = await (await caches.open(n)).keys();
    if (keys.some((r) => r.url.includes("/api/"))) return true;
  }
  return false;
});
check("no API response was cached", !apiCached);

const meta = await page.evaluate(() => ({
  manifest: Boolean(document.querySelector('link[rel="manifest"]')),
  apple: Boolean(document.querySelector('link[rel="apple-touch-icon"]')),
  themeColor: document.querySelector('meta[name="theme-color"]')?.content,
  viewportFit: (document.querySelector('meta[name="viewport"]')?.content || "").includes("viewport-fit=cover"),
}));
check("page links the manifest", meta.manifest);
check("page links an apple-touch-icon", meta.apple);
check("page sets a theme colour", Boolean(meta.themeColor), meta.themeColor || "");
check("viewport covers the safe areas", meta.viewportFit);

await browser.close();
const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
stop(failed.length ? 1 : 0);
