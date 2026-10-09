import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrderForm from "../OrderForm";
import { VARIANTS, recalcRow } from "../variants";
import axiosInstance from "../../../axios/axios";
import { applyAfterSave } from "../../../lib/processTransaction";
import { OrganisationProvider } from "../../shell/OrganisationContext";
import { FIRST_APPROVAL_MESSAGE } from "../../../lib/approvals";

// Saving a sales order with the status Approved saves a draft and then approves it (the server's approve is its own action). Above
// the organisation's second-approver amount that approve only records the FIRST approval: the form must say so, in an
// information message, never "approved" - and hand the list back a document that is still a draft, carrying who approved it.
vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => <div>Attachments panel</div>, linkPending: vi.fn(async () => []) }));
vi.mock("../../../lib/processTransaction", () => ({ applyAfterSave: vi.fn() }));
vi.mock("../../../lib/organisationApi", () => ({
  getOrganisationStatus: vi.fn(() => Promise.resolve({
    organisation: { legalName: "Harbour Trading", baseCurrency: "AED" }, subscription: { state: "active", blocked: false }, features: {},
    me: { id: "u1", name: "Olivia", role: { key: "r", name: "A role", rank: 40 }, grants: ["sales.view", "sales.create", "sales.approve"] },
  })),
}));

const customers = [{ _id: "c1", customerId: "C1", customerName: "Al Noor Grocery", billingAddress: "Deira", phone: "04 1", trnNumber: "1", paymentTerms: "Net 30" }];
const stockItems = [{ _id: "s1", itemId: "ITM1", itemName: "Basmati 5kg", purchasePrice: 10, salesPrice: 20, currentStock: 40, taxPercent: 5 }];
const row = recalcRow(VARIANTS.sales, { ...VARIANTS.sales.rowTemplate(), itemId: "s1", itemCode: "ITM1", description: "Basmati 5kg", qty: "10", rate: "20", vatPercent: "5" });
const form = () => ({ transactionNo: "", partyId: "c1", partyType: "Customer", date: "2026-10-06", deliveryDate: "2026-10-07", status: "APPROVED", refNo: "", docNo: "", notes: "", discount: "0", charges: [], items: [row] });

function Harness({ notify, onSuccess }) {
  const [formData, setFormData] = useState(form());
  return (
    <OrganisationProvider>
      <OrderForm variant={VARIANTS.sales} formData={formData} setFormData={setFormData} parties={customers} stockItems={stockItems} notify={notify} setActiveView={() => {}} resetForm={() => {}} onSuccess={onSuccess} activeView="create" />
    </OrganisationProvider>
  );
}

const save = async (notify, onSuccess) => {
  render(<Harness notify={notify} onSuccess={onSuccess} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: /save so/i }));
  await waitFor(() => expect(applyAfterSave).toHaveBeenCalledTimes(1));
};

beforeEach(() => {
  vi.clearAllMocks();
  axiosInstance.get.mockImplementation(async (url) => ({ data: { data: url === "/accounting/tax-codes" ? [] : [] } }));
  axiosInstance.post.mockResolvedValue({ data: { data: { _id: "so1", partyId: "c1", status: "DRAFT", createdBy: "u1", totalAmount: 210, approvals: [], items: [] } } });
});

describe("saving a sales order as Approved", () => {
  it("approves it when one approval is enough", async () => {
    applyAfterSave.mockResolvedValue({ done: true, status: "APPROVED" });
    const notify = vi.fn();
    const onSuccess = vi.fn();
    await save(notify, onSuccess);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onSuccess.mock.calls[0][0].status).toBe("APPROVED");
    expect(notify).not.toHaveBeenCalledWith(FIRST_APPROVAL_MESSAGE, "info");
  });

  it("says only the first approval was recorded, and hands back a draft that carries it", async () => {
    applyAfterSave.mockResolvedValue({ done: false, awaitingSecond: true });
    const notify = vi.fn();
    const onSuccess = vi.fn();
    await save(notify, onSuccess);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(notify).toHaveBeenCalledWith(FIRST_APPROVAL_MESSAGE, "info");
    expect(notify.mock.calls.some(([text]) => /not approved|approved successfully/i.test(text))).toBe(false);
    const doc = onSuccess.mock.calls[0][0];
    expect(doc.status).toBe("DRAFT");
    expect(doc.approvals).toHaveLength(1);
    expect(doc.approvals[0]).toMatchObject({ by: "u1", name: "Olivia", step: 1 });
  });

  it("keeps the saved draft and gives the server's reason when the approve is refused", async () => {
    applyAfterSave.mockResolvedValue({ done: false, message: "You prepared this document, so someone else has to approve it." });
    const notify = vi.fn();
    const onSuccess = vi.fn();
    await save(notify, onSuccess);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(notify).toHaveBeenCalledWith("Sales order saved, but not approved - it was left as a draft: You prepared this document, so someone else has to approve it.", "error");
    expect(onSuccess.mock.calls[0][0].status).toBe("DRAFT");
  });
});
