import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import Login from "../Login";
import { clearSession, getAccessToken } from "../../../axios/session";

// The sign-in page, one step or two. With two-factor on the password alone earns a challenge; the code (or a recovery code) that
// follows is what opens the session. What is SENT is the point, so each call is inspected.
const m = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { post: m.post }, restoreSession: () => Promise.resolve(false) }));

const SESSION = { admin: { id: "a1", email: "nadia@acme.test", twoFactor: { enabled: true } }, tokens: { accessToken: "ACCESS" } };
const refused = (status, errorCode, message) => Object.assign(new Error("refused"), { response: { status, data: { success: false, errorCode, message } } });

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<p>the dashboard</p>} />
        <Route path="/forgot-password" element={<p>forgot page</p>} />
      </Routes>
    </MemoryRouter>
  );
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const passwordStep = async () => {
  type("Email address", "nadia@acme.test");
  type("Password", "her-password-1");
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
};

beforeEach(() => {
  m.post.mockReset();
  clearSession();
  localStorage.clear();
});

describe("signing in with a password alone", () => {
  it("still opens the session in one step when two-factor is off", async () => {
    m.post.mockResolvedValue({ data: { success: true, data: SESSION } });
    renderLogin();
    await passwordStep();
    expect(await screen.findByText("the dashboard")).toBeInTheDocument();
    expect(m.post).toHaveBeenCalledWith("/login", { email: "nadia@acme.test", password: "her-password-1" });
    expect(getAccessToken()).toBe("ACCESS");
  });

  it("points a forgotten password at the reset page, not at 'ask your administrator'", () => {
    renderLogin();
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByText(/Ask your administrator to reset it/)).toBeNull();
  });
});

describe("two-factor: the second step", () => {
  const challenge = () => m.post.mockResolvedValueOnce({ data: { success: true, data: { twoFactorRequired: true, challengeToken: "CHALLENGE", expiresIn: 300 } } });

  it("asks for the code once the password is right, and opens no session yet", async () => {
    challenge();
    renderLogin();
    await passwordStep();
    expect(await screen.findByRole("heading", { name: "Enter your code" })).toBeInTheDocument();
    expect(screen.getByText(/nadia@acme\.test/)).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.getByLabelText("Code from your app")).toHaveFocus();
  });

  it("sends the challenge with the six digits, then opens the session and goes where the person was headed", async () => {
    challenge();
    m.post.mockResolvedValueOnce({ data: { success: true, data: SESSION } });
    renderLogin();
    await passwordStep();
    const box = await screen.findByLabelText("Code from your app");
    fireEvent.change(box, { target: { value: "123456" } });
    expect(box).toHaveValue("123 456");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("the dashboard")).toBeInTheDocument();
    expect(m.post).toHaveBeenLastCalledWith("/auth/login/2fa", { challengeToken: "CHALLENGE", code: "123456" });
    expect(getAccessToken()).toBe("ACCESS");
  });

  it("will not send what is not six digits, and says so", async () => {
    challenge();
    renderLogin();
    await passwordStep();
    fireEvent.change(await screen.findByLabelText("Code from your app"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The code from your app is six digits");
    expect(m.post).toHaveBeenCalledTimes(1);
  });

  it("a wrong code is said in words and the box stays, so the person types another", async () => {
    challenge();
    m.post.mockRejectedValueOnce(refused(401, "INVALID_TWO_FACTOR_CODE"));
    renderLogin();
    await passwordStep();
    fireEvent.change(await screen.findByLabelText("Code from your app"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/That code is not right/);
    expect(screen.getByLabelText("Code from your app")).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });

  it("a code that was already used says to wait for the next", async () => {
    challenge();
    m.post.mockRejectedValueOnce(refused(401, "TWO_FACTOR_CODE_REUSED"));
    renderLogin();
    await passwordStep();
    fireEvent.change(await screen.findByLabelText("Code from your app"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/already been used/);
  });

  it("a locked account returns to the password, with the server's words", async () => {
    challenge();
    m.post.mockRejectedValueOnce(refused(423, "ACCOUNT_LOCKED", "Account locked. Try after 14 minutes"));
    renderLogin();
    await passwordStep();
    fireEvent.change(await screen.findByLabelText("Code from your app"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Account locked. Try after 14 minutes");
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("a challenge that ran out (five minutes) returns to the password and says why", async () => {
    challenge();
    m.post.mockRejectedValueOnce(refused(401, "CHALLENGE_EXPIRED", "Your sign-in took too long. Start again."));
    renderLogin();
    await passwordStep();
    fireEvent.change(await screen.findByLabelText("Code from your app"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/took too long/);
    expect(screen.getByLabelText("Password")).toHaveValue(""); // not left in the box
  });

  it("a recovery code is the way in for a lost phone: its own box, sent under its own name", async () => {
    challenge();
    m.post.mockResolvedValueOnce({ data: { success: true, data: { ...SESSION, signIn: { method: "recovery", recoveryCodesLeft: 8 } } } });
    renderLogin();
    await passwordStep();
    fireEvent.click(await screen.findByRole("button", { name: "Use a recovery code" }));
    expect(screen.getByRole("heading", { name: "Use a recovery code" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Recovery code"), { target: { value: "abcde-fghjk" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("the dashboard")).toBeInTheDocument();
    expect(m.post).toHaveBeenLastCalledWith("/auth/login/2fa", { challengeToken: "CHALLENGE", recoveryCode: "ABCDEFGHJK" });
  });

  it("can switch back to the app's code, and back to the password", async () => {
    challenge();
    renderLogin();
    await passwordStep();
    fireEvent.click(await screen.findByRole("button", { name: "Use a recovery code" }));
    fireEvent.click(screen.getByRole("button", { name: "Use the code from my app instead" }));
    expect(screen.getByLabelText("Code from your app")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(await screen.findByLabelText("Password")).toBeInTheDocument();
    expect(getAccessToken()).toBeNull();
  });
});
