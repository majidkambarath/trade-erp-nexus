import { describe, it, expect } from "vitest";
import { apply, combine } from "../promotions";
import { offerPreview, promotionBody, promotionText, suggestedRows, suggestionWhy } from "../vanSales";
import { offlineView } from "../vanOffline";

// The phone's copy of the server rule: the same answers as trade ERP node/utils/__tests__/promotions.test.js.
const promo = (over) => ({ _id: over.id || "p1", name: "Offer", active: true, priority: 0, stackable: false, stockIds: [], categoryIds: [], customerIds: [], routeIds: [], ...over });

describe("promotions on the phone", () => {
  it("gives the server's answers: a slab, buy-X-get-Y, a basket, and combining", () => {
    const r = apply([{ itemId: "rice", qty: 25, price: 20 }], [
      promo({ id: "s", kind: "slab", stockIds: ["rice"], minQty: 10, percent: 5 }),
      promo({ id: "g", kind: "bxgy", stockIds: ["rice"], buyQty: 10, freeQty: 1, freeStockId: "bag" }),
    ]);
    expect(r.lines[0].discountPercent).toBe(5);
    expect(r.free).toEqual([{ stockId: "bag", qty: 2, promoId: "g" }]);
    expect(combine(10, 5)).toBe(14.5);
    expect(apply([{ itemId: "rice", qty: 10, price: 50 }], [promo({ kind: "basket", minValue: 500, percent: 2 })]).lines[0].discountPercent).toBe(2);
    expect(r.lines[0]).not.toHaveProperty("locked");
  });

  it("the preview says the offers in words, names the free goods and the value after the discount", () => {
    const r = apply([{ itemId: "rice", qty: 10, price: 20 }], [promo({ kind: "slab", minQty: 10, percent: 5 }), promo({ id: "g", kind: "bxgy", buyQty: 10, freeQty: 1, stockIds: ["rice"] })]);
    const p = offerPreview(r, new Map([["rice", "Rice"]]));
    expect(p.subtotal).toBe(190);
    expect(p.free).toEqual([{ stockId: "rice", qty: 1, promoId: "g", name: "Rice" }]);
    expect(p.discounted).toBe(true);
    expect(promotionText({ kind: "bxgy", buyQty: 10, freeQty: 1, freeStockId: "bag" }, new Map([["bag", "Bag"]]))).toBe("1 Bag for every 10 bought");
  });

  it("a form becomes the body the server takes, with only its kind's figures", () => {
    expect(promotionBody({ name: " A ", kind: "slab", minQty: "", percent: "5", stockIds: ["rice", ""], priority: "" })).toEqual({ name: "A", kind: "slab", validFrom: "", validTo: "", priority: 0, stackable: false, stockIds: ["rice"], customerIds: [], routeIds: [], minQty: 1, percent: 5 });
    expect(promotionBody({ name: "B", kind: "basket", minValue: "1000", percent: "2", active: false })).toMatchObject({ minValue: 1000, percent: 2, active: false });
  });

  it("the suggested load explains itself, and its rows replace the form's", () => {
    expect(suggestionWhy({ preorder: 6, average: 24.3, runs: 3, onVan: 2, capped: true, free: 20 })).toBe("6 ordered, about 25 sold a run (last 3), less 2 on the van, only 20 free at the depot");
    expect(suggestedRows([{ stockId: "rice", qty: 31, why: { runs: 1 } }])).toEqual([{ stockId: "rice", qty: "31", why: { runs: 1 } }]);
  });

  it("with no signal, goods an offer gives free come off the van too", () => {
    const pack = { trip: { sellable: [{ stockId: "rice", qty: 20 }, { stockId: "bag", qty: 5 }] } };
    const v = offlineView(pack, [{ kind: "sell", state: "waiting", body: { items: [{ itemId: "rice", qty: 10 }], previewFree: [{ stockId: "bag", qty: 1 }] } }]);
    expect(v.sellable).toEqual([{ stockId: "rice", qty: 10 }, { stockId: "bag", qty: 4 }]);
  });
});

describe("phase 6 on the phone", () => {
  it("a van sale prepared by Zarvia AI is posted to the trip's own sell route, with the trip taken out of the body", async () => {
    const { normaliseProposals, saveUrl, bodyToSend, savedResult } = await import("../assistantProposals");
    const [p] = normaliseProposals([{ id: "p1", kind: "van_sale", endpoint: "van_sale", title: "Sale from the van", body: { tripId: "6afc46a2090b559280464717", customerId: "c1", items: [{ itemId: "r", qty: 3, price: 17 }] } }]);
    expect(saveUrl(p)).toBe("/van-sales/trips/6afc46a2090b559280464717/sell");
    expect(bodyToSend(p)).toEqual({ customerId: "c1", items: [{ itemId: "r", qty: 3, price: 17 }] });
    expect(savedResult(p, { data: { invoice: { transactionNo: "SO-9" }, receipt: null } })).toMatchObject({ ok: true, number: "SO-9", text: "Sold from the van: SO-9, on credit.", open: "/van-sales/my-van" });
    expect(normaliseProposals([{ id: "p2", kind: "van_sale", endpoint: "van_sale", body: { tripId: "../../admin" } }])).toEqual([], "a trip that is not an id is dropped, never put in an address");
  });

  it("the deposit slip groups the cheques by bank with a total, and escapes what it prints", async () => {
    const { depositSlipMarkup } = await import("../vanReceipt");
    const html = depositSlipMarkup({ company: { companyName: "Gulf <Foods>" }, trip: { vanCode: "VAN-1", tripNo: "VTR-1" }, cheques: [{ chequeNo: "101", amount: 500, bank: "ENBD", from: "Al Noor" }, { chequeNo: "102", amount: 250.5, bank: "ENBD" }, { chequeNo: "200", amount: 100, bank: "Mashreq" }] });
    expect(html).toContain("Gulf &lt;Foods&gt;");
    expect(html).toContain("ENBD (2)");
    expect(html).toContain("Mashreq (1)");
    expect(html).toContain("3 cheques, total");
    expect(html).toContain("850.50");
  });
});
