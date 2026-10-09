import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

// The send history is for whoever can see the document (the server lists sends for sales.send or sales.view). What can be
// DONE from it, trying a failed send again and withdrawing a link, is sales.send (POST /messaging/sends/:id/retry and
// /messaging/shares/:id/revoke).
vi.mock("../../../lib/sendDocumentsApi", () => ({
  documentSends: { history: vi.fn(), retry: vi.fn(), withdraw: vi.fn() },
}));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import SendHistory from "../SendHistory";
import { documentSends } from "../../../lib/sendDocumentsApi";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";

const future = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
const share = (over = {}) => ({ _id: "l1", publicId: "ABCDEFGHJKM", expiresAt: future, revokedAt: null, viewCount: 0, firstViewedAt: null, ...over });
const row = (over = {}) => ({
  _id: "s1", channel: "email", status: "SENT", to: ["ali@alnoor.ae"], sentAt: "2026-10-06T10:32:00.000Z", createdAt: "2026-10-06T10:32:00.000Z",
  sentByName: "Boss", attachment: { fileName: "Tax-invoice_INV-1.pdf" }, attempts: 1, openedAt: null, share: share(), shareLinkId: "l1", ...over,
});
const failed = row({ _id: "s2", status: "FAILED", retryable: true, lastError: "We could not reach the email service.", nextRetryAt: future, attempts: 2, sentAt: null, failedAt: "2026-10-06T10:33:00.000Z", to: ["omar@alnoor.ae"], share: share({ _id: "l2" }), shareLinkId: "l2" });

const show = (grants, rows) => {
  orgStatus = statusFor(grants);
  documentSends.history.mockResolvedValue({ rows, total: rows.length });
  return render(<AsRole><SendHistory sourceType="Transaction" sourceId="so1" title="Tax invoice INV-1" notify={vi.fn()} onClose={vi.fn()} onChanged={vi.fn()} /></AsRole>);
};

beforeEach(() => {
  vi.clearAllMocks();
  documentSends.retry.mockResolvedValue({ _id: "s2" });
  documentSends.withdraw.mockResolvedValue({});
});

describe("send history for a person who may see the document but not send (sales.view)", () => {
  it("shows what was sent, to whom, when and what became of it, with no Try again and no Withdraw link", async () => {
    show(["sales.view"], [row(), failed]);
    await roleLoaded();
    // the history is on screen
    expect(await screen.findByText("ali@alnoor.ae")).toBeInTheDocument();
    expect(screen.getByText("omar@alnoor.ae")).toBeInTheDocument();
    expect(screen.getAllByText(/by Boss/).length).toBe(2);
    expect(screen.getByText("Emailed")).toBeInTheDocument();
    expect(screen.getByText("Not delivered")).toBeInTheDocument();
    expect(screen.getByText(/could not reach the email service/)).toBeInTheDocument();
    expect(screen.getByText(/It will try again automatically at /)).toBeInTheDocument();
    expect(screen.getAllByText(/Link works until /).length).toBe(2);
    // and nothing to press
    expect(screen.queryByRole("button", { name: "Try again now" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Withdraw link" })).toBeNull();
    expect(documentSends.retry).not.toHaveBeenCalled();
    expect(documentSends.withdraw).not.toHaveBeenCalled();
  });
});

describe("send history for a person who holds sales.send", () => {
  it("offers to try a failed send again and to withdraw a link that still works", async () => {
    show(["sales.view", "sales.send"], [row(), failed]);
    await roleLoaded();
    await screen.findByText("ali@alnoor.ae");
    expect(screen.getByRole("button", { name: "Try again now" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Withdraw link" })).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Try again now" }));
    await waitFor(() => expect(documentSends.retry).toHaveBeenCalledWith("s2"));
  });

  it("withdrawing a link still asks first", async () => {
    show(["sales.send"], [row()]);
    await roleLoaded();
    fireEvent.click(await screen.findByRole("button", { name: "Withdraw link" }));
    const dlg = await screen.findByRole("dialog", { name: /withdraw this link/i });
    expect(documentSends.withdraw).not.toHaveBeenCalled();
    fireEvent.click(within(dlg).getByRole("button", { name: "Withdraw link" }));
    await waitFor(() => expect(documentSends.withdraw).toHaveBeenCalledWith("l1", "Withdrawn from the send history"));
  });
});
