import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// A characterization suite written before converting this screen onto the shared kit (no test existed for
// it at all) - it pins today's actual behaviour (including two real bugs found while reading the source:
// `rowKey={(unit) => unit.id}` on a document whose id field is `_id`, so every row shared the same React key;
// and the optimistic post-create/update append pushed the WHOLE axios response wrapper, not response.data,
// onto the list - both masked in practice by the full refetch that follows on the same success path, so
// nothing visible here depends on either) so the conversion can be checked against it rather than against
// assumption.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: api }));

import UnitOfMeasure from "../UnitOfMeasure";

const unit = (unitName, extra = {}) => ({ _id: `u-${unitName}`, unitName, shortCode: unitName.slice(0, 2).toLowerCase(), type: "Base", category: "Weight", status: "Active", ...extra });
const conv = (from, to, ratio, extra = {}) => ({
  _id: `c-${from._id}-${to._id}`,
  fromUOM: { _id: from._id, unitName: from.unitName },
  toUOM: { _id: to._id, unitName: to.unitName },
  conversionRatio: ratio,
  category: "Weight",
  status: "Active",
  ...extra,
});

let allUnits = [];
let allConversions = [];
const show = () => render(<MemoryRouter><UnitOfMeasure /></MemoryRouter>);
const searchBox = (placeholder) => screen.getByPlaceholderText(placeholder);
const unitsCalls = () => api.get.mock.calls.filter((c) => c[0] === "/uom/units").length;

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
  const kg = unit("Kilogram", { shortCode: "kg" });
  const g = unit("Gram", { shortCode: "g", type: "Derived" });
  allUnits = [kg, g];
  allConversions = [conv(kg, g, 1000)];
  api.get.mockImplementation(async (url) => {
    if (url === "/uom/units") return { data: { success: true, count: allUnits.length, data: allUnits } };
    if (url === "/uom/conversions") return { data: { success: true, count: allConversions.length, data: allConversions } };
    return { data: { data: [] } };
  });
  api.post.mockImplementation(async (url, body) => {
    if (url === "/uom/units") return { data: { success: true, data: { _id: "new-unit", ...body } } };
    if (url === "/uom/conversions") return { data: { success: true, data: { _id: "new-conv", ...body } } };
    throw new Error(`unexpected POST ${url}`);
  });
  api.put.mockImplementation(async (url, body) => ({ data: { success: true, data: { _id: url.split("/").pop(), ...body } } }));
  api.delete.mockImplementation(async () => ({ data: { success: true } }));
});

