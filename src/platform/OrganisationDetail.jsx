import React, { useCallback, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "../lib/utils";
import { ConfirmDialog, ErrorNote, PageHeader, Pill, Spinner, useAsync, useToasts } from "../components/accounting/kit";
import { consoleError, platform } from "./platformApi";
import { stateLabel } from "./platformForms";
import { ActivityTab, BranchesTab, CompanyTab, OverviewTab, PeopleTab, PlanTab, SubscriptionTab } from "./detailTabs";

const TABS = [
  { id: "overview", label: "Overview", Component: OverviewTab },
  { id: "plan", label: "Plan and features", Component: PlanTab },
  { id: "subscription", label: "Subscription", Component: SubscriptionTab },
  { id: "company", label: "Company", Component: CompanyTab },
  { id: "people", label: "People", Component: PeopleTab },
  { id: "branches", label: "Branches", Component: BranchesTab },
  { id: "activity", label: "Activity", Component: ActivityTab },
];

// One organisation, as the developer sees it: where it stands, what its plan gives it, and everything that can be
// changed for it. Each tab saves on its own; every change is written to the console's activity log.
export default function OrganisationDetail() {
  const { code } = useParams();
  const [params, setParams] = useSearchParams();
  const tabId = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "overview";
  const { notify, toastNode } = useToasts();
  const detail = useAsync(() => platform.organisation(code), [code]);
  const catalog = useAsync(() => platform.catalog(), []);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  // One way every tab changes something: run it, say how it went in the server's own words, show the result.
  const run = useCallback(
    async (action, done) => {
      setBusy(true);
      try {
        const result = await action();
        if (done) notify(done);
        await detail.reload();
        return result;
      } catch (error) {
        notify(consoleError(error), "error");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [detail, notify]
  );

  if (detail.loading && !detail.data) return <Spinner label="Loading organisation" />;
  if (detail.error && !detail.data) {
    return (
      <>
        <Link to="/platform" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Organisations</Link>
        <ErrorNote error={{ message: consoleError(detail.error) }} onRetry={detail.reload} />
      </>
    );
  }

  const d = detail.data;
  const org = d.organisation;
  const label = stateLabel(d.state);
  const Active = TABS.find((t) => t.id === tabId).Component;
  const suspended = org.status === "suspended";

  const changeStatus = (status, text, danger) =>
    setConfirm({
      title: text.title,
      text: text.body,
      danger,
      confirmLabel: text.button,
      onConfirm: async () => {
        await run(() => platform.setStatus(code, status), text.done);
        setConfirm(null);
      },
    });

  return (
    <>
      <Link to="/platform" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Organisations
      </Link>
      <PageHeader
        title={org.legalName}
        description={`${org.code} · ${org.country} · books in ${org.baseCurrency} · ${org.timezone} · ${org.planCode} plan`}
        actions={
          <>
            <Pill tone={label.tone} className="self-center">{label.text}</Pill>
            {suspended ? (
              <button type="button" disabled={busy} onClick={() => changeStatus("active", { title: "Reopen this organisation?", body: "Its people can sign in and work again at once.", button: "Reopen", done: "Reopened" }, false)} className="inline-flex h-11 items-center justify-center rounded-full border border-input bg-card px-4 text-sm font-medium hover:bg-accent lg:h-10">
                Reopen
              </button>
            ) : (
              <button type="button" disabled={busy || org.status === "closed"} onClick={() => changeStatus("suspended", { title: "Suspend this organisation?", body: "Nobody in it can sign in or use the system until it is reopened. Their records are kept.", button: "Suspend", done: "Suspended" }, true)} className="inline-flex h-11 items-center justify-center rounded-full border border-status-danger/40 bg-card px-4 text-sm font-medium text-status-danger hover:bg-status-danger-soft lg:h-10">
                Suspend
              </button>
            )}
          </>
        }
      />

      <div role="tablist" aria-label="Organisation" className="erp-scroll -mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-border px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tabId}
            onClick={() => setParams(t.id === "overview" ? {} : { tab: t.id }, { replace: true })}
            className={cn(
              "h-11 shrink-0 whitespace-nowrap border-b-2 px-3.5 text-sm font-medium transition-colors lg:h-10",
              t.id === tabId ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {catalog.error && <div className="mb-4"><ErrorNote error={{ message: consoleError(catalog.error) }} onRetry={catalog.reload} /></div>}
      <Active detail={d} catalog={catalog.data} code={code} run={run} busy={busy} notify={notify} reload={detail.reload} />

      {confirm && <ConfirmDialog {...confirm} busy={busy} onClose={() => setConfirm(null)} />}
      {toastNode}
    </>
  );
}
