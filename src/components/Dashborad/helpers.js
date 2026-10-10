import { CURRENCY, formatDate, formatNumber, toInputDate } from "@/utils/format";
import { orgTimezone } from "@/utils/orgLocale";

// What every tab of the home dashboard shares: chart colours, the tooltip, short labels for months
// and days, relative times, the link of a voucher and the status rows.

// Chart colours are theme tokens (src/styles/tokens/semantic.css), so they follow dark mode and the
// active brand pack. "gold" is a legacy name: it is the brand accent.
export const ink = "var(--chart-1)";
export const gold = "var(--chart-2)";
export const mutedInk = "var(--chart-4)";

export const tip = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  color: "var(--foreground)",
  boxShadow: "var(--shadow-elevated)",
  fontFamily: "var(--font-sans)",
};

// Slice colours, in order, for donuts of up to six parts.
export const slices = (theme, order = "channel") => {
  const grey = theme === "dark" ? "#404040" : "#d6d3d1";
  return order === "inventory"
    ? [ink, "#525252", gold, mutedInk, grey, "#a8a29e"]
    : [ink, gold, "#525252", mutedInk, grey, "#a8a29e"];
};

// ---------------------------------------------------------------- the SKU revenue map

// A tile's fill and the ink that reads on it. The fills are theme tokens, so dark mode and brand packs follow;
// the ink cannot be one colour for all of them: white on the light grey tiles was unreadable, and in dark mode
// the ink / accent tokens turn light, so the text has to turn dark with them. `solid` is the token's resolved
// value, which the contrast test measures the ink against.
const TILE_LIGHT = "#fafafa";
const TILE_DARK = "#171717";
export function treemapPalette(theme) {
  const dark = theme === "dark";
  return [
    { fill: ink, text: dark ? TILE_DARK : TILE_LIGHT, solid: dark ? "#f4f5f7" : "#1a1c20" },
    { fill: gold, text: dark ? TILE_DARK : TILE_LIGHT, solid: dark ? "#4fbdd4" : "#0e7490" },
    { fill: "#525252", text: TILE_LIGHT, solid: "#525252" },
    { fill: mutedInk, text: dark ? TILE_DARK : TILE_LIGHT, solid: dark ? "#a3bb5e" : "#5b6b2f" },
    { fill: "#737373", text: TILE_LIGHT, solid: "#737373" },
    { fill: dark ? "#404040" : "#d6d3d1", text: dark ? TILE_LIGHT : TILE_DARK, solid: dark ? "#404040" : "#d6d3d1" },
    { fill: dark ? "#2a2a2a" : "#a8a29e", text: dark ? TILE_LIGHT : TILE_DARK, solid: dark ? "#2a2a2a" : "#a8a29e" },
    { fill: "var(--chart-3)", text: dark ? TILE_DARK : TILE_LIGHT, solid: dark ? "#c892d6" : "#7a3e8e" },
  ];
}

// Average glyph width of Inter at weight 600, in em. A little generous on purpose: a name is shortened by us,
// with an ellipsis, rather than cut mid-letter by the edge of its tile.
const GLYPH_EM = 0.6;
const clip = (s, n) => (s.length <= n ? s : `${s.slice(0, Math.max(1, n - 1)).trimEnd()}…`);

// A name broken into at most `maxLines` lines that fit `width` pixels, on word boundaries, the last line ending
// in an ellipsis when words are left over. [] when the tile is too narrow to say anything useful.
export function fitLabel(text, width, { fontSize = 12, maxLines = 2 } = {}) {
  const perLine = Math.floor(width / (fontSize * GLYPH_EM));
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || perLine < 6 || maxLines < 1) return [];
  const lines = [];
  let rest = words;
  while (rest.length && lines.length < maxLines) {
    let line = rest[0];
    let used = 1;
    if (lines.length === maxLines - 1) {
      line = rest.join(" ");
      used = rest.length;
    } else {
      while (used < rest.length && `${line} ${rest[used]}`.length <= perLine) {
        line = `${line} ${rest[used]}`;
        used += 1;
      }
    }
    lines.push(clip(line, perLine));
    rest = rest.slice(used);
  }
  return lines;
}

// ---------------------------------------------------------------- flows

