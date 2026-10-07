import React from "react";
import { cn } from "../../../lib/utils";
import { formatDate, formatNumber } from "../../../utils/format";
import { proofRows, signedAmount } from "../../../lib/bankReconcile";
import { typeLabel } from "./helpers";

// Pieces the bank reconciliation screens share.

// A signed amount from the bank account's side: money in reads "+", money out reads "-". The sign is
// the signal; the colour only backs it up.
export function Amount({ value, className }) {
  return (
    <span className={cn("whitespace-nowrap font-medium tabular-nums", value > 0 ? "text-status-success" : value < 0 ? "text-status-danger" : "", className)}>
      {signedAmount(value)}
    </span>
  );
}

export const Day = ({ value }) => <span className="whitespace-nowrap tabular-nums">{value ? formatDate(value) : ""}</span>;

// One book entry, in a sentence a person can check against the statement.
export function EntryRow({ entry, trailing, className }) {
  return (
    <div className={cn("flex min-w-0 items-start justify-between gap-3 text-sm", className)}>
      <div className="min-w-0">
        <p className="truncate">
          <span className="font-mono text-xs font-semibold">{entry.voucherNo}</span>
          <span className="ms-2 text-muted-foreground">{typeLabel(entry.voucherType)}{entry.type === "cheque" ? " waiting to clear" : ""}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          <Day value={entry.day} />
          {entry.party ? ` · ${entry.party}` : ""}
          {entry.chequeNo ? ` · cheque ${entry.chequeNo}` : ""}
          {entry.reference ? ` · ${entry.reference}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Amount value={entry.amount} />
        {trailing}
      </div>
    </div>
  );
}

// The bank reconciliation statement: the proof, line by line, as an accountant reads it. Two columns,
// so it fits a phone without scrolling sideways.
export function ProofTable({ proof, showItems = true }) {
  const rows = proofRows(proof);
  return (
    <div>
      <table className="w-full text-sm">
        <caption className="sr-only">Bank reconciliation statement as of {proof.asOf}</caption>
        <tbody>
          {rows.map((r) => (
            <React.Fragment key={r.key}>
              <tr className={cn(r.rule && "border-t border-border", r.key === "difference" && "border-t-2 border-border")}>
                <td className={cn("py-1.5 pe-3 align-top", r.strong ? "font-semibold" : "text-muted-foreground")}>{r.label}</td>
                <td className={cn("whitespace-nowrap py-1.5 text-end align-top tabular-nums", r.strong ? "font-semibold" : "")}>
                  {r.key === "difference" && Math.abs(r.amount) < 0.005 ? <span className="text-status-success">0.00</span> : formatNumber(r.amount, 2)}
                </td>
              </tr>
              {showItems && r.items?.length > 0 && (
                <tr>
                  <td colSpan={2} className="pb-2">
                    <ul className="ms-3 space-y-1 border-s border-border ps-3 text-xs text-muted-foreground">
                      {r.items.slice(0, 12).map((it, i) => (
                        <li key={it.id || it.groupId || i} className="flex justify-between gap-3">
                          <span className="min-w-0 truncate">
                            <Day value={it.day} /> {it.voucherNo || it.description || (it.kind === "group" ? "Part of a match" : "")}
                            {it.party ? ` · ${it.party}` : ""}
                          </span>
                          <span className="shrink-0 tabular-nums">{formatNumber(it.amount, 2)}</span>
                        </li>
                      ))}
                      {r.items.length > 12 && <li>and {r.items.length - 12} more</li>}
                    </ul>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {proof.unclearedCheques?.count > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {proof.unclearedCheques.count} cheque{proof.unclearedCheques.count === 1 ? "" : "s"} ({formatNumber(Math.abs(proof.unclearedCheques.total), 2)}) {proof.unclearedCheques.count === 1 ? "is" : "are"} still waiting to clear. They are in the post-dated cheques account, not the bank, so they do not affect the figures above.
        </p>
      )}
    </div>
  );
}
