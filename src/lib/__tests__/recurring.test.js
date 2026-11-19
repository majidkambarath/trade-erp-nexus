import { describe, it, expect } from "vitest";
import { describe as say, previewDates, runDay, scheduleErrors, scheduleOf, upcoming } from "../recurring";
import { VARIANTS, buildPayload } from "../../components/OrderEntry/variants";

describe("recurring invoice schedule (twin of the server's utils/recurring.js)", () => {
  it("keeps the start's day of the month, clamped to a short month", () => {
    const s = { frequency: "monthly", interval: 1, startDay: "2026-01-31" };
    expect([0, 1, 2, 3].map((k) => runDay(s, k))).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(upcoming({ frequency: "quarterly", interval: 1, startDay: "2026-11-30" }, 0, 2)).toEqual(["2026-11-30", "2027-02-28"]);
    expect(say({ frequency: "weekly", interval: 2 })).toBe("Every 2 weeks");
  });

  it("reads a form: blank boxes are left out, errors are keyed by field, a bad schedule previews nothing", () => {
    expect(scheduleOf({ frequency: "monthly", interval: "2", startDay: "2026-03-01", endDay: "", maxCount: " " })).toEqual({ frequency: "monthly", interval: 2, startDay: "2026-03-01" });
    expect(scheduleErrors({ frequency: "monthly", startDay: "" })).toEqual({ startDay: expect.any(String) });
    expect(scheduleErrors({ frequency: "monthly", startDay: "2026-03-01", endDay: "2026-02-01" })).toEqual({ endDay: expect.any(String) });
    expect(previewDates({ frequency: "monthly", startDay: "2026-02-30" })).toEqual([]);
    expect(previewDates({ frequency: "monthly", interval: "1", startDay: "2026-03-15", maxCount: "2" }, 5)).toEqual(["2026-03-15", "2026-04-15"]);
  });

  it("the form sends a template: name, customer, the lines with their cost centres, and the schedule, never a number or a status", () => {
    const V = VARIANTS.recurringInvoice;
    const f = { name: " Rent ", partyId: "c1", frequency: "monthly", interval: "1", startDay: "2026-12-01", endDay: "", maxCount: "12", costCentreId: "cc1", discount: "0", notes: "", terms: "", charges: [] };
    const rows = [{ itemId: "s1", description: "Office rent", qty: "1", rate: "5000", vatPercent: "5", taxCodeId: "t5", costCentreId: "cc2" }, { itemId: "", qty: "" }];
    const p = buildPayload(V, f, rows, {}, { charges: [] });
    expect(p).toMatchObject({ name: "Rent", partyId: "c1", frequency: "monthly", interval: 1, startDay: "2026-12-01", endDay: null, maxCount: 12, costCentreId: "cc1" });
    expect(p.items).toEqual([expect.objectContaining({ itemId: "s1", qty: 1, price: 5000, taxCodeId: "t5", costCentreId: "cc2" })]);
    expect(p).not.toHaveProperty("status");
    expect(p).not.toHaveProperty("transactionNo");
    expect(V.validateExtra({ name: "", frequency: "monthly", startDay: "2026-12-01" })).toEqual({ name: "Give it a name" });
    expect(V.fromSaved({ name: "Rent", frequency: "quarterly", interval: 2, startDay: "2026-12-01", maxCount: 4 })).toEqual({ name: "Rent", frequency: "quarterly", interval: "2", startDay: "2026-12-01", endDay: "", maxCount: "4" });
  });
});
