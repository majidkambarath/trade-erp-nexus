import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import SendHistory from "../SendHistory";
import { documentSends } from "../../../lib/sendDocumentsApi";

vi.mock("../../../lib/sendDocumentsApi", () => ({
  documentSends: { history: vi.fn(), retry: vi.fn(), withdraw: vi.fn() },
}));

const future = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const share = (over = {}) => ({ _id: "l1", publicId: "ABCDEFGHJKM", expiresAt: future, revokedAt: null, viewCount: 0, firstViewedAt: null, ...over });
const row = (over = {}) => ({
  _id: "s1", channel: "email", status: "SENT", to: ["ali@alnoor.ae"], sentAt: "2026-10-06T10:32:00.000Z", createdAt: "2026-10-06T10:32:00.000Z",
  sentByName: "Boss", attachment: { fileName: "Tax-invoice_INV-1.pdf" }, attempts: 1, openedAt: null, share: share(), shareLinkId: "l1", ...over,
});

let notify;
let onChanged;
const show = (rows) => {
  documentSends.history.mockResolvedValue({ rows, total: rows.length });
  return render(<SendHistory sourceType="Transaction" sourceId="so1" title="Tax invoice INV-1" notify={notify} onClose={vi.fn()} onChanged={onChanged} />);
};

beforeEach(() => {
  vi.clearAllMocks();
  notify = vi.fn();
  onChanged = vi.fn();
  documentSends.retry.mockResolvedValue({ _id: "s1" });
  documentSends.withdraw.mockResolvedValue({});
});

describe("send history", () => {
  it("lists each send with who, to whom, when and what became of it", async () => {
    show([row(), row({ _id: "s2", channel: "whatsapp", status: "HANDED_OFF", phone: "971501112222", to: [], share: share({ _id: "l2" }) })]);
    expect(await screen.findByText("ali@alnoor.ae")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp +971501112222")).toBeInTheDocument();
    expect(screen.getAllByText(/by Boss/).length).toBe(2);
    expect(screen.getAllByText(/Tax-invoice_INV-1[.]pdf/).length).toBeGreaterThan(0);
    expect(screen.getByText("Emailed")).toBeInTheDocument();
    expect(screen.getByText("Given on WhatsApp")).toBeInTheDocument();
    expect(screen.getByText(/WhatsApp was opened with the message ready. Whether it was sent is not known here/)).toBeInTheDocument();
  });

  it("an empty history says nothing has gone out", async () => {
    show([]);
    expect(await screen.findByText("Not sent yet")).toBeInTheDocument();
  });

  it("says when the customer opened the link, and how often", async () => {
    show([row({ openedAt: "2026-10-07T08:00:00.000Z", share: share({ viewCount: 3, firstViewedAt: "2026-10-07T08:00:00.000Z" }) })]);
    expect(await screen.findByText("Opened by customer")).toBeInTheDocument();
    expect(screen.getByText(/opened 3 times, first /)).toBeInTheDocument();
  });

  it("a failed send says why, when it will try again, and offers to try now", async () => {
    show([row({ status: "FAILED", retryable: true, lastError: "We could not reach the email service. It will try again shortly.", nextRetryAt: future, attempts: 2, sentAt: null, failedAt: "2026-10-06T10:33:00.000Z" })]);
    expect(await screen.findByText("Not delivered")).toBeInTheDocument();
    expect(screen.getByText(/could not reach the email service/)).toBeInTheDocument();
    expect(screen.getByText(/It will try again automatically at /)).toBeInTheDocument();
    expect(screen.getByText(/2 attempts/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again now" }));
    await waitFor(() => expect(documentSends.retry).toHaveBeenCalledWith("s1"));
    expect(notify).toHaveBeenCalledWith("Emailed on a retry");
    expect(onChanged).toHaveBeenCalled();
  });

  it("a refusal that needs a fresh send offers no retry", async () => {
    show([row({ status: "FAILED", retryable: false, lastError: "The email service refused one of the addresses." })]);
    await screen.findByText("Not delivered");
    expect(screen.queryByRole("button", { name: "Try again now" })).toBeNull();
  });
});

describe("withdrawing a link", () => {
  it("asks first, says what it does and does not undo, then withdraws", async () => {
    show([row()]);
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw link" }));
    const dlg = await screen.findByRole("dialog", { name: /withdraw this link/i });
    expect(dlg).toHaveTextContent("The email itself cannot be taken back");
    expect(documentSends.withdraw).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Withdraw link" }));
    await waitFor(() => expect(documentSends.withdraw).toHaveBeenCalledWith("l1", "Withdrawn from the send history"));
    expect(notify).toHaveBeenCalledWith("The link was withdrawn");
  });

  it("cancelling leaves the link alone", async () => {
    show([row()]);
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw link" }));
    const dlg = await screen.findByRole("dialog", { name: /withdraw this link/i });
    fireEvent.click(within(dlg).getByRole("button", { name: /cancel/i }));
    expect(documentSends.withdraw).not.toHaveBeenCalled();
  });

  it("a link already withdrawn, or expired, offers nothing to withdraw", async () => {
    show([row({ _id: "a", share: share({ _id: "la", revokedAt: past }) }), row({ _id: "b", share: share({ _id: "lb", expiresAt: past }) })]);
    expect(await screen.findByText("Link withdrawn")).toBeInTheDocument();
    expect(screen.getByText(/Link expired /)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Withdraw link" })).toBeNull();
  });

  it("the server's refusal is shown in place", async () => {
    documentSends.withdraw.mockRejectedValue(Object.assign(new Error("This link was already withdrawn"), { code: "ALREADY_REVOKED" }));
    show([row()]);
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw link" }));
    const dlg = await screen.findByRole("dialog", { name: /withdraw this link/i });
    fireEvent.click(within(dlg).getByRole("button", { name: "Withdraw link" }));
    expect(await screen.findAllByText("This link was already withdrawn")).not.toHaveLength(0);
  });
});
