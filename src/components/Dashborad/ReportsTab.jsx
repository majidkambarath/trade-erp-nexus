import React from "react";
import { Link } from "react-router-dom";
import { Percent, TrendingUp, Wallet } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrencyAED, formatDate } from "@/utils/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChartArea, Skeleton } from "./widgets";
import { gold, ink, monthLabel, monthYearLabel, mutedInk, compactAmount, tip } from "./helpers";

const cardClass = "rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]";
const VOUCHERS = [
  { type: "receipt", label: "Receipt", to: "/receipt-voucher" },
  { type: "payment", label: "Payment", to: "/payment-voucher" },
  { type: "journal", label: "Journal", to: "/journal-voucher" },
  { type: "contra", label: "Contra", to: "/contra-voucher" },
  { type: "expense", label: "Expense", to: "/expense-voucher" },
];

// Reports tab: profit, VAT, what was posted, and the ageing of what is owed each way.
export default function ReportsTab({ state }) {
  const d = state.data;
  const growth = (d?.valueGrowth || []).map((m) => ({ ...m, label: monthLabel(m.month), full: monthYearLabel(m.month) }));
  const ageing = (d?.ageing || []).map((b) => ({ bucket: b.label, receivables: b.receivables, payables: b.payables }));
  const vat = d?.vat;
  const vatRows = vat
    ? [
        { name: "Output VAT", value: vat.outputVat, fill: ink },
        { name: "Input VAT", value: vat.recoverableVat, fill: gold },
      ]
    : [];
  const tiles = d && [
    { label: "Gross profit", value: formatCurrencyAED(d.grossProfit), icon: Wallet, to: "/financial-statements?tab=pl" },
    {
      label: vat.position === "refundable" ? "VAT refundable" : "VAT payable",
      value: formatCurrencyAED(Math.abs(vat.net)),
      icon: Percent,
      to: "/vat-reports",
      note: `Quarter so far, ${formatDate(vat.from)} to ${formatDate(vat.to)}`,
    },
    { label: "Net profit", value: formatCurrencyAED(d.netProfit), icon: TrendingUp, to: "/financial-statements?tab=pl" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {!d && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-[1.75rem]" />)}
        {tiles?.map((m, i) => {
          const Icon = m.icon;
          return (
            <Link key={m.label} to={m.to} className="block">
              <Card data-anim="bento" className={cn(cardClass, "h-full", i === 2 && "bg-brand-soft")}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm font-medium text-foreground/70">{m.label}</p>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight">{m.value}</p>
                    {m.note && <p className="mt-1 text-xs text-foreground/70">{m.note}</p>}
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card/70"><Icon className="h-5 w-5" /></span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card data-anim="bento" className={cardClass}>
        <CardHeader>
          <CardTitle className="font-extrabold">Value growth</CardTitle>
          <CardDescription>Gross profit trend · last 8 months · AED</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartArea state={state} empty={!growth.some((m) => m.grossProfit)} emptyText="No gross profit posted in the last 8 months" height={280}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={growth} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="profitGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={compactAmount} />
                <Tooltip contentStyle={tip} labelFormatter={(_, p) => p?.[0]?.payload.full} formatter={(v) => [formatCurrencyAED(v), "Gross profit"]} />
                <Area
                  type="monotone"
                  dataKey="grossProfit"
                  stroke={ink}
                  fill="url(#profitGold)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: ink, strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: gold, stroke: ink, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartArea>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {!d && VOUCHERS.map((v) => <Skeleton key={v.type} className="h-16 rounded-[1.5rem]" />)}
        {d?.vouchers.map((v) => {
          const meta = VOUCHERS.find((x) => x.type === v.voucherType);
          return (
            <Link key={v.voucherType} to={meta.to} className="block">
              <Card data-anim="bento" className="h-full rounded-[1.5rem] border-0 shadow-[var(--shadow-card)]">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground">{meta.label}</p>
                  <p className="mt-1 text-sm font-extrabold">{v.amount ? formatCurrencyAED(v.amount) : "None posted"}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-7")}>
          <CardHeader>
            <CardTitle className="font-extrabold">Receivables vs payables ageing</CardTitle>
            <CardDescription>By days past due · AED</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={state} empty={!ageing.some((b) => b.receivables || b.payables)} emptyText="Nothing owed to you or by you" height={260}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ageing}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={compactAmount} />
                  <Tooltip contentStyle={tip} formatter={(v, n) => [formatCurrencyAED(v), n]} />
                  <Legend />
                  <Bar dataKey="receivables" name="Receivables" fill={ink} radius={[8, 8, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="payables" name="Payables" fill={gold} radius={[8, 8, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-5")}>
          <CardHeader>
            <CardTitle className="font-extrabold">VAT snapshot</CardTitle>
            <CardDescription>Output · input · net {vat?.position === "refundable" ? "refundable" : "payable"} · quarter so far · AED</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={state} empty={!vat?.hasActivity} emptyText="No VAT transactions this quarter" height={200}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={vatRows.filter((r) => r.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={74} paddingAngle={3}>
                    {vatRows.filter((r) => r.value > 0).map((e) => <Cell key={e.name} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tip} formatter={(v, n) => [formatCurrencyAED(v), n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 space-y-1.5">
                {[...vatRows, { name: vat?.position === "refundable" ? "Net refundable" : "Net payable", value: Math.abs(vat?.net || 0), fill: mutedInk }].map((v) => (
                  <div key={v.name} className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ background: v.fill }} />
                      {v.name}
                    </span>
                    <span className="font-bold">{formatCurrencyAED(v.value)}</span>
                  </div>
                ))}
              </div>
            </ChartArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
