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

  // CLAUDE.md's "Deployment (Render)": the live deploy sets VITE_API_URL=/api/v1, a RELATIVE path -
  // the backend's address is proxied through this frontend's own render.yaml rewrite and never appears
  // in the bundle. Until now nothing here exercised that branch at all (it falls through to the same
  // `value.includes(API_PATH)` check as an absolute URL, since "/api/v1" already contains "/api/v1"),
  // so a regression here would have shipped unnoticed.
  it("keeps a relative API path as given, the shape the deployed site actually uses", () => {
    expect(resolveApiBaseUrl("/api/v1")).toBe("/api/v1");
    expect(resolveApiBaseUrl("/api/v1/")).toBe("/api/v1");
  });
});
