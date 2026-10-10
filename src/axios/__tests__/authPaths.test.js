import { describe, it, expect } from "vitest";
import { AUTH_PATH } from "../axios";

// A wrong code at the second step of signing in answers 401, and a 401 on any other path makes the axios instance try to renew the
// session and, failing that, send the browser to the sign-in page - which would throw away the code box the person is typing in.
// The auth calls are exempt from that; this pins which ones.
describe("which calls never trigger a session refresh", () => {
  it("includes the sign-in, its second step, refresh, logout, and the two public password calls", () => {
    for (const url of ["/login", "/login/2fa", "/auth/login/2fa", "/refresh-token", "/logout", "/auth/forgot-password", "/auth/reset-password"]) {
      expect(AUTH_PATH.test(url), url).toBe(true);
    }
  });

  it("does not include the calls of a signed-in person, whose 401 really does mean the session ended", () => {
    for (const url of ["/auth/2fa", "/auth/2fa/setup", "/auth/2fa/enable", "/auth/2fa/disable", "/auth/2fa/recovery-codes", "/auth/security-policy", "/organisation/status", "/profile/change-password", "/access/users"]) {
      expect(AUTH_PATH.test(url), url).toBe(false);
    }
  });
});
