import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ expiry: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("../../../lib/partyMasterApi", () => ({
  partyMaster: { documentExpiry: mocks.expiry, documentTypes: { list: mocks.list, create: mocks.create, update: mocks.update, remove: mocks.remove } },
}));

import KycDocuments from "../KycDocuments";

const EXPIRY = {
  asOf: "2026-10-05", withinDays: 30,
  summary: { expired: 1, expiringSoon: 1, total: 2 },
  rows: [
    { partyType: "Vendor", partyId: "v1", partyName: "Gulf Mills", partyCode: "VEND2026001", documentId: "d1", documentType: "Trade licence", number: "CN-9", expiryDate: "2026-09-25", status: "EXPIRED", daysLeft: -10 },
    { partyType: "Customer", partyId: "c1", partyName: "Al Noor Mart", partyCode: "CUST2026001", documentId: "d2", documentType: "Emirates ID", number: "784-1990-1234567-1", expiryDate: "2026-10-17", status: "EXPIRING_SOON", daysLeft: 12 },
  ],
};
const TYPES = [
  { _id: "t1", name: "Trade licence", code: "TL", requiresExpiry: true, minLength: 3, maxLength: 30, isActive: true, isSystem: true },
  { _id: "t2", name: "Bank letter", code: "BANK", requiresExpiry: false, minLength: null, maxLength: null, isActive: true, isSystem: true },
  { _id: "t3", name: "Halal certificate", code: "HALAL", requiresExpiry: true, minLength: 15, maxLength: 15, isActive: false, isSystem: false },
];
const openTab = (name) => fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.expiry.mockResolvedValue(EXPIRY);
  mocks.list.mockResolvedValue(TYPES);
});

describe("expiring documents", () => {
  it("lists what has expired or is about to, soonest first, with the days", async () => {
    render(<KycDocuments />);
    const first = (await screen.findByText("Gulf Mills")).closest("tr");
    expect(within(first).getByText("Expired 10 days ago")).toBeInTheDocument();
    expect(within(first).getByText("25/09/2026")).toBeInTheDocument();
    const second = screen.getByText("Al Noor Mart").closest("tr");
    expect(within(second).getByText("Expires in 12 days")).toBeInTheDocument();
    expect(screen.getByText("Reminders by email: Coming soon")).toBeInTheDocument();
    expect(mocks.expiry).toHaveBeenCalledWith({ withinDays: "30" });
  });

  it("asks again when the window or the kind of party changes", async () => {
    render(<KycDocuments />);
    await screen.findByText("Gulf Mills");
    fireEvent.change(screen.getByLabelText("Expiring within"), { target: { value: "90" } });
    await waitFor(() => expect(mocks.expiry).toHaveBeenLastCalledWith({ withinDays: "90" }));
    fireEvent.change(screen.getByLabelText("Show"), { target: { value: "vendor" } });
    await waitFor(() => expect(mocks.expiry).toHaveBeenLastCalledWith({ withinDays: "90", partyType: "vendor" }));
  });

  it("says so when everything is in order", async () => {
    mocks.expiry.mockResolvedValue({ asOf: "2026-10-05", withinDays: 30, summary: { expired: 0, expiringSoon: 0, total: 0 }, rows: [] });
    render(<KycDocuments />);
    expect(await screen.findByText("Nothing has expired or is about to")).toBeInTheDocument();
  });

  it("reports a failure with a way to retry", async () => {
    mocks.expiry.mockRejectedValueOnce(new Error("Network down"));
    render(<KycDocuments />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Network down");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Gulf Mills")).toBeInTheDocument();
  });
});

describe("document types", () => {
  it("lists the types with their expiry rule, number length and whether they are offered", async () => {
    render(<KycDocuments />);
    openTab("Document types");
    const tl = (await screen.findByText("Trade licence")).closest("tr");
    expect(within(tl).getByText("Yes, needs an expiry date")).toBeInTheDocument();
    expect(within(tl).getByText("3 to 30")).toBeInTheDocument();
    expect(within(tl).getByText("Active")).toBeInTheDocument();
    expect(within(screen.getByText("Bank letter").closest("tr")).getByText("Any")).toBeInTheDocument();
    const halal = screen.getByText("Halal certificate").closest("tr");
    expect(within(halal).getByText("Switched off")).toBeInTheDocument();
    expect(within(halal).getByText("15")).toBeInTheDocument();
    // a default cannot be deleted, a custom one can
    expect(screen.queryByRole("button", { name: "Delete Trade licence" })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete Halal certificate" })).toBeInTheDocument();
  });

  it("adds a type", async () => {
    mocks.create.mockResolvedValue({ _id: "t9", name: "Import permit" });
    render(<KycDocuments />);
    openTab("Document types");
    await screen.findByText("Trade licence");
    fireEvent.click(screen.getByRole("button", { name: /New document type/ }));
    const dialog = await screen.findByRole("dialog", { name: "New document type" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add document type" }));
    expect(await within(dialog).findByText("Enter the document type's name")).toBeInTheDocument();
    expect(mocks.create).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: "Import permit" } });
    fireEvent.click(within(dialog).getByLabelText("Documents of this type expire"));
    fireEvent.change(within(dialog).getByLabelText("Shortest number"), { target: { value: "20" } });
    fireEvent.change(within(dialog).getByLabelText("Longest number"), { target: { value: "10" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add document type" }));
    expect(await within(dialog).findByText("The minimum cannot be more than the maximum")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Shortest number"), { target: { value: "5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add document type" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][0]).toEqual({ name: "Import permit", requiresExpiry: true, isActive: true, minLength: 5, maxLength: 10 });
    expect(await screen.findByText("Import permit added")).toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it("edits a default type: its code is fixed, and it can be switched off", async () => {
    mocks.update.mockResolvedValue({ _id: "t1", name: "Trade licence" });
    render(<KycDocuments />);
    openTab("Document types");
    await screen.findByText("Trade licence");
    fireEvent.click(screen.getByRole("button", { name: "Edit Trade licence" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Trade licence" });
    expect(within(dialog).getByLabelText("Code")).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText(/^Offered on the forms/));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update.mock.calls[0][0]).toBe("t1");
    expect(mocks.update.mock.calls[0][1]).toMatchObject({ name: "Trade licence", requiresExpiry: true, isActive: false, minLength: 3, maxLength: 30 });
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty("code");
  });

  it("deletes a custom type after asking, and shows the server's refusal when it is in use", async () => {
    mocks.remove.mockRejectedValueOnce(Object.assign(new Error("This type is used by 2 customer(s) and 0 vendor(s). Switch it off instead of deleting it."), { code: "DOCUMENT_TYPE_IN_USE" }));
    render(<KycDocuments />);
    openTab("Document types");
    await screen.findByText("Trade licence");
    fireEvent.click(screen.getByRole("button", { name: "Delete Halal certificate" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete Halal certificate?" });
    fireEvent.click(within(confirm).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/used by 2 customer/)).toBeInTheDocument();
    expect(mocks.remove).toHaveBeenCalledWith("t3");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
