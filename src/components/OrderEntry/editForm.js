// Opening a saved document for editing. The list screens keep a trimmed copy of each document, so
// editing reads the document itself; otherwise anything the list leaves out (a line discount, a tax
// code, a batch, a charge) would silently disappear the next time it was saved.

import axiosInstance from "../../axios/axios";
import { toInputDate } from "../../utils/format";
import { recalcRow } from "./variants";

export function formFromSaved(V, raw) {
  return {
    transactionNo: raw.transactionNo,
    partyId: raw.partyId?._id || raw.partyId,
    partyType: V.partyType,
    date: raw.date ? toInputDate(raw.date) : "",
    deliveryDate: raw.deliveryDate ? toInputDate(raw.deliveryDate) : "",
    status: raw.status,
    priority: raw.priority || "Medium",
    terms: raw.terms || "",
    notes: raw.notes || "",
    reason: raw.reason || "",
    vendorReference: raw.vendorReference || "",
    // the sales order stores its two reference numbers under short backend keys
    refNo: raw.lpono || "",
    docNo: raw.docno || "",
    discount: String(raw.discount ?? 0),
    charges: (raw.charges || []).map((c) => ({
      code: c.code,
      description: c.description || "",
      amount: String(c.amount ?? ""),
      vatPercent: String(c.vatPercent ?? 0),
    })),
    items: (raw.items || []).map((i) => recalcRow(V, V.rowFromSaved(i))),
  };
}

export async function loadFormForEdit(V, id) {
  const res = await axiosInstance.get(`/transactions/transactions/${id}`);
  return formFromSaved(V, res.data.data.transaction);
}
