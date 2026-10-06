import React, { useEffect, useMemo, useRef, useState } from "react";
import { ErrorNote, Field, Spinner, TextInput, useAsync } from "../../accounting/kit";
import { ActionModal, Note } from "../../salesDocs/parts";
import { reconcile } from "../../../lib/bankReconcileApi";
import { splitDifference, unexplained } from "../../../lib/bankReconcile";
import { formatNumber } from "../../../utils/format";
import { Amount, Day } from "./parts";
import { useAction } from "./helpers";

// One bank credit from the card acquirer, many card sales. The books booked each sale net of the
// commission the card master says it costs; the acquirer also takes VAT on its commission, and
// sometimes more than the configured rate. The difference is explained here and posted as one entry
// (card processing fees + input VAT), so the sales and that entry add up to the credit exactly.

const cents = (n) => Math.round((Number(n) || 0) * 100);
const money = (c) => formatNumber(c / 100, 2);

export default function CardSettleDialog({ accountId, line, onClose, onDone }) {
  const data = useAsync(() => reconcile.cardUnsettled({ accountId, lineId: line._id }), [accountId, line._id]);
  const [picked, setPicked] = useState(null); // Set of entryId; null until the suggestion has loaded
  const [extra, setExtra] = useState("0");
  const [vat, setVat] = useState("0");
  const [ref, setRef] = useState(line.reference || "");
  const edited = useRef(false); // once a person types a split, it is theirs

  const receipts = data.data?.receipts || [];
  const chosen = picked || new Set();
  const rows = receipts.filter((r) => chosen.has(r.entryId));
  const expected = rows.reduce((t, r) => t + cents(r.net), 0);
  const fees = rows.reduce((t, r) => t + cents(r.feeBooked), 0);
  const gross = rows.reduce((t, r) => t + cents(r.gross), 0);
  const diff = expected - cents(line.amount); // fils the acquirer kept beyond what the books carried
  const vatRate = data.data?.vatRate ?? 5;

  // start from the engine's idea of which sales this is
  useEffect(() => {
    if (!data.data || picked) return;
    setPicked(new Set(data.data.suggestion ? data.data.suggestion.entryIds : []));
  }, [data.data]); // eslint-disable-line react-hooks/exhaustive-deps
  // and propose how to explain the difference, until the person types their own
  useEffect(() => {
    if (edited.current) return;
    const s = splitDifference({ difference: diff / 100, feeBooked: fees / 100, vatRate });
    setExtra(String(s.extraCommission));
    setVat(String(s.vat));
  }, [diff, fees, vatRate]);

  const left = useMemo(() => (diff > 0 ? cents(unexplained(diff / 100, extra, vat)) : 0), [diff, extra, vat]);
  const toggle = (id) => { edited.current = false; setPicked((s) => { const n = new Set(s || []); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const { busy, problem, go } = useAction(
    () => reconcile.cardSettle({ accountId, lineId: line._id, receiptEntryIds: [...chosen], extraCommission: diff > 0 ? Number(extra) || 0 : 0, vat: diff > 0 ? Number(vat) || 0 : 0, settlementRef: ref }),
    onDone,
    "Card settlement recorded"
  );
  const num = (setter) => (e) => { edited.current = true; setter(e.target.value.replace(/[^0-9.]/g, "")); };

  return (
    <ActionModal
      size="xl" title="Card settlement" confirmLabel="Record settlement" busy={busy} disabled={rows.length === 0 || left !== 0} problem={problem} onClose={onClose} onConfirm={go}
      description="Tick the card sales this payment settles. The acquirer's commission is already in the books at the rate on the card; what it took beyond that is posted here."
    >
      <div className="rounded-lg border border-border bg-secondary/50 p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs text-muted-foreground"><Day value={line.day} /></p><p className="break-words font-medium">{line.description}</p></div>
          <Amount value={line.amount} className="text-base" />
        </div>
      </div>

      {data.loading && !data.data && <Spinner label="Looking for card sales" />}
      <ErrorNote error={data.error} onRetry={data.reload} />
      {data.data && receipts.length === 0 && <Note tone="warning">There are no card sales waiting to be settled on this bank account. Card sales are recorded by taking a receipt with the payment mode "Card".</Note>}

      {receipts.length > 0 && (
        <>
          {data.data.suggestion && <p className="text-xs text-muted-foreground">The sales up to {data.data.suggestion.cutoffDay} are ticked: that is the closest fit to what the bank paid.</p>}
          <ul className="max-h-60 divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {receipts.map((r) => (
              <li key={r.entryId} className="flex items-start gap-3 px-3 py-2 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4" aria-label={`${r.voucherNo} ${formatNumber(r.net, 2)}`} checked={chosen.has(r.entryId)} onChange={() => toggle(r.entryId)} />
                <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                  <div className="min-w-0"><p><span className="font-mono text-xs font-semibold">{r.voucherNo}</span> <span className="text-muted-foreground">{r.cardLabel}</span></p><p className="text-xs text-muted-foreground"><Day value={r.day} /> · sale {formatNumber(r.gross, 2)}, commission booked {formatNumber(r.feeBooked, 2)}</p></div>
                  <span className="shrink-0 tabular-nums">{formatNumber(r.net, 2)}</span>
                </div>
              </li>
            ))}
          </ul>

          <section aria-label="What the books expected and what the bank paid" className="rounded-lg border border-border p-3 text-sm">
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5" aria-live="polite">
              <dt className="text-muted-foreground">Sales ticked</dt><dd className="tabular-nums">{rows.length} · {money(gross)}</dd>
              <dt className="text-muted-foreground">Commission already booked</dt><dd className="tabular-nums">{money(fees)}</dd>
              <dt className="text-muted-foreground">The books expect</dt><dd className="tabular-nums">{money(expected)}</dd>
              <dt className="text-muted-foreground">The bank paid</dt><dd className="tabular-nums">{formatNumber(line.amount, 2)}</dd>
              <dt className="border-t border-border pt-1.5 font-semibold">Difference</dt><dd className="border-t border-border pt-1.5 font-semibold tabular-nums">{money(diff)}</dd>
            </dl>
          </section>

          {rows.length > 0 && diff > 0 && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">The acquirer kept {money(diff)} more than the books carried. Say what it is:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="VAT on the commission" hint={`${vatRate}% of the whole commission`}><TextInput inputMode="decimal" value={vat} onChange={num(setVat)} aria-label="VAT on the commission" /></Field>
                <Field label="Commission beyond the booked rate" hint="Extra, if the acquirer charges more than the card master says"><TextInput inputMode="decimal" value={extra} onChange={num(setExtra)} aria-label="Extra commission" /></Field>
              </div>
              <p className={left === 0 ? "mt-2 text-sm text-status-success" : "mt-2 text-sm text-status-warning"} aria-live="polite">{left === 0 ? "The difference is fully explained." : `${money(Math.abs(left))} ${left > 0 ? "still to explain" : "too much"}`}</p>
            </div>
          )}
          {rows.length > 0 && diff < 0 && <Note>The bank paid {money(-diff)} more than the books expected: the commission booked at the sale was a little too high. It is posted back to card processing fees.</Note>}
          {rows.length > 0 && diff === 0 && <p className="text-sm text-status-success">The bank paid exactly what the books expected.</p>}

          <Field label="Settlement reference" hint="The acquirer's number for this payment (optional)"><TextInput value={ref} onChange={(e) => setRef(e.target.value)} maxLength={80} /></Field>
        </>
      )}
    </ActionModal>
  );
}
