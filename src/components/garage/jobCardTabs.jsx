import React from "react";
import { Image as ImageIcon } from "lucide-react";
import { Button } from "../ui/button";
import Can from "../shell/Can.jsx";
import { Pill } from "../accounting/kit";
import AttachmentPanel from "../accounting/AttachmentPanel.jsx";
import { TASK_STATUS, CONDITION_LABEL, CONDITION_TONE, lineDecisionLabel } from "../../lib/garage";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { DocLink } from "../salesDocs/parts";

// The four panels behind the job card's tabs (JobCardView.jsx), lifted out of its own body - each is the
// same markup that scrolled past in the single-tab version, only grouped by what a reader is actually
// there for: the job (what the customer said, what the car looked like), the estimate (what it costs and
// its history), the work (tasks, and what is holding one up), money (what gets billed and the handover).

export function money(n) {
  return formatCurrencyAED(Number(n) || 0);
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

// "The job": what the customer said, and what the car looked like coming in. The two belong together -
// it is the one tab a technician and a service advisor both read, and the one the customer rings up to
// argue about.
export function JobTab({ card, checkInFiles }) {
  const c = card;
  return (
    <div className="grid grid-cols-1 gap-5">
      {(c.checkIn?.damagePoints?.length > 0 || c.checkIn?.itemsPresent?.length > 0 || c.checkIn?.notes) && (
        <Section title="The walk-around">
          {c.checkIn.itemsPresent?.length > 0 && <p className="text-sm text-muted-foreground">With them: {c.checkIn.itemsPresent.join(", ")}</p>}
          {c.checkIn.damagePoints?.length > 0 && (
            <ul className="mt-1 grid gap-1 text-sm">
              {c.checkIn.damagePoints.map((d, i) => (
                <li key={i}>
                  <span className="font-medium">{d.panel}</span> - {d.kind}{d.notes ? `: ${d.notes}` : ""}
                </li>
              ))}
            </ul>
          )}
          {c.checkIn.notes && <p className="mt-1 text-sm text-muted-foreground">{c.checkIn.notes}</p>}
          {checkInFiles && <AttachmentPanel source={checkInFiles} label="Check-in photos" readOnly className="mt-2" />}
        </Section>
      )}

      <Section title="What the customer reported">
        {c.complaints?.length ? (
          <ul className="grid gap-1.5 text-sm">
            {c.complaints.map((comp) => (
              <li key={comp._id} className="rounded-lg border px-3 py-2">
                <span className="font-medium">{comp.concern}</span>
                {comp.cause && <span className="text-muted-foreground"> · {comp.cause}</span>}
                {comp.correction && <span className="text-muted-foreground"> · {comp.correction}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Nothing recorded.</p>}
      </Section>

      {c.notes && <p className="text-sm text-muted-foreground">{c.notes}</p>}
    </div>
  );
}

// "The estimate": the lines and their history, kept together on purpose (D18: a supplementary estimate
// used to be recorded on estimateHistory with nowhere on screen to show it, so "teardown found more" left
// no visible trail of what the FIRST estimate had asked for - putting the history a tab away from the
// lines it versions would recreate that same defect with extra steps).
export function EstimateTab({ card }) {
  const c = card;
  return (
    <div className="grid grid-cols-1 gap-5">
      <Section title="The estimate">
        {c.lines?.length ? (
          <>
            <ul className="divide-y rounded-lg border text-sm">
              {c.lines.map((l) => {
                const { label, tone } = lineDecisionLabel(l, c.status);
                return (
                  <li key={l._id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate">
                      <span className="me-2 rounded bg-secondary px-1.5 py-0.5 text-xs uppercase text-muted-foreground">{l.kind}</span>
                      {l.description}
                    </span>
                    <span className="shrink-0 tabular-nums">{money(l.lineTotal)}</span>
                    <Pill tone={tone}>{label}</Pill>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-end text-sm font-medium">Total (approved): {money(c.totals?.total)}</p>
          </>
        ) : <p className="text-sm text-muted-foreground">No lines yet. Edit the card to add parts and labour.</p>}
      </Section>

      {c.estimateHistory?.length > 0 && (
        <Section title="Estimate history">
          <ul className="divide-y rounded-lg border text-sm">
            {c.estimateHistory.map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  v{h.version} - sent {h.sentAt ? formatDate(h.sentAt) : ""}
                  {h.decidedAt && <span className="text-muted-foreground"> · decided {formatDate(h.decidedAt)} ({h.method})</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">{money(h.total)}</span>
              </li>
            ))}
            {c.estimate?.version && (
              <li className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  v{c.estimate.version} (current) - sent {c.estimate.sentAt ? formatDate(c.estimate.sentAt) : ""}
                  {c.estimate.decidedAt && <span className="text-muted-foreground"> · decided {formatDate(c.estimate.decidedAt)} ({c.estimate.method})</span>}
                </span>
                <span className="tabular-nums text-muted-foreground">{money(c.totals?.total)}</span>
              </li>
            )}
          </ul>
        </Section>
      )}
    </div>
  );
}

// "The work": tasks, and the two things that explain why one is stuck - a shortage is a task that cannot
// start, a purchase order is what was done about it. Kept in one causal chain rather than split across
// the old single scroll's own order (which put "Estimate history" between them).
export function WorkTab({ card, shortages, busy, onStartTask, onCompleteTask, onRaisePO, onEditInspection }) {
  const c = card;
  return (
    <div className="grid grid-cols-1 gap-5">
      {/* What was found, with photos - this is also exactly what the customer sees on the estimate link
          (components/send/EstimateApproval.jsx), so it lives ahead of the tasks it justifies. */}
      <Section title="What was found">
        {c.inspection?.length ? (
          <ul className="grid gap-1.5 text-sm">
            {c.inspection.map((i) => (
              <li key={i._id} className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{i.item}</span>
                  {i.note && <span className="text-muted-foreground"> · {i.note}</span>}
                  {i.photos?.length > 0 && <span className="ms-2 inline-flex items-center gap-0.5 text-xs text-muted-foreground"><ImageIcon className="h-3 w-3" aria-hidden="true" />{i.photos.length}</span>}
                </span>
                <Pill tone={CONDITION_TONE[i.condition] || "neutral"}>{CONDITION_LABEL[i.condition] || i.condition}</Pill>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>}
        <Can permission="garage.edit">
          <Button variant="outline" size="sm" className="mt-2" onClick={onEditInspection}>{c.inspection?.length ? "Edit findings" : "Record findings"}</Button>
        </Can>
      </Section>

      <Section title="Tasks">
        {c.tasks?.length ? (
          <ul className="grid gap-2">
            {c.tasks.map((t) => {
              const label = TASK_STATUS[t.status] || { label: t.status, tone: "neutral" };
              return (
                <li key={t._id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="font-medium">{t.stage}. {t.name}</span>
                      <span className="ms-2 text-xs text-muted-foreground">{t.mode === "sublet" ? t.vendorName : t.staffName || "Unassigned"}</span>
                    </span>
                    <Pill tone={label.tone}>{label.label}</Pill>
                  </div>
                  {(t.actions?.start || t.actions?.complete) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {t.actions.start && <Button size="sm" variant="outline" disabled={busy} onClick={() => onStartTask(t)}>Start</Button>}
                      {t.actions.complete && <Button size="sm" onClick={() => onCompleteTask(t)}>Done</Button>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No tasks yet.</p>}
      </Section>

      {shortages?.length > 0 && (
        <Section title="Short of stock">
          <ul className="grid gap-1.5 text-sm">
            {shortages.map((s) => (
              <li key={s.itemId} className="flex items-center justify-between gap-2 rounded-lg border border-status-warning/40 bg-status-warning-soft px-3 py-2">
                <span>
                  {s.itemName} <span className="text-muted-foreground">- short {s.short} ({s.onHand} on hand)</span>
                  {s.vendorName && <span className="ms-1 text-xs text-muted-foreground">usually from {s.vendorName}</span>}
                </span>
              </li>
            ))}
          </ul>
          <Can permission="garage.edit">
            <Button variant="outline" size="sm" className="mt-2" onClick={onRaisePO}>Raise purchase order</Button>
          </Can>
        </Section>
      )}

      {c.purchaseOrders?.length > 0 && (
        <Section title="Purchase orders raised">
          <ul className="divide-y rounded-lg border text-sm">
            {c.purchaseOrders.map((po, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>{po.no} <span className="text-muted-foreground">({po.vendorName})</span></span>
                <span className="tabular-nums">{money(po.amount)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// "Money": the insurance side (if there is one), what has been billed, and the handover - releasing the
// car and billing it are one conversation at the counter, and the board's own red tile is "Delivered, not
// invoiced", so the two facts live on the same tab.
export function MoneyTab({ card, onViewClaim, onOpenClaim }) {
  const c = card;
  return (
    <div className="grid grid-cols-1 gap-5">
      {c.jobType === "insurance" && (
        <Section title="Insurance claim">
          {c.claimId ? (
            <Button variant="outline" size="sm" onClick={onViewClaim}>View claim</Button>
          ) : (
            <Can permission="garage.create">
              <Button variant="outline" size="sm" onClick={onOpenClaim}>Open insurance claim</Button>
            </Can>
          )}
        </Section>
      )}

      <Section title="Invoices">
        {c.invoices?.length ? (
          <ul className="divide-y rounded-lg border text-sm">
            {c.invoices.map((inv, i) => (
              <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  {/* Approved only: a draft invoice has no printable tax invoice yet, and "/sales-order?search=" opens the
                      list filtered to this number either way, so a draft still lands somewhere useful. */}
                  <DocLink kind="sales_order" no={inv.no}>{inv.no}</DocLink> <span className="text-muted-foreground">({inv.billTo})</span>
                </span>
                <span className="tabular-nums">{money(inv.amount)}</span>
                <Pill tone={inv.status === "APPROVED" ? "success" : "warning"}>{inv.status}</Pill>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Not invoiced yet.</p>}
      </Section>

      {c.delivery?.gatePassAt && (
        <Section title="Delivery">
          <p className="text-sm text-muted-foreground">
            Released {formatDate(c.delivery.gatePassAt)}{c.delivery.handedTo ? ` to ${c.delivery.handedTo}` : ""}
            {c.warranty?.until ? ` · warranty until ${formatDate(c.warranty.until)}` : ""}
          </p>
        </Section>
      )}
    </div>
  );
}
