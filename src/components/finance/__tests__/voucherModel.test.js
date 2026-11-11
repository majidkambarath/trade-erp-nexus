import { describe, it, expect, afterEach } from "vitest";
import {
  isPartyCopy, partyLabelFor, settledInvoiceRows, signaturesFor, voucherFileName, voucherSheet,
} from "../voucherModel";
import { resetOrgLocale, setOrgLocale } from "../../../utils/orgLocale";

// The printed voucher's rules, with nothing rendered: what reaches the paper is decided here, and
// `VoucherSheet.jsx` only draws it. The sheet itself is exercised end to end through the real
// print engine in PartyVouchersFx.test.jsx, which reads the frame's own markup.

afterEach(() => resetOrgLocale());

const PROFILE = {
  companyName: "Harbour Trading",
  addressLine1: "Deira",
  addressLine2: "Dubai",
  phoneNumber: "+97141234567",
  vatNumber: "100123456700003",
};

const RECEIPT = {
  voucherNo: "RV-2026-0001",
  voucherType: "receipt",
  status: "approved",
  date: "2026-10-08T00:00:00Z",
  partyName: "Al Noor Trading",
  totalAmount: 100,
  entries: [
    { accountName: "Cash in Hand", description: "Receipt from Al Noor", debitAmount: 100, creditAmount: 0 },
    { accountName: "Customer - Al Noor", debitAmount: 0, creditAmount: 100 },
  ],
};

const sheet = (v = {}, opts = {}) => voucherSheet({ ...RECEIPT, ...v }, { title: "Receipt voucher", profile: PROFILE, ...opts });

describe("who the voucher names", () => {
  it("names the side the money came from or went to, and stays neutral otherwise", () => {
    expect(partyLabelFor("receipt")).toBe("Received from");
    expect(partyLabelFor("payment")).toBe("Paid to");
    expect(partyLabelFor("journal")).toBe("Party");
    expect(partyLabelFor(undefined)).toBe("Party");
  });

  it("leaves the party block off a voucher that has no party", () => {
    expect(sheet().party).toEqual({
      heading: "Received from", name: "Al Noor Trading", address: "", taxId: "", email: "",
    });
    expect(sheet({ partyName: "" }).party).toBeNull();
  });

  // The server populates `partyId` with the few fields a printed voucher shows. The NAME still
  // comes from the voucher's own snapshot; the rest is read live off the master.
  it("prints the party's address, tax number and email from the populated master", () => {
    const p = sheet({
      partyId: {
        billingAddress: "M 5, West\nMusaffah, Abu Dhabi",
        trnNumber: "104144306800003",
        email: "sulaiman@alkhaleej.example",
        customerName: "A name the voucher was NOT written against",
      },
    }).party;
    expect(p.name).toBe("Al Noor Trading");
    expect(p.address).toBe("M 5, West\nMusaffah, Abu Dhabi");
    expect(p.taxId).toBe("104144306800003");
    expect(p.email).toBe("sulaiman@alkhaleej.example");
  });

  it("takes the tax number from vat.trn first, then the flat field either master spells it with", () => {
    expect(sheet({ partyId: { vat: { trn: "111" }, trnNumber: "222" } }).party.taxId).toBe("111");
    expect(sheet({ partyId: { trnNumber: "222" } }).party.taxId).toBe("222");
    expect(sheet({ partyId: { trnNO: "333" } }).party.taxId).toBe("333"); // a vendor
  });

  it("reads a vendor's address, which the master spells differently from a customer's", () => {
    expect(sheet({ voucherType: "payment", partyId: { address: "Al Quoz, Dubai" } }).party)
      .toMatchObject({ heading: "Paid to", address: "Al Quoz, Dubai" });
  });

  // On a list row `partyId` is a bare id string, not the populated record.
  it("does not fall over when the party was never populated", () => {
    expect(sheet({ partyId: "68f0c1a2b3c4d5e6f7a8b9c0" }).party)
      .toEqual({ heading: "Received from", name: "Al Noor Trading", address: "", taxId: "", email: "" });
  });
});

