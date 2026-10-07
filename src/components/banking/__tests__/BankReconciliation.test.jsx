import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

const m = vi.hoisted(() => ({
  accounts: vi.fn(), setupStatus: vi.fn(), setupPreview: vi.fn(), saveSetup: vi.fn(), profile: vi.fn(),
  previewImport: vi.fn(), importStatement: vi.fn(), imports: vi.fn(),
  lines: vi.fn(), entries: vi.fn(), allocation: vi.fn(), match: vi.fn(), accept: vi.fn(), unmatch: vi.fn(), ignore: vi.fn(), unignore: vi.fn(), createFromLine: vi.fn(),
  proof: vi.fn(), finish: vi.fn(), reconciliations: vi.fn(), reconciliation: vi.fn(), reopen: vi.fn(),
  cardUnsettled: vi.fn(), cardSettle: vi.fn(), cardSettlements: vi.fn(), cardVariance: vi.fn(), cardAgeing: vi.fn(),
  readFile: vi.fn(), postable: vi.fn(), taxCodes: vi.fn(), options: vi.fn(), axiosGet: vi.fn(),
}));
vi.mock("../../../lib/bankReconcileApi", () => ({ reconcile: m }));
vi.mock("../../../lib/statementFile", () => ({ readStatementFile: m.readFile }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { postableAccounts: m.postable, taxCodes: m.taxCodes }, ApiError: class extends Error {} }));
vi.mock("../../../lib/bankingApi", () => ({ banking: { options: m.options } }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.axiosGet } }));

import BankReconciliation from "../BankReconciliation";

// ---- fixtures ----------------------------------------------------------------------------------
const ACCOUNTS = [
  { _id: "b1", accountName: "Recon Bank", accountCode: "BANK0001", bank: { bankName: "ENBD", accountNumberMasked: "•••• 4567" }, bookBalance: 1433.9, setUp: true, counts: { open: 3, matched: 2, reconciled: 0, ignored: 0 }, lastLineDay: "2026-10-06", lastReconciled: null },
  { _id: "b2", accountName: "Savings Bank", accountCode: "BANK0002", bank: null, bookBalance: 0, setUp: false, counts: { open: 0, matched: 0, reconciled: 0, ignored: 0 }, lastLineDay: null, lastReconciled: null },
];
const line = (over) => ({ _id: "l1", importId: "i1", lineNo: 3, day: "2026-10-02", valueDay: null, description: "TRANSFER FROM AL NOOR TRF-9001", reference: "", chequeNo: "", amount: 1050, balance: 11050, state: "open", matchId: null, reconciliationId: null, ignoredReason: "", suggestion: null, match: null, ...over });
const entry = (over) => ({ id: "e1", type: "ledger", ledgerEntryId: "le1", chequeId: null, voucherId: "v1", voucherNo: "RV-2026-0001", voucherType: "receipt", day: "2026-10-02", amount: 1050, narration: "", party: "Al Noor", reference: "TRF-9001", chequeNo: "", card: null, pending: false, ...over });
const suggestion = (over) => ({ confidence: "high", score: 100, reasons: ["same amount", "same day"], kind: "one", entries: [entry()], ...over });
const counts = (over) => ({ todo: 0, suggested: 0, matched: 0, reconciled: 0, ignored: 0, all: 0, ...over });
const page = (rows, c) => ({ account: { _id: "b1", accountName: "Recon Bank" }, needsSetup: false, rows, total: rows.length, page: 1, pages: 1, counts: counts({ all: rows.length, ...c }) });
const proof = (over) => ({
  asOf: "2026-10-06", statementBalance: 1341.9, bookBalance: 1433.9, depositsInTransit: { total: 77, items: [] }, outstandingPayments: { total: 0, items: [] },
  bankItemsNotInBooks: { total: 0, items: [] }, ignored: { total: -15, items: [] }, adjustedBank: 1418.9, adjustedBook: 1418.9, difference: 0, openLines: 0,
  blockers: [], canFinish: true, openingDifference: 0, unclearedCheques: { items: [], count: 0, total: 0 }, ...over,
});

const choose = async (name, text) => {
  fireEvent.keyDown(screen.getByRole("combobox", { name }), { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(text) }));
};

