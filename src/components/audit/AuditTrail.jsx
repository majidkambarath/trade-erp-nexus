import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ErrorNote, Modal, Pill, Spinner, useAsync } from "../accounting/kit";
import { documents } from "../../lib/accountingApi";
import { vouchers } from "../../lib/bankingApi";
import { formatDate, formatDateTime, formatNumber, formatQty } from "../../utils/format";

// What one document did, and who did it. The financial effect comes first - the ledger entries it
// posted and what else it moved - and the audit trail of actions is read underneath. Two entry
// points share it: DocumentAuditTrail for a trade document (purchase, sale and their returns) and
// VoucherAuditTrail for a finance voucher (receipt, payment, journal, contra, expense, note).
// Everything here is read-only.

const STATUS_TONE = {
  draft: "neutral",
  pending: "warning",
  approved: "success",
  posted: "success",
  cleared: "success",
  rejected: "danger",
  bounced: "danger",
  cancelled: "neutral",
};
const statusTone = (s) => STATUS_TONE[String(s || "").toLowerCase()] || "neutral";
// The finance screens call an approved voucher "Posted" (StatusPill in finance/shared.jsx); one
// state must not have two names.
const VOUCHER_STATUS = { approved: "Posted" };

const EVENT_LABEL = {
  PURCHASE_RECEIVE: "Received",
  SALES_DISPATCH: "Dispatched",
  PURCHASE_RETURN: "Returned to vendor",
  SALES_RETURN: "Returned by customer",
  STOCK_ADJUSTMENT: "Adjusted",
  OPENING_STOCK: "Opening stock",
  INITIAL_STOCK: "Initial stock",
  DAMAGED_STOCK: "Damaged",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
};

const LOG_LABEL = {
  purchase_order: "Purchase",
  sales_order: "Sale",
  purchase_return: "Purchase return",
  sales_return: "Sales return",
  purchase_order_reversed: "Purchase reversed",
  sales_order_reversed: "Sale reversed",
  purchase_return_reversed: "Purchase return reversed",
  sales_return_reversed: "Sales return reversed",
  payment_received: "Payment",
  adjustment: "Adjustment",
};

// Enum values arrive SHOUTING (UNPAID, SALES_DISPATCH) or snake_cased (sales_order). The screen
// reads in sentence case, like the rest of the finance screens.
const titleCase = (s) => String(s || "").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
const amount = (v) => formatNumber(v, 2);

function Section({ title, note, right, children }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {right}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

/** The text of a header cell, however it is nested. */
const headingText = (node) => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(headingText).join("");
  if (React.isValidElement(node)) return headingText(node.props.children);
  return "";
};

/**
 * Copies each column's heading onto its cells as `data-label`, so the stacked layout below md
 * can print "Credit 62.50" instead of a bare figure. Doing it here rather than by hand keeps
 * the heading and the label from drifting apart, and leaves the six call sites as they were.
 */
const labelCells = (section, labels) =>
  React.Children.map(section, (group) => {
    if (!React.isValidElement(group)) return group; // tbody / tfoot
    const rows = React.Children.map(group.props.children, (row) => {
      if (!React.isValidElement(row)) return row; // tr
      let column = 0;
      const cells = React.Children.map(row.props.children, (cell) => {
        if (!React.isValidElement(cell)) return cell;
        const label = labels[column] ?? "";
        column += cell.props.colSpan || 1;
        return React.cloneElement(cell, { "data-label": label });
      });
      return React.cloneElement(row, undefined, cells);
    });
    return React.cloneElement(group, undefined, rows);
  });

// Four or five columns of figures do not fit a phone, and a dialog cannot scroll sideways
// without hiding the very numbers it is there to show. Below md each row becomes a labelled
// block (see .table-stack in index.css); from md up it is the table it has always been.
function Table({ head, children }) {
  const labels = React.Children.toArray(
    React.isValidElement(head) && head.type === React.Fragment ? head.props.children : head
  ).map(headingText);

  return (
    <div className="erp-scroll table-stack overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>{head}</tr>
        </thead>
        {labelCells(children, labels)}
      </table>
    </div>
  );
}

