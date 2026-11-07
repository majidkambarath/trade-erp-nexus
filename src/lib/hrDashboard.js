// What the HR dashboard draws, decided without React. No JSX, no charts, no axios - so every decision
// below is tested by calling a function, not by rendering a screen.
//
// The rule that shapes most of this file: a figure the server WITHHELD arrives `undefined`, and that is
// not the same as `0`. A reader without hr.confidential must see "hidden from you", never a confident
// zero - the distinction src/lib/hr.js contractSummary already insists on for a contract's own pay.

/** Is this a figure the server actually sent? `0` is a real answer; undefined and null are not. */
export const shown = (v) => v !== undefined && v !== null;

/** A money figure to draw, or null when it was withheld or never computed. */
export const money = (v) => (shown(v) && Number.isFinite(Number(v)) ? Number(v) : null);

/** Whether this reader is being shown money at all - one place, so panels do not each guess. */
export const seesMoney = (data) => shown(data?.cost?.perEmployee) || shown(data?.cost?.byDepartment);

/**
 * The headline cards, in cost-led order. ALWAYS the same four, in the same places.
 *
 * They are never filtered. A figure the server withheld, or has not computed yet, keeps its card and
 * carries a null for the screen to draw as a dash - which is what the rest of the product does and what
 * the cost card here always did. Filtering was worse than useless: it left a reader without
 * hr.confidential with three cards in a four-column grid, and a row with holes in it is what made this
 * screen look unfinished. A card that says "—" says "not for you" or "not yet"; a missing card says
 * nothing at all.
 *
 * `kind` tells the screen how to format the figure, so currency and locale stay in the component.
 * `to` is where the figure lives in full - a tile is a way in, not only a number.
 */
export function headlineCards(data) {
  const cost = data?.cost || {};
  return [
    {
      key: "cost", title: "Payroll this month", kind: "money", to: "/hr/payroll",
      value: cost.ran ? money(cost.thisMonth) : null,
      // A month nobody has run is not a cost of nothing.
      subText: cost.ran ? (cost.employees ? `${plural(cost.employees, "person", "people")} paid` : null) : "Not run yet",
      // A NUMBER, not the sentence: a tile footer is a few characters wide, and
      // "4.2% more than last month" wrapped to three lines and made this card taller than the one
      // beside it. The screen formats it compactly; changeNote stays for where there is room.
      trendPct: cost.ran && shown(cost.changePct) ? cost.changePct : null,
    },
    { key: "perEmployee", title: "Cost per employee", kind: "money", to: "/hr/payroll", value: money(cost.perEmployee), subText: cost.ran ? "Average of this month's run" : "Waiting on a run" },
    { key: "headcount", title: "Active employees", kind: "count", to: "/hr/people", value: money(data?.headcount?.active), subText: headcountSub(data) },
    { key: "attendance", title: "Attendance", kind: "percent", to: "/hr/attendance", value: money(data?.attendance?.rate), subText: attendanceSub(data) },
  ];
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function headcountSub(data) {
  const missing = data?.headcount?.missingCostRate;
  if (!shown(missing)) return null;
  return missing > 0 ? `${plural(missing, "person", "people")} with no cost rate` : "All have a cost rate";
}

function attendanceSub(data) {
  const a = data?.attendance;
  // Terse, and deliberately NOT the panel's own "Nothing marked this month": the same sentence twice on
  // one screen reads as a mistake. A tile is short; the panel below it is where the explaining happens.
  if (!shown(a?.rate)) return "No days marked yet";
  return `${a.worked} of ${a.expected} days worked`;
}

/**
 * Payroll cost per month, for a chart with months along the X axis - EVERY month in the period, in
 * order, including the ones nothing was run in.
 *
 * It used to drop the unrun months. That was wrong twice over: it made the spacing lie (March next to
 * June, looking like consecutive months), and it is the opposite of the rule the rest of the product
 * states - "a month with nothing is a point on the line, not a gap in it". An unrun month carries
 * `gross: null` and `ran: false`, so the chart can leave a gap in the BAR while keeping the month on
 * the axis, and nobody reads it as a month that cost nothing.
 *
 * `hasAny` is for the panel: no month with a run at all means draw the empty state, not a flat floor.
 */
export function costTrendRows(data, { label = (m) => m } = {}) {
  const months = data?.cost?.byMonth;
  if (!Array.isArray(months)) return [];
  return months.map((m) => ({
    key: m?.month,
    month: m?.month,
    name: label(m?.month),
    ran: Boolean(m?.ran),
    gross: m?.ran && Number.isFinite(Number(m.gross)) ? Number(m.gross) : null,
    employees: m?.ran ? m.employees : null,
  }));
}

/** Was any month in the trend actually run? */
export const costTrendHasAny = (rows) => rows.some((r) => r.gross !== null);

/** Cost by department, largest first, as RankedBars rows. Empty for a reader without hr.confidential,
 * which is why the panel asks `seesMoney` before deciding what to say about an empty list. */
export function costDepartmentRows(data) {
  const rows = data?.cost?.byDepartment;
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => Number.isFinite(Number(r?.value))).map((r) => ({ key: r.key || r.name, name: r.name, value: Number(r.value), people: r.people }));
}

