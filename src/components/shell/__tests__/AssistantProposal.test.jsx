import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const saveProposal = vi.fn();
const proposalSaved = vi.fn().mockResolvedValue({});
vi.mock("../../../lib/assistantApi", () => ({
  assistant: { saveProposal: (...a) => saveProposal(...a), proposalSaved: (...a) => proposalSaved(...a) },
}));

import AssistantProposal from "../AssistantProposal";
import { normaliseProposals } from "../../../lib/assistantProposals";

const [payment] = normaliseProposals([
  {
    id: "p1", kind: "payment", endpoint: "voucher", title: "Payment", confirm: "Pay AED 1,000.00 to Gulf Packaging",
    lines: [["Pay", "Gulf Packaging"], ["Amount", "AED 1,000.00"], ["How", "Bank transfer"], ["Settles", "PO-1 (315.00), PO-2 (685.00)"]],
    body: { voucherType: "payment", vendorId: "v1", totalAmount: 1000, paymentMode: "transfer", paymentDetails: { accountId: "bk1" } },
    missing: ["reference"], warnings: ["AED 100.00 is more than they have open, so it would go on account."],
    prefill: { partyId: "v1", amount: 1000, mode: "transfer", accountId: "bk1", reference: "" },
  },
]);
const [cash] = normaliseProposals([{ ...payment, missing: [], body: { ...payment.body, paymentMode: "cash", paymentDetails: {} } }]);
const [invoice] = normaliseProposals([
  { id: "p2", kind: "invoice", endpoint: "transaction", title: "Invoice (draft)", confirm: "Create draft invoice for Harbour Cafe", lines: [["Customer", "Harbour Cafe"]], body: { type: "sales_order", partyId: "c1", items: [] }, missing: [], warnings: [], prefill: null },
]);

const show = (proposal, props = {}) => {
  const onChange = vi.fn();
  const onOpenForm = vi.fn();
  const onOpenPath = vi.fn();
  render(<AssistantProposal proposal={proposal} messageId="m1" onChange={onChange} onOpenForm={onOpenForm} onOpenPath={onOpenPath} {...props} />);
  return { onChange, onOpenForm, onOpenPath };
};

beforeEach(() => {
  vi.clearAllMocks();
  proposalSaved.mockResolvedValue({});
});

describe("a prepared document's card", () => {
  it("shows what will happen, any warning, and says nothing is saved yet", () => {
    show(payment);
    expect(screen.getByText("Gulf Packaging")).toBeInTheDocument();
    expect(screen.getByText("PO-1 (315.00), PO-2 (685.00)")).toBeInTheDocument();
    expect(screen.getByText(/would go on account/)).toBeInTheDocument();
    expect(screen.getByText("Nothing is saved until you press the button.")).toBeInTheDocument();
    expect(saveProposal).not.toHaveBeenCalled();
  });

  it("a bank transfer waits for its reference before the button works, then sends it", async () => {
    saveProposal.mockResolvedValue({ data: { voucherNo: "PV-2026-0007", status: "approved" } });
    const { onChange } = show(payment);
    const button = screen.getByRole("button", { name: "Pay AED 1,000.00 to Gulf Packaging" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Reference/), { target: { value: "TT-7781" } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(saveProposal).toHaveBeenCalledTimes(1));
    expect(saveProposal).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }), { reference: "TT-7781" });
    expect(await screen.findByText(/Payment PV-2026-0007 is recorded/)).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith("p1", { result: expect.objectContaining({ ok: true, number: "PV-2026-0007" }), savedAs: "PV-2026-0007" });
    expect(proposalSaved).toHaveBeenCalledWith("m1", "p1", "PV-2026-0007");
  });

  it("a voucher the organisation holds for approval is not called paid", async () => {
    saveProposal.mockResolvedValue({ data: { voucherNo: "PV-8", status: "pending" }, approval: { held: true } });
    render(<AssistantProposal proposal={cash} messageId="m1" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: cash.confirm }));
    expect(await screen.findByText(/waiting for approval/)).toBeInTheDocument();
    expect(screen.queryByText(/is recorded/)).toBeNull();
  });

  it("the server's refusal is shown in its own words and the button can be pressed again", async () => {
    saveProposal.mockRejectedValue({ response: { data: { message: "Posting is closed up to 31 Oct 2026" } } });
    const { onChange } = show(cash);
    fireEvent.click(screen.getByRole("button", { name: cash.confirm }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Posting is closed up to 31 Oct 2026");
    expect(onChange).not.toHaveBeenCalled();
    expect(proposalSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: cash.confirm })).toBeEnabled();
  });

  it("pressing twice while it is saving posts one payment, not two", async () => {
    let finish;
    saveProposal.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    show(cash);
    const button = screen.getByRole("button", { name: cash.confirm });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(screen.getByRole("button", { name: /Saving/ }));
    expect(saveProposal).toHaveBeenCalledTimes(1);
    finish({ data: { voucherNo: "PV-9" } });
    expect(await screen.findByText(/PV-9 is recorded/)).toBeInTheDocument();
  });

  it("Change details opens the normal form, with what was typed on the card", () => {
    const { onOpenForm } = show(payment);
    fireEvent.change(screen.getByLabelText(/Reference/), { target: { value: "TT-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Change details/ }));
    expect(onOpenForm).toHaveBeenCalledWith({ path: "/payment-voucher", state: { assistantPrefill: expect.objectContaining({ kind: "payment", partyId: "v1", reference: "TT-1" }) } });
  });

  it("an invoice has no Change details, and once saved offers to open the draft", async () => {
    saveProposal.mockResolvedValue({ data: { transactionNo: "SO-2026-0042", status: "DRAFT" } });
    const { onOpenPath } = show(invoice);
    expect(screen.queryByRole("button", { name: /Change details/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: invoice.confirm }));
    expect(await screen.findByText(/Saved as a draft SO-2026-0042/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open the draft" }));
    expect(onOpenPath).toHaveBeenCalledWith("/sales-order?search=SO-2026-0042");
  });

  it("one that was saved on an earlier visit shows that, and offers no button", () => {
    render(<AssistantProposal proposal={{ ...cash, savedAs: "PV-2026-0001" }} messageId="m1" onChange={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved PV-2026-0001.");
    expect(screen.queryByRole("button", { name: cash.confirm })).toBeNull();
  });
});
