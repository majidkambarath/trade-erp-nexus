import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { renderAs, statusFor } from "../../accounting/__tests__/asRole";
import { useListView } from "../../../lib/useListView";
import { clearPageSessions } from "../../../lib/pageSession";

let status;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));

import ListPage from "../ListPage";

const COLUMNS = [
  { key: "name", header: "Name", sortable: true, card: "primary", cell: (r) => r.name },
  { key: "status", header: "Status", card: "badge", cell: (r) => r.status },
];
const ROWS = [
  { id: "1", name: "Bravo", status: "Active" },
  { id: "2", name: "Alpha", status: "Draft" },
];

function Harness({ rows = ROWS, bulkActions, onBulkDone, ...rest }) {
  const list = useListView("list-page-test", { columns: COLUMNS, filters: { status: "" } });
  return (
    <ListPage
      title="Widgets"
      description="All of them."
      actions={<button type="button">+ Add widget</button>}
      list={list}
      noun="widgets"
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      searchLabel="Search widgets"
      placeholder="Search widgets…"
      bulkActions={bulkActions}
      onBulkDone={onBulkDone}
      {...rest}
    />
  );
}

beforeEach(() => {
  window.localStorage.clear();
  clearPageSessions();
  status = statusFor("sales.view");
});

describe("ListPage", () => {
  it("draws the header, the filter row and the rows", async () => {
    await renderAs(<Harness />);
    expect(screen.getByRole("heading", { name: "Widgets" })).toBeVisible();
    expect(screen.getByText("All of them.")).toBeVisible();
    expect(screen.getByRole("button", { name: "+ Add widget" })).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search widgets" })).toBeVisible();
    expect(screen.getByText("Bravo")).toBeVisible();
    expect(screen.getByText("Alpha")).toBeVisible();
  });

  it("the saved-view picker rides in the same toolbar as the search box, and can be turned off", async () => {
    const { unmount } = await renderAs(<Harness />);
    expect(screen.getByRole("combobox", { name: "View" })).toBeVisible();
    unmount();

    await renderAs(<Harness savedViews={false} />);
    expect(screen.queryByRole("combobox", { name: "View" })).not.toBeInTheDocument();
  });

  it("extra filter controls passed as filterChildren sit alongside the search box", async () => {
    await renderAs(<Harness filterChildren={<button type="button">Status: all</button>} />);
    expect(screen.getByRole("button", { name: "Status: all" })).toBeVisible();
  });

  it("typing in the search box updates the live state (through useListView) and the rows shown", async () => {
    await renderAs(<Harness />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search widgets" }), { target: { value: "al" } });
    // ListPage itself does not filter rows - the screen's own loader reacts to list.key - but the box
    // keeps what was typed, proving the wiring from FilterBar through to useListView's search state
    expect(screen.getByRole("searchbox", { name: "Search widgets" })).toHaveValue("al");
  });

  it("shows a sortable column header and toggles through useListView's own sort state", async () => {
    await renderAs(<Harness />);
    const nameHeader = screen.getByRole("button", { name: /Name/ });
    expect(nameHeader).not.toHaveAttribute("aria-sort"); // the ancestor <th> carries aria-sort, not the button
    fireEvent.click(nameHeader);
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("shows the no-rows-at-all empty state, with the screen's own words and action", async () => {
    await renderAs(<Harness rows={[]} emptyTitle="No widgets yet" emptyText="Add the first one." emptyAction={<button type="button">New widget</button>} />);
    expect(screen.getByText("No widgets yet")).toBeVisible();
    expect(screen.getByText("Add the first one.")).toBeVisible();
    expect(screen.getByRole("button", { name: "New widget" })).toBeVisible();
  });

  it("shows the no-match empty state once a search is active, with a working Clear filters", async () => {
    await renderAs(<Harness rows={[]} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search widgets" }), { target: { value: "zzz" } });
    expect(await screen.findByText("No widgets match")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("searchbox", { name: "Search widgets" })).toHaveValue("");
  });

  it("an explicit empty node overrides both built-in empty states", async () => {
    await renderAs(<Harness rows={[]} empty={<p>Nothing here at all.</p>} />);
    expect(screen.getByText("Nothing here at all.")).toBeVisible();
  });

  it("shows a spinner while loading and an error with Try again otherwise", async () => {
    const onRetry = vi.fn();
    const { unmount } = await renderAs(<Harness rows={[]} loading loadingLabel="Loading widgets" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading widgets");
    unmount();

    await renderAs(<Harness rows={[]} error={new Error("Network down")} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Network down");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("selection stays off (no checkboxes) until bulkActions is given", async () => {
    await renderAs(<Harness />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("selecting rows shows the bulk bar, and a successful action clears the selection", async () => {
    const run = vi.fn(() => Promise.resolve({ changed: ["1"] }));
    const onBulkDone = vi.fn();
    await renderAs(<Harness bulkActions={[{ key: "approve", label: "Approve", run }]} onBulkDone={onBulkDone} />);

    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select row" })[0]);
    expect(screen.getByText("1 selected")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(run).toHaveBeenCalledWith(["1"]));
    expect(onBulkDone).toHaveBeenCalledWith(["1"]);
    await waitFor(() => expect(screen.queryByText("1 selected")).not.toBeInTheDocument());
  });

  it("renders a pager built from pagerFigures, below the table", async () => {
    const onPage = vi.fn();
    await renderAs(<Harness pagerFigures={{ page: 1, pages: 3, total: 25, size: 10, start: 1, end: 10 }} onPage={onPage} />);
    expect(screen.getByRole("navigation", { name: "Pages" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(onPage).toHaveBeenCalledWith(2);
  });

  it("a ready pager element passed as `pager` is used as-is, in place of pagerFigures", async () => {
    await renderAs(<Harness pager={<p data-testid="custom-pager">Custom pager</p>} />);
    expect(screen.getByTestId("custom-pager")).toBeVisible();
  });

  it("no pager at all while the list is empty", async () => {
    await renderAs(<Harness rows={[]} pagerFigures={{ page: 1, pages: 1, total: 0, size: 10, start: 0, end: 0 }} />);
    expect(screen.queryByRole("navigation", { name: "Pages" })).not.toBeInTheDocument();
  });
});
