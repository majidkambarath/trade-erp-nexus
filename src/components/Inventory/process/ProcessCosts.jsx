import React, { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { processOrders } from "../../../lib/processOrderApi";
import { costTotal, processErrorText } from "../../../lib/processOrders";
import { formatDate, formatNumber } from "../../../utils/format";
import { orgCurrency } from "../../../utils/orgLocale";
import { taxWord } from "../../../lib/taxTerms";
import { useOrganisation } from "../../shell/OrganisationContext";
import { useMasters } from "../productionShared";
import { ConfirmDialog, ErrorNote, Field, Modal, SearchSelect, Select, TextInput, useAsync } from "../../accounting/kit";

// Costs recorded on a process order while it runs (the coater's bill, labour, transport), each against a step if wanted
// and, for someone who may read vouchers, taken from the expense voucher that paid it: the server then refuses to move
// more of one bill than it has left, whichever orders take from it. Nothing posts here; Finish moves them into the product.

const money = (n) => formatNumber(n ?? 0, 2);

export function CostsSection({ order, onChanged }) {
  const { can } = useOrganisation();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const costs = order.costs || [];
  const manages = can("inventory.adjust");

  async function remove() {
    setBusy(true);
    setFailure(null);
    try {
      await processOrders.removeCost(order._id, removing._id);
      setRemoving(null);
      onChanged("Cost removed.");
    } catch (err) {
      setFailure(err);
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  if (!costs.length && !(order.actions?.addCost && manages)) return null;
  return (
    <section aria-labelledby="pro-view-costs">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id="pro-view-costs" className="text-sm font-semibold">Costs so far</h3>
        {order.actions?.addCost && manages && <Button size="sm" variant="outline" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" aria-hidden="true" />Add cost</Button>}
      </div>
      {failure && <div className="mb-2"><ErrorNote error={new Error(processErrorText(failure))} /></div>}
      {costs.length === 0 ? (
        <p className="text-sm text-muted-foreground">None yet. Record the coater's bill, labour or transport here as they come; Finish moves them into the product.</p>
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {costs.map((c) => (
            <li key={String(c._id)} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="min-w-0">
                <span className="font-medium">{c.accountName}</span>
                <span className="ms-2 text-xs text-muted-foreground">{[c.voucherNo, c.stepName, c.narration].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="whitespace-nowrap tabular-nums">{money(c.amount)}</span>
                {order.actions?.addCost && manages && (
                  <Button size="icon" variant="ghost" aria-label={`Remove ${c.accountName} ${money(c.amount)}`} onClick={() => setRemoving(c)}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                )}
              </span>
            </li>
          ))}
          <li className="flex justify-between gap-2 px-3 py-2 font-medium"><span>Total</span><span className="tabular-nums">{orgCurrency()} {money(costTotal(costs))}</span></li>
        </ul>
      )}
      {adding && <AddCostDialog order={order} onClose={() => setAdding(false)} onDone={(m) => { setAdding(false); onChanged(m); }} />}
      {removing && (
        <ConfirmDialog title="Remove this cost?" text={`${removing.accountName} ${money(removing.amount)} is taken off this order. Nothing was posted, so nothing is reversed.`} confirmLabel="Remove" danger busy={busy}
          onClose={() => setRemoving(null)} onConfirm={remove} />
      )}
    </section>
  );
}

export function AddCostDialog({ order, onClose, onDone }) {
  const masters = useMasters();
  const { can } = useOrganisation();
  const readsVouchers = can("finance.view");
  const [from, setFrom] = useState(readsVouchers ? "voucher" : "account");
  const [voucherId, setVoucherId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [stepId, setStepId] = useState("");
  const [narration, setNarration] = useState("");
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const vouchers = useAsync(() => (readsVouchers ? processOrders.expenseVouchers() : Promise.resolve([])), [readsVouchers]);
  const voucherOptions = useMemo(
    () => (vouchers.data || []).filter((v) => v.left > 0.005).map((v) => ({
      value: String(v.id), label: `${v.voucherNo} · ${v.accountName}`, hint: `${money(v.left)} left of ${money(v.net)}`,
      searchText: `${v.party} ${v.description} ${formatDate(v.date)}`,
    })),
    [vouchers.data]
  );
  const chosen = (vouchers.data || []).find((v) => String(v.id) === voucherId);
  const ready = from === "voucher" ? Boolean(voucherId) && (amount === "" || Number(amount) > 0) : Boolean(accountId) && Number(amount) > 0;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setFailure(null);
    try {
      const body = {
        ...(from === "voucher" ? { voucherId, ...(amount !== "" ? { amount: Number(amount) } : {}) } : { accountId, amount: Number(amount) }),
        ...(stepId ? { stepId } : {}), narration: narration.trim() || undefined,
      };
      const r = await processOrders.addCost(order._id, body);
      const added = r.costs[r.costs.length - 1];
      onDone(`${added.accountName} ${money(added.amount)} recorded on ${order.processNo}.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title="Add a cost"
      description={`Recorded on ${order.processNo}; moved into the product when it is finished. Without ${taxWord()}, which you claim back.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !ready}>{busy ? "Saving…" : "Add cost"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(processErrorText(failure))} />}
        {readsVouchers && (
          <Field label="Taken from">
            <Select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Taken from">
              <option value="voucher">An expense voucher already paid</option>
              <option value="account">An expense account (no voucher yet)</option>
            </Select>
          </Field>
        )}
        {from === "voucher" ? (
          <Field label="Expense voucher" required hint={chosen ? `${chosen.accountName} · ${money(chosen.left)} left to move${chosen.used ? ` (${money(chosen.used)} already in other orders)` : ""}` : "Approved expense vouchers with something left to move."}>
            <SearchSelect value={voucherId} onChange={setVoucherId} options={voucherOptions} loading={vouchers.loading} placeholder="Choose the voucher" aria-label="Expense voucher" noOptionsText="No expense voucher with anything left to move. Pay the bill under Finance > Expenses first." />
          </Field>
        ) : (
          <Field label="Expense" required>
            <SearchSelect value={accountId} onChange={setAccountId} options={masters.expenseOptions} loading={masters.loading} placeholder="e.g. Bending labour" aria-label="Expense" noOptionsText="Add the expense account under Accounts > Chart of accounts." />
          </Field>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Amount" required={from === "account"} hint={from === "voucher" ? "Leave empty for all that is left." : undefined}>
            <TextInput type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" placeholder={orgCurrency()} />
          </Field>
          <Field label="For the step">
            <Select value={stepId} onChange={(e) => setStepId(e.target.value)} aria-label="For the step">
              <option value="">The whole order</option>
              {(order.steps || []).map((s) => <option key={String(s._id)} value={String(s._id)}>{s.seq}. {s.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Note"><TextInput value={narration} maxLength={300} onChange={(e) => setNarration(e.target.value)} aria-label="Note" /></Field>
      </div>
    </Modal>
  );
}
