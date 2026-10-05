import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Warehouse } from "lucide-react";
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrencyAED, formatDate, formatNumber, formatQty } from "@/utils/format";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChartArea, Empty, Skeleton } from "./widgets";
import { ink, monthLabel, monthYearLabel, slices, compactAmount, tip } from "./helpers";

const cardClass = "rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]";

// Inventory tab: where the stock value sits, what needs reordering or is about to expire, and how
// the Inventory account has moved. Stock on hand is today's position whichever period is chosen.
export default function InventoryTab({ state, theme }) {
  const d = state.data;
  const colours = slices(theme, "inventory");
  const trend = (d?.stockValueTrend.months || []).map((m) => ({ ...m, label: monthLabel(m.month), full: monthYearLabel(m.month) }));
  const alerts = d ? d.lowStock.length + d.batches.length : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!d && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-[1.75rem]" />)}
        {d && d.categories.length === 0 && (
          <Card data-anim="bento" className={cn(cardClass, "sm:col-span-2 xl:col-span-4")}>
            <CardContent className="p-5"><Empty height={64}>No stock on hand yet</Empty></CardContent>
          </Card>
        )}
        {d?.categories.map((w, i) => (
          <Card key={w.key} data-anim="bento" className={cn(cardClass, i === 0 && "bg-brand-soft")}>
            <CardContent className="space-y-3 p-5">
              <div className="flex items-center gap-2 font-bold">
                <Warehouse className="h-4 w-4 shrink-0" />
                <span className="truncate">{w.name}</span>
              </div>
              <Progress value={w.sharePct || 0} className="h-2" aria-label={`${w.name} share of stock value`} />
              <p className="text-sm text-foreground/70">
                {w.items} {w.items === 1 ? "SKU" : "SKUs"} · {formatNumber(w.sharePct || 0, 1)}% · {formatCurrencyAED(w.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card data-anim="bento" className={cardClass}>
          <CardHeader>
            <CardTitle className="font-extrabold">Inventory mix</CardTitle>
            <CardDescription>Stock value by category{d ? ` · ${formatCurrencyAED(d.totals.value)}` : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={state} empty={!d || d.mix.length === 0} emptyText="No stock on hand yet" height={220}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={d?.mix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {d?.mix.map((e, i) => <Cell key={e.key} fill={colours[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={tip} formatter={(v, n) => [formatCurrencyAED(v), n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-2">
                {d?.mix.map((item, i) => (
                  <div key={item.key} className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: colours[i] }} />
                      {item.name}
                    </span>
                    <span className="font-bold">{formatNumber(item.sharePct || 0, 1)}%</span>
                  </div>
                ))}
              </div>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cardClass}>
          <CardHeader>
            <CardTitle className="font-extrabold">Stock alerts</CardTitle>
            <CardDescription>Items at or below reorder level, and batches that expire within 30 days or already have</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!d && [0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}
            {d && alerts === 0 && <Empty height={200}>No stock alerts</Empty>}
            {d?.lowStock.map((a) => (
              <Link key={a.stockId} to={`/stock-detail/${a.stockId}`} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/70 px-4 py-3 hover:bg-secondary">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-full bg-foreground p-2 text-background"><AlertTriangle className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{a.itemName}</p>
                    <p className="text-xs text-muted-foreground">{a.status === "out" ? "Out of stock" : "Below reorder level"} · level {formatQty(a.reorderLevel)}</p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-bold">{formatQty(a.qty)} {a.unit}</p>
              </Link>
            ))}
            {d?.batches.map((b) => (
              <Link key={b.batchId} to="/batches" className="flex items-center justify-between gap-3 rounded-2xl bg-secondary/70 px-4 py-3 hover:bg-secondary">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="rounded-full bg-foreground p-2 text-background"><AlertTriangle className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{b.itemName}</p>
                    <p className="text-xs text-muted-foreground">Batch {b.batchNumber} · {b.expired ? "expired" : "expires"} {formatDate(b.expiryDate)}</p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-bold">{formatQty(b.qtyOnHand)} {b.unit}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card data-anim="bento" className={cardClass}>
        <CardHeader>
          <CardTitle className="font-extrabold">Stock value trend</CardTitle>
          <CardDescription>Month-end balance of the Inventory account · AED</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartArea
            state={state}
            empty={!d || !d.stockValueTrend.available || !trend.some((m) => m.value)}
            emptyText={d && !d.stockValueTrend.available ? "The Inventory account is not set up" : "No stock value posted yet"}
            height={240}
          >
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={compactAmount} />
                <Tooltip contentStyle={tip} labelFormatter={(_, p) => p?.[0]?.payload.full} formatter={(v) => [formatCurrencyAED(v), "Stock value"]} />
                <Line type="monotone" dataKey="value" name="Stock value" stroke={ink} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartArea>
        </CardContent>
      </Card>
    </div>
  );
}