const show = (url = "/bank-reconciliation") => render(<MemoryRouter initialEntries={[url]}><BankReconciliation /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  m.accounts.mockResolvedValue(ACCOUNTS);
  m.setupStatus.mockResolvedValue({ startDay: "2026-09-01", statementOpening: 1000, outstandingCount: 0, outstandingTotal: 0, bookBalanceBefore: 1000, difference: 0 });
  m.lines.mockResolvedValue(page([]));
  m.imports.mockResolvedValue([{ _id: "i1", status: "active", periodFrom: "2026-10-01", periodTo: "2026-10-06", closingBalance: 1341.9, lineCount: 10 }]);
  m.proof.mockResolvedValue(proof());
  m.profile.mockResolvedValue(null);
  m.reconciliations.mockResolvedValue([]);
  m.cardAgeing.mockResolvedValue({ buckets: [], total: 0, count: 0, items: [], asOf: "2026-10-06" });
  m.cardVariance.mockResolvedValue({ summary: { settlements: 0, gross: 0, feeBooked: 0, extraCommission: 0, vat: 0, received: 0, bookedRate: 0, effectiveRate: 0 }, months: [], cards: [], settlements: [] });
  m.postable.mockResolvedValue([
    { _id: "x1", accountName: "Bank Charges", accountCode: "OPEX0009", category: "EXPENSE" },
    { _id: "x2", accountName: "Utilities", accountCode: "OPEX0003", category: "EXPENSE" },
    { _id: "x3", accountName: "Bank Interest Income", accountCode: "OI0002", category: "INCOME" },
  ]);
  m.taxCodes.mockResolvedValue([{ _id: "t1", name: "Standard 5%", kind: "standard", ratePercent: 5, isDefault: true, isActive: true }]);
  m.options.mockResolvedValue({ cashAccounts: [{ _id: "c1", accountName: "Cash in Hand", accountCode: "CASH0001" }], bankAccounts: [{ _id: "b1", accountName: "Recon Bank", accountCode: "BANK0001" }, { _id: "b2", accountName: "Savings Bank", accountCode: "BANK0002" }] });
  m.axiosGet.mockResolvedValue({ data: { data: [{ _id: "cu1", customerName: "Al Noor Grocery", customerId: "C1" }] } });
});

