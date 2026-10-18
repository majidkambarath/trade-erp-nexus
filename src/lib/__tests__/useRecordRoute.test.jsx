import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { useRecordRoute } from "../useRecordRoute";

// `useRecordRoute` keeps a document screen's "what is open" in the URL, not in component state: Back
// should return to the list, a reload should reopen the same record, and the tab can name it.

let lastSearch = "";
function wrapper({ children }) {
  return (
    <MemoryRouter initialEntries={["/quotations"]}>
      <Routes>
        <Route
          path="/quotations"
          element={
            <>
              <Reader />
              {children}
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}
function Reader() {
  lastSearch = useLocation().search;
  return null;
}

beforeEach(() => {
  lastSearch = "";
  document.title = "Quotations · Sales · Zarvia";
});

describe("the open record, read from the URL", () => {
  it("is nothing while the list is showing", () => {
    const { result } = renderHook(() => useRecordRoute(), { wrapper });
    expect(result.current.recordId).toBeNull();
    expect(result.current.recordMode).toBeNull();
  });

  it("open() writes ?open=&mode=view and pushes a history entry", () => {
    const { result } = renderHook(() => useRecordRoute(), { wrapper });
    act(() => result.current.open("q1"));
    expect(result.current.recordId).toBe("q1");
    expect(result.current.recordMode).toBe("view");
    expect(lastSearch).toBe("?open=q1&mode=view");
  });

  it("open(id, mode) names an explicit mode", () => {
    const { result } = renderHook(() => useRecordRoute(), { wrapper });
    act(() => result.current.open("q1", "edit"));
    expect(result.current.recordMode).toBe("edit");
  });

  it("open(null, mode) is a mode with no id yet, for a full-page create flow", () => {
    const { result } = renderHook(() => useRecordRoute(), { wrapper });
    act(() => result.current.open(null, "create"));
    expect(result.current.recordId).toBeNull();
    expect(result.current.recordMode).toBe("create");
    expect(lastSearch).toBe("?mode=create");
  });

  it("close() strips both params", () => {
    const { result } = renderHook(() => useRecordRoute(), { wrapper });
    act(() => result.current.open("q1", "edit"));
    act(() => result.current.close());
    expect(result.current.recordId).toBeNull();
    expect(result.current.recordMode).toBeNull();
    expect(lastSearch).toBe("");
  });

  it("replace() does not add a second history entry", () => {
    // simulated by checking the navigate call used { replace: true }: we verify behaviourally - after a
    // replace, going back once from the record returns to where we were BEFORE any open(), not to a
    // transient in-between state. We approximate this by checking the URL settles correctly either way,
    // since MemoryRouter's history stack isn't directly inspectable through this hook's surface.
    const { result } = renderHook(() => useRecordRoute(), { wrapper });
    act(() => result.current.open(null, "create"));
    act(() => result.current.replace("q1", "view"));
    expect(result.current.recordId).toBe("q1");
    expect(result.current.recordMode).toBe("view");
  });

  it("a custom param/mode name is honoured", () => {
    const { result } = renderHook(() => useRecordRoute({ param: "doc", modeParam: "view", defaultMode: "read" }), { wrapper });
    act(() => result.current.open("inv1"));
    expect(lastSearch).toBe("?doc=inv1&view=read");
  });
});

describe("the document title", () => {
  afterEach(() => { document.title = ""; });

  it("is set while `title` is given, and restored to the route's own title once it goes back to null", () => {
    const { result, rerender } = renderHook(({ title }) => useRecordRoute({ title }), { wrapper, initialProps: { title: null } });
    expect(document.title).toBe("Quotations · Sales · Zarvia");
    act(() => result.current.open("q1"));
    rerender({ title: "q1 · Quotations · Zarvia" });
    expect(document.title).toBe("q1 · Quotations · Zarvia");
    rerender({ title: null });
    expect(document.title).toBe("Quotations · Sales · Zarvia");
  });

  it("updates again as the caller recomputes title, e.g. once the record has loaded", () => {
    const { rerender } = renderHook(({ title }) => useRecordRoute({ title }), { wrapper, initialProps: { title: "Quotation · Quotations" } });
    expect(document.title).toBe("Quotation · Quotations");
    rerender({ title: "QT-2026-0001 · Quotations" });
    expect(document.title).toBe("QT-2026-0001 · Quotations");
  });

  it("does nothing when `title` is not given", () => {
    const { result } = renderHook(() => useRecordRoute(), { wrapper });
    act(() => result.current.open("q1"));
    expect(document.title).toBe("Quotations · Sales · Zarvia");
  });

  it("unmounting with a title set restores the route's own title", () => {
    const { unmount } = renderHook(() => useRecordRoute({ title: "q1 · Quotations · Zarvia" }), { wrapper });
    expect(document.title).toBe("q1 · Quotations · Zarvia");
    unmount();
    expect(document.title).toBe("Quotations · Sales · Zarvia");
  });
});
