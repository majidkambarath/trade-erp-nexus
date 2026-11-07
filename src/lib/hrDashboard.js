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
 * The headline cards, in cost-led order, already filtered to the ones this reader can actually see.
 * Each is `{ key, title, value, kind, subText, tone }`; `kind` tells the screen how to format it, so the
 * formatting stays in the component where the currency and locale live.
 */
export function headlineCards(data) {
  if (!data) return [];
  const cost = data.cost || {};
  const cards = [
    cost.ran
      ? { key: "cost", title: "Payroll this month", value: money(cost.thisMonth), kind: "money", subText: cost.employees ? `${cost.employees} paid` : null }
      // A month nobody has run is not a cost of nothing: say so instead of drawing a confident zero.
      : { key: "cost", title: "Payroll this month", value: null, kind: "money", subText: "Not run yet" },
    { key: "perEmployee", title: "Cost per employee", value: money(cost.perEmployee), kind: "money", subText: "Average of this month's run" },
    { key: "headcount", title: "Active employees", value: money(data.headcount?.active), kind: "count", subText: headcountSub(data) },
    { key: "attendance", title: "Attendance", value: money(data.attendance?.rate), kind: "percent", subText: attendanceSub(data) },
    { key: "documents", title: "Documents expiring", value: money(data.documents?.expiringSoon), kind: "count", subText: documentsSub(data), tone: toneFor(data.documents) },
  ];
  // A card whose figure the server withheld is dropped, not drawn empty - an empty card standing in for
  // something is exactly what this screen's own history refuses.
  return cards.filter((c) => c.key === "cost" || shown(c.value));
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function headcountSub(data) {
  const missing = data?.headcount?.missingCostRate;
  if (!shown(missing)) return null;
  return missing > 0 ? `${plural(missing, "person", "people")} with no cost rate` : "All have a cost rate";
}

function attendanceSub(data) {
  const a = data?.attendance;
  if (!shown(a?.rate)) return "Nothing marked this month";
  return `${a.worked} of ${a.expected} days worked`;
}

function documentsSub(data) {
  const d = data?.documents;
  if (!d) return null;
  return d.expired > 0 ? `${plural(d.expired, "is", "are")} already expired` : "Within the next 30 days";
}

/** Warning only when there is something to warn about, and never a tone StatCard does not know. */
function toneFor(documents) {
  if (documents?.expired > 0) return "danger";
  if (documents?.expiringSoon > 0) return "warning";
  return undefined;
}

/** Payroll cost per month as RankedBars rows - skipping months nothing was run, which would otherwise
 * read as a month that cost nothing. Returns [] when no month has a run, so the panel shows its empty
 * state rather than a flat line along the floor. */
export function costTrendRows(data, { label = (m) => m } = {}) {
  const months = data?.cost?.byMonth;
  if (!Array.isArray(months)) return [];
  return months
    .filter((m) => m?.ran && Number.isFinite(Number(m.gross)))
    .map((m) => ({ key: m.month, name: label(m.month), value: Number(m.gross), employees: m.employees }));
}

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
