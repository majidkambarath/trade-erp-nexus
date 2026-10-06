import React, { useMemo, useState } from "react";
import axiosInstance from "../../../axios/axios";
import { Field, SearchSelect, Spinner, useAsync } from "../../accounting/kit";
import { ActionModal, Note } from "../../salesDocs/parts";
import { useBankingOptions, useChartAccounts } from "../../finance/shared";
import { accounting } from "../../../lib/accountingApi";
import { reconcile } from "../../../lib/bankReconcileApi";
import { postingKinds, splitGross } from "../../../lib/bankReconcile";
import { cn } from "../../../lib/utils";
import { formatNumber } from "../../../utils/format";
import { Amount, Day } from "./parts";
import { useAction } from "./helpers";

// Posts the entry a statement line needs and matches it, in one step: a bank fee with its VAT,
// interest, a transfer between our own accounts, a customer receipt or vendor payment nobody booked,
// or anything else to an account of the person's choice. The entry goes through the ordinary voucher
// code, so the VAT return, the ledger and the audit trail see it like any other.

const EXPENSE = { categories: ["EXPENSE"] };
const INCOME = { categories: ["INCOME"] };

export default function CreateEntryDialog({ accountId, line, onClose, onDone }) {
  const kinds = postingKinds(line.amount);
  const [kind, setKind] = useState(kinds[0].value);
  const [postTo, setPostTo] = useState("");
  const [other, setOther] = useState("");
  const [party, setParty] = useState("");
  const [vat, setVat] = useState(true);
  const [allocate, setAllocate] = useState("oldest");
  const gross = Math.abs(line.amount);

  const expense = useChartAccounts(EXPENSE);
  const income = useChartAccounts(INCOME);
  const everything = useChartAccounts();
  const banking = useBankingOptions();
  const tax = useAsync(() => (kind === "fee" ? accounting.taxCodes() : Promise.resolve(null)), [kind]);
  const parties = useAsync(
    () => (kind === "receipt" || kind === "payment" ? axiosInstance.get(kind === "payment" ? "/vendors/vendors" : "/customers/customers").then((r) => r.data?.data || []) : Promise.resolve(null)),
    [kind]
  );
  const allocation = useAsync(
    () => (party && allocate === "oldest" && (kind === "receipt" || kind === "payment") ? reconcile.allocation(line._id, { accountId, partyId: party, kind }) : Promise.resolve(null)),
    [party, allocate, kind, line._id, accountId]
  );

  const accounts = banking.data ? [...(banking.data.cashAccounts || []), ...(banking.data.bankAccounts || [])].filter((a) => String(a._id) !== String(accountId)) : [];
  const partyOptions = useMemo(() => (parties.data || []).map((p) => ({ value: p._id, label: p.customerName || p.vendorName || p.name, hint: p.customerId || p.vendorId })), [parties.data]);
  const rate = (tax.data || []).find((t) => t.isDefault && t.isActive !== false && t.kind === "standard")?.ratePercent ?? 5;
  const split = kind === "fee" && vat ? splitGross(gross, rate) : null;

  const ready = {
    fee: true, interest: true, transfer: Boolean(other), receipt: Boolean(party), payment: Boolean(party), journal: Boolean(postTo),
  }[kind];
  const body = { accountId, kind };
  if (kind === "fee") { if (postTo) body.postToAccountId = postTo; body.vat = vat; }
  if (kind === "interest" && postTo) body.postToAccountId = postTo;
  if (kind === "journal") body.postToAccountId = postTo;
  if (kind === "transfer") body.otherAccountId = other;
  if (kind === "receipt" || kind === "payment") { body.partyId = party; body.allocate = allocate; }
  const { busy, problem, go } = useAction(() => reconcile.createFromLine(line._id, body), (m, out) => onDone(`${out.voucher.voucherNo} posted and matched`, out), "");

  const selected = kinds.find((k) => k.value === kind);
  return (
    <ActionModal
      size="lg" title="Post an entry for this line" confirmLabel="Post and match" busy={busy} disabled={!ready} problem={problem} onClose={onClose} onConfirm={go}
      description="The books have nothing for this line. Say what it is; the entry is posted dated the day of the line, and matched to it."
    >
      <div className="rounded-lg border border-border bg-secondary/50 p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs text-muted-foreground"><Day value={line.day} /></p><p className="break-words font-medium">{line.description}</p></div>
          <Amount value={line.amount} className="text-base" />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">What is it?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {kinds.map((k) => (
            <label key={k.value} className={cn("flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm", kind === k.value ? "border-primary bg-primary/5" : "border-border")}>
              <input type="radio" name="kind" className="mt-1" checked={kind === k.value} onChange={() => { setKind(k.value); setPostTo(""); }} />
              <span><span className="block font-medium">{k.label}</span><span className="block text-xs text-muted-foreground">{k.help}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      {kind === "fee" && (
        <>
          <Field label="Charge it to" hint="Leave empty for the bank charges account in your posting accounts.">
            <SearchSelect aria-label="Expense account" value={postTo} onChange={setPostTo} options={expense.options} placeholder="Bank charges (default)" clearable loading={expense.loading} />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={vat} onChange={(e) => setVat(e.target.checked)} />The amount includes VAT ({rate}%)</label>
          {split && (
            <p className="rounded-lg border border-border px-3 py-2 text-sm" aria-live="polite">
              {formatNumber(gross, 2)} = {formatNumber(split.net, 2)} charge + {formatNumber(split.vat, 2)} VAT
              {!split.exact && <span className="block text-xs text-muted-foreground">The VAT is a fils away from {rate}% of the charge, because the bank's figure fixes the total.</span>}
            </p>
          )}
        </>
      )}

      {kind === "interest" && (
        <Field label="Credit it to" hint="Leave empty for the bank interest income account. Interest carries no VAT.">
          <SearchSelect aria-label="Income account" value={postTo} onChange={setPostTo} options={income.options} placeholder="Bank interest income (default)" clearable loading={income.loading} />
        </Field>
      )}

      {kind === "transfer" && (
        <Field label={line.amount < 0 ? "Moved to" : "Moved from"} required hint="One of your own cash or bank accounts. The other side matches its own statement line.">
          <SearchSelect aria-label="Other account" value={other} onChange={setOther} options={accounts.map((a) => ({ value: a._id, label: a.accountName, hint: a.accountCode }))} placeholder="Choose the account" loading={banking.loading} />
        </Field>
      )}

      {(kind === "receipt" || kind === "payment") && (
        <>
          <Field label={kind === "receipt" ? "Customer" : "Vendor"} required>
            <SearchSelect aria-label={kind === "receipt" ? "Customer" : "Vendor"} value={party} onChange={setParty} options={partyOptions} placeholder="Choose" loading={parties.loading} />
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Against which invoices?</legend>
            <label className="me-4 inline-flex items-center gap-2 text-sm"><input type="radio" name="alloc" checked={allocate === "oldest"} onChange={() => setAllocate("oldest")} />Oldest first</label>
            <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="alloc" checked={allocate === "none"} onChange={() => setAllocate("none")} />Keep it on account</label>
          </fieldset>
          {allocation.loading && <Spinner label="Looking at open invoices" />}
          {allocation.data && (
            <div className="rounded-lg border border-border p-3 text-sm" aria-live="polite">
              {allocation.data.invoices.length === 0 && <p className="text-muted-foreground">No open invoices, so the whole {formatNumber(gross, 2)} is kept on account.</p>}
              {allocation.data.invoices.map((i) => (
                <p key={i.invoiceId} className="flex justify-between gap-3"><span><span className="font-mono text-xs font-semibold">{i.transactionNo}</span> <span className="text-muted-foreground"><Day value={i.date} /></span></span><span className="tabular-nums">{formatNumber(i.allocate, 2)} of {formatNumber(i.outstanding, 2)}</span></p>
              ))}
              {allocation.data.invoices.length > 0 && allocation.data.onAccount > 0 && <p className="mt-1 text-muted-foreground">{formatNumber(allocation.data.onAccount, 2)} is left over and kept on account.</p>}
            </div>
          )}
        </>
      )}

      {kind === "journal" && (
        <Field label="Post it to" required hint={line.amount > 0 ? "The money came in, so this account is credited." : "The money went out, so this account is debited."}>
          <SearchSelect aria-label="Account" value={postTo} onChange={setPostTo} options={everything.options} placeholder="Choose an account" loading={everything.loading} />
        </Field>
      )}
      {kind === "journal" && <Note>A journal does not appear in the VAT return. For a charge with VAT, use "Bank charge".</Note>}
      <p className="text-xs text-muted-foreground">{selected?.help}. It will be posted and matched in one step; if anything fails, nothing is posted.</p>
    </ActionModal>
  );
}
