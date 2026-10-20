// The CRM's own front page: what is late, what is mine, and what the documents did by themselves.
//
// The third panel is the module's whole argument. Every other CRM asks a person to drag a card from one column to the
// next; here a quotation that was sent and an invoice that was approved move the deal, and this panel names the
// document that did it. It is the answer to "it says Won and nobody touched it".
import React from "react";
import { Link } from "react-router-dom";
import { AlarmClock, Handshake, Sparkles, Target, TrendingUp } from "lucide-react";
import { PageHeader, Panel, Spinner, ErrorNote, EmptyState, DataTable, useAsync } from "../accounting/kit.jsx";
import StatCard from "../ui/stat-card.jsx";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import { DuePill, KindIcon, StagePill, Tag } from "./crmShared.jsx";

export default function CrmDashboard() {
  const { data, loading, error, reload } = useAsync(() => crm.dashboard(), []);

  if (loading && !data) return <Spinner label="Reading the pipeline" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  const { late = [], mine = [], moved = [], topDeals = [], funnel = [] } = data;
  const follow = (caption, rows, emptyTitle, emptyText, withOwner) => (
    <DataTable
      caption={caption}
      rows={rows}
      rowKey={(r) => r._id}
      empty={<EmptyState title={emptyTitle} text={emptyText} />}
      columns={[
        { key: "kind", header: "", label: "Kind", card: "badge", cell: (r) => <KindIcon kind={r.kind} /> },
        { key: "subject", header: "What", card: "primary", cell: (r) => <span className="font-medium">{r.subject}</span> },
        ...(withOwner ? [{ key: "owner", header: "Whose", card: "meta", cell: (r) => r.ownerName || "Nobody" }] : []),
        { key: "due", header: "Due", card: "amount", cell: (r) => <DuePill state={r.dueState} /> },
      ]}
    />
  );

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="CRM" description={`Where every enquiry stands, as at ${formatDate(data.today)}.`} />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Open enquiries" count={data.openLeads} icon={<Target />} />
        <StatCard title="Deals in play" count={data.openDeals} icon={<Handshake />} subText={formatCurrencyAED(data.pipelineValue)} />
        <StatCard title="Likely to close" count={formatCurrencyAED(data.weightedValue)} icon={<TrendingUp />} tone="teal" subText="Weighted by stage" />
        <StatCard
          title="Late"
          count={data.overdue}
          icon={<AlarmClock />}
          tone={data.overdue ? "danger" : "teal"}
          subText={data.overdue ? "Ring these first" : "Nothing is late"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="What is late" description="Across the team, oldest first." bodyClassName="p-0 sm:px-2">
          {follow("Late follow-ups", late, "Nothing is late", "Every follow-up is either done or still has time.", true)}
        </Panel>
        <Panel title="My follow-ups" description="What you owe this week." bodyClassName="p-0 sm:px-2">
          {follow("My follow-ups", mine, "Nothing on your list", "When a deal moves, the next follow-up appears here by itself.", false)}
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Moved by itself"
        description="Deals the documents advanced this week. Nobody dragged a card."
        bodyClassName="p-0 sm:px-2"
      >
        <DataTable
          caption="Moved by itself"
          rows={moved}
          rowKey={(r) => `${r.dealId}:${r.event}:${r.at}`}
          empty={
            <EmptyState
              title="Nothing has moved this week"
              text="Send a quotation or approve an invoice and the deal in front of it moves here on its own."
            />
          }
          columns={[
            { key: "spark", header: "", label: "", card: "badge", cell: () => <Sparkles className="h-4 w-4 text-status-teal" aria-hidden="true" /> },
            {
              key: "deal",
              header: "Deal",
              card: "primary",
              cell: (r) => (
                <Link to={`/crm/pipeline?deal=${r.dealId}`} className="font-medium text-foreground hover:underline">
                  {r.title}
                </Link>
              ),
            },
            { key: "customer", header: "Customer", card: "title", cell: (r) => r.customerName || "" },
            {
              key: "why",
              header: "What did it",
              card: "meta",
              cell: (r) => (
                <span>
                  {r.eventLabel}
                  {r.docNo ? <span className="text-muted-foreground"> · {r.docNo}</span> : null}
                </span>
              ),
            },
            { key: "to", header: "Now on", card: "amount", cell: (r) => <Tag tone="info">{r.stageName || r.to}</Tag> },
            { key: "at", header: "When", card: "hidden", cell: (r) => formatDate(r.at) },
          ]}
        />
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Worth the most" description="Open deals, by value weighted for the stage they stand on." bodyClassName="p-0 sm:px-2">
          <DataTable
            caption="Biggest deals"
            rows={topDeals}
            rowKey={(r) => r._id}
            empty={<EmptyState title="No deals yet" text="Qualify an enquiry and it appears here." />}
            columns={[
              {
                key: "title",
                header: "Deal",
                card: "primary",
                cell: (r) => (
                  <Link to={`/crm/pipeline?deal=${r._id}`} className="font-medium text-foreground hover:underline">
                    {r.title}
                  </Link>
                ),
              },
              { key: "customer", header: "Customer", card: "title", cell: (r) => r.customerName || "" },
              { key: "stage", header: "Stage", card: "badge", cell: (r) => <StagePill deal={{ ...r, status: "OPEN" }} /> },
              { key: "weighted", header: "Likely", card: "amount", align: "end", cell: (r) => formatCurrencyAED(r.weighted) },
            ]}
          />
        </Panel>

        <Panel title="The pipeline" description="How many deals stand on each stage." bodyClassName="p-0 sm:px-2">
          <DataTable
            caption="Pipeline by stage"
            rows={funnel}
            rowKey={(r) => r.key}
            empty={<EmptyState title="Nothing in the pipeline" text="Qualified enquiries become deals and show up here." />}
            columns={[
              { key: "name", header: "Stage", card: "primary", cell: (r) => <Tag tone="info">{r.name}</Tag> },
              { key: "count", header: "Deals", card: "meta", align: "end", cell: (r) => r.count },
              { key: "value", header: "Value", card: "amount", align: "end", cell: (r) => formatCurrencyAED(r.value) },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
