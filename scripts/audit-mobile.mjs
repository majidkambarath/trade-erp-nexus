// Checks every screen for the handful of things that actually break a layout on a phone.
//
//   node scripts/audit-mobile.mjs            report
//   node scripts/audit-mobile.mjs --json     machine-readable
//
// It is a lint, not a renderer: it finds the patterns that cannot work at 390px however they
// are laid out. A clean run does not prove a page looks right - it proves the known traps are
// gone, which is what keeps them from coming back.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(p, out);
    } else if (/\.jsx?$/.test(name)) out.push(p);
  }
  return out;
}

// A phone is 320-430px wide. Anything that claims more than that without a breakpoint, or
// that only responds to a cursor, is a defect - these are the shapes those take.
const RULES = [
  {
    id: "fixed-width",
    severity: "error",
    note: "a width wider than a phone, with no smaller fallback",
    // w-[500px], min-w-[32rem], w-96 ... but not max-w-*, and not when already scoped to a breakpoint
    test: (line) => {
      const m = [...line.matchAll(/(?<!max-)(?<![a-z:-])(?:min-)?w-\[(\d+)(px|rem)\]/g)];
      for (const hit of m) {
        const px = hit[2] === "rem" ? Number(hit[1]) * 16 : Number(hit[1]);
        if (px <= 430) continue;
        // scoped to a breakpoint (sm:w-[...]) is fine
        const before = line.slice(Math.max(0, hit.index - 4), hit.index);
        if (/(sm|md|lg|xl):$/.test(before)) continue;
        return `${hit[0]} (${px}px)`;
      }
      return null;
    },
  },
  {
    id: "wide-grid",
    severity: "error",
    note: "three or more columns on a phone",
    test: (line) => {
      const m = [...line.matchAll(/(?<![a-z:-])grid-cols-(\d+)/g)];
      for (const hit of m) {
        if (Number(hit[1]) < 3) continue;
        const before = line.slice(Math.max(0, hit.index - 10), hit.index);
        if (/(sm|md|lg|xl|\[[^\]]+\]):$/.test(before)) continue;
        return hit[0];
      }
      return null;
    },
  },
  {
    id: "hover-only",
    severity: "error",
    note: "revealed by hover alone, so unreachable by touch",
    test: (line) =>
      /group-hover:(opacity-100|visible|flex|block)/.test(line) &&
      !/group-focus-within:/.test(line)
        ? "group-hover with no focus-within"
        : null,
  },
  {
    id: "viewport-width",
    severity: "warn",
    note: "vw/vh units ignore the browser chrome and the keyboard; prefer dvh/dvw",
    test: (line) => {
      const m = line.match(/(?<![a-z-])(?:h|min-h|max-h)-\[?\d*v h?\]?/);
      const vh = line.match(/\d+vh(?!\w)/);
      return vh && !/dvh/.test(line) ? vh[0] : m ? m[0] : null;
    },
  },
  {
    id: "whitespace-nowrap-wide",
    severity: "warn",
    note: "nowrap on a long text cell can push a row past the screen",
    test: (line) =>
      /whitespace-nowrap/.test(line) && /(narration|description|address|remarks|notes)/i.test(line)
        ? "whitespace-nowrap on free text"
        : null,
  },
  {
    id: "raw-table",
    severity: "warn",
    note: "a table that is neither a DataTable nor pinned (table-pin-first)",
    file: (src, rel) => {
      if (!/<table/.test(src)) return null;
      // already handled: cards from a breakpoint down, a pinned matrix, or a printed document
      if (/DataTable|table-pin-first|borderCollapse|document\.write|printWindow/.test(src)) return null;
      // TableView is the pointer half of a pair: these screens hand a phone their GridView
      if (/TableView\.jsx$/.test(rel)) return null;
      return "raw <table>";
    },
  },
  {
    id: "toLocaleDateString",
    severity: "error",
    note: "dates must go through utils/format so they follow the user's preference",
    test: (line) => (/toLocaleDateString|toLocaleTimeString/.test(line) ? "toLocaleDateString" : null),
  },
];

// Lines that are not layout at all: printed documents built as HTML strings, and comments.
const skipLine = (line) =>
  /^\s*(\/\/|\*|\/\*)/.test(line) || /(printWindow|document\.write|`<!DOCTYPE|<html)/i.test(line);

const files = walk(SRC).filter((f) => !f.includes("__tests__"));
const findings = [];

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = relative(ROOT, file).replace(/\\/g, "/");

  for (const rule of RULES) {
    if (rule.file) {
      const hit = rule.file(src, rel);
      if (hit) findings.push({ file: rel, line: 1, rule: rule.id, severity: rule.severity, hit, note: rule.note });
      continue;
    }
    // A file whose tables are pinned scrolls them under a frozen first column, so a width
    // floor inside it is the point of the pin, not an overflow.
    const pinned = /table-pin-first/.test(src);
    src.split("\n").forEach((line, i) => {
      if (skipLine(line)) return;
      if (pinned && rule.id === "fixed-width" && /min-w-/.test(line)) return;
      const hit = rule.test(line);
      if (hit) findings.push({ file: rel, line: i + 1, rule: rule.id, severity: rule.severity, hit, note: rule.note });
    });
  }
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");

  const show = (list, title) => {
    if (!list.length) return;
    console.log(`\n${title} (${list.length})`);
    const byRule = new Map();
    for (const f of list) {
      if (!byRule.has(f.rule)) byRule.set(f.rule, []);
      byRule.get(f.rule).push(f);
    }
    for (const [rule, items] of byRule) {
      console.log(`\n  ${rule} - ${items[0].note}`);
      for (const f of items.slice(0, 30)) console.log(`    ${f.file}:${f.line}  ${f.hit}`);
      if (items.length > 30) console.log(`    ... and ${items.length - 30} more`);
    }
  };

  console.log(`Scanned ${files.length} files.`);
  show(errors, "MUST FIX");
  show(warns, "WORTH A LOOK");
  if (!findings.length) console.log("\nNothing found.");
  console.log("");
  process.exit(errors.length ? 1 : 0);
}