describe("the invoices it settled", () => {
  it("reads a populated invoice, and falls back to the id when the invoice is gone", () => {
    const rows = settledInvoiceRows({
      linkedInvoices: [
        { invoiceId: { _id: "i1", transactionNo: "SO-2026-0042", date: "2026-09-20" }, amount: 75, balance: 0 },
        { invoiceId: "64b7f1a2c3d4e5f60718293a", allocatedAmount: 25, newBalance: 10 },
      ],
    });
    expect(rows[0]).toEqual({ no: "SO-2026-0042", date: "2026-09-20", amount: 75, balance: 0 });
    // the older spelling of the same two fields still reads
    expect(rows[1]).toEqual({ no: "64b7f1a2c3d4e5f60718293a", date: null, amount: 25, balance: 10 });
  });

  it("never reports a missing figure as NaN, and says so plainly when there is no invoice at all", () => {
    const [row] = settledInvoiceRows({ linkedInvoices: [{}] });
    expect(row).toEqual({ no: "—", date: null, amount: 0, balance: 0 });
  });

  it("is empty for a voucher that settled nothing", () => {
    expect(settledInvoiceRows({})).toEqual([]);
    expect(settledInvoiceRows(undefined)).toEqual([]);
  });
});

describe("what it posted", () => {
  it("numbers the entries from one and totals each side", () => {
    const s = sheet();
    expect(s.entries.map((e) => e.no)).toEqual([1, 2]);
    expect(s.entries[1].description).toBe("");
    expect(s.totals).toEqual({ debit: 100, credit: 100 });
  });

  it("falls back to what it posted when no total was stored", () => {
    expect(sheet({ totalAmount: undefined }).amount).toBe(100);
    expect(sheet({ totalAmount: 0, entries: [] }).amount).toBe(0);
  });
});

describe("the document's own details", () => {
  it("leaves out a row the voucher has nothing for", () => {
    expect(sheet().meta).toEqual([["Date", "08/10/2026"]]);
  });

  it("says 'Payment method', because it names the account and not a person", () => {
    const s = sheet({ paymentMode: "cash", cashAccountName: "Cash in Hand", referenceNo: "QA-7587" });
    expect(s.meta.find(([k]) => k === "Payment method")).toBeTruthy();
    expect(s.meta.find(([k]) => k === "Received by")).toBeUndefined();
    expect(s.meta).toContainEqual(["Reference", "QA-7587"]);
  });

  it("names the invoices it settled, and stops listing them after three", () => {
    const linked = (n) => ({ invoiceId: { transactionNo: n }, amount: 10, balance: 0 });
    expect(sheet({ linkedInvoices: [linked("SO-1")] }).meta).toContainEqual(["Invoice ref", "SO-1"]);
    expect(sheet({ linkedInvoices: ["SO-1", "SO-2", "SO-3"].map(linked) }).meta)
      .toContainEqual(["Invoice ref", "SO-1, SO-2, SO-3"]);
    expect(sheet({ linkedInvoices: ["SO-1", "SO-2", "SO-3", "SO-4", "SO-5"].map(linked) }).meta)
      .toContainEqual(["Invoice ref", "SO-1, SO-2, SO-3 +2 more"]);
    // nothing allocated: no row at all, rather than an empty one
    expect(sheet().meta.find(([k]) => k === "Invoice ref")).toBeUndefined();
  });

  // The voucher read is .lean(), so the master's toJSON transform that fills `credit.days` from
  // the terms label never runs - the label has to be parsed here or the row is always missing.
  it("works the credit days out from the stored number, or from the terms label", () => {
    expect(sheet({ partyId: { credit: { days: 15 } } }).meta).toContainEqual(["Credit days", "15"]);
    expect(sheet({ partyId: { paymentTerms: "Net 30" } }).meta).toContainEqual(["Credit days", "30"]);
    expect(sheet({ partyId: { credit: { days: 15 }, paymentTerms: "Net 60" } }).meta)
      .toContainEqual(["Credit days", "15"]); // the stored figure wins over the label
  });

  it("prints no credit days for a party that pays at once", () => {
    for (const paymentTerms of ["Prepaid", "Cash on Delivery"]) {
      expect(sheet({ partyId: { paymentTerms } }).meta.find(([k]) => k === "Credit days")).toBeUndefined();
    }
    expect(sheet({ partyId: { credit: { days: 0 } } }).meta.find(([k]) => k === "Credit days")).toBeUndefined();
    expect(sheet().meta.find(([k]) => k === "Credit days")).toBeUndefined();
  });

  it("carries the exchange rate only when there is one", () => {
    expect(sheet().fx).toBeNull();
    const foreign = sheet({ currency: "USD", foreignAmount: 1000, exchangeRate: 3.6725, totalAmount: 3672.5 });
    expect(foreign.fx.line).toContain("USD 1,000.00 @ 3.6725");
  });
});

