import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Field, Modal, SearchSelect } from "../kit";

const OPTIONS = [
  { value: "ca", label: "Current Assets", hint: "Assets", searchText: "CA" },
  { value: "bank", label: "Bank", depth: 1, hint: "Assets", searchText: "BANK" },
  { value: "cash", label: "Cash", depth: 1, hint: "Assets", searchText: "CASH" },
  { value: "ap", label: "Accounts Payable", hint: "Liabilities", searchText: "AP" },
];

function Harness({ onChange = () => {}, clearable = false, initial = "" }) {
  const [v, setV] = useState(initial);
  return (
    <Field label="Group">
      <SearchSelect value={v} onChange={(x) => { setV(x); onChange(x); }} options={OPTIONS} clearable={clearable} placeholder="Choose a group…" />
    </Field>
  );
}

const open = (input) => fireEvent.keyDown(input, { key: "ArrowDown" });
const type = (input, text) => fireEvent.change(input, { target: { value: text } });

describe("SearchSelect", () => {
  it("is labelled by its Field and shows the chosen option", () => {
    render(<Harness initial="bank" />);
    expect(screen.getByLabelText("Group")).toBeInTheDocument();
    expect(screen.getByText("Bank")).toBeInTheDocument();
  });

  it("filters as you type, by name or by code, and Enter chooses", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Group");
    open(input);
    expect(await screen.findAllByRole("option")).toHaveLength(4);

    type(input, "pay");
    expect(await screen.findAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /Accounts Payable/ })).toBeInTheDocument();

    type(input, "cash"); // matches the code as well as the name
    expect(await screen.findByRole("option", { name: /Cash/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Bank/ })).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("cash");
  });

  it("matches every word typed, in any order", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Group");
    open(input);
    type(input, "assets bank");
    expect(await screen.findAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /Bank/ })).toBeInTheDocument();
  });

  it("says so when nothing matches", async () => {
    render(<Harness />);
    const input = screen.getByLabelText("Group");
    open(input);
    type(input, "zzz");
    expect(await screen.findByText("Nothing matches")).toBeInTheDocument();
  });

  it("can be cleared back to empty when clearable", () => {
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} clearable initial="bank" />);
    const clear = container.querySelector(".search-select__clear-indicator");
    expect(clear).not.toBeNull();
    fireEvent.mouseDown(clear);
    expect(onChange).toHaveBeenLastCalledWith("");
  });

  it("in a dialog, Escape closes the open list first and the dialog only on the next Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="New account" onClose={onClose}>
        <Harness />
      </Modal>
    );
    const input = screen.getByLabelText("Group");
    input.focus();
    open(input);
    expect(await screen.findAllByRole("option")).toHaveLength(4);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
