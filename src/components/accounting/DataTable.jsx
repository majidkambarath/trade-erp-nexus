import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

// One list, two shapes. From md up this is a real <table>, which is what a pointer and a
// wide screen want: columns line up and can be compared down the page. Below lg every row
// becomes a card, because a seven-column table on a 390px phone is either unreadable or a
// sideways scroll - neither of which anyone does twice.
//
// A column says where it belongs on the card through `card`:
//
//   primary   the headline, top-left (the document number, the code)
//   badge     top-right (a status pill)
//   title     the line under the headline (the party, the account name)
//   amount    bottom-right, emphasised (the figure the row is about)
//   meta      the muted bottom-left line; several meta columns join with a divider
//   actions   a row of controls at the foot of the card, outside the tap target
//   hidden    on the card only: shown in the table, dropped from the card
//
// `header` is what the table's column heading shows and may be a control; `label`, when given,
// is the plain text a card uses for that field instead.
//
// A column with no `card` hint becomes a label/value line in the card body, so wrapping an
// existing table shows everything from the start; promoting two or three fields is then a
// matter of tagging them. `cell(row, index)` renders both shapes, so there is one
// definition of what a cell contains.

const ALIGN = { end: "text-end", center: "text-center", start: "text-start" };

/** Columns grouped by their place on the card. */
const slot = (columns, name) => columns.filter((c) => c.card === name);

export const WIDE = "(min-width: 768px)";

// Which shape to render - a live match, not a CSS class, so only one of the two is ever in
// the DOM. A list of 200 rows would otherwise build both and pay for both.
// Without matchMedia (jsdom) it reports wide, so a test sees the table unless it says
// otherwise.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : true
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia(query);
    const sync = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    // addListener is the pre-2019 Safari spelling, still worth keeping for an iPad in the field
    if (mq.addEventListener) mq.addEventListener("change", sync);
    else mq.addListener?.(sync);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", sync);
      else mq.removeListener?.(sync);
    };
  }, [query]);

  return matches;
}

