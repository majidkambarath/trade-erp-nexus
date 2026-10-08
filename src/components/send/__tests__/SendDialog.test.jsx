import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import SendDialog from "../SendDialog";
import { documentSends, sendSettings } from "../../../lib/sendDocumentsApi";
import { ApiError } from "../../../lib/accountingApi";

vi.mock("../../../lib/sendDocumentsApi", () => ({
  sendSettings: { get: vi.fn() },
  documentSends: { send: vi.fn(), handoff: vi.fn() },
}));

const SETTINGS = { enabled: true, shareEnabled: true, attachPdf: true, shareLinkDays: 30, defaultNote: "" };
const pdf = (over = {}) => Object.assign(new File(["%PDF-1.4 fake"], "Tax-invoice_INV-1.pdf", { type: "application/pdf" }), { pageCount: 1 }, over);
const doc = (over = {}) => ({
  kind: "tax_invoice", sourceType: "Transaction", id: "so1", number: "INV-2026-0042", title: "Tax invoice", companyName: "Harbour Trading",
  party: { email: "Ali@AlNoor.ae", phone: "050 111 2222", contacts: [{ email: "sara@alnoor.ae", isPrimary: true }] }, ...over,
});

let notify;
let onSent;
let onClose;
let attachment;
const show = (d = doc(), a = attachment) => render(<MemoryRouter><SendDialog doc={d} attachment={a} notify={notify} onSent={onSent} onClose={onClose} /></MemoryRouter>);
const dialog = () => screen.findByRole("dialog");
const openReady = async (d, a) => {
  show(d, a);
  const dlg = await dialog();
  await within(dlg).findByText(/Customer copy · 1 page/);
  return dlg;
};
const press = (dlg, name) => fireEvent.click(within(dlg).getByRole("button", { name }));

beforeEach(() => {
  vi.clearAllMocks();
  notify = vi.fn();
  onSent = vi.fn();
  onClose = vi.fn();
  sendSettings.get.mockResolvedValue(SETTINGS);
  attachment = { label: "Customer copy", build: vi.fn(async () => pdf()) };
  window.open = vi.fn();
});

