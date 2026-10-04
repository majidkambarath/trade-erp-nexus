import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({ list: vi.fn(), writeOff: vi.fn() }));
vi.mock("../../../lib/accountingApi", () => ({ batches: m }));

import BatchManagement from "../BatchManagement";

const batch = (over) => ({
  _id: "b1", itemName: "Milk 1L", sku: "MLK", batchNumber: "A", sourceTransactionNo: "PO-2026-0001", receivedAt: "2026-09-01",
  expiryDate: "2026-11-20", daysToExpiry: 40, expired: false, qtyOnHand: 70, receivedQty: 100, ...over,
});
beforeEach(() => { m.list.mockReset(); m.writeOff.mockReset(); });

describe("batches", () => {
  it("shows each batch with how long it has left, and counts what needs action", async () => {
    m.list.mockResolvedValue([
      batch(),
      batch({ _id: "b2", batchNumber: "B", daysToExpiry: 5, expiryDate: "2026-10-09" }),
      batch({ _id: "b3", batchNumber: "OLD", daysToExpiry: -3, expired: true, expiryDate: "2026-10-01", qtyOnHand: 40 }),
      batch({ _id: "b4", batchNumber: "NOEXP", daysToExpiry: null, expiryDate: null }),
    ]);
    render(<BatchManagement />);
    expect(await screen.findByText("40 days left")).toBeInTheDocument();
    expect(screen.getByText("5 days left")).toBeInTheDocument();
    expect(screen.getByText("Expired 3 days ago")).toBeInTheDocument();
    expect(screen.getByText("No expiry")).toBeInTheDocument();
    // 4 in stock, 1 expiring within 30 days (the 5-day one), 1 expired holding 40 units
    expect(screen.getByText("Batches in stock").closest("[class*=rounded-xl]")).toHaveTextContent("4");
    expect(screen.getByText("Expired, still on hand").closest("[class*=rounded-xl]")).toHaveTextContent("1");
    expect(screen.getByText("units in expired batches").closest("[class*=rounded-xl]")).toHaveTextContent("40");
  });

  it("filters by expiry window through the server", async () => {
    m.list.mockResolvedValue([batch()]);
    render(<BatchManagement />);
    await screen.findByText("A");
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "30" } });
    await waitFor(() => expect(m.list).toHaveBeenLastCalledWith({ expiringWithinDays: "30" }));
  });

  it("explains an empty list", async () => {
    m.list.mockResolvedValue([]);
    render(<BatchManagement />);
    expect(await screen.findByText("No batches")).toBeInTheDocument();
  });

  it("writes off an expired batch: validates the quantity, then books it", async () => {
    m.list.mockResolvedValue([batch({ _id: "b3", batchNumber: "OLD", expired: true, daysToExpiry: -3, qtyOnHand: 40 })]);
    m.writeOff.mockResolvedValue({ number: "WO-2026-0001", qty: 40, cost: 428.4, posted: true });
    render(<BatchManagement />);
    fireEvent.click(await screen.findByRole("button", { name: /Write off/ }));
    const dialog = await screen.findByRole("dialog", { name: "Write off stock" });
    expect(within(dialog).getByLabelText("Reason")).toHaveValue("expiry"); // chosen from the batch's state
    expect(within(dialog).getByLabelText(/Quantity/)).toHaveValue(40); // defaults to all of it

    fireEvent.change(within(dialog).getByLabelText(/Quantity/), { target: { value: "999" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Write off" }));
    expect(await within(dialog).findByText("Only 40 left in this batch")).toBeInTheDocument();
    expect(m.writeOff).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/Quantity/), { target: { value: "40" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Write off" }));
    await waitFor(() => expect(m.writeOff).toHaveBeenCalledWith("b3", { qty: 40, reason: "expiry", note: undefined }));
    expect(await screen.findByText(/WO-2026-0001: 40 written off, cost AED 428.40/)).toBeInTheDocument();
    expect(m.list).toHaveBeenCalledTimes(2); // refreshed
  });

  it("says when the loss was not booked because ledger posting is off", async () => {
    m.list.mockResolvedValue([batch()]);
    m.writeOff.mockResolvedValue({ number: "WO-2026-0002", qty: 5, cost: 50, posted: false });
    render(<BatchManagement />);
    fireEvent.click(await screen.findByRole("button", { name: /Write off/ }));
    const dialog = await screen.findByRole("dialog", { name: "Write off stock" });
    fireEvent.change(within(dialog).getByLabelText(/Quantity/), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Write off" }));
    expect(await screen.findByText(/ledger posting is off; not booked/)).toBeInTheDocument();
  });

  it("shows the server's refusal inside the dialog", async () => {
    m.list.mockResolvedValue([batch()]);
    m.writeOff.mockRejectedValue(new Error("Fiscal year 2026 is closed"));
    render(<BatchManagement />);
    fireEvent.click(await screen.findByRole("button", { name: /Write off/ }));
    const dialog = await screen.findByRole("dialog", { name: "Write off stock" });
    fireEvent.change(within(dialog).getByLabelText(/Quantity/), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Write off" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Fiscal year 2026 is closed");
  });
});
