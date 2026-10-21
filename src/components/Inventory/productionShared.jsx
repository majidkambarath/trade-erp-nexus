import React, { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { accounting, api } from "../../lib/accountingApi";
import { accountOption } from "../../lib/voucherForms";
import { isService } from "../../lib/itemTypes";
import { Modal, useAsync } from "../accounting/kit";

// What the Production and Job work screens share: the goods items and expense accounts their pickers offer, and the
// dialog that asks for a tick before a production posts with a warning (COST_EXCEEDS_SPEND).

export function useMasters() {
  const stocks = useAsync(() => api.get("/stock/stock", { itemType: "goods" }), []);
  const chart = useAsync(() => accounting.postableAccounts(), []);
  return useMemo(() => {
    const items = (stocks.data?.stocks || []).filter((s) => !isService(s));
    return {
      loading: stocks.loading || chart.loading,
      items,
      itemOptions: items.map((s) => ({ value: s._id, label: s.itemName, hint: s.itemId, searchText: `${s.itemId} ${s.sku || ""}` })),
      expenseOptions: (chart.data || []).filter((a) => a.category === "EXPENSE").map(accountOption),
    };
  }, [stocks.data, stocks.loading, chart.data, chart.loading]);
}

export function WarningsDialog({ warnings, busy, onClose, onConfirm }) {
  const [ticked, setTicked] = useState(false);
  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="Check before posting"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => onConfirm([...new Set(warnings.map((w) => w.code))])} disabled={!ticked || busy}>{busy ? "Posting…" : "Post anyway"}</Button></>}
    >
      <ul className="mb-4 grid gap-2 text-sm">{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} className="mt-1" />
        <span>I understand, and want to post it as it is.</span>
      </label>
    </Modal>
  );
}
