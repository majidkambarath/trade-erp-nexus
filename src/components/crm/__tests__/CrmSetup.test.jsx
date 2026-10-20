// The Setup screen's behaviour: what a person sees and can do. A real pointer drag cannot be simulated in jsdom (no
// layout), so reordering is driven through the Move up / Move down buttons, which end in the same `onReorder` a drag ends in.
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ stages: vi.fn(), saveStages: vi.fn(), settings: vi.fn(), saveSettings: vi.fn(), owners: vi.fn(), grants: { allow: () => true } }));
vi.mock("../../../lib/crmApi", () => ({
  crm: { stages: m.stages, saveStages: m.saveStages, settings: m.settings, saveSettings: m.saveSettings, owners: m.owners },
  CRM_WORK_CHANGED: "crm-work-changed",
  announceCrmWorkChanged: () => {},
}));
vi.mock("../../shell/OrganisationContext.jsx", () => ({
  useOrganisation: () => ({ can: (k) => m.grants.allow(k), canAny: (ks) => [].concat(ks || []).some((k) => m.grants.allow(k)), me: { id: "u1", name: "Asif" } }),
}));

const CrmSetup = (await import("../CrmSetup.jsx")).default;

const stage = (over) => ({ key: "", name: "", order: 1, probability: 10, advanceOn: null, followUpDays: 1, staleDays: 7, type: "open", ...over });
const STAGES = [
  stage({ key: "new", name: "New", order: 1, probability: 10 }),
  stage({ key: "quoted", name: "Quotation sent", order: 2, probability: 50, advanceOn: "quotation_sent", followUpDays: 3, staleDays: 14 }),
  stage({ key: "won", name: "Won", order: 3, probability: 100, advanceOn: "invoice_approved", followUpDays: 0, staleDays: 0, type: "won" }),
  stage({ key: "lost", name: "Lost", order: 4, probability: 0, followUpDays: 0, staleDays: 0, type: "lost" }),
];
const SETTINGS = { autoAdvance: true, autoFollowUp: true, assignmentMode: "round_robin", fixedOwnerId: null, uncontactedHours: 24, staleDays: 14, quotationExpiryDays: 3, lastAssignedOwnerId: null };

const show = () => render(<MemoryRouter><CrmSetup /></MemoryRouter>);
const names = () => screen.getAllByLabelText(/^Name/).map((i) => i.value);
const strip = () => screen.getByRole("navigation", { name: "The pipeline at a glance" });
const unsaved = () => screen.queryByRole("region", { name: "Unsaved changes" });
const open = async () => {
  show();
  await screen.findAllByLabelText(/^Name/);
};

beforeEach(() => {
  for (const key of ["stages", "saveStages", "settings", "saveSettings", "owners"]) m[key].mockReset();
  m.grants.allow = () => true;
  m.stages.mockResolvedValue(STAGES.map((s) => ({ ...s })));
  m.settings.mockResolvedValue({ ...SETTINGS });
  m.owners.mockResolvedValue([{ id: "u1", name: "Asif" }]);
  m.saveStages.mockImplementation(async (body) => body);
  m.saveSettings.mockImplementation(async (body) => ({ ...body, lastAssignedOwnerId: null }));
});

describe("the pipeline at a glance", () => {
  it("draws every stage in order, and marks the ones a document moves a deal into", async () => {
    await open();
    const chips = within(strip()).getAllByRole("button");
    expect(chips.map((c) => c.textContent.replace(/\d+%/, "").trim())).toEqual(["New", "Quotation sent", "Won", "Lost"]);
    expect(within(chips[1]).getByLabelText("moves by itself")).toBeInTheDocument();
    expect(within(chips[0]).queryByLabelText("moves by itself")).toBeNull();
    expect(within(chips[2]).getByLabelText("won")).toBeInTheDocument();
    expect(within(chips[3]).getByLabelText("lost")).toBeInTheDocument();
  });

  it("redraws as a stage is renamed, before anything is saved", async () => {
    await open();
    fireEvent.change(screen.getAllByLabelText(/^Name/)[0], { target: { value: "Fresh enquiry" } });
    expect(within(strip()).getByRole("button", { name: /Fresh enquiry/ })).toBeInTheDocument();
    expect(within(strip()).queryByRole("button", { name: /^New/ })).toBeNull();
    expect(m.saveStages).not.toHaveBeenCalled();
  });

  it("tapping a stage in the strip takes you to its name", async () => {
    await open();
    fireEvent.click(within(strip()).getByRole("button", { name: /Quotation sent/ }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByLabelText(/^Name/)[1]));
  });
});

