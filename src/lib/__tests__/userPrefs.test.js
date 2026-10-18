import { describe, it, expect, beforeEach, vi } from "vitest";
import { clearPrefsFor, prefsFor } from "../userPrefs";

beforeEach(() => {
  window.localStorage.clear();
});

describe("userPrefs: a small per-person store", () => {
  it("get returns the fallback when nothing has been set", () => {
    const prefs = prefsFor("u1");
    expect(prefs.get("display.density", "comfortable")).toBe("comfortable");
  });

  it("set then get round-trips a nested path", () => {
    const prefs = prefsFor("u1");
    prefs.set("display.density", "compact");
    expect(prefs.get("display.density")).toBe("compact");
  });

  it("a whole bucket can be set and read back", () => {
    const prefs = prefsFor("u1");
    prefs.set("views", { customers: [{ id: "1", name: "Active only" }] });
    expect(prefs.get("views.customers")).toEqual([{ id: "1", name: "Active only" }]);
  });

  it("is scoped per person: one person's key never reads another's", () => {
    prefsFor("u1").set("display.density", "compact");
    expect(prefsFor("u2").get("display.density", "comfortable")).toBe("comfortable");
  });

  it("a localStorage that throws degrades to the fallback instead of throwing", () => {
    const spy = vi.spyOn(window.localStorage.__proto__, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(prefsFor("u1").get("display.density", "comfortable")).toBe("comfortable");
    spy.mockRestore();
  });

  it("a write that throws (storage full, private mode) does not throw to the caller", () => {
    const spy = vi.spyOn(window.localStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => prefsFor("u1").set("display.density", "compact")).not.toThrow();
    spy.mockRestore();
  });

  it("corrupt JSON in storage is ignored rather than thrown", () => {
    window.localStorage.setItem("zarvia.prefs.u1", "{not json");
    expect(prefsFor("u1").get("display.density", "comfortable")).toBe("comfortable");
  });

  it("no userId reads and writes as a safe no-op", () => {
    const prefs = prefsFor(null);
    expect(() => prefs.set("display.density", "compact")).not.toThrow();
    expect(prefs.get("display.density", "comfortable")).toBe("comfortable");
  });

  it("clearPrefsFor removes only that person's key", () => {
    prefsFor("u1").set("display.density", "compact");
    prefsFor("u2").set("display.density", "compact");
    clearPrefsFor("u1");
    expect(prefsFor("u1").get("display.density", "comfortable")).toBe("comfortable");
    expect(prefsFor("u2").get("display.density", "comfortable")).toBe("compact");
  });
});