// A flow drawn as bars: each step is a TOTAL (revenue, gross profit, closing stock: drawn from zero, and the running
// figure becomes it) or a CHANGE (starts where the running figure stood and moves it by `value`, which may be
// negative). Every bar is a [low, high] range, so a step that crosses zero (a loss) is drawn from where it really is.
export function waterfallSteps(steps) {
  let running = 0;
  return steps.map((s) => {
    const value = Number(s.value) || 0;
    if (s.kind === "total") {
      running = value;
      return { ...s, value, start: 0, end: value, range: [Math.min(0, value), Math.max(0, value)] };
    }
    const start = running;
    running = Math.round((start + value) * 100) / 100;
    return { ...s, value, start, end: running, range: [Math.min(start, running), Math.max(start, running)] };
  });
}

// An amount axis that always includes zero and reads in round steps (0, 500k, 1M, 1.5M rather than 0, 350k, 700k, 1.3M),
// including when a bar goes below zero. Returns the domain and the ticks to draw, both multiples of one 1 / 2 / 2.5 / 5 step.
export function axisScale(values, target = 4) {
  const nums = values.filter((v) => Number.isFinite(v));
  const lo = Math.min(0, ...nums);
  const hi = Math.max(0, ...nums);
  if (hi === lo) return { domain: [0, 1], ticks: [0, 1] };
  const rough = (hi - lo) / target;
  const unit = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * unit).find((x) => x >= rough * (1 - 1e-9));
  const from = Math.floor(lo / step + 1e-9) * step;
  const to = Math.ceil(hi / step - 1e-9) * step;
  const ticks = [];
  for (let i = 0; from + i * step <= to + step / 2; i += 1) ticks.push(Number((from + i * step).toFixed(6)));
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}

// The accent a step that takes away is drawn in (a theme token: it follows dark mode and brand packs).
export const DECREASE = "var(--chart-5)";

// A figure on a flow tile: whole currency units while they fit (AED 2,050 - not "2.1K", which is a guess at the cents), millions
// as 1.28M. The full amount is on the tile's title.
export const flowNumber = (value) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  return abs >= 1e6 ? `${sign}${formatNumber(abs / 1e6, 2)}M` : `${sign}${formatNumber(abs, 0)}`;
};
export const flowAmount = (value) => `${CURRENCY} ${flowNumber(value)}`;

// +1.2k / -600: an amount with its direction, for a bar that adds or takes away.
export const signedCompact = (value) => {
  const n = Number(value) || 0;
  return `${n < 0 ? "−" : n > 0 ? "+" : ""}${compactAmount(Math.abs(n))}`;
};

// ---------------------------------------------------------------- the cash cycle

export const CYCLE_PARTS = [
  { key: "dio", label: "Stock sits", help: "How long stock waits before it is sold", colour: "var(--chart-1)" },
  { key: "dso", label: "Customers pay", help: "How long customers take to pay an invoice", colour: "var(--chart-2)" },
  { key: "dpo", label: "Vendors wait", help: "How long you take to pay vendors", colour: "var(--chart-4)" },
];

const dayWord = (n) => `${formatNumber(n, n % 1 === 0 ? 0 : 1)} ${Math.abs(n) === 1 ? "day" : "days"}`;

// Why a figure is missing, in the business's own words
function missingReason(cycle, key) {
  if (key === "dso") return cycle.invoiced > 0 ? null : "no sales invoiced";
  if (key === "dpo") return cycle.purchased > 0 ? null : "no purchases";
  return cycle.cogs > 0 ? null : "no cost of goods sold";
}

// One sentence on what the cycle means, or why there is none yet. `tone` is for tests and styling hooks.
export function cycleStory(cycle) {
  if (!cycle.enough) return { tone: "wait", text: `The cycle needs at least ${cycle.minDays || 14} days of sales to measure. It has ${cycle.days}.` };
  if (cycle.cycleDays === null) {
    const gaps = CYCLE_PARTS.filter((r) => cycle[r.key] === null).map((r) => `${r.label.toLowerCase()}: ${missingReason(cycle, r.key) || "nothing to measure"}`);
    return { tone: "wait", text: `Not enough to work out the cycle yet (${gaps.join("; ")}).` };
  }
  if (cycle.cycleDays > 0) return { tone: "tied", text: `Your cash is tied up for ${dayWord(cycle.cycleDays)}: from paying vendors to collecting from customers.` };
  if (cycle.cycleDays < 0) return { tone: "free", text: `Vendors fund you: you collect ${dayWord(Math.abs(cycle.cycleDays))} before you have to pay them.` };
  return { tone: "even", text: "You collect from customers on the day you pay vendors." };
}

