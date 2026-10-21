// What this person owes, today: the worklist the whole module exists to keep short.
//
// It opens on whatever is LATE, then today's, then the week - a worklist that opens on an empty tab teaches people to
// ignore it. Marking one done asks what came of it and offers the next one pre-filled, which is how a deal never ends
// up with nothing owed.
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlarmClock, CalendarDays } from "lucide-react";
import { PageHeader, Panel, Spinner, PageSpinner, ErrorNote, EmptyState, DataTable, useAsync, useToasts } from "../accounting/kit.jsx";
import StatCard from "../ui/stat-card.jsx";
import { PillTabs } from "../salesDocs/parts.jsx";
import FilterBar, { FilterSelect } from "../lists/FilterBar.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";
import Can from "../shell/Can.jsx";
import { pageSession } from "../../lib/pageSession";
import { formatDate, todayInput } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { DuePill, KindIcon, DoneDialog, useOwners } from "./crmShared.jsx";
import TaskBoard from "./TaskBoard.jsx";

const session = pageSession("crm-followups");

const SCOPES = [
  ["mine", "Mine"],
  ["", "Everybody's"],
];

const VIEWS = [
  ["list", "List"],
  ["board", "Board"],
];

export default function FollowUpsPage() {
  const { me, can } = useOrganisation();
  const { notify, toastNode } = useToasts();
  const owners = useOwners();
  const [due, setDue] = useState(() => session.get("due", "overdue"));
  const [scope, setScope] = useState(() => session.get("scope", "mine"));
  const [kind, setKind] = useState(() => session.get("kind", ""));
  const [doing, setDoing] = useState(null);
  const [reload, setReload] = useState(0);
  // One concept, two ways to read it: the list is for working through what is owed, the board is for moving things
  // (to another day, to another person). Same rows either way - the board is handed what the list already fetched.
  const [view, setView] = useState(() => session.get("view", "list"));

  const keep = (setter, key) => (value) => {
    session.set(key, value);
    setter(value);
  };

  // Everything open, judged by the server; the tabs then only choose which of them to show, so the counts above the
  // list and the rows in it can never disagree.
  const list = useAsync(() => crm.followUps({ scope: scope || undefined, kind: kind || undefined }), [scope, kind, reload]);
  const all = useMemo(() => (Array.isArray(list.data) ? list.data : []), [list.data]);
  const today = todayInput(); // the organisation's own day (src/utils/format.js), which is what the server judged against
  const counts = useMemo(() => rules.dueCounts(all, today), [all, today]);

  const rows = useMemo(() => {
    if (due === "overdue") return all.filter((r) => r.dueState === "overdue");
    if (due === "today") return all.filter((r) => r.dueState === "today");
    if (due === "week") return all.filter((r) => ["overdue", "today", "soon"].includes(r.dueState));
    return all;
  }, [all, due]);

  const again = () => setReload((n) => n + 1);

  const columns = [
    {
      key: "subject",
      header: "What",
      card: "primary",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          <KindIcon kind={r.kind} className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-foreground">{r.subject}</span>
        </div>
      ),
    },
    { key: "kind", header: "How", card: "meta", cell: (r) => r.kindLabel || rules.kindLabel(r.kind) },
    { key: "owner", header: "Whose", card: "meta", cell: (r) => r.ownerName || "Nobody" },
    { key: "due", header: "Due", card: "title", cell: (r) => <span className="whitespace-nowrap">{r.dueAt ? formatDate(r.dueAt) : "–"}</span> },
    { key: "state", header: "", label: "Standing", card: "badge", cell: (r) => <DuePill state={r.dueState} /> },
    {
      key: "actions",
      header: "",
      label: "Actions",
      card: "actions",
      cell: (r) => (
        <div className="flex flex-wrap gap-2">
          <Can permission="crm.edit">
            <button type="button" onClick={() => setDoing(r)} className="h-10 rounded-lg border border-border px-3 text-xs font-medium lg:h-8">
              Done
            </button>
          </Can>
          {r.regarding?.kind === "opportunity" && (
            <Link to={`/crm/pipeline?deal=${r.regarding.id}`} className="grid h-10 place-items-center rounded-lg border border-border px-3 text-xs font-medium lg:h-8">
              The deal
            </Link>
          )}
          {r.regarding?.kind === "lead" && (
            <Link to={`/crm/leads?lead=${r.regarding.id}`} className="grid h-10 place-items-center rounded-lg border border-border px-3 text-xs font-medium lg:h-8">
              The lead
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Follow-ups" description={`What is owed${scope === "mine" ? ` by ${me?.name || "you"}` : " across the team"}, soonest first.`} />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard title="Late" count={counts.overdue} icon={<AlarmClock />} tone={counts.overdue ? "danger" : "teal"} subText={counts.overdue ? "Ring these first" : "Nothing is late"} />
        <StatCard title="Today" count={counts.today} icon={<CalendarDays />} tone={counts.today ? "warning" : undefined} />
        <StatCard title="This week" count={counts.week} icon={<CheckCircle2 />} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <PillTabs tabs={VIEWS} value={view} onChange={keep(setView, "view")} label="How to see them" />
        {view === "list" && (
          <PillTabs tabs={rules.DUE_TABS} value={due} onChange={keep(setDue, "due")} counts={{ overdue: counts.overdue, today: counts.today, week: counts.week, "": counts.all }} label="When" />
        )}
        <PillTabs tabs={SCOPES} value={scope} onChange={keep(setScope, "scope")} label="Whose" />
      </div>

      <div className="mt-4">
        <FilterBar active={Boolean(kind)} onClear={() => { session.remove("kind"); setKind(""); }}>
          <FilterSelect label="How" value={kind} onChange={keep(setKind, "kind")} options={rules.ACTIVITY_KINDS} allLabel="Any way" />
        </FilterBar>
      </div>

      {view === "board" && (
        <div className="mt-4">
          {list.loading && !list.data && <PageSpinner label="Reading your follow-ups" />}
          {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
          {list.data && (
            <TaskBoard rows={all} today={today} owners={owners} canEdit={can("crm.edit")} notify={notify} onChanged={again} onDone={setDoing} />
          )}
        </div>
      )}

      {view === "list" && (
      <Panel className="mt-4" bodyClassName="p-0">
        {list.loading && !list.data && <Spinner label="Reading your follow-ups" />}
        {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}
        {list.data && rows.length === 0 && (
          <EmptyState
            title={due === "overdue" ? "Nothing is late" : "Nothing owed"}
            text={due === "overdue" ? "Everything that was due has been done." : "A follow-up appears here by itself whenever a deal moves or an enquiry comes in."}
          />
        )}
        {rows.length > 0 && <DataTable caption="Follow-ups" rows={rows} rowKey={(r) => r._id} columns={columns} />}
      </Panel>
      )}

      {doing && <DoneDialog activity={doing} today={today} notify={notify} onClose={() => setDoing(null)} onSaved={() => { setDoing(null); again(); }} />}
      {toastNode}
      {owners.length > 0 && <p className="mt-8 text-xs text-muted-foreground">Follow-ups are created by the automation when a deal enters a stage, and by whoever rings a customer.</p>}
    </div>
  );
}
