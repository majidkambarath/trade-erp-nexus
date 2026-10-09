import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";

// config/navigation.js - and so lib/organisation.js and lib/permissions.js, which it imports - is loaded by plain Node outside the app:
// the mobile sweep reads the page list from it. Node resolves imports strictly (an extension on every relative import, nothing the
// bundler adds, no browser-only module), so one convenient import in that chain breaks the sweep while every other test here, which
// goes through Vite, stays green. This loads the files the way the sweep does.
describe("the files that plain Node loads", () => {
  for (const rel of ["src/config/navigation.js", "src/lib/organisation.js", "src/lib/permissions.js"]) {
    it(`${rel} loads outside the bundler`, () => {
      const url = pathToFileURL(path.resolve(process.cwd(), rel)).href;
      const out = execFileSync(process.execPath, ["--input-type=module", "-e", `const m = await import(${JSON.stringify(url)}); console.log(Object.keys(m).length)`], { encoding: "utf8", timeout: 30000 });
      expect(Number(out.trim())).toBeGreaterThan(0);
    });
  }
});
