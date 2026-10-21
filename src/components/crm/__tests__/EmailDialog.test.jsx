import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// Writing to a customer from the CRM. What is asserted is what the dialog PROMISES: it offers the addresses we
// already hold, it never throws away what somebody typed without saying so, it refuses to send a letter with a hole
// in it, and it never calls a recorded letter a sent one.
const m = vi.hoisted(() => ({ emailRecipients: vi.fn(), emailTemplates: vi.fn(), sendEmail: vi.fn() }));
vi.mock("../../../lib/crmApi", () => ({
  crm: { emailRecipients: m.emailRecipients, emailTemplates: m.emailTemplates, sendEmail: m.sendEmail },
  CRM_WORK_CHANGED: "crm-work-changed",
  announceCrmWorkChanged: () => {},
}));

import EmailDialog from "../EmailDialog.jsx";

const REGARDING = { kind: "opportunity", id: "deal1" };
const show = (props = {}) => {
  const notify = vi.fn();
  const onSent = vi.fn();
  const onClose = vi.fn();
  render(<EmailDialog regarding={REGARDING} notify={notify} onSent={onSent} onClose={onClose} {...props} />);
  return { notify, onSent, onClose };
};
const press = (name) => fireEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.emailRecipients.mockResolvedValue({
    people: [
      { id: "c1", name: "Rania Haddad", email: "rania@gulfsteel.test", designation: "Buyer", primary: true },
      { id: "c2", name: "Omar Said", email: "omar@gulfsteel.test", designation: "", primary: false },
    ],
    deal: { title: "Coating line", value: 48000 },
  });
  m.emailTemplates.mockResolvedValue({
    templates: [{ key: "after-a-call", name: "After a call", subject: "Following up", body: "Hello {{contact.firstName}}," }],
    signature: "Imran\nPost Works",
    placeholders: [{ key: "contact.firstName", label: "Their first name" }],
  });
  m.sendEmail.mockResolvedValue({ sent: true, recordedOnly: false, provider: "resend", activity: { _id: "a1", email: { to: ["rania@gulfsteel.test"] } } });
});

describe("the email dialog", () => {
  it("fills the address in from the person we already hold, so nobody retypes it", async () => {
    show();
    await waitFor(() => expect(screen.getByLabelText(/^To/)).toHaveValue("rania@gulfsteel.test"));
    // and the others are one tap away, named as people rather than as addresses
    expect(await screen.findByRole("button", { name: /Omar Said/ })).toBeInTheDocument();
  });

  it("adds a second person without losing the first", async () => {
    show();
    await waitFor(() => expect(screen.getByLabelText(/^To/)).toHaveValue("rania@gulfsteel.test"));
    press(/Omar Said/);
    expect(screen.getByLabelText(/^To/)).toHaveValue("rania@gulfsteel.test, omar@gulfsteel.test");
  });

  it("never seeds over an address the writer typed", async () => {
    show({ to: [] });
    const to = await screen.findByLabelText(/^To/);
    fireEvent.change(to, { target: { value: "someone@else.test" } });
    await waitFor(() => expect(m.emailRecipients).toHaveBeenCalled());
    expect(to).toHaveValue("someone@else.test");
  });

  it("will not send a letter with nothing in it, and says which box", async () => {
    show({ to: ["a@b.com"] });
    await screen.findByLabelText(/^Subject/);
    press("Send");
    expect(await screen.findByText(/Give it a subject/i)).toBeInTheDocument();
    expect(screen.getByText(/Write something to send/i)).toBeInTheDocument();
    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  it("a template replaces the letter, and says so when something had been written", async () => {
    show();
    const body = await screen.findByLabelText(/^Message/);
    fireEvent.change(body, { target: { value: "I had started this" } });
    fireEvent.change(screen.getByLabelText(/Start from a template/), { target: { value: "after-a-call" } });
    expect(screen.getByLabelText(/^Subject/)).toHaveValue("Following up");
    expect(await screen.findByText(/The template replaced what you had written/i)).toBeInTheDocument();
  });

  it("warns about a placeholder nothing can fill, naming the ones that work", async () => {
    show();
    const body = await screen.findByLabelText(/^Message/);
    fireEvent.change(body, { target: { value: "Your {{customer.trn}} please" } });
    // The warning, not the textarea's own contents: it names what cannot be filled AND what can.
    const warning = await screen.findByText(/Nothing can fill/);
    expect(warning).toHaveTextContent("{{customer.trn}}");
    expect(warning).toHaveTextContent("{{contact.firstName}}");
  });

  it("sends what was written, and says where it went", async () => {
    const { notify, onSent, onClose } = show();
    await waitFor(() => expect(screen.getByLabelText(/^To/)).toHaveValue("rania@gulfsteel.test"));
    fireEvent.change(screen.getByLabelText(/^Subject/), { target: { value: "Our price" } });
    fireEvent.change(screen.getByLabelText(/^Message/), { target: { value: "Here it is." } });
    press("Send");

    await waitFor(() => expect(m.sendEmail).toHaveBeenCalled());
    expect(m.sendEmail.mock.calls[0][0]).toMatchObject({
      regarding: REGARDING, to: ["rania@gulfsteel.test"], subject: "Our price", body: "Here it is.",
    });
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringContaining("rania@gulfsteel.test"), undefined));
    expect(onSent).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("NEVER calls a recorded letter a sent one", async () => {
    m.sendEmail.mockResolvedValue({ sent: true, recordedOnly: true, provider: "console", activity: { _id: "a1", email: { to: ["rania@gulfsteel.test"] } } });
    const { notify } = show();
    await waitFor(() => expect(screen.getByLabelText(/^To/)).toHaveValue("rania@gulfsteel.test"));
    fireEvent.change(screen.getByLabelText(/^Subject/), { target: { value: "Our price" } });
    fireEvent.change(screen.getByLabelText(/^Message/), { target: { value: "Here it is." } });
    press("Send");
    await waitFor(() => expect(notify).toHaveBeenCalled());
    const [said, tone] = notify.mock.calls[0];
    expect(said).toMatch(/NOT emailed/);
    expect(tone).toBe("error");
  });

  it("says what the server refused, and keeps what was written", async () => {
    m.sendEmail.mockRejectedValue(new Error("The limit of 200 emails a day has been reached."));
    show();
    await waitFor(() => expect(screen.getByLabelText(/^To/)).toHaveValue("rania@gulfsteel.test"));
    fireEvent.change(screen.getByLabelText(/^Subject/), { target: { value: "Our price" } });
    fireEvent.change(screen.getByLabelText(/^Message/), { target: { value: "Here it is." } });
    press("Send");
    expect(await screen.findByText(/limit of 200 emails a day/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Message/)).toHaveValue("Here it is.");
  });

  it("always says that replies are not read here", async () => {
    show();
    expect(await screen.findByText(/Replies go to your own mailbox/i)).toBeInTheDocument();
  });
});
