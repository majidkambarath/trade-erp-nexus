import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The approvals page: what is waiting for a decision, for the person looking. The rows come from the server, which has judged
// each with the same rules as the approve routes; the page shows them in two lists, offers Approve only on the first, and
// approves through the SAME calls as the document's own screen - so a refusal reads in the server's own words.
//
// Every absence is asserted after the grants are known and the list is on screen, with a button that IS there as the control.

const m = vi.hoisted(() => ({ waiting: vi.fn(), processTransaction: vi.fn(), vApprove: vi.fn(), vGet: vi.fn(), vAudit: vi.fn(), vRemove: vi.fn() }));
vi.mock("../../../lib/approvalsApi", async (importOriginal) => ({ ...(await importOriginal()), approvalQueue: { waiting: m.waiting, count: vi.fn() } }));
vi.mock("../../../lib/processTransaction", async (importOriginal) => ({ ...(await importOriginal()), processTransaction: m.processTransaction }));
vi.mock("../../../lib/bankingApi", async (importOriginal) => ({ ...(await importOriginal()), vouchers: { approve: m.vApprove, get: m.vGet, audit: m.vAudit, remove: m.vRemove } }));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import ApprovalsPage from "../ApprovalsPage";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";
import { FIRST_APPROVAL_MESSAGE } from "../../../lib/approvals";

const doc = (over = {}) => ({
  id: "d1", kind: "document", type: "sales_order", typeLabel: "Sales order", number: "SO-2026-0007", party: "Al Noor Trading", narration: "", amount: 840,
  date: "2026-10-06T00:00:00.000Z", createdAt: "2026-10-06T08:00:00.000Z", branchId: "main", preparedBy: "Layla Preparer", preparedById: "u9", ageDays: 3,
  state: "waiting", given: 0, firstApprovers: [], step: 1, of: 1, reason: null, link: "/sales-order?search=SO-2026-0007", ...over,
});
const voucher = (over = {}) => ({
  id: "v1", kind: "voucher", type: "journal", typeLabel: "Journal", number: "JV-2026-0012", party: "", narration: "Month-end accrual", amount: 1500,
  date: "2026-10-08T00:00:00.000Z", createdAt: "2026-10-08T08:00:00.000Z", branchId: "main", preparedBy: "Omar Cashier", preparedById: "u8", ageDays: 1,
  state: "waiting", given: 0, firstApprovers: [], step: 1, of: 1, reason: null, link: "/journal-voucher", ...over,
});
const NOT_MINE = doc({
  id: "d2", number: "SO-2026-0008", party: "Gulf Fresh Foods", amount: 9000, ageDays: 0, step: null, of: null, link: "/sales-order?search=SO-2026-0008",
  reason: { code: "APPROVAL_LIMIT_EXCEEDED", message: "This document is 9000.00 AED and your approval limit is 500.00 AED. Ask someone with a higher limit to approve it." },
});
const ANSWER = (over = {}) => ({ forYou: [doc(), voucher()], others: [NOT_MINE], counts: { forYou: 2, others: 1 }, capped: false, ...over });

const GRANTS = ["sales.view", "sales.approve", "finance.view", "finance.approve"];
const person = (grants = GRANTS) => statusFor(grants);

const show = async (answer = ANSWER(), status = person()) => {
  orgStatus = status;
  m.waiting.mockResolvedValue(answer);
  const view = render(<MemoryRouter><AsRole><ApprovalsPage /></AsRole></MemoryRouter>);
  await roleLoaded();
  await screen.findByRole("heading", { name: "Approvals" });
  return view;
};
const forYou = () => screen.getByRole("table", { name: "Waiting for your approval" });
const others = () => screen.getByRole("table", { name: "Waiting for someone else" });
const approveButton = (number) => screen.queryByRole("button", { name: `Approve ${number}` });

beforeEach(() => {
  vi.clearAllMocks();
  m.processTransaction.mockResolvedValue({ data: { data: { transaction: { status: "APPROVED" } } } });
  m.vApprove.mockResolvedValue({ voucher: { status: "approved" } });
  m.vGet.mockResolvedValue({ _id: "v1", voucherNo: "JV-2026-0012", voucherType: "journal", status: "pending", totalAmount: 1500, date: "2026-10-08T00:00:00.000Z", createdBy: "u8", approvals: [], entries: [] });
});
afterEach(() => {
  delete window.matchMedia;
});

