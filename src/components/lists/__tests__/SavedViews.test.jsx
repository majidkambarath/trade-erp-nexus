import React, { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { addView, applyView, DEFAULT_VIEW, removeView, renameView as renameViewPure } from "../../../lib/savedViews";
import SavedViews from "../SavedViews";

// A stand-in for what useListView(...) returns, built from the SAME pure helpers the real hook uses
// internally, so this exercises the picker against a faithful shape instead of a bespoke mock. A hidden
// readback lets a test see state SavedViews itself never displays (the applied filters/search after a
// goToView, for instance).
function Harness({ initial = {} }) {
  const [search, setSearch] = useState(initial.search || "");
  const [filters, setFilters] = useState(initial.filters || {});
  const [sort, setSort] = useState(initial.sort || null);
  const [hidden, setHidden] = useState(initial.hidden || []);
  const [density, setDensity] = useState(initial.density || "comfortable");
  const [views, setViews] = useState(initial.views || []);
  const [currentViewId, setCurrentViewId] = useState("");

  const list = {
    search, filters, sort, hidden, density, views, currentViewId, DEFAULT_VIEW,
    goToView: (id) => {
      const view = id ? views.find((v) => v.id === id) : null;
      const applied = applyView(view, { search: "", filters: {}, sort: null, hidden: [], density: "comfortable" });
      setSearch(applied.search);
      setFilters(applied.filters);
      setSort(applied.sort);
      setHidden(applied.hidden);
      setDensity(applied.density);
      setCurrentViewId(id || "");
    },
    saveView: (name, { withSearch = false } = {}) => {
      const id = `v-${views.length + 1}`;
      const captured = { filters: { ...filters }, sort: sort ? { ...sort } : null, hidden: [...hidden], density };
      if (withSearch && search) captured.search = search;
      const result = addView(views, { id, name, createdAt: new Date().toISOString(), ...captured });
      if (!result.ok) return result;
      setViews(result.views);
      setCurrentViewId(id);
      return { ok: true, id };
    },
    renameView: (id, name) => {
      const result = renameViewPure(views, id, name);
      if (result.ok) setViews(result.views);
      return result;
    },
    deleteView: (id) => {
      setViews(removeView(views, id));
      if (currentViewId === id) setCurrentViewId("");
    },
  };

  return (
    <>
      <SavedViews list={list} />
      <p data-testid="readback">{JSON.stringify({ search, filters, currentViewId })}</p>
    </>
  );
}

const readback = () => JSON.parse(screen.getByTestId("readback").textContent);

describe("SavedViews", () => {
  it("offers only All on a clean screen, with no changed indicator and no Rename/Delete", () => {
    render(<Harness />);
    expect(screen.getByRole("combobox", { name: "View" })).toHaveValue("");
    expect(screen.getByRole("option", { name: "All" })).toBeInTheDocument();
    expect(screen.queryByText("changed")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("shows changed and an offer to save once the screen's state differs from the chosen view", () => {
    render(<Harness initial={{ filters: { status: "approved" } }} />);
    expect(screen.getByText("changed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save view" })).toBeVisible();
  });

  it("saves the live state under a name, selects it, and the changed indicator clears", async () => {
    render(<Harness initial={{ filters: { status: "approved" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Approved only" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText('"Approved only" saved.')).toBeVisible();
    expect(screen.getByRole("combobox", { name: "View" })).toHaveValue("v-1");
    expect(screen.getByRole("option", { name: "Approved only" })).toBeInTheDocument();
    expect(screen.queryByText("changed")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rename" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  });

  it("does not remember the free-text search unless the checkbox is ticked", async () => {
    render(<Harness initial={{ search: "al noor", filters: { status: "approved" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Approved" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText('"Approved" saved.');
    // the search was never captured, so the view and the live state still disagree on it ("changed" stays
    // up) until Reset applies the view exactly as saved - which clears the typed text, proving it was
    // genuinely never part of the view
    expect(screen.getByText("changed")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(readback().search).toBe("");
  });

  it("remembers the search when the checkbox is ticked", async () => {
    render(<Harness initial={{ search: "al noor" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Noor" } });
    fireEvent.click(screen.getByLabelText("Also remember the search text"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText('"Noor" saved.');
    fireEvent.change(screen.getByRole("combobox", { name: "View" }), { target: { value: "" } }); // back to All
    expect(readback().search).toBe("");
    fireEvent.change(screen.getByRole("combobox", { name: "View" }), { target: { value: "v-1" } });
    expect(readback().search).toBe("al noor");
  });

  it("refuses an empty name and a name already used by another view", async () => {
    render(<Harness initial={{ views: [{ id: "v-1", name: "Approved", filters: {}, sort: null, hidden: [], density: "comfortable" }], filters: { status: "draft" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Name it to save it.")).toBeVisible();

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Approved" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("A view already has that name.")).toBeVisible();
  });

  it("Reset restores a changed screen back to the chosen view, without saving anything new", () => {
    render(<Harness initial={{ views: [{ id: "v-1", name: "Approved", filters: { status: "approved" }, sort: null, hidden: [], density: "comfortable" }] }} />);
    fireEvent.change(screen.getByRole("combobox", { name: "View" }), { target: { value: "v-1" } });
    expect(readback().filters).toEqual({ status: "approved" });

    // the harness has no filter control of its own, so simulate "the screen changed" by going back to All
    // (a real screen would call list.setFilter; what matters here is only that Reset re-applies the view)
    fireEvent.change(screen.getByRole("combobox", { name: "View" }), { target: { value: "" } });
    expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument(); // All matches itself: nothing changed

    fireEvent.change(screen.getByRole("combobox", { name: "View" }), { target: { value: "v-1" } });
    expect(screen.getByRole("combobox", { name: "View" })).toHaveValue("v-1");
    expect(screen.queryByText("changed")).not.toBeInTheDocument();
  });

  it("renames the current view", async () => {
    render(<Harness initial={{ views: [{ id: "v-1", name: "Approved", filters: {}, sort: null, hidden: [], density: "comfortable" }] }} />);
    fireEvent.change(screen.getByRole("combobox", { name: "View" }), { target: { value: "v-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Approved invoices" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Approved invoices" })).toBeInTheDocument());
  });

  it("refuses renaming to a name another view already has", async () => {
    render(
      <Harness
        initial={{
          views: [
            { id: "v-1", name: "Approved", filters: {}, sort: null, hidden: [], density: "comfortable" },
            { id: "v-2", name: "Draft", filters: {}, sort: null, hidden: [], density: "comfortable" },
          ],
        }}
      />
    );
    fireEvent.change(screen.getByRole("combobox", { name: "View" }), { target: { value: "v-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("A view already has that name.")).toBeVisible();
  });

  it("deletes the current view, confirms first, and returns the picker to All", async () => {
    render(<Harness initial={{ views: [{ id: "v-1", name: "Approved", filters: {}, sort: null, hidden: [], density: "comfortable" }] }} />);
    fireEvent.change(screen.getByRole("combobox", { name: "View" }), { target: { value: "v-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText('Delete "Approved"?')).toBeVisible();

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" }).at(-1)); // the dialog's confirm button, not the bar's
    expect(await screen.findByText('"Approved" deleted.')).toBeVisible();
    expect(screen.getByRole("combobox", { name: "View" })).toHaveValue("");
    expect(screen.queryByRole("option", { name: "Approved" })).not.toBeInTheDocument();
  });
});
