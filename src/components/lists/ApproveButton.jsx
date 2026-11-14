import React, { useSyncExternalStore } from "react";
import { Loader2 } from "lucide-react";

// Which documents are being approved (or rejected) right now, kept outside React so a row can show its own
// spinner without the page threading a "busy" prop through the table AND the card view of four screens.
// A page wraps its approve / reject handler in `trackApproval`; a row asks `useApproving(id)`.
const busy = new Map(); // id -> how many calls are in flight for it
const listeners = new Set();
let snapshot = new Set();

const publish = () => {
  snapshot = new Set(busy.keys());
  listeners.forEach((l) => l());
};

export async function trackApproval(ids, fn) {
  const list = (Array.isArray(ids) ? ids : [ids]).map(String);
  for (const id of list) busy.set(id, (busy.get(id) || 0) + 1);
  publish();
  try {
    return await fn();
  } finally {
    for (const id of list) {
      const n = (busy.get(id) || 1) - 1;
      if (n <= 0) busy.delete(id);
      else busy.set(id, n);
    }
    publish();
  }
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useApproving = (id) => useSyncExternalStore(subscribe, () => snapshot).has(String(id));

// The Approve / Confirm button of a row. While the request runs it is disabled and its icon turns into a spinner;
// its text, if it has any, stays. Everything else (classes, title, onClick) is the caller's, as for a <button>.
export default function ApproveButton({ id, children, className = "", disabled, ...rest }) {
  const working = useApproving(id);
  return (
    <button
      type="button"
      {...rest}
      disabled={working || disabled}
      aria-busy={working || undefined}
      className={`${className} ${working ? "cursor-wait opacity-70 [&>svg]:hidden" : ""}`}
    >
      {working && <span className="inline-flex"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /></span>}
      {children}
    </button>
  );
}