describe("the two lists", () => {
  it("shows what is theirs to approve with its number, party, who prepared it, how long it has waited and the amount", async () => {
    await show();
    expect(await screen.findByText("Waiting for you (2)")).toBeInTheDocument();
    const table = within(forYou());
    const orderRow = table.getByText("SO-2026-0007").closest("tr");
    expect(within(orderRow).getByText("Sales order")).toBeInTheDocument();
    expect(within(orderRow).getByText("Al Noor Trading")).toBeInTheDocument();
    expect(within(orderRow).getByText("By Layla Preparer")).toBeInTheDocument();
    expect(within(orderRow).getByText("3 days")).toBeInTheDocument();
    expect(within(orderRow).getByText("840.00")).toBeInTheDocument();
    expect(within(orderRow).getByText("Waiting")).toBeInTheDocument();
    // a voucher has no party: its narration says what it is
    const voucherRow = table.getByText("JV-2026-0012").closest("tr");
    expect(within(voucherRow).getByText("Month-end accrual")).toBeInTheDocument();
    expect(within(voucherRow).getByText("1 day")).toBeInTheDocument();
  });

  it("shows what is waiting but not for them, with the server's reason, and offers no Approve on it", async () => {
    await show();
    expect(await screen.findByText("Waiting, but not for you (1)")).toBeInTheDocument();
    const row = within(others()).getByText("SO-2026-0008").closest("tr");
    expect(within(row).getByText(/your approval limit is 500\.00 AED/)).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Open SO-2026-0008" })).toHaveAttribute("href", "/sales-order?search=SO-2026-0008"); // (it can still be opened)
    expect(approveButton("SO-2026-0008")).toBeNull();
    expect(approveButton("SO-2026-0007")).toBeInTheDocument(); // (the control: Approve is there where it should be)
  });

  it("a second approval is labelled as one, with who gave the first, and says what theirs will be", async () => {
    await show(ANSWER({ forYou: [doc({ state: "awaiting second approver", given: 1, firstApprovers: ["Sam Khan"], step: 2, of: 2 })], others: [], counts: { forYou: 1, others: 0 } }));
    const row = within(forYou()).getByText("SO-2026-0007").closest("tr");
    expect(within(row).getByText("Awaiting second approver")).toBeInTheDocument();
    expect(within(row).getByText("First approval by Sam Khan")).toBeInTheDocument();
    expect(within(row).getByText("Your approval finishes it")).toBeInTheDocument();
  });

  it("says the first of two when their approval will not finish it", async () => {
    await show(ANSWER({ forYou: [doc({ step: 1, of: 2 })], others: [], counts: { forYou: 1, others: 0 } }));
    expect(within(forYou()).getByText("Your approval is the first of two")).toBeInTheDocument();
  });

  it("has an empty state, and no second list, when nothing is waiting", async () => {
    await show(ANSWER({ forYou: [], others: [], counts: { forYou: 0, others: 0 } }));
    expect(await screen.findByText("Nothing is waiting for you")).toBeInTheDocument();
    expect(screen.queryByText(/Waiting, but not for you/)).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says when more is waiting than is listed", async () => {
    await show(ANSWER({ capped: true }));
    expect(await screen.findByText(/More is waiting than is listed here/)).toBeInTheDocument();
  });

  it("shows the server's message when the list cannot be read", async () => {
    orgStatus = person();
    m.waiting.mockRejectedValue(new Error("Your role does not allow this."));
    render(<MemoryRouter><AsRole><ApprovalsPage /></AsRole></MemoryRouter>);
    await roleLoaded();
    expect(await screen.findByText(/Your role does not allow this\./)).toBeInTheDocument();
  });
});

