import { describe, it, expect, afterEach } from "vitest";
import { partyLabelFor, settledInvoiceRows, voucherFileName, voucherSheet } from "../voucherModel";
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
    expect(sheet().party).toEqual({ heading: "Received from", name: "Al Noor Trading" });
    expect(sheet({ partyName: "" }).party).toBeNull();
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

  it("says 'Paid by' whatever the type, because it names the account and not a person", () => {
    const s = sheet({ paymentMode: "cash", cashAccountName: "Cash in Hand", referenceNo: "QA-7587" });
    expect(s.meta.find(([k]) => k === "Paid by")).toBeTruthy();
    expect(s.meta.find(([k]) => k === "Received by")).toBeUndefined();
    expect(s.meta).toContainEqual(["Reference", "QA-7587"]);
  });

  it("carries the exchange rate only when there is one", () => {
    expect(sheet().fx).toBeNull();
    const foreign = sheet({ currency: "USD", foreignAmount: 1000, exchangeRate: 3.6725, totalAmount: 3672.5 });
    expect(foreign.fx.line).toContain("USD 1,000.00 @ 3.6725");
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

  it("offers the copies this kind of voucher is drawn as, printing the first", () => {
    expect(sheet().copies).toEqual(["Office copy", "Customer copy"]);
    expect(sheet().copy).toBe("Office copy");
    expect(sheet({ voucherType: "journal" }).copies).toEqual(["Office copy"]);
  });

  it("names the file the way every other document is named", () => {
    expect(voucherFileName(RECEIPT, "Receipt voucher")).toBe("Receipt-voucher_RV-2026-0001");
    expect(voucherFileName({}, "Journal voucher")).toBe("Journal-voucher_draft");
  });
});
