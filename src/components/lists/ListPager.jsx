import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_SIZES, pageButtons, showingText } from "@/lib/pagination";

// The footer every list of documents shares: which rows are on screen out of how many, how many to a page, and the way
// through the pages (first and last always, a window around the current one). The figures come from lib/pagination.js
// (`pageSlice` for a list paged in the browser, `pageFigures` for one the server pages).
//
//   figures    { page, pages, total, size, start, end }
//   onPage(n) / onPageSize(n)
//
// Nothing is drawn for an empty list (the screen's empty state says why); a single page still says "Showing 1 to 7 of 7".
export default function ListPager({ figures, onPage, onPageSize, noun = "documents", one, sizes = PAGE_SIZES, className }) {
  if (!figures || !figures.total) return null;
  const { page, pages, size } = figures;
  const withSize = sizes.includes(size) ? sizes : [...sizes, size].sort((a, b) => a - b);
  const step = "min-h-11 min-w-11 rounded-lg px-3 text-sm lg:min-h-9 lg:min-w-9";
  return (
    <nav aria-label="Pages" className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 print:hidden", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-sm text-muted-foreground" aria-live="polite">{showingText(figures, noun, one)}</span>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="sr-only">Rows per page</span>
          <select
            aria-label="Rows per page"
            value={size}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="min-h-11 rounded-lg border border-input bg-card px-3 py-1.5 text-sm text-foreground lg:min-h-9"
          >
            {withSize.map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
        </label>
      </div>
      {pages > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={cn(step, "inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50")}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous
          </button>
          {pageButtons(page, pages).map((p, i) =>
            p === "..." ? (
              <span key={`gap${i}`} aria-hidden="true" className="px-1 text-muted-foreground">&hellip;</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={cn(step, "tabular-nums transition-colors", p === page ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary")}
              >
                {p}
              </button>
            )
          )}
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pages} className={cn(step, "inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50")}>
            Next<ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
}
