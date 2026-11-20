// One deal: what it is worth, where it stands, and - the part that answers the question people actually ask - WHY it
// got there. `autoMoves` is the record of every stage the documents moved it through, so "it says Won and I never
// touched it" has an answer on the screen rather than in a log.
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { PageHeader, Panel, PageSpinner, ErrorNote, useAsync, useToasts, Field, TextInput, Textarea, DateInput, inputClass, AmountInput, SearchSelect } from "../accounting/kit.jsx";
import { api } from "../../lib/accountingApi";
import { pickerLabel } from "../../lib/itemTypes";
import { Note } from "../salesDocs/parts.jsx";
import Can from "../shell/Can.jsx";
import { formatCurrencyAED, formatDate, formatDateTime } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { StagePill, Tag, ActivityTimeline, CrmDialog, CrmFiles, LogActivityDialog, MoveStageDialog, LoseDialog, AssignDialog, useOwners } from "./crmShared.jsx";
import MeetingDialog from "./MeetingDialog.jsx";
import EmailDialog from "./EmailDialog.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";

const Fact = ({ label, children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-1.5 last:border-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm font-medium text-foreground">{children}</dd>
  </div>
);

/** Every stage the documents moved it through, newest first, each naming the document that did it. */
function HowItGotHere({ moves = [], stages = [] }) {
  // The moves store stage KEYS; a person reads names, so they are looked up in the pipeline the deal carries (and a
  // stage since renamed or removed falls back to its key rather than to nothing).
  const nameOf = (key) => stages.find((s) => s.key === key)?.name || key;
  if (!moves.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing has moved it yet. It will move itself when a quotation goes out.</p>;
  }
  return (
    <ol className="divide-y divide-border">
      {[...moves].reverse().map((move) => (
        <li key={move.key} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {move.from ? `${nameOf(move.from)} → ` : ""}
              {nameOf(move.to)}
              {move.undoneAt && <span className="ms-2 text-xs font-normal text-status-danger">taken back</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {rules.eventLabel(move.event)}
              {move.docNo ? ` · ${move.docNo}` : ""}
            </p>
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(move.at)} · {move.by === "automation" ? "by itself" : move.by}
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function DealView({ id, onBack, onChanged }) {
  const { can, featureOn } = useOrganisation();
  const navigate = useNavigate();
  const { notify, toastNode } = useToasts();
  const owners = useOwners();
  const [dialog, setDialog] = useState(null);
  const [reload, setReload] = useState(0);
  const { data: deal, loading, error, reload: again } = useAsync(() => crm.deal(id), [id, reload]);
  const refresh = () => {
    setReload((n) => n + 1);
    onChanged?.();
  };

  if (loading && !deal) return <PageSpinner label="Reading the deal" />;
  if (error) return <ErrorNote error={error} onRetry={again} />;
  if (!deal) return null;

  const open = deal.status === "OPEN";
  // A quotation is a Sales document: offered only where the organisation has Quotations and the person may add sales
  // documents (a CRM-only organisation has neither, and keeps a hand-typed value). Once one is linked, it is opened instead.
  const mayQuote = featureOn("quotations") && can("sales.create");
  const quoteLinked = Boolean(deal.links?.quotationId);
  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> The pipeline
      </button>
      <PageHeader
        title={deal.title}
        description={`${deal.opportunityNo} · ${deal.customerName}`}
        actions={
          // Seven actions is more than fits beside the title on a tablet, so below a wide screen they take a row of
          // their own rather than squeezing the heading out of the viewport (found by check:mobile at 820px).
          <div className="flex w-full flex-wrap gap-2 lg:w-auto">
            {open && (
              <Can permission="crm.edit">
                <button type="button" onClick={() => setDialog("move")} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground lg:h-10">
                  Move
                </button>
              </Can>
            )}
            <Can permission="crm.create">
              <button type="button" onClick={() => setDialog("log")} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
                Log a follow-up
              </button>
            </Can>
            {open && (
              <Can permission="crm.create">
                <button type="button" onClick={() => setDialog("meet")} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
                  Arrange a meeting
                </button>
              </Can>
            )}
            <Can permission="crm.create">
              <button type="button" onClick={() => setDialog("email")} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
                Write to the customer
              </button>
            </Can>
            {open && (
              <Can permission="crm.assign">
                <button type="button" onClick={() => setDialog("assign")} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
                  Hand over
                </button>
              </Can>
            )}
            {open && mayQuote && !quoteLinked && (
              <button type="button" onClick={() => navigate(`/quotations?mode=create&deal=${deal._id}`)} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
                Create quotation
              </button>
            )}
            {quoteLinked && featureOn("quotations") && can("sales.view") && (
              <button type="button" onClick={() => navigate(`/quotations?open=${deal.links.quotationId}`)} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
                Open quotation
              </button>
            )}
            {open && (
              <Can permission="crm.edit">
                <button type="button" onClick={() => setDialog("edit")} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
                  Edit
                </button>
              </Can>
            )}
            {open && (
              <Can permission="crm.edit">
                <button type="button" onClick={() => setDialog("lose")} className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-status-danger lg:h-10">
                  Lost
                </button>
              </Can>
            )}
          </div>
        }
      />

      {/* grid-cols-1 on both grids: below lg a grid has one implicit AUTO column, which is as wide as its widest unbreakable text -
          a file's long name made this page 712px wide on a 390px phone (found by check:mobile). minmax(0, 1fr) lets it shrink, so truncate works. */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="The deal" className="lg:col-span-1">
          <dl className="grid gap-2 text-sm">
            <Fact label="Stage">
              <StagePill deal={deal} />
            </Fact>
            <Fact label="Worth">{formatCurrencyAED(deal.value)}</Fact>
            <Fact label="Likely">{formatCurrencyAED(deal.weighted)}</Fact>
            <Fact label="On this stage">{deal.daysInStage} {deal.daysInStage === 1 ? "day" : "days"}</Fact>
            <Fact label="Expected to close">{deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "Not said"}</Fact>
            <Fact label="Chased by">{deal.ownerName || "Nobody"}</Fact>
            <Fact label="Next action">{deal.nextActionAt ? formatDate(deal.nextActionAt) : "Nothing planned"}</Fact>
            <Fact label="Where it came from">{rules.sourceLabel(deal.source)}</Fact>
            {deal.lostReason && <Fact label="Lost because">{rules.lostLabel(deal.lostReason)}{deal.lostNote ? ` · ${deal.lostNote}` : ""}</Fact>}
          </dl>

          {deal.items?.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted-foreground">What it is for</p>
              <ul className="divide-y divide-border/60 text-sm" aria-label="Deal lines">
                {deal.items.map((l, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2 py-1">
                    <span className="min-w-0 truncate">{l.description || "Item"}</span>
                    <span className="shrink-0 whitespace-nowrap text-muted-foreground">{l.qty} x {formatCurrencyAED(l.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {deal.stale?.isStale && <Tag tone="warning">Quiet {deal.stale.days} days</Tag>}
            {deal.overdueAction && <Tag tone="danger">Follow-up late</Tag>}
            {deal.links?.quotationNo && <Tag>Quotation {deal.links.quotationNo}</Tag>}
            {deal.links?.orderNo && <Tag>Invoice {deal.links.orderNo}</Tag>}
          </div>

          {deal.customer && (
            <p className="mt-3 text-xs text-muted-foreground">
              {deal.customer.phone || deal.customer.email || ""}
              {deal.customer.paymentTerms ? ` · ${deal.customer.paymentTerms}` : ""}
              {deal.customer.creditLimit ? ` · limit ${formatCurrencyAED(deal.customer.creditLimit)}` : ""}
            </p>
          )}
          {!open && (
            <Can permission="crm.edit">
              <button type="button" onClick={() => setDialog("reopen")} className="mt-4 h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
                Reopen it
              </button>
            </Can>
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-4 lg:col-span-2">
          <Panel title="How it got here" description="What the documents did, without anybody pressing anything" bodyClassName="p-0 sm:px-4">
            <div className="px-4 sm:px-0">
              <HowItGotHere moves={deal.autoMoves} stages={deal.pipeline} />
            </div>
          </Panel>
          <Panel title="What has happened" bodyClassName="p-0 sm:px-4">
            <div className="px-4 sm:px-0">
              <ActivityTimeline rows={deal.timeline} empty="Nothing has been recorded against this deal yet." />
            </div>
          </Panel>
          <Panel title="Files" description="Contracts, specifications and photos, kept with the deal">
            <CrmFiles kind="deal" id={deal._id} readOnly={!can("crm.edit")} />
          </Panel>
        </div>
      </div>

      {deal.notes && <Note className="mt-4">{deal.notes}</Note>}

      {dialog === "edit" && <EditDealDialog deal={deal} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />}
      {dialog === "move" && <MoveStageDialog deal={deal} stages={deal.pipeline || []} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />}
      {dialog === "log" && (
        <LogActivityDialog regarding={{ kind: "opportunity", id: deal._id }} defaultOwnerId={deal.ownerId} owners={owners} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />
      )}
      {dialog === "email" && (
        <EmailDialog
          regarding={{ kind: "opportunity", id: deal._id }}
          subject={deal.title ? `About ${deal.title}` : ""}
          notify={notify}
          onClose={() => setDialog(null)}
          onSent={() => refresh()}
        />
      )}
      {dialog === "meet" && (
        <MeetingDialog regarding={{ kind: "opportunity", id: deal._id }} defaultOwnerId={deal.ownerId} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />
      )}
      {dialog === "lose" && <LoseDialog title={`${deal.title} was lost`} onLose={(body) => crm.loseDeal(deal._id, body)} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />}
      {dialog === "assign" && (
        <AssignDialog title={`Hand over ${deal.title}`} owners={owners} current={deal.ownerId} onAssign={(ownerId) => crm.assignDeal(deal._id, ownerId)} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />
      )}
      {dialog === "reopen" && (
        <ReopenDialog deal={deal} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />
      )}
      {toastNode}
    </div>
  );
}

/** What a person can put right afterwards: what it is for, what it is worth, when it should close, the notes. The
 * stage is not here - that is Move, which records why - and nor is the customer, which would make it another deal. */
function EditDealDialog({ deal, notify, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    title: deal.title || "",
    value: deal.value ?? "",
    expectedCloseDate: deal.expectedCloseDate || "",
    notes: deal.notes || "",
    items: rules.dealLinesFrom(deal),
  }));
  const hasLines = form.items.some((l) => l.itemId || String(l.description || "").trim());
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event?.target ? event.target.value : event }));

  const save = async () => {
    const found = { ...rules.validateDeal({ ...form, customerId: deal.customerId }), ...rules.dealLineErrors(form.items) };
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      await crm.updateDeal(deal._id, {
        title: form.title.trim(),
        value: Number(form.value) || 0,
        expectedCloseDate: form.expectedCloseDate || undefined,
        notes: form.notes.trim(),
        items: rules.dealLinesBody(form.items),
      });
      notify?.("Saved");
      onSaved?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog title={`Edit ${deal.opportunityNo}`} confirmLabel="Save" size="md" busy={busy} problem={problem} onClose={onClose} onConfirm={save}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What the deal is for" required error={errors.title} className="sm:col-span-2">
          <TextInput value={form.title} onChange={set("title")} />
        </Field>
        <Field label="What it is worth" error={errors.value} hint={hasLines ? "The total of the lines below" : undefined}>
          {hasLines ? (
            <TextInput value={formatCurrencyAED(rules.dealLinesTotal(form.items))} readOnly aria-readonly="true" />
          ) : (
            <AmountInput inputClassName={inputClass} min="0" value={form.value} onChange={set("value")} />
          )}
        </Field>
        <Field label="Expected to close">
          <DateInput value={form.expectedCloseDate} onChange={set("expectedCloseDate")} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={form.notes} onChange={set("notes")} />
        </Field>
        <div className="sm:col-span-2">
          <DealLines lines={form.items} errors={errors} onChange={(items) => setForm((f) => ({ ...f, items }))} />
        </div>
      </div>
    </CrmDialog>
  );
}

/** What the deal is for, line by line: an item from the list or plain words, a quantity and a price before tax. */
function DealLines({ lines, errors = {}, onChange }) {
  const stocks = useAsync(() => api.get("/stock/stock"), []);
  const options = useMemo(() => (stocks.data?.stocks || []).map((s) => ({ value: s._id, label: pickerLabel(s), hint: s.itemId, price: s.salesPrice })), [stocks.data]);
  const put = (i, patch) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">What it is for</legend>
      {lines.length === 0 && <p className="text-sm text-muted-foreground">No lines: the deal is worth what you type above.</p>}
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_5rem_7rem_auto] sm:items-end">
          <Field label="Item">
            <SearchSelect
              aria-label={`Line ${i + 1} item`}
              value={l.itemId}
              options={options}
              placeholder="None: describe it"
              onChange={(v) => {
                const o = options.find((x) => x.value === v);
                put(i, { itemId: v || "", ...(o && !l.description ? { description: o.label } : {}), ...(o && l.price === "" && o.price != null ? { price: String(o.price) } : {}) });
              }}
            />
          </Field>
          <Field label="Description">
            <TextInput aria-label={`Line ${i + 1} description`} value={l.description} maxLength={200} onChange={(e) => put(i, { description: e.target.value })} />
          </Field>
          <Field label="Qty" error={errors[`items.${i}.qty`]}>
            <AmountInput aria-label={`Line ${i + 1} quantity`} inputClassName={inputClass} value={l.qty} onChange={(e) => put(i, { qty: e.target.value })} />
          </Field>
          <Field label="Price" error={errors[`items.${i}.price`]}>
            <AmountInput aria-label={`Line ${i + 1} price`} inputClassName={inputClass} value={l.price} onChange={(e) => put(i, { price: e.target.value })} />
          </Field>
          <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => onChange(lines.filter((_, j) => j !== i))} className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-status-danger lg:h-10 lg:w-10">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...lines, rules.emptyDealLine()])} className="inline-flex h-11 w-fit items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium lg:h-10">
        <Plus className="h-4 w-4" aria-hidden="true" /> Add a line
      </button>
    </fieldset>
  );
}

function ReopenDialog({ deal, notify, onClose, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const reopen = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await crm.reopenDeal(deal._id);
      notify?.("Open again");
      onSaved?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div role="dialog" aria-label="Reopen the deal" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-elevated">
        <h2 className="text-base font-semibold">Reopen {deal.title}?</h2>
        <p className="mt-1 text-sm text-muted-foreground">It goes back to the last open stage, not to the beginning.</p>
        {problem && (
          <Note tone="danger" className="mt-3">
            {problem}
          </Note>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
            Cancel
          </button>
          <button type="button" onClick={reopen} disabled={busy} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10">
            {busy ? "Reopening…" : "Reopen"}
          </button>
        </div>
      </div>
    </div>
  );
}