describe("SendDialog by email", () => {
  it("starts with the customer's address and primary contact, a subject from the document's own title, and the PDF described", async () => {
    const dlg = await openReady();
    expect(dlg).toHaveTextContent("Send tax invoice INV-2026-0042");
    expect(within(dlg).getByText("ali@alnoor.ae")).toBeInTheDocument();
    expect(within(dlg).getByText("sara@alnoor.ae")).toBeInTheDocument();
    expect(within(dlg).getByLabelText("Subject")).toHaveValue("Tax invoice INV-2026-0042 from Harbour Trading");
    expect(within(dlg).getByText(/Customer copy · 1 page · \d+ B/)).toBeInTheDocument();
    expect(within(dlg).getByText(/stops working after 30 days/)).toBeInTheDocument();
    expect(attachment.build).toHaveBeenCalledTimes(1);
  });

  it("sends the customer copy as a file, with the addresses, and closes with a confirmation", async () => {
    documentSends.send.mockResolvedValue({ duplicate: false, send: { _id: "s1", to: ["ali@alnoor.ae"] }, share: { url: "https://x/d/T" } });
    const dlg = await openReady();
    fireEvent.change(within(dlg).getByLabelText("Message"), { target: { value: "  Thank you  " } });
    press(dlg, /send email/i);
    await waitFor(() => expect(documentSends.send).toHaveBeenCalledTimes(1));
    const [fields, file, key] = documentSends.send.mock.calls[0];
    expect(fields).toMatchObject({ docType: "tax_invoice", sourceId: "so1", to: ["ali@alnoor.ae", "sara@alnoor.ae"], cc: [], note: "Thank you", includeShareLink: true });
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("Tax-invoice_INV-1.pdf");
    expect(key).toMatch(/^send-/);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ send: expect.objectContaining({ _id: "s1" }) }));
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Tax invoice INV-2026-0042 emailed to ali@alnoor\.ae and 1 more/));
  });

  it("unticking the attachment sends the link only", async () => {
    documentSends.send.mockResolvedValue({ send: { _id: "s1" } });
    const dlg = await openReady();
    fireEvent.click(within(dlg).getByRole("checkbox", { name: /attach the pdf/i }));
    press(dlg, /send email/i);
    await waitFor(() => expect(documentSends.send).toHaveBeenCalled());
    expect(documentSends.send.mock.calls[0][1]).toBeNull();
  });

  it("refuses a bad address before any call, and says which", async () => {
    const dlg = await openReady(doc({ party: { email: "", contacts: [] } }));
    fireEvent.change(within(dlg).getByLabelText("To"), { target: { value: "not-an-address" } });
    press(dlg, /send email/i);
    expect(await within(dlg).findByText("not-an-address does not look like an email address.")).toBeInTheDocument();
    expect(documentSends.send).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("a customer with no email is asked for one, and told it is not saved", async () => {
    const dlg = await openReady(doc({ party: { email: "", contacts: [] } }));
    expect(within(dlg).getByText(/has no email saved.*not saved on the customer/)).toBeInTheDocument();
    press(dlg, /send email/i);
    expect(await within(dlg).findByText("Who should it go to? Add an email address.")).toBeInTheDocument();
    expect(documentSends.send).not.toHaveBeenCalled();
  });

  it("an address typed and not yet turned into a chip still counts", async () => {
    documentSends.send.mockResolvedValue({ send: { _id: "s1" } });
    const dlg = await openReady(doc({ party: { email: "", contacts: [] } }));
    fireEvent.change(within(dlg).getByLabelText("To"), { target: { value: "new@alnoor.ae" } });
    press(dlg, /send email/i);
    await waitFor(() => expect(documentSends.send).toHaveBeenCalled());
    expect(documentSends.send.mock.calls[0][0].to).toEqual(["new@alnoor.ae"]);
  });

  it("an address becomes a chip when a comma is typed, and a chip can be removed", async () => {
    const dlg = await openReady(doc({ party: { email: "", contacts: [] } }));
    fireEvent.change(within(dlg).getByLabelText("To"), { target: { value: "a@x.ae, b@x.ae," } });
    expect(within(dlg).getByText("a@x.ae")).toBeInTheDocument();
    fireEvent.click(within(dlg).getByRole("button", { name: "Remove a@x.ae" }));
    expect(within(dlg).queryByText("a@x.ae")).toBeNull();
    expect(within(dlg).getByText("b@x.ae")).toBeInTheDocument();
  });

  it("the server's refusal appears inside the dialog, the dialog stays open, and nothing typed is lost", async () => {
    documentSends.send.mockRejectedValue(new ApiError("The email service has not verified the sender domain yet. Add its DNS records, then try again.", { code: "FROM_NOT_VERIFIED", status: 422 }));
    const dlg = await openReady();
    fireEvent.change(within(dlg).getByLabelText("Message"), { target: { value: "Please pay by Friday" } });
    press(dlg, /send email/i);
    expect(await within(dlg).findByRole("alert")).toHaveTextContent("has not verified the sender domain");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(within(dlg).getByLabelText("Message")).toHaveValue("Please pay by Friday");
    expect(within(dlg).getByText("ali@alnoor.ae")).toBeInTheDocument();
  });

  it("pressing Send again after a refusal keeps the same key (the same press), so the server can tell", async () => {
    documentSends.send.mockRejectedValueOnce(new ApiError("down", { code: "PROVIDER_UNREACHABLE", status: 503 })).mockResolvedValueOnce({ send: { _id: "s1" } });
    const dlg = await openReady();
    press(dlg, /send email/i);
    await within(dlg).findByRole("alert");
    press(dlg, /send email/i);
    await waitFor(() => expect(documentSends.send).toHaveBeenCalledTimes(2));
    expect(documentSends.send.mock.calls[1][2]).toBe(documentSends.send.mock.calls[0][2]);
    expect(attachment.build).toHaveBeenCalledTimes(1);
  });

  it("a send the server says was just made offers 'Send anyway', which is a new press with force", async () => {
    documentSends.send.mockRejectedValueOnce(new ApiError("This was already sent a moment ago. Send it again?", { code: "DUPLICATE_SEND", status: 409 })).mockResolvedValueOnce({ send: { _id: "s2" } });
    const dlg = await openReady();
    press(dlg, /send email/i);
    expect(await within(dlg).findByText(/already sent a moment ago/)).toBeInTheDocument();
    press(dlg, /send anyway/i);
    await waitFor(() => expect(documentSends.send).toHaveBeenCalledTimes(2));
    expect(documentSends.send.mock.calls[1][0].force).toBe("true");
    expect(documentSends.send.mock.calls[1][2]).not.toBe(documentSends.send.mock.calls[0][2]);
  });
});

