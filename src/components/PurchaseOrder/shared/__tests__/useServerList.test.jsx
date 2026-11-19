import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import useServerList from "../useServerList";
import { resolveListPeriod } from "../../../../lib/listPeriod";

const period = resolveListPeriod({}, "2026-10-10");

// a server whose list answers can be held back, to prove an old answer never overwrites a newer one
function server() {
  const pending = [];
  const http = {
    get: vi.fn((url, { params }) => {
      if (String(url).endsWith("/summary")) return Promise.resolve({ data: { data: { count: 9 } } });
      if (params.limit === 1) return Promise.resolve({ data: { data: [], pagination: { total: 4 } } });
      return new Promise((resolve) => pending.push({ params, resolve: (rows) => resolve({ data: { data: rows, pagination: { total: rows.length, pages: 1 } } }) }));
    }),
  };
  return { http, pending };
}

const compare = { from: "2026-09-01", to: "2026-09-30" };
const base = (http, over = {}) => ({ http, type: "sales_order", period, compare, sort: "date", order: "desc", page: 1, size: 25, ...over });

describe("useServerList", () => {
  it("reads a page, the cards and the earlier period's count", async () => {
    const { http, pending } = server();
    const { result } = renderHook(() => useServerList(base(http)));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(pending.length).toBe(1));
    act(() => pending[0].resolve([{ _id: "a" }]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual([{ _id: "a" }]);
    await waitFor(() => expect(result.current.summary).toEqual({ count: 9 }));
    expect(result.current.previousCount).toBe(4);
  });

  it("sends the search 300 ms after the last keystroke, not on each one", async () => {
    const { http, pending } = server();
    const { result, rerender } = renderHook((p) => useServerList(base(http, p)), { initialProps: { search: "" } });
    await waitFor(() => expect(pending.length).toBe(1));
    act(() => pending[0].resolve([]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ search: "a" });
    rerender({ search: "ac" });
    rerender({ search: "acm" });
    expect(pending.length).toBe(1);
    await waitFor(() => expect(pending.length).toBe(2), { timeout: 1500 });
    expect(pending[1].params.search).toBe("acm");
  });

  it("drops the answer to an older question", async () => {
    const { http, pending } = server();
    const { result, rerender } = renderHook((p) => useServerList(base(http, p)), { initialProps: { status: "ALL" } });
    await waitFor(() => expect(pending.length).toBe(1));
    rerender({ status: "DRAFT" });
    await waitFor(() => expect(pending.length).toBe(2));
    act(() => pending[1].resolve([{ _id: "new" }]));
    await waitFor(() => expect(result.current.rows).toEqual([{ _id: "new" }]));
    act(() => pending[0].resolve([{ _id: "old" }]));
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.rows).toEqual([{ _id: "new" }]);
  });

  it("refresh reads again, keeping the rows on screen when quiet", async () => {
    const { http, pending } = server();
    const { result } = renderHook(() => useServerList(base(http)));
    await waitFor(() => expect(pending.length).toBe(1));
    act(() => pending[0].resolve([{ _id: "a" }]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.refresh({ quiet: true }));
    await waitFor(() => expect(pending.length).toBe(2));
    expect(result.current.loading).toBe(false);
    expect(result.current.rows).toEqual([{ _id: "a" }]);
    act(() => pending[1].resolve([{ _id: "a" }, { _id: "b" }]));
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
  });
});
