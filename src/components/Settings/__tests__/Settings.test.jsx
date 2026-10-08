import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get, put: m.put } }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { settings: vi.fn().mockResolvedValue({ creditControl: { mode: "off", overdueBlockDays: 0 }, returnWindowDays: 0, requireReturnLink: false, profile: {} }), saveSettings: vi.fn() } }));

import Settings from "../Settings";
import { ThemeProvider } from "../../theme-provider";
import { formatDate, getDateFormat, setDateFormat, setTimeFormat } from "../../../utils/format";

const PROFILE = {
  email: "admin@test.com",
  companyInfo: {
    companyName: "Harbour Trading", addressLine1: "Deira", addressLine2: "", city: "Dubai", state: "Dubai", country: "United Arab Emirates",
    postalCode: "", phoneNumber: "", emailAddress: "accounts@harbourtrading.ae", website: "",
    bankDetails: { bankName: "Emirates NBD", accountName: "Harbour Trading LLC", accountNumber: "0123456789", ibanNumber: "", currency: "AED" },
  },
};

const at = (tab) => render(
  <ThemeProvider><MemoryRouter initialEntries={[tab ? `/settings?tab=${tab}` : "/settings"]}><Settings /></MemoryRouter></ThemeProvider>
);
const openTab = (name) => fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const sent = () => JSON.parse(m.put.mock.calls[0][1].get("companyInfo"));

beforeEach(() => {
  m.get.mockReset().mockResolvedValue({ data: { success: true, data: PROFILE } });
  m.put.mockReset().mockResolvedValue({ data: { success: true } });
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

describe("settings page", () => {
  it("shows only the tabs that do something, and none of the removed dummy sections", async () => {
    at();
    expect(await screen.findByRole("tab", { name: "Company", selected: true })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Company", "Business rules", "Invoice bank details", "Sending", "Preferences", "Security"]);
    for (const gone of [/Taxation/i, /Email Server/i, /Document Numbering/i, /Currency Settings/i, /Two-Factor/i, /Session Timeout/i]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    // tax is pointed to where it really lives
    expect(screen.getByRole("link", { name: "Tax codes and numbering" })).toHaveAttribute("href", "/accounting-setup");
  });

  it("shows the business rules in Settings, with the tax identity filled in from the company profile", async () => {
    at("rules");
    expect(await screen.findByText("Credit control")).toBeInTheDocument();
    expect(screen.getByText("Returns")).toBeInTheDocument();
    expect(await screen.findByLabelText("Registered name")).toHaveValue("Harbour Trading");
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull(); // each rule panel saves itself
  });

  it("loads the profile, tracks unsaved changes, and discards them", async () => {
    at();
    const name = await screen.findByLabelText(/Company name/);
    expect(name).toHaveValue("Harbour Trading");
    expect(screen.getByText("No unsaved changes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.change(name, { target: { value: "Harbour Trading Co" } });
    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByLabelText(/Company name/)).toHaveValue("Harbour Trading");
    expect(screen.getByText("No unsaved changes")).toBeInTheDocument();
  });

  it("will not save without the required details", async () => {
    at();
    await screen.findByLabelText(/Company name/);
    type(/Company name/, "  ");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Enter the company name")).toBeInTheDocument();
    expect(m.put).not.toHaveBeenCalled();
  });

  it("saves the company and its bank details together, with the IBAN and SWIFT tidied", async () => {
    at("bank");
    await screen.findByLabelText(/^IBAN/);
    type(/^IBAN/, "ae07 0331 2345 6789 0123 456");
    type(/SWIFT/, "ebilaead");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(m.put).toHaveBeenCalledTimes(1));
    expect(m.put.mock.calls[0][0]).toBe("/profile/me");
    const info = sent();
    expect(info.companyName).toBe("Harbour Trading");
    expect(info.bankDetails).toMatchObject({ bankName: "Emirates NBD", ibanNumber: "AE070331234567890123456", swiftCode: "EBILAEAD", currency: "AED" });
    expect(await screen.findByText("Settings saved")).toBeInTheDocument();
  });

  it("checks the IBAN, and takes you to the bank tab when that is where the mistake is", async () => {
    at("bank");
    await screen.findByLabelText(/^IBAN/);
    type(/^IBAN/, "AE070331234567890123457"); // wrong check digit
    openTab("Company");
    expect(await screen.findByLabelText(/Company name/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText(/This IBAN is not valid/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Invoice bank details", selected: true })).toBeInTheDocument();
    expect(m.put).not.toHaveBeenCalled();
  });

  it("shows the server's message when saving fails", async () => {
    m.put.mockRejectedValue({ response: { data: { message: "Website must be a valid URL" } } });
    at();
    fireEvent.change(await screen.findByLabelText(/Company name/), { target: { value: "Harbour Trading Co" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Website must be a valid URL")).toBeInTheDocument();
  });
});

describe("preferences", () => {
  it("applies the theme at once, and every control on the tab is real", async () => {
    at("preferences");
    fireEvent.click(await screen.findByRole("radio", { name: /Dark/ }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Light/ }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    // unbuilt things are labelled, not faked
    const soon = screen.getByRole("heading", { name: "Coming soon" }).closest("section");
    expect(within(soon).getByText("Language")).toBeInTheDocument();
    expect(within(soon).getByText("Notifications")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull(); // nothing to save: choices apply at once
  });

  it("changes how dates read everywhere, and remembers it", async () => {
    at("preferences");
    const select = await screen.findByLabelText("Date format");
    fireEvent.change(select, { target: { value: "YYYY-MM-DD" } });
    expect(getDateFormat()).toBe("YYYY-MM-DD");
    expect(localStorage.getItem("erp-date-format")).toBe("YYYY-MM-DD");
    expect(formatDate("2026-10-04T10:00:00Z")).toBe("2026-10-04");
    setDateFormat("DD/MM/YYYY");
    setTimeFormat("24h");
  });
});

describe("security", () => {
  const fillAll = (current, next, confirm) => {
    type(/^Current password/, current);
    type(/^New password/, next);
    type(/^Confirm new password/, confirm);
  };
  const open = async () => { at("security"); await screen.findByLabelText(/^Current password/); };

  it("asks for a matching confirmation before calling the server", async () => {
    await open();
    fillAll("old-pass", "new-pass-1", "new-pass-2");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("The two passwords do not match")).toBeInTheDocument();
    expect(m.put).not.toHaveBeenCalled();
  });

  it("sends the confirmation too (the server requires it) and clears the form", async () => {
    await open();
    fillAll("old-pass", "Better-pass-1!", "Better-pass-1!");
    expect(screen.getByText(/Strength: Strong/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(m.put).toHaveBeenCalledWith("/profile/change-password", { currentPassword: "old-pass", newPassword: "Better-pass-1!", confirmPassword: "Better-pass-1!" }));
    expect(await screen.findByText("Password changed")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Current password/)).toHaveValue("");
  });

  it("shows the server's reason when the current password is wrong", async () => {
    m.put.mockRejectedValue({ response: { data: { message: "Current password is incorrect" } } });
    await open();
    fillAll("wrong", "new-pass-1", "new-pass-1");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
  });

  it("can reveal what is being typed", async () => {
    await open();
    expect(screen.getByLabelText(/^Current password/)).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByLabelText("Show passwords"));
    expect(screen.getByLabelText(/^Current password/)).toHaveAttribute("type", "text");
  });
});
