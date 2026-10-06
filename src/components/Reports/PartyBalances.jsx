import React, { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download } from "lucide-react";
import { accounting } from "../../lib/accountingApi";
import { downloadCSV, formatNumber, todayInput } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Balance, EmptyState, Field, PageHeader, Panel, Pill, Select, TextInput, useAsync } from "../accounting/kit";
import { DateRange, Frame } from "./reportKit";

const money = (n) => formatNumber(n, 2);

const STATUS = {
  ok: { tone: "success", label: "Within limit" },
  near: { tone: "warning", label: "Near limit" },
  over: { tone: "danger", label: "Over limit" },
  "no-limit": { tone: "neutral", label: "No limit set" },
};
const BAR = { ok: "bg-status-success", near: "bg-status-warning", over: "bg-status-danger", "no-limit": "bg-muted-foreground" };

// What each customer owes and each vendor is owed on a date, from the party accounts of the ledger;
// customers also show how much of their credit limit is used and what is overdue.
export default function PartyBalances() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "vendors" ? "vendors" : "customers";
  const [asOn, setAsOn] = useState(todayInput());
  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Party balances" description="What customers owe, what is owed to vendors, credit limit use and overdue amounts, as on a date." />
      <DateRange asAt value={{ to: asOn }} onChange={(v) => setAsOn(v.to)} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="erp-scroll table-pin-first overflow-x-auto"><TabsList><TabsTrigger value="customers">Customers</TabsTrigger><TabsTrigger value="vendors">Vendors</TabsTrigger></TabsList></div>
        <TabsContent value="customers">{tab === "customers" && <Parties type="customer" asOn={asOn} />}</TabsContent>
        <TabsContent value="vendors">{tab === "vendors" && <Parties type="vendor" asOn={asOn} />}</TabsContent>
      </Tabs>
    </div>
  );
}