// ---- the worklist --------------------------------------------------------------------------------
describe("the worklist", () => {
  it("shows the account, what the engine suggests and why, and matches it in one click", async () => {
    m.lines.mockResolvedValue(page([line({ suggestion: suggestion() })], { suggested: 1 }));
    m.match.mockResolvedValue({ _id: "m1" });
    show();
    const card = await screen.findByRole("article", { name: /TRANSFER FROM AL NOOR/ }, { timeout: 4000 });
    expect(await screen.findByText("Balance in the books")).toBeInTheDocument();
    expect(within(card).getByText("Strong match")).toBeInTheDocument();
    expect(within(card).getByText("same amount, same day")).toBeInTheDocument();
    expect(within(card).getByText("RV-2026-0001")).toBeInTheDocument();
    expect(within(card).getAllByText("+1,050.00").length).toBeGreaterThan(0); // the line, and the entry it matches

    fireEvent.click(within(card).getByRole("button", { name: /^match$/i }));
    await waitFor(() => expect(m.match).toHaveBeenCalledWith({ accountId: "b1", lineIds: ["l1"], entries: [{ type: "ledger", ledgerEntryId: "le1" }] }));
    expect(await screen.findByRole("status")).toHaveTextContent("Matched"); // the confirmation toast
  });

  it("a cheque suggestion says matching will clear the cheque, and sends it as a cheque", async () => {
    const cheque = entry({ id: "cheque:c1", type: "cheque", ledgerEntryId: undefined, chequeId: "c1", voucherType: "cheque", voucherNo: "RV-2026-0002", chequeNo: "000777", pending: true });
    m.lines.mockResolvedValue(page([line({ day: "2026-10-07", description: "CHQ DEP 000777", suggestion: suggestion({ entries: [cheque], reasons: ["same amount", "cheque 000777 is on the line"] }) })], { suggested: 1 }));
    m.match.mockResolvedValue({ _id: "m1" });
    show();
    const card = await screen.findByRole("article", { name: /CHQ DEP 000777/ }, { timeout: 4000 });
    expect(within(card).getByText(/Matching clears this cheque on 2026-10-07/)).toBeInTheDocument();
    expect(within(card).getByText(/waiting to clear/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /^match$/i }));
    await waitFor(() => expect(m.match).toHaveBeenCalledWith({ accountId: "b1", lineIds: ["l1"], entries: [{ type: "cheque", chequeId: "c1" }] }));
  });

  it("a deposit of several receipts is matched together", async () => {
    const group = suggestion({ confidence: "medium", kind: "group", reasons: ["2 entries add up to exactly this amount"], entries: [entry({ id: "a", ledgerEntryId: "la", amount: 300, voucherNo: "RV-1" }), entry({ id: "b", ledgerEntryId: "lb", amount: 225, voucherNo: "RV-2" })] });
    m.lines.mockResolvedValue(page([line({ amount: 525, description: "CASH DEPOSIT", suggestion: group })], { suggested: 1 }));
    m.match.mockResolvedValue({ _id: "m1" });
    show();
    const card = await screen.findByRole("article", { name: /CASH DEPOSIT/ }, { timeout: 4000 });
    expect(within(card).getByText("Possible match")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /match all 2/i }));
    await waitFor(() => expect(m.match).toHaveBeenCalledWith({ accountId: "b1", lineIds: ["l1"], entries: [{ type: "ledger", ledgerEntryId: "la" }, { type: "ledger", ledgerEntryId: "lb" }] }));
  });

  it("accepts every strong match at once", async () => {
    m.lines.mockResolvedValue(page([line({ suggestion: suggestion() })], { suggested: 1 }));
    m.accept.mockResolvedValue({ accepted: 1, skipped: [], matchIds: ["m1"] });
    show();
    fireEvent.click(await screen.findByRole("button", { name: /accept all strong matches/i }));
    await waitFor(() => expect(m.accept).toHaveBeenCalledWith({ accountId: "b1" }));
  });

  it("a line nothing fits says so and offers the other ways forward", async () => {
    m.lines.mockResolvedValue(page([line({ _id: "l2", description: "BANK CHARGES", amount: -21 })], { todo: 1 }));
    show();
    const card = await screen.findByRole("article", { name: /BANK CHARGES/ }, { timeout: 4000 });
    expect(within(card).getByText("Nothing in the books fits this line yet.")).toBeInTheDocument();
    expect(within(card).getByText("-21.00")).toBeInTheDocument();
    for (const name of [/find in the books/i, /post an entry/i, /ignore/i]) expect(within(card).getByRole("button", { name })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /card settlement/i })).not.toBeInTheDocument(); // money out cannot be a card payout
  });

  it("ignoring a line needs a reason", async () => {
    m.lines.mockResolvedValue(page([line({ _id: "l2", description: "DUPLICATE FEE", amount: -15 })], { todo: 1 }));
    m.ignore.mockResolvedValue({ _id: "l2" });
    show();
    fireEvent.click(within(await screen.findByRole("article", { name: /DUPLICATE FEE/ }, { timeout: 4000 })).getByRole("button", { name: /ignore/i }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: /^ignore$/i });
    expect(confirm).toBeDisabled();
    fireEvent.click(within(dialog).getByRole("button", { name: /duplicate in the bank's own file/i }));
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(m.ignore).toHaveBeenCalledWith("l2", "Duplicate in the bank's own file"));
  });

  it("never shows one tab's lines under another tab's name while the new ones are on their way", async () => {
    let release;
    m.lines.mockImplementation(({ tab }) => (tab === "matched"
      ? new Promise((resolve) => { release = () => resolve(page([], { matched: 1 })); })
      : Promise.resolve(page([line({ _id: "l8", description: "A LINE STILL TO DO", amount: -5 })], { todo: 1, matched: 1 }))));
    show();
    await screen.findByRole("article", { name: /A LINE STILL TO DO/ }, { timeout: 4000 });
    fireEvent.click(screen.getByRole("tab", { name: /^matched/i }));
    expect(screen.queryByRole("article", { name: /A LINE STILL TO DO/ })).not.toBeInTheDocument(); // not under the Matched name
    await waitFor(() => expect(release).toBeTypeOf("function")); // the request for the Matched tab is on its way
    release();
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
  });

  it("an account that has not been set up starts with the statement", async () => {
    show("/bank-reconciliation?account=b2");
    expect(await screen.findByText("Start with a bank statement")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /import a statement/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /set up first/i })).toBeInTheDocument();
    expect(m.lines).not.toHaveBeenCalled();
  });

  it("warns when the account's starting balance is out", async () => {
    m.setupStatus.mockResolvedValue({ startDay: "2026-09-01", statementOpening: 900, outstandingCount: 0, outstandingTotal: 0, bookBalanceBefore: 1000, difference: 100 });
    show();
    expect(await screen.findByText(/starting balance for this account is out by 100.00/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fix it in set up/i })).toBeInTheDocument();
  });
});

