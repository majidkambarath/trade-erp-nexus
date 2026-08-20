import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  ShoppingCart,
  Calendar,
  RefreshCw,
  MapPin,
  Moon,
  Sun,
  ArrowUpRight,
  Bell,
  Receipt,
  Percent,
  Truck,
  CheckCircle2,
  Warehouse,
  Target,
  Wallet,
  MoreHorizontal,
  Plus,
  Search,
  AlertTriangle,
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
import { formatCurrencyAED } from "@/utils/format";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const salesTrend = [
  { month: "Jan", sales: 450000, purchase: 320000, profit: 130000 },
  { month: "Feb", sales: 520000, purchase: 380000, profit: 140000 },
  { month: "Mar", sales: 480000, purchase: 340000, profit: 140000 },
  { month: "Apr", sales: 610000, purchase: 430000, profit: 180000 },
  { month: "May", sales: 550000, purchase: 390000, profit: 160000 },
  { month: "Jun", sales: 670000, purchase: 460000, profit: 210000 },
  { month: "Jul", sales: 720000, purchase: 500000, profit: 220000 },
  { month: "Aug", sales: 680000, purchase: 470000, profit: 210000 },
];

const sparkA = [
  { x: 1, y: 20 },
  { x: 2, y: 28 },
  { x: 3, y: 22 },
  { x: 4, y: 36 },
  { x: 5, y: 30 },
  { x: 6, y: 42 },
  { x: 7, y: 48 },
];

const sparkB = [
  { x: 1, y: 40 },
  { x: 2, y: 32 },
  { x: 3, y: 38 },
  { x: 4, y: 28 },
  { x: 5, y: 34 },
  { x: 6, y: 30 },
  { x: 7, y: 26 },
];

const statusRows = [
  { label: "Active orders", value: "148/160", tag: "Active", tone: "ok" },
  { label: "Pending POs", value: "23/40", tag: "Pending", tone: "warn" },
  { label: "Low stock SKUs", value: "7/210", tag: "Alert", tone: "danger" },
  { label: "New customers", value: "5/12", tag: "New", tone: "muted" },
];

const activities = [
  {
    title: "Sales order published · Al Maya",
    meta: "2 hours ago",
    status: "Completed",
  },
  {
    title: "PO approved · Emirates Food",
    meta: "5 hours ago",
    status: "Completed",
  },
  {
    title: "VAT draft prepared · FTA",
    meta: "Yesterday",
    status: "In review",
  },
  {
    title: "Stock alert · Basmati Rice",
    meta: "Yesterday",
    status: "Open",
  },
];

const products = [
  { name: "Basmati Rice 5kg", sales: 485000, growth: 18.5, fill: 86 },
  { name: "Sunflower Oil 4L", sales: 392000, growth: 12.3, fill: 74 },
  { name: "Full Cream Milk 1L", sales: 318000, growth: 8.1, fill: 58 },
  { name: "Arabic Coffee 250g", sales: 198000, growth: 22.1, fill: 91 },
];

const weeklyOrders = [
  { day: "Sat", orders: 42, returns: 4 },
  { day: "Sun", orders: 28, returns: 2 },
  { day: "Mon", orders: 76, returns: 5 },
  { day: "Tue", orders: 88, returns: 6 },
  { day: "Wed", orders: 95, returns: 7 },
  { day: "Thu", orders: 102, returns: 8 },
  { day: "Fri", orders: 118, returns: 9 },
];

const branchPerf = [
  { name: "Al Quoz", sales: 920, target: 1000 },
  { name: "JAFZA", sales: 640, target: 700 },
  { name: "ICAD", sales: 480, target: 550 },
  { name: "Sharjah", sales: 410, target: 480 },
];

const cashFlow = [
  { month: "Jan", inflow: 420, outflow: 310 },
  { month: "Feb", inflow: 480, outflow: 350 },
  { month: "Mar", inflow: 450, outflow: 330 },
  { month: "Apr", inflow: 560, outflow: 400 },
  { month: "May", inflow: 510, outflow: 370 },
  { month: "Jun", inflow: 620, outflow: 430 },
  { month: "Jul", inflow: 680, outflow: 470 },
  { month: "Aug", inflow: 640, outflow: 450 },
];

const categoryBars = [
  { cat: "Rice", q1: 180, q2: 210, q3: 240 },
  { cat: "Oils", q1: 140, q2: 160, q3: 175 },
  { cat: "Dairy", q1: 120, q2: 135, q3: 150 },
  { cat: "Frozen", q1: 95, q2: 110, q3: 130 },
  { cat: "Beverages", q1: 70, q2: 85, q3: 98 },
];

