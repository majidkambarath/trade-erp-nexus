import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  MoreHorizontal,
  Package,
  Percent,
  Receipt,
  Truck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { formatCurrencyAED, formatCurrencyCompact, formatDate, formatNumber } from "@/utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChartArea, Empty, Skeleton } from "./widgets";
import { ago, dayLabel, gold, hourLabel, ink, monthLabel, monthYearLabel, mutedInk, opsRows, recentLink, signed, slices, compactAmount, tip, weekdayLabel } from "./helpers";

const cardClass = "rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]";
const PERIOD_WORD = { week: "week", month: "month", quarter: "quarter", custom: "period" };
const aedTip = (v, name) => [formatCurrencyAED(v), name];
const sum = (rows, ...fields) => rows.reduce((t, r) => t + fields.reduce((u, f) => u + (Number(r[f]) || 0), 0), 0);

const toneDot = { ok: "bg-status-success", warn: "bg-status-warning", danger: "bg-status-danger", muted: "bg-muted-foreground" };
const toneBadge = {
  ok: "bg-status-success-soft text-status-success border-transparent",
  warn: "bg-status-warning-soft text-status-warning border-transparent",
  danger: "bg-status-danger-soft text-status-danger border-transparent",
  muted: "bg-secondary text-muted-foreground border-transparent",
};

