// Leads: the enquiries, and what became of them. The list, the form, and one lead's own page with its story on it.
//
// The automation is visible here rather than hidden: a new enquiry is given an owner and a first follow-up by itself,
// and the screen says so after saving instead of leaving the person to wonder.
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Flame, UserPlus, AlarmClock, ArrowLeft, Download } from "lucide-react";
import { PageHeader, Panel, Spinner, ErrorNote, EmptyState, DataTable, useAsync, useToasts, Field, TextInput, Textarea, Select, SearchSelect, inputClass } from "../accounting/kit.jsx";
import StatCard from "../ui/stat-card.jsx";
import FilterBar, { FilterSelect } from "../lists/FilterBar.jsx";
import { PillTabs, Note } from "../salesDocs/parts.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";
import Can from "../shell/Can.jsx";
import { useRecordRoute } from "../../lib/useRecordRoute";
import { pageSession } from "../../lib/pageSession";
import { formatCurrencyAED, formatDate, formatDateTime, downloadCSV } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import {
  StatusPill, BandPill, ActivityTimeline, CrmDialog, LogActivityDialog, LoseDialog, AssignDialog, QualifyDialog, OwnerSelect, useOwners,
} from "./crmShared.jsx";

const session = pageSession("crm-leads");

const VIEWS = [
  ["open", "In hand"],
  ["NEW", "New"],
  ["CONTACTED", "Contacted"],
  ["QUALIFIED", "Qualified"],
  ["CONVERTED", "Became customers"],
  ["LOST", "Lost"],
];

