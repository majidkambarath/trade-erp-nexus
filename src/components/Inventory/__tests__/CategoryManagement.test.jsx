import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// The category list: its search is always on the page (no Filters toggle), is sent once the person pauses, and is still there with
// a half-filled new-category form when they go to another page and come back (the screen's own session object used to throw on
// every read and write, so nothing was ever kept). Its empty state says whether nothing exists or nothing matches.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: api }));

import CategoryManagement from "../CategoryManagement";
import { clearPageSessions } from "../../../lib/pageSession";

const category = (name, extra = {}) => ({ _id: `c-${name}`, name, description: `${name} description`, status: "Active", createdAt: "2026-10-01T00:00:00.000Z", ...extra });
let all = [];
const LIMIT = 10;
const listCalls = () => api.get.mock.calls.filter((c) => c[0] === "/categories/categories").map((c) => c[1].params);
const lastList = () => listCalls()[listCalls().length - 1];

const show = () => render(<MemoryRouter><CategoryManagement /></MemoryRouter>);
const searchBox = () => screen.getByRole("searchbox", { name: "Search categories" });
const addButton = () => screen.getByRole("button", { name: /Add Category/ });
const nameBox = () => screen.getByPlaceholderText("Enter category name");
const descriptionBox = () => screen.getByPlaceholderText("Optional description...");

// An empty state drawn for even one commit is a claim made to the person, so every node added to the page is watched. `stop()`
// gives back the text of each node that was added and held `fragment`.
const watchDrawn = (fragment) => {
  const drawn = [];
  const watcher = new MutationObserver((records) => {
    for (const r of records) for (const n of r.addedNodes) if ((n.textContent || "").includes(fragment)) drawn.push(n.textContent);
  });
  watcher.observe(document.body, { childList: true, subtree: true });
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the observer's last batch arrive
    watcher.disconnect();
    return drawn;
  };
};

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
  api.put.mockReset();
  api.delete.mockReset();
  clearPageSessions();
  all = [category("Rice"), category("Spices"), category("Oils")];
  // a server that filters by name or description and pages, as the real one does
  api.get.mockImplementation(async (url, cfg) => {
    if (url === "/categories/categories") {
      const { page = 1, limit = LIMIT, search } = cfg.params;
      const wanted = search ? all.filter((c) => `${c.name} ${c.description}`.toLowerCase().includes(String(search).toLowerCase())) : all;
      return { data: { data: { categories: wanted.slice((page - 1) * limit, page * limit) }, total: wanted.length, totalPages: Math.ceil(wanted.length / limit) } };
    }
    if (url === "/categories/categories/stats") {
      return { data: { data: { stats: { totalCategories: all.length, activeCategories: all.length, inactiveCategories: 0 } } } };
    }
    return { data: { data: {} } };
  });
  api.post.mockResolvedValue({ data: { success: true } });
  api.put.mockResolvedValue({ data: { success: true } });
  api.delete.mockImplementation(async (url) => {
    const id = url.split("/").pop();
    all = all.filter((c) => c._id !== id);
    return { data: { success: true } };
  });
});

