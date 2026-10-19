import React, { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";
import { DataTable, EmptyState, PageHeader, Panel } from "../accounting/kit";
import FilterBar from "./FilterBar";
import SavedViews from "./SavedViews";
import BulkBar from "./BulkBar";
import ListPager from "./ListPager";

// The shell a plain list screen is built from: the standard page padding, a header, the filter row (with
// the saved-view picker riding in it), the table/cards in their own card, and the pager as that card's
// own footer strip - exactly the arrangement `orderDocs/TradeOrderList.jsx` already hand-builds (one of
// 1c's own "de facto spec" screens), just wired straight to what `useListView(...)` returns so a new
// screen supplies its columns, its rows and a couple of words and gets the rest for free.
//
// Nothing here is forced: an existing screen adopts it when it is ready to, a line at a time, and a
// screen with needs this shell does not cover (a period control instead of a plain filter row, a custom
// empty state, several tabs of counts above the list, no filter row at all - a list of masters, CLAUDE.md
// "Lists of masters need no period") can still reach for FilterBar, SavedViews, BulkBar and DataTable
// directly, in whatever arrangement it needs - `ListPage` is a convenience, not the only way in.
//
//   const columns = [...];
//   const list = useListView("customers", { columns, filters: { status: "" } });
//   const { data, loading, error, reload } = useAsync(() => api.customers.list({ search: list.search, ...list.filters, sort: list.sort }), [list.key]);
//   return (
//     <ListPage
//       title="Customers" actions={<Button>+ Add customer</Button>}
//       list={list} noun="customers"
//       columns={columns} rows={data?.rows} rowHref={(r) => `/customers/${r._id}`}
//       loading={loading} error={error} onRetry={reload}
//       searchLabel="Search customers" placeholder="Search name or phone…"
//       filterChildren={<FilterSelect label="Status" value={list.filters.status} onChange={(v) => list.setFilter("status", v)} options={[...]} allLabel="All statuses" />}
//     />
//   );
//
// A column chooser and a density switch are not built yet (`list.hidden`/`list.toggleColumn` and
// `list.density`/`list.setDensity` are already wired into DataTable below, so the only missing piece is a
// control a person can press - a later, small addition, deliberately not invented here under time
// pressure with no design pass; see the plan's "Corrections… 1c" note on why a popover is the wrong shape
// for it and a Modal/native Select is the right one).
export default function ListPage({
  // header
  title,
  description,
  actions,

  // the useListView(...) result - required; everything below reads/writes through it
  list,
  noun = "records",

  // the table
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  footer,
  caption,
  cardClassName,

  // built-in states, passed straight through to DataTable
  loading,
  loadingLabel,
  error,
  onRetry,

  // the filter row
  searchLabel,
  placeholder,
  filterChildren,
  savedViews = true,

  // the "nothing at all" case (list.active decides whether this or the "no match" copy below shows);
  // `empty` overrides both and is rendered as-is - reach for it when a screen needs ListEmpty's
  // period-aware wording instead (a list of dated documents or movements, which carries its own
  // usePeriodFilter and so a period control FilterBar does not have room for here)
  emptyTitle,
  emptyText,
  emptyAction,
  empty,

  // bulk actions - selection stays fully off (no checkbox column, zero cost) until this is given
  bulkActions,
  onBulkDone,

  // the pager - a ready <ListPager/>, or the pieces to build one from lib/pagination.js's figures
  pager,
  pagerFigures,
  onPage,
  onPageSize,

  className,
}) {
  const selecting = Array.isArray(bulkActions) && bulkActions.length > 0;
  const pageKeys = (rows || []).map((row, i) => (rowKey ? rowKey(row, i) : row?._id ?? row?.id ?? i));

  // a reload, a filter change or a delete can drop rows out from under a selection - never go on acting on
  // a row that is no longer on screen (lib/listView.js keepExisting, via list.dropMissingSelection)
  const dropMissing = list?.dropMissingSelection;
  const keysRef = useRef(pageKeys);
  keysRef.current = pageKeys;
  useEffect(() => {
    if (selecting) dropMissing?.(keysRef.current);
  }, [selecting, dropMissing, rows]);

  const toolbarChildren = [
    filterChildren && <React.Fragment key="filters">{filterChildren}</React.Fragment>,
    savedViews && list && <SavedViews key="saved-views" list={list} />,
  ].filter(Boolean);

  const resolvedEmpty =
    empty ??
    (list?.active ? (
      // no second "Clear filters" button here - the filter row above already carries the one for this,
      // from the same `list.active`/`list.clearFilters` state, and a row of empty-state text under it
      // offering the identical action a second time is clutter, not help
      <EmptyState title={`No ${noun} match`} text="Nothing fits the search or filters." />
    ) : (
      <EmptyState title={emptyTitle || `No ${noun} yet`} text={emptyText} action={emptyAction} />
    ));

  const resolvedPager = pager ?? (pagerFigures ? <ListPager figures={pagerFigures} onPage={onPage} onPageSize={onPageSize} noun={noun} className="rounded-none border-0 border-t shadow-none" /> : null);
  const hasRows = Boolean(rows?.length);

  return (
    <div className={cn("mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8", className)}>
      <PageHeader title={title} description={description} actions={actions} />

      {list && (
        <div className="mb-4">
          <FilterBar
            search={list.search}
            onSearch={list.setSearch}
            searchLabel={searchLabel}
            placeholder={placeholder}
            active={list.active}
            onClear={list.clearFilters}
          >
            {toolbarChildren}
          </FilterBar>
        </div>
      )}

      <Panel bodyClassName="p-0">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          rowHref={rowHref}
          onRowClick={onRowClick}
          footer={footer}
          caption={caption}
          cardClassName={cardClassName}
          sort={list?.sort}
          onSort={list?.toggleSort}
          hiddenColumns={list?.hidden}
          density={list?.density}
          loading={loading}
          loadingLabel={loadingLabel}
          error={error}
          onRetry={onRetry}
          empty={resolvedEmpty}
          selection={selecting ? list.selection : undefined}
          onSelection={selecting ? list.setSelection : undefined}
          bulkBar={
            selecting ? (
              <BulkBar
                selection={list.selection}
                onClear={list.clearSelection}
                actions={bulkActions}
                onDone={(changed) => {
                  onBulkDone?.(changed);
                  list.clearSelection();
                }}
              />
            ) : undefined
          }
        />
        {hasRows && !loading && !error && resolvedPager}
      </Panel>
    </div>
  );
}