/** Headcount by department - a count, so every reader gets it. */
export function headcountDepartmentRows(data) {
  const rows = data?.headcount?.byDepartment;
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => Number.isFinite(Number(r?.people))).map((r) => ({ key: r.key || r.name, name: r.name, value: Number(r.people) }));
}

/** Joiners against leavers per month, for the operations band. `net` carries the sign. */
export function headcountFlowRows(data) {
  const flow = data?.headcount?.flow;
  if (!Array.isArray(flow)) return [];
  return flow.map((m) => ({ key: m.month, month: m.month, joiners: m.joiners || 0, leavers: m.leavers || 0, net: m.net || 0, headcount: m.headcount || 0 }));
}

const ATTENDANCE_PARTS = [
  { key: "present", name: "Present", token: "--chart-1" },
  { key: "half_day", name: "Half day", token: "--chart-2" },
  { key: "on_leave", name: "On leave", token: "--chart-3" },
  { key: "absent", name: "Absent", token: "--chart-5" },
  { key: "holiday", name: "Holiday", token: "--chart-4" },
  { key: "weekly_off", name: "Weekly off", token: "--muted-foreground" },
];

/**
 * The attendance ring's slices, in a FIXED order with fixed colours - never cycled, so "absent" is the
 * same colour on every organisation's screen and between one month and the next.
 */
export function attendanceRows(data) {
  const counts = data?.attendance?.counts;
  if (!counts) return [];
  return ATTENDANCE_PARTS
    .map((p) => ({ key: p.key, name: p.name, value: Number(counts[p.key]) || 0, color: `var(${p.token})` }))
    .filter((r) => r.value > 0);
}

/** The total the ring sits around: every marked day of the month. */
export const attendanceTotal = (data) => attendanceRows(data).reduce((t, r) => t + r.value, 0);

/**
 * What the screen says about a period-on-period change. Null in, nothing out - a first month has nothing
 * to be compared with, and "+0%" would be a claim rather than an absence.
 */
export function changeNote(pct, { up = "more than last month", down = "less than last month" } = {}) {
  if (!shown(pct) || !Number.isFinite(Number(pct))) return null;
  const n = Number(pct);
  if (Math.abs(n) < 0.05) return "Level with last month";
  return `${Math.abs(n).toFixed(1)}% ${n > 0 ? up : down}`;
}

/** Is there anything at all to draw? An organisation with no employees gets one honest empty state
 * instead of nine panels each saying "no data" in its own words. */
export const isEmpty = (data) => !data || !(Number(data.headcount?.total) > 0);

/** The CSV of what is on screen, so the figures can leave the page. Money columns appear only when this
 * reader was given money at all. */
export function dashboardCsv(data, { label = (m) => m } = {}) {
  const withMoney = seesMoney(data);
  const headers = ["Month", "Joiners", "Leavers", "Net", "Headcount at month end", ...(withMoney ? ["Payroll gross", "Employees paid"] : [])];
  const cost = new Map((data?.cost?.byMonth || []).map((m) => [m.month, m]));
  const rows = headcountFlowRows(data).map((m) => {
    const c = cost.get(m.month);
    return [
      label(m.month), m.joiners, m.leavers, m.net, m.headcount,
      ...(withMoney ? [c?.ran ? c.gross : "", c?.ran ? c.employees : ""] : []),
    ];
  });
  return { headers, rows };
}
