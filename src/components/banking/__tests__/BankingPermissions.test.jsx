import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, configure } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// What each banking screen shows to a person whose role does not hold the action. The server refuses these requests whatever
// the screen shows (403 PERMISSION_DENIED); this file pins the screen's half: the button is not there, and what the person
// may still do (read the lists, the worklist, the proof and the history) is.
//
// Every "is not there" check follows a check that the screen has loaded AND that the grants are known: nothing is hidden
// while the grants are still on their way, so an absence asserted earlier would pass for the wrong reason.
//
//   banking.manage    create / edit banks, card types, cards
//   banking.reconcile set-up, import, match, accept, unmatch, ignore, post an entry, card settlement, finish, reopen
//   finance.approve   clear / bounce / cancel a cheque

const m = vi.hoisted(() => ({
  // reconciliation
  accounts: vi.fn(), setupStatus: vi.fn(), profile: vi.fn(), imports: vi.fn(), lines: vi.fn(), proof: vi.fn(), reconciliations: vi.fn(), unmatch: vi.fn(),
  cardAgeing: vi.fn(), cardVariance: vi.fn(),
  // masters, cheques, cash and bank
  banks: vi.fn(), cardTypes: vi.fn(), cards: vi.fn(), cheques: vi.fn(), options: vi.fn(),
  status: vi.fn(),
}));
vi.mock("../../../lib/bankReconcileApi", () => ({ reconcile: m }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: m.status }));
vi.mock("../../../lib/bankingApi", async (importOriginal) => ({ ...(await importOriginal()), banking: { banks: m.banks, cardTypes: m.cardTypes, cards: m.cards, cheques: m.cheques, options: m.options } }));

import { OrganisationProvider, useOrganisation } from "../../shell/OrganisationContext";
import BankReconciliation from "../BankReconciliation";
import BankMaster from "../BankMaster";
import CardTypeMaster from "../CardTypeMaster";
import CardMaster from "../CardMaster";
import ChequeRegister from "../ChequeRegister";
import CashAndBank from "../CashAndBank";

configure({ asyncUtilTimeout: 8000 });
vi.setConfig({ testTimeout: 20000 });

// ---- the person and the screen -----------------------------------------------------------------
let grants;
const statusFor = (g) => ({
  organisation: { legalName: "Harbour Trading" }, subscription: { state: "active", blocked: false }, features: { banking: true, reconciliation: true },
  me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants: g },
});

// Rendered only once the organisation status has answered, i.e. once `can()` really knows what the person holds.
function GrantsKnown() {
  const { me } = useOrganisation();
  return me ? <span data-testid="grants-known" /> : null;
}

const renderAs = async (held, ui, url = "/") => {
  grants = held;
  m.status.mockImplementation(() => Promise.resolve(statusFor(grants)));
  const view = render(<MemoryRouter initialEntries={[url]}><OrganisationProvider><GrantsKnown />{ui}</OrganisationProvider></MemoryRouter>);
  await screen.findByTestId("grants-known");
  return view;
};

