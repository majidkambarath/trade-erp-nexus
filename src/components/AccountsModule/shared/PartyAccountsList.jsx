import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Gauge, Scale, Search, Users, Wallet } from "lucide-react";
import { cn } from "../../../lib/utils";
import { CURRENCY, downloadCSV, formatNumber } from "../../../utils/format";
import { partyAccountApi } from "../../../lib/partyAccountApi";
import { Button } from "../../ui/button";
import StatCard from "../../ui/stat-card";
import { Balance, DataTable, EmptyState, ErrorNote, Panel, Pill, Select, TextInput, useAsync } from "../../accounting/kit";
import { PageTitle, Skeleton, UsedBar } from "./partyAccountParts";
import { CREDIT_STATUS, KINDS, netOf, sideText } from "./partyAccountUtils";

const PAGE_SIZES = [10, 25, 50];

const FILTERS = {
  customer: [
    { id: "all", label: "All" },
    { id: "owing", label: "Owing" },
    { id: "overdue", label: "Overdue" },
    { id: "limit", label: "Near or over limit" },
  ],
  vendor: [
    { id: "all", label: "All" },
    { id: "owing", label: "Owed" },
    { id: "overdue", label: "Overdue" },
  ],
};

const matchesFilter = (id, r) => {
  if (id === "owing") return (r.balance || 0) > 0.005;
  if (id === "overdue") return (r.overdue || 0) > 0.005;
  if (id === "limit") return r.status === "near" || r.status === "over";
  return true;
};

/**
 * Receivables (customers) or Payables (vendors): one row per party with its ledger balance, what is
 * overdue and, for customers, how much of the credit limit is used. The party rows come from the
 * legacy account list; the figures come from the ledger, so a row agrees with that party's own page.
 */
