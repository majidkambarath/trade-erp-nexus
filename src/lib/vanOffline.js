// Working on the van with no signal (phase 3). Two parts:
//
//  - PURE rules (offlineView, nextNumber, queuedOp, isNetworkError): what the van holds once the queued sales are taken
//    off the pack, which reserved invoice number a slip gets next, and whether a failure was the network (queue it)
//    or the server saying no (show it). Tested without a browser.
//  - a small STORE on the phone (IndexedDB, falling back to memory where there is none, as in tests): the offline pack
//    for each trip and the queue of operations waiting to be sent.
//
// The service worker still never caches the API (CLAUDE.md, "Installable"): this is the app's own store, and every
// figure from it is shown with the time it was read. The server re-checks everything when the queue is sent.

const round3 = (n) => Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;

/** A fresh id for one operation, unique on this phone: the server keys idempotency on it. */
export function newClientId() {
  const c = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A failure with no answer from the server is the network: the operation is kept to send later. */
export const isNetworkError = (err) => Boolean(err) && !err.status && !err.code && (err.message === "Network Error" || err.name === "ApiError" || err.isNetwork === true);

/**
 * What the van holds, offline: the pack's sellable stock less the goods on queued sales, and the reserved numbers not
 * yet given to a queued sale. Refused operations are still on the phone but no longer count (they did not happen).
 */
export function offlineView(pack, queue = []) {
  const live = (queue || []).filter((o) => o.state !== "refused");
  const taken = new Map();
  for (const op of live.filter((o) => o.kind === "sell")) {
    for (const l of op.body?.items || []) taken.set(String(l.itemId), round3((taken.get(String(l.itemId)) || 0) + Number(l.qty || 0)));
  }
  const sellable = (pack?.trip?.sellable || []).map((l) => ({ ...l, qty: round3(l.qty - (taken.get(l.stockId) || 0)) })).filter((l) => l.qty > 0);
  const usedNumbers = new Set(live.map((o) => o.body?.number).filter(Boolean));
  const freeNumbers = (pack?.freeNumbers || []).filter((n) => !usedNumbers.has(n));
  return { sellable, freeNumbers, waiting: live.length, refused: (queue || []).filter((o) => o.state === "refused").length };
}

/** The next reserved invoice number for a slip printed offline, or null when the van has none left (or never had). */
export const nextNumber = (pack, queue) => offlineView(pack, queue).freeNumbers[0] || null;

/** A customer's price for an item from the pack, else the item's price on the van. */
export function packPrice(pack, customerId, stockId) {
  const p = pack?.prices?.[customerId]?.[stockId];
  if (p !== undefined) return p;
  return (pack?.trip?.sellable || []).find((l) => l.stockId === stockId)?.salesPrice ?? 0;
}

/** An operation to keep on the phone. */
export const queuedOp = ({ tripId, kind, body, clientId = newClientId(), at = new Date().toISOString() }) => ({ clientId, tripId, kind, body, at, state: "waiting" });

// ---- the store --------------------------------------------------------------------------------------------------
const DB_NAME = "zarvia-van";
const memory = { packs: new Map(), ops: new Map() };

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("packs")) db.createObjectStore("packs");
        if (!db.objectStoreNames.contains("ops")) db.createObjectStore("ops", { keyPath: "clientId" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null); // private window, blocked storage: memory it is
    } catch {
      resolve(null);
    }
  });
}

async function tx(store, mode, fn) {
  const db = await openDb();
  if (!db) return fn(null);
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
  });
}
const asPromise = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

export const store = {
  async savePack(tripId, pack) {
    return tx("packs", "readwrite", (s) => (s ? asPromise(s.put(pack, tripId)) : memory.packs.set(tripId, pack)));
  },
  async loadPack(tripId) {
    return tx("packs", "readonly", (s) => (s ? asPromise(s.get(tripId)) : memory.packs.get(tripId) || null));
  },
  async add(op) {
    return tx("ops", "readwrite", (s) => (s ? asPromise(s.put(op)) : memory.ops.set(op.clientId, op)));
  },
  async list(tripId) {
    const all = await tx("ops", "readonly", (s) => (s ? asPromise(s.getAll()) : [...memory.ops.values()]));
    return (all || []).filter((o) => o.tripId === tripId).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  },
  async remove(clientIds) {
    return tx("ops", "readwrite", async (s) => {
      for (const id of clientIds) {
        if (s) await asPromise(s.delete(id));
        else memory.ops.delete(id);
      }
    });
  },
  async markRefused(clientId, error) {
    return tx("ops", "readwrite", async (s) => {
      const op = s ? await asPromise(s.get(clientId)) : memory.ops.get(clientId);
      if (!op) return;
      const next = { ...op, state: "refused", error };
      if (s) await asPromise(s.put(next));
      else memory.ops.set(clientId, next);
    });
  },
  /** for tests: forget everything kept in memory */
  _reset() {
    memory.packs.clear();
    memory.ops.clear();
  },
};
