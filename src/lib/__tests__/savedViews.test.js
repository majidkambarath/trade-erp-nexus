import { describe, it, expect } from "vitest";
import { addView, applyView, captureView, DEFAULT_VIEW, normaliseView, removeView, renameView, viewMatches } from "../savedViews";

const columns = [{ key: "status" }, { key: "date" }, { key: "amount" }];

describe("capture / apply round trip", () => {
  it("captures filters, sort, hidden columns and density; not the search or period by default", () => {
    const state = { search: "al noor", filters: { status: "approved" }, sort: { key: "date", dir: "desc" }, hidden: ["amount"], density: "compact", period: { preset: "month" } };
    const view = captureView(state);
    expect(view).toEqual({ filters: { status: "approved" }, sort: { key: "date", dir: "desc" }, hidden: ["amount"], density: "compact" });
  });

  it("withSearch / withPeriod opt those in; a custom period keeps its dates, a preset does not", () => {
    const state = { search: "al noor", filters: {}, sort: null, hidden: [], density: "comfortable", period: { preset: "month", from: "2026-10-01", to: "2026-10-31" } };
    expect(captureView(state, { withSearch: true }).search).toBe("al noor");
    expect(captureView(state, { withPeriod: true }).period).toEqual({ preset: "month" });
    const custom = captureView({ ...state, period: { preset: "custom", from: "2026-01-01", to: "2026-01-15" } }, { withPeriod: true });
    expect(custom.period).toEqual({ preset: "custom", from: "2026-01-01", to: "2026-01-15" });
  });

  it("applyView fills in whatever the view did not capture from the screen's defaults", () => {
    const defaults = { search: "", filters: { status: "" }, sort: { key: "date", dir: "asc" }, hidden: [], density: "comfortable" };
    const applied = applyView({ filters: { status: "approved" }, sort: null, hidden: ["amount"], density: "compact" }, defaults);
    expect(applied).toEqual({ search: "", filters: { status: "approved" }, sort: null, hidden: ["amount"], density: "compact", period: undefined });
  });

  it("applyView(null) is the screen's own defaults, unchanged - this is what DEFAULT_VIEW means", () => {
    const defaults = { search: "", filters: {}, sort: null, hidden: [], density: "comfortable" };
    expect(applyView(null, defaults)).toMatchObject(defaults);
    expect(DEFAULT_VIEW).toEqual({ id: "", name: "All" });
  });
});

describe("normaliseView: a view read back from storage must survive anything stored there", () => {
  it("accepts a well-formed view unchanged in substance", () => {
    const v = normaliseView({ id: "1", name: "Overdue", filters: { status: "overdue" }, sort: { key: "date", dir: "desc" }, hidden: ["amount"], density: "compact" }, columns);
    expect(v).toMatchObject({ id: "1", name: "Overdue", filters: { status: "overdue" }, sort: { key: "date", dir: "desc" }, hidden: ["amount"], density: "compact" });
  });

  it("rejects junk: not an object, no name, an empty name", () => {
    expect(normaliseView(null, columns)).toBeNull();
    expect(normaliseView("Overdue", columns)).toBeNull();
    expect(normaliseView(42, columns)).toBeNull();
    expect(normaliseView({ name: "" }, columns)).toBeNull();
    expect(normaliseView({ name: "   " }, columns)).toBeNull();
  });

  it("drops a hidden column that no longer exists, instead of failing the whole view", () => {
    const v = normaliseView({ name: "X", hidden: ["amount", "deletedColumn"] }, columns);
    expect(v.hidden).toEqual(["amount"]);
  });

  it("drops a sort naming a column that no longer exists", () => {
    const v = normaliseView({ name: "X", sort: { key: "deletedColumn", dir: "asc" } }, columns);
    expect(v.sort).toBeNull();
  });

  it("an unknown period preset is dropped, not kept as something meaningless", () => {
    const v = normaliseView({ name: "X", period: { preset: "fortnight" } }, columns);
    expect(v.period).toEqual({ preset: "fortnight" }); // the preset name itself is kept; a screen judges whether it still means something, same as usePeriodFilter's own restore
  });

  it("a density outside the known set falls back to comfortable", () => {
    const v = normaliseView({ name: "X", density: "cozy" }, columns);
    expect(v.density).toBe("comfortable");
  });

  it("the search is kept only when it was actually stored (a view saved without withSearch)", () => {
    expect(normaliseView({ name: "X" }, columns).search).toBeUndefined();
    expect(normaliseView({ name: "X", search: "al noor" }, columns).search).toBe("al noor");
  });
});

describe("viewMatches: the 'changed' indicator", () => {
  it("true when nothing has moved from the view", () => {
    const view = { filters: { status: "approved" }, sort: null, hidden: [], density: "comfortable" };
    expect(viewMatches(view, { search: "", filters: { status: "approved" }, sort: null, hidden: [], density: "comfortable" })).toBe(true);
  });
  it("false once a filter, sort, column or density differs", () => {
    const view = { filters: { status: "approved" }, sort: null, hidden: [], density: "comfortable" };
    expect(viewMatches(view, { search: "", filters: { status: "draft" }, sort: null, hidden: [], density: "comfortable" })).toBe(false);
    expect(viewMatches(view, { search: "x", filters: { status: "approved" }, sort: null, hidden: [], density: "comfortable" })).toBe(false);
  });
  it("null (the built-in All view) matches only a fully cleared state", () => {
    expect(viewMatches(null, { search: "", filters: {}, sort: null })).toBe(true);
    expect(viewMatches(null, { search: "al noor", filters: {}, sort: null })).toBe(false);
    expect(viewMatches(null, { search: "", filters: { status: "approved" }, sort: null })).toBe(false);
  });
});

describe("renaming, removing and adding", () => {
  const views = [{ id: "1", name: "Overdue" }, { id: "2", name: "This week" }];

  it("renameView trims, refuses an empty name, refuses a name already used by another view", () => {
    expect(renameView(views, "1", "  Late  ")).toEqual({ ok: true, views: [{ id: "1", name: "Late" }, { id: "2", name: "This week" }] });
    expect(renameView(views, "1", "   ")).toEqual({ ok: false, code: "EMPTY_NAME" });
    expect(renameView(views, "1", "This week")).toEqual({ ok: false, code: "DUPLICATE_NAME" });
    expect(renameView(views, "1", "this week")).toEqual({ ok: false, code: "DUPLICATE_NAME" }); // case-insensitive
  });

  it("renaming a view to its OWN current name (different case) is not treated as a clash with itself", () => {
    expect(renameView(views, "1", "OVERDUE")).toEqual({ ok: true, views: [{ id: "1", name: "OVERDUE" }, { id: "2", name: "This week" }] });
  });

  it("removeView drops exactly one view", () => {
    expect(removeView(views, "1")).toEqual([{ id: "2", name: "This week" }]);
  });

  it("addView refuses a duplicate name, case-insensitively", () => {
    expect(addView(views, { id: "3", name: "overdue" })).toEqual({ ok: false, code: "DUPLICATE_NAME" });
    expect(addView(views, { id: "3", name: "Next month" })).toEqual({ ok: true, views: [...views, { id: "3", name: "Next month" }] });
  });
});
