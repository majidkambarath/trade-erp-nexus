import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBeforeUnloadGuard } from "../useBeforeUnloadGuard";

describe("useBeforeUnloadGuard", () => {
  it("does nothing while not dirty", () => {
    const add = vi.spyOn(window, "addEventListener");
    renderHook(() => useBeforeUnloadGuard(false));
    expect(add).not.toHaveBeenCalledWith("beforeunload", expect.anything());
    add.mockRestore();
  });

  it("asks the browser to confirm while dirty, and stops asking once it is not", () => {
    const { rerender } = renderHook(({ dirty }) => useBeforeUnloadGuard(dirty), { initialProps: { dirty: true } });
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);

    rerender({ dirty: false });
    const e2 = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBe(false);
  });

  it("removes its listener on unmount", () => {
    const { unmount } = renderHook(() => useBeforeUnloadGuard(true));
    unmount();
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});