const VIEW = ["banking.view", "lookups.view"];
const RECONCILE = [...VIEW, "banking.reconcile"];
const MANAGE = [...VIEW, "banking.manage"];

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- bank, card type and card masters ---------------------------------------------------------------
describe("the masters (banking.manage)", () => {
  const masters = [
    { name: "bank", ui: () => <BankMaster />, load: () => m.banks.mockResolvedValue([{ _id: "k1", bankName: "Emirates NBD", bankCode: "ENBD", swiftCode: "EBILAEAD", country: "AE", city: "Dubai", branches: [], isActive: true }]), row: "Emirates NBD", add: /^new bank$/i, edit: /^edit emirates nbd$/i, empty: () => m.banks.mockResolvedValue([]), emptyTitle: "No banks yet", emptyText: "None have been added yet.", emptyManageText: "Add the first one with New bank." },
    { name: "card type", ui: () => <CardTypeMaster />, load: () => m.cardTypes.mockResolvedValue([{ _id: "t1", name: "Visa", description: "Visa credit and debit", feePercent: 2, isActive: true }]), row: "Visa", add: /^new card type$/i, edit: /^edit visa$/i, empty: () => m.cardTypes.mockResolvedValue([]), emptyTitle: "No card types yet", emptyText: "None have been added yet.", emptyManageText: "Add Visa, Mastercard and the others you accept." },
    { name: "card", ui: () => <CardMaster />, load: () => m.cards.mockResolvedValue([{ _id: "c1", label: "POS 1", kind: "terminal", cardTypeName: "Visa", accountName: "Recon Bank", accountCode: "BANK0001", effectiveFeePercent: 2, last4: "", isActive: true }]), row: "POS 1", add: /^new card$/i, edit: /^edit pos 1$/i, empty: () => m.cards.mockResolvedValue([]), emptyTitle: "No cards yet", emptyText: "None have been set up yet.", emptyManageText: "Add a merchant terminal to take card payments, or your company card to pay with." },
  ];

  for (const x of masters) {
    it(`a person who may only look still sees the ${x.name} list, with no way to add or edit`, async () => {
      x.load();
      await renderAs(VIEW, x.ui());
      expect(await screen.findByText(x.row)).toBeInTheDocument(); // the list has loaded
      expect(screen.queryByRole("button", { name: x.add })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: x.edit })).not.toBeInTheDocument();
    });

    it(`a person who holds banking.manage can add and edit a ${x.name}`, async () => {
      x.load();
      await renderAs(MANAGE, x.ui());
      expect(await screen.findByText(x.row)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: x.add })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: x.edit })).toBeInTheDocument();
    });

    it(`an empty ${x.name} list does not tell a read-only person to press a button they do not have`, async () => {
      x.empty();
      await renderAs(VIEW, x.ui());
      expect(await screen.findByText(x.emptyTitle)).toBeInTheDocument();
      expect(screen.getByText(x.emptyText)).toBeInTheDocument();
      expect(screen.queryByText(x.emptyManageText)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: x.add })).not.toBeInTheDocument();
    });

    it(`an empty ${x.name} list still invites someone who holds banking.manage to add the first`, async () => {
      x.empty();
      await renderAs(MANAGE, x.ui());
      expect(await screen.findByText(x.emptyManageText)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: x.add })).toBeInTheDocument();
    });
  }
});

// ---- the cheque register ----------------------------------------------------------------------------
describe("the cheque register (finance.approve)", () => {
  const cheque = (over) => ({ _id: "q1", chequeNo: "000111", direction: "receipt", voucherNo: "RV-2026-0001", voucherId: "v1", chequeDate: "2026-10-01T00:00:00.000Z", partyName: "Al Noor", drawnOnBankName: "ENBD", bankAccountName: "Recon Bank", amount: 500, status: "pending", matured: true, ...over });
  const register = () => ({ summary: { receivable: { amount: 500, count: 1 }, payable: { amount: 0, count: 0 } }, total: 2, rows: [cheque(), cheque({ _id: "q2", chequeNo: "000222", voucherNo: "RV-2026-0002", status: "cleared" })] });
  const act = (name) => screen.queryAllByRole("button", { name });

  it("shows the register, with the audit trail, but no way to clear, bounce, return or cancel a cheque", async () => {
    m.cheques.mockResolvedValue(register());
    await renderAs([...VIEW, "finance.view"], <ChequeRegister />);
    expect(await screen.findByText("000111")).toBeInTheDocument();
    expect(screen.getByText("000222")).toBeInTheDocument();
    expect(act(/audit trail/i).length).toBe(2); // the row's actions are not an empty cell: reading the trail is a read
    expect(act(/^clear$/i)).toHaveLength(0);
    expect(act(/^bounced$/i)).toHaveLength(0);
    expect(act(/^cancel$/i)).toHaveLength(0);
    expect(act(/^returned$/i)).toHaveLength(0);
  });

  it("a person who holds banking.manage but not finance.approve is still refused the cheque actions", async () => {
    m.cheques.mockResolvedValue(register());
    await renderAs(MANAGE, <ChequeRegister />);
    expect(await screen.findByText("000111")).toBeInTheDocument();
    expect(act(/^clear$/i)).toHaveLength(0);
    expect(act(/^bounced$/i)).toHaveLength(0);
  });

  it("a person who holds finance.approve gets Clear, Bounced and Cancel on a pending cheque and Returned on a cleared one", async () => {
    m.cheques.mockResolvedValue(register());
    await renderAs([...VIEW, "finance.view", "finance.approve"], <ChequeRegister />);
    expect(await screen.findByText("000111")).toBeInTheDocument();
    expect(act(/^clear$/i)).toHaveLength(1);
    expect(act(/^bounced$/i)).toHaveLength(1);
    expect(act(/^cancel$/i)).toHaveLength(1);
    expect(act(/^returned$/i)).toHaveLength(1);
    expect(act(/audit trail/i).length).toBe(2);
  });
});

