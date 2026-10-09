import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";

// Settings -> Business rules -> Approvals changes who may approve what for the whole organisation, so it is settings.manage
// like every other group on the page: a person who may only look sees it filled in, with the controls off and the page's one
// sentence saying why. The server refuses the change whatever the screen shows (PUT /accounting/settings needs settings.manage).
//
// The absence is asserted after the grants are known and the group is on screen, with a control that is there.
const m = vi.hoisted(() => ({ settings: vi.fn(), saveSettings: vi.fn(), status: vi.fn() }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { settings: m.settings, saveSettings: m.saveSettings } }));
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: m.status }));

import BusinessRules from "../BusinessRules";

const SETTINGS = { creditControl: { mode: "off", overdueBlockDays: 0 }, returnWindowDays: 0, requireReturnLink: false, approvals: { separateApprover: true, secondApprovalAbove: 5000 }, profile: { legalName: "Harbour Trading LLC", trn: "" } };

const show = async (grants) => {
  m.status.mockResolvedValue(statusFor(grants));
  const notify = vi.fn();
  render(<AsRole><BusinessRules notify={notify} /></AsRole>);
  await roleLoaded();
  // the group is loaded with what the organisation has set
  expect(await screen.findByLabelText(/Ask for a second approver on documents above/)).toHaveValue("5000");
  return { notify };
};

beforeEach(() => {
  vi.clearAllMocks();
  m.settings.mockResolvedValue(SETTINGS);
  m.saveSettings.mockResolvedValue({});
});

describe("the Approvals group", () => {
  it("is read-only for a person who holds settings.view but not settings.manage, and says why", async () => {
    await show(["settings.view"]);
    expect(screen.getByLabelText(/The person who prepared a document cannot approve it/)).toBeDisabled();
    expect(screen.getByLabelText(/Ask for a second approver on documents above/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save approval rules" })).toBeDisabled();
    expect(screen.getByText(/Your role can look at the business rules but not change them/)).toBeInTheDocument();
    expect(screen.getByLabelText(/The person who prepared a document cannot approve it/)).toBeChecked(); // they can still read it
  });

  it("can be changed by a person who holds settings.manage", async () => {
    await show(["settings.view", "settings.manage"]);
    expect(screen.getByLabelText(/Ask for a second approver on documents above/)).toBeEnabled();
    expect(screen.queryByText(/but not change them/)).toBeNull();
    fireEvent.change(screen.getByLabelText(/Ask for a second approver on documents above/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save approval rules" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledWith({ approvals: { separateApprover: true, secondApprovalAbove: null } }));
  });

  it("tells the shell to read the organisation again after a save, so the order screens follow the new rule at once", async () => {
    await show(["settings.view", "settings.manage"]);
    const before = m.status.mock.calls.length;
    fireEvent.click(screen.getByLabelText(/The person who prepared a document cannot approve it/));
    fireEvent.click(screen.getByRole("button", { name: "Save approval rules" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalled());
    await waitFor(() => expect(m.status.mock.calls.length).toBeGreaterThan(before));
  });
});
