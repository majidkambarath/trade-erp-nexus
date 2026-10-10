import { describe, it, expect, beforeEach } from "vitest";
import { clearPageSessions, pageSession } from "../pageSession";
import { clearSession, setSession } from "../../axios/session";

describe("pageSession", () => {
  beforeEach(() => clearPageSessions());

  it("gives back what was kept, and the fallback when nothing was", () => {
    const s = pageSession("customers");
    expect(s.get("filters")).toBeNull();
    expect(s.get("filters", {})).toEqual({});
    s.set("filters", { status: "active" });
    expect(s.get("filters")).toEqual({ status: "active" });
  });

  it("keeps falsy values that were set on purpose (an empty search, false, 0)", () => {
    const s = pageSession("customers");
    s.set("searchTerm", "");
    s.set("showFilters", false);
    s.set("page", 0);
    expect(s.get("searchTerm", "x")).toBe("");
    expect(s.get("showFilters", true)).toBe(false);
    expect(s.get("page", 9)).toBe(0);
  });

  it("keeps each screen apart, and a File stays a File", () => {
    const file = new File(["x"], "id.pdf");
    pageSession("staff").set("formData", { idProof: file });
    pageSession("vendors").set("formData", { name: "v" });
    expect(pageSession("staff").get("formData").idProof).toBe(file);
    expect(pageSession("vendors").get("formData")).toEqual({ name: "v" });
  });

  it("removes one key, or every key of one screen, and no other", () => {
    const a = pageSession("a");
    const b = pageSession("b");
    a.set("one", 1);
    a.set("two", 2);
    b.set("one", 1);
    a.remove("one");
    expect(a.get("one")).toBeNull();
    expect(a.get("two")).toBe(2);
    a.clear();
    expect(a.get("two")).toBeNull();
    expect(b.get("one")).toBe(1);
  });

  it("is not the browser's storage: nothing is written to it", () => {
    sessionStorage.clear();
    localStorage.clear();
    pageSession("staff").set("formData", { idNo: "784-1990-1234567-1" });
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it("is emptied at sign-out, so the next person starts clean", () => {
    setSession({ accessToken: "t", admin: { id: "1" } });
    pageSession("customers").set("searchTerm", "al noor");
    clearSession();
    expect(pageSession("customers").get("searchTerm")).toBeNull();
  });
});
