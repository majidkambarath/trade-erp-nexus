import { formatDate, formatNumber, toInputDate } from "@/utils/format";

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
// Dubai is a date typed without a time, so it is read by day rather than by hour.
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export function ago(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dayOnly = clock.format(d) === "00:00";
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

