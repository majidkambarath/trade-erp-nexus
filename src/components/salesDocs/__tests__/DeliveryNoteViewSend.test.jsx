import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import DeliveryNoteView from "../DeliveryNoteView";
import { deliveryNotes } from "../../../lib/salesDocumentsApi";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";

vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: vi.fn(() => ({ companyName: "Zarvia Trading", vatNumber: "100123456700003" })) }));
vi.mock("../../../lib/salesDocumentsApi", () => ({
  deliveryNotes: { get: vi.fn(), activity: vi.fn(), pickList: vi.fn(), dispatch: vi.fn(), deliver: vi.fn(), cancel: vi.fn(), invoice: vi.fn(), remove: vi.fn() },
}));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

const note = (status) => ({
  _id: "n1", deliveryNoteNo: "DLN-2026-0001", status, invoiceStatus: "NONE", date: "2026-11-18T00:00:00.000Z", source: { kind: "manual" },
  items: [{ _id: "l1", itemCode: "R1", description: "Basmati 5kg", qty: 6, price: 20, vatPercent: 5, lineTotal: 126, stockDetails: { unit: "BAG" } }],
  pricing: { grandTotal: 126 }, totalAmount: 126, party: { customerName: "Al Noor", customerId: "C1", email: "ali@alnoor.ae" },
  actions: {}, clock: null,
});
const props = { id: "n1", onBack: vi.fn(), onEdit: vi.fn(), onChanged: vi.fn(), onInvoiced: vi.fn(), notify: vi.fn() };
const showAs = (status, grants = ["sales.view", "sales.send"]) => {
  orgStatus = statusFor(grants);
  deliveryNotes.get.mockResolvedValue(note(status));
  deliveryNotes.activity.mockResolvedValue({ rows: [], total: 0 });
  return render(<MemoryRouter><AsRole><DeliveryNoteView {...props} /></AsRole></MemoryRouter>);
};

beforeEach(() => vi.clearAllMocks());

describe("emailing a delivery note", () => {
  it.each([["DISPATCHED", true], ["DELIVERED", true], ["DRAFT", false], ["CANCELLED", false]])("%s: the Send button is %s", async (status, shown) => {
    showAs(status);
    await roleLoaded();
    await screen.findByText("DLN-2026-0001");
    const send = screen.queryByRole("button", { name: /^send$/i });
    if (shown) expect(send).toBeInTheDocument();
    else expect(send).not.toBeInTheDocument();
  });

  it("is not offered to someone who may not send", async () => {
    showAs("DELIVERED", ["sales.view"]);
    await roleLoaded();
    await screen.findByText("DLN-2026-0001");
    expect(screen.queryByRole("button", { name: /^send$/i })).not.toBeInTheDocument();
  });
});
