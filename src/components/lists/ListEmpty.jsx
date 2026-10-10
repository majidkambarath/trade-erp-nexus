import React from "react";
import { Button } from "../ui/button";
import { EmptyState } from "../accounting/kit";
import { LIST_PERIODS, widerChoices } from "@/lib/listPeriod";
import { formatDate } from "@/utils/format";

// What a list says when it has no rows, which is almost never "you have none": with the period on this calendar month it is
// usually "none THIS month". It names the cause and offers the way out.
//
//   filter         usePeriodFilter's result
//   noun           "sales orders"
//   inPeriod       how many documents the period holds before search / status / customer, or null when the screen cannot tell
//   filtered       a search, status or customer filter is on
//   onClearFilters clears those (not the period)
//   emptyTitle     the screen's own words for "there is nothing at all" (default "No <noun> yet")
//   createText     what to say then, and `action` the screen's own "create one" control
export default function ListEmpty({ filter, noun, inPeriod = null, filtered = false, onClearFilters, emptyTitle, createText, action }) {
  const { period } = filter;
  // "in this month", "today", "in the selected range": the words follow the choice
  const ofPeriod = period.all ? "" : period.preset === "today" ? " today" : period.preset === "custom" ? " in the selected range" : ` in ${period.label.toLowerCase()}`;

  if (filtered && (inPeriod === null || inPeriod > 0)) {
    const text =
      inPeriod === null
        ? `Nothing${ofPeriod} fits the search or filters.`
        : `${inPeriod} ${inPeriod === 1 ? "document is" : "documents are"}${ofPeriod}, but none fit the search or filters.`;
    return (
      <EmptyState
        title={`No ${noun} match`}
        text={text}
        action={onClearFilters && <Button variant="outline" onClick={onClearFilters}>Clear the search and filters</Button>}
      />
    );
  }

  if (!period.all) {
    const range = period.from && period.to ? `${formatDate(period.from)} – ${formatDate(period.to)}` : period.from ? `from ${formatDate(period.from)}` : `up to ${formatDate(period.to)}`;
    const label = (v) => LIST_PERIODS.find((p) => p.value === v)?.label || v;
    return (
      <EmptyState
        title={`No ${noun}${ofPeriod}`}
        text={`Nothing is dated ${range}. Widen the period to see earlier ones.`}
        action={
          <span className="flex flex-wrap justify-center gap-2">
            {widerChoices(period).map((v) => <Button key={v} variant="outline" onClick={() => filter.choose(v)}>{label(v)}</Button>)}
          </span>
        }
      />
    );
  }

  return <EmptyState title={emptyTitle || `No ${noun} yet`} text={createText} action={action} />;
}