const categoryRadar = [
  { metric: "Volume", rice: 92, oils: 78, dairy: 70, frozen: 64 },
  { metric: "Margin", rice: 68, oils: 82, dairy: 74, frozen: 88 },
  { metric: "Velocity", rice: 85, oils: 72, dairy: 90, frozen: 58 },
  { metric: "Fill rate", rice: 96, oils: 91, dairy: 88, frozen: 79 },
  { metric: "Repeat", rice: 80, oils: 75, dairy: 86, frozen: 71 },
];

const topCustomers = [
  { name: "Al Maya Group", aed: 485 },
  { name: "Lulu Hypermarket", aed: 412 },
  { name: "Carrefour UAE", aed: 368 },
  { name: "Emirates Food", aed: 295 },
  { name: "HORECA Dubai", aed: 248 },
  { name: "Union Coop", aed: 210 },
];

const agingBuckets = [
  { bucket: "0–30d", current: 420, overdue: 0 },
  { bucket: "31–60d", current: 180, overdue: 45 },
  { bucket: "61–90d", current: 95, overdue: 62 },
  { bucket: "90d+", current: 40, overdue: 88 },
];

const emirateSales = [
  { emirate: "Dubai", sales: 920, growth: 12 },
  { emirate: "Abu Dhabi", sales: 640, growth: 8 },
  { emirate: "Sharjah", sales: 410, growth: 15 },
  { emirate: "Ajman", sales: 180, growth: 22 },
  { emirate: "RAK", sales: 145, growth: 6 },
];

const collectionsTrend = [
  { week: "W1", collected: 180, overdue: 42 },
  { week: "W2", collected: 210, overdue: 38 },
  { week: "W3", collected: 195, overdue: 45 },
  { week: "W4", collected: 240, overdue: 31 },
  { week: "W5", collected: 265, overdue: 28 },
  { week: "W6", collected: 290, overdue: 22 },
];

const hourlyPulse = [
  { hour: "8a", mon: 12, tue: 18, wed: 22, thu: 20, fri: 28 },
  { hour: "10a", mon: 32, tue: 40, wed: 38, thu: 44, fri: 52 },
  { hour: "12p", mon: 48, tue: 55, wed: 60, thu: 58, fri: 70 },
  { hour: "2p", mon: 36, tue: 42, wed: 45, thu: 50, fri: 48 },
  { hour: "4p", mon: 28, tue: 30, wed: 34, thu: 38, fri: 42 },
  { hour: "6p", mon: 18, tue: 22, wed: 20, thu: 24, fri: 30 },
];

