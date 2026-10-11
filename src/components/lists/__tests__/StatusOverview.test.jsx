import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import StatusOverview from "../StatusOverview";

const row = (label) => document.querySelector(`[data-overview-row="${label}"]`);

describe("the status overview", () => {
  const props = {
    noun: "order",
    document: { total: 4, rows: [{ label: "Draft", value: 1 }, { label: "Approved", value: 3 }] },
    payment: {
      base: 3, open: 5200,
      rows: [{ label: "Unpaid", value: 2 }, { label: "Partly paid", value: 1 }, { label: "Paid", value: 0 }, { label: "Past due", value: 1, amount: 4000 }],
    },
  };

  it("measures document status against every document and payment against the approved invoices only", () => {
    render(<StatusOverview {...props} />);
    // 3 of 4 documents are approved; 2 of the 3 approved invoices are unpaid: the two parts do not share a base
    expect(within(row("Approved")).getByText(/3 · 75%/)).toBeInTheDocument();
    expect(within(row("Draft")).getByText(/1 · 25%/)).toBeInTheDocument();
    expect(within(row("Unpaid")).getByText(/2 · 67%/)).toBeInTheDocument();
    expect(within(row("Partly paid")).getByText(/1 · 33%/)).toBeInTheDocument();
  });

  it("says how many approved invoices there are and what is still open", () => {
    render(<StatusOverview {...props} />);
    expect(screen.getByText("3 approved invoices")).toBeInTheDocument();
    expect(screen.getByText(/5,200\.00 still open/)).toBeInTheDocument();
  });

  it("shows the money past due", () => {
    render(<StatusOverview {...props} />);
    expect(within(row("Past due")).getByText(/4,000\.00/)).toBeInTheDocument();
  });

  it("says there is nothing to show before the first document, and shows no zero percentage of nothing", () => {
    render(<StatusOverview noun="purchase order" document={{ total: 0, rows: [{ label: "Draft", value: 0 }] }} payment={{ base: 0, open: 0, rows: [{ label: "Unpaid", value: 0 }] }} />);
    expect(screen.getByText(/Nothing to show until the first purchase order is created/)).toBeInTheDocument();
    expect(screen.getByText("no approved invoices yet")).toBeInTheDocument();
    expect(screen.queryByText(/still open/)).not.toBeInTheDocument();
    expect(within(row("Unpaid")).getByText(/0 · 0%/)).toBeInTheDocument();
  });
});
