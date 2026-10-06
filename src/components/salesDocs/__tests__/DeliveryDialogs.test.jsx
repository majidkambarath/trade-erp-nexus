import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import { DeliverDialog, InvoiceDialog } from "../DeliveryDialogs";

const note = {
  _id: "n1", deliveryNoteNo: "DLN-2026-0012", date: "2020-01-01T00:00:00.000Z",
  items: [
    { _id: "l1", description: "Basmati 5kg", qty: 10 },
    { _id: "l2", description: "Oil 1L", qty: 4 },
  ],
};

const setup = () => {
  const onConfirm = vi.fn();
  render(<DeliverDialog note={note} busy={false} problem={null} onClose={vi.fn()} onConfirm={onConfirm} />);
  const dialog = screen.getByRole("dialog");
  return { onConfirm, dialog, submit: () => fireEvent.click(within(dialog).getByRole("button", { name: /mark delivered/i })) };
};

describe("DeliverDialog", () => {
  it("starts as everything delivered, so only the exceptions are typed", () => {
    const { dialog } = setup();
    expect(within(dialog).getByLabelText("Delivered quantity of Basmati 5kg")).toHaveValue(10);
    expect(within(dialog).getByLabelText("Delivered quantity of Oil 1L")).toHaveValue(4);
    // the reason fields are off until a line is short
    expect(within(dialog).getByLabelText("Reason for the shortage of Basmati 5kg")).toBeDisabled();
  });

  it("will not confirm without the name of whoever signed", () => {
    const { onConfirm, dialog, submit } = setup();
    submit();
    expect(within(dialog).getByText("Enter who received the goods")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms a full delivery with the quantities as numbers", () => {
    const { onConfirm, dialog, submit } = setup();
    fireEvent.change(within(dialog).getByLabelText(/received by/i), { target: { value: "  Store keeper " } });
    submit();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      receivedBy: "Store keeper",
      lines: [{ lineId: "l1", deliveredQty: 10, shortReason: "" }, { lineId: "l2", deliveredQty: 4, shortReason: "" }],
    });
  });

  it("a short line turns its reason field on and will not confirm without one", () => {
    const { onConfirm, dialog, submit } = setup();
    fireEvent.change(within(dialog).getByLabelText(/received by/i), { target: { value: "Ali" } });
    fireEvent.change(within(dialog).getByLabelText("Delivered quantity of Basmati 5kg"), { target: { value: "8" } });
    const reason = within(dialog).getByLabelText("Reason for the shortage of Basmati 5kg");
    expect(reason).toBeEnabled();

    submit();
    expect(within(dialog).getByText("Say why 2 was not delivered")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(reason, { target: { value: "2 bags torn" } });
    submit();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].lines[0]).toEqual({ lineId: "l1", deliveredQty: 8, shortReason: "2 bags torn" });
  });

  it("refuses more than was sent, and delivering nothing at all", () => {
    const { onConfirm, dialog, submit } = setup();
    fireEvent.change(within(dialog).getByLabelText(/received by/i), { target: { value: "Ali" } });
    fireEvent.change(within(dialog).getByLabelText("Delivered quantity of Oil 1L"), { target: { value: "9" } });
    submit();
    expect(within(dialog).getByText("At most 4 was sent")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Delivered quantity of Oil 1L"), { target: { value: "0" } });
    fireEvent.change(within(dialog).getByLabelText("Reason for the shortage of Oil 1L"), { target: { value: "closed" } });
    fireEvent.change(within(dialog).getByLabelText("Delivered quantity of Basmati 5kg"), { target: { value: "0" } });
    fireEvent.change(within(dialog).getByLabelText("Reason for the shortage of Basmati 5kg"), { target: { value: "closed" } });
    submit();
    expect(within(dialog).getByText(/Cancel the delivery note/)).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows the server's refusal and keeps what was typed", () => {
    render(<DeliverDialog note={note} busy={false} problem={new Error("DLN-2026-0012 is delivered; it cannot be delivered from there")} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot be delivered from there/);
  });
});

describe("InvoiceDialog", () => {
  const delivered = (id, party, over = {}) => ({
    _id: id, deliveryNoteNo: `DLN-${id}`, partyId: party, party: { customerName: party === "p1" ? "Al Noor" : "Other" },
    deliveredAt: "2026-10-01T08:00:00.000Z", totalAmount: 105, actions: { invoice: true }, ...over,
  });

  it("asks for one date and lists what is going on the invoice", () => {
    const onConfirm = vi.fn();
    render(<InvoiceDialog notes={[delivered("1", "p1"), delivered("2", "p1")]} busy={false} problem={null} onClose={vi.fn()} onConfirm={onConfirm} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Invoice 2 delivery notes")).toBeInTheDocument();
    expect(within(dialog).getByText(/summary invoice/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /create sales order/i }));
    expect(onConfirm).toHaveBeenCalledWith({ deliveryNoteIds: ["1", "2"], date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it("will not mix customers, and says why", () => {
    const onConfirm = vi.fn();
    render(<InvoiceDialog notes={[delivered("1", "p1"), delivered("2", "p2")]} busy={false} problem={null} onClose={vi.fn()} onConfirm={onConfirm} />);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/different customers/);
    expect(within(dialog).getByRole("button", { name: /create sales order/i })).toBeDisabled();
  });

  it("a note against a sales order is invoiced by approving that order", () => {
    render(<InvoiceDialog notes={[delivered("1", "p1", { actions: { invoice: false }, source: { kind: "sales_order", no: "SO-2026-0031" } })]} busy={false} problem={null} onClose={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/approve SO-2026-0031 instead/);
  });
});
