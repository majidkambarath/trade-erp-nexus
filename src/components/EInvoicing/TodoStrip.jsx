import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { CURRENCY, formatNumber } from "../../utils/format";
import { StatCard } from "../ui/stat-card";

// The worklist: what needs a person right now, as of today (not tied to the period). Each tile opens the list it counts, already filtered.
// A tile at zero is drawn quiet; when every tile is zero the strip says so in one line instead of eight zeros.
export default function TodoStrip({ todo }) {
  const navigate = useNavigate();
  const open = todo.filter((t) => t.count > 0);
  if (open.length === 0) {
    return (
      <div role="status" className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm shadow-card">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-status-success" aria-hidden="true" />
        <span><strong className="font-semibold">All clear.</strong> <span className="text-muted-foreground">Nothing is waiting to be sent, fixed or reviewed.</span></span>
      </div>
    );
  }
  return (
    <section aria-label="Needs you now">
      <h2 className="mb-2 text-sm font-semibold">Needs you now</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {open.map((t) => (
          <StatCard
            key={t.key} title={t.label} count={t.count} tone={t.tone}
            subText={[t.amount ? `${CURRENCY} ${formatNumber(t.amount, 2)}` : null, t.hint].filter(Boolean).join(" · ") || "Open the list"}
            onClick={() => navigate(t.link)}
          />
        ))}
      </div>
    </section>
  );
}