describe("a stage is one line, with its timing a tap away", () => {
  it("says what the timing means in words, and keeps the fields shut until asked", async () => {
    await open();
    const timing = screen.getAllByRole("button", { name: /Follow-up in|Closed as/ });
    expect(timing[1]).toHaveTextContent("Follow-up in 3 days · quiet after 14 days");
    expect(timing[1]).toHaveAttribute("aria-expanded", "false");
    // Shut means shut: the fields behind it cannot be tabbed into.
    const panel = document.getElementById(timing[1].getAttribute("aria-controls"));
    expect(panel.closest("[inert]")).not.toBeNull();
    fireEvent.click(timing[1]);
    expect(timing[1]).toHaveAttribute("aria-expanded", "true");
    expect(panel.closest("[inert]")).toBeNull();
    expect(within(panel).getByLabelText(/^Next follow-up in/)).toHaveValue(3);
  });

  it("a closed stage has nothing to chase, so its timing is switched off and says why", async () => {
    await open();
    const won = screen.getAllByRole("button", { name: /Closed as won/ })[0];
    fireEvent.click(won);
    const panel = document.getElementById(won.getAttribute("aria-controls"));
    expect(within(panel).getByLabelText(/^Next follow-up in/)).toBeDisabled();
    expect(within(panel).getByLabelText(/^Call it quiet after/)).toBeDisabled();
    expect(within(panel).getByText("A closed stage has nothing to chase")).toBeInTheDocument();
  });
});

describe("knowing when something has changed", () => {
  const edit = () => fireEvent.change(screen.getAllByLabelText(/^Name/)[0], { target: { value: "Fresh enquiry" } });

  it("says nothing while nothing has changed, then says so on a bar with Discard and Save", async () => {
    await open();
    expect(unsaved()).toBeNull();
    edit();
    const bar = unsaved();
    expect(bar).not.toBeNull();
    expect(within(bar).getByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(within(bar).getByRole("button", { name: "Save the pipeline" })).toBeInTheDocument();
  });

  it("changing something and changing it back is not a change", async () => {
    await open();
    edit();
    expect(unsaved()).not.toBeNull();
    fireEvent.change(screen.getAllByLabelText(/^Name/)[0], { target: { value: "New" } });
    expect(unsaved()).toBeNull();
  });

  it("Discard puts everything back and the bar goes", async () => {
    await open();
    edit();
    fireEvent.click(within(unsaved()).getByRole("button", { name: "Discard" }));
    expect(names()).toEqual(["New", "Quotation sent", "Won", "Lost"]);
    expect(unsaved()).toBeNull();
    expect(m.saveStages).not.toHaveBeenCalled();
  });

  it("Save sends the pipeline in the order shown and the bar goes", async () => {
    await open();
    edit();
    fireEvent.click(within(unsaved()).getByRole("button", { name: "Save the pipeline" }));
    await waitFor(() => expect(m.saveStages).toHaveBeenCalled());
    expect(m.saveStages.mock.calls[0][0].map((s) => [s.name, s.order])).toEqual([["Fresh enquiry", 1], ["Quotation sent", 2], ["Won", 3], ["Lost", 4]]);
    await waitFor(() => expect(unsaved()).toBeNull());
    expect(await screen.findByText("The pipeline is saved")).toBeInTheDocument();
  });

  it("a refusal from the server is written ON the bar, and the edits are kept", async () => {
    m.saveStages.mockRejectedValue(new Error("2 open deals are on \"New\". Move them to another stage before removing it."));
    await open();
    edit();
    fireEvent.click(within(unsaved()).getByRole("button", { name: "Save the pipeline" }));
    expect(await within(unsaved()).findByText(/2 open deals are on/)).toBeInTheDocument();
    expect(names()[0]).toBe("Fresh enquiry");
  });

  it("warns before the tab is closed on unsaved work, and only then", async () => {
    await open();
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    edit();
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("an empty name stops the save and says where", async () => {
    await open();
    fireEvent.change(screen.getAllByLabelText(/^Name/)[1], { target: { value: "  " } });
    fireEvent.click(within(unsaved()).getByRole("button", { name: "Save the pipeline" }));
    expect(await screen.findByText("Give it a name")).toBeInTheDocument();
    expect(m.saveStages).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByLabelText(/^Name/)[1]));
  });
});

describe("arranging the stages", () => {
  it("moves a stage with its buttons, and the first and last cannot move off the ends", async () => {
    await open();
    fireEvent.click(screen.getAllByRole("button", { name: /Follow-up in|Closed as/ })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Move Quotation sent down" }));
    expect(names()).toEqual(["New", "Won", "Quotation sent", "Lost"]);
    expect(unsaved()).not.toBeNull();
    expect(screen.getByRole("button", { name: "Move New up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Lost down" })).toBeDisabled();
  });

  it("a new stage goes before the one that closes the pipeline, and is ready to be named", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /Add a stage/ }));
    expect(names()).toEqual(["New", "Quotation sent", "Won", "", "Lost"]);
    await waitFor(() => expect(document.activeElement).toBe(screen.getAllByLabelText(/^Name/)[3]));
    expect(unsaved()).not.toBeNull();
  });

  it("removes a stage, and Discard brings it back", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Remove Quotation sent" }));
    expect(names()).toEqual(["New", "Won", "Lost"]);
    fireEvent.click(within(unsaved()).getByRole("button", { name: "Discard" }));
    expect(names()).toEqual(["New", "Quotation sent", "Won", "Lost"]);
  });
});

