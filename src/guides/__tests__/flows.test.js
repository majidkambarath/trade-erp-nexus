import { describe, it, expect } from "vitest";
import { FLOWS, LANGS, flowsFor, wording } from "../index";
import en from "../i18n/en";
import ar from "../i18n/ar";
import hi from "../i18n/hi";
import ml from "../i18n/ml";

describe("the flows", () => {
  it("have unique ids and unique step ids", () => {
    expect(new Set(FLOWS.map((f) => f.id)).size).toBe(FLOWS.length);
    for (const f of FLOWS) expect(new Set(f.steps.map((s) => s.id)).size, f.id).toBe(f.steps.length);
  });

  it("start with a page to go to and end on a done card", () => {
    for (const f of FLOWS) {
      expect(f.steps[0].kind, f.id).toBe("go");
      expect(f.steps[f.steps.length - 1].kind, f.id).toBe("done");
    }
  });

  it("give every step a kind it understands, and a target when it points at something", () => {
    for (const f of FLOWS) for (const s of f.steps) {
      expect(["go", "click", "fill", "info", "done"], `${f.id}.${s.id}`).toContain(s.kind);
      if (["click", "fill", "info"].includes(s.kind)) expect(s.target, `${f.id}.${s.id}`).toBeTruthy();
      if (s.kind === "go") expect(s.to.startsWith("/"), `${f.id}.${s.id}`).toBe(true);
    }
  });

  it("have English words for the flow and for every step", () => {
    for (const f of FLOWS) {
      expect(en[`flow.${f.id}`]?.title, `flow.${f.id}`).toBeTruthy();
      for (const s of f.steps) {
        const w = en[`${f.id}.${s.id}`];
        expect(w?.title, `${f.id}.${s.id} title`).toBeTruthy();
        expect(w?.text, `${f.id}.${s.id} text`).toBeTruthy();
      }
    }
  });

  it("only name a next guide that exists", () => {
    for (const f of FLOWS) for (const s of f.steps) if (s.next) expect(FLOWS.some((x) => x.id === s.next), `${f.id}.${s.id}`).toBe(true);
  });

  it("offer a person only what their role and plan allow", () => {
    const some = flowsFor({ mayUse: (p) => p === "sales.create" });
    expect(some.length).toBeGreaterThan(0);
    for (const f of some) expect(f.permission, f.id).toBe("sales.create"); // nothing that needs another key slips through
    expect(some.map((f) => f.id)).toContain("add-customer");
    expect(some.map((f) => f.id)).not.toContain("add-vendor");
    expect(flowsFor({ mayUse: () => false })).toEqual([]);
  });

  it("fall back to English a line at a time, never to a blank", () => {
    expect(wording({ reviewed: false }, "add-customer.name").title).toBe("Their name");
    expect(wording(null, "no.such.key")).toEqual({ title: "", text: "" });
  });

  // The rule that keeps the four languages whole: a line added to English without its translation fails here,
  // so a client choosing Malayalam never meets an English card by accident.
  describe.each([["ar", ar], ["hi", hi], ["ml", ml]])("%s", (code, table) => {
    it("has every line English has, with a title and a text", () => {
      const lines = Object.keys(en).filter((k) => k !== "reviewed" && k !== "ui");
      for (const k of lines) {
        expect(table[k]?.title, `${code} ${k} title`).toBeTruthy();
        expect(table[k]?.text, `${code} ${k} text`).toBeTruthy();
      }
    });
    it("has every interface string, with the same kind (text or function) and no stray ones", () => {
      expect(Object.keys(table.ui).sort()).toEqual(Object.keys(en.ui).sort());
      for (const k of Object.keys(en.ui)) expect(typeof table.ui[k], `${code} ui.${k}`).toBe(typeof en.ui[k]);
      expect(String(table.ui.stepOf(2, 9))).toMatch(/2/);
      expect(String(table.ui.stepOf(2, 9))).toMatch(/9/);
    });
    it("says so while it has not been reviewed by a native speaker", () => {
      expect(typeof table.reviewed).toBe("boolean");
    });
    it("is a different text from English, not a copy", () => {
      expect(table["add-customer.name"].text).not.toBe(en["add-customer.name"].text);
    });
  });

  it("list the four languages, Arabic right to left", () => {
    expect(LANGS.map((l) => l.code)).toEqual(["en", "ml", "hi", "ar"]);
    expect(LANGS.find((l) => l.code === "ar").dir).toBe("rtl");
  });
});
