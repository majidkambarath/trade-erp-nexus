import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import axios from "axios";
import axiosInstance from "../axios";
import { setSession, getAccessToken } from "../session";

// A request answers 401, so the tab tries to renew the session once (POST /refresh-token, with
// the cookie the browser holds - that call goes through the raw `axios` import, not this
// instance, because it must never itself trigger a retry). What happens next used to be the
// same whatever the renewal answered: clear the session and bounce to sign-in. That is right
// when the server actually says no (401/403 - the cookie is missing, expired, reused, or the
// session was revoked), and wrong when the renewal itself never got an answer at all - a network
// error, or a 5xx while Render's free plan is still waking the backend up (10-30s). Either of
// those must leave the session exactly as it was, so a retry a moment later can still succeed.
const fail401 = (config) => {
  const response = { status: 401, data: { success: false, message: "no" }, headers: {}, config, statusText: "" };
  return Promise.reject(Object.assign(new Error("Request failed with status code 401"), { config, response, isAxiosError: true }));
};

let assignSpy;
let originalLocation;

beforeEach(() => {
  sessionStorage.clear();
  setSession({ accessToken: "old-token", admin: { _id: "a1" } });
  axiosInstance.defaults.adapter = (config) => fail401(config);
  // jsdom's own location.assign is non-configurable, so the whole object is swapped for one
  // whose methods can be spied on. Away from "/" so sendToSignIn does not short-circuit (the
  // sign-in page itself never redirects to itself).
  originalLocation = window.location;
  assignSpy = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...originalLocation, pathname: "/dashboard", search: "", assign: assignSpy },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
  vi.restoreAllMocks();
});

describe("what a failed session renewal means", () => {
  it("a network error (no response at all) leaves the session alone", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(Object.assign(new Error("Network Error"), { isAxiosError: true }));

    await axiosInstance.get("/organisation/status").catch(() => {});

    expect(getAccessToken()).toBe("old-token");
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("a 503 while the backend is still cold-starting leaves the session alone", async () => {
    const err503 = Object.assign(new Error("Request failed with status code 503"), {
      isAxiosError: true,
      response: { status: 503, data: {}, headers: {}, statusText: "" },
    });
    vi.spyOn(axios, "post").mockRejectedValue(err503);

    await axiosInstance.get("/organisation/status").catch(() => {});

    expect(getAccessToken()).toBe("old-token");
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("a 502 while the backend is still cold-starting leaves the session alone", async () => {
    const err502 = Object.assign(new Error("Request failed with status code 502"), {
      isAxiosError: true,
      response: { status: 502, data: {}, headers: {}, statusText: "" },
    });
    vi.spyOn(axios, "post").mockRejectedValue(err502);

    await axiosInstance.get("/organisation/status").catch(() => {});

    expect(getAccessToken()).toBe("old-token");
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("the renewal itself answering 401 clears the session and goes to sign-in", async () => {
    const err401 = Object.assign(new Error("Request failed with status code 401"), {
      isAxiosError: true,
      response: { status: 401, data: {}, headers: {}, statusText: "" },
    });
    vi.spyOn(axios, "post").mockRejectedValue(err401);

    await axiosInstance.get("/organisation/status").catch(() => {});

    expect(getAccessToken()).toBeNull();
    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy.mock.calls[0][0]).toContain("/?next=");
  });

  it("the renewal itself answering 403 clears the session and goes to sign-in", async () => {
    const err403 = Object.assign(new Error("Request failed with status code 403"), {
      isAxiosError: true,
      response: { status: 403, data: {}, headers: {}, statusText: "" },
    });
    vi.spyOn(axios, "post").mockRejectedValue(err403);

    await axiosInstance.get("/organisation/status").catch(() => {});

    expect(getAccessToken()).toBeNull();
    expect(assignSpy).toHaveBeenCalledTimes(1);
  });
});