export default function PartyAccountsList({ kind }) {
  const k = KINDS[kind];
  const accounts = useAsync(() => partyAccountApi.accounts(kind), [kind]);
  const balances = useAsync(() => partyAccountApi.balances(kind), [kind]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const ledger = balances.data;
  const rows = useMemo(() => {
    const byParty = new Map((ledger?.rows || []).map((r) => [String(r.partyId), r]));
    return (accounts.data || [])
      .map((a) => {
        const b = byParty.get(String(a._id));
        return {
          id: a._id,
          code: a.partyId || "",
          name: a.name || "",
          documents: a.totalInvoices || 0,
          // a party the ledger has never touched owes nothing; before the ledger answers, unknown
          balance: b ? b.balance : ledger ? 0 : null,
          overdue: b ? b.overdue || 0 : ledger ? 0 : null,
          terms: b?.paymentTerms || "",
          creditLimit: b?.creditLimit,
          utilisation: b?.utilisation,
          status: b?.status,
        };
      })
      .sort((a, b) => (b.balance ?? -Infinity) - (a.balance ?? -Infinity) || a.name.localeCompare(b.name));
  }, [accounts.data, ledger]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => matchesFilter(filter, r) && (!q || `${r.name} ${r.code}`.toLowerCase().includes(q)));
  }, [rows, search, filter]);

  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pages);
  const slice = visible.slice((current - 1) * pageSize, current * pageSize);
  const first = visible.length ? (current - 1) * pageSize + 1 : 0;

  const t = ledger?.totals;
  const dash = "–";
  const sign = k.sign;
  const customer = kind === "customer";

  function exportCsv() {
    const heads = customer
      ? ["Customer ID", "Customer", "Documents", "Balance", "Credit limit", "Credit used %", "Overdue"]
      : ["Vendor ID", "Vendor", "Documents", "Balance", "Payment terms", "Overdue"];
    const body = visible.map((r) => {
      const bal = r.balance === null ? "" : sideText(sign * r.balance);
      return customer
        ? [r.code, r.name, r.documents, bal, r.creditLimit || "", r.creditLimit > 0 ? r.utilisation : "", r.overdue ?? ""]
        : [r.code, r.name, r.documents, bal, r.terms, r.overdue ?? ""];
    });
    downloadCSV(`${k.title.toLowerCase()}.csv`, heads, body);
  }

  const reloadAll = () => { accounts.reload(); balances.reload(); };
  const clear = () => { setSearch(""); setFilter("all"); setPage(1); };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageTitle
        title={k.title}
        description={customer ? "What each customer owes you, how much of their credit limit is used and what is overdue. Open a customer for the full statement." : "What you owe each vendor and what is overdue. Open a vendor for the full statement."}
        actions={<Button type="button" variant="outline" onClick={exportCsv} disabled={!visible.length}><Download className="h-4 w-4" aria-hidden="true" />Export CSV</Button>}
      />

      <section aria-label="Totals" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title={customer ? "Customers" : "Vendors"} icon={<Users />} tone="teal" count={accounts.data ? String(accounts.data.length) : dash} subText="On the books" />
        <StatCard
          title={customer ? "Total receivable" : "Total payable"}
          icon={<Scale />}
          tone="plum"
          count={t ? <Balance net={sign * t.owed} /> : dash}
          subText={`${CURRENCY} · ${customer ? "customers owe you" : "you owe vendors"}`}
        />
        <StatCard
          title="Overdue"
          icon={<AlertTriangle />}
          tone={t?.overdue > 0 ? "warning" : "olive"}
          count={t ? formatNumber(t.overdue, 2) : dash}
          subText={t?.overdue > 0 ? `${CURRENCY} · past the due date` : t ? "Nothing is overdue" : "Loading"}
        />
        {customer ? (
          <StatCard
            title="Near or over limit"
            icon={<Gauge />}
            tone={t?.overLimit > 0 ? "danger" : t?.nearLimit > 0 ? "warning" : "olive"}
            count={t ? String(t.overLimit + t.nearLimit) : dash}
            subText={t ? `${t.overLimit} over, ${t.nearLimit} near the limit` : "Loading"}
          />
        ) : (
          <StatCard title="Paid in advance" icon={<Wallet />} tone="olive" count={t ? <Balance net={t.advances} /> : dash} subText={`${CURRENCY} · paid ahead of invoices`} />
        )}
      </section>

      {balances.error && (
        <div className="mb-4"><ErrorNote error={balances.error} onRetry={balances.reload} /></div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative w-full sm:max-w-xs">
          <label htmlFor={`${kind}-search`} className="sr-only">Search {k.nounPlural} by name or ID</label>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <TextInput id={`${kind}-search`} type="search" className="ps-9" placeholder={`Search ${k.nounPlural} by name or ID`} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <div role="group" aria-label="Show" className="flex flex-wrap items-center gap-2">
          {FILTERS[kind].map((f) => (
            <Button key={f.id} type="button" variant="outline" aria-pressed={filter === f.id} className={cn(filter === f.id && "border-ring bg-accent")} onClick={() => { setFilter(f.id); setPage(1); }}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <Panel bodyClassName="p-0" title={`${customer ? "Customer" : "Vendor"} accounts`} description={accounts.data ? `${visible.length} of ${rows.length} shown, largest balance first` : undefined}>
        {accounts.loading && !accounts.data && (
          <div className="space-y-2 p-5" aria-busy="true" role="status" aria-label={`Loading ${k.nounPlural}`}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}
        {accounts.error && <div className="p-5"><ErrorNote error={accounts.error} onRetry={reloadAll} /></div>}
        {accounts.data && rows.length === 0 && (
          <EmptyState
            title={`No ${k.nounPlural} yet`}
            text={`${customer ? "Customers" : "Vendors"} appear here once they are created.`}
            action={<Button asChild variant="outline"><Link to={k.managePath}>Go to {k.manageLabel}</Link></Button>}
          />
        )}
        {accounts.data && rows.length > 0 && visible.length === 0 && (
          <EmptyState title={`No ${k.nounPlural} match`} text="Try a different name or ID, or show everyone again." action={<Button type="button" variant="outline" onClick={clear}>Clear search and filters</Button>} />
        )}
        {slice.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <DataTable
                caption={`${customer ? "Customer" : "Vendor"} balances`}
                rows={slice}
                rowKey={(r) => r.id}
                rowHref={(r) => k.detailPath(r.id)}
                columns={[
                  { key: "party", header: customer ? "Customer" : "Vendor", card: "primary", cell: (r) => (<><Link to={k.detailPath(r.id)} onClick={(e) => e.stopPropagation()} className="rounded font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{r.name}</Link><div className="font-mono text-xs font-normal text-muted-foreground">{r.code}</div></>) },
                  { key: "documents", header: "Documents", align: "end", card: "meta", className: "tabular-nums", cell: (r) => `${r.documents} documents` },
                  { key: "balance", header: k.balanceTitle, align: "end", card: "amount", className: "font-medium", cell: (r) => r.balance === null ? dash : <Balance net={netOf(kind, r.balance)} /> },
                  {
      key: "credit",
      header: customer ? "Credit used" : "Payment terms",
      card: customer ? "title" : "meta",
      className: customer ? undefined : "whitespace-nowrap text-muted-foreground",
      cell: (r) => {
        if (!customer) return r.terms || dash;
        const s = CREDIT_STATUS[r.status];
        return s && r.creditLimit > 0 ? (
          <div className="flex items-center gap-2 md:min-w-[10rem]">
            <UsedBar className="w-20" utilisation={r.utilisation} status={r.status} label={`Credit used by ${r.name}`} />
            <span className="tabular-nums">{formatNumber(r.utilisation, 0)}%</span>
            {r.status !== "ok" && <Pill tone={s.tone}>{s.label}</Pill>}
          </div>
        ) : (
          <span className="text-muted-foreground">{r.status === "no-limit" ? "No limit" : dash}</span>
        );
      },
    },
                  { key: "overdue", header: "Overdue", align: "end", card: "meta", cell: (r) => r.overdue === null ? dash : r.overdue > 0 ? <span className="font-medium tabular-nums text-status-warning">{formatNumber(r.overdue, 2)} overdue</span> : dash },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 text-sm text-muted-foreground print:hidden">
              <div className="flex items-center gap-2">
                <label htmlFor={`${kind}-page-size`}>Rows per page</label>
                <Select id={`${kind}-page-size`} className="h-9 w-20" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span aria-live="polite">{first}-{first + slice.length - 1} of {visible.length}</span>
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 lg:h-9 lg:w-9" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft className="h-4 w-4" aria-hidden="true" /></Button>
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 lg:h-9 lg:w-9" aria-label="Next page" disabled={current >= pages} onClick={() => setPage(current + 1)}><ChevronRight className="h-4 w-4" aria-hidden="true" /></Button>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
