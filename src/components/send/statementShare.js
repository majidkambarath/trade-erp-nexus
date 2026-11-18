// A customer's statement of account as the sheet the public page draws and the PDF is made from. Pure.
// The rows are the server's (utils/shareSnapshot.js statementSnapshot): `balance` is signed for the customer, positive = they owe us.
import { formatDate } from "../../utils/format";
import { companyBlock } from "../PurchaseOrder/shared/invoiceModel";
import { taxIdWord } from "../../lib/taxTerms";

export const buildStatementDocument = (payload) => {
  const s = payload.statement || {};
  const party = payload.party || {};
  const period = s.from && s.to ? `${formatDate(s.from)} to ${formatDate(s.to)}` : "";
  return {
    fileName: `Statement_${(party.customerName || "customer").replace(/[^A-Za-z0-9]+/g, "-")}_${s.from || ""}_${s.to || ""}`,
    sheet: {
      layout: "statement",
      title: "Statement of account",
      number: { label: "Period", value: period },
      company: companyBlock(payload.company || {}),
      trn: payload.company?.vatNumber ? `${taxIdWord()} ${payload.company.vatNumber}` : "",
      party: { name: party.customerName || "", code: party.customerId || "", address: party.billingAddress || "", trn: party.trnNumber || "" },
      period,
      currency: payload.currency,
      opening: s.opening ?? 0,
      closing: s.closing ?? 0,
      totals: s.totals || { debit: 0, credit: 0 },
      truncated: Boolean(s.truncated),
      rows: (s.rows || []).map((r) => ({
        date: formatDate(r.date), ref: r.voucherNo || "", type: r.voucherType || "", text: r.narration || "",
        debit: r.debit || 0, credit: r.credit || 0, balance: r.balance,
      })),
    },
  };
};
