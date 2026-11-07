import { describe, expect, it } from "vitest";
import {
  shown, money, seesMoney, headlineCards, costTrendRows, costTrendHasAny, costDepartmentRows,
  headcountDepartmentRows, headcountFlowRows, attendanceRows, attendanceTotal,
  changeNote, isEmpty, dashboardCsv,
} from "../hrDashboard";

// What a confidential reader gets.
const full = () => ({
  headcount: { active: 12, total: 14, missingCostRate: 2, byDepartment: [{ key: "d1", name: "Fabrication", people: 8 }, { key: "u", name: "Unassigned", people: 4 }], flow: [{ month: "2026-02", joiners: 2, leavers: 0, net: 2, headcount: 11 }, { month: "2026-03", joiners: 1, leavers: 1, net: 0, headcount: 12 }] },
  attendance: { counts: { present: 180, half_day: 4, absent: 12, on_leave: 6, holiday: 9, weekly_off: 30 }, worked: 184, expected: 202, rate: 91.09 },
  cost: { ran: true, thisMonth: 120000, previousMonth: 110000, changePct: 9.09, employees: 12, perEmployee: 10000, byMonth: [{ month: "2026-02", ran: true, gross: 110000, employees: 11 }, { month: "2026-03", ran: true, gross: 120000, employees: 12 }], byDepartment: [{ key: "d1", name: "Fabrication", value: 80000, people: 8 }, { key: "u", name: "Unassigned", value: 40000, people: 4 }] },
  documents: { expired: 1, expiringSoon: 3, total: 9 },
});

// The same answer for a reader without hr.confidential: the money fields simply are not there.
const stripped = () => {
  const d = full();
  d.cost = { ran: true, thisMonth: 120000, previousMonth: 110000, changePct: 9.09, byMonth: d.cost.byMonth };
  return d;
};

describe("shown / money", () => {
  it("treats zero as a real answer and undefined as hidden", () => {
    expect(shown(0)).toBe(true);
    expect(shown(undefined)).toBe(false);
    expect(shown(null)).toBe(false);
    expect(money(0)).toBe(0);
    expect(money(undefined)).toBeNull();
    expect(money("not a number")).toBeNull();
  });
});

describe("seesMoney", () => {
  it("is true only when the server actually sent a divisible figure", () => {
    expect(seesMoney(full())).toBe(true);
    expect(seesMoney(stripped())).toBe(false);
    expect(seesMoney(undefined)).toBe(false);
  });
});

describe("headlineCards", () => {
  // These four ARE the tile row, and its shape is why the screen was rebuilt: it used to be five cards
  // that got FILTERED, so a reader without hr.confidential saw three of them in a five-column grid with
  // two dead tracks. A row with holes in it is what made the page look unfinished.
  it("is always the same four, in the same order, led by cost", () => {
    expect(headlineCards(full()).map((c) => c.key)).toEqual(["cost", "perEmployee", "headcount", "attendance"]);
  });

  it("KEEPS every card for a reader who may not see money, carrying null rather than vanishing", () => {
    const cards = headlineCards(stripped());
    expect(cards.map((c) => c.key)).toEqual(["cost", "perEmployee", "headcount", "attendance"]);
    const perHead = cards.find((c) => c.key === "perEmployee");
    expect(perHead.value).toBeNull(); // the screen draws a dash: "not for you", not "none"
    expect(perHead.value).not.toBe(0);
    // An organisation-wide total is an aggregate, so it survives the strip and still carries a figure.
    expect(cards.find((c) => c.key === "cost").value).toBe(120000);
    expect(cards.find((c) => c.key === "headcount").value).toBe(12);
  });

  it("every tile leads somewhere - a figure and the screen behind it are the same thing", () => {
    for (const card of headlineCards(full())) expect(card.to).toMatch(/^.hr./);
  });

  it("carries the change against last month on the cost tile, and only when there is a run to compare", () => {
    // A number, so the tile can print it in a few characters; the sentence form wrapped to three lines.
    expect(headlineCards(full()).find((c) => c.key === "cost").trendPct).toBeCloseTo(9.09, 2);
    const d = full();
    d.cost = { ran: false, thisMonth: 0, changePct: null, perEmployee: null, byMonth: [] };
    expect(headlineCards(d).find((c) => c.key === "cost").trendPct).toBeNull();
  });

  it("no card carries a tone, because an unknown tone throws inside StatCard", () => {
    for (const card of headlineCards(full())) expect(card.tone).toBeUndefined();
  });

  it("says a month was not run instead of showing it as costing nothing", () => {
    const d = full();
    d.cost = { ran: false, thisMonth: 0, perEmployee: null, byMonth: [] };
    const card = headlineCards(d).find((c) => c.key === "cost");
    expect(card.value).toBeNull();
    expect(card.subText).toBe("Not run yet");
  });

  // There is deliberately no "documents expiring" tile any more: the Needs attention panel already
  // carried that exact figure as its "Renew documents" row, so the fifth tile was duplication - and it
  // was the one that made the row ragged.
  it("has no documents tile, because the Needs attention panel already owns that figure", () => {
    expect(headlineCards(full()).map((c) => c.key)).not.toContain("documents");
  });

  it("keeps the attendance tile when nothing is marked - an unknown rate is a dash, not nought per cent", () => {
    const d = full();
    d.attendance = { counts: {}, worked: 0, expected: 0, rate: null };
    const card = headlineCards(d).find((c) => c.key === "attendance");
    expect(card).toBeDefined();
    expect(card.value).toBeNull();
    // Terse on the tile, and distinct from the panel's own empty state - the same words twice reads as a bug.
    expect(card.subText).toBe("No days marked yet");
  });

  it("survives an older server, and an answer of nothing at all, with the row still intact", () => {
    expect(headlineCards({}).map((c) => c.key)).toEqual(["cost", "perEmployee", "headcount", "attendance"]);
    expect(headlineCards(undefined)).toHaveLength(4);
    expect(headlineCards(undefined).every((c) => c.value === null)).toBe(true);
  });
});

