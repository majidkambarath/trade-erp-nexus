import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AsRole, roleLoaded, statusFor } from "../../components/shell/__tests__/asRole";
import { clearPageSessions } from "../pageSession";

let orgStatus;
vi.mock("../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import { useListView } from "../useListView";

const COLUMNS = [{ key: "status", hideable: true }, { key: "date", hideable: true }, { key: "amount", hideable: true }];
const wrapper = ({ children }) => <AsRole>{children}</AsRole>;

beforeEach(() => {
  window.localStorage.clear();
  clearPageSessions();
  orgStatus = statusFor(["sales.view"]);
});

// A previous instance's role-loaded marker is only torn down by unmounting it - otherwise `screen.findByTestId`
// in roleLoaded() below finds the OLD instance's marker (still in the DOM) and resolves before the NEW
// instance's own organisation status has actually loaded, which is exactly the race a "persists across an
// unmount/remount" test needs to NOT have. So setUp always unmounts whatever it mounted last.
let activeUnmount = null;
async function setUp(name = "customers", opts) {
  activeUnmount?.();
  const { result, unmount } = renderHook(() => useListView(name, { columns: COLUMNS, ...opts }), { wrapper });
  activeUnmount = unmount;
  await roleLoaded();
  return result;
}

describe("search, filters and sort - kept per tab (pageSession), gone on reload", () => {
  it("starts empty, and round-trips through setSearch / setFilter / toggleSort", async () => {
    const result = await setUp();
    expect(result.current.search).toBe("");
    act(() => result.current.setSearch("al noor"));
    expect(result.current.search).toBe("al noor");
    act(() => result.current.setFilter("status", "approved"));
    expect(result.current.filters).toEqual({ status: "approved" });
    act(() => result.current.toggleSort("date"));
    expect(result.current.sort).toEqual({ key: "date", dir: "asc" });
  });

  it("is restored from pageSession across an unmount/remount of the SAME tab", async () => {
    const first = await setUp();
    act(() => { first.current.setSearch("al noor"); first.current.setFilter("status", "approved"); });
    const second = await setUp();
    expect(second.current.search).toBe("al noor");
    expect(second.current.filters).toEqual({ status: "approved" });
  });

  it("active is true once a search, a filter or a sort is set, false on a clean screen", async () => {
    const result = await setUp();
    expect(result.current.active).toBe(false);
    act(() => result.current.setSearch("x"));
    expect(result.current.active).toBe(true);
  });

  it("clearFilters resets search, filters and the current view, in one call", async () => {
    const result = await setUp("customers", { filters: { status: "" } });
    act(() => { result.current.setSearch("x"); result.current.setFilter("status", "approved"); });
    act(() => result.current.clearFilters());
    expect(result.current.search).toBe("");
    expect(result.current.filters).toEqual({ status: "" });
    expect(result.current.active).toBe(false);
  });

  it("key changes when search/filters/sort change, and ONLY then (density and hidden columns must not refetch rows)", async () => {
    const result = await setUp();
    const k0 = result.current.key;
    act(() => result.current.setDensity("compact"));
    expect(result.current.key).toBe(k0);
    act(() => result.current.toggleColumn("amount"));
    expect(result.current.key).toBe(k0);
    act(() => result.current.setSearch("x"));
    expect(result.current.key).not.toBe(k0);
  });
});

describe("density and hidden columns - kept per person (userPrefs), survive a reload", () => {
  it("default to comfortable and nothing hidden", async () => {
    const result = await setUp();
    expect(result.current.density).toBe("comfortable");
    expect(result.current.hidden).toEqual([]);
  });

  it("persist across an unmount/remount for the same person", async () => {
    const first = await setUp();
    act(() => { first.current.setDensity("compact"); first.current.toggleColumn("amount"); });
    const second = await setUp();
    // roleLoaded() resolves the instant me.id first appears, one tick before the hook's own effect (which
    // reads storage under that id) has actually run - waitFor gives that effect the one more tick it needs,
    // same as a real screen mounting just as the organisation status arrives.
    await waitFor(() => expect(second.current.density).toBe("compact"));
    expect(second.current.hidden).toEqual(["amount"]);
  });

  it("are scoped per screen name - Customers and Vendors keep their own choice", async () => {
    const customers = await setUp("customers");
    act(() => customers.current.setDensity("compact"));
    const vendors = await setUp("vendors");
    expect(vendors.current.density).toBe("comfortable");
  });
});

describe("selection", () => {
  it("is empty and selectMode is off by default; dropMissingSelection removes a key no longer in the rows", async () => {
    const result = await setUp();
    expect(result.current.selection).toEqual([]);
    expect(result.current.selectMode).toBe(false);
    act(() => result.current.setSelection(["1", "2", "3"]));
    act(() => result.current.dropMissingSelection(["2", "3", "4"]));
    expect(result.current.selection).toEqual(["2", "3"]);
  });

  it("clearSelection empties it", async () => {
    const result = await setUp();
    act(() => result.current.setSelection(["1"]));
    act(() => result.current.clearSelection());
    expect(result.current.selection).toEqual([]);
  });
});

describe("saved views", () => {
  it("saveView captures the live state, switching to it changes nothing until goToView is asked for another", async () => {
    const result = await setUp();
    act(() => { result.current.setFilter("status", "approved"); result.current.setDensity("compact"); });
    let id;
    act(() => { id = result.current.saveView("Approved only").id; });
    expect(result.current.views.map((v) => v.name)).toEqual(["Approved only"]);
    expect(result.current.currentViewId).toBe(id);
  });

  it("goToView restores a saved view's state, and views DEFAULT_VIEW (no id) goes back to the screen's own defaults", async () => {
    const result = await setUp("customers", { filters: { status: "" }, sort: null });
    act(() => { result.current.setFilter("status", "approved"); result.current.toggleSort("date"); });
    let id;
    act(() => { id = result.current.saveView("Approved").id; });
    act(() => { result.current.setFilter("status", "draft"); result.current.setSort(null); });
    act(() => result.current.goToView(id));
    expect(result.current.filters).toEqual({ status: "approved" });
    expect(result.current.sort).toEqual({ key: "date", dir: "asc" });
    act(() => result.current.goToView(""));
    expect(result.current.filters).toEqual({ status: "" });
    expect(result.current.sort).toBeNull();
  });

  it("saveView refuses a name already used by another view", async () => {
    const result = await setUp();
    act(() => { result.current.saveView("Approved"); });
    let outcome;
    act(() => { outcome = result.current.saveView("Approved"); });
    expect(outcome).toEqual({ ok: false, code: "DUPLICATE_NAME" });
  });

  it("views persist across an unmount/remount", async () => {
    const first = await setUp();
    act(() => { first.current.saveView("Approved"); });
    const second = await setUp();
    await waitFor(() => expect(second.current.views.map((v) => v.name)).toEqual(["Approved"]));
  });

  it("renameView and deleteView work on an existing view, and deleting the current view clears currentViewId", async () => {
    const result = await setUp();
    let id;
    act(() => { id = result.current.saveView("Approved").id; });
    act(() => result.current.renameView(id, "Approved invoices"));
    expect(result.current.views[0].name).toBe("Approved invoices");
    act(() => result.current.deleteView(id));
    expect(result.current.views).toEqual([]);
    expect(result.current.currentViewId).toBe("");
  });
});
