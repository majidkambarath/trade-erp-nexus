import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import KeyboardShortcuts from "../KeyboardShortcuts";

const press = (key, over = {}) => fireEvent.keyDown(window, { key, ...over });

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("KeyboardShortcuts", () => {
  it("Ctrl+Enter on a list opens the page's New form", () => {
    const opened = vi.fn();
    render(
      <>
        <main><button onClick={opened}>New sales invoice</button></main>
        <KeyboardShortcuts />
      </>
    );
    press("Enter", { ctrlKey: true });
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("Ctrl+S presses the open dialog's confirm button and stops the browser saving the page", () => {
    const saved = vi.fn();
    render(
      <>
        <div role="dialog"><button>Cancel</button><button onClick={saved}>Create and approve invoice</button></div>
        <KeyboardShortcuts />
      </>
    );
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("Ctrl+S with nothing to save still keeps the browser's save dialog away, and presses nothing", () => {
    const other = vi.fn();
    render(
      <>
        <main><button onClick={other}>Create invoice</button></main>
        <KeyboardShortcuts />
      </>
    );
    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    expect(other).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("a key the form already handled is left alone", () => {
    const saved = vi.fn();
    render(
      <>
        <main><form><button type="submit" onClick={saved}>Save</button></form></main>
        <KeyboardShortcuts />
      </>
    );
    const event = new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true });
    event.preventDefault(); // as the order form does
    window.dispatchEvent(event);
    expect(saved).not.toHaveBeenCalled();
  });

  it("Ctrl+Shift+S saves, and once the form has gone opens a new one", async () => {
    vi.useFakeTimers();
    const opened = vi.fn();
    const Page = () => {
      const [editing, setEditing] = React.useState(true);
      return editing ? (
        <main><form><button type="submit" onClick={(e) => { e.preventDefault(); setEditing(false); }}>Save</button></form></main>
      ) : (
        <main><button onClick={opened}>New receipt</button></main>
      );
    };
    render(
      <>
        <Page />
        <KeyboardShortcuts />
      </>
    );
    press("S", { ctrlKey: true, shiftKey: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(opened).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("? opens the list of shortcuts, and not while typing", () => {
    render(
      <>
        <input aria-label="Name" />
        <KeyboardShortcuts />
      </>
    );
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "?" });
    expect(screen.queryByText("Keyboard shortcuts")).not.toBeInTheDocument();
    press("?");
    expect(screen.getByText("Keyboard shortcuts")).toBeInTheDocument();
    expect(screen.getByText("Ctrl + Shift + S")).toBeInTheDocument();
  });
});
