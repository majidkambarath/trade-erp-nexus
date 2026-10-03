import { describe, it, expect } from "vitest";
import { priorityDotClass, statusClasses, statusTone } from "../status";

describe("statusTone", () => {
  it.each([
    ["DRAFT", "neutral"],
    ["PENDING", "warning"],
    ["APPROVED", "success"],
    ["REJECTED", "danger"],
    ["CONFIRMED", "info"],
    ["INVOICED", "info"],
    ["FINALIZED", "info"],
    ["SUBMITTED", "success"],
    ["CANCELLED", "neutral"],
  ])("%s -> %s", (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });

  it("normalises case, spaces and hyphens", () => {
    expect(statusTone("pending")).toBe("warning");
    expect(statusTone("Partially Paid")).toBe("neutral"); // unknown phrase stays neutral
    expect(statusTone("partial")).toBe("warning");
  });

  it("falls back to neutral for unknown or missing statuses", () => {
    expect(statusTone("SOMETHING_NEW")).toBe("neutral");
    expect(statusTone(undefined)).toBe("neutral");
    expect(statusTone(null)).toBe("neutral");
  });

  // On the purchase page Rejected and Draft used to render identically.
  it("keeps draft and rejected visually distinct", () => {
    expect(statusClasses("REJECTED")).not.toBe(statusClasses("DRAFT"));
  });
});

describe("classes use theme tokens only", () => {
  const all = [
    ...["DRAFT", "PENDING", "APPROVED", "REJECTED", "CONFIRMED"].map(statusClasses),
    ...["High", "Medium", "Low", "Unknown"].map(priorityDotClass),
  ];

  it("never uses raw palette colours or the brand accent", () => {
    for (const cls of all) {
      expect(cls).not.toMatch(/\b(amber|yellow|red|green|emerald|rose|slate|gray|blue|purple)-\d/);
      expect(cls).not.toMatch(/brand|highlight/);
    }
  });

  it("maps priorities by severity", () => {
    expect(priorityDotClass("High")).toBe("bg-status-danger");
    expect(priorityDotClass("Medium")).toBe("bg-status-warning");
    expect(priorityDotClass("Low")).toBe("bg-muted-foreground");
  });
});
