import { readFileSync } from "node:fs";
import path from "node:path";
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

  it("keeps a same-origin path as it is, so the browser calls the site's own address", () => {
    expect(resolveApiBaseUrl("/api/v1")).toBe("/api/v1");
    expect(resolveApiBaseUrl("/api/v1/")).toBe("/api/v1");
  });
});

// The backend's address must not reach the browser. These read the deployment files, so a later edit
// that pastes the onrender.com host back in as VITE_API_URL fails here instead of in the Network tab.
describe("deployment keeps the backend address out of the bundle", () => {
  const read = (file) => readFileSync(path.resolve(process.cwd(), file), "utf8");

  it("builds with a same-origin API path", () => {
    expect(read(".env.production")).toMatch(/^VITE_API_URL=\/api\/v1\s*$/m);
    expect(read("render.yaml")).toMatch(/key: VITE_API_URL\s*\n\s*value: \/api\/v1\s*$/m);
  });

  it("forwards /api/* to the backend with a rewrite that comes before the SPA fallback", () => {
    const yaml = read("render.yaml");
    const proxy = yaml.search(/source: \/api\/\*\s*\n\s*destination: https:\/\/\S+\/api\/\*/);
    const fallback = yaml.search(/source: \/\*\s*\n\s*destination: \/index\.html/);
    expect(proxy).toBeGreaterThan(-1);
    expect(fallback).toBeGreaterThan(proxy);
    expect(yaml).toMatch(/type: rewrite\s*\n\s*source: \/api\/\*/);
  });
});