describe("Approve is the usual approve", () => {
  it("approves an order through the order's own approve, says so, and reads the list again", async () => {
    await show();
    m.waiting.mockResolvedValue(ANSWER({ forYou: [voucher()], counts: { forYou: 1, others: 1 } }));
    fireEvent.click(approveButton("SO-2026-0007"));
    await waitFor(() => expect(m.processTransaction).toHaveBeenCalledWith("d1", "approve"));
    expect(m.vApprove).not.toHaveBeenCalled();
    expect(await screen.findByText("SO-2026-0007 approved.")).toBeInTheDocument();
    await waitFor(() => expect(m.waiting).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(approveButton("SO-2026-0007")).toBeNull()); // decided: gone from the list
  });

  it("approves a voucher through the voucher approve", async () => {
    await show();
    fireEvent.click(approveButton("JV-2026-0012"));
    await waitFor(() => expect(m.vApprove).toHaveBeenCalledWith("v1", "approve"));
    expect(m.processTransaction).not.toHaveBeenCalled();
    expect(await screen.findByText("JV-2026-0012 approved.")).toBeInTheDocument();
  });

  it("a first approval is said to be exactly that, never 'approved'", async () => {
    m.vApprove.mockResolvedValue({ voucher: {}, approval: { awaitingSecond: true, given: 1 } });
    await show();
    fireEvent.click(approveButton("JV-2026-0012"));
    expect(await screen.findByText(FIRST_APPROVAL_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("JV-2026-0012 approved.")).toBeNull();
  });

  it("a refusal shows the server's own sentence and the row stays", async () => {
    m.processTransaction.mockRejectedValue({ response: { data: { message: "You prepared this document, so someone else has to approve it." } } });
    await show();
    fireEvent.click(approveButton("SO-2026-0007"));
    expect(await screen.findByText("You prepared this document, so someone else has to approve it.")).toBeInTheDocument();
    expect(approveButton("SO-2026-0007")).toBeInTheDocument();
  });

  it("is hidden, not disabled, for a row of a module the person cannot approve in", async () => {
    // (the server never sends such a row; the page does not rely on that)
    await show(ANSWER(), person(["sales.view", "sales.approve", "finance.view"]));
    expect(approveButton("SO-2026-0007")).toBeInTheDocument();
    expect(approveButton("JV-2026-0012")).toBeNull();
  });
});

describe("opening a row", () => {
  it("opens an order in its own list, narrowed to its number", async () => {
    await show();
    const link = within(forYou()).getByRole("link", { name: "Open SO-2026-0007" });
    expect(link).toHaveAttribute("href", "/sales-order?search=SO-2026-0007");
  });

  it("opens a voucher on the page, with its own approve and reject", async () => {
    await show();
    fireEvent.click(within(forYou()).getByRole("button", { name: "Open JV-2026-0012" }));
    expect(await screen.findByRole("heading", { name: /Journal JV-2026-0012/ })).toBeInTheDocument();
    expect(m.vGet).toHaveBeenCalledWith("v1");
    expect(await screen.findByRole("button", { name: /^reject$/i })).toBeInTheDocument();
  });
});

describe("on a phone", () => {
  it("every row is a card with its own Approve and Open, and there is no table", async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    await show();
    expect(screen.queryByRole("table")).toBeNull();
    const cards = within(screen.getByRole("list", { name: "Waiting for your approval" })).getAllByRole("listitem");
    expect(cards).toHaveLength(2);
    const first = within(cards[0]);
    expect(first.getByText("SO-2026-0007")).toBeInTheDocument();
    expect(first.getByText("Al Noor Trading")).toBeInTheDocument();
    expect(first.getByText("840.00")).toBeInTheDocument();
    expect(first.getByText("Waiting")).toBeInTheDocument();
    expect(first.getByText("By Layla Preparer")).toBeInTheDocument();
    expect(first.getByRole("button", { name: "Approve SO-2026-0007" })).toBeInTheDocument();
    expect(first.getByRole("link", { name: "Open SO-2026-0007" })).toBeInTheDocument();
    // the other list's card carries the reason as a labelled line
    const notMine = within(within(screen.getByRole("list", { name: "Waiting for someone else" })).getAllByRole("listitem")[0]);
    expect(notMine.getByText("Why not you")).toBeInTheDocument();
    expect(notMine.getByText(/your approval limit is 500\.00 AED/)).toBeInTheDocument();
    expect(notMine.queryByRole("button", { name: /^Approve/ })).toBeNull();
  });
});