describe("SendDialog when the PDF cannot go", () => {
  it("a PDF that is too long is not attached, with the reason, and the email still goes with the link", async () => {
    documentSends.send.mockResolvedValue({ send: { _id: "s1" } });
    attachment = { label: "Customer copy", build: vi.fn(async () => pdf({ pageCount: 9 })) };
    show();
    const dlg = await dialog();
    expect(await within(dlg).findByText(/This document is 9 pages. The email will carry the link instead/)).toBeInTheDocument();
    expect(within(dlg).getByRole("checkbox", { name: /attach the pdf/i })).toBeDisabled();
    press(dlg, /send email/i);
    await waitFor(() => expect(documentSends.send).toHaveBeenCalled());
    expect(documentSends.send.mock.calls[0][1]).toBeNull();
  });

  it("a PDF that cannot be drawn says so and the email carries the link", async () => {
    attachment = { label: "Customer copy", build: vi.fn(async () => { throw new Error("canvas failed"); }) };
    show();
    const dlg = await dialog();
    expect(await within(dlg).findByText(/The PDF could not be drawn \(canvas failed\)\. The email will carry the link instead\./)).toBeInTheDocument();
  });

  it("a company that runs link-only shows no attach option", async () => {
    sendSettings.get.mockResolvedValue({ ...SETTINGS, attachPdf: false });
    show();
    const dlg = await dialog();
    await within(dlg).findByLabelText("Subject");
    expect(within(dlg).queryByRole("checkbox", { name: /attach the pdf/i })).toBeNull();
    expect(attachment.build).not.toHaveBeenCalled();
  });
});

describe("SendDialog by WhatsApp", () => {
  const toWhatsApp = async (d) => {
    show(d);
    const dlg = await dialog();
    await within(dlg).findByLabelText("Subject");
    press(dlg, "WhatsApp");
    return dlg;
  };

  it("opens WhatsApp with the message the server wrote, and says it cannot know what happens next", async () => {
    documentSends.handoff.mockResolvedValue({ waUrl: "https://wa.me/971501112222?text=Hello", send: { _id: "w1" }, share: {}, duplicate: false });
    const dlg = await toWhatsApp();
    expect(within(dlg).getByLabelText("WhatsApp number")).toHaveValue("050 111 2222");
    expect(within(dlg).getByText("Opens WhatsApp for +971501112222.")).toBeInTheDocument();
    expect(within(dlg).getByText(/cannot tell whether it was sent/)).toBeInTheDocument();
    expect(within(dlg).getByText(/given on whatsapp/i)).toBeInTheDocument();
    press(dlg, /open whatsapp/i);
    await waitFor(() => expect(window.open).toHaveBeenCalledWith("https://wa.me/971501112222?text=Hello", "_blank", "noopener"));
    expect(documentSends.handoff.mock.calls[0][0]).toMatchObject({ docType: "tax_invoice", sourceId: "so1", phone: "050 111 2222" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/WhatsApp is open with the message ready/));
    expect(documentSends.send).not.toHaveBeenCalled();
  });

  it("a press the server already handled does not open WhatsApp again", async () => {
    documentSends.handoff.mockResolvedValue({ waUrl: null, send: { _id: "w1" }, duplicate: true });
    const dlg = await toWhatsApp();
    press(dlg, /open whatsapp/i);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(window.open).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("This was already handed over to WhatsApp.");
  });

  it("a number that is not a number is refused before any call", async () => {
    const dlg = await toWhatsApp();
    fireEvent.change(within(dlg).getByLabelText("WhatsApp number"), { target: { value: "call me" } });
    press(dlg, /open whatsapp/i);
    expect(await within(dlg).findByText(/does not look like a phone number/)).toBeInTheDocument();
    expect(documentSends.handoff).not.toHaveBeenCalled();
  });

  it("a customer with no number can still go through the contact picker", async () => {
    documentSends.handoff.mockResolvedValue({ waUrl: "https://wa.me/?text=Hello", send: { _id: "w1" }, duplicate: false });
    const dlg = await toWhatsApp(doc({ party: { email: "a@x.ae", phone: "", contacts: [] } }));
    expect(within(dlg).getByText(/Leave it empty to choose the contact in WhatsApp/)).toBeInTheDocument();
    press(dlg, /open whatsapp/i);
    await waitFor(() => expect(documentSends.handoff).toHaveBeenCalled());
    expect(documentSends.handoff.mock.calls[0][0].phone).toBeUndefined();
  });
});

