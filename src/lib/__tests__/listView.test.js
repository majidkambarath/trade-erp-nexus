import { describe, it, expect } from "vitest";
import {
  allOnPage, ariaSort, compareValues, DENSITIES, FIXED_SLOTS, hideableColumns, keepExisting, nextSort,
  someOnPage, sortFromOption, sortOptions, sortOptionValue, sortRows, toggleAll, toggleColumn, toggleKey,
  visibleColumns,
} from "../listView";

describe("nextSort: a three-press cycle, always reachable back to the list's own order", () => {
  it("asc -> desc -> off on the same column", () => {
    let s = nextSort(null, "name");
    expect(s).toEqual({ key: "name", dir: "asc" });
    s = nextSort(s, "name");
    expect(s).toEqual({ key: "name", dir: "desc" });
    s = nextSort(s, "name");
    expect(s).toBeNull();
  });

  it("pressing a different column starts it fresh at asc, mid-cycle", () => {
    const onName = { key: "name", dir: "desc" };
    expect(nextSort(onName, "date")).toEqual({ key: "date", dir: "asc" });
  });
});

describe("compareValues: null/undefined last, numeric, date, natural text", () => {
  it("null and undefined sort after everything, whichever side they are on", () => {
    expect(compareValues(null, 5)).toBe(1);
    expect(compareValues(5, null)).toBe(-1);
    expect(compareValues(undefined, undefined)).toBe(0);
    expect(compareValues("", "x")).toBe(1);
  });
  it("numbers compare numerically", () => {
    expect(compareValues(2, 10)).toBeLessThan(0);
  });
  it("ISO date strings compare by instant", () => {
    expect(compareValues("2026-01-01", "2026-03-01")).toBeLessThan(0);
    expect(compareValues("2026-10-19T08:00:00Z", "2026-10-19T09:00:00Z")).toBeLessThan(0);
  });
  it("text compares with natural number collation", () => {
    expect(compareValues("Item 2", "Item 10")).toBeLessThan(0);
    expect(compareValues("item A", "Item B")).toBeLessThan(0);
  });
});

describe("sortRows", () => {
  const columns = [{ key: "name" }, { key: "amount", sortValue: (r) => r.total }];
  it("null sort returns rows unchanged (the list's own order)", () => {
    const rows = [{ name: "b" }, { name: "a" }];
    expect(sortRows(rows, null, columns)).toBe(rows);
  });
  it("sorts ascending and descending", () => {
    const rows = [{ name: "b" }, { name: "a" }, { name: "c" }];
    expect(sortRows(rows, { key: "name", dir: "asc" }, columns).map((r) => r.name)).toEqual(["a", "b", "c"]);
    expect(sortRows(rows, { key: "name", dir: "desc" }, columns).map((r) => r.name)).toEqual(["c", "b", "a"]);
  });
  it("is stable: equal keys keep their original relative order", () => {
    const rows = [{ name: "a", id: 1 }, { name: "a", id: 2 }, { name: "a", id: 3 }];
    expect(sortRows(rows, { key: "name", dir: "asc" }, columns).map((r) => r.id)).toEqual([1, 2, 3]);
  });
  it("uses a column's sortValue instead of the raw field", () => {
    const rows = [{ name: "x", total: 300 }, { name: "y", total: 100 }];
    expect(sortRows(rows, { key: "amount", dir: "asc" }, columns).map((r) => r.name)).toEqual(["y", "x"]);
  });
});

describe("ariaSort", () => {
  it("reflects the active column's direction, 'none' for every other column", () => {
    const sort = { key: "date", dir: "asc" };
    expect(ariaSort(sort, "date")).toBe("ascending");
    expect(ariaSort({ key: "date", dir: "desc" }, "date")).toBe("descending");
    expect(ariaSort(sort, "amount")).toBe("none");
    expect(ariaSort(null, "date")).toBe("none");
  });
});

