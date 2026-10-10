import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePeriodFilter } from "../usePeriodFilter";

// `restore` is what a screen kept from the last visit. It is used only while it still means something.
describe("usePeriodFilter restore", () => {
  it("opens on this month when nothing was kept", () => {
    const { result } = renderHook(() => usePeriodFilter());
    expect(result.current.preset).toBe("month");
    expect(result.current.period.ok).toBe(true);
  });

  it("starts where the person left it", () => {
    const { result } = renderHook(() => usePeriodFilter({ restore: { preset: "lastMonth", from: "", to: "" } }));
    expect(result.current.preset).toBe("lastMonth");
    expect(result.current.period.label).toBe("Last month");
  });

  it("restores a custom range with its two days", () => {
    const { result } = renderHook(() => usePeriodFilter({ restore: { preset: "custom", from: "2026-03-01", to: "2026-03-31" } }));
    expect(result.current.period).toMatchObject({ preset: "custom", from: "2026-03-01", to: "2026-03-31" });
    expect(result.current.from).toBe("2026-03-01");
  });

  it("ignores what can no longer be applied: an end before its start, a choice that does not exist, junk", () => {
    for (const restore of [
      { preset: "custom", from: "2026-04-10", to: "2026-04-01" },
      { preset: "fortnight", from: "", to: "" },
      { preset: undefined },
      "month",
      42,
    ]) {
      const { result } = renderHook(() => usePeriodFilter({ restore }));
      expect(result.current.preset, JSON.stringify(restore)).toBe("month");
      expect(result.current.period.ok).toBe(true);
    }
  });

  it("reset goes back to the screen's own default, not to what was restored", () => {
    const { result } = renderHook(() => usePeriodFilter({ restore: { preset: "year", from: "", to: "" } }));
    expect(result.current.preset).toBe("year");
    act(() => result.current.reset());
    expect(result.current.preset).toBe("month");
  });
});
