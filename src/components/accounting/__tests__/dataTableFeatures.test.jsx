import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DataTable, ErrorNote, Spinner } from "../DataTable";

// Stage 1c: sort, selection + a bulk bar, column visibility, density, and the built-in loading/error/empty
// states. Every one of these is optional and off by default - src/components/accounting/__tests__/dataTable.test.jsx
// is the backward-compatibility pin for the 51 existing callers that pass none of them, and is left untouched.
const viewport = (wide) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: wide, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
};
afterEach(() => { delete window.matchMedia; });

const ROWS = [
  { id: "1", no: "SO-0042", amount: 12480 },
  { id: "2", no: "SO-0041", amount: 3200 },
];
const columns = (extra = []) => [
  { key: "no", header: "Number", card: "primary", sortable: true, cell: (r) => r.no },
  { key: "amount", header: "Amount", align: "end", card: "amount", sortable: true, hideable: true, sortValue: (r) => r.amount, cell: (r) => String(r.amount) },
  ...extra,
];
const draw = (props = {}, wide = true) => {
  viewport(wide);
  return render(
    <MemoryRouter>
      <DataTable columns={columns()} rows={ROWS} rowKey={(r) => r.id} caption="Sales orders" {...props} />
    </MemoryRouter>
  );
};

describe("sorting", () => {
  it("a sortable column is a button with aria-sort reflecting the live sort state", () => {
    draw({ sort: { key: "amount", dir: "asc" }, onSort: vi.fn() });
    const amountHeader = screen.getByRole("columnheader", { name: /Amount/ });
    expect(amountHeader).toHaveAttribute("aria-sort", "ascending");
    expect(within(amountHeader).getByRole("button", { name: /Amount/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Number/ })).toHaveAttribute("aria-sort", "none");
  });

  it("pressing a sortable header calls onSort with the column's key", () => {
    const onSort = vi.fn();
    draw({ sort: null, onSort });
    fireEvent.click(screen.getByRole("button", { name: /Number/ }));
    expect(onSort).toHaveBeenCalledWith("no");
  });

  it("a header stays plain text when onSort is absent, even though the column says sortable", () => {
    draw({ sort: { key: "no", dir: "asc" } }); // no onSort
    expect(screen.queryByRole("button", { name: /Number/ })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Number" })).not.toHaveAttribute("aria-sort");
  });

  it("a non-sortable column is never a button", () => {
    draw({ columns: columns([{ key: "notes", header: "Notes", cell: () => "x" }]), sort: null, onSort: vi.fn() });
    expect(screen.queryByRole("button", { name: /Notes/ })).not.toBeInTheDocument();
  });
});

describe("selection and the bulk bar", () => {
  it("selection=null renders no checkbox column at all (the default, zero-cost case)", () => {
    draw();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("a header checkbox toggles every row on the page, and is indeterminate on a partial selection", () => {
    const onSelection = vi.fn();
    draw({ selection: ["1"], onSelection, bulkBar: <div>bar</div> });
    const header = screen.getByRole("checkbox", { name: "Select all on this page" });
    expect(header.indeterminate).toBe(true);
    fireEvent.click(header);
    expect(onSelection).toHaveBeenCalledWith(["1", "2"]); // fills in the missing one, as a partial selection should
  });

  it("a row checkbox toggles just that row, and does not fire onRowClick", () => {
    const onSelection = vi.fn();
    const onRowClick = vi.fn();
    draw({ selection: [], onSelection, onRowClick, bulkBar: null });
    const [row1] = screen.getAllByRole("checkbox", { name: "Select row" }); // both rows share the default name
    fireEvent.click(row1);
    expect(onSelection).toHaveBeenCalledWith(["1"]);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("every row checkbox gets an accessible name from selectName, defaulting to a plain one", () => {
    draw({ selection: [], onSelection: vi.fn(), selectName: (r) => `Select ${r.no}` });
    expect(screen.getByRole("checkbox", { name: "Select SO-0042" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select SO-0041" })).toBeInTheDocument();
  });

  it("the bulk bar shows only while something is selected", () => {
    const { rerender } = render(
      <MemoryRouter>
        <DataTable columns={columns()} rows={ROWS} rowKey={(r) => r.id} caption="Sales orders" selection={[]} onSelection={vi.fn()} bulkBar={<div>2 selected</div>} />
      </MemoryRouter>
    );
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <DataTable columns={columns()} rows={ROWS} rowKey={(r) => r.id} caption="Sales orders" selection={["1"]} onSelection={vi.fn()} bulkBar={<div>2 selected</div>} />
      </MemoryRouter>
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("on a card (phone), selection adds one checkbox per card, and the badge slot is unaffected", () => {
    draw(
      { columns: [{ key: "no", header: "Number", card: "primary", cell: (r) => r.no }, { key: "status", header: "Status", card: "badge", cell: () => <span>Approved</span> }], selection: [], onSelection: vi.fn() },
      false
    );
    const list = screen.getByRole("list", { name: "Sales orders" });
    expect(within(list).getAllByRole("checkbox")).toHaveLength(2);
    expect(within(list).getAllByText("Approved")).toHaveLength(2);
  });

  it("selection is off by default on a card (no selection prop passed at all)", () => {
    draw({}, false);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});

describe("hidden columns and density", () => {
  it("hiddenColumns drops a column from the table shape", () => {
    draw({ hiddenColumns: ["amount"] });
    expect(screen.queryByRole("columnheader", { name: /Amount/ })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Number/ })).toBeInTheDocument();
  });

  it("a column without hideable stays, even if named in hiddenColumns", () => {
    draw({ hiddenColumns: ["no"] }); // "no" has no `hideable: true`
    expect(screen.getByRole("columnheader", { name: /Number/ })).toBeInTheDocument();
  });

  it("density=compact is accepted and changes nothing else about the markup", () => {
    draw({ density: "compact" });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 rows, same as comfortable
  });
});

describe("built-in loading / error / empty states", () => {
  it("all three absent and no rows renders nothing, exactly as before", () => {
    const { container } = draw({ rows: [] });
    expect(container.firstChild).toBeNull();
  });

  it("loading with no rows shows the Spinner", () => {
    draw({ rows: [], loading: true, loadingLabel: "Loading orders" });
    expect(screen.getByRole("status")).toHaveTextContent("Loading orders");
  });

  it("an error with no rows shows ErrorNote with retry", () => {
    const onRetry = vi.fn();
    draw({ rows: [], error: new Error("Could not load"), onRetry });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("an empty node is shown when there are no rows and nothing is loading or wrong", () => {
    draw({ rows: [], empty: <div>Nothing here yet</div> });
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("rows present wins over loading/error/empty - real data is never hidden behind a stale state", () => {
    draw({ loading: true, error: new Error("x") });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("the dev warning for an incompatible combination", () => {
  it("warns once when footer is combined with selection or hiddenColumns, and only in dev", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    draw({ footer: <tr><td>total</td></tr>, selection: [], onSelection: vi.fn() });
    draw({ footer: <tr><td>total</td></tr>, selection: [], onSelection: vi.fn() }); // same caption: warns once, not twice
    expect(warn).toHaveBeenCalledTimes(import.meta.env.DEV ? 1 : 0);
    warn.mockRestore();
  });
});

describe("Spinner and ErrorNote, re-exported from kit.jsx without change", () => {
  it("Spinner shows its label", () => {
    render(<Spinner label="Loading things" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading things");
  });
  it("ErrorNote renders nothing without an error", () => {
    const { container } = render(<ErrorNote error={null} />);
    expect(container.firstChild).toBeNull();
  });
});
