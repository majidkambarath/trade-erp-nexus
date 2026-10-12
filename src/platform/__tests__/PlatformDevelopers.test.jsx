import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "../../components/theme-provider";
import PlatformDevelopers from "../PlatformDevelopers";

// The console's own people. Until this screen existed nothing called these routes, so one lost phone with
// two-factor on shut the console for good: the point of the screen is that a second account can be made, and
// that a colleague's two-factor can be reset - but never one's own, which is what the server refuses too.
const api = vi.hoisted(() => ({
  developers: vi.fn(),
  createDeveloper: vi.fn(),
  updateDeveloper: vi.fn(),
  resetDeveloperTwoFactor: vi.fn(),
}));
vi.mock("../platformApi", () => ({
  platform: api,
  consoleError: (e) => e?.response?.data?.message || e?.message || "Something went wrong",
  consoleErrorCode: (e) => e?.response?.data?.errorCode || null,
}));

const ME = { _id: "p1", name: "Dev One", email: "dev1@zarvia.test", status: "active", twoFactor: { enabled: true }, lastLogin: "2026-10-01T08:00:00.000Z" };
const OTHER = { _id: "p2", name: "Dev Two", email: "dev2@zarvia.test", status: "active", twoFactor: { enabled: true }, lastLogin: null };
const NO_2FA = { _id: "p3", name: "Dev Three", email: "dev3@zarvia.test", status: "inactive", twoFactor: { enabled: false }, lastLogin: null };

const draw = async (rows = [ME, OTHER, NO_2FA]) => {
  api.developers.mockResolvedValue(rows);
  render(<ThemeProvider><PlatformDevelopers user={ME} /></ThemeProvider>);
  await screen.findByText("Dev One");
};
const rowOf = (name) => screen.getByText(name).closest("tr") || screen.getByText(name).closest("li") || screen.getByText(name).parentElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the console's developers", () => {
  it("lists them with their status, whether two-factor is on, and when they last signed in", async () => {
    await draw();
    expect(screen.getByText("dev2@zarvia.test")).toBeInTheDocument();
    expect(screen.getByText("Switched off")).toBeInTheDocument();
    expect(screen.getAllByText("On").length).toBe(2);
    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.getAllByText("Never").length).toBe(2, "the two who have never signed in");
    expect(screen.getByText(/\(you\)/)).toBeInTheDocument();
  });

  it("says plainly why a second account matters", async () => {
    await draw();
    expect(screen.getByText(/lost phone locks everybody out/i)).toBeInTheDocument();
  });

  it("creates one and shows the password exactly once, saying it is not stored", async () => {
    await draw();
    api.createDeveloper.mockResolvedValue({ _id: "p4" });
    fireEvent.click(screen.getByRole("button", { name: /New developer/i }));

    // the form arrives with a password already suggested, so nobody invents a weak one
    const password = screen.getByLabelText(/^Password/);
    expect(password.value.length).toBeGreaterThanOrEqual(12);

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Dev Four" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "dev4@zarvia.test" } });
    const typed = password.value;
    fireEvent.click(screen.getByRole("button", { name: "Create developer" }));

    await waitFor(() => expect(api.createDeveloper).toHaveBeenCalledWith({ name: "Dev Four", email: "dev4@zarvia.test", password: typed }));
    expect(await screen.findByText("Pass this on now")).toBeInTheDocument();
    expect(screen.getByText(typed)).toBeInTheDocument();
    expect(screen.getByText(/not stored anywhere/i)).toBeInTheDocument();
  });

  it("refuses a password the server would refuse, before sending it", async () => {
    await draw();
    fireEvent.click(screen.getByRole("button", { name: /New developer/i }));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Dev Five" } });
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: "dev5@zarvia.test" } });
    fireEvent.change(screen.getByLabelText(/^Password/), { target: { value: "tooshort" } });
    fireEvent.click(screen.getByRole("button", { name: "Create developer" }));

    expect(await screen.findByText(/at least 12 characters/i)).toBeInTheDocument();
    expect(api.createDeveloper).not.toHaveBeenCalled();
  });

  it("an edit leaves the password alone unless one is typed, and never changes the sign-in address", async () => {
    await draw();
    api.updateDeveloper.mockResolvedValue({});
    fireEvent.click(rowOf("Dev Two").querySelector("button"));
    expect(screen.getByLabelText(/^Email/)).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Dev Two Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.updateDeveloper).toHaveBeenCalledWith("p2", { name: "Dev Two Renamed" }));
  });

  it("offers nothing to switch off or reset on your own row: that is the server's rule too", async () => {
    await draw();
    const mine = rowOf("Dev One");
    const theirs = rowOf("Dev Two");
    expect([...mine.querySelectorAll("button")].map((b) => b.textContent.trim())).toEqual(["Edit"]);
    expect([...theirs.querySelectorAll("button")].map((b) => b.textContent.trim())).toEqual(["Edit", "Reset two-factor", "Switch off"]);
  });

  it("resets a colleague's two-factor only after saying what it means", async () => {
    await draw();
    api.resetDeveloperTwoFactor.mockResolvedValue({});
    fireEvent.click(screen.getByRole("button", { name: /Reset two-factor/i }));
    expect(await screen.findByText(/password alone until they set it up again/i)).toBeInTheDocument();
    expect(api.resetDeveloperTwoFactor).not.toHaveBeenCalled();

    // the dialog's own button, not the row's: nothing happens until this one is pressed
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset two-factor" }));
    await waitFor(() => expect(api.resetDeveloperTwoFactor).toHaveBeenCalledWith("p2"));
  });

  it("shows the server's own words when it refuses", async () => {
    await draw();
    api.updateDeveloper.mockRejectedValue({ response: { data: { message: "That is the last active platform account" } } });
    fireEvent.click(screen.getByRole("button", { name: "Switch off" }));
    expect(await screen.findByText("That is the last active platform account")).toBeInTheDocument();
  });
});
