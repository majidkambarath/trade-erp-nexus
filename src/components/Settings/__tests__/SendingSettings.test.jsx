import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import SendingSettings from "../SendingSettings";
import { sendSettings } from "../../../lib/sendDocumentsApi";

vi.mock("../../../lib/sendDocumentsApi", () => ({
  sendSettings: { get: vi.fn(), save: vi.fn(), readiness: vi.fn(), test: vi.fn() },
}));

const SETTINGS = {
  enabled: false, provider: "console", fromName: "", fromEmail: "", replyTo: "", verifiedDomain: "", bccSelf: false, signature: "", defaultNote: "",
  attachPdf: true, shareEnabled: true, shareLinkDays: 30, statementShareDays: 14, retryMax: 3, dailyLimit: 200, connected: false, hasApiKey: false, lastAuthFailureAt: null,
};
const READY = { ready: true, provider: "console", checks: [
  { key: "key", label: "An email service key is saved", ok: true, blocking: false },
  { key: "company", label: "Your company name is set (Settings, Company)", ok: false, blocking: false },
] };
const resend = { ...SETTINGS, provider: "resend", fromEmail: "accounts@harbour.ae", verifiedDomain: "harbour.ae", hasApiKey: true, enabled: true, connected: true };
const refusal = (message, code) => Object.assign(new Error(message), { code });

let notify;
const show = () => render(<SendingSettings notify={notify} />);

beforeEach(() => {
  vi.clearAllMocks();
  notify = vi.fn();
  sendSettings.get.mockResolvedValue(SETTINGS);
  sendSettings.readiness.mockResolvedValue(READY);
  sendSettings.save.mockResolvedValue(SETTINGS);
});

describe("Settings, Sending", () => {
  it("says plainly that email is off and WhatsApp still works", async () => {
    show();
    expect(await screen.findByText("Off")).toBeInTheDocument();
    expect(screen.getByText("Email is switched off. WhatsApp still works.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch on" })).toBeInTheDocument();
  });

  it("switching on saves just that, and says what happens", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Switch on" }));
    await waitFor(() => expect(sendSettings.save).toHaveBeenCalledWith({ enabled: true }));
    expect(notify).toHaveBeenCalledWith("Sending switched on");
  });

  it("on with the record-only mode is honest that nothing is emailed", async () => {
    sendSettings.get.mockResolvedValue({ ...SETTINGS, enabled: true });
    show();
    expect(await screen.findByText(/recording only: nothing is actually emailed/)).toBeInTheDocument();
  });

  it("the server's refusal to switch on is shown in place, in its own words", async () => {
    sendSettings.save.mockRejectedValue(refusal("Not ready to switch on: An email service key is saved", "MESSAGING_NOT_READY"));
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Switch on" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not ready to switch on: An email service key is saved");
  });

  it("the setup checklist shows what is done and what is not, with words and not only colour", async () => {
    show();
    const list = await screen.findByRole("list", { name: "Setup checklist" });
    expect(within(list).getByText("An email service key is saved")).toBeInTheDocument();
    expect(within(list).getByText(/Your company name is set.*\(advised\)/)).toBeInTheDocument();
    expect(within(list).getAllByText("done")).toHaveLength(1);
    expect(within(list).getAllByText("to do")).toHaveLength(1);
  });
});