function LeadForm({ lead, owners, onClose, onSaved, notify }) {
  const [form, setForm] = useState(() => (lead ? { ...rules.emptyLead(), ...lead, expectedValue: lead.expectedValue || "" } : rules.emptyLead()));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [maybe, setMaybe] = useState(null);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event?.target ? event.target.value : event }));

  // Somebody we may already know: a warning while they type, never a refusal - the same person does enquire twice.
  const lookForDuplicates = async () => {
    if (lead) return;
    try {
      const found = await crm.duplicates({ phone: form.phone, email: form.email });
      const hits = [...(found.leads || []), ...(found.customers || [])];
      setMaybe(hits.length ? found : null);
    } catch {
      setMaybe(null);
    }
  };

  const save = async () => {
    const found = rules.validateLead(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = rules.leadBody(form);
      if (lead) {
        await crm.updateLead(lead._id, body);
        notify?.("Saved");
      } else {
        const made = await crm.createLead(body);
        notify?.(made.ownerName ? `${made.leadNo} saved and given to ${made.ownerName}, with a first call due today` : `${made.leadNo} saved`);
      }
      onSaved?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog title={lead ? `Edit ${lead.leadNo}` : "New enquiry"} confirmLabel={lead ? "Save" : "Save the enquiry"} size="md" busy={busy} problem={problem} onClose={onClose} onConfirm={save}>
      {maybe && (
        <Note tone="warning" className="mb-3">
          We may know them already:{" "}
          {[...(maybe.leads || []).map((l) => `${l.name} (${l.leadNo})`), ...(maybe.customers || []).map((c) => `${c.customerName} (${c.customerId})`)].join(", ")}. Saving this anyway is fine.
        </Note>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required error={errors.name}>
          <TextInput value={form.name} onChange={set("name")} placeholder="Who rang?" />
        </Field>
        <Field label="Company">
          <TextInput value={form.company} onChange={set("company")} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <TextInput value={form.phone} onChange={set("phone")} onBlur={lookForDuplicates} inputMode="tel" />
        </Field>
        <Field label="Email" error={errors.email}>
          <TextInput value={form.email} onChange={set("email")} onBlur={lookForDuplicates} inputMode="email" />
        </Field>
        <Field label="Where it came from">
          <Select value={form.source} onChange={set("source")}>
            {rules.SOURCES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="More about that" hint="The exhibition, who referred them">
          <TextInput value={form.sourceNote} onChange={set("sourceNote")} />
        </Field>
        <Field label="What they want" className="sm:col-span-2">
          <TextInput value={form.interest} onChange={set("interest")} placeholder="Monthly rice and oil" />
        </Field>
        <Field label="What it may be worth" error={errors.expectedValue}>
          <input className={inputClass} type="number" min="0" value={form.expectedValue} onChange={set("expectedValue")} />
        </Field>
        <Field label="Who should chase it" hint={lead ? undefined : "Left empty, it is given out automatically"}>
          <OwnerSelect value={form.ownerId} onChange={(v) => setForm((f) => ({ ...f, ownerId: v }))} owners={owners} />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={form.notes} onChange={set("notes")} />
        </Field>
      </div>
    </CrmDialog>
  );
}

/** One lead: who they are, what has happened, and the one action that turns it into business. */
function LeadView({ id, onBack, onChanged, notify, owners }) {
  const { can } = useOrganisation();
  const [dialog, setDialog] = useState(null);
  const [reload, setReload] = useState(0);
  const { data: lead, loading, error, reload: again } = useAsync(() => crm.lead(id), [id, reload]);
  const refresh = () => {
    setReload((n) => n + 1);
    onChanged?.();
  };

  if (loading && !lead) return <Spinner label="Reading the enquiry" />;
  if (error) return <ErrorNote error={error} onRetry={again} />;
  if (!lead) return null;

  const open = lead.actions?.qualify;
  return (
    <div className="mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All leads
      </button>
      <PageHeader
        title={lead.name}
        description={`${lead.leadNo}${lead.company ? ` · ${lead.company}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {open && (
              <Can permission="crm.edit">
                <button type="button" onClick={() => setDialog("qualify")} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground lg:h-10">
                  Qualify
                </button>
              </Can>
            )}
            {open && (
              <Can permission="crm.create">
                <button type="button" onClick={() => setDialog("log")} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
                  Log a follow-up
                </button>
              </Can>
            )}
            {open && (
              <Can permission="crm.edit">
                <button type="button" onClick={() => setDialog("lose")} className="h-11 rounded-lg border border-border px-4 text-sm font-medium text-status-danger lg:h-10">
                  Came to nothing
                </button>
              </Can>
            )}
          </div>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="The enquiry" className="lg:col-span-1">
          <dl className="grid gap-2 text-sm">
            <Fact label="Status">
              <div className="flex flex-wrap gap-1.5">
                <StatusPill status={lead.status} />
                <BandPill band={lead.band} score={lead.score} />
              </div>
            </Fact>
            <Fact label="Phone">{lead.phone || "–"}</Fact>
            <Fact label="Email">{lead.email || "–"}</Fact>
            <Fact label="Where from">{rules.sourceLabel(lead.source)}{lead.sourceNote ? ` · ${lead.sourceNote}` : ""}</Fact>
            <Fact label="Wants">{lead.interest || "–"}</Fact>
            <Fact label="May be worth">{formatCurrencyAED(lead.expectedValue)}</Fact>
            <Fact label="Chased by">{lead.ownerName || "Nobody"}</Fact>
            <Fact label="Next action">{lead.nextActionAt ? formatDate(lead.nextActionAt) : "Nothing planned"}</Fact>
            <Fact label="Came in">{formatDateTime(lead.createdAt)}</Fact>
            {lead.lostReason && <Fact label="Lost because">{rules.lostLabel(lead.lostReason)}{lead.lostNote ? ` · ${lead.lostNote}` : ""}</Fact>}
          </dl>
          {lead.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-secondary/50 p-3 text-sm">{lead.notes}</p>}
          {(can("crm.edit") || can("crm.assign")) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {open && (
                <Can permission="crm.edit">
                  <button type="button" onClick={() => setDialog("edit")} className="h-10 rounded-lg border border-border px-3 text-sm font-medium">
                    Edit
                  </button>
                </Can>
              )}
              {open && (
                <Can permission="crm.assign">
                  <button type="button" onClick={() => setDialog("assign")} className="h-10 rounded-lg border border-border px-3 text-sm font-medium">
                    Hand over
                  </button>
                </Can>
              )}
            </div>
          )}
        </Panel>

        <Panel title="What has happened" className="lg:col-span-2" bodyClassName="p-0 sm:px-4">
          <div className="px-4 sm:px-0">
            <ActivityTimeline rows={lead.timeline} empty="Nothing has been recorded against this enquiry yet." />
          </div>
        </Panel>
      </div>

      {lead.opportunity && (
        <Note tone="teal" className="mt-4">
          It became {lead.opportunity.opportunityNo} ({lead.opportunity.title}), now on {lead.opportunity.stageName}.
        </Note>
      )}

      {dialog === "edit" && <LeadForm lead={lead} owners={owners} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />}
      {dialog === "log" && <LogActivityDialog regarding={{ kind: "lead", id: lead._id }} defaultOwnerId={lead.ownerId} owners={owners} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />}
      {dialog === "lose" && <LoseDialog title={`${lead.name} came to nothing`} onLose={(body) => crm.loseLead(lead._id, body)} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />}
      {dialog === "assign" && <AssignDialog title={`Hand over ${lead.name}`} owners={owners} current={lead.ownerId} onAssign={(ownerId) => crm.assignLead(lead._id, ownerId)} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />}
      {dialog === "qualify" && <QualifyDialog lead={lead} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); refresh(); }} />}
    </div>
  );
}

const Fact = ({ label, children }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-1.5 last:border-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="text-sm font-medium text-foreground">{children}</dd>
  </div>
);

export default function LeadsPage() {
  const { can } = useOrganisation();
  const { notify, toastNode } = useToasts();
  const owners = useOwners();
  const record = useRecordRoute({ param: "lead" });
  const [view, setView] = useState(() => session.get("view", "open"));
  const [source, setSource] = useState(() => session.get("source", ""));
  const [band, setBand] = useState(() => session.get("band", ""));
  const [search, setSearch] = useState(() => session.get("search", ""));
  const [owner, setOwner] = useState(() => session.get("owner", ""));
  const [dialog, setDialog] = useState(null);
  const [reload, setReload] = useState(0);

  const keep = (setter, key) => (value) => {
    session.set(key, value);
    setter(value);
  };

  const query = useMemo(
    () => ({
      view: view === "open" ? "open" : undefined,
      status: VIEWS.some(([v]) => v === view) && view !== "open" ? view : undefined,
      source: source || undefined,
      band: band || undefined,
      ownerId: owner || undefined,
      search: search || undefined,
    }),
    [view, source, band, owner, search]
  );

  const list = useAsync(() => crm.leads(query), [query, reload]);
  const summary = useAsync(() => crm.leadSummary(), [reload]);
  const again = () => setReload((n) => n + 1);
  const rows = Array.isArray(list.data) ? list.data : [];
  const filtersOn = Boolean(source || band || owner || search);
  // What is on the screen, with the filters that made it - not a different list from a second request.
  const exportLeads = () => {
    const { headers, rows: lines } = rules.leadsCsv(rows);
    downloadCSV(`crm-leads-${new Date().toISOString().slice(0, 10)}.csv`, headers, lines);
  };

  if (record.recordId) {
    return (
      <>
        <LeadView id={record.recordId} owners={owners} notify={notify} onBack={() => record.close()} onChanged={again} />
        {toastNode}
      </>
    );
  }

  const columns = [
    {
      key: "leadNo",
      header: "Lead",
      card: "primary",
      // A real link, not only a clickable row: it can be tabbed to, opened in a new tab, and read by anything that
      // works through the page's own controls.
      cell: (r) => (
        <Link to={`/crm/leads?lead=${r._id}`} className="inline-flex min-h-10 items-center whitespace-nowrap font-medium hover:underline lg:min-h-0">
          {r.leadNo}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Who",
      card: "title",
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{r.name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.company || r.phone || r.email}</p>
        </div>
      ),
    },
    { key: "source", header: "From", label: "Where from", card: "meta", cell: (r) => rules.sourceLabel(r.source) },
    { key: "owner", header: "Chased by", card: "meta", cell: (r) => r.ownerName || "Nobody" },
    { key: "band", header: "How warm", card: "badge", cell: (r) => <BandPill band={r.band} score={r.score} /> },
    { key: "status", header: "Status", card: "badge", cell: (r) => <StatusPill status={r.status} /> },
    {
      key: "next",
      header: "Next action",
      card: "meta",
      cell: (r) => (r.nextActionAt ? <span className={r.overdueAction ? "text-status-danger" : ""}>{formatDate(r.nextActionAt)}</span> : <span className="text-muted-foreground">–</span>),
    },
    { key: "value", header: "May be worth", align: "end", card: "amount", cell: (r) => formatCurrencyAED(r.expectedValue) },
  ];

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Leads"
        description="Enquiries from people who are not customers yet. Every one gets an owner and a first call by itself."
        actions={
          <div className="flex flex-wrap gap-2">
            {rows.length > 0 && (
              <button type="button" onClick={exportLeads} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
                <Download className="h-4 w-4" aria-hidden="true" /> Export
              </button>
            )}
            <Can permission="crm.create">
              <button type="button" data-shortcut="new" onClick={() => setDialog("new")} className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground lg:h-10">
                <Plus className="h-4 w-4" aria-hidden="true" /> New enquiry
              </button>
            </Can>
          </div>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="In hand" count={summary.data?.open ?? "–"} subText={summary.data ? `${formatCurrencyAED(summary.data.openValue)} of enquiries` : ""} />
        <StatCard title="Hot" count={summary.data?.hot ?? "–"} icon={<Flame />} tone={summary.data?.hot ? "teal" : undefined} subText="Worth ringing today" />
        <StatCard title="Nobody chasing" count={summary.data?.unassigned ?? "–"} icon={<UserPlus />} tone={summary.data?.unassigned ? "warning" : undefined} subText="Give them to somebody" />
        <StatCard title="Follow-ups late" count={summary.data?.overdueFollowUps ?? "–"} icon={<AlarmClock />} tone={summary.data?.overdueFollowUps ? "danger" : undefined} />
      </div>

      <div className="mt-6">
        <PillTabs tabs={VIEWS} value={view} onChange={keep(setView, "view")} label="Which leads" />
      </div>

      <div className="mt-4">
        <FilterBar search={search} onSearch={keep(setSearch, "search")} placeholder="Search a name, a company, a number…" searchLabel="Search leads" active={filtersOn} onClear={() => { ["source", "band", "owner", "search"].forEach((k) => session.remove(k)); setSource(""); setBand(""); setOwner(""); setSearch(""); }}>
          <FilterSelect label="Where from" value={source} onChange={keep(setSource, "source")} options={rules.SOURCES} allLabel="Anywhere" />
          <FilterSelect label="How warm" value={band} onChange={keep(setBand, "band")} options={rules.BANDS} allLabel="Any" />
          <FilterSelect label="Chased by" value={owner} onChange={keep(setOwner, "owner")} options={owners.map((o) => [o.id, o.name])} allLabel="Anybody" />
        </FilterBar>
      </div>

      <Panel className="mt-4" bodyClassName="p-0">
        {list.loading && !list.data && <Spinner label="Reading the leads" />}
        {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && (
          <EmptyState
            title={filtersOn ? "Nothing matches" : "No enquiries yet"}
            text={filtersOn ? "Clear the filters to see the rest." : "The first enquiry you take goes here, and the app gives it an owner and a first call."}
            action={
              !filtersOn && can("crm.create") ? (
                <button type="button" onClick={() => setDialog("new")} className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground lg:h-10">
                  New enquiry
                </button>
              ) : null
            }
          />
        )}
        {/* Six columns do not fit a tablet (the sweep measured 836px inside 820) and the last one was lost off the
            edge. DataTable already owns the scroll box - `className` lands on it - so it only wanted `table-pin-first`:
            the lead number freezes and the rest slides under it. Below md this never applies; DataTable draws cards. */}
        {rows.length > 0 && (
          <DataTable
            className="table-pin-first"
            caption="Leads"
            rows={rows}
            rowKey={(r) => r._id}
            onRowClick={(r) => record.open(r._id)}
            columns={columns}
          />
        )}
      </Panel>

      {dialog === "new" && <LeadForm owners={owners} notify={notify} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); again(); }} />}
      {toastNode}
    </div>
  );
}
