import { describe, it, expect, beforeEach } from "vitest";
import { isNetworkError, newClientId, nextNumber, offlineView, packPrice, queuedOp, store } from "../vanOffline";

const pack = {
  at: "2026-11-17T08:00:00.000Z",
  trip: { id: "t1", sellable: [{ stockId: "rice", itemName: "Rice", qty: 20, salesPrice: 20 }, { stockId: "oil", itemName: "Oil", qty: 2, salesPrice: 30 }] },
  prices: { c1: { rice: 17 } },
  freeNumbers: ["SO-1", "SO-2", "SO-3"],
};
const sale = (clientId, items, number, state = "waiting") => ({ clientId, kind: "sell", state, body: { items, number } });

describe("what the van holds with no signal", () => {
  it("takes the queued sales off the pack, drops what is sold out, and does not count a refused sale", () => {
    const v = offlineView(pack, [
      sale("a", [{ itemId: "rice", qty: 5 }], "SO-1"),
      sale("b", [{ itemId: "oil", qty: 2 }], "SO-2"),
      sale("c", [{ itemId: "rice", qty: 10 }], "SO-3", "refused"),
      { clientId: "d", kind: "visit", state: "waiting", body: {} },
    ]);
    expect(v.sellable).toEqual([{ stockId: "rice", itemName: "Rice", qty: 15, salesPrice: 20 }]);
    expect(v.freeNumbers).toEqual(["SO-3"], "a refused sale gives its number back");
    expect(v.waiting).toBe(3);
    expect(v.refused).toBe(1);
  });
  it("gives the next free reserved number, and none when the van has none", () => {
    expect(nextNumber(pack, [sale("a", [], "SO-1")])).toBe("SO-2");
    expect(nextNumber({ ...pack, freeNumbers: [] }, [])).toBeNull();
    expect(nextNumber(null, [])).toBeNull();
  });
  it("prices from the customer's list in the pack, else the van's own price", () => {
    expect(packPrice(pack, "c1", "rice")).toBe(17);
    expect(packPrice(pack, "c1", "oil")).toBe(30);
    expect(packPrice(pack, "c9", "rice")).toBe(20);
  });
});

describe("telling the network from a refusal", () => {
  it("queues only when nothing answered", () => {
    expect(isNetworkError(Object.assign(new Error("Network Error"), { name: "ApiError" }))).toBe(true);
    expect(isNetworkError(Object.assign(new Error("Not enough on the van"), { name: "ApiError", status: 409, code: "VAN_STOCK_SHORT" }))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
  it("every operation gets its own id", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newClientId()));
    expect(ids.size).toBe(50);
    expect(queuedOp({ tripId: "t1", kind: "visit", body: {} })).toMatchObject({ tripId: "t1", kind: "visit", state: "waiting" });
  });
});

describe("the store on the phone (memory where there is no IndexedDB)", () => {
  beforeEach(() => store._reset());
  it("keeps the pack and the queue per trip, in the order things were done, and marks a refusal", async () => {
    await store.savePack("t1", pack);
    expect((await store.loadPack("t1")).at).toBe(pack.at);
    await store.add({ ...queuedOp({ tripId: "t1", kind: "sell", body: {}, clientId: "b", at: "2026-11-17T09:00:00Z" }) });
    await store.add({ ...queuedOp({ tripId: "t1", kind: "visit", body: {}, clientId: "a", at: "2026-11-17T08:30:00Z" }) });
    await store.add({ ...queuedOp({ tripId: "t2", kind: "visit", body: {}, clientId: "z" }) });
    expect((await store.list("t1")).map((o) => o.clientId)).toEqual(["a", "b"]);
    await store.markRefused("b", { code: "VAN_STOCK_SHORT", message: "Not enough" });
    expect((await store.list("t1"))[1]).toMatchObject({ state: "refused", error: { code: "VAN_STOCK_SHORT" } });
    await store.remove(["a"]);
    expect((await store.list("t1")).map((o) => o.clientId)).toEqual(["b"]);
  });
});
