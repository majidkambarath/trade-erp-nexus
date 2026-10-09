import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PasswordChangeRequired from "../PasswordChangeRequired";

// The page shown, in place of the whole app, to someone whose password was set by somebody else.
const m = vi.hoisted(() => ({ put: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { put: m.put } }));

const renderGate = (props = {}) => {
  const onChanged = vi.fn(() => Promise.resolve());
  const onSignOut = vi.fn();
  render(<PasswordChangeRequired name="Nadia" onChanged={onChanged} onSignOut={onSignOut} {...props} />);
  return { onChanged, onSignOut };
};
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fill = (current = "temporary-1", next = "my-own-password-1", confirm = next) => {
  type(/^Password you signed in with/, current);
  type(/^New password/, next);
  type(/^Confirm new password/, confirm);
};

// A block body: vitest runs a function RETURNED from beforeEach as a cleanup, and returning the mock would call it again.
beforeEach(() => {
  m.put.mockReset().mockResolvedValue({ data: { success: true } });
});

describe("choose your own password", () => {
  it("says why, by name, and offers to sign out instead", () => {
    const { onSignOut } = renderGate();
    expect(screen.getByRole("heading", { name: "Choose your own password" })).toBeInTheDocument();
    expect(screen.getByText(/Nadia, the password you signed in with was set by someone else/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sign out/ }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("sends the three fields the server asks for, then reads the status again so the app opens", async () => {
    const { onChanged } = renderGate();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Save my password" }));
    await waitFor(() => expect(m.put).toHaveBeenCalledTimes(1));
    expect(m.put).toHaveBeenCalledWith("/profile/change-password", { currentPassword: "temporary-1", newPassword: "my-own-password-1", confirmPassword: "my-own-password-1" });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("will not send what the server would refuse, and says what is wrong", () => {
    renderGate();
    fill("temporary-1", "short", "short");
    fireEvent.click(screen.getByRole("button", { name: "Save my password" }));
    expect(screen.getByText("Use at least 8 characters")).toBeInTheDocument();
    fill("temporary-1", "temporary-1", "temporary-1");
    fireEvent.click(screen.getByRole("button", { name: "Save my password" }));
    expect(screen.getByText("Choose a password you have not used here")).toBeInTheDocument();
    fill("temporary-1", "my-own-password-1", "other-one-12345");
    fireEvent.click(screen.getByRole("button", { name: "Save my password" }));
    expect(screen.getByText("The two passwords do not match")).toBeInTheDocument();
    expect(m.put).not.toHaveBeenCalled();
  });

  it("shows the server's own words when it refuses (the current password is wrong), and does not open the app", async () => {
    m.put.mockRejectedValue({ response: { data: { message: "Current password is incorrect" } } });
    const { onChanged } = renderGate();
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Save my password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("can show what is being typed", () => {
    renderGate();
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByLabelText("Show passwords"));
    expect(screen.getByLabelText(/^New password/)).toHaveAttribute("type", "text");
  });
});
