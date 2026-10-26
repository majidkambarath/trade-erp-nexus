import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// Stage 1 of the cheque lifecycle on the screen: the Deposited and On hold tabs, the buttons each state offers (only what
// the rules allow), the deposit and hold dialogs, and acting on several cheques at once.
const m = vi.hoisted(() => ({
  cheques: vi.fn(), depositCheque: vi.fn(), holdCheque: vi.fn(), resumeCheque: vi.fn(), bulkCheques: vi.fn(),
  bounceCheque: vi.fn(), returnCheque: vi.fn(), postable: vi.fn(), taxCodes: vi.fn(),
}));
vi.mock("../../../lib/bankingApi", () => ({
  banking: { cheques: m.cheques, depositCheque: m.depositCheque, holdCheque: m.holdCheque, resumeCheque: m.resumeCheque, bulkCheques: m.bulkCheques, clearCheque: vi.fn(), bounceCheque: m.bounceCheque, returnCheque: m.returnCheque, cancelCheque: vi.fn() },
  vouchers: { get: vi.fn() },
}));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { postableAccounts: m.postable, taxCodes: m.taxCodes }, ApiError: class extends Error {} }));

import ChequeRegister from "../ChequeRegister";
import { todayInput } from "../../../utils/format";

const row = (n, over = {}) => ({ _id: `c${n}`, chequeNo: `CHQ${n}`, direction: "receipt", voucherNo: `RV-${n}`, voucherId: `v${n}`, partyName: "Al Noor", chequeDate: "2026-01-02T00:00:00Z", amount: 100, status: "pending", matured: true, ...over });
const summary = { receivable: { amount: 0, count: 0 }, payable: { amount: 0, count: 0 } };
const show = (rows) => m.cheques.mockImplementation(async () => ({ rows, total: rows.length, summary }));
const btn = (name) => screen.queryAllByRole("button", { name });
const last = () => m.cheques.mock.calls.at(-1)[0];

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  show([row(1)]);
  m.depositCheque.mockResolvedValue({}); m.holdCheque.mockResolvedValue({}); m.resumeCheque.mockResolvedValue({});
  m.bulkCheques.mockResolvedValue({ action: "deposit", successful: [{ id: "c1" }, { id: "c2" }], failed: [] });
  m.bounceCheque.mockResolvedValue({}); m.returnCheque.mockResolvedValue({});
  m.postable.mockResolvedValue([{ _id: "inc1", category: "INCOME", accountCode: "4100", accountName: "Other Income" }]);
  m.taxCodes.mockResolvedValue([{ _id: "tx1", name: "VAT 5%", ratePercent: 5, isActive: true }, { _id: "tx2", name: "Reverse charge 5%", ratePercent: 5, isActive: true, kind: "reverse_charge" }]);
});

