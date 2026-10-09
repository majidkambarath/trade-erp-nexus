import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// A voucher waiting for approval follows the same rules as an order: the server refuses an approver who prepared it (when the
// organisation says so), who is over their role's limit, or who already gave the first of two approvals; and above the
// organisation's second-approver amount the first approval is only recorded. This pins the voucher screen's half: Approve is
// hidden (never disabled) for the person who may not, the line says why, a first approval says so (never "Approved"), and a
// refusal shows the server's own sentence.
//
// Every absence is asserted after the grants are known and the voucher is on screen, with a button that is there as the
// control: while the grants are on their way the app hides nothing.

const m = vi.hoisted(() => ({ get: vi.fn(), approve: vi.fn(), remove: vi.fn(), audit: vi.fn() }));
vi.mock("../../../lib/bankingApi", async (importOriginal) => ({ ...(await importOriginal()), vouchers: { get: m.get, approve: m.approve, remove: m.remove, audit: m.audit } }));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import { StatusPill, VoucherView } from "../shared";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";
import { FIRST_APPROVAL_MESSAGE } from "../../../lib/approvals";

const voucher = (over = {}) => ({
  _id: "v1", voucherNo: "JV-2026-0001", voucherType: "journal", status: "pending", date: "2026-10-02T00:00:00.000Z", totalAmount: 900, ledgerBased: true, createdBy: "u2", approvals: [],
  entries: [{ accountName: "Cash in Hand", debitAmount: 900, creditAmount: 0 }, { accountName: "Sales", debitAmount: 0, creditAmount: 900 }],
  ...over,
});
const FIRST = [{ by: "u9", name: "Sam Khan", at: "2026-10-08T09:00:00Z", step: 1 }];
const GRANTS = ["finance.view", "finance.approve"];

const person = ({ grants = GRANTS, limit = null, policy = {} } = {}) => {
  const base = statusFor(grants);
  return { ...base, me: { ...base.me, id: "u1", role: { ...base.me.role, approvalLimit: limit } }, policy: { approvals: { separateApprover: false, secondApprovalAbove: null, ...policy } } };
};

const show = async (status, v = voucher(), props = {}) => {
  orgStatus = status;
  m.get.mockResolvedValue(v);
  render(<AsRole><VoucherView id="v1" title="Journal voucher" onClose={vi.fn()} {...props} /></AsRole>);
  await roleLoaded();
  expect(await screen.findByRole("heading", { name: /JV-2026-0001/ })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: /audit trail/i })).toBeInTheDocument();
};
const approveButton = () => screen.queryByRole("button", { name: /^approve$/i });
const rejectButton = () => screen.queryByRole("button", { name: /^reject$/i });

beforeEach(() => {
  vi.clearAllMocks();
  m.approve.mockResolvedValue({ voucher: voucher({ status: "approved" }) });
});