describe("SendDialog in record-only (test) mode", () => {
  it("says before sending that nothing will be emailed, and afterwards that it was only recorded", async () => {
    sendSettings.get.mockResolvedValue({ ...SETTINGS, provider: "console" });
    documentSends.send.mockResolvedValue({ duplicate: false, send: { _id: "s1", provider: "console", to: ["ali@alnoor.ae"] }, share: { url: "https://x/d/T" } });
    const dlg = await openReady();
    expect(within(dlg).getByText(/Test mode: nothing will be emailed/)).toBeInTheDocument();
    expect(within(dlg).getByRole("link", { name: /open settings/i })).toHaveAttribute("href", "/settings?tab=sending");
    press(dlg, /send email/i);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/recorded, but NOT emailed/));
    expect(notify).not.toHaveBeenCalledWith(expect.stringMatching(/ emailed to /));
  });

  it("a real email service shows no test-mode note and says emailed", async () => {
    sendSettings.get.mockResolvedValue({ ...SETTINGS, provider: "resend" });
    documentSends.send.mockResolvedValue({ duplicate: false, send: { _id: "s1", provider: "resend", to: ["ali@alnoor.ae"] }, share: null });
    const dlg = await openReady();
    expect(within(dlg).queryByText(/Test mode/)).not.toBeInTheDocument();
    press(dlg, /send email/i);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/emailed to ali@alnoor.ae/));
  });

  it("WhatsApp is not affected, so its tab carries no test-mode note", async () => {
    sendSettings.get.mockResolvedValue({ ...SETTINGS, provider: "console" });
    const dlg = await openReady();
    press(dlg, "WhatsApp");
    expect(within(dlg).queryByText(/Test mode/)).not.toBeInTheDocument();
  });
});

describe("SendDialog when sending is not set up", () => {
  it("email is blocked with a link to Settings, and WhatsApp still works", async () => {
    sendSettings.get.mockResolvedValue({ ...SETTINGS, enabled: false });
    show();
    const dlg = await dialog();
    expect(await within(dlg).findByText(/Email is not switched on yet/)).toBeInTheDocument();
    expect(within(dlg).getByRole("link", { name: /set it up in settings/i })).toHaveAttribute("href", "/settings?tab=sending");
    expect(within(dlg).getByRole("button", { name: /send email/i })).toBeDisabled();
    press(dlg, "WhatsApp");
    expect(within(dlg).getByRole("button", { name: /open whatsapp/i })).toBeEnabled();
  });

  it("with links switched off, WhatsApp is blocked too, because it carries the link", async () => {
    sendSettings.get.mockResolvedValue({ ...SETTINGS, shareEnabled: false });
    show();
    const dlg = await dialog();
    await within(dlg).findByLabelText("Subject");
    press(dlg, "WhatsApp");
    expect(within(dlg).getByText(/Links are switched off, and WhatsApp carries the link/)).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: /open whatsapp/i })).toBeDisabled();
  });
});

describe("SendDialog while the page behind it re-renders", () => {
  it("still finishes drawing the PDF when the page hands over a new attachment object mid-way", async () => {
    let finish;
    const slow = () => new Promise((resolve) => { finish = () => resolve(pdf()); });
    const first = { label: "Customer copy", build: vi.fn(slow) };
    const { rerender } = render(<MemoryRouter><SendDialog doc={doc()} attachment={first} notify={notify} onSent={onSent} onClose={onClose} /></MemoryRouter>);
    const dlg = await dialog();
    await within(dlg).findByText(/Drawing the PDF/);
    // the list behind re-renders (a toast, a reload): every render builds a fresh object
    for (let i = 0; i < 3; i++) rerender(<MemoryRouter><SendDialog doc={doc()} attachment={{ label: "Customer copy", build: vi.fn(slow) }} notify={notify} onSent={onSent} onClose={onClose} /></MemoryRouter>);
    finish();
    expect(await within(dlg).findByText(/Customer copy · 1 page/)).toBeInTheDocument();
    expect(first.build).toHaveBeenCalledTimes(1);
  });

  it("does not draw it twice, and does not touch a dialog that was closed meanwhile", async () => {
    let finish;
    const build = vi.fn(() => new Promise((resolve) => { finish = () => resolve(pdf()); }));
    const { unmount } = render(<MemoryRouter><SendDialog doc={doc()} attachment={{ label: "Customer copy", build }} notify={notify} onSent={onSent} onClose={onClose} /></MemoryRouter>);
    await screen.findByText(/Drawing the PDF/);
    unmount();
    finish(); // resolves after the dialog is gone: must not warn or throw
    await Promise.resolve();
    expect(build).toHaveBeenCalledTimes(1);
  });
});
