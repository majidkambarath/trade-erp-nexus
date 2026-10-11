import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { CURRENCY, formatCurrencyAED, formatNumber } from "@/utils/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { pageSession } from "@/lib/pageSession";
import { ChartArea } from "./widgets";
import { motionOK } from "./motion";
import { CountUp } from "./CountUp";
import { flowNumber, monthLabel, monthYearLabel, profitSteps, SPLIT } from "./helpers";
import { Waterfall } from "./FlowCharts";
import { graphValues, statementGraph } from "./sankeyLayout";
import FlowSankey from "./FlowSankey";
import CashCycle from "./CashCycle";
import { MonthlySplit, SplitRing, ViewSwitch } from "./SplitViews";

const cardClass = "rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]";
const session = pageSession("dashboard-flow");

// The business as one story: bought -> in stock -> sold -> collected, with what is still owed each way underneath; then
// where each dirham of revenue went (one card, three ways to see it), and how long cash is tied up (the cash cycle).
// Every figure is one a report owns (the server's `businessFlow`), every tile opens the page behind it.

function Connector() {
  const ref = useRef(null);
  // three dots run left to right a few times when the strip first draws, then stop: the motion says "this flows"
  // without being a loop that never ends
  useLayoutEffect(() => {
    if (!motionOK() || !ref.current) return undefined;
    const ctx = gsap.context(() => {
      gsap.fromTo("[data-dot]", { x: 0, opacity: 0 }, { x: 34, opacity: 1, duration: 1.1, ease: "none", repeat: 3, stagger: 0.35, delay: 0.5 });
    }, ref);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={ref} aria-hidden="true" className="relative hidden h-10 w-12 shrink-0 items-center self-center lg:flex">
      <span className="absolute left-0 right-3 top-1/2 h-px bg-border" />
      <ArrowRight className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      {[0, 1, 2].map((i) => (
        <span key={i} data-dot className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full" style={{ background: "var(--chart-2)" }} />
      ))}
    </div>
  );
}

function Tile({ to, label, note, value, change, accent, small }) {
  const up = change !== null && change !== undefined && change >= 0;
  const Trend = up ? TrendingUp : TrendingDown;
  return (
    <Link
      to={to}
      title={formatCurrencyAED(value)}
      className={cn(
        "group flex min-w-0 flex-1 flex-col justify-between rounded-2xl border border-border/70 bg-card p-4 outline-none transition",
        "hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] focus-visible:ring-2 focus-visible:ring-ring",
        small && "p-3",
      )}
      style={accent ? { borderLeft: `4px solid ${accent}` } : undefined}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {/* the currency is a small prefix so the figure itself can be large and still fit a phone's half-width tile */}
      <p className={cn("mt-1 whitespace-nowrap font-extrabold tracking-tight", small ? "text-lg" : "text-xl sm:text-2xl")}>
        <span className="text-xs font-semibold text-muted-foreground">{CURRENCY}</span>{" "}
        <CountUp value={value} format={flowNumber} />
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
      {change !== null && change !== undefined && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold">
          <Trend className="h-3.5 w-3.5" aria-hidden="true" />
          {up ? "+" : "−"}{formatNumber(Math.abs(change), 1)}% on the period before
        </p>
      )}
    </Link>
  );
}

const VIEWS = [
  { key: "split", label: "Split" },
  { key: "months", label: "Month by month" },
  { key: "flow", label: "Flow" },
];

