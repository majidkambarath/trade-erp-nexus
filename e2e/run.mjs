// Runs the end-to-end scripts one after another and sums up. They share ports, so they never run at the same time.
//
//   npm run e2e                  every script
//   npm run e2e -- rbac send     only those
//   npm run e2e -- --list        what there is
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const NOT_SCRIPTS = new Set(["paths.mjs", "run.mjs"]);
const all = readdirSync(here).filter((f) => f.endsWith(".mjs") && !NOT_SCRIPTS.has(f)).map((f) => f.replace(/\.mjs$/, "")).sort();

const args = process.argv.slice(2);
if (args.includes("--list")) {
  console.log(all.join("\n"));
  process.exit(0);
}
const asked = args.filter((a) => !a.startsWith("-") && a !== "all");
const unknown = asked.filter((a) => !all.includes(a));
if (unknown.length) {
  console.error(`No such script: ${unknown.join(", ")}. There are: ${all.join(", ")}`);
  process.exit(2);
}
const names = asked.length ? asked : all;

const run = (name) =>
  new Promise((resolve) => {
    const started = Date.now();
    let summary = "";
    console.log(`\n######## ${name}`);
    const child = spawn(process.execPath, [join(here, `${name}.mjs`)], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    const tee = (stream, out) => stream.on("data", (chunk) => {
      const text = chunk.toString();
      out.write(text);
      const m = text.match(/(\d+) passed, (\d+) failed/g);
      if (m) summary = m.at(-1);
    });
    tee(child.stdout, process.stdout);
    tee(child.stderr, process.stderr);
    child.on("close", (code) => resolve({ name, code, summary, seconds: Math.round((Date.now() - started) / 1000) }));
  });

const results = [];
for (const name of names) results.push(await run(name));

console.log("\n======== end-to-end summary");
for (const r of results) console.log(`${r.code === 0 ? "ok  " : "FAIL"}  ${r.name.padEnd(14)} ${r.summary.padEnd(20)} ${r.seconds}s`);
process.exit(results.some((r) => r.code !== 0) ? 1 : 0);
