import React from "react";
import { Search, X } from "lucide-react";
import { Button } from "../ui/button";
import { Field, Select, TextInput } from "../accounting/kit";
import { cn } from "@/lib/utils";

// The filter row of a list, the same on every screen that is not a list of documents (items, categories, customers, vendors, staff,
// stock movements). It is what the finance and order lists' own toolbars look like: a search box, then labelled controls that
// share one height, then a way back to everything. It is always showing - a list that hides its filters behind a button is a list
// whose empty state nobody can explain.
//
//   <FilterBar search={term} onSearch={setTerm} placeholder="Search name, code or phone…" active={filtersOn} onClear={clearAll}>
//     <FilterSelect label="Status" value={status} onChange={setStatus} options={[["active", "Active"], ["inactive", "Inactive"]]} allLabel="All statuses" />
//     <PeriodSelect filter={period} labelled />
//   </FilterBar>
//
// On a phone the search takes the full width and each control its own line; from `sm` they sit in one wrapping row. `active` shows
// "Clear filters" (the caller decides what counts: a search, a choice, a period that is not the default).

export default function FilterBar({
  search,
  onSearch,
  searchLabel = "Search",
  placeholder = "Search…",
  active = false,
  onClear,
  children,
  className,
}) {
  const hasSearch = typeof onSearch === "function";
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end print:hidden", className)}>
      {hasSearch && (
        <div className="relative w-full sm:min-w-56 sm:max-w-sm sm:flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <TextInput
            type="search"
            aria-label={searchLabel}
            className="ps-9 pe-10 [&::-webkit-search-cancel-button]:hidden"
            placeholder={placeholder}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute end-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground lg:end-1.5 lg:h-7 lg:w-7"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      )}
      {children}
      {active && onClear && (
        <Button type="button" variant="outline" onClick={onClear} className="w-full sm:w-auto">
          Clear filters
        </Button>
      )}
    </div>
  );
}

/**
 * One labelled choice of a few: `options` are [value, label] pairs (or { value, label }), and `allLabel` is the first entry, the
 * one that means "no filter" and has the value "". For a list that can be long (customers, accounts) use SearchSelect in a Field.
 */
export function FilterSelect({ label, value, onChange, options, allLabel, className }) {
  return (
    <Field label={label} className={cn("w-full sm:w-44", className)}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map((o) => {
          const [v, text] = Array.isArray(o) ? o : [o.value, o.label];
          return (
            <option key={v} value={v}>
              {text}
            </option>
          );
        })}
      </Select>
    </Field>
  );
}