describe("Settings, Sending: the email connection", () => {
  it("the key is write-only: once stored it says so and offers to replace it, never showing it", async () => {
    sendSettings.get.mockResolvedValue(resend);
    show();
    expect(await screen.findByText("Stored")).toBeInTheDocument();
    expect(screen.getByText("Stored encrypted. It can never be shown again.")).toBeInTheDocument();
    expect(document.querySelector("input[type='password']")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Replace key" }));
    const field = document.querySelector("input[type='password']");
    expect(field).not.toBeNull();
    expect(field.value).toBe("");
  });

  it("saving without typing a key does not send one, so the stored key is kept", async () => {
    sendSettings.get.mockResolvedValue(resend);
    show();
    await screen.findByText("Stored");
    fireEvent.change(screen.getByLabelText("Sender name"), { target: { value: "Harbour Trading" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(sendSettings.save).toHaveBeenCalled());
    const body = sendSettings.save.mock.calls[0][0];
    expect(body).toMatchObject({ provider: "resend", fromName: "Harbour Trading", fromEmail: "accounts@harbour.ae", verifiedDomain: "harbour.ae" });
    expect("apiKey" in body).toBe(false);
  });

  it("a new key is sent once and the field is cleared afterwards", async () => {
    sendSettings.get.mockResolvedValue(resend);
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Replace key" }));
    fireEvent.change(document.querySelector("input[type='password']"), { target: { value: "re_new_key" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(sendSettings.save.mock.calls[0][0].apiKey).toBe("re_new_key"));
    await waitFor(() => expect(screen.queryByDisplayValue("re_new_key")).toBeNull());
  });

  it("the key and verified domain fields appear only for the real service", async () => {
    show();
    await screen.findByText("Off");
    expect(screen.queryByLabelText("Verified domain")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Resend/ }));
    expect(screen.getByLabelText("Verified domain")).toBeInTheDocument();
    expect(screen.getByLabelText("Resend API key")).toBeInTheDocument();
  });

  it("choosing your own mail server shows its fields and the Render warning, and hides the Resend ones", async () => {
    show();
    await screen.findByText("Off");
    expect(screen.queryByLabelText("Mail server")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Your own mail server/ }));
    expect(screen.getByLabelText("Mail server")).toBeInTheDocument();
    expect(screen.getByLabelText("Port")).toHaveValue("587");
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText(/Render's free plan\? It blocks connections to mail servers/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Verified domain")).toBeNull();
    expect(screen.queryByLabelText("Resend API key")).toBeNull();
  });

  it("saves the mail server details, and sends no Resend key or domain", async () => {
    show();
    await screen.findByText("Off");
    fireEvent.click(screen.getByRole("radio", { name: /Your own mail server/ }));
    fireEvent.change(screen.getByLabelText("Mail server"), { target: { value: "smtp.harbour.ae" } });
    fireEvent.change(screen.getByLabelText("Port"), { target: { value: "465" } });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "accounts@harbour.ae" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "app-pass-123" } });
    fireEvent.change(screen.getByLabelText("Sender address"), { target: { value: "accounts@harbour.ae" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(sendSettings.save).toHaveBeenCalled());
    const body = sendSettings.save.mock.calls[0][0];
    expect(body).toMatchObject({ provider: "smtp", smtpHost: "smtp.harbour.ae", smtpPort: 465, smtpUser: "accounts@harbour.ae", smtpPassword: "app-pass-123", fromEmail: "accounts@harbour.ae" });
    expect(typeof body.smtpPort).toBe("number");
    expect("apiKey" in body).toBe(false);
    expect("verifiedDomain" in body).toBe(false);
    await waitFor(() => expect(screen.queryByDisplayValue("app-pass-123")).toBeNull());
  });

  it("the mailbox password is write-only: stored, replaceable, never shown, and kept when not retyped", async () => {
    sendSettings.get.mockResolvedValue({ ...SETTINGS, provider: "smtp", smtpHost: "smtp.harbour.ae", smtpPort: 587, smtpUser: "accounts@harbour.ae", hasSmtpPassword: true, fromEmail: "accounts@harbour.ae", connected: true });
    show();
    await screen.findByText("Stored");
    expect(screen.getByLabelText("Mail server")).toHaveValue("smtp.harbour.ae");
    expect(document.querySelector("input[type='password']")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(sendSettings.save).toHaveBeenCalled());
    expect("smtpPassword" in sendSettings.save.mock.calls[0][0]).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Replace password" }));
    expect(document.querySelector("input[type='password']")).not.toBeNull();
  });

  it("says when the mail server refused the saved login", async () => {
    sendSettings.get.mockResolvedValue({ ...SETTINGS, provider: "smtp", smtpHost: "smtp.harbour.ae", hasSmtpPassword: true, connected: true, lastAuthFailureAt: "2026-10-08T08:00:00Z" });
    show();
    expect(await screen.findByText(/mail server refused the saved username or password/)).toBeInTheDocument();
  });

  it("says when the service refused the saved key", async () => {
    sendSettings.get.mockResolvedValue({ ...resend, lastAuthFailureAt: "2026-10-06T10:00:00Z" });
    show();
    expect(await screen.findByText(/refused the saved key the last time it was used/)).toBeInTheDocument();
  });

  it("a refusal on save is shown in place", async () => {
    sendSettings.get.mockResolvedValue(resend);
    sendSettings.save.mockRejectedValue(refusal("x@other.com is not on the verified domain harbour.ae", "FROM_DOMAIN_MISMATCH"));
    show();
    await screen.findByText("Stored");
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(await screen.findByText("x@other.com is not on the verified domain harbour.ae")).toBeInTheDocument();
  });
});

describe("Settings, Sending: the test email", () => {
  const typeAddress = async (value) => fireEvent.change(await screen.findByLabelText("Send the test to"), { target: { value } });

  it("sends a real test and says where it went", async () => {
    sendSettings.test.mockResolvedValue({ to: "me@harbour.ae", provider: "resend", messageId: "m1" });
    show();
    await typeAddress(" me@harbour.ae ");
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    expect(await screen.findByText("Sent to me@harbour.ae.")).toBeInTheDocument();
    expect(sendSettings.test).toHaveBeenCalledWith("me@harbour.ae");
  });

  it("says when nothing was really sent", async () => {
    sendSettings.test.mockResolvedValue({ to: "me@harbour.ae", provider: "console" });
    show();
    await typeAddress("me@harbour.ae");
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    expect(await screen.findByText(/recorded only: no email service is connected/)).toBeInTheDocument();
  });

  it("shows the provider's refusal in place, where it can be read, not in a toast", async () => {
    sendSettings.test.mockRejectedValue(refusal("The email service has not verified the sender domain yet.", "FROM_NOT_VERIFIED"));
    show();
    await typeAddress("me@harbour.ae");
    fireEvent.click(screen.getByRole("button", { name: "Send test" }));
    expect(await screen.findByText("The email service has not verified the sender domain yet.")).toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();
  });

  it("cannot be pressed with no address", async () => {
    show();
    expect(await screen.findByRole("button", { name: "Send test" })).toBeDisabled();
  });
});
