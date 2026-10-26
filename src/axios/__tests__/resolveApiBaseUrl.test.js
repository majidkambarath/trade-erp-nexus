import { readFileSync, readdirSync } from "node:fs";
import { sep } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "@/axios/axios";

describe("resolveApiBaseUrl", () => {
  it("falls back to the local server when nothing is set", () => {
    expect(resolveApiBaseUrl(undefined)).toBe("http://localhost:3000/api/v1");
    expect(resolveApiBaseUrl("")).toBe("http://localhost:3000/api/v1");
    expect(resolveApiBaseUrl("   ")).toBe("http://localhost:3000/api/v1");
  });

  it("keeps a full base URL as given", () => {
    expect(resolveApiBaseUrl("https://trade-erp-nexus-nodejs.onrender.com/api/v1")).toBe(
      "https://trade-erp-nexus-nodejs.onrender.com/api/v1"
    );
  });

  it("adds the /api/v1 prefix when only the host was configured", () => {
    expect(resolveApiBaseUrl("https://trade-erp-nexus-nodejs.onrender.com")).toBe(
      "https://trade-erp-nexus-nodejs.onrender.com/api/v1"
    );
  });

  it("ignores a trailing slash in either form", () => {
    expect(resolveApiBaseUrl("https://api.example.com/")).toBe("https://api.example.com/api/v1");
    expect(resolveApiBaseUrl("https://api.example.com/api/v1/")).toBe(
      "https://api.example.com/api/v1"
    );
  });

  it("leaves a host that already serves the API under a sub-path alone", () => {
    expect(resolveApiBaseUrl("https://example.com/erp/api/v1")).toBe(
      "https://example.com/erp/api/v1"
    );
  });
});

// The deployment hides the backend behind this site's own origin: VITE_API_URL is a relative path and an /api/* rewrite
// passes the call on, so no request a client can see names the backend. Three things have to hold together for that, and
// each fails silently in its own way - leaving a working app that quietly talks to the backend direct.
describe("deployment keeps the backend address out of the bundle", () => {
  const root = cwd() + "/"; // vitest runs from the project root
  const read = (name) => readFileSync(root + name, "utf8");
  const lines = (text) => text.split("\n").map((l) => l.trim());

  // The branch the whole arrangement rests on, and it had no test of its own: a relative path must pass through
  // untouched. Treated as a bare host it would become "/api/v1/api/v1" and every call would 404.
  it("passes a same-origin path through unchanged", () => {
    expect(resolveApiBaseUrl("/api/v1")).toBe("/api/v1");
    expect(resolveApiBaseUrl("/api/v1/")).toBe("/api/v1");
  });

  it("builds against this site's own origin, not the backend's", () => {
    const line = lines(read(".env.production")).find((l) => l.startsWith("VITE_API_URL="));
    expect(line).toBe("VITE_API_URL=/api/v1");
  });

  // Order is the failure that looks like a total outage: below the SPA fallback, /* catches every API call and answers
  // index.html, so the first request dies on a JSON parse error.
  it("rewrites /api/* to the backend BEFORE the SPA fallback", () => {
    const yaml = read("render.yaml");
    const api = yaml.indexOf("source: /api/*");
    const spa = yaml.indexOf("source: /*");
    expect(api).toBeGreaterThan(-1);
    expect(spa).toBeGreaterThan(-1);
    expect(api).toBeLessThan(spa);
  });

  // The console is the one deliberate exception (src/platform/platformApi.js): it reaches the backend directly so its
  // per-address sign-in limit survives, and it sits in a lazily-loaded chunk no customer downloads. Anywhere else a
  // hardcoded backend address puts it straight back into the main bundle. A comment naming it is fine; a string is not.
  it("has the backend address in no module a customer loads", () => {
    const bare = (f) => lines(read("src/" + f)).filter((l) => !l.startsWith("//")).join(" ");
    const offenders = readdirSync(root + "src", { recursive: true, encoding: "utf8" })
      .map((f) => f.split(sep).join("/"))
      .filter((f) => /\.(js|jsx)$/.test(f))
      .filter((f) => !f.startsWith("platform/") && !f.includes("__tests__/"))
      .filter((f) => bare(f).includes("trade-erp-nexus-nodejs.onrender.com"));
    expect(offenders).toEqual([]);
  });
});
