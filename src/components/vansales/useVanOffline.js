import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trips } from "../../lib/vanSalesApi";
import { nextNumber, offlineView, queuedOp, store } from "../../lib/vanOffline";

// The van's offline half, for the My van screen: whether there is signal, the offline pack (read while there is), the
// operations waiting on the phone, and sending them when the signal is back - by itself on the browser's "online"
// event, or when the person presses Send now. What the server refuses stays on the phone with its reason.
export function useVanOffline(trip) {
  const tripId = trip?.id || null;
  const out = trip?.status === "ON_ROUTE";
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  const [pack, setPack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const busy = useRef(false);

  const reloadQueue = useCallback(async () => {
    if (tripId) setQueue(await store.list(tripId));
  }, [tripId]);

  const refresh = useCallback(async () => {
    if (!tripId || !out) return;
    try {
      const p = await trips.offlinePack(tripId);
      if (p) {
        await store.savePack(tripId, p);
        setPack(p);
      }
    } catch {
      // no signal: keep the pack already on the phone
    }
  }, [tripId, out]);

  const sync = useCallback(async () => {
    if (!tripId || busy.current) return null;
    const waiting = (await store.list(tripId)).filter((o) => o.state !== "refused");
    if (!waiting.length) return null;
    busy.current = true;
    setSyncing(true);
    try {
      const r = await trips.sync(tripId, { ops: waiting.map(({ clientId, kind, at, body }) => ({ clientId, kind, at, body })) });
      const results = r?.results || [];
      await store.remove(results.filter((x) => x.ok).map((x) => x.clientId));
      for (const x of results.filter((y) => !y.ok)) await store.markRefused(x.clientId, x.error);
      await reloadQueue();
      await refresh();
      return r;
    } catch {
      return null; // still no signal: try again later
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, [tripId, reloadQueue, refresh]);

  useEffect(() => {
    if (!tripId) return undefined;
    let alive = true;
    store.loadPack(tripId).then((p) => alive && p && setPack((cur) => cur || p));
    reloadQueue();
    refresh();
    return () => { alive = false; };
  }, [tripId, reloadQueue, refresh]);

  useEffect(() => {
    const up = () => { setOnline(true); sync(); };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [sync]);

  const enqueue = useCallback(async (kind, body) => {
    const op = queuedOp({ tripId, kind, body });
    await store.add(op);
    await reloadQueue();
    return op;
  }, [tripId, reloadQueue]);

  const discard = useCallback(async (clientId) => {
    await store.remove([clientId]);
    await reloadQueue();
  }, [reloadQueue]);

  const view = useMemo(() => offlineView(pack, queue), [pack, queue]);
  return {
    online, pack, queue, view, syncing, sync, enqueue, discard, refresh,
    active: !online && Boolean(pack),
    number: () => nextNumber(pack, queue),
  };
}
