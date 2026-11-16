// One printable page per language for the person who approves a translation: every line as
//   key | English | the translation | what the translation says, back in English | the business terms used.
//   node scripts/guides/review-sheet.mjs [--out=<dir>]     (default: docs/guides-review/)
// The page for Arabic is right to left. Open the HTML in a browser; "Approve" means setting `reviewed: true` in
// src/guides/i18n/<lang>.js after reading it through.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const out = (process.argv.find((a) => a.startsWith("--out=")) || "--out=docs/guides-review").slice(6);
const imp = (p) => import(pathToFileURL(path.resolve(p)).href).then((m) => m.default || m);
// the sources are ES modules that import each other without extensions (resolved by the bundler), so use vite-node
const need = async () => {
  const { createServer } = await import("vite");
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  const load = (p) => vite.ssrLoadModule(p);
  return { vite, load };
};
const { vite, load } = await need();
const en = (await load("/src/guides/i18n/en.js")).default;
const gl = await load("/src/guides/glossary.js");
const names = { ar: "العربية (Arabic)", hi: "हिन्दी (Hindi)", ml: "മലയാളം (Malayalam)" };
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
const chip = (s) => esc(s).replace(/\[\[([^\]]*)\]\]/g, "<b class=n>$1</b>").replace(/\{\{([^}]*)\}\}/g, "<i class=e>$1</i>");
fs.mkdirSync(out, { recursive: true });
for (const code of ["ar", "hi", "ml"]) {
  const t = (await load(`/src/guides/i18n/${code}.js`)).default;
  const b = (await load(`/src/guides/i18n/back/${code}.js`)).default;
  const rows = Object.keys(en).filter((k) => k !== "reviewed" && k !== "ui").map((k) => {
    const terms = gl.termsIn(`${en[k].title} ${en[k].text}`).map((g) => `${g.en[0]} → ${g[code][0]}`).join("<br>");
    return `<tr><td class=k>${k}</td><td><b>${chip(en[k].title)}</b><br>${chip(en[k].text)}</td><td dir="${code === "ar" ? "rtl" : "ltr"}"><b>${chip(t[k]?.title)}</b><br>${chip(t[k]?.text)}</td><td><b>${chip(b[k]?.title)}</b><br>${chip(b[k]?.text)}</td><td class=g>${terms}</td></tr>`;
  }).join("\n");
  fs.writeFileSync(path.join(out, `${code}.html`), `<!doctype html><meta charset=utf-8><title>Review: ${names[code]}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;margin:24px;color:#1d1b18}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d8d3c8;padding:8px;vertical-align:top}th{background:#f4f2ee;text-align:start}.k{font:11px monospace;color:#777;width:9%}.g{font-size:12px;color:#555}b.n{border:1px solid #bbb;background:#f4f2ee;padding:0 4px;border-radius:4px}i.e{background:#efe9da;padding:0 4px}</style>
<h1>Translation review: ${names[code]}</h1><p>Status in the app: <b>${t.reviewed ? "approved" : "in review"}</b>. Read each row: does the translation (column 3) say what the English (column 2) says? Column 4 is the translation written back into English. Boxed words are the screen's own labels and are never translated. Approve by setting <code>reviewed: true</code> in <code>src/guides/i18n/${code}.js</code>.</p>
<table><tr><th>Line</th><th>English</th><th>${names[code]}</th><th>Back into English</th><th>Business terms</th></tr>
${rows}</table>`);
  console.log(`wrote ${path.join(out, code + ".html")}`);
}
await vite.close();