export function DataTable({
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  footer,
  caption,
  className,
  cardClassName,
}) {
  const wide = useMediaQuery(WIDE);
  const cols = columns.filter(Boolean);
  if (!rows?.length) return null;

  const key = (row, i) => (rowKey ? rowKey(row, i) : (row?._id ?? row?.id ?? i));

  if (wide) {
    return (
      /* ---------- pointer / wide: the table ---------- */
      <div className={cn("erp-scroll relative overflow-x-auto", className)}>
        <table className="w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn("px-3 py-2 font-semibold", ALIGN[c.align] || ALIGN.start, c.headerClassName)}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const clickable = Boolean(onRowClick);
              return (
                <tr
                  key={key(row, i)}
                  onClick={clickable ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-t border-border",
                    clickable ? "cursor-pointer hover:bg-accent/40" : "hover:bg-accent/40"
                  )}
                >
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      className={cn("px-3 py-2.5 align-middle", ALIGN[c.align] || ALIGN.start, c.className)}
                    >
                      {c.cell(row, i)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </table>
      </div>
    );
  }

  return (
    /* ---------- touch: the cards ---------- */
    <ul data-cards="" className={cn("flex flex-col gap-2 p-3", cardClassName)} aria-label={caption}>
      {rows.map((row, i) => (
        <DataCard
          key={key(row, i)}
          row={row}
          index={i}
          columns={cols}
          href={rowHref?.(row)}
          onClick={onRowClick}
        />
      ))}
    </ul>
  );
}

function DataCard({ row, index, columns, href, onClick }) {
  const primary = slot(columns, "primary");
  const badge = slot(columns, "badge");
  const title = slot(columns, "title");
  const amount = slot(columns, "amount");
  const meta = slot(columns, "meta");
  const actions = slot(columns, "actions");
  const unhinted = columns.filter((c) => !c.card);

  const tappable = Boolean(href || onClick);
  // Without a tagged primary or title, the first untagged column becomes the headline -
  // and is then dropped from the detail list so it is not printed twice.
  const fallback = primary.length === 0 && title.length === 0 ? unhinted.slice(0, 1) : [];
  const headline = primary.length ? primary : title.length ? title : fallback;
  const details = unhinted.filter((c) => !fallback.includes(c));

  // The tap target is an overlay rather than a wrapping element: a card that holds its own
  // buttons cannot also BE a link or a button without nesting controls inside a control.
  const overlay = href ? (
    <Link
      to={href}
      className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="sr-only">Open</span>
    </Link>
  ) : onClick ? (
    <button
      type="button"
      onClick={() => onClick(row)}
      className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <span className="sr-only">Open</span>
    </button>
  ) : null;

  return (
    <li
      className={cn(
        "relative rounded-xl border border-border bg-card px-3.5 py-3",
        tappable && "transition-colors active:bg-accent/50"
      )}
    >
      {overlay}

      <div
        className={cn(
          "relative z-[1] flex min-w-0 flex-col gap-1.5",
          // lets the tap fall through to the overlay behind; without an overlay it would
          // only disable whatever the cells contain
          tappable && "pointer-events-none"
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
              {headline.map((c) => (
                <span key={c.key} className="min-w-0 truncate">
                  {c.cell(row, index)}
                </span>
              ))}
            </div>
            {primary.length > 0 &&
              title.map((c) => (
                <p key={c.key} className="mt-0.5 truncate text-sm text-foreground">
                  {c.cell(row, index)}
                </p>
              ))}
          </div>
          {badge.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {badge.map((c) => (
                <span key={c.key}>{c.cell(row, index)}</span>
              ))}
            </div>
          )}
          {badge.length === 0 && tappable && (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </div>

        {details.length > 0 && (
          <dl className="flex flex-col gap-1 text-sm">
            {details.map((c) => {
              const value = c.cell(row, index);
              if (value === null || value === undefined || value === "" || value === false) return null;
              return (
                <div key={c.key} className="flex min-w-0 items-baseline justify-between gap-3">
                  {/* `header` may be a control - a sort button, say - which is right at the top
                      of a column and wrong as a field's label on a card. A column that has one
                      carries plain text in `label` for exactly this. */}
                  <dt className="shrink-0 text-xs text-muted-foreground">{c.label ?? c.header}</dt>
                  <dd className="min-w-0 text-end">{value}</dd>
                </div>
              );
            })}
          </dl>
        )}

        {(meta.length > 0 || amount.length > 0) && (
          <div className="flex min-w-0 items-end justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
              {meta.map((c, mi) => {
                const value = c.cell(row, index);
                if (value === null || value === undefined || value === "") return null;
                return (
                  <React.Fragment key={c.key}>
                    {mi > 0 && <span aria-hidden="true">·</span>}
                    <span className="min-w-0 truncate">{value}</span>
                  </React.Fragment>
                );
              })}
            </div>
            {amount.length > 0 && (
              <div className="shrink-0 text-end text-sm font-semibold tabular-nums text-foreground">
                {amount.map((c) => (
                  <div key={c.key}>{c.cell(row, index)}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {actions.length > 0 && (
        // z above the overlay, and pointer events switched back on: these are the only
        // controls on the card that are not the card's own tap.
        <div
          className={cn(
            "relative z-[2] mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5",
            // A 32px icon button is right in a dense table row and too small under a thumb.
            // The descendant selectors beat the utilities on the buttons themselves.
            "[&_a]:min-h-10 [&_button]:h-10 [&_button]:min-w-10"
          )}
        >
          {actions.map((c) => (
            <span key={c.key} className="contents">
              {c.cell(row, index)}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

// A table that must stay a table on a phone: a trial balance, a VAT return, a P&L. Columns
// of figures only mean something lined up against each other, so these scroll sideways with
// the identifying first column pinned, instead of becoming cards.
export function TableScroll({ children, className, label }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "erp-scroll table-pin-first relative overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className
      )}
    >
      {children}
    </div>
  );
}

export default DataTable;
