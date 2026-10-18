import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Modal } from "../kit";

// Modal opens inside the workspace on purpose - no scrim, the rail stays clickable (stage 1a.2's "keep the
// look" decision) - so it must not claim to be a modal dialog to assistive tech, and a form with something
// unsaved gets a chance to say so before Escape or the close button throws it away.
describe("Modal", () => {
  it("is an honest non-modal dialog: role=dialog, no aria-modal claim", () => {
    render(<Modal title="Add a thing" onClose={() => {}}>body</Modal>);
    const dialog = screen.getByRole("dialog", { name: "Add a thing" });
    expect(dialog).not.toHaveAttribute("aria-modal");
  });

  it("closes on Escape and on the close button when there is nothing to lose", () => {
    const onClose = vi.fn();
    render(<Modal title="Add a thing" onClose={onClose}>body</Modal>);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("confirmClose can refuse to let Escape close the dialog", () => {
    const onClose = vi.fn();
    const confirmClose = vi.fn(() => false);
    render(<Modal title="Edit X" onClose={onClose} confirmClose={confirmClose}>body</Modal>);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(confirmClose).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("confirmClose can refuse to let the close button close the dialog", () => {
    const onClose = vi.fn();
    const confirmClose = vi.fn(() => false);
    render(<Modal title="Edit X" onClose={onClose} confirmClose={confirmClose}>body</Modal>);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("confirmClose allowing it through still closes the dialog", () => {
    const onClose = vi.fn();
    const confirmClose = vi.fn(() => true);
    render(<Modal title="Edit X" onClose={onClose} confirmClose={confirmClose}>body</Modal>);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("confirmClose returning nothing (undefined) is treated as allowing the close, like a void function that just warns", () => {
    const onClose = vi.fn();
    const confirmClose = vi.fn(() => undefined);
    render(<Modal title="Edit X" onClose={onClose} confirmClose={confirmClose}>body</Modal>);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
