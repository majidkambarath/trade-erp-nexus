import React, { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import FilterBar, { FilterSelect } from "../FilterBar";

// The filter row the masters' lists share: a search, labelled choices, and a way back to everything.
function Harness({ onClear = vi.fn(), initial = { term: "", status: "" } }) {
  const [term, setTerm] = useState(initial.term);
  const [status, setStatus] = useState(initial.status);
  return (
    <FilterBar search={term} onSearch={setTerm} searchLabel="Search customers" placeholder="Search name or phone…" active={Boolean(term || status)} onClear={() => { setTerm(""); setStatus(""); onClear(); }}>
      <FilterSelect label="Status" value={status} onChange={setStatus} allLabel="All statuses" options={[["active", "Active"], { value: "inactive", label: "Inactive" }]} />
    </FilterBar>
  );
}

describe("FilterBar", () => {
  it("shows the search and each labelled choice without anything being pressed first", () => {
    render(<Harness />);
    expect(screen.getByRole("searchbox", { name: "Search customers" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeVisible();
    // "All statuses" is the first entry and means no filter
    expect(screen.getByRole("option", { name: "All statuses" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "Active" })).toHaveValue("active");
    expect(screen.getByRole("option", { name: "Inactive" })).toHaveValue("inactive");
  });

  it("offers Clear filters only while something is set, and clears all of it", () => {
    const onClear = vi.fn();
    render(<Harness onClear={onClear} />);
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), { target: { value: "inactive" } });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search customers" }), { target: { value: "noor" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("searchbox", { name: "Search customers" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("the cross inside the search empties only the search, and shows only when there is text", () => {
    render(<Harness initial={{ term: "", status: "active" }} />);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search customers" }), { target: { value: "gulf" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("searchbox", { name: "Search customers" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("active");
  });

  it("leaves the search out when the screen has none to offer", () => {
    render(
      <FilterBar>
        <FilterSelect label="Type" value="" onChange={() => {}} allLabel="All" options={[["a", "A"]]} />
      </FilterBar>
    );
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Type" })).toBeInTheDocument();
  });
});
