import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ForgotPassword from "../ForgotPassword";
import ResetPassword from "../ResetPassword";

// "Forgot my password" and the page the emailed link opens. Both are reached while signed OUT. What is SENT is the point.
const m = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { post: m.post } }));

const TOKEN = "Zq3_-aB9".repeat(5) + "xyz"; // 43 characters of the right alphabet
const refused = (status, errorCode, message) => Object.assign(new Error("refused"), { response: { status, data: { success: false, errorCode, message } } });
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  m.post.mockReset();
  window.history.replaceState(null, "", "/");
});

describe("forgot my password", () => {
  const renderForgot = () => render(<MemoryRouter><Routes><Route path="/" element={<ForgotPassword />} /><Route path="/login" element={<p>sign in</p>} /></Routes></MemoryRouter>);

  it("sends the address, and answers the same neutral thing whoever it is", async () => {
    m.post.mockResolvedValue({ data: { success: true, message: "If that address belongs to an account..." } });
    renderForgot();
    expect(screen.getByRole("heading", { name: "Forgot your password?" })).toBeInTheDocument();
    type(/Email address/, " nadia@acme.test ");
    fireEvent.click(screen.getByRole("button", { name: "Send the link" }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(m.post).toHaveBeenCalledWith("/auth/forgot-password", { email: "nadia@acme.test" });
    // "if it belongs to an account": it never says whether it does
    expect(screen.getByText(/belongs to an account, a link to choose a new password is on its way/)).toBeInTheDocument();
    expect(screen.getByText(/works once, for 30 minutes/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/");
  });

  it("will not send what is not an address", () => {
    renderForgot();
    type(/Email address/, "not an address");
    fireEvent.click(screen.getByRole("button", { name: "Send the link" }));
    expect(screen.getByText("Enter the email address you sign in with")).toBeInTheDocument();
    expect(m.post).not.toHaveBeenCalled();
  });

  it("says when the address has asked too often, and when the server cannot be reached - and stays on the form", async () => {
    m.post.mockRejectedValueOnce(refused(429, "TOO_MANY_REQUESTS", "Too many requests from this address. Try again in a little while."));
    renderForgot();
    type(/Email address/, "nadia@acme.test");
    fireEvent.click(screen.getByRole("button", { name: "Send the link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests from this address");
    m.post.mockRejectedValueOnce(Object.assign(new Error("Network Error"), {}));
    fireEvent.click(screen.getByRole("button", { name: "Send the link" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Can't reach the server/));
    expect(screen.queryByRole("heading", { name: "Check your email" })).toBeNull();
  });
});

describe("the page the emailed link opens", () => {
  const renderReset = (search = `?token=${TOKEN}`) => {
    window.history.replaceState(null, "", `/reset-password${search}`);
    return render(
      <MemoryRouter initialEntries={[`/reset-password${search}`]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<p>sign in page</p>} />
          <Route path="/forgot-password" element={<p>forgot page</p>} />
        </Routes>
      </MemoryRouter>
    );
  };
  const fill = (password = "a-brand-new-password-1", confirm = password) => {
    type(/^New password/, password);
    type(/^Confirm new password/, confirm);
  };

  it("takes the token out of the address bar at once, so it is not left in the history or sent on as a referrer", async () => {
    renderReset();
    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
    expect(window.location.search).toBe("");
    expect(window.location.href).not.toContain(TOKEN);
  });

  it("sends the token with the new password, then says it is done and what happened to the other sign-ins", async () => {
    m.post.mockResolvedValue({ data: { success: true } });
    renderReset();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Save my new password" }));
    expect(await screen.findByRole("heading", { name: "Password changed" })).toBeInTheDocument();
    expect(m.post).toHaveBeenCalledWith("/auth/reset-password", { token: TOKEN, password: "a-brand-new-password-1" });
    expect(screen.getByText(/signed out everywhere/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute("href", "/");
  });

  it("will not send a short password, or two that differ", () => {
    renderReset();
    fill("short", "short");
    fireEvent.click(screen.getByRole("button", { name: "Save my new password" }));
    expect(screen.getByText("Use at least 8 characters")).toBeInTheDocument();
    fill("a-brand-new-password-1", "something-else-1");
    fireEvent.click(screen.getByRole("button", { name: "Save my new password" }));
    expect(screen.getByText("The two passwords do not match")).toBeInTheDocument();
    expect(m.post).not.toHaveBeenCalled();
  });

  it("a used or expired link says so and offers a new one", async () => {
    m.post.mockRejectedValue(refused(400, "RESET_TOKEN_INVALID", "This link is no longer valid. Ask for a new one."));
    renderReset();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Save my new password" }));
    expect(await screen.findByRole("heading", { name: "This link does not work" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask for a new link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("a password the server will not take keeps the link alive and says why", async () => {
    m.post.mockRejectedValue(refused(400, "PASSWORD_UNCHANGED", "Choose a password you have not used here"));
    renderReset();
    fill("old-password-1234");
    fireEvent.click(screen.getByRole("button", { name: "Save my new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a password you have not used here");
    expect(screen.getByLabelText(/^New password/)).toBeInTheDocument();
  });

  it("a link with no token, or a mangled one, is no link at all", () => {
    renderReset("");
    expect(screen.getByRole("heading", { name: "This link does not work" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^New password/)).toBeNull();
  });

  it("can show what is being typed", () => {
    renderReset();
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByLabelText("Show passwords"));
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute("type", "text");
  });
});
