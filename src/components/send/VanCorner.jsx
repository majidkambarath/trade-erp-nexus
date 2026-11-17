import React, { useEffect, useState } from "react";
import { CalendarDays, Loader2, Truck } from "lucide-react";
import { fetchVanCorner, postVanRequest } from "../../lib/shareApi";
import { formatCurrencyAED, formatDate } from "../../utils/format";

// Under a van invoice on the customer's own page (van sales, phase 6): what they still owe, when the van comes next,
// what is already ordered for that visit, and a short form to ask for goods on it. Nothing here is the invoice
// itself: a link to any other document answers 404 for this part and the page simply leaves it out.
const field = "h-11 w-24 rounded-lg border border-input bg-card px-3 text-base sm:text-sm";

export default function VanCorner({ token }) {
  const [data, setData] = useState(undefined);
  const [qty, setQty] = useState({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { let live = true; fetchVanCorner(token).then((d) => live && setData(d)); return () => { live = false; }; }, [token]);
  if (!data?.statement) return null; // anything else is not this page's answer
  const { statement, nextVisit, canRequest } = data;
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const items = Array.isArray(data.items) ? data.items : [];
  const lines = Object.entries(qty).filter(([, q]) => Number(q) > 0).map(([stockId, q]) => ({ stockId, qty: Number(q) }));

  async function send() {
    setBusy(true);
    setError("");
    try {
      setDone(await postVanRequest(token, { lines, note }));
      setQty({});
      setNote("");
      setData(await fetchVanCorner(token));
    } catch (e) {
      setError(e.message || "That could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Your account and the next van visit" className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs text-muted-foreground">You owe</p>
          <p className="text-xl font-semibold">{formatCurrencyAED(statement.owed)}</p>
          {statement.overdue > 0 && <p className="text-xs font-medium text-status-danger">{formatCurrencyAED(statement.overdue)} of it is overdue</p>}
        </div>
        {nextVisit && (
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div><p className="text-xs text-muted-foreground">The van comes next</p><p className="font-semibold">{formatDate(nextVisit)}</p></div>
          </div>
        )}
      </div>
      {statement.open?.length > 0 && (
        <ul className="min-w-0 divide-y divide-border rounded-lg border border-border text-sm">
          {statement.open.map((r) => (
            <li key={r.number} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate">{r.number} · {formatDate(r.date)}</span>
              <span className={`shrink-0 whitespace-nowrap ${r.overdue ? "font-medium text-status-danger" : ""}`}>{formatCurrencyAED(r.outstanding)}</span>
            </li>
          ))}
        </ul>
      )}
      {orders.length > 0 && (
        <div className="min-w-0 text-sm">
          <p className="font-medium">Ordered for the van</p>
          <ul className="mt-1 grid gap-1">{orders.map((o) => <li key={o.orderNo} className="text-muted-foreground">{o.orderNo}{o.expectedDate ? ` for ${formatDate(o.expectedDate)}` : ""}{o.requested ? " (your request)" : ""}: {o.items.map((l) => `${l.qty} x ${l.name}`).join(", ")}</li>)}</ul>
        </div>
      )}
      {canRequest && items.length > 0 && (
        <div className="grid min-w-0 grid-cols-1 gap-2">
          <p className="flex items-center gap-2 font-medium"><Truck className="h-4 w-4" aria-hidden="true" /> Ask for goods on the next visit</p>
          <ul className="grid min-w-0 grid-cols-1 gap-2">
            {items.map((i) => (
              <li key={i.stockId} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 text-sm"><span className="block truncate">{i.name}</span><span className="text-xs text-muted-foreground">{formatCurrencyAED(i.price)} each</span></span>
                <input type="text" inputMode="numeric" pattern="[0-9]*" aria-label={`How many ${i.name}`} value={qty[i.stockId] || ""} onChange={(e) => setQty((q) => ({ ...q, [i.stockId]: e.target.value.replace(/[^0-9]/g, "").slice(0, 6) }))} className={field} />
              </li>
            ))}
          </ul>
          <input type="text" maxLength={300} aria-label="Note for the salesman" placeholder="A note for the salesman (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="h-11 rounded-lg border border-input bg-card px-3 text-base sm:text-sm" />
          {error && <p role="alert" className="text-sm text-status-danger">{error}</p>}
          {done && <p role="status" className="text-sm text-status-success">Sent as {done.orderNo}. The van will bring it on {formatDate(done.expectedDate)}.</p>}
          <button type="button" disabled={busy || !lines.length} onClick={send} className="inline-flex h-11 w-fit items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Send to the van
          </button>
        </div>
      )}
    </section>
  );
}