function Dashboard() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const rootRef = useRef(null);
  const [period, setPeriod] = useState("month");
  const [tab, setTab] = useState("overview");
  const [now, setNow] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from("[data-anim='hero']", {
        y: -16,
        opacity: 0,
        duration: 0.45,
        ease: "power3.out",
      });
      gsap.from("[data-anim='bento']", {
        y: 24,
        opacity: 0,
        duration: 0.5,
        stagger: 0.07,
        delay: 0.08,
        ease: "power3.out",
      });
    }, rootRef);
    return () => ctx.revert();
  }, [theme, tab]);

  const dubaiLabel = useMemo(
    () =>
      now.toLocaleString("en-AE", {
        timeZone: "Asia/Dubai",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [now]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    gsap.fromTo(
      "[data-anim='bento']",
      { opacity: 0.5, y: 8 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.04 }
    );
    await new Promise((r) => setTimeout(r, 650));
    setRefreshing(false);
  };

  const tip = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    color: "var(--foreground)",
    boxShadow: "var(--shadow-elevated)",
    fontFamily: "var(--font-sans)",
  };

  const ink = theme === "dark" ? "#fafafa" : "#171717";
  const gold = "#f0c929";
  const mutedInk = theme === "dark" ? "#737373" : "#a8a29e";

  const inventoryMixTheme = useMemo(
    () => [
      { name: "Dry Goods", value: 32, color: ink },
      { name: "Chilled", value: 26, color: "#525252" },
      { name: "Frozen", value: 22, color: gold },
      { name: "Beverages", value: 14, color: mutedInk },
      { name: "Packaging", value: 6, color: theme === "dark" ? "#404040" : "#d6d3d1" },
    ],
    [ink, gold, mutedInk, theme]
  );

  const channelMixTheme = useMemo(
    () => [
      { name: "Retail chains", value: 38, color: ink },
      { name: "Hypermarkets", value: 27, color: gold },
      { name: "HORECA", value: 18, color: "#525252" },
      { name: "Wholesale", value: 12, color: mutedInk },
      { name: "Online B2B", value: 5, color: theme === "dark" ? "#404040" : "#d6d3d1" },
    ],
    [ink, gold, mutedInk, theme]
  );

  const goalRadialTheme = useMemo(
    () => [
      { name: "Sales", value: 86, fill: gold },
      { name: "Margin", value: 72, fill: ink },
      { name: "Collections", value: 64, fill: "#737373" },
    ],
    [ink, gold]
  );

  const funnelTheme = useMemo(
    () => [
      { name: "Inquiries", value: 1240, fill: mutedInk },
      { name: "Quotes", value: 890, fill: "#a8a29e" },
      { name: "Confirmed", value: 640, fill: "#525252" },
      { name: "Dispatched", value: 520, fill: ink },
      { name: "Delivered", value: 486, fill: gold },
    ],
    [ink, gold, mutedInk]
  );

  const treemapTheme = useMemo(
    () => [
      { name: "Basmati 5kg", size: 186, fill: ink },
      { name: "Sunflower Oil", size: 142, fill: gold },
      { name: "Full Cream Milk", size: 118, fill: "#525252" },
      { name: "Arabic Coffee", size: 96, fill: mutedInk },
      { name: "Frozen Chicken", size: 88, fill: "#737373" },
      { name: "Dates Premium", size: 74, fill: theme === "dark" ? "#404040" : "#d6d3d1" },
      { name: "Olive Oil 1L", size: 62, fill: theme === "dark" ? "#2a2a2a" : "#a8a29e" },
      { name: "Juice Assorted", size: 54, fill: "#b45309" },
    ],
    [ink, gold, mutedInk, theme]
  );

  const vatSplitTheme = useMemo(
    () => [
      { name: "Output VAT", value: 186, fill: ink },
      { name: "Input VAT", value: 94, fill: gold },
      { name: "Net payable", value: 92, fill: mutedInk },
    ],
    [ink, gold, mutedInk]
  );

  const slaTheme = useMemo(
    () => [
      { name: "On time", value: 87, fill: gold },
      { name: "Delayed", value: 9, fill: mutedInk },
      { name: "Failed", value: 4, fill: "#525252" },
    ],
    [gold, mutedInk]
  );

  const toneDot = {
    ok: "bg-emerald-500",
    warn: "bg-[var(--highlight)]",
    danger: "bg-rose-500",
    muted: "bg-stone-400",
  };

  const toneBadge = {
    ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    warn: "bg-[var(--highlight-soft)] text-[var(--highlight)] border-transparent",
    danger: "bg-rose-500/15 text-rose-400 border-rose-500/20",
    muted: "bg-secondary text-muted-foreground border-transparent",
  };

  return (
    <div ref={rootRef} className="min-h-full bg-background font-sans text-foreground">
      <div className="mx-auto w-full max-w-[1680px] space-y-5 bg-background px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div
          data-anim="hero"
          className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Operations Overview
              </h1>
              <Badge
                variant="secondary"
                className="rounded-full border-0 bg-secondary font-semibold"
              >
                <MapPin className="mr-1 h-3 w-3" />
                Dubai, UAE
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              NH FOODS wholesale · AED · {dubaiLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handleRefresh}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
            <Button
              className="rounded-full bg-[var(--highlight)] text-[#171717] hover:opacity-90"
              onClick={() => navigate("/sales-order")}
            >
              <Plus className="h-4 w-4" />
              New Order
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => navigate("/sales-order")}
            >
              <Search className="h-4 w-4" />
              Search
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" className="rounded-full">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="gap-6">
          <div className="sticky top-0 z-20 flex justify-center bg-background/90 py-1 backdrop-blur-md" data-anim="hero">
            <TabsList className="h-12 gap-1 rounded-full bg-secondary/90 px-1.5 shadow-inner">
              <TabsTrigger value="overview" className="rounded-full px-5">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="sales" className="rounded-full px-5">
                <ShoppingCart className="h-4 w-4" />
                Sales
              </TabsTrigger>
              <TabsTrigger value="inventory" className="rounded-full px-5">
                <Package className="h-4 w-4" />
                Inventory
              </TabsTrigger>
              <TabsTrigger value="finance" className="rounded-full px-5">
                <TrendingUp className="h-4 w-4" />
                Reports
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ═══ OVERVIEW — PropValue bento ═══ */}
          <TabsContent value="overview" className="mt-2">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-5">
              {/* Left column */}
              <div className="flex flex-col gap-4 xl:col-span-3">
                <Card
                  data-anim="bento"
                  className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Portfolio rank
                        </p>
                        <p className="mt-1 text-5xl font-extrabold tracking-tight">
                          <span className="text-muted-foreground/50">#</span>12
                        </p>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-[var(--highlight-soft)] px-2.5 py-1 text-xs font-bold text-foreground">
                        <ArrowUpRight className="mr-0.5 h-3 w-3" />
                        +5
                      </span>
                    </div>
                    <Progress value={72} className="h-2.5 bg-secondary" />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Among UAE food distributors
                    </p>
                  </CardContent>
                </Card>

                <Card
                  data-anim="bento"
                  className="flex-1 rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold">Ops status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {statusRows.map((row) => (
                      <div
                        key={row.label}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn("h-2 w-2 rounded-full", toneDot[row.tone])}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{row.label}</p>
                            <p className="text-xs text-muted-foreground">{row.value}</p>
                          </div>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                            toneBadge[row.tone]
                          )}
                        >
                          {row.tag}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Center column */}
              <div className="flex flex-col gap-4 xl:col-span-6">
                <Card
                  data-anim="bento"
                  className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
                >
                  <CardHeader className="flex-row items-start justify-between space-y-0 pb-2">
                    <div className="grid w-full grid-cols-3 gap-3 pr-2">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Sales value
                        </p>
                        <p className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                          AED 2.46M
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Avg. margin
                        </p>
                        <p className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                          24.5%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Avg. order
                        </p>
                        <p className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                          AED 2.9K
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="hidden items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1.5 sm:flex">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <select
                          className="bg-transparent text-xs font-semibold outline-none"
                          value={period}
                          onChange={(e) => setPeriod(e.target.value)}
                        >
                          <option value="week">This Week</option>
                          <option value="month">This Month</option>
                          <option value="quarter">This Quarter</option>
                        </select>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={salesTrend}>
                        <defs>
                          <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f0c929" stopOpacity={0.55} />
                            <stop offset="100%" stopColor="#f0c929" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          stroke="var(--muted-foreground)"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={tip}
                          formatter={(v) => [formatCurrencyAED(v), "Sales"]}
                        />
                        <Area
                          type="monotone"
                          dataKey="sales"
                          stroke={ink}
                          strokeWidth={2.5}
                          fill="url(#goldFill)"
                          dot={{ r: 3, fill: ink, strokeWidth: 0 }}
                          activeDot={{ r: 6, fill: gold, stroke: ink, strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="mt-1 flex flex-wrap gap-4 text-xs font-semibold text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[var(--highlight)]" />
                        Live sales growth
                      </span>
                      <span>Peak Jul · AED 720k</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Card
                    data-anim="bento"
                    className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
                  >
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold">Top product</p>
                        <Badge className="rounded-full border-0 bg-[var(--highlight)] text-foreground hover:bg-[var(--highlight)]">
                          Hot
                        </Badge>
                      </div>
                      <p className="text-lg font-extrabold tracking-tight">
                        Basmati Rice 5kg
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrencyAED(485000)} · +18.5%
                      </p>
                      <div className="mt-3 h-14">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sparkA}>
                            <Line
                              type="monotone"
                              dataKey="y"
                              stroke="#f0c929"
                              strokeWidth={2.5}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    data-anim="bento"
                    className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
                  >
                    <CardContent className="p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold">Next VAT filing</p>
                        <Badge variant="secondary" className="rounded-full">
                          Due soon
                        </Badge>
                      </div>
                      <p className="text-lg font-extrabold tracking-tight">
                        {formatCurrencyAED(122839)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Estimated payable · 5% UAE VAT
                      </p>
                      <div className="mt-3 h-14">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={sparkB}>
                            <Line
                              type="monotone"
                              dataKey="y"
                              stroke={ink}
                              strokeWidth={2.5}
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Right column */}
              <div className="flex flex-col gap-4 xl:col-span-3">
                <Card
                  data-anim="bento"
                  className="overflow-hidden rounded-[1.75rem] border-0 bg-[var(--highlight)] text-foreground shadow-[var(--shadow-card)]"
                >
                  <CardContent className="relative p-6">
                    <p className="text-sm font-semibold opacity-80">Team hub</p>
                    <h3 className="mt-2 text-xl font-extrabold leading-snug tracking-tight">
                      Collaborate on market analysis
                    </h3>
                    <p className="mt-2 text-sm opacity-80">
                      Share Dubai branch insights with sales &amp; accounts.
                    </p>
                    <div className="mt-5 flex items-center">
                      {["A", "F", "O", "+"].map((a, i) => (
                        <span
                          key={a}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--highlight)] bg-foreground text-xs font-bold text-background",
                            i > 0 && "-ml-2"
                          )}
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card
                  data-anim="bento"
                  className="flex-1 rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold">Recent activity</CardTitle>
                      <button className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                        View all
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {activities.map((a) => (
                      <div key={a.title} className="flex gap-3">
                        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                          <CheckCircle2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug">{a.title}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">{a.meta}</span>
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold">
                              {a.status}
                            </span>
                          </div>
                        </div>
                      </div>
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
              ].map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.label}
                    data-anim="bento"
                    onClick={() => navigate(a.to)}
                    className="flex items-center gap-3 rounded-[1.35rem] border-0 bg-card p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-bold">{a.label}</span>
                  </button>
                );
              })}
            </div>

            {/* ── Extra analytics gallery ── */}
            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] lg:col-span-5"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">
                    Weekly order pulse
                  </CardTitle>
                  <CardDescription>Orders vs returns · this week</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={weeklyOrders}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip contentStyle={tip} />
                      <Bar dataKey="orders" fill={ink} radius={[8, 8, 0, 0]} maxBarSize={22} />
                      <Line
                        type="monotone"
                        dataKey="returns"
                        stroke="#f0c929"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#f0c929", strokeWidth: 0 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="mt-1 flex justify-center gap-4 text-xs font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-foreground" /> Orders
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[var(--highlight)]" /> Returns
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] lg:col-span-3"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">Channel mix</CardTitle>
                  <CardDescription>Revenue share</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={channelMixTheme}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={42}
                        outerRadius={68}
                        paddingAngle={3}
                      >
                        {channelMixTheme.map((e) => (
                          <Cell key={e.name} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tip} formatter={(v) => [`${v}%`, "Share"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-1 space-y-1.5">
                    {channelMixTheme.slice(0, 4).map((c) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                          {c.name}
                        </span>
                        <span className="font-bold">{c.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] lg:col-span-4"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">Goal progress</CardTitle>
                  <CardDescription>Sales · margin · collections</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <RadialBarChart
                      innerRadius="28%"
                      outerRadius="100%"
                      data={goalRadialTheme}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar background dataKey="value" cornerRadius={8} />
                      <Tooltip contentStyle={tip} formatter={(v) => [`${v}%`, "Progress"]} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-3 text-xs font-semibold">
                    {goalRadialTheme.map((g) => (
                      <span key={g.name} className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: g.fill }} />
                        {g.name} {g.value}%
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-7"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">
                    Sales vs purchase vs profit
                  </CardTitle>
                  <CardDescription>Full-year composed view · AED</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={salesTrend}>
                      <defs>
                        <linearGradient id="profitSoft" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f0c929" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#f0c929" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      />
                      <Tooltip
                        contentStyle={tip}
                        formatter={(v, n) => [
                          formatCurrencyAED(v),
                          n.charAt(0).toUpperCase() + n.slice(1),
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="sales" fill={ink} radius={[6, 6, 0, 0]} maxBarSize={18} />
                      <Bar dataKey="purchase" fill="#a8a29e" radius={[6, 6, 0, 0]} maxBarSize={18} />
                      <Area
                        type="monotone"
                        dataKey="profit"
                        fill="url(#profitSoft)"
                        stroke="#f0c929"
                        strokeWidth={2.5}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-5"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">
                    Branch vs target
                  </CardTitle>
                  <CardDescription>AED thousands · UAE locations</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={branchPerf} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={58}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <Tooltip contentStyle={tip} />
                      <Bar dataKey="target" fill="#e7e5e4" radius={[0, 8, 8, 0]} barSize={12} />
                      <Bar dataKey="sales" fill="#f0c929" radius={[0, 8, 8, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">
                    Category performance by quarter
                  </CardTitle>
                  <CardDescription>AED thousands</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={categoryBars}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="cat" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip contentStyle={tip} />
                      <Legend />
                      <Bar dataKey="q1" name="Q1" fill="#d6d3d1" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="q2" name="Q2" fill={ink} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="q3" name="Q3" fill="#f0c929" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">
                    Cash inflow vs outflow
                  </CardTitle>
                  <CardDescription>Receipts &amp; payments · AED 000s</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={cashFlow}>
                      <defs>
                        <linearGradient id="inFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ink} stopOpacity={0.25} />
                          <stop offset="100%" stopColor={ink} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="outFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f0c929" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#f0c929" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip contentStyle={tip} />
                      <Area
                        type="monotone"
                        dataKey="inflow"
                        stroke={ink}
                        fill="url(#inFill)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="outflow"
                        stroke="#f0c929"
                        fill="url(#outFill)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* ── Client showcase analytics ── */}
            <div className="mt-8 mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Client showcase
                </p>
                <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                  Deep analytics for the boardroom
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Live-style UAE wholesale KPIs · funnel · aging · SLA · category radar
                </p>
              </div>
              <Badge className="w-fit rounded-full bg-[var(--highlight)] text-[#171717] hover:bg-[var(--highlight)]">
                Demo data · AED 000s
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: "Pipeline value", value: "AED 2.4M", sub: "+18% WoW", up: true },
                { label: "On-time SLA", value: "87%", sub: "Target 90%", up: true },
                { label: "AR overdue", value: "AED 195k", sub: "−12% vs last", up: true },
                { label: "Active SKUs", value: "210", sub: "7 low stock", up: false },
              ].map((k) => (
                <Card
                  key={k.label}
                  data-anim="bento"
                  className="rounded-[1.35rem] border-0 shadow-[var(--shadow-card)]"
                >
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
                    <p className="mt-1 text-2xl font-extrabold tracking-tight">{k.value}</p>
                    <p
                      className={cn(
                        "mt-1 text-xs font-semibold",
                        k.up ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {k.sub}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-4"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">
                    Category health radar
                  </CardTitle>
                  <CardDescription>Volume · margin · velocity · fill · repeat</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={categoryRadar}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis
                        dataKey="metric"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar
                        name="Rice"
                        dataKey="rice"
                        stroke={ink}
                        fill={ink}
                        fillOpacity={0.15}
                        strokeWidth={2}
                      />
                      <Radar
                        name="Oils"
                        dataKey="oils"
                        stroke={gold}
                        fill={gold}
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                      <Radar
                        name="Dairy"
                        dataKey="dairy"
                        stroke={mutedInk}
                        fill={mutedInk}
                        fillOpacity={0.12}
                        strokeWidth={2}
                      />
                      <Legend />
                      <Tooltip contentStyle={tip} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-4"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">
                    Order pipeline funnel
                  </CardTitle>
                  <CardDescription>Inquiry → delivered conversion</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <FunnelChart>
                      <Tooltip contentStyle={tip} />
                      <Funnel dataKey="value" data={funnelTheme} isAnimationActive>
                        <LabelList
                          position="right"
                          fill="var(--foreground)"
                          stroke="none"
                          dataKey="name"
                          fontSize={12}
                        />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-4"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">
                    Delivery SLA mix
                  </CardTitle>
                  <CardDescription>Last 30 days · UAE fleet</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={slaTheme}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        paddingAngle={4}
                      >
                        {slaTheme.map((e) => (
                          <Cell key={e.name} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tip} formatter={(v) => [`${v}%`, "Share"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex justify-center gap-4 text-xs font-semibold">
                    {slaTheme.map((s) => (
                      <span key={s.name} className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.fill }} />
                        {s.name} {s.value}%
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-5"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">Top customers</CardTitle>
                  <CardDescription>Revenue MTD · AED thousands</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topCustomers} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                      />
                      <Tooltip contentStyle={tip} formatter={(v) => [`AED ${v}k`, "Revenue"]} />
                      <Bar dataKey="aed" radius={[0, 10, 10, 0]} maxBarSize={18}>
                        {topCustomers.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? gold : ink} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-4"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">
                    Receivables aging
                  </CardTitle>
                  <CardDescription>Current vs overdue · AED 000s</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={agingBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="bucket" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip contentStyle={tip} />
                      <Legend />
                      <Bar dataKey="current" stackId="a" fill={ink} maxBarSize={36} />
                      <Bar
                        dataKey="overdue"
                        stackId="a"
                        fill={gold}
                        radius={[8, 8, 0, 0]}
                        maxBarSize={36}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-3"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">Emirate sales</CardTitle>
                  <CardDescription>AED 000s · growth %</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-1">
                  {emirateSales.map((e) => (
                    <div key={e.emirate}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold">{e.emirate}</span>
                        <span className="font-bold">
                          {e.sales}k · +{e.growth}%
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(e.sales / emirateSales[0].sales) * 100}%`,
                            background: e.emirate === "Dubai" ? gold : ink,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-7"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">
                    Collections vs overdue
                  </CardTitle>
                  <CardDescription>Weekly cash recovery · AED 000s</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={collectionsTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis tickLine={false} axisLine={false} fontSize={12} />
                      <Tooltip contentStyle={tip} />
                      <Legend />
                      <Bar dataKey="collected" fill={ink} radius={[8, 8, 0, 0]} maxBarSize={28} />
                      <Line
                        type="monotone"
                        dataKey="overdue"
                        stroke={gold}
                        strokeWidth={3}
                        dot={{ r: 4, fill: gold, strokeWidth: 0 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-5"
              >
                <CardHeader className="pb-1">
                  <CardTitle className="text-base font-extrabold">SKU revenue map</CardTitle>
                  <CardDescription>Treemap · relative contribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <Treemap
                      data={treemapTheme}
                      dataKey="size"
                      stroke="var(--background)"
                      aspectRatio={4 / 3}
                      content={({ x, y, width, height, name, fill }) => {
                        if (width < 36 || height < 28) return null;
                        return (
                          <g>
                            <rect
                              x={x}
                              y={y}
                              width={width}
                              height={height}
                              style={{
                                fill,
                                stroke: "var(--background)",
                                strokeWidth: 3,
                              }}
                              rx={10}
                            />
                            <text
                              x={x + 8}
                              y={y + 18}
                              fill={fill === gold ? "#171717" : "#fafafa"}
                              fontSize={11}
                              fontWeight={700}
                            >
                              {name}
                            </text>
                          </g>
                        );
                      }}
                    />
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <Card
              data-anim="bento"
              className="mt-4 rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
            >
              <CardHeader className="pb-1">
                <CardTitle className="text-base font-extrabold">
                  Hourly order intensity
                </CardTitle>
                <CardDescription>
                  Stacked weekday bars · peak lunch &amp; evening windows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={hourlyPulse}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="hour" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} />
                    <Tooltip contentStyle={tip} />
                    <Legend />
                    <Bar
                      dataKey="mon"
                      name="Mon"
                      stackId="d"
                      fill={theme === "dark" ? "#2a2a2a" : "#d6d3d1"}
                    />
                    <Bar dataKey="tue" name="Tue" stackId="d" fill={mutedInk} />
                    <Bar dataKey="wed" name="Wed" stackId="d" fill="#525252" />
                    <Bar dataKey="thu" name="Thu" stackId="d" fill={ink} />
                    <Bar
                      dataKey="fri"
                      name="Fri"
                      stackId="d"
                      fill={gold}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ SALES ═══ */}
          <TabsContent value="sales" className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: "Orders MTD", value: "856", change: "+15.3%" },
                { label: "Avg. order", value: formatCurrencyAED(2868), change: "+4.2%" },
                { label: "Conversion", value: "68%", change: "+2.1%" },
              ].map((m, i) => (
                <Card
                  key={m.label}
                  data-anim="bento"
                  className={cn(
                    "rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]",
                    i === 0 && "bg-[var(--highlight)]"
                  )}
                >
                  <CardContent className="p-5">
                    <p className="text-sm font-medium text-foreground/70">{m.label}</p>
                    <p className="mt-1 text-3xl font-extrabold tracking-tight">{m.value}</p>
                    <p className="mt-1 inline-flex items-center text-xs font-bold">
                      <ArrowUpRight className="mr-0.5 h-3 w-3" />
                      {m.change}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-8"
              >
                <CardHeader>
                  <CardTitle className="font-extrabold">Sales vs Purchase</CardTitle>
                  <CardDescription>Monthly AED · Dubai market</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesTrend} barGap={8}>
                      <CartesianGrid stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                      />
                      <Tooltip
                        contentStyle={tip}
                        formatter={(v, n) => [
                          formatCurrencyAED(v),
                          n.charAt(0).toUpperCase() + n.slice(1),
                        ]}
                      />
                      <Bar dataKey="sales" fill={ink} radius={[10, 10, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="purchase" fill="#f0c929" radius={[10, 10, 0, 0]} maxBarSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-4"
              >
                <CardHeader>
                  <CardTitle className="font-extrabold">Best sellers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {products.map((p, i) => (
                    <div
                      key={p.name}
                      className="rounded-2xl bg-secondary/70 px-3 py-3"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-sm font-bold">
                          {i + 1}. {p.name}
                        </p>
                        <span className="text-xs font-bold">+{p.growth}%</span>
                      </div>
                      <Progress value={p.fill} className="h-1.5" />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatCurrencyAED(p.sales)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
              >
                <CardHeader>
                  <CardTitle className="font-extrabold">Daily order trend</CardTitle>
                  <CardDescription>Week view · Dubai ops</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={weeklyOrders}>
                      <defs>
                        <linearGradient id="ordFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f0c929" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#f0c929" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="day" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tip} />
                      <Area
                        type="monotone"
                        dataKey="orders"
                        stroke={ink}
                        fill="url(#ordFill)"
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
              >
                <CardHeader>
                  <CardTitle className="font-extrabold">Sales by channel</CardTitle>
                  <CardDescription>Customer segment mix</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={channelMixTheme}>
                      <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tip} formatter={(v) => [`${v}%`, "Share"]} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={36}>
                        {channelMixTheme.map((e) => (
                          <Cell key={e.name} fill={e.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ═══ INVENTORY ═══ */}
          <TabsContent value="inventory" className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { name: "Al Quoz, Dubai", fill: 78, skus: 1840 },
                { name: "Jebel Ali FZ", fill: 64, skus: 1120 },
                { name: "ICAD, Abu Dhabi", fill: 52, skus: 890 },
                { name: "Sharjah Industrial", fill: 41, skus: 640 },
              ].map((w, i) => (
                <Card
                  key={w.name}
                  data-anim="bento"
                  className={cn(
                    "rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]",
                    i === 0 && "bg-[var(--highlight)]"
                  )}
                >
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-center gap-2 font-bold">
                      <Warehouse className="h-4 w-4" />
                      {w.name}
                    </div>
                    <Progress value={w.fill} className="h-2" />
                    <p className="text-sm text-foreground/70">
                      {w.skus} SKUs · {w.fill}%
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
              >
                <CardHeader>
                  <CardTitle className="font-extrabold">Inventory mix</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={inventoryMixTheme}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                      >
                        {inventoryMixTheme.map((e) => (
                          <Cell key={e.name} fill={e.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tip} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-2">
                    {inventoryMixTheme.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: item.color }}
                          />
                          {item.name}
                        </span>
                        <span className="font-bold">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
              >
                <CardHeader>
                  <CardTitle className="font-extrabold">Stock alerts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { sku: "Basmati Rice 5kg", wh: "Al Quoz", left: "48 cartons" },
                    { sku: "Sunflower Oil 4L", wh: "Sharjah", left: "62 cartons" },
                    { sku: "Frozen Chicken", wh: "Jebel Ali", left: "35 units" },
                  ].map((a) => (
                    <div
                      key={a.sku}
                      className="flex items-center justify-between rounded-2xl bg-secondary/70 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="rounded-full bg-foreground p-2 text-background">
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                        <div>
                          <p className="text-sm font-bold">{a.sku}</p>
                          <p className="text-xs text-muted-foreground">{a.wh}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold">{a.left}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card
              data-anim="bento"
              className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
            >
              <CardHeader>
                <CardTitle className="font-extrabold">Warehouse capacity trend</CardTitle>
                <CardDescription>Fill % by location · demo series</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart
                    data={[
                      { m: "Mar", alQuoz: 62, jafza: 48, icad: 40, sharjah: 35 },
                      { m: "Apr", alQuoz: 68, jafza: 52, icad: 44, sharjah: 38 },
                      { m: "May", alQuoz: 70, jafza: 55, icad: 46, sharjah: 40 },
                      { m: "Jun", alQuoz: 74, jafza: 58, icad: 49, sharjah: 42 },
                      { m: "Jul", alQuoz: 76, jafza: 61, icad: 51, sharjah: 40 },
                      { m: "Aug", alQuoz: 78, jafza: 64, icad: 52, sharjah: 41 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="m" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tip} />
                    <Legend />
                    <Line type="monotone" dataKey="alQuoz" name="Al Quoz" stroke={ink} strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="jafza" name="JAFZA" stroke="#f0c929" strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="icad" name="ICAD" stroke="#737373" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="sharjah" name="Sharjah" stroke="#a8a29e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ FINANCE / REPORTS ═══ */}
          <TabsContent value="finance" className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { label: "Gross profit", value: formatCurrencyAED(602468), icon: Wallet },
                { label: "VAT payable", value: formatCurrencyAED(122839), icon: Percent },
                { label: "Target hit", value: "89%", icon: Target },
              ].map((m, i) => {
                const Icon = m.icon;
                return (
                  <Card
                    key={m.label}
                    data-anim="bento"
                    className={cn(
                      "rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]",
                      i === 2 && "bg-[var(--highlight)]"
                    )}
                  >
                    <CardContent className="flex items-center justify-between p-5">
                      <div>
                        <p className="text-sm font-medium text-foreground/70">{m.label}</p>
                        <p className="mt-1 text-2xl font-extrabold tracking-tight">
                          {m.value}
                        </p>
                      </div>
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card/70">
                        <Icon className="h-5 w-5" />
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card
              data-anim="bento"
              className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)]"
            >
              <CardHeader>
                <CardTitle className="font-extrabold">Value growth</CardTitle>
                <CardDescription>Gross profit trend · AED</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={salesTrend}>
                    <defs>
                      <linearGradient id="profitGold" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f0c929" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#f0c929" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      contentStyle={tip}
                      formatter={(v) => [formatCurrencyAED(v), "Profit"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke={ink}
                      fill="url(#profitGold)"
                      strokeWidth={2.5}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { module: "Receipt", amount: 2450000 },
                { module: "Payment", amount: 1890000 },
                { module: "Journal", amount: 890000 },
                { module: "Contra", amount: 450000 },
                { module: "Expense", amount: 1230000 },
              ].map((v) => (
                <Card
                  key={v.module}
                  data-anim="bento"
                  className="rounded-[1.5rem] border-0 shadow-[var(--shadow-card)]"
                >
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {v.module}
                    </p>
                    <p className="mt-1 text-sm font-extrabold">
                      {formatCurrencyAED(v.amount)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-7"
              >
                <CardHeader>
                  <CardTitle className="font-extrabold">Receivables aging</CardTitle>
                  <CardDescription>Board view · current vs overdue</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={agingBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tip} />
                      <Legend />
                      <Bar dataKey="current" stackId="a" fill={ink} maxBarSize={40} />
                      <Bar
                        dataKey="overdue"
                        stackId="a"
                        fill={gold}
                        radius={[8, 8, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card
                data-anim="bento"
                className="rounded-[1.75rem] border-0 shadow-[var(--shadow-card)] xl:col-span-5"
              >
                <CardHeader>
                  <CardTitle className="font-extrabold">VAT snapshot</CardTitle>
                  <CardDescription>Output · input · net payable · AED 000s</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={vatSplitTheme}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={74}
                        paddingAngle={3}
                      >
                        {vatSplitTheme.map((e) => (
                          <Cell key={e.name} fill={e.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tip} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {vatSplitTheme.map((v) => (
                      <div key={v.name} className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: v.fill }}
                          />
                          {v.name}
                        </span>
                        <span className="font-bold">AED {v.value}k</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default Dashboard;
