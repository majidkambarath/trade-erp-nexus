import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// F04 (finance QA review, 1 Nov 2026): a posted voucher is locked - no figure may change here - but
// its narration and notes still can, with a reason, from the voucher's own screen. Only
// finance.edit is asked for (the same right a plain edit always needed); a pending voucher is
// edited in full elsewhere and offers no narration-only button at all.

const m = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), audit: vi.fn() }));
vi.mock("../../../lib/bankingApi", async (importOriginal) => ({ ...(await importOriginal()), vouchers: { get: m.get, update: m.update, audit: m.audit } }));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import { VoucherView } from "../shared";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";
import { MemoryRouter } from "react-router-dom";

const voucher = (status, over = {}) => ({
  _id: "v1", voucherNo: "JV-2026-0001", voucherType: "journal", status, date: "2026-10-02T00:00:00.000Z", totalAmount: 600, ledgerBased: true,
  narration: "Month-end accrual", notes: "",
  entries: [{ accountName: "Rent Expense", debitAmount: 600, creditAmount: 0 }, { accountName: "Cash in Hand", debitAmount: 0, creditAmount: 600 }],
  ...over,
});

const EDIT = ["finance.view", "finance.edit"];
const VIEW_ONLY = ["finance.view"];

const show = async (grants, status = "approved") => {
  orgStatus = statusFor(grants);
  m.get.mockResolvedValue(voucher(status));
  render(<MemoryRouter><AsRole><VoucherView id="v1" title="Journal voucher" onClose={vi.fn()} onChanged={vi.fn()} /></AsRole></MemoryRouter>);
  await roleLoaded();
  expect(await screen.findByRole("heading", { name: /JV-2026-0001/ })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /audit trail/i })).toBeInTheDocument();
};
const editNarration = () => screen.queryByRole("button", { name: /edit narration/i });

beforeEach(() => {
  vi.clearAllMocks();
  m.update.mockResolvedValue(voucher("approved", { narration: "Corrected", notes: "checked" }));
});

describe("Edit narration on a posted voucher", () => {
  it("is offered to someone who holds finance.edit", async () => {
    await show(EDIT);
    expect(editNarration()).toBeInTheDocument();
  });

  it("is not offered to someone who may only look", async () => {
    await show(VIEW_ONLY);
    expect(editNarration()).toBeNull();
  });

  it("is not offered on a pending voucher - that one is edited in full, elsewhere", async () => {
    await show(EDIT, "pending");
    expect(editNarration()).toBeNull();
  });

  it("needs a reason before Save is enabled, and sends it with the narration and notes - never a figure", async () => {
    await show(EDIT);
    fireEvent.click(editNarration());
    expect(screen.getByText(/posted.*cannot change here/i)).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Narration"), { target: { value: "Corrected" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "checked" } });
    expect(save).toBeDisabled(); // still no reason

    fireEvent.change(screen.getByLabelText(/Reason for this change/), { target: { value: "typo in the month" } });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);

    await waitFor(() => expect(m.update).toHaveBeenCalledWith("v1", { narration: "Corrected", notes: "checked", reason: "typo in the month" }));
    await waitFor(() => expect(screen.queryByLabelText(/Reason for this change/)).not.toBeInTheDocument());
  });

  it("Cancel leaves the voucher as it was and sends nothing", async () => {
    await show(EDIT);
    fireEvent.click(editNarration());
    fireEvent.change(screen.getByLabelText("Narration"), { target: { value: "Changed my mind" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(m.update).not.toHaveBeenCalled();
    expect(screen.getByText("Month-end accrual")).toBeInTheDocument();
  });
});
