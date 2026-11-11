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

  // A row menu's button sits at the end of the row, so hanging the menu from its RIGHT edge keeps it on
  // screen. A document header's "More actions" sits beside the primary button, at the LEFT of a phone:
  // hung from the right edge, a 224px menu started at -67px and its labels were unreadable and
  // unreachable - and nothing caught it, because a fixed box off to the left makes the page no wider.
  it("hangs from the left edge when the button is in the left half, so a narrow screen never cuts it off", () => {
    renderMenu();
    const button = screen.getByRole("button", { name: "More actions" });
    button.getBoundingClientRect = () => ({ top: 100, bottom: 128, left: 36, right: 160, width: 124, height: 28 });
    fireEvent.mouseEnter(button.parentElement);
    expect(menuOf().style.left).toBe("36px"); // opens rightwards from the button
    expect(menuOf().style.right).toBe("");
  });

  it("still hangs from the right edge for a row's own menu, at the end of the row", () => {
    renderMenu();
    const button = placeButton(100); // left: 900 of a 1024px window
    fireEvent.mouseEnter(button.parentElement);
    expect(menuOf().style.right).toBe(`${window.innerWidth - 928}px`);
    expect(menuOf().style.left).toBe("");
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
