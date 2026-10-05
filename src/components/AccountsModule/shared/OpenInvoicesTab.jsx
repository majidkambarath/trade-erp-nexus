import React from "react";
import { cn } from "../../../lib/utils";
import { formatDate, formatNumber } from "../../../utils/format";
import { EmptyState, ErrorNote, Panel, Pill, Spinner } from "../../accounting/kit";
import { Skeleton } from "./partyAccountParts";
import { DEFAULT_BUCKETS, lateness } from "./partyAccountUtils";

// the older the bucket, the stronger the signal; the label always says which one it is
const BUCKET_TONE = { d1_30: "text-foreground", d31_60: "text-status-warning", d61_90: "text-status-warning", d90plus: "text-status-danger" };

const amount = (n) => (n === null || n === undefined ? "" : formatNumber(n, 2));

/**
 * Unpaid invoices for one party with how late each is, under the ageing buckets they fall in.
 * `row` is this party's row of the ageing report (null when nothing is outstanding).
 */
export default function OpenInvoicesTab({ k, ageing, row }) {
  const { data, loading, error, reload } = ageing;
  const buckets = data?.buckets?.length ? data.buckets : DEFAULT_BUCKETS;
  const invoices = row?.invoices || [];
  const hasTotals = invoices.some((i) => i.total !== undefined && i.total !== null);
  const hasPaid = invoices.some((i) => i.paid !== undefined && i.paid !== null);

  if (loading && !data) {
    return (
      <Panel title="Open invoices">
        <div aria-busy="true" className="space-y-2">
          <Spinner label="Loading open invoices" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </Panel>
    );
  }
  if (error && !data) {
    return <Panel title="Open invoices"><ErrorNote error={error} onRetry={reload} /></Panel>;
  }

  return (
    <div className="space-y-4">
      {error && <ErrorNote error={error} onRetry={reload} />}

      {invoices.length > 0 && (
        <section aria-label="Ageing buckets">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {buckets.map((b) => {
              const value = row.buckets?.[b.key] || 0;
              return (
                <div key={b.key} className="rounded-xl border border-border bg-card px-4 py-3 shadow-card">
                  <dt className="text-xs font-medium text-muted-foreground">{b.label}</dt>
                  <dd className={cn("mt-1 text-base font-semibold tabular-nums", value ? BUCKET_TONE[b.key] : "text-muted-foreground")}>{formatNumber(value, 2)}</dd>
                </div>
              );
            })}
            <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3">
              <dt className="text-xs font-medium text-muted-foreground">Total outstanding</dt>
              <dd className="mt-1 text-base font-semibold tabular-nums text-foreground">{formatNumber(row.total, 2)}</dd>
            </div>
          </dl>
        </section>
      )}

      <Panel bodyClassName="p-0" title="Open invoices" description={invoices.length ? `${invoices.length} unpaid ${invoices.length === 1 ? "invoice" : "invoices"}, oldest first` : undefined}>
        {invoices.length === 0 && (
          <EmptyState title="No open invoices" text={`Every approved ${k.docNoun} invoice for this ${k.noun} is paid.`} />
        )}
        {invoices.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Unpaid {k.docNoun} invoices</caption>
              <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-5 py-2 text-start font-medium">Invoice</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Date</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Due date</th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">Status</th>
                  {hasTotals && <th scope="col" className="px-3 py-2 text-end font-medium">Invoice total</th>}
                  {hasPaid && <th scope="col" className="px-3 py-2 text-end font-medium">Paid</th>}
                  <th scope="col" className="px-5 py-2 text-end font-medium">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const late = lateness(i);
                  return (
                    <tr key={i.transactionId || i.transactionNo} className="border-t border-border hover:bg-accent/40">
                      <td className="whitespace-nowrap px-5 py-2 font-mono text-xs">{i.transactionNo}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(i.date)}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatDate(i.dueDate)}</td>
                      <td className="px-3 py-2"><Pill tone={late.tone}>{late.text}</Pill></td>
                      {hasTotals && <td className="px-3 py-2 text-end tabular-nums">{amount(i.total)}</td>}
                      {hasPaid && <td className="px-3 py-2 text-end tabular-nums">{amount(i.paid)}</td>}
                      <td className="px-5 py-2 text-end font-medium tabular-nums">{formatNumber(i.outstanding, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                  <th scope="row" colSpan={3 + 1 + (hasTotals ? 1 : 0) + (hasPaid ? 1 : 0)} className="px-5 py-2.5 text-start font-semibold">Total outstanding</th>
                  <td className="px-5 py-2.5 text-end tabular-nums">{formatNumber(row.total, 2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
