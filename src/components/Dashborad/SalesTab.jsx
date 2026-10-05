import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrencyAED, formatNumber } from "@/utils/format";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChartArea, Empty, Skeleton } from "./widgets";
import { gold, ink, monthLabel, monthYearLabel, signed, compactAmount, tip, weekdayLabel } from "./helpers";

const cardClass = "rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]";
const WORD = { week: "week", month: "month", quarter: "quarter", custom: "period" };

// Sales tab: orders, average order, best sellers and the sales / purchase trend, all of the period chosen above.
export default function SalesTab({ state, period }) {
  const d = state.data;
  const word = WORD[d?.period.id || period] || "period";
  const monthly = (d?.monthly || []).map((m) => ({ ...m, label: monthLabel(m.month), full: monthYearLabel(m.month) }));
  const daily = (d?.daily || []).map((x) => ({ ...x, day: weekdayLabel(x.date) }));
  const customers = (d?.topCustomers || []).map((c) => ({ name: c.name, aed: c.netRevenue }));

  const approved = d?.approvedShare;
  const points = approved && approved.pct !== null && approved.previousPct !== null ? Math.round((approved.pct - approved.previousPct) * 10) / 10 : null;
  const tiles = d && [
    { label: `Orders this ${word}`, value: formatNumber(d.orders.count, 0), change: d.orders.changePct === null ? null : signed(d.orders.changePct), empty: d.orders.count === 0 },
    { label: "Avg. order", value: d.averageOrder.value === null ? "—" : formatCurrencyAED(d.averageOrder.value), change: d.averageOrder.changePct === null ? null : signed(d.averageOrder.changePct), empty: d.averageOrder.value === null },
    { label: "Orders approved", value: approved.pct === null ? "—" : `${formatNumber(approved.pct, 1)}%`, change: points === null ? null : `${points > 0 ? "+" : points < 0 ? "-" : ""}${formatNumber(Math.abs(points), 1)} points`, empty: approved.pct === null },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {!d && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-[1.75rem]" />)}
        {tiles?.map((m, i) => (
          <Card key={m.label} data-anim="bento" className={cn(cardClass, i === 0 && "bg-brand-soft")}>
            <CardContent className="p-5">
              <p className="text-sm font-medium text-foreground/70">{m.label}</p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight">{m.value}</p>
              <p className="mt-1 inline-flex items-center text-xs font-bold">
                {m.change !== null ? (
                  <>
                    <ArrowUpRight className="mr-0.5 h-3 w-3" />
                    {m.change} on the {word} before
                  </>
                ) : (
                  <span className="font-medium text-foreground/70">{m.empty ? `No sales this ${word}` : `Nothing to compare with the ${word} before`}</span>
                )}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-8")}>
          <CardHeader>
            <CardTitle className="font-extrabold">Sales vs Purchase</CardTitle>
            <CardDescription>Monthly AED · last 8 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={state} empty={!monthly.some((m) => m.sales || m.purchases)} emptyText="No sales or purchases posted in the last 8 months" height={300}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthly} barGap={8}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={compactAmount} />
                  <Tooltip contentStyle={tip} labelFormatter={(_, p) => p?.[0]?.payload.full} formatter={(v, n) => [formatCurrencyAED(v), n]} />
                  <Bar dataKey="sales" name="Sales" fill={ink} radius={[10, 10, 0, 0]} maxBarSize={26} />
                  <Bar dataKey="purchases" name="Purchases" fill="var(--chart-2)" radius={[10, 10, 0, 0]} maxBarSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-4")}>
          <CardHeader>
            <CardTitle className="font-extrabold">Best sellers</CardTitle>
            <CardDescription>By net revenue this {word}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!d && [0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
            {d && d.bestSellers.length === 0 && <Empty height={200}>No item sales this {word}</Empty>}
            {d?.bestSellers.map((p, i) => (
              <div key={p.itemId} className="rounded-2xl bg-secondary/70 px-3 py-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-bold">{i + 1}. {p.name}</p>
                  {p.changePct !== null && <span className="shrink-0 text-xs font-bold">{signed(p.changePct)}</span>}
                </div>
                <Progress value={p.fillPct} className="h-1.5" aria-label={`${p.name} against the best seller`} />
                <p className="mt-1 text-xs text-muted-foreground">{formatCurrencyAED(p.revenue)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card data-anim="bento" className={cardClass}>
          <CardHeader>
            <CardTitle className="font-extrabold">Daily order trend</CardTitle>
            <CardDescription>Approved sales orders · last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={state} empty={!daily.some((x) => x.orders)} emptyText="No approved sales orders in the last 7 days" height={220}>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={daily}>
                  <defs>
                    <linearGradient id="ordFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tip} />
                  <Area type="monotone" dataKey="orders" name="Orders" stroke={ink} fill="url(#ordFill)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cardClass}>
          <CardHeader>
            <CardTitle className="font-extrabold">Sales by customer</CardTitle>
            <CardDescription>
              Top 5 by net revenue this {word} · AED · <Link to="/party-balances?tab=customers" className="underline underline-offset-2">balances</Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={state} empty={customers.length === 0} emptyText={`No sales this ${word}`} height={220}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={customers}>
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={compactAmount} />
                  <Tooltip contentStyle={tip} formatter={(v) => [formatCurrencyAED(v), "Revenue"]} />
                  <Bar dataKey="aed" radius={[8, 8, 0, 0]} maxBarSize={36}>
                    {customers.map((_, i) => <Cell key={i} fill={i === 0 ? gold : ink} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