describe("Unit Setup (the default tab)", () => {
  it("shows the stats, the search box and both units, and the Conversion tab is not drawn yet", async () => {
    show();
    expect(await screen.findByText("Kilogram")).toBeInTheDocument();
    expect(screen.getByText("Gram")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search units...")).toBeVisible();
    expect(screen.getByRole("button", { name: /Add Unit/ })).toBeVisible();
    expect(screen.queryByText("1 : 1000")).not.toBeInTheDocument();
  });

  it("filters client-side as you type - no extra request is sent for a search", async () => {
    show();
    await screen.findByText("Kilogram");
    const before = unitsCalls();
    // "kilo" is NOT a substring of "Gram" - unlike "gram" itself, which IS a substring of "Kilogram" and so
    // would match both and prove nothing about filtering actually excluding a row
    fireEvent.change(searchBox("Search units..."), { target: { value: "kilo" } });
    expect(screen.queryByText("Gram")).not.toBeInTheDocument();
    expect(screen.getByText("Kilogram")).toBeInTheDocument();
    expect(unitsCalls()).toBe(before); // filtered in the browser, not asked of the server again
  });

  it("matches by short code and by category too", async () => {
    show();
    await screen.findByText("Kilogram");
    fireEvent.change(searchBox("Search units..."), { target: { value: "kg" } });
    expect(screen.getByText("Kilogram")).toBeInTheDocument();
    expect(screen.queryByText("Gram")).not.toBeInTheDocument();
  });

  it("says so when there are none at all", async () => {
    allUnits = [];
    show();
    expect(await screen.findByText("No units added yet.")).toBeInTheDocument();
  });

  it("adds a unit: validates required fields, then posts and refetches", async () => {
    show();
    await screen.findByText("Kilogram");
    fireEvent.click(screen.getByRole("button", { name: /Add Unit/ }));
    expect(screen.getByText("Add New Unit")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create Unit/ }));
    expect(await screen.findByText("Unit name is required")).toBeInTheDocument();
    expect(screen.getByText("Short code is required")).toBeInTheDocument();
    expect(screen.getByText("Category is required")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Enter unit name (e.g., Kilogram)"), { target: { value: "Tonne" } });
    fireEvent.change(screen.getByPlaceholderText("e.g., kg"), { target: { value: "t" } });
    fireEvent.change(screen.getByLabelText(/Category/), { target: { value: "Weight" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Unit/ }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/uom/units", { unitName: "Tonne", shortCode: "t", type: "Base", category: "Weight", status: "Active" }));
    expect(await screen.findByText("Unit created successfully!")).toBeInTheDocument();
    expect(screen.queryByText("Add New Unit")).not.toBeInTheDocument();
  });

  it("edits a unit: the form opens filled in, and Update sends a PUT", async () => {
    show();
    await screen.findByText("Kilogram");
    fireEvent.click(screen.getByRole("button", { name: "Edit Kilogram" }));
    expect(screen.getByText("Edit Unit")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter unit name (e.g., Kilogram)")).toHaveValue("Kilogram");
    expect(screen.getByPlaceholderText("e.g., kg")).toHaveValue("kg");

    fireEvent.change(screen.getByPlaceholderText("e.g., kg"), { target: { value: "KG" } });
    fireEvent.click(screen.getByRole("button", { name: /Update Unit/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith("/uom/units/u-Kilogram", expect.objectContaining({ shortCode: "KG" })));
    expect(await screen.findByText("Unit updated successfully!")).toBeInTheDocument();
  });

  it("deletes a unit after confirming, and never without confirming", async () => {
    show();
    await screen.findByText("Kilogram");
    fireEvent.click(screen.getByRole("button", { name: "Delete Kilogram" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete Unit")).toBeInTheDocument();
    expect(within(dialog).getByText(/"Kilogram"\?/)).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/uom/units/u-Kilogram"));
    expect(await screen.findByText("Unit deleted successfully!")).toBeInTheDocument();
  });

  it("Cancel on the add form closes it without posting anything", async () => {
    show();
    await screen.findByText("Kilogram");
    fireEvent.click(screen.getByRole("button", { name: /Add Unit/ }));
    fireEvent.change(screen.getByPlaceholderText("Enter unit name (e.g., Kilogram)"), { target: { value: "Tonne" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});

describe("Conversion Logic", () => {
  const openConversions = async () => {
    show();
    await screen.findByText("Kilogram");
    fireEvent.click(screen.getByRole("button", { name: /Conversion Logic/ }));
    await screen.findByText("1 : 1000");
  };

  it("lists the existing conversions, and the units tab's rows are gone", async () => {
    await openConversions();
    expect(screen.getByText("Kilogram")).toBeInTheDocument(); // the From column
    expect(screen.getByText("Gram")).toBeInTheDocument(); // the To column
    expect(screen.getByPlaceholderText("Search conversions...")).toBeVisible();
  });

  it("says so when there are none at all", async () => {
    allConversions = [];
    show();
    await screen.findByText("Kilogram");
    fireEvent.click(screen.getByRole("button", { name: /Conversion Logic/ }));
    expect(await screen.findByText("No conversions added yet.")).toBeInTheDocument();
  });

  it("adds a conversion: both UOM pickers are offered from the units list, and ratio/sameness are validated", async () => {
    await openConversions();
    fireEvent.click(screen.getByRole("button", { name: /Add Conversion/ }));
    expect(screen.getByText("Add New Conversion")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create Conversion/ }));
    // blank fromUOM and toUOM are also EQUAL ("" === ""), so the sameness check (which runs after the
    // required checks and unconditionally overwrites toUOM's message) wins over "To UOM is required" here -
    // the required message for toUOM alone is covered separately below, by leaving only it blank
    expect(await screen.findByText("From UOM is required")).toBeInTheDocument();
    expect(screen.getByText("From and To UOMs cannot be the same")).toBeInTheDocument();
    expect(screen.getByText("Valid conversion ratio is required")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/From UOM/), { target: { value: "u-Kilogram" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Conversion/ }));
    expect(await screen.findByText("To UOM is required")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/From UOM/), { target: { value: "u-Kilogram" } });
    fireEvent.change(screen.getByLabelText(/To UOM/), { target: { value: "u-Kilogram" } });
    fireEvent.change(screen.getByPlaceholderText("e.g., 1000"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Conversion/ }));
    expect(await screen.findByText("From and To UOMs cannot be the same")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/To UOM/), { target: { value: "u-Gram" } });
    fireEvent.change(screen.getByPlaceholderText("e.g., 1000"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Conversion/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/uom/conversions", expect.objectContaining({ fromUOM: "u-Kilogram", toUOM: "u-Gram", conversionRatio: 500 }))
    );
    expect(await screen.findByText("Conversion created successfully!")).toBeInTheDocument();
  });

  it("edits a conversion: the form opens with both UOMs and the ratio filled in", async () => {
    await openConversions();
    fireEvent.click(screen.getByRole("button", { name: "Edit conversion" }));
    expect(screen.getByText("Edit Conversion")).toBeInTheDocument();
    expect(screen.getByLabelText(/From UOM/)).toHaveValue("u-Kilogram");
    expect(screen.getByLabelText(/To UOM/)).toHaveValue("u-Gram");
    expect(screen.getByPlaceholderText("e.g., 1000")).toHaveValue(1000);

    fireEvent.change(screen.getByPlaceholderText("e.g., 1000"), { target: { value: "1001" } });
    fireEvent.click(screen.getByRole("button", { name: /Update Conversion/ }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith(`/uom/conversions/${allConversions[0]._id}`, expect.objectContaining({ conversionRatio: 1001 })));
  });

  it("deletes a conversion after confirming", async () => {
    await openConversions();
    fireEvent.click(screen.getByRole("button", { name: "Delete conversion" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete Conversion")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`/uom/conversions/${allConversions[0]._id}`));
    expect(await screen.findByText("Conversion deleted successfully!")).toBeInTheDocument();
  });
});

describe("failures are reported, not swallowed", () => {
  it("a failed create keeps the form open and shows the server's message", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: "Unit name already exists" } } });
    show();
    await screen.findByText("Kilogram");
    fireEvent.click(screen.getByRole("button", { name: /Add Unit/ }));
    fireEvent.change(screen.getByPlaceholderText("Enter unit name (e.g., Kilogram)"), { target: { value: "Kilogram" } });
    fireEvent.change(screen.getByPlaceholderText("e.g., kg"), { target: { value: "kg" } });
    fireEvent.change(screen.getByLabelText(/Category/), { target: { value: "Weight" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Unit/ }));
    expect(await screen.findByText("Unit name already exists")).toBeInTheDocument();
    expect(screen.getByText("Add New Unit")).toBeInTheDocument(); // still open, nothing typed is lost
  });
});