// The copy that leaves the building says what the money was FOR. The postings - "Dr Cheques in
// Hand / Cr Customer - Al Noor" - are the bookkeeper's view and stay on the copy we file.
describe("what the customer's copy says the money was for", () => {
  const linked = (no, amount, balance = 0) => ({ invoiceId: { transactionNo: no }, amount, balance });

  // Each row carries the balance left on its invoice, so this one table says everything the
  // separate "Against invoice" table says and the party's copy prints the figures once.
  it("writes a line per invoice settled, with what is left on it, in the voucher's own direction", () => {
    expect(sheet({ linkedInvoices: [linked("SO-1", 60, 714), linked("SO-2", 40, 476)] }).description).toEqual([
      { no: 1, text: "Being receipt against SO-1", amount: 60, balance: 714 },
      { no: 2, text: "Being receipt against SO-2", amount: 40, balance: 476 },
    ]);
    expect(sheet({ voucherType: "payment", linkedInvoices: [linked("PO-9", 100)] }).description)
      .toEqual([{ no: 1, text: "Being payment against PO-9", amount: 100, balance: 0 }]);
  });

  // null, not 0: nothing was set against an invoice, so there is no balance left behind, and
  // "0.00" in that column would read as "that invoice is now settled".
  it("adds what was taken on account, with no balance against it", () => {
    expect(sheet({ linkedInvoices: [linked("SO-1", 60, 714)], onAccountAmount: 40 }).description).toEqual([
      { no: 1, text: "Being receipt against SO-1", amount: 60, balance: 714 },
      { no: 2, text: "Being receipt on account", amount: 40, balance: null },
    ]);
  });

  // An expense, a journal, or a receipt entered before it was set against anything: the table
  // still needs a line, or the customer is handed a sheet with a total and no explanation.
  it("never leaves the table empty", () => {
    expect(sheet().description).toEqual([{ no: 1, text: "Being amount received", amount: 100, balance: null }]);
    expect(sheet({ voucherType: "payment" }).description)
      .toEqual([{ no: 1, text: "Being amount paid", amount: 100, balance: null }]);
    expect(sheet({ narration: "Advance for October" }).description)
      .toEqual([{ no: 1, text: "Advance for October", amount: 100, balance: null }]);
  });
});

