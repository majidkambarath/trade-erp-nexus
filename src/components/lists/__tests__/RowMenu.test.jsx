import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RowMenu from "../RowMenu";

// jsdom lays nothing out: give the button a rectangle, as if the row were at the given height of a 768px-tall window.
function placeButton(top) {
  const button = screen.getByRole("button", { name: "More actions" });
  button.getBoundingClientRect = () => ({ top, bottom: top + 28, left: 900, right: 928, width: 28, height: 28 });
  return button;
}

const menuOf = () => screen.getByText("Audit trail").parentElement;

function renderMenu(onPick = () => {}) {
  render(
    <RowMenu>
      <button type="button" onClick={onPick}>Audit trail</button>
      <button type="button">Download</button>
    </RowMenu>
  );
}

afterEach(() => cleanup());

describe("RowMenu", () => {
  it("keeps its items in the page while closed, but out of the layout", () => {
    renderMenu();
    // not drawn (so it can never count toward a table box's scroll area), yet still there for whatever presses an item
    expect(menuOf().className).toMatch(/\bhidden\b/);
    expect(menuOf().className).not.toMatch(/\bfixed\b/);
    expect(screen.getByText("Download")).toBeTruthy();
  });

  it("opens on hover, below the button and fixed to the window, so no scroll box or card can clip it", () => {
    renderMenu();
    const button = placeButton(100);
    fireEvent.mouseEnter(button.parentElement);
    expect(menuOf().className).toMatch(/\bfixed\b/);
    expect(menuOf().className).not.toMatch(/\bhidden\b/);
    expect(menuOf().style.top).toBe("128px"); // the button's bottom edge
    expect(menuOf().style.bottom).toBe("");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens on keyboard focus, and closes on Escape", () => {
    renderMenu();
    const button = placeButton(100);
    fireEvent.focus(button);
    expect(menuOf().className).toMatch(/\bfixed\b/);
    fireEvent.keyDown(button, { key: "Escape" });
    expect(menuOf().className).toMatch(/\bhidden\b/);
  });

  it("opens upward when there is no room below, as the last rows of a list need", () => {
    renderMenu();
    const button = placeButton(720); // 40px under it in a 768px window
    fireEvent.mouseEnter(button.parentElement);
    expect(menuOf().style.bottom).toBe(`${window.innerHeight - 720}px`);
    expect(menuOf().style.top).toBe("");
  });

  it("closes when the pointer leaves, and after an item is picked", () => {
    const onPick = vi.fn();
    renderMenu(onPick);
    const button = placeButton(100);
    fireEvent.mouseEnter(button.parentElement);
    fireEvent.mouseLeave(button.parentElement);
    expect(menuOf().className).toMatch(/\bhidden\b/);

    fireEvent.mouseEnter(button.parentElement);
    fireEvent.click(screen.getByText("Audit trail"));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(menuOf().className).toMatch(/\bhidden\b/);
  });

  it("closes when the page scrolls under it (it is placed in window pixels)", () => {
    renderMenu();
    const button = placeButton(100);
    fireEvent.mouseEnter(button.parentElement);
    expect(menuOf().className).toMatch(/\bfixed\b/);
    fireEvent.scroll(document);
    expect(menuOf().className).toMatch(/\bhidden\b/);
  });
});
