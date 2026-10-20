// The pipeline: every stage, the deals on it, and what the whole thing is worth.
//
// There is deliberately no drag-and-drop. A deal moves because a document moved - a quotation sent, an invoice
// approved - and the few moves a person makes by hand go through a dialog that records a reason. That is the product's
// argument, and it also keeps the board honest on a phone: the stages are a WRAPPING grid, never a strip that scrolls
// sideways (check:mobile fails any page that overflows horizontally, and a dragged card on a touch screen fights the
// page's own scrolling).
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, TrendingUp, AlarmClock, Clock } from "lucide-react";
import { PageHeader, Panel, Spinner, ErrorNote, EmptyState, useAsync, useToasts, Field, TextInput, Textarea, DateInput, SearchSelect, inputClass } from "../accounting/kit.jsx";
import StatCard from "../ui/stat-card.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";
import { useRecordRoute } from "../../lib/useRecordRoute";
import DealView from "./DealView.jsx";
import Can from "../shell/Can.jsx";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { api } from "../../lib/accountingApi";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { StagePill, Tag, CrmDialog, MoveStageDialog, LoseDialog, AssignDialog, LogActivityDialog, useOwners } from "./crmShared.jsx";

/** One deal on the board. Its actions wrap, so none is ever cut off the card (the sweep's `findCutOff`). */
function DealCard({ deal, today, onOpen, can }) {
  const late = deal.overdueAction;
  return (
    <li className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        {/* The only way into the deal from here, so it is a 40px target on touch (the sweep measures taps) */}
        <Link to={`/crm/pipeline?deal=${deal._id}`} className="inline-flex min-w-0 min-h-10 items-center text-sm font-medium text-foreground hover:underline lg:min-h-0">
          {deal.title}
        </Link>
        <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{formatCurrencyAED(deal.value)}</span>
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{deal.customerName}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {deal.stale?.isStale && <Tag tone="warning">Quiet {deal.stale.days}d</Tag>}
        {late && <Tag tone="danger">Follow-up late</Tag>}
        {!late && deal.nextActionAt && <Tag>{rules.nextActionText(deal, today)}</Tag>}
        {deal.ownerName ? <Tag>{deal.ownerName}</Tag> : <Tag tone="warning">Nobody</Tag>}
      </div>
      {(can("crm.edit") || can("crm.assign")) && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Can permission="crm.edit">
            <button type="button" onClick={() => onOpen(deal, "move")} className="h-10 rounded-lg border border-border px-3 text-xs font-medium lg:h-8">
              Move
            </button>
          </Can>
          <Can permission="crm.create">
            <button type="button" onClick={() => onOpen(deal, "log")} className="h-10 rounded-lg border border-border px-3 text-xs font-medium lg:h-8">
              Log
            </button>
          </Can>
          <Can permission="crm.edit">
            <button type="button" onClick={() => onOpen(deal, "lose")} className="h-10 rounded-lg border border-border px-3 text-xs font-medium text-status-danger lg:h-8">
              Lost
            </button>
          </Can>
          <Can permission="crm.assign">
            <button type="button" onClick={() => onOpen(deal, "assign")} className="h-10 rounded-lg border border-border px-3 text-xs font-medium lg:h-8">
              Hand over
            </button>
          </Can>
        </div>
      )}
    </li>
  );
}

function NewDealDialog({ onClose, onSaved, notify }) {
  const [form, setForm] = useState(() => rules.emptyDeal());
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const customers = useAsync(() => api.get("/customers/customers", { limit: 500 }), []);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event?.target ? event.target.value : event }));

  const options = useMemo(() => {
    const rows = Array.isArray(customers.data) ? customers.data : customers.data?.customers || [];
    return rows.map((c) => ({ value: c._id, label: c.customerName, hint: c.customerId }));
  }, [customers.data]);

  const save = async () => {
    const found = rules.validateDeal(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const deal = await crm.createDeal(rules.dealBody(form));
      notify?.(`${deal.opportunityNo} opened`);
      onSaved?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog title="New deal" description="For a customer you already have. An enquiry from somebody new starts as a lead." confirmLabel="Open the deal" size="md" busy={busy} problem={problem} onClose={onClose} onConfirm={save}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Customer" required error={errors.customerId} className="sm:col-span-2">
          <SearchSelect value={form.customerId} onChange={(v) => setForm((f) => ({ ...f, customerId: v }))} options={options} loading={customers.loading} placeholder="Choose the customer" />
        </Field>
        <Field label="What the deal is for" required error={errors.title} className="sm:col-span-2">
          <TextInput value={form.title} onChange={set("title")} placeholder="Monthly rice and oil" />
        </Field>
        <Field label="What it may be worth" error={errors.value}>
          <input className={inputClass} type="number" min="0" value={form.value} onChange={set("value")} />
        </Field>
        <Field label="Expected to close">
          <DateInput value={form.expectedCloseDate} onChange={set("expectedCloseDate")} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={2} value={form.notes} onChange={set("notes")} />
        </Field>
      </div>
    </CrmDialog>
  );
}