describe("costTrendRows", () => {
  // It used to DROP the months nothing was run in, which made the spacing lie - March beside June
  // reading as consecutive months. A month with nothing is a point on the line, not a gap in it.
  it("keeps every month of the period, in order, with null for the ones nothing was run in", () => {
    const d = full();
    d.cost.byMonth = [{ month: "2026-01", ran: false, gross: 0 }, { month: "2026-02", ran: true, gross: 110000, employees: 11 }];
    const rows = costTrendRows(d);
    expect(rows.map((r) => r.month)).toEqual(["2026-01", "2026-02"]);
    expect(rows[0].gross).toBeNull(); // no bar, but it keeps its place on the axis
    expect(rows[0].gross).not.toBe(0); // and it is NOT a month that cost nothing
    expect(rows[0].ran).toBe(false);
    expect(rows[1].gross).toBe(110000);
    expect(rows[1].employees).toBe(11);
  });

  it("tells the panel whether anything ran at all, so an all-null trend says so instead of drawing a floor", () => {
    const d = full();
    d.cost.byMonth = [{ month: "2026-01", ran: false, gross: 0 }, { month: "2026-02", ran: false, gross: 0 }];
    const rows = costTrendRows(d);
    expect(rows).toHaveLength(2);
    expect(costTrendHasAny(rows)).toBe(false);
    expect(costTrendHasAny(costTrendRows(full()))).toBe(true);
  });

  it("is empty only when the server sent no months at all", () => {
    expect(costTrendRows({})).toEqual([]);
    expect(costTrendHasAny(costTrendRows({}))).toBe(false);
  });

  it("labels through the formatter it is given", () => {
    expect(costTrendRows(full(), { label: (m) => `M:${m}` })[0].name).toBe("M:2026-02");
  });
});

describe("the department rows", () => {
  it("gives cost rows to a confidential reader and none to anyone else", () => {
    expect(costDepartmentRows(full()).map((r) => [r.name, r.value])).toEqual([["Fabrication", 80000], ["Unassigned", 40000]]);
    expect(costDepartmentRows(stripped())).toEqual([]);
  });

  it("gives headcount rows to everyone, because a count is nobody's pay", () => {
    expect(headcountDepartmentRows(stripped()).map((r) => [r.name, r.value])).toEqual([["Fabrication", 8], ["Unassigned", 4]]);
  });
});

describe("headcountFlowRows", () => {
  it("carries joiners, leavers and the signed net", () => {
    const rows = headcountFlowRows(full());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ month: "2026-02", joiners: 2, leavers: 0, net: 2, headcount: 11 });
  });

  it("is empty rather than broken when the field is missing", () => {
    expect(headcountFlowRows({})).toEqual([]);
  });
});

describe("attendanceRows", () => {
  it("keeps a fixed order and fixed colours, and leaves out what did not happen", () => {
    const rows = attendanceRows(full());
    expect(rows.map((r) => r.key)).toEqual(["present", "half_day", "on_leave", "absent", "holiday", "weekly_off"]);
    expect(rows.every((r) => r.color.startsWith("var(--"))).toBe(true);
    expect(attendanceTotal(full())).toBe(241);

    const d = full();
    d.attendance.counts = { present: 10, absent: 0 };
    expect(attendanceRows(d).map((r) => r.key)).toEqual(["present"]);
  });

  it("the same status is always the same colour between two months", () => {
    const a = full();
    const b = full();
    b.attendance.counts = { present: 1, absent: 99 };
    const colourOf = (rows, key) => rows.find((r) => r.key === key)?.color;
    expect(colourOf(attendanceRows(a), "absent")).toBe(colourOf(attendanceRows(b), "absent"));
  });
});

describe("changeNote", () => {
  it("says nothing when there is nothing to compare against", () => {
    expect(changeNote(null)).toBeNull();
    expect(changeNote(undefined)).toBeNull();
  });

  it("reads up, down and level", () => {
    expect(changeNote(9.09)).toBe("9.1% more than last month");
    expect(changeNote(-4.2)).toBe("4.2% less than last month");
    expect(changeNote(0)).toBe("Level with last month");
  });
});

describe("isEmpty", () => {
  it("is true only for an organisation with nobody on the books", () => {
    expect(isEmpty(full())).toBe(false);
    expect(isEmpty({ headcount: { total: 0 } })).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
  });
});

describe("dashboardCsv", () => {
  it("carries the money columns only for a reader who was given money", () => {
    const open = dashboardCsv(full());
    expect(open.headers).toContain("Payroll gross");
    expect(open.rows[1]).toEqual(["2026-03", 1, 1, 0, 12, 120000, 12]);

    const shut = dashboardCsv(stripped());
    expect(shut.headers).not.toContain("Payroll gross");
    expect(shut.rows[1]).toEqual(["2026-03", 1, 1, 0, 12]);
  });

  it("leaves a month with no run blank rather than writing a zero cost", () => {
    const d = full();
    d.cost.byMonth = [{ month: "2026-02", ran: false, gross: 0 }, { month: "2026-03", ran: true, gross: 120000, employees: 12 }];
    expect(dashboardCsv(d).rows[0].slice(-2)).toEqual(["", ""]);
  });
});