describe("the automation", () => {
  it("is switches that say on or off, not bare checkboxes", async () => {
    await open();
    const advance = await screen.findByRole("switch", { name: /Let the documents move the deals/ });
    expect(advance).toHaveAttribute("aria-checked", "true");
    fireEvent.click(advance);
    expect(advance).toHaveAttribute("aria-checked", "false");
    expect(unsaved()).not.toBeNull();
  });

  it("shows the unit inside the number field, and saves what was changed", async () => {
    await open();
    const hours = await screen.findByLabelText(/Say so when an enquiry is untouched for/);
    expect(hours.parentElement).toHaveTextContent("hours");
    fireEvent.change(hours, { target: { value: "48" } });
    fireEvent.click(within(unsaved()).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalled());
    expect(m.saveSettings.mock.calls[0][0]).toMatchObject({ uncontactedHours: 48, autoAdvance: true });
    await waitFor(() => expect(unsaved()).toBeNull());
  });

  it("the pipeline's hint knows the organisation's usual number of quiet days", async () => {
    await open();
    const timing = screen.getAllByRole("button", { name: /Follow-up in|Closed as/ })[0];
    fireEvent.click(timing);
    const panel = document.getElementById(timing.getAttribute("aria-controls"));
    await waitFor(() => expect(within(panel).getByText("0 means the usual 14 days")).toBeInTheDocument());
  });
});

describe("what must fit in the room a phone gives it", () => {
  it("every choice in 'It moves here when' is short enough to read, and the values are untouched", async () => {
    await open();
    const select = screen.getAllByLabelText(/^It moves here when/)[1];
    const options = within(select).getAllByRole("option");
    // Inputs are 16px on a phone and the select gets ~175px of text: "The customer accepted the quotation" was cut to
    // "The customer acc", and even 23 characters lost its last word. 18 is what fits; the values the server
    // understands do not change.
    for (const option of options) expect(option.textContent.length).toBeLessThanOrEqual(18);
    expect(options.map((o) => o.value)).toEqual(["", "quotation_sent", "quotation_accepted", "invoice_approved"]);
  });

  it("the unit's padding follows the unit, so a percentage field keeps room for its number", async () => {
    await open();
    const chance = screen.getAllByLabelText(/^Chance/)[0];
    // "%" needs about 2.25rem; the old fixed 4rem left a 96px field no room for "10", which showed as "1".
    expect(chance.className).toMatch(/\bpe-9\b/);
    expect(chance.className).not.toMatch(/\bpe-16\b/);
    const timing = screen.getAllByRole("button", { name: /Follow-up in/ })[0];
    fireEvent.click(timing);
    const days = within(document.getElementById(timing.getAttribute("aria-controls"))).getByLabelText(/^Next follow-up in/);
    expect(days.className).toMatch(/\bpe-16\b/);
  });
});
