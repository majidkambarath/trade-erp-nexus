import { describe, expect, it } from "vitest";
import {
  validateEmployeeForm, employeeFormData, validateContractForm, contractSummary,
  shiftDay, monthKeyOf, shiftMonth, daysOfMonth, monthWeeks, monthLabel, coversDay,
} from "../hr";

describe("validateEmployeeForm", () => {
  it("needs a name, designation, contact, ID and joining date", () => {
    expect(Object.keys(validateEmployeeForm({}))).toEqual(
      expect.arrayContaining(["name", "designation", "contactNo", "idNo", "joiningDate"])
    );
  });

  it("passes a complete form", () => {
    expect(validateEmployeeForm({ name: "Ravi", designation: "Fabricator", contactNo: "0501234567", idNo: "784X", joiningDate: "2026-01-01" })).toEqual({});
  });
});

describe("employeeFormData", () => {
  it("builds a FormData with only the fields given", () => {
    const fd = employeeFormData({ name: "Ravi", designation: "Fabricator", contactNo: "0501234567", idNo: "784X", joiningDate: "2026-01-01", nationality: "in" });
    expect(fd.get("name")).toBe("Ravi");
    expect(fd.get("nationality")).toBe("IN");
    expect(fd.get("department")).toBeNull();
  });

  it("sends an explicit empty exitDate when the field is present but cleared", () => {
    const fd = employeeFormData({ exitDate: "" });
    expect(fd.get("exitDate")).toBe("");
  });

  it("leaves exitDate out entirely when the caller never mentioned it", () => {
    const fd = employeeFormData({ name: "Ravi" });
    expect(fd.get("exitDate")).toBeNull();
  });
});

describe("validateContractForm", () => {
  it("needs a start day", () => {
    expect(validateContractForm({}).effectiveFrom).toBeTruthy();
  });

  it("refuses a last day before the first day", () => {
    expect(validateContractForm({ effectiveFrom: "2026-06-01", effectiveTo: "2026-01-01" }).effectiveTo).toBeTruthy();
  });

  it("refuses negative money", () => {
    expect(validateContractForm({ effectiveFrom: "2026-01-01", basicPay: -1 }).basicPay).toBeTruthy();
  });

  it("passes a plain cost-per-hour contract", () => {
    expect(validateContractForm({ effectiveFrom: "2026-01-01", costPerHour: 25 })).toEqual({});
  });
});

describe("contractSummary", () => {
  it("reads a row with pay as current with its figures", () => {
    const s = contractSummary({ effectiveFrom: "2026-01-01", effectiveTo: null, hourlyCost: 25, monthlyCost: 5200 });
    expect(s).toEqual({ current: true, from: "2026-01-01", to: null, hasPay: true, hourlyCost: 25, monthlyCost: 5200 });
  });

  it("reads a row with pay stripped as hidden, never as zero", () => {
    const s = contractSummary({ effectiveFrom: "2026-01-01", effectiveTo: null });
    expect(s.hasPay).toBe(false);
    expect(s.hourlyCost).toBeNull();
  });

  it("returns null for nothing", () => {
    expect(contractSummary(null)).toBeNull();
  });
});

describe("shiftDay", () => {
  it("steps forward and back across a month end", () => {
    expect(shiftDay("2026-02-28", 1)).toBe("2026-03-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("gives back whatever it was handed when it is not a real day", () => {
    expect(shiftDay("not-a-day", 5)).toBe("not-a-day");
  });
});

describe("monthKeyOf", () => {
  it("takes the year and month off a day", () => {
    expect(monthKeyOf("2026-11-07")).toBe("2026-11");
  });
});

describe("shiftMonth", () => {
  it("steps across a year end both ways", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
  });

  it("gives back whatever it was handed when it is not a real month", () => {
    expect(shiftMonth("nonsense", 1)).toBe("nonsense");
  });
});

describe("daysOfMonth", () => {
  it("lists every day of a 28-day February and a 31-day month, in order", () => {
    expect(daysOfMonth("2026-02")).toEqual(Array.from({ length: 28 }, (_, i) => `2026-02-${String(i + 1).padStart(2, "0")}`));
    expect(daysOfMonth("2026-01")).toHaveLength(31);
  });

  it("knows a leap February", () => {
    expect(daysOfMonth("2024-02")).toHaveLength(29);
  });
});

describe("monthWeeks", () => {
  it("covers every day of the month inside whole weeks of 7, Monday first", () => {
    const weeks = monthWeeks("2026-11");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    const inMonthDays = weeks.flat().filter((c) => c.inMonth).map((c) => c.day);
    expect(inMonthDays).toEqual(daysOfMonth("2026-11"));
    // 1 Nov 2026 is a Sunday, so the week it falls in leads with six days from October.
    expect(weeks[0][6].day).toBe("2026-11-01");
    expect(weeks[0][6].inMonth).toBe(true);
    expect(weeks[0][0].inMonth).toBe(false);
  });
});

describe("monthLabel", () => {
  it("reads as a month and a year", () => {
    expect(monthLabel("2026-11")).toBe("November 2026");
  });
});

describe("coversDay", () => {
  it("includes both ends of the range", () => {
    const r = { fromDay: "2026-11-10", toDay: "2026-11-12" };
    expect(coversDay(r, "2026-11-09")).toBe(false);
    expect(coversDay(r, "2026-11-10")).toBe(true);
    expect(coversDay(r, "2026-11-11")).toBe(true);
    expect(coversDay(r, "2026-11-12")).toBe(true);
    expect(coversDay(r, "2026-11-13")).toBe(false);
  });

  it("treats a single-day request (no toDay) as covering only fromDay", () => {
    expect(coversDay({ fromDay: "2026-11-10" }, "2026-11-10")).toBe(true);
    expect(coversDay({ fromDay: "2026-11-10" }, "2026-11-11")).toBe(false);
  });
});
