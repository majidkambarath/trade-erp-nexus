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