// ---- cash and bank ----------------------------------------------------------------------------------
describe("cash and bank (shortcuts to other screens)", () => {
  const load = () => {
    m.options.mockResolvedValue({ cashAccounts: [{ _id: "c1", accountName: "Cash in Hand", accountCode: "CASH0001", balance: 100 }], bankAccounts: [{ _id: "b1", accountName: "Recon Bank", accountCode: "BANK0001", balance: 500, bank: { bankName: "ENBD" } }] });
    m.cheques.mockResolvedValue({ summary: { receivable: { amount: 0, count: 0 }, payable: { amount: 0, count: 0 } }, total: 0, rows: [] });
  };

  it("does not offer adding an account, moving money or reconciling to someone whose role holds none of them", async () => {
    load();
    await renderAs(["accounts.view"], <CashAndBank />);
    expect(await screen.findByText("Recon Bank")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /add an account/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /move money/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /cheque register/i })).not.toBeInTheDocument(); // the register needs banking.view or finance.view
    expect(screen.queryByRole("link", { name: /^reconcile recon bank$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ledger of recon bank/i })).toBeInTheDocument(); // reading the ledger is still there
  });

  it("offers each shortcut to the role that holds what it leads to", async () => {
    load();
    await renderAs(["accounts.view", "accounts.manage", "finance.view", "finance.create", "banking.view"], <CashAndBank />);
    expect(await screen.findByText("Recon Bank")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /add an account/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /move money/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cheque register/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^reconcile recon bank$/i })).toBeInTheDocument();
  });
});

// ---- bank reconciliation ----------------------------------------------------------------------------
const ACCOUNTS = [
  { _id: "b1", accountName: "Recon Bank", accountCode: "BANK0001", bank: { bankName: "ENBD", accountNumberMasked: "•••• 4567" }, bookBalance: 1433.9, setUp: true, counts: { open: 3, matched: 2, reconciled: 0, ignored: 0 }, lastLineDay: "2026-10-06", lastReconciled: null },
  { _id: "b2", accountName: "Savings Bank", accountCode: "BANK0002", bank: null, bookBalance: 0, setUp: false, counts: { open: 0, matched: 0, reconciled: 0, ignored: 0 }, lastLineDay: null, lastReconciled: null },
];
const line = (over) => ({ _id: "l1", importId: "i1", lineNo: 3, day: "2026-10-02", valueDay: null, description: "TRANSFER FROM AL NOOR TRF-9001", reference: "", chequeNo: "", amount: 1050, balance: 11050, state: "open", matchId: null, reconciliationId: null, ignoredReason: "", suggestion: null, match: null, ...over });
const entry = { id: "e1", type: "ledger", ledgerEntryId: "le1", chequeId: null, voucherId: "v1", voucherNo: "RV-2026-0001", voucherType: "receipt", day: "2026-10-02", amount: 1050, narration: "", party: "Al Noor", reference: "TRF-9001", chequeNo: "", card: null, pending: false };
const suggestion = { confidence: "high", score: 100, reasons: ["same amount", "same day"], kind: "one", entries: [entry] };
const matchedLine = line({ _id: "l3", state: "matched", description: "MATCHED LINE", matchId: "m1", match: { _id: "m1", kind: "match", method: "auto", reconciliationId: null, lineCount: 1, entries: [{ voucherNo: "RV-2026-0001", voucherType: "receipt", day: "2026-10-02", amount: 1050, narration: "" }], createdVouchers: [] } });
const lockedLine = line({ _id: "l4", state: "reconciled", description: "LOCKED LINE", reconciliationId: "r1", matchId: "m2", match: { _id: "m2", kind: "match", method: "auto", reconciliationId: "r1", lineCount: 1, entries: [], createdVouchers: [] } });
const ignoredLine = line({ _id: "l5", state: "ignored", description: "IGNORED LINE", amount: -15, ignoredReason: "Duplicate" });
const ROWS = {
  suggested: [line({ suggestion }), line({ _id: "l2", description: "BIG DEPOSIT NETWORK", amount: 500 })],
  matched: [matchedLine, lockedLine],
  ignored: [ignoredLine],
};
const counts = { todo: 1, suggested: 1, matched: 2, reconciled: 1, ignored: 1, all: 5 };
const proof = { asOf: "2026-10-06", statementBalance: 1341.9, bookBalance: 1433.9, depositsInTransit: { total: 0, items: [] }, outstandingPayments: { total: 0, items: [] }, bankItemsNotInBooks: { total: 0, items: [] }, ignored: { total: 0, items: [] }, adjustedBank: 1341.9, adjustedBook: 1341.9, difference: 0, openLines: 0, blockers: [], canFinish: true, openingDifference: 0, unclearedCheques: { items: [], count: 0, total: 0 } };

