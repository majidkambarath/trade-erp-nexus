import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../components/theme-provider";
import PlatformLogin from "../PlatformLogin";
import PlatformSecurity from "../PlatformSecurity";

// The developer console's own sign-in with two-factor: the same second step as the product's, against the console's own API.
const api = vi.hoisted(() => ({
  login: vi.fn(),
  loginTwoFactor: vi.fn(),
  twoFactor: { status: vi.fn(), setup: vi.fn(), enable: vi.fn(), disable: vi.fn(), recoveryCodes: vi.fn() },
}));
vi.mock("../platformApi", () => ({
  platform: api,
  consoleError: (e) => e?.response?.data?.message || e?.message || "Something went wrong",
  consoleErrorCode: (e) => e?.response?.data?.errorCode || null,
}));
vi.mock("../../lib/qr", () => ({ qrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,QR") }));

const USER = { id: "p1", email: "dev1@zarvia.test", name: "Dev One" };
const refused = (status, errorCode, message) => Object.assign(new Error("refused"), { response: { status, data: { success: false, errorCode, message } } });
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

const renderLogin = () => {
  const onSignedIn = vi.fn();
  render(<ThemeProvider><PlatformLogin onSignedIn={onSignedIn} /></ThemeProvider>);
  return onSignedIn;
};
const passwordStep = () => {
  type(/^Email/, "dev1@zarvia.test");
  type(/^Password/, "a-long-passphrase-123");
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("console sign-in", () => {
  it("is one step for an account without two-factor, as before", async () => {
    api.login.mockResolvedValue(USER);
    const onSignedIn = renderLogin();
    passwordStep();
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(USER));
    expect(api.loginTwoFactor).not.toHaveBeenCalled();
  });

  it("asks for the code when the account has it on, and signs in only with it", async () => {
    api.login.mockResolvedValue({ twoFactorRequired: true, challengeToken: "CHALLENGE" });
    api.loginTwoFactor.mockResolvedValue(USER);
    const onSignedIn = renderLogin();
    passwordStep();
    expect(await screen.findByRole("heading", { name: "Enter your code" })).toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Code from your app/), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(USER));
    expect(api.loginTwoFactor).toHaveBeenCalledWith("CHALLENGE", { code: "123456" });
  });

  it("a wrong code stays on the code box, in words", async () => {
    api.login.mockResolvedValue({ twoFactorRequired: true, challengeToken: "CHALLENGE" });
    api.loginTwoFactor.mockRejectedValue(refused(401, "INVALID_TWO_FACTOR_CODE"));
    const onSignedIn = renderLogin();
    passwordStep();
    fireEvent.change(await screen.findByLabelText(/^Code from your app/), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/That code is not right/);
    expect(screen.getByLabelText(/^Code from your app/)).toBeInTheDocument();
    expect(onSignedIn).not.toHaveBeenCalled();
  });

  it("a locked account, or a challenge that ran out, goes back to the password", async () => {
    api.login.mockResolvedValue({ twoFactorRequired: true, challengeToken: "CHALLENGE" });
    api.loginTwoFactor.mockRejectedValue(refused(423, "ACCOUNT_LOCKED", "Account locked. Try again in 100 minutes"));
    renderLogin();
    passwordStep();
    fireEvent.change(await screen.findByLabelText(/^Code from your app/), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Account locked. Try again in 100 minutes");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("a recovery code goes under its own name", async () => {
    api.login.mockResolvedValue({ twoFactorRequired: true, challengeToken: "CHALLENGE" });
    api.loginTwoFactor.mockResolvedValue(USER);
    renderLogin();
    passwordStep();
    fireEvent.click(await screen.findByRole("button", { name: "Use a recovery code" }));
    fireEvent.change(screen.getByLabelText(/^Recovery code/), { target: { value: "abcde-fghjk" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(api.loginTwoFactor).toHaveBeenCalledWith("CHALLENGE", { recoveryCode: "ABCDEFGHJK" }));
  });
});

describe("the console's Security page", () => {
  it("offers the same two-factor panel, on the console's own API", async () => {
    api.twoFactor.status.mockResolvedValue({ enabled: false, enabledAt: null, recoveryCodesLeft: 0 });
    render(<ThemeProvider><MemoryRouter><PlatformSecurity user={USER} /></MemoryRouter></ThemeProvider>);
    expect(await screen.findByRole("heading", { name: "Security" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Turn on two-factor/ })).toBeInTheDocument();
    expect(api.twoFactor.status).toHaveBeenCalled();
  });
});
