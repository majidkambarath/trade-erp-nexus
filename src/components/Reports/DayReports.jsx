import React from "react";
import { BookOpen, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Download, TriangleAlert } from "lucide-react";
import { accounting } from "../../lib/accountingApi";
import { busiestDay, cellOf, dailySummaryCsv, dayEndCsv, registerCsv, shiftDay } from "../../lib/dayReports";
import { CURRENCY, downloadCSV, formatDate, formatNumber, todayInput } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Balance, EmptyState, Panel, Pill, useAsync } from "../accounting/kit";
import { Frame } from "./reportKit";

const money = (n) => formatNumber(n, 2);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const TH = "px-3 py-2 text-end";
const HEAD = "bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground";

// ---------------------------------------------------------------- daily voucher summary

// The day book by day: what was posted each day, by kind of voucher. A day opens its vouchers in the day book.
export function DailySummary({ range, onDay }) {
  const state = useAsync(() => accounting.dailySummary({ from: range.from, to: range.to }), [range.from, range.to]);
  return (
    <Frame state={state}>
      {(d) => {
        const busiest = busiestDay(d.days);
        const exportCsv = () => {
          const { headers, rows } = dailySummaryCsv(d, formatDate);
          downloadCSV(`daily-voucher-summary-${range.from}-${range.to}.csv`, headers, rows);
        };
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard title="Days with vouchers" count={String(d.days.length)} tone="neutral" />
              <StatCard title="Vouchers" count={String(d.totals.count)} tone="teal" />
              <StatCard title="Busiest day" count={busiest ? formatDate(busiest.day) : "-"} subText={busiest ? plural(busiest.count, "voucher", "vouchers") : undefined} tone="plum" />
              <StatCard title="Out of balance" count={String(d.totals.unbalanced)} subText={d.totals.unbalanced ? "check these in the day book" : "every voucher balances"} tone={d.totals.unbalanced ? "rose" : "olive"} />
            </div>
            <Panel bodyClassName="p-0" title="Daily voucher summary" description="What was posted each day, by kind of voucher: how many, and what they came to. Open a day to see its vouchers."
              actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!d.days.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}>
              {d.days.length === 0 ? <EmptyState title="No vouchers" text="Nothing was posted in this period." /> : (
                <div className="erp-scroll table-pin-first overflow-x-auto">
                  <table className="w-full text-sm" aria-label="Daily voucher summary">
                    <thead className={HEAD}>
                      <tr>
                        <th className="px-5 py-2 text-start">Date</th>
                        <th className={TH}>Vouchers</th>
                        {d.types.map((t) => <th key={t.voucherType} className={`${TH} whitespace-nowrap`}>{t.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {d.days.map((day) => (
                        <tr key={day.day} className="border-t border-border hover:bg-accent/40">
                          <td className="whitespace-nowrap px-5 py-2">
                            <button type="button" onClick={() => onDay(day.day)} aria-label={`Open the vouchers of ${formatDate(day.day)}`} className="font-medium hover:underline">{formatDate(day.day)}</button>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-end tabular-nums">
                            {day.count}
                            {day.unbalanced > 0 && <Pill tone="danger" className="ms-2"><TriangleAlert className="h-3 w-3" aria-hidden="true" />{day.unbalanced} out of balance</Pill>}
                          </td>
                          {d.types.map((t) => {
                            const c = cellOf(day, t.voucherType);
                            return (
                              <td key={t.voucherType} className="whitespace-nowrap px-3 py-2 text-end tabular-nums">
                                {c ? <>{money(c.amount)}<span className="block text-xs text-muted-foreground">{plural(c.count, "voucher", "vouchers")}</span></> : ""}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-secondary/60 font-semibold">
                        <td className="px-5 py-2.5">Total</td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{d.totals.count}</td>
                        {d.types.map((t) => {
                          const c = d.totals.byType[t.voucherType];
                          return <td key={t.voucherType} className="whitespace-nowrap px-3 py-2.5 text-end tabular-nums">{c ? <>{money(c.amount)}<span className="block text-xs font-normal text-muted-foreground">{plural(c.count, "voucher", "vouchers")}</span></> : ""}</td>;
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        );
      }}
    </Frame>
  );
}

// ---------------------------------------------------------------- day end: cash and bank

// The cash and bank position at the end of one day (the day is the range's "to"), where the money came from and went
// to, and the last two weeks day by day.
export function DayEnd({ range, onRange, onLedger, onOpenDay }) {
  const day = range.to;
  const report = useAsync(() => accounting.dayEnd({ date: day }), [day]);
  const register = useAsync(() => accounting.dayEndRegister({ from: shiftDay(day, -13), to: day }), [day]);
  // moving to another day changes only the day: the other tabs keep the period the person chose, unless the day falls before it
  const go = (to) => onRange({ from: range.from <= to ? range.from : to, to });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Choose the day">
        <Button type="button" size="sm" variant="outline" onClick={() => go(shiftDay(day, -1))}><ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />Previous day</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => go(shiftDay(day, 1))}>Next day<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
        <Button type="button" size="sm" variant="outline" onClick={() => go(todayInput())} disabled={day === todayInput()}><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />Today</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onOpenDay(day)}>Open this day's vouchers</Button>
      </div>

      <Frame state={report}>
        {(d) => {
          const all = d.totals.all;
          const exportCsv = () => {
            const { headers, rows } = dayEndCsv(d);
            downloadCSV(`day-end-${d.date}.csv`, headers, rows);
          };
          return (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard title="Cash at day end" count={money(d.totals.cash.closing)} subText={CURRENCY} tone="olive" />
                <StatCard title="Bank at day end" count={money(d.totals.bank.closing)} subText={CURRENCY} tone="teal" />
                <StatCard title="Money in" count={money(d.moneyIn)} tone="plum" />
                <StatCard title="Money out" count={money(d.moneyOut)} tone="rose" />
              </div>

              <Panel bodyClassName="p-0" title={`Cash and bank at the end of ${formatDate(d.date)}`} description="Each account: what it held at the start of the day, what came in, what went out, and what it holds at the end."
                actions={<>
                  <Pill tone={d.reconciles ? "success" : "danger"}>
                    {d.reconciles ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <TriangleAlert className="h-3 w-3" aria-hidden="true" />}
                    {d.reconciles ? "Agrees with the ledger" : "Does not agree with the ledger"}
                  </Pill>
                  <Button size="sm" variant="outline" onClick={exportCsv} disabled={!d.accounts.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>
                </>}>
                {d.accounts.length === 0 ? <EmptyState title="No cash or bank accounts" text="Add them in the chart of accounts." /> : (
                  <div className="erp-scroll table-pin-first overflow-x-auto">
                    <table className="w-full text-sm" aria-label="Cash and bank at day end">
                      <thead className={HEAD}>
                        <tr><th className="px-5 py-2 text-start">Account</th><th className="px-3 py-2 text-start">Type</th><th className={TH}>Opening</th><th className={TH}>Receipts</th><th className={TH}>Payments</th><th className={TH}>Closing</th><th className={TH}>Vouchers</th><th className="px-5 py-2"><span className="sr-only">Ledger</span></th></tr>
                      </thead>
                      <tbody>
                        {d.accounts.map((a) => (
                          <tr key={a.accountId} className="border-t border-border hover:bg-accent/40">
                            <td className="px-5 py-2"><span className="me-2 font-mono text-xs text-muted-foreground">{a.accountCode}</span>{a.accountName}</td>
                            <td className="px-3 py-2"><Pill>{a.kind === "cash" ? "Cash" : "Bank"}</Pill></td>
                            <td className="px-3 py-2 text-end"><Balance net={a.opening} /></td>
                            <td className="px-3 py-2 text-end tabular-nums">{a.receipts ? money(a.receipts) : ""}</td>
                            <td className="px-3 py-2 text-end tabular-nums">{a.payments ? money(a.payments) : ""}</td>
                            <td className="px-3 py-2 text-end font-medium"><Balance net={a.closing} /></td>
                            <td className="px-3 py-2 text-end tabular-nums">{a.vouchers || ""}</td>
                            <td className="px-5 py-2 text-end"><button type="button" aria-label={`Ledger of ${a.accountName}`} onClick={() => onLedger(a)} className="inline-grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground lg:h-8 lg:w-8"><BookOpen className="h-4 w-4" aria-hidden="true" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {[["Total cash", d.totals.cash], ["Total bank", d.totals.bank], ["Total cash and bank", all]].map(([label, t], i) => (
                          <tr key={label} className={`${i === 0 ? "border-t-2 border-border" : "border-t border-border"} bg-secondary/60 font-semibold`}>
                            <td className="px-5 py-2.5" colSpan={2}>{label}</td>
                            <td className="px-3 py-2.5 text-end"><Balance net={t.opening} /></td>
                            <td className="px-3 py-2.5 text-end tabular-nums">{money(t.receipts)}</td>
                            <td className="px-3 py-2.5 text-end tabular-nums">{money(t.payments)}</td>
                            <td className="px-3 py-2.5 text-end"><Balance net={t.closing} /></td>
                            <td colSpan={2} />
                          </tr>
                        ))}
                      </tfoot>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel bodyClassName="p-0" title="Where the money came from and went to" description="By kind of voucher. A move between your own cash and bank accounts is in neither column.">
                {!d.hadActivity ? <EmptyState title="A quiet day" text="No cash or bank account moved on this day, so it closes with what it opened with." /> : (
                  <>
                    {d.sources.length > 0 && (
                      <div className="erp-scroll table-pin-first overflow-x-auto">
                        <table className="w-full text-sm" aria-label="Money in and out by source">
                          <thead className={HEAD}><tr><th className="px-5 py-2 text-start">Source</th><th className={TH}>In</th><th className={TH}>Out</th><th className="px-5 py-2 text-end">Vouchers</th></tr></thead>
                          <tbody>
                            {d.sources.map((s) => (
                              <tr key={s.voucherType} className="border-t border-border">
                                <td className="px-5 py-2">{s.label}</td>
                                <td className="px-3 py-2 text-end tabular-nums">{s.inflow ? money(s.inflow) : ""}</td>
                                <td className="px-3 py-2 text-end tabular-nums">{s.outflow ? money(s.outflow) : ""}</td>
                                <td className="px-5 py-2 text-end tabular-nums">{s.count}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot><tr className="border-t-2 border-border bg-secondary/60 font-semibold"><td className="px-5 py-2.5">Total</td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.moneyIn)}</td><td className="px-3 py-2.5 text-end tabular-nums">{money(d.moneyOut)}</td><td /></tr></tfoot>
                        </table>
                      </div>
                    )}
                    {d.movedBetweenAccounts > 0 && <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">Moved between your own cash and bank accounts: <span className="font-medium tabular-nums text-foreground">{money(d.movedBetweenAccounts)}</span>. It shows as a payment on one account and a receipt on the other.</p>}
                  </>
                )}
              </Panel>
            </>
          );
        }}
      </Frame>

      <Frame state={register}>
        {(r) => {
          const exportCsv = () => {
            const { headers, rows } = registerCsv(r, formatDate);
            downloadCSV(`day-end-register-${r.from}-${r.to}.csv`, headers, rows);
          };
          return (
            <Panel bodyClassName="p-0" title="Day by day" description={`Cash and bank at the end of each day with a movement, ${formatDate(r.from)} to ${formatDate(r.to)}. Open a day to see its report.`}
              actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!r.days.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}>
              {r.days.length === 0 ? <EmptyState title="No movement" text="No cash or bank account moved in these days." /> : (
                <div className="erp-scroll table-pin-first overflow-x-auto">
                  <table className="w-full text-sm" aria-label="Cash and bank day by day">
                    <thead className={HEAD}>
                      <tr><th className="px-5 py-2 text-start">Day</th><th className={TH}>Cash in</th><th className={TH}>Cash out</th><th className={TH}>Cash closing</th><th className={TH}>Bank in</th><th className={TH}>Bank out</th><th className={TH}>Bank closing</th><th className="px-5 py-2 text-end">Total closing</th></tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border text-muted-foreground">
                        <td className="px-5 py-2">Brought forward</td><td /><td />
                        <td className="px-3 py-2 text-end"><Balance net={r.opening.cash} /></td><td /><td />
                        <td className="px-3 py-2 text-end"><Balance net={r.opening.bank} /></td>
                        <td className="px-5 py-2 text-end"><Balance net={r.opening.all} /></td>
                      </tr>
                      {r.days.map((x) => (
                        <tr key={x.day} className={`border-t border-border hover:bg-accent/40 ${x.day === day ? "bg-accent/30" : ""}`}>
                          <td className="whitespace-nowrap px-5 py-2"><button type="button" onClick={() => go(x.day)} aria-label={`Day end of ${formatDate(x.day)}`} aria-current={x.day === day ? "date" : undefined} className="font-medium hover:underline">{formatDate(x.day)}</button></td>
                          <td className="px-3 py-2 text-end tabular-nums">{x.cash.in ? money(x.cash.in) : ""}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{x.cash.out ? money(x.cash.out) : ""}</td>
                          <td className="px-3 py-2 text-end"><Balance net={x.cash.closing} /></td>
                          <td className="px-3 py-2 text-end tabular-nums">{x.bank.in ? money(x.bank.in) : ""}</td>
                          <td className="px-3 py-2 text-end tabular-nums">{x.bank.out ? money(x.bank.out) : ""}</td>
                          <td className="px-3 py-2 text-end"><Balance net={x.bank.closing} /></td>
                          <td className="px-5 py-2 text-end font-medium"><Balance net={x.closing} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          );
        }}
      </Frame>
    </div>
  );
}