describe("Approve on a voucher that is waiting", () => {
  it("is offered to a person who holds finance.approve, and approves it", async () => {
    const onChanged = vi.fn();
    await show(person(), voucher(), { onChanged });
    expect(approveButton()).toBeInTheDocument();
    m.get.mockResolvedValue(voucher({ status: "approved" }));
    fireEvent.click(approveButton());
    await waitFor(() => expect(m.approve).toHaveBeenCalledWith("v1", "approve"));
    expect(await screen.findByText("Approved and posted.")).toBeInTheDocument();
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(approveButton()).toBeNull()); // it is decided now
  });

  it("is not offered to a person who may only look, nor on a voucher that is already posted", async () => {
    await show(person({ grants: ["finance.view"] }));
    expect(approveButton()).toBeNull();
    expect(rejectButton()).toBeNull();
  });

  it("is not offered on a posted voucher", async () => {
    await show(person(), voucher({ status: "approved" }));
    expect(approveButton()).toBeNull();
    expect(rejectButton()).toBeNull();
  });

  it("is hidden on the person's own voucher when the organisation asks for a separate approver, and the screen says why", async () => {
    await show(person({ policy: { separateApprover: true } }), voucher({ createdBy: "u1" }));
    expect(approveButton()).toBeNull();
    expect(screen.getByText("You prepared this document, so someone else has to approve it.")).toBeInTheDocument();
    expect(rejectButton()).toBeInTheDocument(); // turning it down is not part of the approval rules
  });

  it("is offered on someone else's voucher under the same rule", async () => {
    await show(person({ policy: { separateApprover: true } }), voucher({ createdBy: "u2" }));
    expect(approveButton()).toBeInTheDocument();
  });

  it("is hidden on a voucher over the person's limit, and the screen names the limit", async () => {
    await show(person({ limit: 500 }));
    expect(approveButton()).toBeNull();
    expect(screen.getByText("This is over your approval limit of 500.00 AED.")).toBeInTheDocument();
  });

  it("is offered on a voucher exactly at the person's limit", async () => {
    await show(person({ limit: 900 }));
    expect(approveButton()).toBeInTheDocument();
  });

  it("answers a first approval with an information message - never 'Approved' - and leaves the voucher waiting", async () => {
    await show(person({ policy: { secondApprovalAbove: 500 } }));
    expect(screen.queryByText("Awaiting second approval.")).toBeNull(); // nobody has approved it yet
    m.approve.mockResolvedValue({ voucher: voucher(), approval: { awaitingSecond: true, given: 1 } });
    m.get.mockResolvedValue(voucher({ approvals: [{ by: "u1", name: "Me", step: 1 }] })); // read again, with the first approval on it
    fireEvent.click(approveButton());
    expect(await screen.findByText(FIRST_APPROVAL_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("Approved and posted.")).toBeNull();
    // it now says it is waiting, that this person gave the first, and no longer offers them Approve
    expect(await screen.findByText("Awaiting second approval.")).toBeInTheDocument();
    expect(screen.getByText("You gave the first approval; a different person has to give the second.")).toBeInTheDocument();
    await waitFor(() => expect(approveButton()).toBeNull());
  });

  it("offers a different person the second approval", async () => {
    await show(person({ policy: { secondApprovalAbove: 500 } }), voucher({ approvals: FIRST }));
    expect(screen.getByText("Awaiting second approval.")).toBeInTheDocument();
    expect(approveButton()).toBeInTheDocument();
  });

  it("shows the server's own sentence when it refuses", async () => {
    await show(person());
    m.approve.mockRejectedValue(Object.assign(new Error("You prepared this document, so someone else has to approve it."), { code: "SELF_APPROVAL_NOT_ALLOWED" }));
    fireEvent.click(approveButton());
    expect(await screen.findByText("You prepared this document, so someone else has to approve it.")).toBeInTheDocument();
    expect(screen.queryByText("Approved and posted.")).toBeNull();
  });

  it("rejects a voucher, and says so", async () => {
    await show(person());
    m.approve.mockResolvedValue({ voucher: voucher({ status: "rejected" }) });
    fireEvent.click(rejectButton());
    await waitFor(() => expect(m.approve).toHaveBeenCalledWith("v1", "reject"));
    expect(await screen.findByText("Rejected.")).toBeInTheDocument();
  });
});

describe("the voucher's status in a list", () => {
  const pill = async (status, v) => {
    orgStatus = status;
    render(<AsRole><StatusPill status={v.status} doc={v} /></AsRole>);
    await roleLoaded();
  };

  it("says 'Awaiting second approval' for a voucher with its first approval, and 'Pending' for one with none", async () => {
    await pill(person({ policy: { secondApprovalAbove: 500 } }), voucher({ approvals: FIRST }));
    expect(screen.getByText("Awaiting second approval")).toBeInTheDocument();
    expect(screen.queryByText("Pending")).toBeNull();
  });

  it("says 'Pending' when nothing is waiting for a second approval", async () => {
    await pill(person({ policy: { secondApprovalAbove: 500 } }), voucher());
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("says 'Posted' once it is approved, whatever approvals it carries", async () => {
    await pill(person({ policy: { secondApprovalAbove: 500 } }), voucher({ status: "approved", approvals: FIRST }));
    expect(screen.getByText("Posted")).toBeInTheDocument();
  });

  it("is as it always was where the caller passes no voucher", async () => {
    orgStatus = person();
    render(<AsRole><StatusPill status="pending" /></AsRole>);
    await roleLoaded();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});