describe("the tabs", () => {
  it("has a tab for every state, and the live ones are worklists with no period", async () => {
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    for (const name of ["Pending", "Deposited", "On hold", "Cleared", "Bounced", "Cancelled", "All"]) expect(screen.getByRole("tab", { name })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Deposited" }));
    await waitFor(() => expect(last().status).toBe("deposited"));
    expect(last().from).toBeUndefined();
    expect(last().to).toBeUndefined();
    expect(document.body).toHaveTextContent("taken to the bank and waiting to clear, whatever its date");
    fireEvent.click(screen.getByRole("tab", { name: "On hold" }));
    await waitFor(() => expect(last().status).toBe("hold"));
    expect(last().from).toBeUndefined();
  });
});

describe("the buttons each state offers", () => {
  it("pending: Deposit, Clear, Hold, Bounced and Cancel - but not Resume", async () => {
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    for (const n of [/^deposit$/i, /^clear$/i, /^hold$/i, /^bounced$/i, /^cancel$/i]) expect(btn(n)).toHaveLength(1);
    expect(btn(/^resume$/i)).toHaveLength(0);
  });
  it("a post-dated cheque shows Deposit and Clear but waits for its date", async () => {
    show([row(1, { matured: false })]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    expect(btn(/^deposit$/i)[0]).toBeDisabled();
    expect(btn(/^clear$/i)[0]).toBeDisabled();
    expect(btn(/^hold$/i)[0]).toBeEnabled();
  });
  it("on hold: Resume, Bounced and Cancel - not Deposit, Clear or Hold - and the reason is shown", async () => {
    show([row(1, { status: "hold", holdReason: "Waiting for a transfer" })]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    expect(btn(/^resume$/i)).toHaveLength(1);
    for (const n of [/^deposit$/i, /^clear$/i, /^hold$/i]) expect(btn(n)).toHaveLength(0);
    expect(screen.getByText(/Waiting for a transfer/)).toBeInTheDocument();
  });
  it("deposited: Clear and Bounced only - it is at the bank, so it cannot be cancelled - and the slip is shown", async () => {
    show([row(1, { status: "deposited", presentedOn: "2026-01-03T00:00:00Z", depositSlipNo: "S-9" })]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    expect(btn(/^clear$/i)).toHaveLength(1);
    expect(btn(/^bounced$/i)).toHaveLength(1);
    for (const n of [/^cancel$/i, /^deposit$/i, /^hold$/i, /^resume$/i]) expect(btn(n)).toHaveLength(0);
    expect(screen.getByText(/slip S-9/)).toBeInTheDocument();
  });
});

describe("depositing and holding", () => {
  it("deposit sends the date and the slip, says nothing is posted, and reports it", async () => {
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    fireEvent.click(btn(/^deposit$/i)[0]);
    expect(await screen.findByText(/Nothing is posted: the amount stays in cheques in hand/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Paying-in slip no/), { target: { value: "S-9" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark deposited" }));
    await waitFor(() => expect(m.depositCheque).toHaveBeenCalledWith("c1", { depositedOn: todayInput(), slipNo: "S-9" }));
    expect(await screen.findByText("Cheque CHQ1 deposited")).toBeInTheDocument();
  });

  it("a refusal from the server stays in the dialog, in the server's own words", async () => {
    // the real client throws an ApiError: a message and a code
    m.depositCheque.mockRejectedValue(Object.assign(new Error("This cheque is dated 2026-12-01 and cannot be deposited before then"), { code: "CHEQUE_NOT_MATURE" }));
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    fireEvent.click(btn(/^deposit$/i)[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Mark deposited" }));
    expect(await screen.findByText(/cannot be deposited before then/)).toBeInTheDocument();
  });

  it("hold will not save without a reason, and then sends it", async () => {
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    fireEvent.click(btn(/^hold$/i)[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Put on hold" }));
    expect(await screen.findByText("Say why the cheque is being held")).toBeInTheDocument();
    expect(m.holdCheque).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: /Reason/ }), { target: { value: "Wait for a transfer" } });
    fireEvent.click(screen.getByRole("button", { name: "Put on hold" }));
    await waitFor(() => expect(m.holdCheque).toHaveBeenCalledWith("c1", { reason: "Wait for a transfer", until: undefined }));
  });

  it("resume asks first, then puts the cheque back", async () => {
    show([row(1, { status: "hold", holdReason: "x" })]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    fireEvent.click(btn(/^resume$/i)[0]);
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(m.resumeCheque).toHaveBeenCalledWith("c1", {}));
  });
});

describe("several at once", () => {
  const tick = (...nos) => nos.forEach((n) => fireEvent.click(screen.getByLabelText(`Select cheque CHQ${n}`)));

  it("ticking shows a bar; Deposit sends only the ids, the date and one slip, and reports the count", async () => {
    show([row(1), row(2)]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    expect(screen.queryByRole("toolbar", { name: "Selected cheques" })).toBeNull();
    tick(1, 2);
    const bar = await screen.findByRole("toolbar", { name: "Selected cheques" });
    expect(bar).toHaveTextContent("2 selected");
    fireEvent.click(screen.getByRole("button", { name: /^Deposit \(2\)/ }));
    fireEvent.change(await screen.findByLabelText(/Paying-in slip no/), { target: { value: "BULK" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark deposited" }));
    await waitFor(() => expect(m.bulkCheques).toHaveBeenCalledWith({ action: "deposit", ids: ["c1", "c2"], on: todayInput(), slipNo: "BULK", reason: "", until: undefined }));
    expect(await screen.findByText("2 cheques deposited.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Selected cheques" })).toBeNull());
  });

  it("each button counts only the ticked cheques it could apply to, and the dialog says how many are left out", async () => {
    show([row(1), row(2, { status: "hold", holdReason: "x" })]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    tick(1, 2);
    await screen.findByRole("toolbar", { name: "Selected cheques" });
    expect(screen.getByRole("button", { name: /^Deposit \(1\)/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^Resume \(1\)/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /^Deposit \(1\)/ }));
    expect(await screen.findByText(/1 of the 2 you ticked cannot be done this way and are left out/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark deposited" }));
    await waitFor(() => expect(m.bulkCheques.mock.calls[0][0].ids).toEqual(["c1"]));
  });

  it("a bulk act that partly fails names the first problem", async () => {
    show([row(1), row(2)]);
    m.bulkCheques.mockResolvedValue({ successful: [{ id: "c1" }], failed: [{ id: "c2", code: "CHEQUE_NOT_MATURE", message: "This cheque is dated 2027-01-01 and cannot be deposited before then" }] });
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    tick(1, 2);
    fireEvent.click(await screen.findByRole("button", { name: /^Deposit \(2\)/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Mark deposited" }));
    expect(await screen.findByText(/1 deposited, 1 left alone\. First problem: This cheque is dated 2027-01-01/)).toBeInTheDocument();
  });

  it("a new tab starts with nothing ticked", async () => {
    show([row(1)]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    tick(1);
    await screen.findByRole("toolbar", { name: "Selected cheques" });
    fireEvent.click(screen.getByRole("tab", { name: "On hold" }));
    await waitFor(() => expect(screen.queryByRole("toolbar", { name: "Selected cheques" })).toBeNull());
  });
});

// ---- Stage 2: a cheque the bank sent back, and a cheque handed back ----
describe("handing a cheque back", () => {
  it("is offered for a pending or held cheque, never one at the bank", async () => {
    show([row(1), row(2, { status: "hold", holdReason: "x" }), row(3, { status: "deposited" })]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    expect(btn(/^hand back$/i)).toHaveLength(2);
  });

  it("needs a reason, then sends it and reports it", async () => {
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    fireEvent.click(btn(/^hand back$/i)[0]);
    const dialog = await screen.findByRole("dialog", { name: /hand back cheque CHQ1/i });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hand back" }));
    expect(await within(dialog).findByText("Say why the cheque is being handed back")).toBeInTheDocument();
    expect(m.returnCheque).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Replaced by a transfer" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hand back" }));
    await waitFor(() => expect(m.returnCheque).toHaveBeenCalledWith("c1", { reason: "Replaced by a transfer" }));
    expect(await screen.findByText("Cheque CHQ1 handed back")).toBeInTheDocument();
  });

  it("has its own tab, and shows why on the row", async () => {
    show([row(1, { status: "returned", reason: "Replaced by a transfer" })]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    fireEvent.click(screen.getByRole("tab", { name: "Handed back" }));
    await waitFor(() => expect(last().status).toBe("returned"));
    expect(last().from).toBeDefined(); // it is how a cheque ended, not a worklist: it carries a period
    expect(screen.getByText("Replaced by a transfer")).toBeInTheDocument();
    expect(btn(/^hand back$/i)).toHaveLength(0);
  });
});

describe("a cheque the bank sent back", () => {
  const open = async (over) => {
    show([row(1, over)]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    fireEvent.click(btn(/^bounced$/i)[0]);
    return screen.findByRole("dialog", { name: /bounced/i });
  };
  const submit = (dialog) => fireEvent.click(within(dialog).getByRole("button", { name: "Mark bounced" }));

  it("an ordinary bounce sends only the reason and fetches nothing it does not need", async () => {
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Insufficient funds" } });
    submit(dialog);
    await waitFor(() => expect(m.bounceCheque).toHaveBeenCalledWith("c1", { reason: "Insufficient funds" }));
    expect(m.postable).not.toHaveBeenCalled();
    expect(m.taxCodes).not.toHaveBeenCalled();
  });

  it("picking a reason from the list words it, and sends the code with the words", async () => {
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/Why it came back/), { target: { value: "account_closed" } });
    expect(within(dialog).getByLabelText(/Reason/)).toHaveValue("Account closed");
    submit(dialog);
    await waitFor(() => expect(m.bounceCheque).toHaveBeenCalledWith("c1", { reason: "Account closed", reasonCode: "account_closed" }));
  });

  it("the bank's fee: shown when ticked, must be filled in, and sent with the reason", async () => {
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Insufficient funds" } });
    expect(within(dialog).queryByLabelText(/^Bank charge/)).toBeNull();
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /The bank charged a fee/ }));
    const amount = await within(dialog).findByLabelText(/^Bank charge/);
    submit(dialog);
    expect(await within(dialog).findByText("Enter the bank's charge")).toBeInTheDocument();
    expect(m.bounceCheque).not.toHaveBeenCalled();
    fireEvent.change(amount, { target: { value: "52.5" } });
    submit(dialog);
    await waitFor(() => expect(m.bounceCheque).toHaveBeenCalledWith("c1", { reason: "Insufficient funds", bankCharge: { amount: 52.5 } }));
    expect(m.taxCodes).toHaveBeenCalled();
  });

  it("charging it back to the customer needs an account, and is only offered on a customer's cheque", async () => {
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "r" } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Charge it back to the customer/ }));
    fireEvent.change(await within(dialog).findByLabelText(/^Charge the customer/), { target: { value: "60" } });
    submit(dialog);
    expect(await within(dialog).findByText("Choose the account the recovered charge is credited to")).toBeInTheDocument();
    expect(m.bounceCheque).not.toHaveBeenCalled();
    expect(m.postable).toHaveBeenCalled();
  });

  it("a cheque we issued has no customer to charge back", async () => {
    const dialog = await open({ direction: "payment" });
    expect(within(dialog).queryByRole("checkbox", { name: /Charge it back/ })).toBeNull();
    expect(within(dialog).getByRole("checkbox", { name: /The bank charged a fee/ })).toBeInTheDocument();
  });

  it("the server's refusal stays in the dialog in its own words, and nothing is reported done", async () => {
    m.bounceCheque.mockRejectedValue(Object.assign(new Error("The cheque was not marked bounced, because its charge needs an approver: over your limit"), { code: "APPROVAL_LIMIT_EXCEEDED" }));
    const dialog = await open();
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "r" } });
    submit(dialog);
    expect(await within(dialog).findByText(/its charge needs an approver/)).toBeInTheDocument();
    expect(screen.queryByText(/marked bounced$/)).toBeNull();
  });

  it("a bounced row says what the bounce cost", async () => {
    show([row(1, { status: "bounced", reason: "Insufficient funds", charges: { expenseVoucherNo: "EV-2026-0007", rechargeVoucherNo: "DN-2026-0003" } })]);
    render(<ChequeRegister />);
    await screen.findByText("CHQ1");
    expect(screen.getByText("Bank charge EV-2026-0007 · charged back DN-2026-0003")).toBeInTheDocument();
  });
});