// ---- the proof -----------------------------------------------------------------------------------
describe("the proof panel", () => {
  it("starts from the latest import, and finishing sends the date and balance", async () => {
    m.lines.mockResolvedValue(page([], {}));
    m.finish.mockResolvedValue({ number: "BRC-2026-0001" });
    show();
    const balance = await screen.findByLabelText("Closing balance on the statement");
    await waitFor(() => expect(balance).toHaveValue("1341.9")); // filled from the latest import once it has loaded
    expect(await screen.findByText("The two sides agree. This can be finished.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(m.proof).toHaveBeenCalledWith({ accountId: "b1", asOf: "2026-10-06", statementBalance: 1341.9 });

    fireEvent.click(screen.getByRole("button", { name: /^finish reconciliation$/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/The lines matched up to this date are locked/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /finish and lock/i }));
    await waitFor(() => expect(m.finish).toHaveBeenCalledWith({ accountId: "b1", asOf: "2026-10-06", statementBalance: 1341.9, note: "" }));
  });

  it("says what is in the way, and cannot be finished", async () => {
    m.proof.mockResolvedValue(proof({ canFinish: false, openLines: 2, blockers: [{ code: "OPEN_LINES", message: "2 statement lines are not matched or ignored yet" }, { code: "DIFFERENCE", message: "The two sides differ by 5.00" }], difference: 5 }));
    show();
    expect(await screen.findByText("2 statement lines are not matched or ignored yet", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("The two sides differ by 5.00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^finish reconciliation$/i })).toBeDisabled();
  });
});

// ---- posting what the books lack ------------------------------------------------------------------
describe("post an entry", () => {
  const open = async (over) => {
    m.lines.mockResolvedValue(page([line({ _id: "l2", description: "BANK CHARGES INCL VAT", amount: -21, ...over })], { todo: 1 }));
    show();
    fireEvent.click(within(await screen.findByRole("article", { name: /BANK CHARGES/ }, { timeout: 4000 })).getByRole("button", { name: /post an entry/i }));
    return screen.findByRole("dialog");
  };

  it("a bank charge splits the statement's gross into the charge and its VAT, and posts", async () => {
    m.createFromLine.mockResolvedValue({ voucher: { _id: "v9", voucherNo: "EV-2026-0001", totalAmount: 21 }, match: {} });
    const dialog = await open();
    expect(within(dialog).getByRole("radio", { name: /bank charge/i })).toBeChecked();
    expect(await within(dialog).findByText(/21\.00 = 20\.00 charge \+ 1\.00 VAT/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /post and match/i }));
    await waitFor(() => expect(m.createFromLine).toHaveBeenCalledWith("l2", { accountId: "b1", kind: "fee", vat: true }));
  });

  it("offers what fits the direction of the money", async () => {
    const dialog = await open();
    const names = within(dialog).getAllByRole("radio").map((r) => r.closest("label").textContent);
    expect(names.some((t) => /Bank charge/.test(t))).toBe(true);
    expect(names.some((t) => /Vendor payment/.test(t))).toBe(true);
    expect(names.some((t) => /Customer receipt|Interest received/.test(t))).toBe(false);
  });

  it("a transfer cannot be posted until the other account is chosen", async () => {
    m.createFromLine.mockResolvedValue({ voucher: { _id: "v9", voucherNo: "CV-2026-0001", totalAmount: 21 }, match: {} });
    const dialog = await open();
    fireEvent.click(within(dialog).getByRole("radio", { name: /to another account/i }));
    expect(within(dialog).getByRole("button", { name: /post and match/i })).toBeDisabled();
    await choose("Other account", "Savings Bank");
    expect(within(dialog).getByRole("button", { name: /post and match/i })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("button", { name: /post and match/i }));
    await waitFor(() => expect(m.createFromLine).toHaveBeenCalledWith("l2", { accountId: "b1", kind: "transfer", otherAccountId: "b2" }));
  });

  it("a customer receipt shows which invoices it would settle", async () => {
    m.allocation.mockResolvedValue({ invoices: [{ invoiceId: "inv1", transactionNo: "SO-2026-0004", date: "2026-09-01", outstanding: 200, allocate: 200, balance: 0 }], allocated: 200, onAccount: 80 });
    m.createFromLine.mockResolvedValue({ voucher: { _id: "v9", voucherNo: "RV-2026-0009", totalAmount: 280 }, match: {} });
    const dialog = await open({ amount: 280, description: "BANK CHARGES TRANSFER IN" });
    fireEvent.click(within(dialog).getByRole("radio", { name: /customer receipt/i }));
    await choose("Customer", "Al Noor Grocery");
    expect(await within(dialog).findByText("SO-2026-0004")).toBeInTheDocument();
    expect(within(dialog).getByText(/80\.00 is left over and kept on account/)).toBeInTheDocument();
    expect(m.allocation).toHaveBeenCalledWith("l2", { accountId: "b1", partyId: "cu1", kind: "receipt" });
    fireEvent.click(within(dialog).getByRole("button", { name: /post and match/i }));
    await waitFor(() => expect(m.createFromLine).toHaveBeenCalledWith("l2", { accountId: "b1", kind: "receipt", partyId: "cu1", allocate: "oldest" }));
  });
});

// ---- finding entries by hand ----------------------------------------------------------------------
describe("find in the books", () => {
  it("matches several entries only when they add up to the line exactly", async () => {
    m.lines.mockResolvedValue(page([line({ _id: "l3", description: "CASH DEPOSIT", amount: 525 })], { todo: 1 }));
    m.entries.mockResolvedValue({ total: 3, rows: [entry({ id: "a", ledgerEntryId: "la", amount: 300, voucherNo: "RV-1" }), entry({ id: "b", ledgerEntryId: "lb", amount: 225, voucherNo: "RV-2" }), entry({ id: "c", ledgerEntryId: "lc", amount: 100, voucherNo: "RV-3" })] });
    m.match.mockResolvedValue({ _id: "m1" });
    show();
    fireEvent.click(within(await screen.findByRole("article", { name: /CASH DEPOSIT/ }, { timeout: 4000 })).getByRole("button", { name: /find in the books/i }));
    const dialog = await screen.findByRole("dialog");
    const match = within(dialog).getByRole("button", { name: /^match$/i });
    expect(match).toBeDisabled();
    fireEvent.click(await within(dialog).findByLabelText("RV-1 300.00"));
    expect(within(dialog).getByText(/225\.00 short/)).toBeInTheDocument();
    expect(match).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText("RV-2 225.00"));
    expect(within(dialog).getByText("Adds up to the line")).toBeInTheDocument();
    const matchTwo = within(dialog).getByRole("button", { name: /match 2 entries/i });
    expect(matchTwo).toBeEnabled();
    fireEvent.click(matchTwo);
    await waitFor(() => expect(m.match).toHaveBeenCalledWith({ accountId: "b1", lineIds: ["l3"], entries: [{ type: "ledger", ledgerEntryId: "la" }, { type: "ledger", ledgerEntryId: "lb" }] }));
  });
});

// ---- card settlement ------------------------------------------------------------------------------
describe("card settlement", () => {
  const receipts = [
    { entryId: "e1", ledgerEntryId: "le1", voucherNo: "RV-2026-0020", day: "2026-10-03", cardId: "k1", cardLabel: "POS 1", gross: 100, feeBooked: 2, net: 98 },
    { entryId: "e2", ledgerEntryId: "le2", voucherNo: "RV-2026-0021", day: "2026-10-04", cardId: "k1", cardLabel: "POS 1", gross: 200, feeBooked: 4, net: 196 },
    { entryId: "e3", ledgerEntryId: "le3", voucherNo: "RV-2026-0022", day: "2026-10-05", cardId: "k1", cardLabel: "POS 1", gross: 100, feeBooked: 2, net: 98 },
  ];
  const open = async () => {
    m.lines.mockResolvedValue(page([line({ _id: "l4", description: "NETWORK INTL SETTLEMENT 0099", amount: 293.7, day: "2026-10-06" })], { todo: 1 }));
    m.cardUnsettled.mockResolvedValue({ receipts, vatRate: 5, line: {}, suggestion: { cutoffDay: "2026-10-04", entryIds: ["e1", "e2"], expectedNet: 294, difference: 0.3 } });
    m.cardSettle.mockResolvedValue({ settlement: {}, match: {} });
    show();
    fireEvent.click(within(await screen.findByRole("article", { name: /NETWORK INTL/ }, { timeout: 4000 })).getByRole("button", { name: /card settlement/i }));
    return screen.findByRole("dialog");
  };

  it("ticks the sales the payment most likely settles and proposes the split of the difference", async () => {
    const dialog = await open();
    const first = await within(dialog).findByLabelText("RV-2026-0020 98.00");
    await waitFor(() => expect(first).toBeChecked()); // the suggested sales are ticked once the list has loaded
    expect(within(dialog).getByLabelText("RV-2026-0021 196.00")).toBeChecked();
    expect(within(dialog).getByLabelText("RV-2026-0022 98.00")).not.toBeChecked();
    expect(within(dialog).getByText("The books expect").nextSibling).toHaveTextContent("294.00");
    expect(within(dialog).getByText("The bank paid").nextSibling).toHaveTextContent("293.70");
    await waitFor(() => expect(within(dialog).getByLabelText("VAT on the commission")).toHaveValue("0.3"));
    expect(within(dialog).getByLabelText("Extra commission")).toHaveValue("0");
    expect(within(dialog).getByText("The difference is fully explained.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /record settlement/i }));
    await waitFor(() => expect(m.cardSettle).toHaveBeenCalledWith({ accountId: "b1", lineId: "l4", receiptEntryIds: ["e1", "e2"], extraCommission: 0, vat: 0.3, settlementRef: "" }));
  });

  it("cannot be recorded while any of the difference is unexplained", async () => {
    const dialog = await open();
    const record = await within(dialog).findByRole("button", { name: /record settlement/i });
    await waitFor(() => expect(record).toBeEnabled()); // once the suggested sales are ticked
    fireEvent.change(within(dialog).getByLabelText("VAT on the commission"), { target: { value: "0.1" } });
    expect(within(dialog).getByText("0.20 still to explain")).toBeInTheDocument();
    expect(record).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Extra commission"), { target: { value: "0.2" } });
    expect(within(dialog).getByText("The difference is fully explained.")).toBeInTheDocument();
    expect(record).toBeEnabled();
  });

  it("a payment these sales cannot explain says why and cannot be recorded", async () => {
    const dialog = await open();
    const record = await within(dialog).findByRole("button", { name: /record settlement/i });
    await waitFor(() => expect(record).toBeEnabled());
    // untick both: only a 98 sale left for a 293.70 payment
    fireEvent.click(within(dialog).getByLabelText("RV-2026-0021 196.00"));
    expect(await within(dialog).findByText(/195.70 more than these sales are worth after commission/)).toBeInTheDocument();
    expect(record).toBeDisabled();
    expect(within(dialog).queryByText("The difference is fully explained.")).not.toBeInTheDocument();
  });

  it("ticking another sale re-works the figures", async () => {
    const dialog = await open();
    fireEvent.click(await within(dialog).findByLabelText("RV-2026-0022 98.00"));
    // 392 expected, 293.70 paid: 98.30 more than that, and no longer a plausible fit
    expect(within(dialog).getByText("The books expect").nextSibling).toHaveTextContent("392.00");
    expect(within(dialog).getByText("Difference").nextSibling).toHaveTextContent("98.30");
  });
});

// ---- undoing --------------------------------------------------------------------------------------
describe("unmatching", () => {
  it("offers to delete the entry that was posted for the match, and sends the choice", async () => {
    const matched = line({ _id: "l5", state: "matched", description: "BANK CHARGES INCL VAT", amount: -21, matchId: "m1", match: { _id: "m1", kind: "created", method: "created", reconciliationId: null, lineCount: 1, entries: [{ voucherNo: "EV-2026-0001", voucherType: "expense", day: "2026-10-02", amount: -21, narration: "" }], createdVouchers: [{ voucherId: "v1", voucherNo: "EV-2026-0001", kind: "fee" }] } });
    m.lines.mockImplementation(({ tab }) => Promise.resolve(tab === "matched" ? page([matched], { matched: 1 }) : page([], { matched: 1 })));
    m.unmatch.mockResolvedValue({ match: {}, warnings: [] });
    show();
    fireEvent.click(await screen.findByRole("tab", { name: /^matched/i }));
    const card = await screen.findByRole("article", { name: /BANK CHARGES/ }, { timeout: 4000 });
    expect(within(card).getByText("Entry posted for this line")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: /unmatch/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByLabelText(/Also delete the EV-2026-0001/));
    fireEvent.click(within(dialog).getByRole("button", { name: /^unmatch$/i }));
    await waitFor(() => expect(m.unmatch).toHaveBeenCalledWith("m1", true));
  });

  it("a line in a completed reconciliation is locked, with no way to unmatch it", async () => {
    const locked = line({ _id: "l6", state: "reconciled", description: "LOCKED LINE", reconciliationId: "r1", matchId: "m2", match: { _id: "m2", kind: "match", method: "auto", reconciliationId: "r1", lineCount: 1, entries: [], createdVouchers: [] } });
    m.lines.mockResolvedValue(page([locked], { matched: 1, reconciled: 1 }));
    show();
    fireEvent.click(await screen.findByRole("tab", { name: /^matched/i }));
    const card = await screen.findByRole("article", { name: /LOCKED LINE/ }, { timeout: 4000 });
    expect(within(card).getByText("Locked in a completed reconciliation")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /unmatch/i })).not.toBeInTheDocument();
  });
});

// ---- history --------------------------------------------------------------------------------------
describe("history", () => {
  it("lists completed reconciliations; only the latest can be reopened; the statement opens", async () => {
    m.reconciliations.mockResolvedValue([
      { _id: "r2", number: "BRC-2026-0002", asOf: "2026-10-31", statementBalance: 5000, lineCount: 12, status: "completed" },
      { _id: "r1", number: "BRC-2026-0001", asOf: "2026-09-30", statementBalance: 4000, lineCount: 9, status: "completed" },
    ]);
    m.reconciliation.mockResolvedValue({ _id: "r2", number: "BRC-2026-0002", status: "completed", account: { accountName: "Recon Bank" }, proof: proof({ asOf: "2026-10-31" }), createdAt: "2026-11-01T08:00:00.000Z" });
    m.reopen.mockResolvedValue({ number: "BRC-2026-0002" });
    show("/bank-reconciliation?view=history");
    expect(await screen.findByText("BRC-2026-0002")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /reopen/i })).toHaveLength(1);

    fireEvent.click(screen.getAllByRole("button", { name: /^statement$/i })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Balance per bank statement")).toBeInTheDocument();
    expect(within(dialog).getByText("Adjusted bank balance")).toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole("button", { name: /^close$/i }).pop()); // the footer one: the X is the other

    fireEvent.click(screen.getByRole("button", { name: /reopen/i }));
    const reopen = await screen.findByRole("dialog");
    fireEvent.change(within(reopen).getByRole("textbox"), { target: { value: "A fee was missed" } });
    fireEvent.click(within(reopen).getByRole("button", { name: /^reopen$/i }));
    await waitFor(() => expect(m.reopen).toHaveBeenCalledWith("r2", { reason: "A fee was missed" }));
  });
});

// ---- importing ------------------------------------------------------------------------------------
describe("importing a statement", () => {
  const preview = (over) => ({
    format: "grid", mapping: { headerRow: 0, dateFormat: "DMY", columns: { date: 0, description: 1, balance: 4 }, amount: { mode: "split", debit: 2, credit: 3 } },
    guess: { headerRow: 0, headers: ["Date", "Description", "Debit", "Credit", "Balance"], complete: true }, sampleRows: [],
    lines: [{ lineNo: 2, day: "2026-10-02", description: "TRANSFER FROM AL NOOR", amount: 1050, balance: 11050, duplicate: false }], counts: { total: 9, new: 9, duplicates: 0 },
    issues: [], issueCount: 0, skipped: 1, order: "ascending", opening: 10000, closing: 10529, continuity: { ok: true, checked: true, breaks: [] },
    periodFrom: "2026-10-02", periodTo: "2026-10-06", gap: null, fileDuplicate: false, setup: { exists: true, startDay: "2026-09-01", beforeStart: 0 }, ...over,
  });
  const file = () => new File(["x"], "oct.csv", { type: "text/csv" });
  const rows = [["Date", "Description", "Debit", "Credit", "Balance"], ["02/10/2026", "TRANSFER FROM AL NOOR", "", "1,050.00", "11,050.00"]];
  const pick = async () => {
    show();
    fireEvent.click((await screen.findAllByRole("button", { name: /^import a statement$/i }))[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Statement file"), { target: { files: [file()] } });
    return dialog;
  };

  it("reads the file, shows what an import would do, and imports with the layout the server guessed", async () => {
    m.lines.mockResolvedValue(page([], {}));
    m.readFile.mockResolvedValue({ kind: "grid", fileName: "oct.csv", rows });
    m.previewImport.mockResolvedValue(preview());
    m.importStatement.mockResolvedValue({ import: {}, imported: 9, duplicates: 0, skippedRows: 0 });
    const dialog = await pick();
    expect(await within(dialog).findByText(/9 lines from/)).toBeInTheDocument();
    expect(within(dialog).getByText(/9 new/)).toBeInTheDocument();
    expect(within(dialog).getByText("TRANSFER FROM AL NOOR")).toBeInTheDocument();
    fireEvent.click(await within(dialog).findByRole("button", { name: /import 9 lines/i }));
    await waitFor(() => expect(m.importStatement).toHaveBeenCalledWith(expect.objectContaining({ accountId: "b1", fileName: "oct.csv", rows, mapping: preview().mapping, skipBadRows: false })));
    expect(m.previewImport).toHaveBeenCalledWith(expect.objectContaining({ accountId: "b1", rows }));
  });

  it("the first statement asks where it starts, with the opening balance read from the file", async () => {
    m.lines.mockResolvedValue(page([], {}));
    m.readFile.mockResolvedValue({ kind: "grid", fileName: "oct.csv", rows });
    m.previewImport.mockResolvedValue(preview({ setup: { exists: false, suggestedStart: "2026-10-02", suggestedOpening: 10000 } }));
    m.setupPreview.mockResolvedValue({ bookBalanceBefore: 10000, candidates: [], existing: null });
    m.importStatement.mockResolvedValue({ import: {}, imported: 9, duplicates: 0, skippedRows: 0 });
    const dialog = await pick();
    expect(await within(dialog).findByText("This is the first statement for this account")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Bank's balance the day before/)).toHaveValue("10000");
    expect(await within(dialog).findByText("The books show the same balance that day.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /import 9 lines/i }));
    await waitFor(() => expect(m.importStatement).toHaveBeenCalledWith(expect.objectContaining({ setup: { startDay: "2026-10-02", statementOpening: 10000 } })));
  });

  it("warns about a broken running balance, and an unreadable row blocks the import until skipping is chosen", async () => {
    m.lines.mockResolvedValue(page([], {}));
    m.readFile.mockResolvedValue({ kind: "grid", fileName: "oct.csv", rows });
    m.previewImport.mockResolvedValue(preview({ issueCount: 1, issues: [{ lineNo: 4, message: 'The date "31/02/2026" could not be read' }], continuity: { ok: false, checked: true, breaks: [{ lineNo: 5, expected: 100, found: 90 }] } }));
    const dialog = await pick();
    expect(await within(dialog).findByText(/running balance does not follow/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Row 4: The date "31\/02\/2026" could not be read/)).toBeInTheDocument();
    const go = within(dialog).getByRole("button", { name: /import 9 lines/i });
    expect(go).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText(/skip these rows/i));
    expect(go).toBeEnabled();
  });

  it("says when the file was imported before and nothing new would change", async () => {
    m.lines.mockResolvedValue(page([], {}));
    m.readFile.mockResolvedValue({ kind: "grid", fileName: "oct.csv", rows });
    m.previewImport.mockResolvedValue(preview({ counts: { total: 9, new: 0, duplicates: 9 }, fileDuplicate: true }));
    const dialog = await pick();
    expect(await within(dialog).findByText(/This exact file was imported before/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^import 0 lines$/i })).toBeDisabled();
  });
});
