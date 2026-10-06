import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ConfirmDialog } from "../kit";

describe("ConfirmDialog with typeToConfirm", () => {
  it("keeps the delete button disabled until the word is typed", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="Delete X?" confirmLabel="Delete" danger typeToConfirm="delete" onConfirm={onConfirm} onClose={() => {}} />);

    const button = screen.getByRole("button", { name: "Delete" });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "dele" } });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  DELETE " } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not confirm on Enter until the word matches", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="Delete X?" confirmLabel="Delete" danger typeToConfirm="delete" onConfirm={onConfirm} onClose={() => {}} />);
    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "yes" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "delete" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("leaves ordinary confirms unchanged: no input, enabled at once", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="Send?" confirmLabel="Send" onConfirm={onConfirm} onClose={() => {}} />);

    expect(screen.queryByRole("textbox")).toBeNull();
    const button = screen.getByRole("button", { name: "Send" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
