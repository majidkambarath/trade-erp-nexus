import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRANDS } from "../../config/brands";

// Tests what actually ships: the real CSS files, in the order index.css imports them,
// with the cascade resolved. Nothing here duplicates a hex value.

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => fs.readFileSync(path.join(srcDir, rel), "utf8");
const indexCss = read("index.css");

const importedFiles = [...indexCss.matchAll(/@import\s+"\.\/(styles\/[^"]+)"/g)].map((m) => m[1]);

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const specificity = (sel) => (sel.match(/\.[\w-]+|\[[^\]]+\]|:root/g) || []).length;

// Rules in true source order, each with its specificity.
const rules = [];
importedFiles.forEach((file, fileIdx) => {
  const css = stripComments(read(file));
  let i = 0;
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, " ");
    const decls = {};
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)) decls[d[1]] = d[2].trim();
    rules.push({ sel, spec: specificity(sel), order: fileIdx * 1000 + i++, decls, file });
  }
});

const activeSelectors = (mode, brand) => {
  const s = [":root"];
  if (mode === "dark") s.push(".dark");
  if (brand) {
    s.push(`[data-brand="${brand}"]`);
    if (mode === "dark") s.push(`.dark[data-brand="${brand}"]`);
  }
  return s;
};

const buildScope = (mode, brand) => {
  const active = new Set(activeSelectors(mode, brand));
  const winner = {};
  for (const r of rules) {
    if (!active.has(r.sel)) continue;
    for (const [name, value] of Object.entries(r.decls)) {
      const cur = winner[name];
      if (!cur || r.spec > cur.spec || (r.spec === cur.spec && r.order > cur.order)) {
        winner[name] = { value, spec: r.spec, order: r.order };
      }
    }
  }
  const resolve = (name, seen = []) => {
    if (seen.includes(name)) throw new Error(`cycle: ${[...seen, name].join(" -> ")}`);
    const w = winner[name];
    if (!w) throw new Error(`undefined token ${name} (mode=${mode}, brand=${brand})`);
    const ref = w.value.match(/^var\((--[\w-]+)\)$/);
    return ref ? resolve(ref[1], [...seen, name]) : w.value;
  };
  return resolve;
};

