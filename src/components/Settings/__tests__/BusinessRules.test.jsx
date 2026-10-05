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

describe("taxIdentityFrom", () => {
  it("takes only blank fields from the company profile, and only a real emirate", () => {
    const company = { companyName: "Harbour Trading", addressLine1: "Deira", city: "Dubai", state: "Somewhere Else", emailAddress: "a@b.ae", phoneNumber: "1" };
    const t = taxIdentityFrom({ legalName: "Saved LLC", city: "" }, company);
    expect(t).toMatchObject({ legalName: "Saved LLC", addressLine1: "Deira", city: "Dubai", email: "a@b.ae", phone: "1", emirate: "", vatRegistered: true, countryCode: "AE" });
    expect(taxIdentityFrom({}, { state: "Sharjah" }).emirate).toBe("Sharjah");
    expect(taxIdentityFrom(undefined, undefined).trn).toBe("");
  });
});