export default function OverviewTab({ core, analytics, period, setPeriod, theme }) {
  const navigate = useNavigate();
  const c = core.data;
  const a = analytics.data;
  const word = PERIOD_WORD[c?.period?.id || period] || "period";
  const mix = slices(theme);
  const range = a ? `${formatDate(a.period.from)} – ${formatDate(a.period.to)}` : "";

  const monthly = (c?.monthly || []).map((m) => ({ ...m, label: monthLabel(m.month), full: monthYearLabel(m.month) }));
  const rate = c?.collection?.ratePct ?? null;

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
        {/* Left column */}
        <div className="flex flex-col gap-4 xl:col-span-3">
          <Card data-anim="bento" className={cardClass}>
            <CardContent className="p-6">
              <div className="mb-4">
                <p className="text-sm font-medium text-muted-foreground">Collection rate</p>
                <p className="mt-1 text-5xl font-extrabold tracking-tight">
                  {!c ? <Skeleton className="h-12 w-28" /> : rate === null ? "—" : <>{formatNumber(rate, 1)}<span className="text-muted-foreground/50">%</span></>}
                </p>
              </div>
              <Progress value={Math.min(100, rate || 0)} className="h-2.5 bg-secondary" aria-label="Collection rate" />
              {c && (
                <>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {rate === null ? `No sales invoiced this ${word}` : `Receipts vs invoices this ${word}`}
                  </p>
                  {rate !== null && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatCurrencyAED(c.collection.receipts)} received of {formatCurrencyAED(c.collection.invoiced)} invoiced
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card data-anim="bento" className={cn("flex-1", cardClass)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold">Ops status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!c && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}
              {c && opsRows(c.ops).map((row) => (
                <Link key={row.key} to={row.to} className="flex min-h-11 items-center justify-between gap-2 rounded-lg hover:bg-secondary/60 lg:min-h-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn("h-2 w-2 rounded-full", toneDot[row.tone])} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.value}</p>
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", toneBadge[row.tone])}>{row.tag}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Center column */}
        <div className="flex flex-col gap-4 xl:col-span-6">
          <Card data-anim="bento" className={cardClass}>
            {/* In the narrow centre column (xl) the period control sits above the three figures, not beside them: beside them
                a figure like "AED 900.00" ran into the next one. */}
            <CardHeader className="flex-row items-start justify-between space-y-0 pb-2 xl:flex-col-reverse xl:items-stretch xl:gap-3">
              <div className="grid w-full grid-cols-1 gap-3 pr-2 min-[420px]:grid-cols-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Sales value</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl xl:text-2xl 2xl:text-3xl">
                    {c ? formatCurrencyCompact(c.headline.revenue) : <Skeleton className="h-8 w-24" />}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Avg. margin</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl xl:text-2xl 2xl:text-3xl">
                    {!c ? <Skeleton className="h-8 w-16" /> : c.headline.grossMarginPct === null ? "—" : `${formatNumber(c.headline.grossMarginPct, 1)}%`}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Avg. order</p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl xl:text-2xl 2xl:text-3xl">
                    {!c ? <Skeleton className="h-8 w-20" /> : c.headline.averageInvoice === null ? "—" : formatCurrencyCompact(c.headline.averageInvoice)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 xl:self-end">
                <div className="hidden items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1.5 sm:flex">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <select
                    aria-label="Period"
                    className="bg-transparent text-xs font-semibold outline-none"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                  </select>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open the profit and loss" onClick={() => navigate("/financial-statements?tab=pl")}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ChartArea state={core} empty={!monthly.some((m) => m.revenue !== 0)} emptyText="No sales posted in the last 8 months" height={250}>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={monthly}>
                    <defs>
                      <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={tip} labelFormatter={(_, p) => p?.[0]?.payload.full} formatter={(v) => [formatCurrencyAED(v), "Sales"]} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={ink}
                      strokeWidth={2.5}
                      fill="url(#goldFill)"
                      dot={{ r: 3, fill: ink, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: gold, stroke: ink, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartArea>
              <div className="mt-1 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--highlight)]" />
                  Live sales growth
                </span>
                {c?.peak && <span>Peak {monthLabel(c.peak.month)} · {formatCurrencyCompact(c.peak.revenue)}</span>}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card data-anim="bento" className={cardClass}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-bold">Top product</p>
                  {c?.topProduct?.changePct > 0 && (
                    <Badge className="rounded-full border-0 bg-brand-soft text-brand-on-soft hover:bg-brand-soft">Hot</Badge>
                  )}
                </div>
                {!c && <Skeleton className="h-28" />}
                {c && !c.topProduct && <Empty height={112}>No sales this {word}</Empty>}
                {c?.topProduct && (
                  <>
                    <Link to={`/stock-detail/${c.topProduct.stockId}`} className="text-lg font-extrabold tracking-tight hover:underline">
                      {c.topProduct.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrencyAED(c.topProduct.revenue)}
                      {c.topProduct.changePct !== null && ` · ${signed(c.topProduct.changePct)}`}
                    </p>
                    <div className="mt-3 h-14" role="img" aria-label={`${c.topProduct.name} sales for each of the last 7 months`}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={c.topProduct.spark}>
                          <Line type="monotone" dataKey="revenue" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-anim="bento" className={cardClass}>
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <Link to="/vat-reports" className="-my-2 inline-flex min-h-10 items-center py-2 text-sm font-bold hover:underline lg:my-0 lg:min-h-0 lg:py-0">VAT this quarter</Link>
                  {c?.vat?.hasActivity && c.vat.position !== "nil" && (
                    <Badge variant="secondary" className="rounded-full">{c.vat.position === "payable" ? "Payable" : "Refundable"}</Badge>
                  )}
                </div>
                {!c && <Skeleton className="h-28" />}
                {c && !c.vat.hasActivity && <Empty height={112}>No VAT transactions this quarter</Empty>}
                {c?.vat?.hasActivity && (
                  <>
                    <p className="text-lg font-extrabold tracking-tight">{formatCurrencyAED(Math.abs(c.vat.net))}</p>
                    <p className="text-sm text-muted-foreground">
                      Output {formatCurrencyAED(c.vat.outputVat)} · Input {formatCurrencyAED(c.vat.recoverableVat)}
                    </p>
                    {c.vat.unclassifiedLines > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {c.vat.unclassifiedLines} {c.vat.unclassifiedLines === 1 ? "line has" : "lines have"} no tax treatment
                      </p>
                    )}
                    <div className="mt-3 h-14" role="img" aria-label="Output VAT for each of the last 6 months">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={c.vat.spark}>
                          <Line type="monotone" dataKey="outputVat" stroke={ink} strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4 xl:col-span-3">
          <Card data-anim="bento" className="overflow-hidden rounded-[1.75rem] border border-border bg-brand-soft text-foreground shadow-[var(--shadow-card)]">
            <CardContent className="relative p-6">
              <p className="text-sm font-semibold opacity-80">Needs attention</p>
              {!c && <Skeleton className="mt-3 h-20 bg-card/50" />}
              {c && (
                <>
                  <h3 className="mt-2 text-xl font-extrabold leading-snug tracking-tight">
                    {c.attention.length === 0
                      ? "Nothing needs attention"
                      : `${c.attention.length} ${c.attention.length === 1 ? "thing" : "things"} to look at`}
                  </h3>
                  {c.attention.length > 0 && (
                    <ul className="mt-4 space-y-2">
                      {c.attention.map((item) => (
                        <li key={item.key}>
                          <Link to={item.to} className="flex items-start gap-2 rounded-xl bg-card/60 px-3 py-2 text-sm font-medium transition hover:bg-card">
                            <span className="min-w-0 flex-1">{item.text}</span>
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card data-anim="bento" className={cn("flex-1", cardClass)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">Recent activity</CardTitle>
                <Link to="/ledger-reports?tab=daybook" className="-my-2 inline-flex min-h-10 items-center py-2 text-xs font-semibold text-muted-foreground hover:text-foreground lg:my-0 lg:min-h-0 lg:py-0">View all</Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!c && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
              {c && c.recent.length === 0 && <Empty height={120}>No activity yet</Empty>}
              {c?.recent?.map((r) => (
                <Link key={r.voucherId} to={recentLink(r.voucherType)} className="flex gap-3 rounded-lg hover:bg-secondary/60">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug">
                      {r.typeLabel} {r.voucherNo}
                      {(r.party || r.narration) && ` · ${r.party || r.narration}`}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted-foreground">{ago(r.date)}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">{r.status}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick actions row */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Sales Order", to: "/sales-order", icon: Receipt },
          { label: "Purchase Order", to: "/purchase-order", icon: Truck },
          { label: "Stock Items", to: "/stock-item-creation", icon: Package },
          { label: "VAT Reports", to: "/vat-reports", icon: Percent },
        ].map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.label}
              data-anim="bento"
              onClick={() => navigate(q.to)}
              className="flex items-center gap-3 rounded-[1.35rem] border-0 bg-card p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-bold">{q.label}</span>
            </button>
          );
        })}
      </div>

      <Gallery a={a} analytics={analytics} word={word} theme={theme} mix={mix} range={range} />
    </>
  );
}

// ---------------------------------------------------------------- the charts under the first screen

function Gallery({ a, analytics, word, theme, mix, range }) {
  const weekly = (a?.weekly || []).map((w) => ({ ...w, day: weekdayLabel(w.date) }));
  const customerMix = a?.customerMix?.rows || [];
  const perf = a
    ? [
        { name: "Collection rate", value: a.performance.collectionRatePct, fill: "#737373" },
        { name: "Gross margin", value: a.performance.grossMarginPct, fill: ink },
        { name: "Stock availability", value: a.performance.stockAvailabilityPct, fill: gold },
      ].filter((p) => p.value !== null)
    : [];
  const monthly = (a?.monthly || []).map((m) => ({ ...m, label: monthLabel(m.month), full: monthYearLabel(m.month) }));
  const categories = (a?.categorySales?.rows || []).map((r) => ({ name: r.name, current: r.current, previous: r.previous }));
  const monthsOf = a?.categoryMonths?.months || [];
  const categoryBars = (a?.categoryMonths?.rows || []).map((r) => ({ cat: r.name, m0: r.values[0], m1: r.values[1], m2: r.values[2] }));
  const cash = (a?.cashFlow?.months || []).map((m) => ({ month: monthLabel(m.month), inflow: m.inflow, outflow: m.outflow }));
  const pipeline = (a?.pipeline || []).map((p, i) => ({ ...p, name: p.label, display: `${p.label} · ${p.value}`, fill: [mutedInk, "#a8a29e", ink, gold][i] }));
  const settlement = (a?.settlement || []).map((s, i) => ({ ...s, name: s.label, fill: [gold, mutedInk, "#525252", ink][i] }));
  const topCustomers = (a?.topCustomers || []).map((r) => ({ name: r.name, aed: r.netRevenue }));
  const ageing = (a?.ageing || []).map((b) => ({ bucket: b.label, receivables: b.receivables, payables: b.payables }));
  const vendors = a?.topVendors || [];
  const collections = (a?.collections || []).map((w) => ({ week: dayLabel(w.weekStart), receipts: w.receipts, invoiced: w.invoiced }));
  const treemap = (a?.treemap || []).map((t, i) => ({ name: t.name, size: t.size, fill: [ink, gold, "#525252", mutedInk, "#737373", theme === "dark" ? "#404040" : "#d6d3d1", theme === "dark" ? "#2a2a2a" : "#a8a29e", "var(--chart-3)"][i] }));
  const hourly = (a?.hourly || []).map((h) => ({ ...h, hour: hourLabel(h.hour) }));
  const radarColours = [ink, gold, mutedInk, "#737373"];

  return (
    <>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <Card data-anim="bento" className={cn(cardClass, "lg:col-span-5")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Weekly order pulse</CardTitle>
            <CardDescription>Orders vs returns · last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={!weekly.some((w) => w.orders || w.returns)} emptyText="No orders or returns in the last 7 days" height={220}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={weekly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                  <Tooltip contentStyle={tip} />
                  <Bar dataKey="orders" name="Orders" fill={ink} radius={[8, 8, 0, 0]} maxBarSize={22} />
                  <Line type="monotone" dataKey="returns" name="Returns" stroke="var(--chart-2)" strokeWidth={3} dot={{ r: 4, fill: "var(--chart-2)", strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartArea>
            <div className="mt-1 flex justify-center gap-4 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-foreground" /> Orders</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--highlight)]" /> Returns</span>
            </div>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "lg:col-span-3")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Customer mix</CardTitle>
            <CardDescription>Revenue share · this {word}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={customerMix.length === 0} emptyText={`No sales this ${word}`} height={160}>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={customerMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3}>
                    {customerMix.map((e, i) => <Cell key={e.key} fill={mix[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={tip} formatter={(v, n) => [formatCurrencyAED(v), n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-1 space-y-1.5">
                {customerMix.map((cm, i) => (
                  <div key={cm.key} className="flex items-center justify-between text-xs">
                    <span className="inline-flex min-w-0 items-center gap-1.5 font-medium">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: mix[i] }} />
                      <span className="truncate">{cm.name}</span>
                    </span>
                    <span className="font-bold">{formatNumber(cm.sharePct, 1)}%</span>
                  </div>
                ))}
              </div>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "lg:col-span-4")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Performance</CardTitle>
            <CardDescription>Collection rate · gross margin · stock availability</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={perf.length === 0} emptyText="Nothing to measure yet" height={180}>
              <ResponsiveContainer width="100%" height={180}>
                <RadialBarChart innerRadius="28%" outerRadius="100%" data={perf.map((p) => ({ ...p, bar: Math.max(0, Math.min(100, p.value)) }))} startAngle={90} endAngle={-270}>
                  <RadialBar background dataKey="bar" cornerRadius={8} />
                  <Tooltip contentStyle={tip} formatter={(v, n, item) => [`${formatNumber(item.payload.value, 1)}%`, item.payload.name]} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs font-semibold">
                {perf.map((g) => (
                  <span key={g.name} className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: g.fill }} />
                    {g.name} {formatNumber(g.value, 1)}%
                  </span>
                ))}
              </div>
            </ChartArea>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-7")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Sales vs purchase vs profit</CardTitle>
            <CardDescription>Last 8 months · AED</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={!monthly.some((m) => m.sales || m.purchases || m.grossProfit)} emptyText="No sales or purchases posted in the last 8 months" height={280}>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={monthly}>
                  <defs>
                    <linearGradient id="profitSoft" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={compactAmount} />
                  <Tooltip contentStyle={tip} labelFormatter={(_, p) => p?.[0]?.payload.full} formatter={(v, n) => [formatCurrencyAED(v), n]} />
                  <Legend />
                  <Bar dataKey="sales" name="Sales" fill={ink} radius={[6, 6, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="purchases" name="Purchases" fill="#a8a29e" radius={[6, 6, 0, 0]} maxBarSize={18} />
                  <Area type="monotone" dataKey="grossProfit" name="Gross profit" fill="url(#profitSoft)" stroke="var(--chart-2)" strokeWidth={2.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-5")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Category sales</CardTitle>
            <CardDescription>This month vs last month · AED</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={categories.length === 0} emptyText="No category sales this month or last" height={280}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={categories} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={compactAmount} />
                  <YAxis type="category" dataKey="name" width={84} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip contentStyle={tip} formatter={aedTip} />
                  <Legend />
                  <Bar dataKey="previous" name="Last month" fill="#e7e5e4" radius={[0, 8, 8, 0]} barSize={12} />
                  <Bar dataKey="current" name="This month" fill="var(--chart-2)" radius={[0, 8, 8, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card data-anim="bento" className={cardClass}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Category performance by month</CardTitle>
            <CardDescription>Last 3 months · AED</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={categoryBars.length === 0} emptyText="No category sales in the last 3 months" height={240}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="cat" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={compactAmount} />
                  <Tooltip contentStyle={tip} formatter={aedTip} />
                  <Legend />
                  <Bar dataKey="m0" name={monthsOf[0] && monthYearLabel(monthsOf[0])} fill="#d6d3d1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="m1" name={monthsOf[1] && monthYearLabel(monthsOf[1])} fill={ink} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="m2" name={monthsOf[2] && monthYearLabel(monthsOf[2])} fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cardClass}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Cash inflow vs outflow</CardTitle>
            <CardDescription>Cash and bank accounts · last 8 months · AED</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={!a || a.cashFlow.accounts === 0 || !cash.some((m) => m.inflow || m.outflow)} emptyText={a?.cashFlow?.accounts === 0 ? "No cash or bank account set up" : "No money in or out in the last 8 months"} height={240}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={cash}>
                  <defs>
                    <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ink} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={ink} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={compactAmount} />
                  <Tooltip contentStyle={tip} formatter={aedTip} />
                  <Legend />
                  <Area type="monotone" dataKey="inflow" name="Money in" stroke={ink} fill="url(#inFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="outflow" name="Money out" stroke="var(--chart-2)" fill="url(#outFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>
      </div>

      {/* ── Deeper analytics ── */}
      <div className="mt-8 mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Analytics</p>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Orders, ageing, customers and stock movement</h2>
          <p className="mt-1 text-sm text-muted-foreground">Worked out from your posted documents · pipeline · settlement · ageing · category radar</p>
        </div>
        {range && <Badge className="w-fit rounded-full bg-brand-soft text-brand-on-soft hover:bg-brand-soft">{range} · AED</Badge>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!a && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[1.35rem]" />)}
        {a?.kpis?.map((kpi) => (
          <Link key={kpi.key} to={kpi.to} className="block">
            <Card data-anim="bento" className="h-full rounded-[1.35rem] border-0 shadow-[var(--shadow-card)]">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight">{formatCurrencyCompact(kpi.value)}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  {kpi.count !== undefined
                    ? `${kpi.count} ${kpi.count === 1 ? "order" : "orders"} waiting for approval`
                    : kpi.changePct !== null
                      ? `${signed(kpi.changePct)} vs the same days last week`
                      : "Nothing to compare with last week"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-4")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Category health radar</CardTitle>
            <CardDescription>Volume · revenue · margin · stock value · customers (100 = best of the four)</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={!a || a.radar.categories.length === 0} emptyText={`No category sales this ${word}`} height={280}>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={a?.radar?.metrics}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  {a?.radar?.categories?.map((cat, i) => (
                    <Radar key={cat.key} name={cat.name} dataKey={cat.key} stroke={radarColours[i]} fill={radarColours[i]} fillOpacity={0.15 + i * 0.03} strokeWidth={2} />
                  ))}
                  <Legend />
                  <Tooltip contentStyle={tip} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-4")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Order pipeline</CardTitle>
            <CardDescription>Draft → approved → part-paid or paid → fully paid</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={!a || a.pipeline[0].value === 0} emptyText={`No sales orders this ${word}`} height={280}>
              <ResponsiveContainer width="100%" height={280}>
                <FunnelChart>
                  <Tooltip contentStyle={tip} />
                  <Funnel dataKey="value" data={pipeline} isAnimationActive>
                    <LabelList position="right" fill="var(--foreground)" stroke="none" dataKey="display" fontSize={12} />
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-4")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Invoice settlement</CardTitle>
            <CardDescription>Sales invoices of this {word} · by how far they are paid</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={!a || sum(a.settlement, "count") === 0} emptyText={`No sales invoices this ${word}`} height={200}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={settlement} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={4}>
                    {settlement.map((e) => <Cell key={e.key} fill={e.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tip} formatter={(v, n, item) => [`${v} · ${formatCurrencyAED(item.payload.amount)}`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs font-semibold">
                {settlement.map((s) => (
                  <span key={s.key} className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.fill }} />
                    {s.name} {s.count}
                  </span>
                ))}
              </div>
            </ChartArea>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-5")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Top customers</CardTitle>
            <CardDescription>Net revenue this {word} · AED</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={topCustomers.length === 0} emptyText={`No sales this ${word}`} height={280}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topCustomers} layout="vertical" margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} tickFormatter={compactAmount} />
                  <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} fontSize={11} />
                  <Tooltip contentStyle={tip} formatter={(v) => [formatCurrencyAED(v), "Revenue"]} />
                  <Bar dataKey="aed" radius={[0, 10, 10, 0]} maxBarSize={18}>
                    {topCustomers.map((_, i) => <Cell key={i} fill={i === 0 ? gold : ink} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-4")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Receivables vs payables ageing</CardTitle>
            <CardDescription>By days past due · AED</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={!a || !ageing.some((b) => b.receivables || b.payables)} emptyText="Nothing owed to you or by you" height={280}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ageing}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="bucket" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={compactAmount} />
                  <Tooltip contentStyle={tip} formatter={aedTip} />
                  <Legend />
                  <Bar dataKey="receivables" name="Receivables" fill={ink} radius={[8, 8, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="payables" name="Payables" fill={gold} radius={[8, 8, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-3")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Top vendors</CardTitle>
            <CardDescription>Purchases this {word} · AED · change</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            {!a && [0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}
            {a && vendors.length === 0 && <Empty height={200}>No purchases this {word}</Empty>}
            {vendors.map((v, i) => (
              <div key={v.partyId}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-semibold">{v.name}</span>
                  <span className="shrink-0 font-bold">
                    {formatCurrencyCompact(v.purchases)}{v.changePct !== null && ` · ${signed(v.changePct)}`}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(v.purchases / vendors[0].purchases) * 100}%`, background: i === 0 ? gold : ink }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-7")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Collections vs invoicing</CardTitle>
            <CardDescription>Weekly, last 6 weeks · AED</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={!collections.some((w) => w.receipts || w.invoiced)} emptyText="No receipts or invoices in the last 6 weeks" height={260}>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={collections}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={compactAmount} />
                  <Tooltip contentStyle={tip} formatter={aedTip} />
                  <Legend />
                  <Bar dataKey="receipts" name="Receipts" fill={ink} radius={[8, 8, 0, 0]} maxBarSize={28} />
                  <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke={gold} strokeWidth={3} dot={{ r: 4, fill: gold, strokeWidth: 0 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-5")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">SKU revenue map</CardTitle>
            <CardDescription>Treemap · top items by net revenue this {word}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={analytics} empty={treemap.length === 0} emptyText={`No item sales this ${word}`} height={260}>
              <ResponsiveContainer width="100%" height={260}>
                <Treemap
                  data={treemap}
                  dataKey="size"
                  stroke="var(--background)"
                  aspectRatio={4 / 3}
                  content={({ x, y, width, height, name, fill }) => {
                    if (width < 36 || height < 28) return null;
                    return (
                      <g>
                        <rect x={x} y={y} width={width} height={height} style={{ fill, stroke: "var(--background)", strokeWidth: 3 }} rx={10} />
                        <text x={x + 8} y={y + 18} fill={fill === gold ? "#171717" : "#fafafa"} fontSize={11} fontWeight={700}>
                          {name}
                        </text>
                      </g>
                    );
                  }}
                />
              </ResponsiveContainer>
            </ChartArea>
          </CardContent>
        </Card>
      </div>

      <Card data-anim="bento" className={cn("mt-4", cardClass)}>
        <CardHeader className="pb-1">
          <CardTitle className="text-base font-extrabold">Documents created by hour</CardTitle>
          <CardDescription>Trade documents and vouchers by weekday · last 4 weeks · Dubai time</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartArea state={analytics} empty={hourly.length === 0} emptyText="No documents created in the last 4 weeks" height={260}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={tip} />
                <Legend />
                <Bar dataKey="weekend" name="Sat/Sun" stackId="d" fill="#a8a29e" />
                <Bar dataKey="mon" name="Mon" stackId="d" fill={theme === "dark" ? "#2a2a2a" : "#d6d3d1"} />
                <Bar dataKey="tue" name="Tue" stackId="d" fill={mutedInk} />
                <Bar dataKey="wed" name="Wed" stackId="d" fill="#525252" />
                <Bar dataKey="thu" name="Thu" stackId="d" fill={ink} />
                <Bar dataKey="fri" name="Fri" stackId="d" fill={gold} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartArea>
        </CardContent>
      </Card>
    </>
  );
}