describe("the category filters", () => {
  it("are on the page without pressing anything first, and there is no Filters toggle or do-nothing back button", async () => {
    show();
    await screen.findByText("Rice");
    expect(searchBox()).toBeVisible();
    expect(screen.queryByRole("button", { name: /toggle filters/i })).not.toBeInTheDocument();
    expect(screen.queryByTitle("Toggle filters")).not.toBeInTheDocument();
    // the header offers the two things that work
    expect(screen.getByRole("button", { name: "Export to CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh data" })).toBeInTheDocument();
    expect(screen.getByText("Category Management").tagName).toBe("H1");
  });

  it("send the search once the person pauses, not on every key", async () => {
    show();
    await screen.findByText("Rice");
    const before = listCalls().length;
    fireEvent.change(searchBox(), { target: { value: "r" } });
    fireEvent.change(searchBox(), { target: { value: "ri" } });
    fireEvent.change(searchBox(), { target: { value: "ric" } });
    await waitFor(() => expect(lastList()).toMatchObject({ search: "ric" }));
    const sent = listCalls().slice(before).map((p) => p.search);
    expect(sent).toEqual(["ric"]);
  });

  it("are still there after going to another page and coming back, and the first request already carries them", async () => {
    const first = show();
    await screen.findByText("Rice");
    fireEvent.change(searchBox(), { target: { value: "rice" } });
    await waitFor(() => expect(lastList()).toMatchObject({ search: "rice" }));
    first.unmount();

    const asked = listCalls().length;
    show();
    expect(searchBox()).toHaveValue("rice");
    await screen.findByText("Rice");
    expect(listCalls()[asked]).toMatchObject({ search: "rice", page: 1 });
    expect(screen.queryByText("Spices")).not.toBeInTheDocument();
  });

  it("Clear filters empties the search, is offered only while one is set, and fetches everything again", async () => {
    show();
    await screen.findByText("Rice");
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
    fireEvent.change(searchBox(), { target: { value: "oil" } });
    const clear = await screen.findByRole("button", { name: "Clear filters" });
    await waitFor(() => expect(lastList()).toMatchObject({ search: "oil" }));
    expect(screen.queryByText("Rice")).not.toBeInTheDocument();
    fireEvent.click(clear);
    expect(searchBox()).toHaveValue("");
    await screen.findByText("Rice");
    expect(lastList().search).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("a new search starts at the first page, not on the page the person was on", async () => {
    all = [...Array.from({ length: 24 }, (_, i) => category(`Cat ${String(i + 1).padStart(2, "0")}`)), category("Rice")];
    show();
    await screen.findByText("Cat 01");
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    await screen.findByText("Cat 11");
    // 24 of the 25 match: page 2 of them exists, so only the reset puts the person back on the first
    fireEvent.change(searchBox(), { target: { value: "cat" } });
    expect(await screen.findByText("Cat 01")).toBeInTheDocument();
    expect(screen.queryByText("Cat 11")).not.toBeInTheDocument();
    expect(lastList()).toMatchObject({ search: "cat", page: 1 });
  });

  it("the footer counts what matched the search, not every category, and reaches pages past the fifth", async () => {
    all = [...Array.from({ length: 120 }, (_, i) => category(`Cat ${String(i + 1).padStart(3, "0")}`)), category("Rice")];
    show();
    await screen.findByText("Cat 001");
    // 10 a page: 13 pages, the last reachable by number (the old footer drew only 1 to 5)
    expect(screen.getByText("Showing 1 to 10 of 121 categories")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Page 13" }));
    await screen.findByText("Rice");
    expect(screen.getByText("Showing 121 to 121 of 121 categories")).toBeInTheDocument();
    // a search says how many it matched; the unfiltered 121 is not it
    fireEvent.change(searchBox(), { target: { value: "rice" } });
    expect(await screen.findByText("Showing 1 to 1 of 1 category")).toBeInTheDocument();
    expect(screen.queryByText(/of 121/)).not.toBeInTheDocument();
  });

  it("a search that leaves one page shows its rows, not an empty page 2", async () => {
    all = [...Array.from({ length: 24 }, (_, i) => category(`Cat ${String(i + 1).padStart(2, "0")}`)), category("Rice")];
    show();
    await screen.findByText("Cat 01");
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    await screen.findByText("Cat 11");
    fireEvent.change(searchBox(), { target: { value: "rice" } });
    expect(await screen.findByText("Rice")).toBeInTheDocument();
    expect(lastList()).toMatchObject({ search: "rice", page: 1 });
    expect(screen.queryByText(/No categories/)).not.toBeInTheDocument();
  });
});

describe("the empty state", () => {
  it("says there are none yet when there are none and nothing is filtered", async () => {
    all = [];
    show();
    expect(await screen.findByText("No categories yet")).toBeInTheDocument();
    expect(screen.getByText("Add a category to start the list.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear search and filters" })).not.toBeInTheDocument();
  });

  it("says nothing matches when a search finds nothing, and offers to clear it", async () => {
    show();
    await screen.findByText("Rice");
    fireEvent.change(searchBox(), { target: { value: "zzz" } });
    expect(await screen.findByText("No categories match the search or filters")).toBeInTheDocument();
    expect(screen.queryByText("No categories yet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(searchBox()).toHaveValue("");
    expect(await screen.findByText("Rice")).toBeInTheDocument();
    expect(screen.queryByText(/No categories/)).not.toBeInTheDocument();
  });

  it("does not claim there are none on the very first frame, before anything has been asked", () => {
    // rendered to a string: no effect has run, so this is exactly what is painted before the request goes out
    const html = renderToString(<MemoryRouter><CategoryManagement /></MemoryRouter>);
    expect(html).toContain("Loading categories...");
    expect(html).not.toContain("No categories yet");
  });

  it("does not claim there are none while the first answer is on its way", async () => {
    let release;
    api.get.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ data: { data: { categories: [category("Rice")] }, total: 1, totalPages: 1 } }); }));
    show();
    expect(screen.queryByText("No categories yet")).not.toBeInTheDocument();
    expect(screen.getByText("Loading categories...")).toBeInTheDocument();
    await waitFor(() => expect(release).toBeTypeOf("function"));
    release();
    expect(await screen.findByText("Rice")).toBeInTheDocument();
  });

  it("deleting the last row of the last page shows the page before it, not an empty list", async () => {
    all = Array.from({ length: 11 }, (_, i) => category(`Cat ${String(i + 1).padStart(2, "0")}`));
    show();
    await screen.findByText("Cat 01");
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    await screen.findByText("Cat 11");
    const stop = watchDrawn("No categories");
    fireEvent.click(screen.getByTitle("Delete Category"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Cat 01")).toBeInTheDocument();
    expect(await stop()).toEqual([]);
    expect(lastList()).toMatchObject({ page: 1 });
    expect(screen.queryByText("No categories yet")).not.toBeInTheDocument();
  });

  it("clearing a search that found nothing never flashes 'No categories yet' on the way back to the full list", async () => {
    show();
    await screen.findByText("Rice");
    fireEvent.change(searchBox(), { target: { value: "zzz" } });
    await screen.findByText("No categories match the search or filters");
    const stop = watchDrawn("No categories yet");
    fireEvent.click(screen.getByRole("button", { name: "Clear search and filters" }));
    expect(await screen.findByText("Rice")).toBeInTheDocument();
    expect(await stop()).toEqual([]);
  });
});

describe("the new-category form is kept as a draft", () => {
  it("is restored after going to another page and coming back", async () => {
    const first = show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    fireEvent.change(nameBox(), { target: { value: "Pulses" } });
    fireEvent.change(descriptionBox(), { target: { value: "Dal and beans" } });
    // the form says it is saved once it has been still for two seconds
    expect(await screen.findByText("Changes saved automatically", {}, { timeout: 4000 })).toBeInTheDocument();
    first.unmount();

    show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    expect(nameBox()).toHaveValue("Pulses");
    expect(descriptionBox()).toHaveValue("Dal and beans");
    expect(screen.getByText(/Draft saved/)).toBeInTheDocument();
  }, 10000);

  it("is kept even when the person leaves inside the two seconds", async () => {
    const first = show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    fireEvent.change(nameBox(), { target: { value: "Pulses" } });
    first.unmount();

    show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    expect(nameBox()).toHaveValue("Pulses");
  });

  it("is not kept when nothing was put in it", async () => {
    const first = show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    first.unmount();

    show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    expect(nameBox()).toHaveValue("");
    expect(screen.queryByText(/Draft saved/)).not.toBeInTheDocument();
  });

  it("is gone after it is saved, and the saved category is what was in the form", async () => {
    const first = show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    fireEvent.change(nameBox(), { target: { value: "Pulses" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Category/ }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/categories/categories", { name: "Pulses", description: "", status: "Active" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    first.unmount();

    show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    expect(nameBox()).toHaveValue("");
  });

  it("is gone after Cancel", async () => {
    const first = show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    fireEvent.change(nameBox(), { target: { value: "Pulses" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    expect(nameBox()).toHaveValue("");
  });

  it("is kept when the save fails, so nothing typed is lost", async () => {
    api.post.mockRejectedValueOnce({ response: { data: { message: "Category name already exists" } } });
    const first = show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    fireEvent.change(nameBox(), { target: { value: "Rice" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Category/ }));
    expect(await screen.findByText("Category name already exists")).toBeInTheDocument();
    first.unmount();

    show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    expect(nameBox()).toHaveValue("Rice");
  });

  it("never comes back from an edit: an edited category is not offered later as a new one", async () => {
    const first = show();
    await screen.findByText("Rice");
    fireEvent.click(screen.getAllByTitle("Edit Category")[0]);
    expect(nameBox()).toHaveValue("Rice");
    fireEvent.change(descriptionBox(), { target: { value: "changed but not saved" } });
    // longer than the two seconds the form takes to say "saved" in the add form: an edit never says it
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2300));
    });
    expect(screen.queryByText("Changes saved automatically")).not.toBeInTheDocument();
    first.unmount();

    show();
    await screen.findByText("Rice");
    fireEvent.click(addButton());
    expect(nameBox()).toHaveValue("");
    expect(descriptionBox()).toHaveValue("");
  }, 10000);
});
