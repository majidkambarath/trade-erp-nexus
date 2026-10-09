import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// Deleting an APPROVED voucher posts its ledger entries back (Delete and reverse). The server asks for finance.deletePosted
// for it (byVoucherDelete, judged by the stored status), which always comes with plain finance.delete; a person who holds
// only finance.delete is refused. So the voucher's own screen hides the button from them rather than offer one that fails.
// A voucher that is not approved has nothing to reverse and never had this button.
//
// Every absence is asserted after the grants are known and the voucher is on screen, with a button that is there as the
// control: while the grants are on their way the app hides nothing.

const m = vi.hoisted(() => ({ get: vi.fn(), remove: vi.fn(), audit: vi.fn() }));
vi.mock("../../../lib/bankingApi", async (importOriginal) => ({ ...(await importOriginal()), vouchers: { get: m.get, remove: m.remove, audit: m.audit } }));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import { VoucherView } from "../shared";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";

const voucher = (status) => ({
  _id: "v1", voucherNo: "RV-2026-0001", voucherType: "receipt", status, date: "2026-10-02T00:00:00.000Z", totalAmount: 105, ledgerBased: true,
  entries: [{ accountName: "Cash in Hand", debitAmount: 105, creditAmount: 0 }, { accountName: "Customer - Acme", debitAmount: 0, creditAmount: 105 }],
});

const FINANCE_VIEW = ["finance.view"];
const PLAIN = [...FINANCE_VIEW, "finance.delete"];
const POSTED = [...PLAIN, "finance.deletePosted"]; // the server expands deletePosted to hold delete as well

const show = async (grants, status = "approved", props = {}) => {
  orgStatus = statusFor(grants);
  m.get.mockResolvedValue(voucher(status));
  const onDeleted = vi.fn();
  render(<AsRole><VoucherView id="v1" title="Receipt voucher" onClose={vi.fn()} onDeleted={onDeleted} {...props} /></AsRole>);
  await roleLoaded();
  // the voucher is loaded: its number is in the heading and its footer (Audit trail is the control) is drawn
  expect(await screen.findByRole("heading", { name: /RV-2026-0001/ })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /audit trail/i })).toBeInTheDocument();
  return { onDeleted };
};
const reverse = () => screen.queryByRole("button", { name: /delete \(reverse\)/i });

beforeEach(() => {
  vi.clearAllMocks();
  m.remove.mockResolvedValue({ success: true });
});

describe("Delete (reverse) on an approved voucher", () => {
  it("is not offered to a person who holds finance.delete but not finance.deletePosted", async () => {
    await show(PLAIN);
    expect(reverse()).toBeNull();
  });

  it("is not offered to a person who may only look", async () => {
    await show(FINANCE_VIEW);
    expect(reverse()).toBeNull();
  });

  it("is offered to a person who holds finance.deletePosted, and reverses the voucher once they type delete", async () => {
    const { onDeleted } = await show(POSTED);
    fireEvent.click(reverse());
    const dialog = await screen.findByRole("dialog", { name: /Delete RV-2026-0001\?/ });
    expect(dialog).toHaveTextContent(/ledger entries are reversed/i);
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "delete" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete and reverse" }));
    await waitFor(() => expect(m.remove).toHaveBeenCalledWith("v1"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });

  it.each(["pending", "draft", "rejected", "cancelled"])("is not offered on a %s voucher, whatever the person holds", async (status) => {
    await show(POSTED, status);
    expect(reverse()).toBeNull();
  });

  it("a caller that says otherwise decides (canDelete), as before", async () => {
    await show(PLAIN, "approved", { canDelete: true });
    expect(reverse()).toBeInTheDocument();
  });
});
