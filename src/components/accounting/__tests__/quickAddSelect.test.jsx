import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Field, Modal, QuickAddSelect } from "../kit";

const OPTIONS = [
  { value: "cat1", label: "Spices" },
  { value: "cat2", label: "Oils" },
];

function Harness({ onCreate, onCreated, onCreateError, initial = "", createLabel }) {
  const [v, setV] = useState(initial);
  const [options, setOptions] = useState(OPTIONS);
  return (
    <Field label="Category">
      <QuickAddSelect
        value={v}
        onChange={setV}
        options={options}
        onCreate={onCreate}
        onCreated={(created) => { setOptions((prev) => [...prev, created]); onCreated?.(created); }}
        onCreateError={onCreateError}
        createLabel={createLabel}
        placeholder="Search or add a category…"
      />
    </Field>
  );
}

const open = (input) => fireEvent.keyDown(input, { key: "ArrowDown" });
const type = (input, text) => fireEvent.change(input, { target: { value: text } });

describe("QuickAddSelect", () => {
  it("with no onCreate, behaves exactly like a plain SearchSelect - no create option ever offered", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Category");
    open(input);
    type(input, "Pulses");
    expect(await screen.findByText("Nothing matches")).toBeInTheDocument();
    expect(screen.queryByText(/Add "Pulses"/)).not.toBeInTheDocument();
  });

  it("offers to create whatever was typed when nothing matches, with the given onCreate", async () => {
    render(<Harness onCreate={vi.fn()} />);
    const input = screen.getByLabelText("Category");
    open(input);
    type(input, "Pulses");
    expect(await screen.findByText('Add "Pulses"')).toBeInTheDocument();
  });

  it("does not offer to create something that already exists, by a case-insensitive match", async () => {
    render(<Harness onCreate={vi.fn()} />);
    const input = screen.getByLabelText("Category");
    open(input);
    type(input, "spices"); // "Spices" already exists
    expect(await screen.findByRole("option", { name: "Spices" })).toBeInTheDocument();
    expect(screen.queryByText(/Add "/)).not.toBeInTheDocument();
  });

  it("choosing Create calls onCreate, selects what it resolves to, and tells the caller so", async () => {
    const onCreate = vi.fn(() => Promise.resolve({ value: "cat9", label: "Pulses" }));
    const onCreated = vi.fn();
    render(<Harness onCreate={onCreate} onCreated={onCreated} />);
    const input = screen.getByLabelText("Category");
    open(input);
    type(input, "Pulses");
    fireEvent.click(await screen.findByText('Add "Pulses"'));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith("Pulses"));
    expect(onCreated).toHaveBeenCalledWith({ value: "cat9", label: "Pulses" });
    expect(await screen.findByText("Pulses")).toBeInTheDocument(); // now shown as the selected value
  });

  it("a failed create reports the error and selects nothing", async () => {
    const onCreate = vi.fn(() => Promise.reject(new Error("Category name already exists")));
    const onCreateError = vi.fn();
    render(<Harness onCreate={onCreate} onCreateError={onCreateError} />);
    const input = screen.getByLabelText("Category");
    open(input);
    type(input, "Spices Extra");
    fireEvent.click(await screen.findByText('Add "Spices Extra"'));

    await waitFor(() => expect(onCreateError).toHaveBeenCalledWith(expect.objectContaining({ message: "Category name already exists" })));
    expect(screen.queryByText("Spices Extra")).not.toBeInTheDocument();
  });

  it("a custom createLabel is used for the option's text", async () => {
    render(<Harness onCreate={vi.fn()} createLabel={(text) => `Add "${text}" as a new category`} />);
    const input = screen.getByLabelText("Category");
    open(input);
    type(input, "Pulses");
    expect(await screen.findByText('Add "Pulses" as a new category')).toBeInTheDocument();
  });

  it("in a dialog, Escape closes the open list first and the dialog only on the next Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="New item" onClose={onClose}>
        <Harness onCreate={vi.fn()} />
      </Modal>
    );
    const input = screen.getByLabelText("Category");
    input.focus();
    open(input);
    expect(await screen.findAllByRole("option")).toHaveLength(2);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
