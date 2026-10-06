import { describe, it, expect, vi, beforeEach } from "vitest";

const post = vi.hoisted(() => vi.fn());
vi.mock("axios", () => ({
  default: {
    post,
    create: () => ({ interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }, post: vi.fn() }),
  },
}));

import { refreshSession, restoreSession } from "../axios";
import { clearSession, getAccessToken, getAdmin, safeNext } from "../session";

describe("safeNext", () => {
  it("keeps a path inside the app", () => {
    expect(safeNext("/sales-order?id=1")).toBe("/sales-order?id=1");
  });

  it("refuses anything that would leave the app", () => {
    expect(safeNext("//evil.example")).toBe("/dashboard");
    expect(safeNext("/\\evil.example")).toBe("/dashboard");
    expect(safeNext("https://evil.example")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });
});

describe("session refresh", () => {
  beforeEach(() => {
    post.mockReset();
    clearSession();
  });

  it("shares one refresh between callers that ask together", async () => {
    post.mockResolvedValue({ data: { success: true, data: { accessToken: "a1", admin: { id: "x" } } } });

    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBe("a1");
    expect(getAdmin()).toEqual({ id: "x" });
  });

  it("sends the cookie and no token in the body", async () => {
    post.mockResolvedValue({ data: { success: true, data: { accessToken: "a2" } } });
    await refreshSession();
    const [, body, config] = post.mock.calls[0];
    expect(body).toEqual({});
    expect(config).toEqual({ withCredentials: true });
  });

  it("restoreSession reports false, and keeps no token, when the cookie has gone", async () => {
    post.mockRejectedValue(Object.assign(new Error("Unauthorized"), { response: { status: 401 } }));

    expect(await restoreSession()).toBe(false);
    expect(getAccessToken()).toBeNull();
  });
});
