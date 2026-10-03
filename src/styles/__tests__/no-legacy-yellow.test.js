import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Guards the theme decision: status colours come from tokens (src/lib/status.js and the
// --status-* roles), and the gold brand accent is never a fill behind text. Raw yellow
// and amber palette classes bypass both, which is how the app ended up with the brand
// colour and "Pending" being the same yellow.

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sourceFiles(full);
    return /\.(jsx?|css)$/.test(e.name) ? [full] : [];
  });

// Primitive ramps are the one place raw colour values are allowed.
const ALLOWED = [path.join(srcDir, "styles", "tokens", "primitives.css")];

const offenders = (regex) =>
  sourceFiles(srcDir)
    .filter((f) => !ALLOWED.includes(f))
    .flatMap((f) =>
      fs
        .readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ f, line, n: i + 1 }))
        .filter(({ line }) => regex.test(line))
        .map(({ f, n }) => `${path.relative(srcDir, f)}:${n}`)
    );

describe("no legacy yellow", () => {
  it("uses no amber-* or yellow-* palette classes", () => {
    expect(offenders(/\b(amber|yellow)-\d{2,3}\b/)).toEqual([]);
  });

  it("never reintroduces the old brand yellow hex", () => {
    expect(offenders(/#f0c929/i)).toEqual([]);
  });

  it("never fills with the brand accent behind dark text", () => {
    // the pattern that made gold a button fill: bg-[var(--highlight)] ... text-[#171717]
    expect(offenders(/bg-\[var\(--highlight\)\].*text-\[#171717\]/)).toEqual([]);
  });
});