// `initialView` is for tests and links; otherwise the card opens on what the person last chose in this tab, else the split
export default function BusinessFlow({ state, scope, initialView }) {
  const navigate = useNavigate();
  const { at } = scope;
  const flow = state.data?.businessFlow;
  const [view, setView] = useState(() => initialView || session.get("view", "split"));
  const panelRef = useRef(null);
  const graph = useMemo(() => (flow ? statementGraph(flow.statement) : null), [flow]);

  // each stage's share of revenue in the period before (an older server sends no statement)
  const before = useMemo(() => {
    const st = flow?.previous?.statement;
    if (!st || !(st.revenue > 0)) return null;
    return Object.fromEntries([...graphValues(statementGraph(st))].map(([id, v]) => [id, (v / st.revenue) * 100]));
  }, [flow]);

  // the statement as three parts of one whole: goods, running the business, profit (a loss shows as no profit segment)
  const parts = useMemo(() => {
    const st = flow?.statement;
    if (!st || !(st.revenue > 0)) return null;
    const spec = [
      { key: "goods", label: "Goods you sold", value: st.directCosts, was: before?.cogs, ...SPLIT.goods },
      { key: "running", label: "Running the business", value: st.operatingExpenses, was: before?.opex, ...SPLIT.running },
      { key: "profit", label: "Profit", value: Math.max(0, st.netProfit), was: before?.net, ...SPLIT.profit },
    ];
    const sum = spec.reduce((t, p) => t + p.value, 0);
    return spec.map((p) => ({
      ...p,
      share: (p.value / st.revenue) * 100,
      per100: Math.round((p.value / st.revenue) * 10000) / 100,
      width: sum > 0 ? (p.value / sum) * 100 : 0,
    }));
  }, [flow, before]);

  // The chart in one sentence: of every 100 sold, what is profit, and whether that is better or worse than the period before
  const headline = useMemo(() => {
    const st = flow?.statement;
    if (!st || !(st.revenue > 0)) return null;
    const profit = Math.round((st.netProfit / st.revenue) * 10000) / 100;
    const was = flow.previous?.revenue > 0 ? (flow.previous.netProfit / flow.previous.revenue) * 100 : null;
    return { profit, points: was === null ? null : Math.round((profit - was) * 10) / 10 };
  }, [flow]);

  // the eight months, when the server sends net profit with them
  const months = useMemo(() => {
    const rows = state.data?.monthly;
    if (!Array.isArray(rows) || rows.length === 0 || !rows.every((m) => Number.isFinite(m.netProfit))) return null;
    return rows.map((m) => {
      const goods = Math.max(0, m.sales - m.grossProfit);
      const running = Math.max(0, m.grossProfit - m.netProfit);
      return {
        month: m.month, label: monthLabel(m.month), full: monthYearLabel(m.month),
        revenue: m.sales, goods, running, profit: Math.max(0, m.netProfit), net: m.netProfit,
        margin: m.sales > 0 ? (m.netProfit / m.sales) * 100 : null,
      };
    });
  }, [state.data]);

  const views = months ? VIEWS : VIEWS.filter((v) => v.key !== "months");
  const shown = views.some((v) => v.key === view) ? view : "split";
  const choose = (next) => {
    setView(next);
    session.set("view", next);
  };

  // a view change is a small, quick settle: the new picture rises into place
  useLayoutEffect(() => {
    if (!motionOK() || !panelRef.current) return undefined;
    const tween = gsap.fromTo(panelRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out", clearProps: "opacity,transform" });
    return () => tween.kill();
  }, [shown]);

  // an older server sends no flow: say nothing rather than a card that cannot fill
  if (state.data && !flow) return null;

  const s = flow?.stages;
  const quiet = !!flow && Object.values(s).every((v) => !v) && !flow.statement.revenue;
  const asAt = scope.current ? "today" : scope.to;
  const describe = {
    split: `Where every ${CURRENCY} 100 of sales goes · ${at}`,
    months: "Each month's revenue, cut into goods, running costs and profit",
    flow: `Revenue to net profit · ${at} · ribbon width is the amount`,
  };

  return (
    <section aria-labelledby="business-flow-title" className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Business flow</p>
          <h2 id="business-flow-title" className="text-xl font-extrabold tracking-tight sm:text-2xl">From buying to cash</h2>
          <p className="mt-1 text-sm text-muted-foreground">What came in, what it cost and how long your money waits · {at} · {CURRENCY}</p>
        </div>
        <Badge className="w-fit rounded-full bg-brand-soft text-brand-on-soft hover:bg-brand-soft">Every tile opens its report</Badge>
      </div>

      <Card data-anim="bento" className={cardClass}>
        <CardContent className="p-4 sm:p-5">
          <ChartArea state={state} empty={quiet} emptyText="No sales or purchases yet. Approve an invoice or a purchase order and your business flow appears here." height={150}>
            {s && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:flex lg:items-stretch lg:gap-0">
                  <Tile to="/purchase-order" label="Bought" note={`before VAT · ${at}`} value={s.bought} />
                  <Connector />
                  <Tile to="/stock-reports" label="In stock" note={`at cost · ${asAt}`} value={s.stock} />
                  <Connector />
                  <Tile to="/sales-order" label="Sold" note={`before VAT · ${at}`} value={s.sold} change={flow.previous.revenueChangePct} />
                  <Connector />
                  <Tile to="/receipt-voucher" label="Collected" note={`receipts · ${at}`} value={s.collected} />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Tile small accent="var(--chart-2)" to="/ageing" label="Customers still owe you" note={`with VAT · as at ${asAt}`} value={s.owedByCustomers} />
                  <Tile small accent="var(--chart-4)" to="/ageing" label="You still owe vendors" note={`with VAT · as at ${asAt}`} value={s.owedToVendors} />
                </div>
              </>
            )}
          </ChartArea>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card data-anim="bento" className={cn(cardClass, "flex flex-col xl:col-span-7")}>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base font-extrabold">Where the revenue went</CardTitle>
                <CardDescription className="mt-1.5">{describe[shown]}</CardDescription>
              </div>
              {flow && graph?.links.length > 0 && <ViewSwitch value={shown} onChange={choose} options={views} />}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-center">
            <ChartArea state={state} empty={!graph || graph.links.length === 0} emptyText={`No revenue posted ${at}`} height={310}>
              {headline && (
                <div className="mb-5" data-headline>
                  <p className="text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                    {headline.profit >= 0 ? (
                      <>Of every {CURRENCY} 100 you sell, <span className="font-extrabold">{CURRENCY} {formatNumber(headline.profit, 2)}</span> is profit.</>
                    ) : (
                      <>Of every {CURRENCY} 100 you sell, you <span className="font-extrabold">lose {CURRENCY} {formatNumber(Math.abs(headline.profit), 2)}</span>.</>
                    )}
                  </p>
                  {headline.points !== null && headline.points !== 0 && (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-semibold">
                      {headline.points > 0 ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
                      {headline.points > 0 ? "Up" : "Down"} {formatNumber(Math.abs(headline.points), 1)} points on the period before
                    </p>
                  )}
                  {/* the ring carries this itself; the other two views get it as one bar of 100 and its key */}
                  {parts && shown !== "split" && (
                    <>
                      <div className="mt-3 flex h-3 w-full gap-0.5" aria-hidden="true">
                        {parts.map((p) => (
                          <span key={p.key} className="h-full rounded-full" style={{ width: `${p.width}%`, minWidth: p.value > 0 ? 6 : 0, background: p.colour, opacity: p.opacity }} />
                        ))}
                      </div>
                      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs" aria-label={`Where every ${CURRENCY} 100 goes`}>
                        {parts.map((p) => (
                          <li key={p.key} className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: p.colour, opacity: p.opacity }} />
                            <span className="text-muted-foreground">{p.label}</span>
                            <span className="font-semibold">{CURRENCY} {formatNumber(p.per100, 2)}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <div ref={panelRef}>
                {shown === "split" && parts && (
                  <SplitRing parts={parts} net={flow.statement.netProfit} margin={(flow.statement.netProfit / flow.statement.revenue) * 100} />
                )}
                {shown === "months" && months && <MonthlySplit rows={months} />}
                {shown === "flow" && graph && (
                  <FlowSankey
                    graph={graph}
                    before={before}
                    narrow={<Waterfall steps={profitSteps(flow.statement)} />}
                    openLabel="Open the profit and loss"
                    onOpen={(n) => navigate(n.to)}
                    caption={
                      graph.notes.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {graph.notes.map((n) => (
                            <li key={n.key}>
                              {n.key === "cogs"
                                ? `Cost of goods sold is ${formatCurrencyAED(n.amount)} more than revenue.`
                                : `Expenses are ${formatCurrencyAED(n.amount)} more than gross profit and other income: a net loss.`}
                            </li>
                          ))}
                        </ul>
                      )
                    }
                  />
                )}
              </div>
              {shown === "split" && graph?.notes.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {graph.notes.map((n) => (
                    <li key={n.key}>
                      {n.key === "cogs"
                        ? `Cost of goods sold is ${formatCurrencyAED(n.amount)} more than revenue.`
                        : `Expenses are ${formatCurrencyAED(n.amount)} more than gross profit and other income: a net loss.`}
                    </li>
                  ))}
                </ul>
              )}
            </ChartArea>
          </CardContent>
        </Card>

        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-5")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Cash cycle</CardTitle>
            <CardDescription>Days between paying vendors and collecting from customers</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={state} empty={!flow} emptyText="No cash cycle yet" height={310}>
              {flow && <CashCycle cycle={flow.cycle} />}
            </ChartArea>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
