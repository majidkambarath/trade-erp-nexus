import { describe, expect, it } from "vitest";
import {
  wipCsv, onHoldCsv, profitStreamsCsv, peopleCsv, baysCsv, customersCsv, topVisitedCsv,
  registrationExpiringCsv, policyExpiringCsv, serviceDueCsv, insurersCsv, jobRowsCsv,
} from "../garageReports";

describe("garage report CSV shapers", () => {
  it("wipCsv carries the floor's own figures, one row per job", () => {
    const csv = wipCsv([{ jobNo: "JC-1", status: "IN_PROGRESS", jobType: "retail", plate: "A 1", vehicle: "Toyota Hilux", customer: "Ali", daysIn: 3, value: 400, owed: 0, invoiceStatus: "NONE" }]);
    expect(csv.headers).toContain("Owed");
    expect(csv.rows[0]).toEqual(["JC-1", "IN_PROGRESS", "retail", "A 1", "Toyota Hilux", "Ali", 3, 400, 0, "NONE"]);
  });

  it("onHoldCsv names the job, the task and why it is stuck", () => {
    const csv = onHoldCsv([{ jobNo: "JC-2", taskName: "Brakes", holdReason: "Waiting for a part", daysIn: 7 }]);
    expect(csv.rows[0]).toEqual(["JC-2", "Brakes", "Waiting for a part", 7]);
  });

  it("profitStreamsCsv keeps cost and margin blank, never zero, when the basis says they are not known", () => {
    const csv = profitStreamsCsv([{ label: "Sublet", revenue: 150, cost: null, margin: null, basis: "not costed" }]);
    expect(csv.rows[0]).toEqual(["Sublet", 150, "", "", "not costed"]);
  });

  it("peopleCsv and baysCsv read the same per-technician/per-bay shape the pure rules return", () => {
    expect(peopleCsv([{ label: "Raj", done: 2, hoursSold: 4, hoursTaken: 4, efficiencyPct: 100, waitHours: 1 }]).rows[0]).toEqual(["Raj", 2, 4, 4, 100, 1]);
    expect(baysCsv([{ name: "Ramp 1", kind: "mechanical", jobsDone: 3, hoursSold: 6, hoursTaken: 5, efficiencyPct: 120 }]).rows[0]).toEqual(["Ramp 1", "mechanical", 3, 6, 5, 120]);
  });

  it("customersCsv marks a repeat customer plainly, as text, not a 1/0", () => {
    const csv = customersCsv([{ name: "Ali", jobs: 2, estimated: 500, invoiced: 450, avgInvoice: 225, repeat: true, first: "2026-10-01", last: "2026-10-20" }]);
    expect(csv.rows[0]).toEqual(["Ali", 2, 500, 450, 225, "Yes", "2026-10-01", "2026-10-20"]);
  });

  it("vehicle exports: top visited, registration and policy expiring, service due", () => {
    expect(topVisitedCsv([{ plate: "A 1", make: "Toyota", model: "Hilux", customer: "Ali", jobs: 3, value: 900, lastVisit: "2026-10-20" }]).rows[0]).toEqual(["A 1", "Toyota", "Hilux", "Ali", 3, 900, "2026-10-20"]);
    expect(registrationExpiringCsv([{ plate: "A 1", customer: "Ali", day: "2026-11-15", daysLeft: 5, state: "soon" }]).rows[0]).toEqual(["A 1", "Ali", "2026-11-15", 5, "soon"]);
    expect(policyExpiringCsv([{ plate: "A 1", customer: "Ali", insurer: "Orient", day: "2026-11-05", daysLeft: -2, state: "overdue" }]).rows[0]).toEqual(["A 1", "Ali", "Orient", "2026-11-05", -2, "overdue"]);
    expect(serviceDueCsv([{ plate: "A 1", customer: "Ali", dueDay: null, dueOdometer: 15000, odometer: 15500, overdue: true }]).rows[0]).toEqual(["A 1", "Ali", "", 15000, 15500, "Yes"]);
  });

  it("insurersCsv shows the rejected count AND value - the gap claimAgeing's own filter used to hide", () => {
    const csv = insurersCsv([{ insurer: "Orient", claims: 2, claimed: 3000, approved: 2000, shortfall: 1000, rejected: 1, rejectedPct: 50, rejectedValue: 800, excess: 500, depreciation: 100, outstanding: 0, avgDaysToDecide: 3 }]);
    expect(csv.rows[0]).toEqual(["Orient", 2, 3000, 2000, 1000, 1, 50, 800, 500, 100, 0, 3]);
  });

  it("jobRowsCsv reads onTime as blank for a job never promised a date, never a false 'No'", () => {
    const csv = jobRowsCsv([{ jobNo: "JC-9", plate: "A 1", vehicle: "Toyota", customer: "Ali", deliveredAt: "2026-10-21", hoursSold: 2, hoursTaken: 2, onTime: null, comeback: false, total: 400 }]);
    expect(csv.rows[0]).toEqual(["JC-9", "A 1", "Toyota", "Ali", "2026-10-21", 2, 2, "", "", 400]);
  });

  it("every shaper defaults to an empty row set with no rows given", () => {
    for (const fn of [wipCsv, onHoldCsv, profitStreamsCsv, peopleCsv, baysCsv, customersCsv, topVisitedCsv, registrationExpiringCsv, policyExpiringCsv, serviceDueCsv, insurersCsv, jobRowsCsv]) {
      expect(fn().rows).toEqual([]);
      expect(fn().headers.length).toBeGreaterThan(0);
    }
  });
});
