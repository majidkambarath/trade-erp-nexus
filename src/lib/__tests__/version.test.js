import { describe, expect, it } from "vitest";
import { APP_VERSION, buildState, supportLine } from "../version";
import { version as pkgVersion } from "../../../package.json";

describe("APP_VERSION", () => {
  it("is the version in package.json, so the figure on screen is the one that was built", () => {
    expect(APP_VERSION).toBe(pkgVersion);
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe("buildState", () => {
  it("says the two agree when they do", () => {
    const s = buildState(APP_VERSION);
    expect(s.state).toBe("matched");
    expect(s.app).toBe(APP_VERSION);
    expect(s.api).toBe(APP_VERSION);
  });

  it("is waiting, not wrong, while the status is still loading", () => {
    for (const nothing of [undefined, null]) {
      const s = buildState(nothing);
      expect(s.state).toBe("waiting");
      expect(s.api).toBeNull();
      // It must never read as a mismatch just because the answer has not arrived.
      expect(s.note).not.toMatch(/different/i);
    }
  });

  it("says plainly when a server does not report a version at all", () => {
    expect(buildState("unknown").state).toBe("unknown");
  });

  it("reports a mismatch without calling it an error - during a deploy the two differ for a minute", () => {
    const s = buildState("2.1.0.0");
    expect(s.state).toBe("mismatched");
    expect(s.api).toBe("2.1.0.0");
    expect(s.app).toBe(APP_VERSION);
    expect(s.note).toMatch(/not finished deploying/);
  });

  it("compares as text, so 2.3.0.0 and 2.3.0 are not treated as the same build", () => {
    expect(buildState("2.3.0").state).toBe("mismatched");
  });
});

describe("supportLine", () => {
  it("is one line carrying both versions and the day", () => {
    expect(supportLine("2.3.0.0", new Date("2026-11-07T10:00:00Z"))).toBe(`App ${APP_VERSION} · API 2.3.0.0 · 2026-11-07`);
  });

  it("says unknown rather than leaving a hole when the server did not answer", () => {
    expect(supportLine(null, new Date("2026-11-07T10:00:00Z"))).toMatch(/API unknown/);
  });
});