// ---------------------------------------------------------------- labels

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const MONTH_YEAR = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const SHORT_DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthDate = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));

export const weekdayLabel = (ymd) => WEEKDAY.format(new Date(`${ymd}T00:00:00Z`));
export const monthLabel = (month) => MONTH.format(monthDate(month));
export const monthYearLabel = (month) => MONTH_YEAR.format(monthDate(month));
export const dayLabel = (ymd) => SHORT_DAY.format(new Date(`${ymd}T00:00:00Z`));
export const hourLabel = (h) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

// An amount as an axis label: 400, 1.3k, 12k, 1.3M (never "0k" for 400, and ticks a step apart never
// collapse into the same label). Under 1,000 it is the number itself; from 1,000 one decimal up to
// 10k, then whole thousands, then millions and billions the same way. Negatives keep their sign.
export function compactAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const plain = Number(abs.toFixed(2));
  if (plain < 1000) return plain === 0 ? "0" : `${sign}${plain}`;
  const scaled = (x, unit) => `${sign}${x < 10 ? Number(x.toFixed(1)) : Math.round(x)}${unit}`;
  const k = abs / 1e3;
  if (Math.round(k) < 1000) return scaled(k, "k");
  const m = abs / 1e6;
  if (Math.round(m) < 1000) return scaled(m, "M");
  return scaled(abs / 1e9, "B");
}
export const signed = (pct) => `${pct > 0 ? "+" : pct < 0 ? "-" : ""}${formatNumber(Math.abs(pct), 1)}%`;

// "Today", "Yesterday", "3 days ago", "2 hours ago", "5 min ago". A moment at exactly midnight in
// the organisation's zone is a date typed without a time, so it is read by day rather than by hour.
const clocks = new Map();
const clockFor = (zone) => {
  if (!clocks.has(zone)) clocks.set(zone, new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }));
  return clocks.get(zone);
};
export function ago(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dayOnly = clockFor(orgTimezone()).format(d) === "00:00";
  const days = Math.round((new Date(`${toInputDate(now)}T00:00:00Z`) - new Date(`${toInputDate(d)}T00:00:00Z`)) / 86400000);
  if (days >= 30) return formatDate(d);
  if (dayOnly || days >= 2) return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
  const minutes = Math.floor((now - d) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

// ---------------------------------------------------------------- pages and rows

// Where a voucher is kept; anything else opens in the day book.
const RECENT_LINK = {
  sales_order: "/sales-order", sales_return: "/sales-return", purchase_order: "/purchase-order", purchase_return: "/purchase-return",
  receipt: "/receipt-voucher", payment: "/payment-voucher", journal: "/journal-voucher", contra: "/contra-voucher",
  expense: "/expense-voucher", debit_note: "/debit-credit-notes", credit_note: "/debit-credit-notes",
};
export const recentLink = (type) => RECENT_LINK[type] || "/ledger-reports?tab=daybook";

// The four status rows, from counts: the tone and the tag follow the count.
export function opsRows(ops) {
  const row = (key, label, to, { count, total }, rule) => ({ key, label, to, value: `${count}/${total}`, ...rule(count, total) });
  return [
    row("orders", "Active orders", "/sales-order", ops.activeOrders, (n, t) => (t === 0 ? { tag: "None", tone: "muted" } : { tag: "Active", tone: "ok" })),
    row("pos", "Pending POs", "/purchase-order", ops.pendingPurchaseOrders, (n) => (n > 0 ? { tag: "Pending", tone: "warn" } : { tag: "Clear", tone: "ok" })),
    row("stock", "Low stock SKUs", "/stock-reports?tab=reorder", ops.lowStock, (n, t) => (n > 0 ? { tag: "Alert", tone: "danger" } : t === 0 ? { tag: "None", tone: "muted" } : { tag: "OK", tone: "ok" })),
    row("customers", "New customers", "/customer-creation", ops.newCustomers, (n) => (n > 0 ? { tag: "New", tone: "muted" } : { tag: "None", tone: "muted" })),
  ];
}

