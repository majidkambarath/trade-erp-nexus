import { describe, it, expect } from "vitest";
import { buildBody, emptyCost, emptyForm, errorText, formFromProduction, formTotals, validateForm, warningsOf } from "../production";

const stocks = [
  { _id: "raw", itemName: "Raw part", purchasePrice: 50, currentStock: 1 },
  { _id: "fin", itemName: "Coated part", purchasePrice: 0, currentStock: 0 },
];
const brivox = () => ({
  ...emptyForm("2026-10-17"),
  finishedId: "fin",
  qty: "1",
  materials: [{ stockId: "raw", qty: "1" }],
  costs: [
    { accountId: "trav", amount: "50", narration: "" },
    { accountId: "coat", amount: "50", narration: "powder" },
    { accountId: "pack", amount: "20", narration: "" },
  ],
});

describe("production form", () => {
  it("adds up the Brivox case: 50 of material and 120 of costs make one part at 170", () => {
    const t = formTotals(brivox(), stocks);
    expect([t.materials, t.costs, t.total, t.unitCost, t.hasCosts]).toEqual([50, 120, 170, 170, true]);
    expect(t.materialLines[0]).toMatchObject({ rate: 50, cost: 50, onHand: 1, short: 0 });
  });

  it("spreads the cost over the quantity made and says what is short", () => {
    const f = { ...brivox(), qty: "3", materials: [{ stockId: "raw", qty: "4" }] };
    const t = formTotals(f, stocks);
    expect(t.total).toBe(320);
    expect(t.unitCost).toBe(106.66667);
    expect(t.materialLines[0].short).toBe(3);
  });

  it("validates, and ignores lines that were never started", () => {
    expect(validateForm(brivox())).toEqual({});
    expect(validateForm({ ...brivox(), costs: [...brivox().costs, emptyCost()] })).toEqual({}, "a blank cost row is left out");
    expect(validateForm(emptyForm("2026-10-17"))).toMatchObject({ finishedId: expect.any(String), lines: expect.any(String) });
    expect(validateForm({ ...brivox(), qty: "0" }).qty).toBeTruthy();
    expect(validateForm({ ...brivox(), materials: [{ stockId: "fin", qty: "1" }] })["materials.0.stockId"]).toMatch(/itself/);
    expect(validateForm({ ...brivox(), costs: [{ accountId: "", amount: "5", narration: "" }] })["costs.0.accountId"]).toBeTruthy();
    expect(validateForm({ ...brivox(), costs: [{ accountId: "x", amount: "1.005", narration: "" }] })["costs.0.amount"]).toMatch(/two decimals/);
  });

  it("builds the request body from the started lines only", () => {
    const body = buildBody({ ...brivox(), materials: [...brivox().materials, { stockId: "", qty: "" }], batchNumber: " B1 ", notes: " " });
    expect(body).toEqual({
      date: "2026-10-17",
      finished: { stockId: "fin", qty: 1, batchNumber: "B1" },
      materials: [{ stockId: "raw", qty: 1 }],
      costs: [{ accountId: "trav", amount: 50 }, { accountId: "coat", amount: 50, narration: "powder" }, { accountId: "pack", amount: 20 }],
      notes: undefined,
    });
  });

  it("opens a saved draft in the form", () => {
    const f = formFromProduction({
      date: "2026-10-17T00:00:00.000Z", finished: { stockId: "fin", qty: 2, batchNumber: "B1" },
      materials: [{ stockId: "raw", qty: 2 }], costs: [{ accountId: "trav", amount: 50, narration: "trip" }], notes: "n",
    });
    expect(f).toEqual({ date: "2026-10-17", finishedId: "fin", qty: "2", batchNumber: "B1", materials: [{ stockId: "raw", qty: "2" }], costs: [{ accountId: "trav", amount: "50", narration: "trip" }], notes: "n" });
  });

  it("says each refusal in words and finds the warnings to tick", () => {
    expect(errorText({ code: "LEDGER_POSTING_OFF", message: "x" })).toMatch(/Ledger posting is off/);
    expect(errorText({ code: "SOMETHING_NEW", message: "As the server said" })).toBe("As the server said");
    expect(warningsOf({ code: "PRODUCTION_WARNINGS", details: { warnings: [{ code: "COST_EXCEEDS_SPEND" }] } })).toHaveLength(1);
    expect(warningsOf({ code: "INSUFFICIENT_STOCK" })).toEqual([]);
  });
});