const reconciliationPage = () => <BankReconciliation />;
const cardOf = async (re) => (await screen.findByText(re, { selector: "p" })).closest("article");
const names = (root) => within(root).queryAllByRole("button").map((b) => b.textContent.trim());

describe("bank reconciliation (banking.reconcile)", () => {
  beforeEach(() => {
    m.accounts.mockResolvedValue(ACCOUNTS);
    m.setupStatus.mockResolvedValue({ startDay: "2026-09-01", statementOpening: 1000, outstandingCount: 0, outstandingTotal: 0, bookBalanceBefore: 1000, difference: 0 });
    m.lines.mockImplementation(({ tab }) => Promise.resolve({ account: { _id: "b1", accountName: "Recon Bank" }, needsSetup: false, rows: ROWS[tab] || [], total: (ROWS[tab] || []).length, page: 1, pages: 1, counts }));
    m.imports.mockResolvedValue([{ _id: "i1", status: "active", periodFrom: "2026-10-01", periodTo: "2026-10-06", closingBalance: 1341.9, lineCount: 10 }]);
    m.proof.mockResolvedValue(proof);
    m.profile.mockResolvedValue(null);
    m.reconciliations.mockResolvedValue([
      { _id: "r2", number: "BRC-2026-0002", asOf: "2026-10-31", statementBalance: 5000, lineCount: 12, status: "completed" },
      { _id: "r1", number: "BRC-2026-0001", asOf: "2026-09-30", statementBalance: 4000, lineCount: 9, status: "completed" },
    ]);
    m.cardAgeing.mockResolvedValue({ buckets: [], total: 0, count: 0, items: [], asOf: "2026-10-06" });
    m.cardVariance.mockResolvedValue({ summary: { settlements: 0, gross: 0, feeBooked: 0, extraCommission: 0, vat: 0, received: 0, bookedRate: 0, effectiveRate: 0 }, months: [], cards: [], settlements: [] });
  });

  describe("a person who may only look (banking.view)", () => {
    it("reads the worklist and the proof, with no header actions, no bulk accept and no buttons on a line", async () => {
      await renderAs(VIEW, reconciliationPage());
      const suggested = await cardOf(/TRANSFER FROM AL NOOR/);
      expect(within(suggested).getByText("Strong match")).toBeInTheDocument(); // the suggestion is information, so it stays
      expect(within(suggested).getByText("RV-2026-0001")).toBeInTheDocument();
      expect(await screen.findByRole("button", { name: /see the full statement/i })).toBeInTheDocument(); // the proof has loaded

      expect(screen.queryByRole("button", { name: /^import a statement$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^set up$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /accept all strong matches/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /finish reconciliation/i })).not.toBeInTheDocument();
      expect(names(suggested)).toEqual([]); // not Match, Find, Post an entry, Ignore

      const deposit = await cardOf(/BIG DEPOSIT NETWORK/);
      expect(names(deposit)).toEqual([]); // not Card settlement either
      // and no empty bordered frame is left where the buttons were
      for (const card of [suggested, deposit]) expect([...card.children].every((c) => c.textContent.trim() !== "")).toBe(true);
    });

    it("says so, in one sentence, instead of leaving the person to wonder where the buttons went", async () => {
      await renderAs(VIEW, reconciliationPage());
      await cardOf(/TRANSFER FROM AL NOOR/);
      expect(screen.getByText(/you can look at the statement lines, the proof and the history, but not change them/i)).toBeInTheDocument();
    });

    it("does not offer Unmatch on a matched line or Put back on an ignored one, and still shows a locked line as locked", async () => {
      await renderAs(VIEW, reconciliationPage());
      await cardOf(/TRANSFER FROM AL NOOR/);
      fireEvent.click(screen.getByRole("tab", { name: /^matched/i }));
      const matched = await cardOf(/MATCHED LINE/);
      const locked = await cardOf(/LOCKED LINE/);
      expect(within(locked).getByText("Locked in a completed reconciliation")).toBeInTheDocument();
      expect(names(matched)).toEqual([]);
      expect(screen.queryByRole("button", { name: /unmatch/i })).not.toBeInTheDocument();
      expect([...matched.children].every((c) => c.textContent.trim() !== "")).toBe(true);

      fireEvent.click(screen.getByRole("tab", { name: /^ignored/i }));
      const ignored = await cardOf(/IGNORED LINE/);
      expect(within(ignored).getByText(/Left out: Duplicate/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /put back/i })).not.toBeInTheDocument();
      expect([...ignored.children].every((c) => c.textContent.trim() !== "")).toBe(true);
    });

    it("sees the history and every statement, but cannot reopen the latest reconciliation", async () => {
      await renderAs(VIEW, reconciliationPage(), "/bank-reconciliation?view=history");
      expect(await screen.findByText("BRC-2026-0002")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /^statement$/i })).toHaveLength(2);
      expect(screen.queryByRole("button", { name: /reopen/i })).not.toBeInTheDocument();
    });

    it("does not tell someone to fix the starting balance in a Set up they cannot open", async () => {
      m.setupStatus.mockResolvedValue({ startDay: "2026-09-01", statementOpening: 900, outstandingCount: 0, outstandingTotal: 0, bookBalanceBefore: 1000, difference: 100 });
      await renderAs(VIEW, reconciliationPage());
      expect(await screen.findByText(/starting balance for this account is out by 100.00/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /fix it in set up/i })).not.toBeInTheDocument();
    });

    it("an account nobody has imported a statement for says that, and offers no import", async () => {
      await renderAs(VIEW, reconciliationPage(), "/bank-reconciliation?account=b2");
      expect(await screen.findByText("Not reconciled yet")).toBeInTheDocument();
      expect(screen.queryByText("Start with a bank statement")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /import a statement/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /set up first/i })).not.toBeInTheDocument();
    });

    it("an account with no bank account at all points to the chart of accounts only for someone who can add one", async () => {
      m.accounts.mockResolvedValue([]);
      const view = await renderAs(VIEW, reconciliationPage());
      expect(await screen.findByText("No bank accounts yet")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /open the chart of accounts/i })).not.toBeInTheDocument();
      view.unmount();

      await renderAs([...VIEW, "accounts.manage"], reconciliationPage());
      expect(await screen.findByText("No bank accounts yet")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /open the chart of accounts/i })).toBeInTheDocument();
    });

    it("a statement with no lines does not offer the import from the empty state", async () => {
      m.lines.mockResolvedValue({ account: { _id: "b1" }, needsSetup: false, rows: [], total: 0, page: 1, pages: 1, counts: { todo: 0, suggested: 0, matched: 0, reconciled: 0, ignored: 0, all: 0 } });
      await renderAs(VIEW, reconciliationPage());
      expect(await screen.findByText("No lines yet")).toBeInTheDocument();
      expect(screen.getByText("No statement lines have been imported yet.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /import a statement/i })).not.toBeInTheDocument();
    });
  });

  describe("a person who holds banking.reconcile", () => {
    it("has the header actions, the bulk accept, every button on a line and the finish button", async () => {
      await renderAs(RECONCILE, reconciliationPage());
      const suggested = await cardOf(/TRANSFER FROM AL NOOR/);
      await screen.findByRole("button", { name: /see the full statement/i });
      expect(screen.getByRole("button", { name: /^import a statement$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^set up$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /accept all strong matches/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /finish reconciliation/i })).toBeInTheDocument();
      expect(names(suggested)).toEqual(["Match", "Find another", "Post an entry", "Card settlement", "Ignore"]);
      const deposit = await cardOf(/BIG DEPOSIT NETWORK/);
      expect(names(deposit)).toEqual(["Find in the books", "Post an entry", "Card settlement", "Ignore"]);
      expect(screen.queryByText(/you can look at the statement lines/i)).not.toBeInTheDocument();
    });

    it("has Unmatch on a matched line, nothing on a locked one, and Put back on an ignored one", async () => {
      await renderAs(RECONCILE, reconciliationPage());
      await cardOf(/TRANSFER FROM AL NOOR/);
      fireEvent.click(screen.getByRole("tab", { name: /^matched/i }));
      const matched = await cardOf(/MATCHED LINE/);
      const locked = await cardOf(/LOCKED LINE/);
      expect(names(matched)).toEqual(["Unmatch"]);
      expect(names(locked)).toEqual([]);
      expect(within(locked).getByText("Locked in a completed reconciliation")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("tab", { name: /^ignored/i }));
      expect(names(await cardOf(/IGNORED LINE/))).toEqual(["Put back"]);
    });

    it("can reopen the latest reconciliation, and only that one", async () => {
      await renderAs(RECONCILE, reconciliationPage(), "/bank-reconciliation?view=history");
      expect(await screen.findByText("BRC-2026-0002")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /reopen/i })).toHaveLength(1);
    });

    it("an account nobody has imported a statement for offers the import and the set-up", async () => {
      await renderAs(RECONCILE, reconciliationPage(), "/bank-reconciliation?account=b2");
      expect(await screen.findByText("Start with a bank statement")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: /import a statement/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /set up first/i })).toBeInTheDocument();
    });

    it("is told about a starting balance that is out, with the way to fix it", async () => {
      m.setupStatus.mockResolvedValue({ startDay: "2026-09-01", statementOpening: 900, outstandingCount: 0, outstandingTotal: 0, bookBalanceBefore: 1000, difference: 100 });
      await renderAs(RECONCILE, reconciliationPage());
      expect(await screen.findByText(/starting balance for this account is out by 100.00/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /fix it in set up/i })).toBeInTheDocument();
    });

    // "Also delete the entries" deletes the approved vouchers posted for the match, which reverses them: the server asks for
    // finance.deletePosted (the same right as deleting one by hand) and refuses the whole request otherwise.
    describe("Unmatch with an entry posted for the line", () => {
      const posted = line({ _id: "l7", state: "matched", description: "BANK CHARGES INCL VAT", amount: -21, matchId: "m7", match: { _id: "m7", kind: "created", method: "created", reconciliationId: null, lineCount: 1, entries: [{ voucherNo: "EV-2026-0001", voucherType: "expense", day: "2026-10-02", amount: -21, narration: "" }], createdVouchers: [{ voucherId: "v7", voucherNo: "EV-2026-0001", kind: "fee" }] } });
      const openUnmatch = async (held) => {
        m.lines.mockImplementation(({ tab }) => Promise.resolve({ account: { _id: "b1", accountName: "Recon Bank" }, needsSetup: false, rows: tab === "matched" ? [posted] : [], total: tab === "matched" ? 1 : 0, page: 1, pages: 1, counts }));
        m.unmatch.mockResolvedValue({ match: {}, warnings: [] });
        await renderAs(held, reconciliationPage());
        fireEvent.click(await screen.findByRole("tab", { name: /^matched/i }));
        const card = await cardOf(/BANK CHARGES/);
        fireEvent.click(within(card).getByRole("button", { name: /unmatch/i }));
        return screen.findByRole("dialog");
      };

      it("without finance.deletePosted the dialog unmatches only, with no tick-box to delete the entry", async () => {
        const dialog = await openUnmatch([...RECONCILE, "finance.view", "finance.delete"]); // plain Delete is not enough
        expect(within(dialog).getByRole("button", { name: /^unmatch$/i })).toBeInTheDocument(); // the dialog is up
        expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
        expect(within(dialog).queryByText(/also delete/i)).not.toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: /^unmatch$/i }));
        await waitFor(() => expect(m.unmatch).toHaveBeenCalledWith("m7", false));
      });

      it("with finance.deletePosted the tick-box is there and the choice is sent", async () => {
        const dialog = await openUnmatch([...RECONCILE, "finance.view", "finance.delete", "finance.deletePosted"]);
        fireEvent.click(within(dialog).getByLabelText(/Also delete the EV-2026-0001/));
        fireEvent.click(within(dialog).getByRole("button", { name: /^unmatch$/i }));
        await waitFor(() => expect(m.unmatch).toHaveBeenCalledWith("m7", true));
      });
    });
  });

  it("a role that holds banking.manage but not banking.reconcile can maintain the masters and still cannot reconcile", async () => {
    await renderAs(MANAGE, reconciliationPage());
    const suggested = await cardOf(/TRANSFER FROM AL NOOR/);
    await waitFor(() => expect(screen.getByRole("button", { name: /see the full statement/i })).toBeInTheDocument());
    expect(names(suggested)).toEqual([]);
    expect(screen.queryByRole("button", { name: /finish reconciliation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^import a statement$/i })).not.toBeInTheDocument();
  });
});
