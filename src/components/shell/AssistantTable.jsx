import { ExternalLink } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * What a lookup in the person's own books showed ("list unpaid vendors"), under the answer. The server wrote every
 * figure from the books; this only draws it. A stacked list rather than a grid, so it fits the panel on a phone:
 * the name and a line about it on the left, the figure on the right and never wrapped.
 */
export default function AssistantTable({ table, onOpen }) {
  if (!table || !table.rows?.length) return null;
  return (
    <section aria-label={table.title} className="overflow-hidden rounded-xl border bg-card text-sm">
      <h3 className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold">{table.title}</h3>
      {table.stats?.length > 0 && (
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-px border-b bg-border">
          {table.stats.map((x) => (
            <div key={x.label} className="min-w-0 bg-card px-3 py-2.5">
              <dt className="truncate text-[11px] text-muted-foreground">{x.label}</dt>
              <dd className={cn("whitespace-nowrap text-sm font-semibold tabular-nums", x.tone === "danger" && "text-destructive", x.tone === "good" && "text-status-success")}>{x.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <ul className="divide-y">
        {table.rows.map((r, i) => (
          <li key={`${r.label}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.label}</p>
              {r.sub && <p className="text-xs text-muted-foreground">{r.sub}</p>}
            </div>
            <span className={cn("shrink-0 whitespace-nowrap tabular-nums", r.tone === "danger" && "text-destructive")}>{r.value}</span>
          </li>
        ))}
      </ul>
      {table.more > 0 && <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">and {table.more} more</p>}
      {table.total && (
        <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-3 py-2 font-semibold">
          <span>{table.total.label}</span>
          <span className="shrink-0 whitespace-nowrap tabular-nums">{table.total.value}</span>
        </div>
      )}
      {table.link && onOpen && (
        <div className="border-t px-3 py-2">
          <button type="button" onClick={() => onOpen(table.link.path)} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-accent">
            <ExternalLink className="size-3.5" aria-hidden="true" />
            {table.link.label}
          </button>
        </div>
      )}
    </section>
  );
}
