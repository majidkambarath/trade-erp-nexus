import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DataTable } from "../DataTable";
import { Pill } from "../kit";

// DataTable renders ONE of its two shapes, chosen by a live media query, so a 200-row list
// never builds both. jsdom has no matchMedia, and the component treats its absence as a wide
// screen - which is why the app's other suites still see tables. These tests stub it to pick
// a shape, then assert the mapping: which column lands where on a card, and that a card's own
// buttons stay reachable past its tap overlay.
const viewport = (wide) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: wide,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

afterEach(() => {
  delete window.matchMedia;
});

const ROWS = [
  { _id: "1", no: "SO-2026-0042", party: "Al Noor Trading", date: "05 Oct 2026", amount: "12,480.00", status: "Approved" },
  { _id: "2", no: "SO-2026-0041", party: "Gulf Fresh Foods", date: "04 Oct 2026", amount: "3,200.00", status: "Draft" },
];

const columns = (extra = []) => [
  { key: "no", header: "Number", card: "primary", cell: (r) => r.no },
  { key: "party", header: "Party", card: "title", cell: (r) => r.party },
  { key: "date", header: "Date", card: "meta", cell: (r) => r.date },
  { key: "status", header: "Status", card: "badge", cell: (r) => <Pill>{r.status}</Pill> },
  { key: "amount", header: "Amount", align: "end", card: "amount", cell: (r) => r.amount },
  ...extra,
];

const draw = (props = {}, wide = false) => {
  viewport(wide);
  return render(
    <MemoryRouter>
      <DataTable columns={columns()} rows={ROWS} caption="Sales orders" {...props} />
    </MemoryRouter>
  );
};

const cards = () => screen.getByRole("list", { name: "Sales orders" });
const cardRows = () => within(cards()).getAllByRole("listitem");

describe("DataTable: choosing a shape", () => {
  it("is a real table on a wide screen, with a header per column", () => {
    draw({}, true);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual([
      "Number",
      "Party",
      "Date",
      "Status",
      "Amount",
    ]);
    expect(within(table).getAllByRole("row")).toHaveLength(3); // header + 2
  });

  it("builds no cards on a wide screen", () => {
    draw({}, true);
    expect(screen.queryByRole("list", { name: "Sales orders" })).toBeNull();
  });

  it("builds no table on a narrow one", () => {
    draw({}, false);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("treats a browser with no matchMedia as a wide one, so it degrades to the table", () => {
    delete window.matchMedia;
    render(
      <MemoryRouter>
        <DataTable columns={columns()} rows={ROWS} caption="Sales orders" />
      </MemoryRouter>
    );
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("renders nothing at all for an empty list, leaving the page's own empty state to speak", () => {
    viewport(false);
    const { container } = render(
      <MemoryRouter>
        <DataTable columns={columns()} rows={[]} caption="Sales orders" />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DataTable: the card shape", () => {
  it("gives every row a card", () => {
    draw();
    expect(cardRows()).toHaveLength(2);
  });

  it("puts the tagged columns in their places and drops no content", () => {
    draw();
    const card = cardRows()[0];
    expect(within(card).getByText("SO-2026-0042")).toBeTruthy();
    expect(within(card).getByText("Al Noor Trading")).toBeTruthy();
    expect(within(card).getByText("05 Oct 2026")).toBeTruthy();
    expect(within(card).getByText("Approved")).toBeTruthy();
    expect(within(card).getByText("12,480.00")).toBeTruthy();
  });

  it("omits a column tagged hidden from the card", () => {
    draw({
      columns: columns([
        { key: "ref", header: "Internal ref", card: "hidden", cell: () => "INT-900" },
      ]),
    });
    expect(within(cards()).queryByText("INT-900")).toBeNull();
  });

  it("keeps a column tagged hidden in the table, where there is room for it", () => {
    draw(
      {
        columns: columns([
          { key: "ref", header: "Internal ref", card: "hidden", cell: () => "INT-900" },
        ]),
      },
      true
    );
    expect(within(screen.getByRole("table")).getAllByText("INT-900")).toHaveLength(ROWS.length);
  });

  it("shows an untagged column as a labelled line, so wrapping a table loses nothing", () => {
    draw({ columns: columns([{ key: "terms", header: "Terms", cell: () => "30 days" }]) });
    const card = cardRows()[0];
    expect(within(card).getByText("Terms")).toBeTruthy();
    expect(within(card).getByText("30 days")).toBeTruthy();
  });

  it("leaves out a labelled line that has no value, rather than printing an empty row", () => {
    draw({
      columns: columns([
        { key: "terms", header: "Terms", cell: (r) => (r._id === "1" ? "30 days" : "") },
      ]),
    });
    expect(within(cardRows()[0]).queryByText("Terms")).toBeTruthy();
    expect(within(cardRows()[1]).queryByText("Terms")).toBeNull();
  });

  it("falls back to the first untagged column for the headline, without printing it twice", () => {
    viewport(false);
    render(
      <MemoryRouter>
        <DataTable
          caption="Sales orders"
          rows={ROWS}
          columns={[
            { key: "no", header: "Number", cell: (r) => r.no },
            { key: "party", header: "Party", cell: (r) => r.party },
          ]}
        />
      </MemoryRouter>
    );
    const card = cardRows()[0];
    expect(within(card).getAllByText("SO-2026-0042")).toHaveLength(1);
    expect(within(card).queryByText("Number")).toBeNull();
  });
});

describe("DataTable: opening a row", () => {
  it("makes the whole card a link when the row has a page of its own", () => {
    draw({ rowHref: (r) => `/sales-order/${r._id}` });
    expect(within(cardRows()[0]).getByRole("link").getAttribute("href")).toBe("/sales-order/1");
  });

  it("makes the whole card a button when opening the row is an action, not a route", () => {
    const onRowClick = vi.fn();
    draw({ onRowClick });
    fireEvent.click(within(cardRows()[1]).getByRole("button", { name: "Open" }));
    expect(onRowClick).toHaveBeenCalledWith(ROWS[1]);
  });

  it("opens the row from the table too, where the whole row is the target", () => {
    const onRowClick = vi.fn();
    draw({ onRowClick }, true);
    fireEvent.click(within(screen.getByRole("table")).getAllByRole("row")[1]);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it("keeps a card's own buttons clickable past the tap overlay", () => {
    const onDelete = vi.fn();
    draw({
      onRowClick: vi.fn(),
      columns: columns([
        {
          key: "actions",
          header: "",
          card: "actions",
          cell: (r) => (
            <button type="button" onClick={() => onDelete(r._id)}>
              Delete
            </button>
          ),
        },
      ]),
    });
    fireEvent.click(within(cardRows()[0]).getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("does not deaden its cells when the row opens nowhere", () => {
    draw();
    // pointer-events-none exists only to let a tap fall through to the overlay behind it
    expect(cardRows()[0].querySelector(".pointer-events-none")).toBeNull();
  });
});
