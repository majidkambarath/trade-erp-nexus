import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({ settings: vi.fn(), saveSettings: vi.fn() }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: m }));

import BusinessRules, { taxIdentityFrom } from "../BusinessRules";

const SETTINGS = { creditControl: { mode: "off", overdueBlockDays: 0 }, returnWindowDays: 0, requireReturnLink: false, profile: { legalName: "Harbour Trading LLC", trn: "" } };
const notify = vi.fn();
const show = (props = {}) => render(<BusinessRules notify={notify} {...props} />);
beforeEach(() => {
  notify.mockReset();
  m.settings.mockReset().mockResolvedValue(SETTINGS);
  m.saveSettings.mockReset().mockResolvedValue({});
});

describe("business rules", () => {
  it("saves credit control with the chosen mode and overdue limit", async () => {
    show();
    fireEvent.click(await screen.findByRole("radio", { name: /Warn/ }));
    fireEvent.change(screen.getByLabelText(/overdue by more than/), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Save credit control" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledWith({ creditControl: { mode: "warn", overdueBlockDays: 30 } }));
    expect(notify).toHaveBeenCalledWith("Credit control saved");
  });

  it("saves the return rules", async () => {
    show();
    fireEvent.click(await screen.findByLabelText(/Every return must name its original invoice/));
    fireEvent.change(screen.getByLabelText(/Accept returns within/), { target: { value: "14" } });
    fireEvent.click(screen.getByRole("button", { name: "Save return rules" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledWith({ returnWindowDays: 14, requireReturnLink: true }));
  });

  it("rejects a TRN that is not 15 digits before calling the server", async () => {
    show();
    fireEvent.change(await screen.findByLabelText(/Tax registration number/), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Save tax identity" }));
    expect(await screen.findByText("A UAE TRN is exactly 15 digits")).toBeInTheDocument();
    expect(m.saveSettings).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Tax registration number/), { target: { value: "100123456700003" } });
    fireEvent.click(screen.getByRole("button", { name: "Save tax identity" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledTimes(1));
    expect(m.saveSettings.mock.calls[0][0].profile).toMatchObject({ trn: "100123456700003", legalName: "Harbour Trading LLC" });
  });

  it("fills the tax identity from the company profile so nothing is typed twice", async () => {
    show({ companyDefaults: { companyName: "Other Name", addressLine1: "Warehouse 4, Al Qusais", city: "Dubai", state: "Dubai", emailAddress: "accounts@harbourtrading.ae", phoneNumber: "+971 4 123 4567" } });
    expect(await screen.findByLabelText(/Address/)).toHaveValue("Warehouse 4, Al Qusais");
    expect(screen.getByLabelText("Email")).toHaveValue("accounts@harbourtrading.ae");
    expect(screen.getByLabelText("Registered name")).toHaveValue("Harbour Trading LLC"); // what was saved wins over the profile
  });
});

describe("approvals", () => {
  // the way the real axios instance throws a refusal: a generic message, the server's own sentence on the response
  const refusal = (message) => Object.assign(new Error("Request failed with status code 400"), { response: { status: 400, data: { message, errorCode: "APPROVALS_INVALID" } } });

  it("starts off, as the server says nothing is set", async () => {
    show();
    expect(await screen.findByLabelText(/The person who prepared a document cannot approve it/)).not.toBeChecked();
    expect(screen.getByLabelText(/Ask for a second approver on documents above/)).toHaveValue("");
  });

  it("shows what the organisation has set", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, approvals: { separateApprover: true, secondApprovalAbove: 5000 } });
    show();
    expect(await screen.findByLabelText(/The person who prepared a document cannot approve it/)).toBeChecked();
    expect(screen.getByLabelText(/Ask for a second approver on documents above/)).toHaveValue("5000");
  });

  it("labels the amount with the organisation's currency and says what leaving it empty means", async () => {
    show();
    expect(await screen.findByLabelText("Ask for a second approver on documents above (AED)")).toBeInTheDocument();
    expect(screen.getByText("Two different people must approve a document above this amount. Leave empty to ask for one approval always.")).toBeInTheDocument();
  });

  it("saves both rules through the settings call, and says so", async () => {
    show();
    fireEvent.click(await screen.findByLabelText(/The person who prepared a document cannot approve it/));
    fireEvent.change(screen.getByLabelText(/Ask for a second approver on documents above/), { target: { value: "5000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save approval rules" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledWith({ approvals: { separateApprover: true, secondApprovalAbove: 5000 } }));
    expect(notify).toHaveBeenCalledWith("Approval rules saved");
  });

  it("switches the second approver off with an empty amount (null), leaving the other rule as it is", async () => {
    m.settings.mockResolvedValue({ ...SETTINGS, approvals: { separateApprover: true, secondApprovalAbove: 5000 } });
    show();
    fireEvent.change(await screen.findByLabelText(/Ask for a second approver on documents above/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save approval rules" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledWith({ approvals: { separateApprover: true, secondApprovalAbove: null } }));
  });

  it("will not send an amount that is not an amount, and says so beside the field", async () => {
    show();
    fireEvent.change(await screen.findByLabelText(/Ask for a second approver on documents above/), { target: { value: "plenty" } });
    fireEvent.click(screen.getByRole("button", { name: "Save approval rules" }));
    expect(await screen.findByText("Enter an amount of 0 or more, or leave it empty")).toBeInTheDocument();
    expect(m.saveSettings).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("shows the server's own sentence when it refuses, and does not say it was saved", async () => {
    m.saveSettings.mockRejectedValue(refusal("The second approver amount must be 0 or more"));
    show();
    fireEvent.change(await screen.findByLabelText(/Ask for a second approver on documents above/), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Save approval rules" }));
    expect(await screen.findByText("The second approver amount must be 0 or more")).toBeInTheDocument();
    expect(screen.queryByText(/Request failed with status code/)).toBeNull();
    expect(notify).not.toHaveBeenCalledWith("Approval rules saved");
  });

  it("keeps the other groups' saves as they were", async () => {
    show();
    fireEvent.click(await screen.findByRole("radio", { name: /Warn/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save credit control" }));
    await waitFor(() => expect(m.saveSettings).toHaveBeenCalledWith({ creditControl: { mode: "warn", overdueBlockDays: 0 } }));
    expect(m.saveSettings.mock.calls[0][0]).not.toHaveProperty("approvals");
  });
});

describe("taxIdentityFrom", () => {
  it("takes only blank fields from the company profile, and only a real emirate", () => {
    const company = { companyName: "Harbour Trading", addressLine1: "Deira", city: "Dubai", state: "Somewhere Else", emailAddress: "a@b.ae", phoneNumber: "1" };
    const t = taxIdentityFrom({ legalName: "Saved LLC", city: "" }, company);
    expect(t).toMatchObject({ legalName: "Saved LLC", addressLine1: "Deira", city: "Dubai", email: "a@b.ae", phone: "1", emirate: "", vatRegistered: true, countryCode: "AE" });
    expect(taxIdentityFrom({}, { state: "Sharjah" }).emirate).toBe("Sharjah");
    expect(taxIdentityFrom(undefined, undefined).trn).toBe("");
  });
});