describe("remarks, and which copy signs what", () => {
  // `notes` has been editable through the narration dialog and invisible on paper ever since it
  // existed. Both go under one heading, because a customer does not read "narration".
  it("prints narration and notes together", () => {
    expect(sheet({ narration: "RCVD CHEQUE DATED 09/11/2026" }).remarks).toBe("RCVD CHEQUE DATED 09/11/2026");
    expect(sheet({ narration: "Cheque received", notes: "Bank to confirm" }).remarks)
      .toBe("Cheque received\nBank to confirm");
    expect(sheet({ notes: "Bank to confirm" }).remarks).toBe("Bank to confirm");
    expect(sheet().remarks).toBe("");
    expect(sheet({ narration: "   " }).remarks).toBe("");
  });

  it("knows which copies leave the building", () => {
    expect(isPartyCopy("Customer copy")).toBe(true);
    expect(isPartyCopy("Payee copy")).toBe(true);
    expect(isPartyCopy("Office copy")).toBe(false);
    expect(isPartyCopy(undefined)).toBe(false);
  });

  // Asking a customer to witness "Approved by" on their own receipt is nonsense; what that copy
  // is FOR is their signature for the money and room for our stamp.
  it("signs the office copy for control and the party's copy for the money", () => {
    expect(signaturesFor("Office copy")).toEqual(["Prepared by", "Checked by", "Approved by"]);
    expect(signaturesFor(undefined)).toEqual(["Prepared by", "Checked by", "Approved by"]);
    expect(signaturesFor("Customer copy")).toEqual(["Received by", "Company stamp"]);
    expect(signaturesFor("Payee copy")).toEqual(["Received by", "Company stamp"]);
  });
});

describe("whether it is in the books", () => {
  it("stamps nothing on a posted voucher and says it is posted", () => {
    const s = sheet();
    expect(s.stamp).toBeNull();
    expect(s.notice).toContain("is posted to the ledger");
  });

  it("stamps one that never reached the books, and says it is not in them", () => {
    for (const status of ["pending", "draft", "rejected"]) {
      const s = sheet({ status });
      expect(s.stamp).toMatch(/not posted/i);
      expect(s.notice).toContain("has NOT been posted");
    }
  });

  // A cancelled voucher and a bounced cheque WERE posted and then reversed. Telling their reader
  // the voucher "becomes part of the books once it is approved" is a false statement on an
  // accounting document, which is what the two-branch version of this said.
  it("tells a reversed voucher apart from one that was never posted", () => {
    for (const status of ["cancelled", "bounced"]) {
      const s = sheet({ status });
      expect(s.stamp).toMatch(/reversed/i);
      expect(s.notice).toContain("has been reversed");
      expect(s.notice).not.toContain("has NOT been posted");
    }
  });

  it("treats a status it has never seen as not posted, rather than as posted", () => {
    expect(sheet({ status: "something-new" }).stamp).toBe("Not posted to the ledger");
  });
});

describe("the letterhead, the words and the file", () => {
  it("prints the organisation's own letterhead and invents nothing for an empty one", () => {
    expect(sheet().company).toMatchObject({ nameEn: "Harbour Trading", trn: "100123456700003" });
    expect(sheet().company.address).toEqual(["Deira", "Dubai"]);
    expect(voucherSheet(RECEIPT, { title: "Receipt voucher" }).company.nameEn).toBe("");
  });

  // The currency is a live binding that follows the organisation, never a hardcoded "AED": an
  // Indian organisation's voucher must read "Rupees", not "Dirhams".
  it("writes the amount in the organisation's own currency", () => {
    expect(sheet().words).toContain("Dirhams");
    setOrgLocale({ currency: "INR" });
    expect(sheet().words).toContain("Rupees");
  });

  it("keeps the title as it was written, because the sheet uppercases it in CSS", () => {
    expect(sheet().title).toBe("Receipt voucher");
  });

  it("offers the copies this kind of voucher is drawn as, opening on the one that is handed over", () => {
    expect(sheet().copies).toEqual(["Customer copy", "Office copy"]);
    expect(sheet().copy).toBe("Customer copy");
    expect(sheet({ voucherType: "payment" }).copies).toEqual(["Payee copy", "Office copy"]);
    expect(sheet({ voucherType: "journal" }).copies).toEqual(["Office copy"]);
  });

  it("names the file the way every other document is named", () => {
    expect(voucherFileName(RECEIPT, "Receipt voucher")).toBe("Receipt-voucher_RV-2026-0001");
    expect(voucherFileName({}, "Journal voucher")).toBe("Journal-voucher_draft");
  });
});
