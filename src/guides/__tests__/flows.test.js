import { describe, it, expect } from "vitest";
import { FLOWS, LANGS, flowsFor, wording } from "../index";
import en from "../i18n/en";

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
    expect(some.map((f) => f.id)).toEqual(["add-customer"]);
    expect(flowsFor({ mayUse: () => false })).toEqual([]);
  });

  it("fall back to English a line at a time, never to a blank", () => {
    expect(wording({ reviewed: false }, "add-customer.name").title).toBe("Their name");
    expect(wording(null, "no.such.key")).toEqual({ title: "", text: "" });
  });

  it("list the four languages, Arabic right to left", () => {
    expect(LANGS.map((l) => l.code)).toEqual(["en", "ar", "hi", "ml"]);
    expect(LANGS.find((l) => l.code === "ar").dir).toBe("rtl");
  });
});