export default function CrmPipeline() {
  const { can } = useOrganisation();
  const { notify, toastNode } = useToasts();
  const owners = useOwners();
  const record = useRecordRoute({ param: "deal" });
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState(null); // { kind, deal }
  const [mine, setMine] = useState("");

  const board = useAsync(() => crm.pipeline(mine ? { ownerId: mine } : undefined), [reload, mine]);
  const summary = useAsync(() => crm.summary(), [reload]);
  const again = () => setReload((n) => n + 1);
  const open = (deal, kind) => setDialog({ kind, deal });
  const today = board.data?.today;

  // One deal, by its own address: the board, the follow-up worklist and the customer's CRM tab all link here.
  if (record.recordId) return <DealView id={record.recordId} onBack={() => record.close()} onChanged={again} />;

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Pipeline"
        description="Every deal, and what it is worth. The stages move themselves when a quotation or an invoice moves."
        actions={
          <Can permission="crm.create">
            <button type="button" data-shortcut="new" onClick={() => setDialog({ kind: "new" })} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground lg:h-10">
              <Plus className="h-4 w-4" aria-hidden="true" /> New deal
            </button>
          </Can>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Open deals" count={summary.data?.openDeals ?? "–"} icon={<TrendingUp />} subText={summary.data ? `${formatCurrencyAED(summary.data.pipelineValue)} in all` : ""} />
        <StatCard title="Likely to close" count={summary.data ? formatCurrencyAED(summary.data.weightedValue) : "–"} icon={<TrendingUp />} subText="Weighted by each stage's chance" tone="teal" />
        <StatCard title="Due today" count={summary.data?.dueToday ?? "–"} icon={<Clock />} subText={summary.data?.overdue ? `${summary.data.overdue} late` : "Nothing late"} tone={summary.data?.overdue ? "warning" : undefined} />
        <StatCard title="Gone quiet" count={summary.data?.staleDeals ?? "–"} icon={<AlarmClock />} subText="Nothing happening for too long" tone={summary.data?.staleDeals ? "warning" : undefined} />
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <Field label="Whose deals" className="w-full sm:w-64">
          <SearchSelect value={mine} onChange={setMine} options={owners.map((o) => ({ value: o.id, label: o.name }))} placeholder="Everybody's" clearable />
        </Field>
        {board.data && (
          <p className="pb-2 text-sm text-muted-foreground">
            {board.data.totals?.count ?? 0} {board.data.totals?.count === 1 ? "deal" : "deals"} · {formatCurrencyAED(board.data.totals?.value)} · likely {formatCurrencyAED(board.data.totals?.weighted)}
          </p>
        )}
      </div>

      {board.loading && !board.data && <Spinner label="Reading the pipeline" />}
      {board.error && <ErrorNote error={board.error} onRetry={board.reload} />}

      {board.data && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(board.data.stages || []).map((stage) => (
            <section key={stage.key} className="rounded-xl border border-border bg-background/50 p-3">
              <header className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {stage.name} <span className="text-xs font-normal text-muted-foreground">{stage.probability}%</span>
                </h2>
                <p className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                  {stage.count} · {formatCurrencyAED(stage.value)}
                </p>
              </header>
              {stage.advanceOn && <p className="mt-1 text-xs text-muted-foreground">Happens by itself: {rules.eventLabel(stage.advanceOn).toLowerCase()}</p>}
              {(stage.deals || []).length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">Nothing here</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {(stage.deals || []).map((deal) => (
                    <DealCard key={deal._id} deal={deal} today={today} onOpen={open} can={can} />
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {board.data && board.data.totals?.count === 0 && (
        <EmptyState
          title="No deals yet"
          text="A deal is a customer you are working on. An enquiry from somebody who is not a customer yet starts as a lead."
          action={
            <Link to="/crm/leads" className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
              Go to leads
            </Link>
          }
        />
      )}

      {dialog?.kind === "new" && <NewDealDialog notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); again(); }} />}
      {dialog?.kind === "move" && <MoveStageDialog deal={dialog.deal} stages={board.data?.stages || []} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); again(); }} />}
      {dialog?.kind === "lose" && (
        <LoseDialog title={`${dialog.deal.title} was lost`} onLose={(body) => crm.loseDeal(dialog.deal._id, body)} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); again(); }} />
      )}
      {dialog?.kind === "assign" && (
        <AssignDialog title={`Hand over ${dialog.deal.title}`} owners={owners} current={dialog.deal.ownerId} onAssign={(ownerId) => crm.assignDeal(dialog.deal._id, ownerId)} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); again(); }} />
      )}
      {dialog?.kind === "log" && (
        <LogActivityDialog
          regarding={{ kind: "opportunity", id: dialog.deal._id }}
          defaultOwnerId={dialog.deal.ownerId}
          owners={owners}
          notify={notify}
          onClose={() => setDialog(null)}
          onSaved={() => { setDialog(null); again(); }}
        />
      )}
      {toastNode}
      <p className="mt-8 text-xs text-muted-foreground">
        Nothing here is dragged: a deal moves when its documents move. {board.data?.today ? `Today is ${formatDate(board.data.today)}.` : ""}
      </p>
    </div>
  );
}
