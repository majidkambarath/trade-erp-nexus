import { describe, expect, it } from "vitest";
import {
  shown, money, seesMoney, headlineCards, costTrendRows, costDepartmentRows,
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
  it("leads with cost for a reader who may see it", () => {
    const keys = headlineCards(full()).map((c) => c.key);
    expect(keys[0]).toBe("cost");
    expect(keys).toContain("perEmployee");
    expect(keys).toEqual(["cost", "perEmployee", "headcount", "attendance", "documents"]);
  });

  it("drops the cards whose figures were withheld, rather than drawing them empty", () => {
    const keys = headlineCards(stripped()).map((c) => c.key);
    expect(keys).not.toContain("perEmployee");
    expect(keys).toContain("cost");       // the org-wide total survives the strip
    expect(keys).toContain("headcount");  // and a count was never money
  });

  it("says a month was not run instead of showing it as costing nothing", () => {
    const d = full();
    d.cost = { ran: false, thisMonth: 0, perEmployee: null, byMonth: [] };
    const card = headlineCards(d).find((c) => c.key === "cost");
    expect(card.value).toBeNull();
    expect(card.subText).toBe("Not run yet");
  });

  it("warns about documents only when there is something to warn about", () => {
    const danger = headlineCards(full()).find((c) => c.key === "documents");
    expect(danger.tone).toBe("danger");
    expect(danger.subText).toMatch(/already expired/);

    const d = full();
    d.documents = { expired: 0, expiringSoon: 2, total: 5 };
    expect(headlineCards(d).find((c) => c.key === "documents").tone).toBe("warning");

    d.documents = { expired: 0, expiringSoon: 0, total: 5 };
    // undefined, never a tone StatCard does not know - an unknown tone throws in that component.
    expect(headlineCards(d).find((c) => c.key === "documents").tone).toBeUndefined();
  });

  it("says nothing is marked rather than claiming nought per cent attendance", () => {
    const d = full();
    d.attendance = { counts: {}, worked: 0, expected: 0, rate: null };
    const cards = headlineCards(d);
    expect(cards.find((c) => c.key === "attendance")).toBeUndefined();
  });

  it("survives an older server that answers without a field", () => {
    expect(headlineCards({})).toHaveLength(1); // only the "not run yet" cost card
    expect(headlineCards(undefined)).toEqual([]);
  });
});

describe("costTrendRows", () => {
  it("skips a month nothing was run, which is not a month that cost nothing", () => {
    const d = full();
    d.cost.byMonth = [{ month: "2026-01", ran: false, gross: 0 }, { month: "2026-02", ran: true, gross: 110000 }];
    expect(costTrendRows(d).map((r) => r.key)).toEqual(["2026-02"]);
  });

  it("is empty when no month has a run, so the panel can say so", () => {
    const d = full();
    d.cost.byMonth = [{ month: "2026-01", ran: false, gross: 0 }];
    expect(costTrendRows(d)).toEqual([]);
    expect(costTrendRows({})).toEqual([]);
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