// ── colour maths ────────────────────────────────────────────────────────────
const rgb = (h) => h.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255);
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h) => {
  const [r, g, b] = rgb(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const lab = (h) => {
  const [r, g, b] = rgb(h).map(lin);
  const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
};
const deltaE = (a, b) => {
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
};

// ── what to check ───────────────────────────────────────────────────────────
const STATUSES = ["success", "warning", "danger", "info"];
// Categorical accents: used for grouping (KPI tiles, charts), never for status.
const ACCENTS = ["teal", "plum", "rose", "olive"];

const TEXT_PAIRS = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["brand-on-soft", "brand-soft"],
  ...STATUSES.flatMap((s) => [
    [`status-${s}`, "card"],
    [`status-${s}`, "background"],
    [`status-${s}`, `status-${s}-soft`],
  ]),
  ...ACCENTS.map((a) => [`accent-${a}-on-soft`, `accent-${a}-soft`]),
];

// WCAG 1.4.11: control boundaries, focus indicators and meaning-bearing graphics.
const NON_TEXT_PAIRS = [
  ["input", "card"],
  ["input", "background"],
  ["ring", "background"],
  ["ring", "card"],
  ["sidebar-ring", "sidebar"],
  ["brand", "card"],
  ["brand", "background"],
  ["chart-1", "card"],
  ["chart-2", "card"],
  ["chart-3", "card"],
  ["chart-4", "card"],
  // accents appear as icons and chart marks on both surfaces
  ...ACCENTS.flatMap((a) => [
    [`accent-${a}`, "card"],
    [`accent-${a}`, "background"],
  ]),
];

const packs = Object.keys(BRANDS);
const scopes = [];
for (const mode of ["light", "dark"]) {
  scopes.push({ label: `${mode} / neutral default`, mode, brand: null });
  for (const id of packs) scopes.push({ label: `${mode} / ${id}`, mode, brand: id });
}

describe.each(scopes)("$label", ({ mode, brand }) => {
  const get = buildScope(mode, brand);
  const c = (name) => get(`--${name}`);

  it.each(TEXT_PAIRS)("text: %s on %s is at least 4.5:1", (fg, bg) => {
    expect(ratio(c(fg), c(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)("non-text: %s against %s is at least 3:1", (fg, bg) => {
    expect(ratio(c(fg), c(bg))).toBeGreaterThanOrEqual(3);
  });

  // Brand colour and warning colour were the SAME hex (#f0c929) before this theme.
  // Luminance alone is not enough to tell them apart for colour-blind users, so status
  // must also carry a text label or icon; this guards the colours themselves.
  it.each(STATUSES)("brand is perceptually distinct from status-%s", (s) => {
    expect(deltaE(c("brand"), c(`status-${s}`))).toBeGreaterThanOrEqual(25);
  });

  // An accent that sits near a status colour would read as meaning something it does not;
  // two accents that sit near each other stop telling four KPI tiles apart.
  it.each(ACCENTS.flatMap((a) => STATUSES.map((st) => [a, st])))(
    "accent %s is perceptually distinct from status-%s",
    (a, st) => {
      expect(deltaE(c(`accent-${a}`), c(`status-${st}`))).toBeGreaterThanOrEqual(25);
    }
  );

  it.each(ACCENTS)("accent %s is perceptually distinct from the brand", (a) => {
    expect(deltaE(c(`accent-${a}`), c("brand"))).toBeGreaterThanOrEqual(25);
  });

  it.each(
    ACCENTS.flatMap((a, i) => ACCENTS.slice(i + 1).map((b) => [a, b]))
  )("accents %s and %s are distinguishable from each other", (a, b) => {
    expect(deltaE(c(`accent-${a}`), c(`accent-${b}`))).toBeGreaterThanOrEqual(25);
  });

  // Surfaces must layer: a card has to read as raised above the page, and the rail/top bar
  // as distinct from both. Before this, --sidebar === --card === --popover === white.
  it("page, chrome and card are distinguishable surfaces", () => {
    expect(ratio(c("card"), c("background"))).toBeGreaterThanOrEqual(1.04);
    expect(ratio(c("card"), c("sidebar"))).toBeGreaterThanOrEqual(1.02);
    expect(ratio(c("secondary"), c("card"))).toBeGreaterThanOrEqual(1.06);
  });

  it("warning and danger do not collapse into one another", () => {
    expect(deltaE(c("status-warning"), c("status-danger"))).toBeGreaterThanOrEqual(18);
  });

  it("the old brand yellow no longer appears as any token", () => {
    for (const name of ["brand", "highlight", "warning", "accent", "ring", "chart-2"]) {
      expect(c(name).toLowerCase()).not.toBe("#f0c929");
    }
  });
});

describe("brand pack completeness", () => {
  const REQUIRED = ["--brand", "--brand-soft", "--brand-on-soft"];
  const declared = (sel) =>
    Object.assign({}, ...rules.filter((r) => r.sel === sel).map((r) => r.decls));

  it("the neutral default defines every brand token in both modes", () => {
    for (const sel of [":root", ".dark"]) {
      const d = declared(sel);
      for (const t of REQUIRED) expect(Object.keys(d)).toContain(t);
    }
  });

  it.each(packs)("%s: defines every brand token in light AND dark", (id) => {
    const light = declared(`[data-brand="${id}"]`);
    const dark = declared(`.dark[data-brand="${id}"]`);
    for (const t of REQUIRED) {
      expect(Object.keys(light), `light ${t}`).toContain(t);
      expect(Object.keys(dark), `dark ${t}`).toContain(t);
    }
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it.each(packs)("%s: its stylesheet is actually imported by index.css", (id) => {
    expect(importedFiles).toContain(`styles/brands/${id}.css`);
  });

  it("every brand stylesheet on disk is registered in config/brands.js", () => {
    const onDisk = fs
      .readdirSync(path.join(srcDir, "styles/brands"))
      .filter((f) => f.endsWith(".css") && !f.startsWith("_"))
      .map((f) => f.replace(/\.css$/, ""));
    expect(onDisk.sort()).toEqual([...packs].sort());
  });
});
