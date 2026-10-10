import { describe, it, expect } from "vitest";
import { axisScale, signedCompact, waterfallSteps } from "../helpers";

describe("axisScale", () => {
  it("reads in round steps from zero, not 0 / 350k / 700k / 1.3M", () => {
    expect(axisScale([0, 1284000]).ticks).toEqual([0, 500000, 1000000, 1500000]);
    expect(axisScale([0, 700000]).ticks).toEqual([0, 200000, 400000, 600000, 800000]);
  });

  it("includes zero even when every bar is above it, so a bar always starts from the baseline", () => {
    const { domain } = axisScale([12.9, 24.6, 31.2]);
    expect(domain[0]).toBe(0);
    expect(domain[1]).toBeGreaterThanOrEqual(31.2);
  });

  it("goes below zero in the same step when a bar is a loss", () => {
    const { domain, ticks } = axisScale([-3.5, 24.6, 31.2]);
    expect(domain[0]).toBeLessThanOrEqual(-3.5);
    expect(ticks).toContain(0);
    const steps = ticks.slice(1).map((t, i) => Math.round((t - ticks[i]) * 1e6) / 1e6);
    expect(new Set(steps).size).toBe(1);
  });

  it("does not drift into 0.30000000000000004 on small steps", () => {
    expect(axisScale([0, 1]).ticks.every((t) => String(t).length <= 5)).toBe(true);
  });

  it("copes with nothing to draw", () => {
    expect(axisScale([]).ticks).toEqual([0, 1]);
    expect(axisScale([0, 0]).ticks).toEqual([0, 1]);
  });
});

describe("waterfallSteps", () => {
  it("walks revenue to net profit: a total starts from zero, a change starts where the last step ended", () => {
    const rows = waterfallSteps([
      { key: "rev", label: "Revenue", value: 1000, kind: "total" },
      { key: "cogs", label: "Cost of goods", value: -700, kind: "change" },
      { key: "gross", label: "Gross profit", value: 300, kind: "total" },
      { key: "opex", label: "Expenses", value: -80, kind: "change" },
      { key: "other", label: "Other income", value: 30, kind: "change" },
      { key: "net", label: "Net profit", value: 250, kind: "total" },
    ]);
    expect(rows.map((r) => r.range)).toEqual([[0, 1000], [300, 1000], [0, 300], [220, 300], [220, 250], [0, 250]]);
    expect(rows.map((r) => r.end)).toEqual([1000, 300, 300, 220, 250, 250]);
  });

  it("draws a loss from where it really is: a total below zero, and a step that crosses zero", () => {
    const rows = waterfallSteps([
      { key: "gross", value: 100, kind: "total" },
      { key: "opex", value: -160, kind: "change" },
      { key: "net", value: -60, kind: "total" },
    ]);
    expect(rows[1].range).toEqual([-60, 100]);
    expect(rows[2].range).toEqual([-60, 0]);
  });

  it("keeps cents exact across many steps (no 0.30000000000000004 on a bar)", () => {
    const rows = waterfallSteps([
      { key: "a", value: 0.1, kind: "change" },
      { key: "b", value: 0.2, kind: "change" },
    ]);
    expect(rows[1].end).toBe(0.3);
  });

  it("treats a missing or non-numeric figure as nothing rather than NaN", () => {
    const rows = waterfallSteps([{ key: "a", value: undefined, kind: "total" }, { key: "b", value: "x", kind: "change" }]);
    expect(rows.map((r) => r.range)).toEqual([[0, 0], [0, 0]]);
  });
});

describe("signedCompact", () => {
  it("writes the direction on the figure", () => {
    expect(signedCompact(1200)).toBe("+1.2k");
    expect(signedCompact(-600)).toBe("−600");
    expect(signedCompact(0)).toBe("0");
  });
});

describe("flowAmount", () => {
  it("keeps whole units while they fit and goes to millions after, never a rounded guess at the thousands", async () => {
    const { flowAmount, flowNumber } = await import("../helpers");
    expect(flowAmount(2050)).toMatch(/2,050$/);
    expect(flowAmount(480000)).toMatch(/480,000$/);
    expect(flowAmount(1284000)).toMatch(/1\.28M$/);
    expect(flowAmount(-2500)).toMatch(/-2,500$/);
    expect(flowNumber(1284000)).toBe("1.28M");
    expect(flowNumber(2050)).toBe("2,050");
    expect(flowAmount(undefined)).toMatch(/0$/);
  });
});