describe("sort options (the phone toolbar's <select>)", () => {
  it("lists only sortable columns, both directions, and round-trips through a value", () => {
    const columns = [{ key: "date", header: "Date", sortable: true }, { key: "notes", header: "Notes" }];
    const opts = sortOptions(columns);
    expect(opts.map((o) => o.value)).toEqual(["date:asc", "date:desc"]);
    expect(sortOptionValue({ key: "date", dir: "desc" })).toBe("date:desc");
    expect(sortOptionValue(null)).toBe("");
    expect(sortFromOption("date:desc")).toEqual({ key: "date", dir: "desc" });
    expect(sortFromOption("")).toBeNull();
  });
});

describe("selection", () => {
  it("toggleKey adds or removes one key", () => {
    expect(toggleKey(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleKey(["a", "b"], "a")).toEqual(["b"]);
  });

  it("toggleAll: every page key already selected removes exactly those; otherwise adds the missing ones", () => {
    expect(toggleAll(["a", "b"], ["a", "b"])).toEqual([]);
    expect(toggleAll(["a"], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
    expect(toggleAll(["a", "x"], ["a", "b"]).sort()).toEqual(["a", "b", "x"].sort());
  });

  it("allOnPage / someOnPage read the partial state a header checkbox needs", () => {
    expect(allOnPage(["a", "b"], ["a", "b"])).toBe(true);
    expect(allOnPage(["a"], ["a", "b"])).toBe(false);
    expect(allOnPage([], [])).toBe(false);
    expect(someOnPage(["a"], ["a", "b"])).toBe(true);
    expect(someOnPage(["z"], ["a", "b"])).toBe(false);
  });

  it("keepExisting drops a selected key that no longer appears in the list", () => {
    expect(keepExisting(["a", "b", "c"], ["b", "c", "d"])).toEqual(["b", "c"]);
  });

  it("returns the SAME array reference when nothing was dropped - a caller that feeds this into setState from "
    + "an effect must not see a \"changed\" value when nothing changed, or the state update it causes "
    + "re-triggers the effect that called it, forever (this exact loop pegged a CPU core for hours in ListPage "
    + "before anyone looked at why a test \"just hadn't finished\"; the empty-selection case is the common one, "
    + "since useListView starts `selection` at [] and every row is always \"not missing\" from an empty set)", () => {
    const empty = [];
    expect(keepExisting(empty, ["a", "b"])).toBe(empty);
    const full = ["a", "b"];
    expect(keepExisting(full, ["a", "b", "c"])).toBe(full);
  });
});

describe("columns & density", () => {
  const columns = [
    { key: "no", card: "primary", hideable: true }, // fixed slot: never hideable in practice
    { key: "date", hideable: true },
    { key: "notes", hideable: true },
    { key: "view", card: "actions" },
  ];

  it("hideableColumns excludes fixed slots (primary/title/actions) even if marked hideable", () => {
    expect(hideableColumns(columns).map((c) => c.key)).toEqual(["date", "notes"]);
  });

  it("visibleColumns drops hidden keys, but never a fixed-slot or non-hideable column", () => {
    expect(visibleColumns(columns, ["date"]).map((c) => c.key)).toEqual(["no", "notes", "view"]);
    expect(visibleColumns(columns, ["no"]).map((c) => c.key)).toEqual(["no", "date", "notes", "view"]); // "no" isn't really hideable in use
  });

  it("toggleColumn refuses to hide the last visible hideable column", () => {
    let hidden = toggleColumn([], "date", columns);
    expect(hidden).toEqual(["date"]);
    hidden = toggleColumn(hidden, "notes", columns);
    expect(hidden).toEqual(["date"]); // would hide the last one (notes) - refused
  });

  it("toggleColumn un-hides a hidden column", () => {
    expect(toggleColumn(["date"], "date", columns)).toEqual([]);
  });

  it("DENSITIES and FIXED_SLOTS are the fixed small sets the rest of the system checks against", () => {
    expect(DENSITIES).toEqual(["comfortable", "compact"]);
    expect(FIXED_SLOTS.has("primary")).toBe(true);
    expect(FIXED_SLOTS.has("amount")).toBe(false);
  });
});
