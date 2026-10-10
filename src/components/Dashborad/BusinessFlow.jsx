import React, { useLayoutEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { CURRENCY, formatCurrencyAED, formatNumber } from "@/utils/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ChartArea } from "./widgets";
import { motionOK } from "./motion";
import { CountUp } from "./CountUp";
import { flowNumber } from "./helpers";
import { statementGraph } from "./sankeyLayout";
import FlowSankey from "./FlowSankey";
import CashCycle from "./CashCycle";

const cardClass = "rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]";

// The business as one story: bought -> in stock -> sold -> collected, with what is still owed each way underneath; then
// where each dirham of revenue went (the statement as a flow), and how long cash is tied up (the cash cycle).
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

export default function BusinessFlow({ state, scope }) {
  const navigate = useNavigate();
  const { at } = scope;
  const flow = state.data?.businessFlow;
  const graph = useMemo(() => (flow ? statementGraph(flow.statement) : null), [flow]);

  // an older server sends no flow: say nothing rather than a card that cannot fill
  if (state.data && !flow) return null;

  const s = flow?.stages;
  const quiet = !!flow && Object.values(s).every((v) => !v) && !flow.statement.revenue;
  const asAt = scope.current ? "today" : scope.to;

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
        <Card data-anim="bento" className={cn(cardClass, "xl:col-span-7")}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-extrabold">Where the revenue went</CardTitle>
            <CardDescription>Revenue to net profit · {at} · ribbon width is the amount</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartArea state={state} empty={!graph || graph.links.length === 0} emptyText={`No revenue posted ${at}`} height={310}>
              {graph && (
                <FlowSankey
                  graph={graph}
                  height={310}
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
