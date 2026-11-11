import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: m.get, put: m.put } }));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));
vi.mock("../../../lib/accountingApi", () => ({ accounting: { settings: vi.fn().mockResolvedValue({ creditControl: { mode: "off", overdueBlockDays: 0 }, returnWindowDays: 0, requireReturnLink: false, profile: {} }), saveSettings: vi.fn() } }));

import Settings from "../Settings";
import { OrganisationProvider } from "../../shell/OrganisationContext";
import { ThemeProvider } from "../../theme-provider";
import { getTimeFormat, setTimeFormat } from "../../../utils/format";
import { APP_VERSION } from "../../../lib/version";

// The organisation's letterhead (GET /company/profile): one copy for everyone, in the shape the screens read.
const PROFILE = {
  companyName: "Harbour Trading", addressLine1: "Deira", addressLine2: "", city: "Dubai", state: "Dubai", country: "United Arab Emirates",
  postalCode: "", phoneNumber: "", emailAddress: "accounts@harbourtrading.ae", website: "", vatNumber: "100123456700003",
  bankDetails: { bankName: "Emirates NBD", accountName: "Harbour Trading LLC", accountNumber: "0123456789", ibanNumber: "", currency: "AED" },
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
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Company", "Branches", "Business rules", "Invoice bank details", "Sending", "Preferences", "Security"]);
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

  // F05: a free-text box with a datalist of suggestions still let anything through (a typo, an abbreviation, a
  // trailing space), which is exactly what the VAT return's own emirate setting reads when this one stands for
  // it. A UAE company gets a hard choice of the seven; anywhere else "state" stays free text (there is no fixed list).
  it("offers the seven emirates as a locked choice for a UAE company, and saves the one chosen", async () => {
    at();
    const emirate = await screen.findByRole("combobox", { name: "State / emirate" });
    expect(emirate).toHaveValue("Dubai");
    expect(within(emirate).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Choose an emirate", "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Fujairah", "Ras Al Khaimah", "Umm Al Quwain",
    ]);
    fireEvent.change(emirate, { target: { value: "Sharjah" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(m.put).toHaveBeenCalledTimes(1));
    expect(sent().state).toBe("Sharjah");
  });

  it("stays a free-text field outside the UAE, where there is no fixed list of states", async () => {
    m.get.mockResolvedValue({ data: { success: true, data: { ...PROFILE, country: "India", state: "Maharashtra" } } });
    at();
    const emirate = await screen.findByLabelText(/State \/ emirate/);
    expect(emirate).toHaveValue("Maharashtra");
    expect(emirate.tagName).toBe("INPUT");
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
    expect(m.put.mock.calls[0][0]).toBe("/company/profile");
    const info = sent();
    expect(info.companyName).toBe("Harbour Trading");
    expect(info.bankDetails).toMatchObject({ bankName: "Emirates NBD", ibanNumber: "AE070331234567890123456", swiftCode: "EBILAEAD", currency: "AED" });
    expect(await screen.findByText("Settings saved")).toBeInTheDocument();
  });

  it("takes the logo off when asked, and only once the page is saved", async () => {
    m.get.mockResolvedValue({ data: { success: true, data: { ...PROFILE, companyLogo: { url: "https://cdn.test/logo.png" } } } });
    at();
    expect(await screen.findByAltText("Company logo")).toHaveAttribute("src", "https://cdn.test/logo.png");

    fireEvent.click(screen.getByRole("button", { name: /Remove logo/ }));
    expect(screen.queryByAltText("Company logo")).toBeNull();
    expect(screen.getByText("No logo yet")).toBeInTheDocument();
    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
    expect(m.put).not.toHaveBeenCalled(); // nothing is taken off until the page is saved

    fireEvent.click(screen.getByRole("button", { name: "Keep the saved logo" })); // and it can be taken back
    expect(screen.getByAltText("Company logo")).toBeInTheDocument();
    expect(screen.getByText("No unsaved changes")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Remove logo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(m.put).toHaveBeenCalledTimes(1));
    const form = m.put.mock.calls[0][1];
    expect(form.get("removeLogo")).toBe("true"); // the instruction, not a file
    expect(form.get("companyLogo")).toBeNull();
  });

  it("offers nothing to remove when the company has no logo", async () => {
    at();
    expect(await screen.findByText("No logo yet")).toBeInTheDocument();
    expect(screen.getByText("Choose logo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove logo/ })).toBeNull();
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

  // The date format is the ORGANISATION's now, not this device's: it is printed on documents that
  // leave the building, so two people printing one invoice must not produce two different dates.
  // Preferences shows it, and says where it is set, but cannot change it.
  it("shows the date format but does not let this device change it", async () => {
    at("preferences");
    const select = await screen.findByLabelText("Date format");
    expect(select).toBeDisabled();
    expect(screen.getByText(/whole organisation, under Company/i)).toBeTruthy();
    // the per-browser key is gone: nothing here writes it any more
    expect(localStorage.getItem("erp-date-format")).toBeNull();
    setTimeFormat("24h");
  });

  it("still keeps the time format on this device", async () => {
    at("preferences");
    const select = await screen.findByLabelText("Time format");
    fireEvent.change(select, { target: { value: "12h" } });
    expect(getTimeFormat()).toBe("12h");
    expect(localStorage.getItem("erp-time-format")).toBe("12h");
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

  it("holds a new password to the server's 8 characters, so a short one is refused here and not by a failed request", async () => {
    await open();
    expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument();
    fillAll("old-pass", "seven77", "seven77");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Use at least 8 characters")).toBeInTheDocument();
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

describe("who may change the company profile", () => {
  const atAs = (grants) => {
    orgStatus = {
      organisation: { legalName: "Harbour Trading" }, subscription: { state: "active", blocked: false }, features: {},
      me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants },
    };
    return render(
      <ThemeProvider><MemoryRouter initialEntries={["/settings"]}><OrganisationProvider><Settings /></OrganisationProvider></MemoryRouter></ThemeProvider>
    );
  };

  it("shows it to someone who may only look, read-only: the fields are off, there is no save bar, and it says why", async () => {
    atAs(["settings.view"]);
    const name = await screen.findByLabelText(/Company name/);
    expect(name).toHaveValue("Harbour Trading");
    expect(name).toBeDisabled();
    expect(screen.getByRole("note")).toHaveTextContent(/Only someone who may change settings can edit it/);
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(m.put).not.toHaveBeenCalled();
  });

  it("lets someone who may change settings edit it and save it to the organisation's profile", async () => {
    atAs(["settings.view", "settings.manage"]);
    const name = await screen.findByLabelText(/Company name/);
    expect(name).toBeEnabled();
    expect(screen.queryByRole("note")).toBeNull();
    fireEvent.change(name, { target: { value: "Harbour Trading LLC" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(m.put).toHaveBeenCalledTimes(1));
    expect(m.put.mock.calls[0][0]).toBe("/company/profile");
    expect(sent().companyName).toBe("Harbour Trading LLC");
  });
});

// An organisation that bought the CRM alone makes no invoice, so the tabs about invoices (credit control, returns, the tax
// identity, the bank details printed on a document) and the link to Accounting setup are not offered to it.
describe("an organisation that bought the CRM alone", () => {
  const off = { on: false, full: false, actions: [] };
  const on = (actions) => ({ on: true, full: true, actions });
  const MODULES = { crm: on(["view", "manage"]), users: on(["view", "manage"]), settings: on(["view", "manage"]), sales: off, purchase: off, inventory: off, finance: off, banking: off, accounts: off, staff: off };
  const atSolo = (tab, modules = MODULES) => {
    orgStatus = {
      organisation: { legalName: "Harbour Trading" }, subscription: { state: "active", blocked: false }, features: {}, modules,
      me: { id: "u1", name: "Owner", role: { key: "super_admin", name: "Owner", rank: 100 }, grants: ["settings.view", "settings.manage", "crm.view"] },
    };
    return render(
      <ThemeProvider><MemoryRouter initialEntries={[tab ? `/settings?tab=${tab}` : "/settings"]}><OrganisationProvider><Settings /></OrganisationProvider></MemoryRouter></ThemeProvider>
    );
  };

  it("is offered the tabs that mean something to it, and no link to the books' setup", async () => {
    atSolo();
    await screen.findByRole("tab", { name: "Company", selected: true });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Company", "Branches", "Sending", "Preferences", "Security"]);
    expect(screen.queryByRole("link", { name: "Tax codes and numbering" })).toBeNull();
    expect(screen.getByText(/Your company profile, how the app looks for you, and your account password/)).toBeInTheDocument();
  });

  it("falls back to the company tab for a typed address that names a tab it does not have", async () => {
    atSolo("rules");
    expect(await screen.findByRole("tab", { name: "Company", selected: true })).toBeInTheDocument();
    expect(screen.queryByText("Credit control")).toBeNull();
    atSolo("bank");
    expect(await screen.findAllByRole("tab", { name: "Company", selected: true })).not.toHaveLength(0);
  });

  it("changes nothing for an organisation that has the trade, however little of it", async () => {
    atSolo(undefined, { ...MODULES, sales: on(["view"]) });
    await screen.findByRole("tab", { name: "Company", selected: true });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Company", "Branches", "Business rules", "Invoice bank details", "Sending", "Preferences", "Security"]);
    expect(screen.getByRole("link", { name: "Tax codes and numbering" })).toBeInTheDocument();
  });
});

// Which version is running. Outside the tabs, because "open Settings and read the version" has to work
// whichever tab was last open - and it is the first thing anybody is asked when reporting a problem.
describe("the version strip", () => {
  const withApi = (api) => {
    orgStatus = {
      organisation: { legalName: "Harbour Trading" }, subscription: { state: "active", blocked: false }, features: {},
      me: { id: "u1", name: "Someone", role: { key: "r", name: "A role", rank: 40 }, grants: ["settings.view", "settings.manage"] },
      ...(api === undefined ? {} : { build: { api } }),
    };
    return render(
      <ThemeProvider><MemoryRouter initialEntries={["/settings"]}><OrganisationProvider><Settings /></OrganisationProvider></MemoryRouter></ThemeProvider>
    );
  };

  it("shows the app's own version, the one that was built", async () => {
    withApi(APP_VERSION);
    await waitFor(() => expect(screen.getByText(/^Version/)).toBeInTheDocument());
    // The figure is in its own span (tabular-nums), so its text is exactly the version.
    expect(screen.getByText(APP_VERSION)).toBeInTheDocument();
    expect(screen.getByText("Up to date")).toBeInTheDocument();
  });

  it("flags a server on a different version, and names both", async () => {
    withApi("2.1.0.0");
    await waitFor(() => expect(screen.getByText("Versions differ")).toBeInTheDocument());
    expect(screen.getByText(/2\.1\.0\.0/)).toBeInTheDocument();
    expect(screen.getByText(/not finished deploying/)).toBeInTheDocument();
  });

  it("does not cry mismatch while the status is still on its way", async () => {
    withApi(undefined);
    await waitFor(() => expect(screen.getByText(/^Version/)).toBeInTheDocument());
    expect(screen.queryByText("Versions differ")).not.toBeInTheDocument();
    expect(screen.getByText(/Checking the server/)).toBeInTheDocument();
  });

  it("is on the page whichever tab is open, since it sits outside them", async () => {
    withApi(APP_VERSION);
    await waitFor(() => expect(screen.getByText(/^Version/)).toBeInTheDocument());
    openTab("Security");
    await waitFor(() => expect(screen.getByText(/^Version/)).toBeInTheDocument());
  });
});
