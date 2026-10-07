import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRODUCT_VERSION } from "../../config/product";

// The worker names its caches after the release, and a worker whose bytes did not change is never offered to
// anyone as an update. It was left at v1.0.0.1 through four releases because nothing said so: this does.
describe("service worker release", () => {
  it("carries the product version, so every release is offered as an update", () => {
    const worker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    const named = worker.match(/const VERSION = "v([^"]+)";/)?.[1];
    expect(named).toBe(PRODUCT_VERSION);
  });
});