// The double entry the document posted, with its totals and whether they agree.
function LedgerSection({ ledger }) {
  const [showReversals, setShowReversals] = useState(false);
  const rows = (entries) =>
    entries.map((e) => (
      <tr key={e._id} className="border-t border-border">
        <td className="px-4 py-2">
          {e.accountCode && <span className="me-2 font-mono text-xs text-muted-foreground">{e.accountCode}</span>}
          {e.accountName}
        </td>
        <td className="px-3 py-2 text-end tabular-nums">{e.debit ? amount(e.debit) : ""}</td>
        <td className="px-4 py-2 text-end tabular-nums">{e.credit ? amount(e.credit) : ""}</td>
      </tr>
    ));

  return (
    <Section
      title="Financial effect"
      note={ledger.note}
      right={
        ledger.posted && (
          <span className="flex items-center gap-2">
            {ledger.isReversed && <Pill tone="warning">Reversed</Pill>}
            <Pill tone={ledger.balanced ? "success" : "danger"}>
              {ledger.balanced ? "Debits equal credits" : "Does not balance"}
            </Pill>
          </span>
        )
      }
    >
      {ledger.posted && (
        <Table
          head={
            <>
              <th className="px-4 py-2 text-start">Account</th>
              <th className="px-3 py-2 text-end">Debit</th>
              <th className="px-4 py-2 text-end">Credit</th>
            </>
          }
        >
          <tbody>{rows(ledger.entries)}</tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
              <td className="px-4 py-2">Total</td>
              <td className="px-3 py-2 text-end tabular-nums">{amount(ledger.totals.debit)}</td>
              <td className="px-4 py-2 text-end tabular-nums">{amount(ledger.totals.credit)}</td>
            </tr>
          </tfoot>
        </Table>
      )}
      {ledger.reversals.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowReversals((v) => !v)}
            aria-expanded={showReversals}
            className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showReversals ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
            {ledger.reversals.length} reversing {ledger.reversals.length === 1 ? "entry" : "entries"}
          </button>
          {showReversals && (
            <div className="mt-2">
              <Table
                head={
                  <>
                    <th className="px-4 py-2 text-start">Account</th>
                    <th className="px-3 py-2 text-end">Debit</th>
                    <th className="px-4 py-2 text-end">Credit</th>
                  </>
                }
              >
                <tbody>{rows(ledger.reversals)}</tbody>
              </Table>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function StockSection({ movements }) {
  if (!movements.length) return null;
  return (
    <Section title="Stock movement">
      <Table
        head={
          <>
            <th className="px-4 py-2 text-start">Item</th>
            <th className="px-3 py-2 text-start">Event</th>
            <th className="px-3 py-2 text-end">Quantity</th>
            <th className="px-3 py-2 text-end">On hand</th>
            <th className="px-3 py-2 text-end">Unit cost</th>
            <th className="px-4 py-2 text-end">Value</th>
          </>
        }
      >
        <tbody>
          {movements.map((m) => (
            <tr key={m._id} className="border-t border-border">
              <td className="px-4 py-2">
                <span className="font-medium">{m.itemName}</span>
                {m.batchNumber && <span className="block text-xs text-muted-foreground">Batch {m.batchNumber}</span>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">
                {EVENT_LABEL[m.eventType] || titleCase(m.eventType)}
                {m.isReversed && <Pill tone="warning" className="ms-2">Reversed</Pill>}
              </td>
              <td className="px-3 py-2 text-end tabular-nums">
                {m.quantity > 0 ? "+" : ""}
                {formatQty(m.quantity)}
              </td>
              <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">
                {formatQty(m.previousStock)} &rarr; {formatQty(m.newStock)}
              </td>
              <td className="px-3 py-2 text-end tabular-nums">{amount(m.unitCost)}</td>
              <td className="px-4 py-2 text-end tabular-nums">
                {amount(m.cogsAmount != null ? m.cogsAmount : m.totalValue)}
                {m.cogsAmount != null && <span className="block text-xs text-muted-foreground">cost of sale</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );
}

function PartyBalanceSection({ rows, party }) {
  if (!rows.length) return null;
  return (
    <Section title={`${party.type === "Vendor" ? "Vendor" : "Customer"} balance`}>
      <Table
        head={
          <>
            <th className="px-4 py-2 text-start">Date</th>
            <th className="px-3 py-2 text-start">Entry</th>
            <th className="px-3 py-2 text-end">Amount</th>
            <th className="px-3 py-2 text-end">Balance after</th>
            <th className="px-4 py-2 text-start">Status</th>
          </>
        }
      >
        <tbody>
          {rows.map((r) => (
            <tr key={r._id} className="border-t border-border">
              <td className="px-4 py-2">{formatDate(r.date)}</td>
              <td className="px-3 py-2 text-muted-foreground">{LOG_LABEL[r.type] || titleCase(r.type)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{amount(r.amount)}</td>
              <td className="px-3 py-2 text-end tabular-nums">{amount(r.balance)}</td>
              <td className="px-4 py-2">
                <Pill tone={r.status === "PAID" ? "success" : r.status === "REVERSED" ? "warning" : "neutral"}>
                  {titleCase(r.status)}
                </Pill>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );
}

function SettlementSection({ settlements }) {
  if (!settlements.length) return null;
  return (
    <Section title="Settled by">
      <Table
        head={
          <>
            <th className="px-4 py-2 text-start">Voucher</th>
            <th className="px-3 py-2 text-start">Date</th>
            <th className="px-3 py-2 text-start">Paid by</th>
            <th className="px-4 py-2 text-end">Allocated</th>
          </>
        }
      >
        <tbody>
          {settlements.map((s) => (
            <tr key={s._id} className="border-t border-border">
              <td className="px-4 py-2">
                <span className="font-medium">{s.voucherNo}</span>
                <span className="block text-xs text-muted-foreground">{titleCase(s.voucherType)}</span>
              </td>
              <td className="px-3 py-2">{formatDate(s.date)}</td>
              <td className="px-3 py-2 text-muted-foreground">{s.paymentMode ? titleCase(s.paymentMode) : "-"}</td>
              <td className="px-4 py-2 text-end tabular-nums">{amount(s.allocatedAmount)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );
}

// Who did what, newest last so it reads as a history.
function ActivitySection({ activity }) {
  const [open, setOpen] = useState({});
  return (
    <Section
      title="Audit trail"
      note={activity.length ? "Append-only. Nothing here can be edited or deleted." : null}
    >
      {activity.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing logged for this document yet. Saving, editing, approving and deleting are recorded from now on.
        </p>
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border">
          {activity.map((a) => {
            const has = a.before || a.after;
            const expanded = open[a._id];
            return (
              <li key={a._id} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {has ? (
                    <button
                      type="button"
                      onClick={() => setOpen((o) => ({ ...o, [a._id]: !o[a._id] }))}
                      aria-expanded={!!expanded}
                      aria-label={`${expanded ? "Hide" : "Show"} details of ${a.action}`}
                      className="grid h-9 w-9 place-items-center rounded text-muted-foreground hover:bg-accent lg:h-6 lg:w-6"
                    >
                      {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  ) : (
                    <span className="w-6" />
                  )}
                  <Pill>{a.action.replace(/^(TRANSACTION|VOUCHER|CHEQUE)_/, "").replace(/_/g, " ")}</Pill>
                  <span className="min-w-0 flex-1 truncate text-foreground">{a.summary}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.username || "system"} · {formatDateTime(a.at)}
                  </span>
                </div>
                {expanded && (
                  <div className="mt-2 grid gap-2 ps-9 sm:grid-cols-2">
                    {a.before && (
                      <pre className="erp-scroll max-h-56 overflow-auto rounded-lg bg-secondary/60 p-3 text-xs">
                        <strong className="block pb-1 font-sans">Before</strong>
                        {JSON.stringify(a.before, null, 2)}
                      </pre>
                    )}
                    {a.after && (
                      <pre className="erp-scroll max-h-56 overflow-auto rounded-lg bg-secondary/60 p-3 text-xs">
                        <strong className="block pb-1 font-sans">After</strong>
                        {JSON.stringify(a.after, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

// A trade document: purchase order, sales order, purchase return, sales return.
export default function DocumentAuditTrail({ id, documentNo, onClose }) {
  const { data, loading, error, reload } = useAsync(() => documents.audit(id), [id]);
  const doc = data?.document;

  return (
    <Modal
      size="xl"
      onClose={onClose}
      title={`Audit trail${doc?.transactionNo || documentNo ? ` - ${doc?.transactionNo || documentNo}` : ""}`}
      description={doc ? `${doc.typeLabel} · ${formatDate(doc.date)}${data.party?.name ? ` · ${data.party.name}` : ""}` : undefined}
    >
      {loading && !data && <Spinner label="Loading the document's effects" />}
      <ErrorNote error={error} onRetry={reload} />
      {data && (
        <div className="space-y-6">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <Pill tone={statusTone(doc.status)}>{titleCase(doc.status)}</Pill>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">AED {amount(doc.totalAmount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="mt-0.5 tabular-nums">{amount(doc.paidAmount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Outstanding</dt>
              <dd className="mt-0.5 tabular-nums">{amount(doc.outstandingAmount)}</dd>
            </div>
          </dl>

          <LedgerSection ledger={data.ledger} />
          <StockSection movements={data.stock.movements} />
          <PartyBalanceSection rows={data.partyBalance.rows} party={data.party} />
          <SettlementSection settlements={data.settlements} />

          {data.einvoice && (
            <Section title="E-invoice">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <Pill tone={data.einvoice.status === "REPORTED" || data.einvoice.status === "ACCEPTED" ? "success" : data.einvoice.status === "FAILED" ? "danger" : "warning"}>
                  {titleCase(data.einvoice.status)}
                </Pill>
                <span className="text-muted-foreground">
                  {data.einvoice.documentNo}
                  {data.einvoice.submittedAt ? ` · sent ${formatDateTime(data.einvoice.submittedAt)}` : ""}
                </span>
              </p>
              {data.einvoice.lastError && <p className="text-xs text-status-danger">{data.einvoice.lastError}</p>}
            </Section>
          )}

          <ActivitySection activity={data.activity} />
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- vouchers

// The invoices a receipt or payment was set against, with the balance each one moved from and to.
// Anything not allocated sits on account against the party.
function AllocationSection({ allocations, onAccount }) {
  if (!allocations.length && !onAccount) return null;
  return (
    <Section title="Set against">
      {allocations.length > 0 && (
        <Table
          head={
            <>
              <th className="px-4 py-2 text-start">Invoice</th>
              <th className="px-3 py-2 text-start">Date</th>
              <th className="px-3 py-2 text-end">Allocated</th>
              <th className="px-3 py-2 text-end">Balance</th>
              <th className="px-4 py-2 text-end">Outstanding now</th>
            </>
          }
        >
          <tbody>
            {allocations.map((a) => (
              <tr key={a.invoiceId} className="border-t border-border">
                <td className="px-4 py-2">
                  <span className="font-medium">{a.transactionNo || "(deleted)"}</span>
                  {a.typeLabel && <span className="block text-xs text-muted-foreground">{a.typeLabel}</span>}
                </td>
                <td className="px-3 py-2">{a.date ? formatDate(a.date) : "-"}</td>
                <td className="px-3 py-2 text-end tabular-nums">{amount(a.allocatedAmount)}</td>
                <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">
                  {amount(a.previousBalance)} &rarr; {amount(a.newBalance)}
                </td>
                <td className="px-4 py-2 text-end tabular-nums">{amount(a.outstandingNow)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {onAccount > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">{amount(onAccount)}</span> was left on account, not
          set against any invoice.
        </p>
      )}
    </Section>
  );
}

// A cheque sits in Cheques in Hand or Cheques Issued until it clears, so its own history is part
// of the voucher's story.
function ChequeSection({ cheque }) {
  if (!cheque) return null;
  return (
    <Section title="Cheque" right={<Pill tone={statusTone(cheque.status)}>{titleCase(cheque.status)}</Pill>}>
      <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-border px-4 py-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Number</dt>
          <dd className="font-mono">{cheque.chequeNo}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dated</dt>
          <dd>
            {formatDate(cheque.chequeDate)}
            {cheque.isPDC && <span className="ms-2 text-xs text-muted-foreground">post-dated</span>}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Drawn on</dt>
          <dd>{cheque.drawnOnBankName || "-"}</dd>
        </div>
        {cheque.reason && (
          <div className="sm:col-span-3">
            <dt className="text-muted-foreground">Reason</dt>
            <dd>{cheque.reason}</dd>
          </div>
        )}
      </dl>
      {cheque.history.length > 0 && (
        <ol className="space-y-1 text-xs text-muted-foreground">
          {cheque.history.map((h, i) => (
            <li key={i}>
              {titleCase(h.status)} · {formatDateTime(h.at)}
              {h.by ? ` · ${h.by}` : ""}
              {h.note ? ` · ${h.note}` : ""}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

// A finance voucher: receipt, payment, journal, contra, expense, debit or credit note.
export function VoucherAuditTrail({ id, voucherNo, onClose }) {
  const { data, loading, error, reload } = useAsync(() => vouchers.audit(id), [id]);
  const v = data?.voucher;

  return (
    <Modal
      size="xl"
      onClose={onClose}
      title={`Audit trail${v?.voucherNo || voucherNo ? ` - ${v?.voucherNo || voucherNo}` : ""}`}
      description={v ? `${v.typeLabel} · ${formatDate(v.date)}${v.partyName ? ` · ${v.partyName}` : ""}` : undefined}
    >
      {loading && !data && <Spinner label="Loading the voucher's effects" />}
      <ErrorNote error={error} onRetry={reload} />
      {data && (
        <div className="space-y-6">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="mt-0.5">
                <Pill tone={statusTone(v.status)}>{VOUCHER_STATUS[v.status] || titleCase(v.status)}</Pill>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">AED {amount(v.totalAmount)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Paid by</dt>
              <dd className="mt-0.5">
                {v.paymentMode ? titleCase(v.paymentMode) : "-"}
                {v.paymentAccountName && <span className="block text-xs text-muted-foreground">{v.paymentAccountName}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">On account</dt>
              <dd className="mt-0.5 tabular-nums">{amount(v.onAccountAmount)}</dd>
            </div>
            {v.currency && v.currency !== "AED" && (
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">Foreign currency</dt>
                <dd className="mt-0.5 tabular-nums">
                  {v.currency} at {v.exchangeRate}
                </dd>
              </div>
            )}
            {v.narration && (
              <div className="sm:col-span-4">
                <dt className="text-muted-foreground">Narration</dt>
                <dd className="mt-0.5">{v.narration}</dd>
              </div>
            )}
          </dl>

          <LedgerSection ledger={data.ledger} />
          <AllocationSection allocations={data.allocations} onAccount={data.onAccount} />
          <ChequeSection cheque={data.cheque} />
          <ActivitySection activity={data.activity} />
        </div>
      )}
    </Modal>
  );
}
