import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRODUCT_VERSION } from "../../config/product";

// The worker names its caches after the release, and a worker whose bytes did not change is never offered to
// anyone as an update. It was left at v1.0.0.1 through four releases because nothing said so: this does.
// vitest runs from the project root; globalThis keeps the linter, which assumes a browser, quiet
const worker = () => readFileSync(resolve(globalThis.process.cwd(), "public/sw.js"), "utf8");

describe("service worker release", () => {
  it("carries the product version, so every release is offered as an update", () => {
    const named = worker().match(/const VERSION = "v([^"]+)";/)?.[1];
    expect(named).toBe(PRODUCT_VERSION);
  });

  // A page opened from an emailed link is a tokenised address. Caching it would leave a customer's
  // document on a shared phone, so the shell cache must never name it.
  it("never caches the public document page or any API answer", () => {
    const text = worker();
    const shell = text.match(/const SHELL_URLS = \[([^\]]*)\]/)?.[1] || "";
    expect(shell).not.toMatch(/\/d\//);
    expect(text).toMatch(/url\.pathname\.startsWith\("\/api"\) \|\| url\.pathname\.includes\("\/api\/v1"\)\) return;/);
  });
});