function Parties({ type, asOn }) {
  const customer = type === "customer";
  const [includeZero, setIncludeZero] = useState(false);
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState("");
  const state = useAsync(() => accounting.partyBalances({ type, asOn, includeZero: includeZero || undefined }), [type, asOn, includeZero]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (state.data?.rows || []).filter((r) => {
      if (q && !`${r.partyName} ${r.partyCode}`.toLowerCase().includes(q)) return false;
      if (focus === "over") return r.status === "over";
      if (focus === "near") return r.status === "near" || r.status === "over";
      if (focus === "overdue") return r.overdue > 0;
      return true;
    });
  }, [state.data, search, focus]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Search" className="w-72">
          <TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={customer ? "Customer name or ID" : "Vendor name or ID"} />
        </Field>
        <Field label="Show" className="w-52">
          <Select value={focus} onChange={(e) => setFocus(e.target.value)}>
            <option value="">Everyone</option>
            {customer && <option value="over">Over their limit</option>}
            {customer && <option value="near">Near or over their limit</option>}
            <option value="overdue">With overdue invoices</option>
          </Select>
        </Field>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground"><input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)} className="h-5 w-5 accent-[var(--color-primary)] lg:h-4 lg:w-4" />Include zero balances</label>
      </div>
      <Frame state={state}>
        {(d) => {
          const exportCsv = () => downloadCSV(`${customer ? "customer" : "vendor"}-balances-${asOn}.csv`,
            customer ? ["ID", "Customer", "Terms", "Balance (Dr owes us)", "Credit limit", "Used %", "Status", "Overdue"] : ["ID", "Vendor", "Terms", "Balance owed (Cr)", "Overdue"],
            rows.map((r) => (customer ? [r.partyCode, r.partyName, r.paymentTerms, r.balance, r.creditLimit, r.utilisation ?? "", STATUS[r.status].label, r.overdue] : [r.partyCode, r.partyName, r.paymentTerms, r.balance, r.overdue])));
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard title={customer ? "Owed to us" : "We owe"} count={money(d.totals.owed)} tone="teal" subText="AED" />
                <StatCard title={customer ? "Paid in advance" : "Advances to vendors"} count={money(d.totals.advances)} tone="plum" subText="AED" />
                <StatCard title="Overdue" count={money(d.totals.overdue)} tone={d.totals.overdue > 0 ? "warning" : "neutral"} subText="AED" />
                {customer
                  ? <StatCard title="Over their limit" count={String(d.totals.overLimit)} subText={`${d.totals.nearLimit} more near it`} tone={d.totals.overLimit > 0 ? "danger" : "neutral"} />
                  : <StatCard title="Vendors" count={String(d.rows.length)} tone="neutral" />}
              </div>
              <Panel bodyClassName="p-0" title={customer ? "Customer balances" : "Vendor balances"} description={`As on ${asOn}. ${customer ? "Dr means the customer owes us." : "Cr means we owe the vendor."}`}
                actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}>
                {rows.length === 0 ? <EmptyState title="Nothing to show" text={d.rows.length ? "No one matches this filter." : "No balances on this date."} /> : (
                  <div className="erp-scroll table-pin-first overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-5 py-2 text-start">{customer ? "Customer" : "Vendor"}</th><th className="px-3 py-2 text-start">Terms</th><th className="px-3 py-2 text-end">Balance</th>
                          {customer && <><th className="px-3 py-2 text-end">Credit limit</th><th className="px-3 py-2 text-start">Limit used</th></>}
                          <th className="px-3 py-2 text-end">Overdue</th><th className="px-5 py-2"><span className="sr-only">Account</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.partyName} className="border-t border-border hover:bg-accent/40">
                            <td className="px-5 py-2.5"><span className="font-medium">{r.partyName}</span>{r.partyCode && <span className="block font-mono text-xs text-muted-foreground">{r.partyCode}</span>}</td>
                            <td className="px-3 py-2.5 text-muted-foreground">{r.paymentTerms || "-"}</td>
                            <td className="px-3 py-2.5 text-end font-medium">{customer ? <Balance net={r.balance} /> : <Balance net={-r.balance} />}</td>
                            {customer && (
                              <>
                                <td className="px-3 py-2.5 text-end tabular-nums">{r.creditLimit > 0 ? money(r.creditLimit) : <span className="text-muted-foreground">-</span>}</td>
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-3">
                                    {r.creditLimit > 0 && (
                                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary" role="presentation"><div className={`h-full rounded-full ${BAR[r.status] || "bg-muted-foreground"}`} style={{ width: `${Math.min(r.utilisation || 0, 100)}%` }} /></div>
                                    )}
                                    <span className="tabular-nums text-muted-foreground">{r.utilisation != null ? `${formatNumber(r.utilisation, 0)}%` : ""}</span>
                                    {STATUS[r.status] && <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>}
                                  </div>
                                </td>
                              </>
                            )}
                            <td className="px-3 py-2.5 text-end tabular-nums">{r.overdue > 0 ? <span className="text-status-warning">{money(r.overdue)}</span> : <span className="text-muted-foreground">-</span>}</td>
                            <td className="px-5 py-2.5 text-end">{r.partyId && <Link to={customer ? `/credit-accounts/customer/${r.partyId}` : `/debit-accounts/vendor/${r.partyId}`} className="text-sm text-primary underline-offset-2 hover:underline" aria-label={`Open account of ${r.partyName}`}>Open account</Link>}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t-2 border-border bg-secondary/60 font-semibold"><td className="px-5 py-2.5" colSpan={2}>Net</td><td className="px-3 py-2.5 text-end">{customer ? <Balance net={d.totals.net} /> : <Balance net={-d.totals.net} />}</td>{customer && <td colSpan={2} />}<td className="px-3 py-2.5 text-end tabular-nums">{money(d.totals.overdue)}</td><td /></tr></tfoot>
                    </table>
                  </div>
                )}
              </Panel>
            </>
          );
        }}
      </Frame>
    </div>
  );
}
