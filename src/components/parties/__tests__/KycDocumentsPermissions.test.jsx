import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderAs, statusFor } from "../../accounting/__tests__/asRole";

// KYC documents: the list of document types is read by anyone with accounts.view; adding, changing and deleting a type
// is accounts.manage.

const mocks = vi.hoisted(() => ({ expiry: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
let status;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));
vi.mock("../../../lib/partyMasterApi", () => ({
  partyMaster: { documentExpiry: mocks.expiry, documentTypes: { list: mocks.list, create: mocks.create, update: mocks.update, remove: mocks.remove } },
}));

import KycDocuments from "../KycDocuments";

const TYPES = [
  { _id: "t1", name: "Trade licence", code: "TL", requiresExpiry: true, minLength: 3, maxLength: 30, isActive: true, isSystem: true },
  { _id: "t3", name: "Halal certificate", code: "HALAL", requiresExpiry: true, minLength: 15, maxLength: 15, isActive: false, isSystem: false },
];
const openTypes = () => fireEvent.mouseDown(screen.getByRole("tab", { name: "Document types" }), { button: 0 });

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.expiry.mockResolvedValue({ asOf: "2026-10-05", withinDays: 30, summary: { expired: 0, expiringSoon: 0, total: 0 }, rows: [] });
  mocks.list.mockResolvedValue(TYPES);
});

describe("KYC document types: who may change them", () => {
  it("lists the types but offers no New, Edit or Delete to someone who may only look", async () => {
    status = statusFor("accounts.view");
    await renderAs(<KycDocuments />);
    openTypes();
    expect(await screen.findByText("Halal certificate")).toBeInTheDocument(); // the types have loaded
    expect(screen.getByText("Trade licence")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New document type/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Trade licence" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Halal certificate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete Halal certificate" })).toBeNull();
  });

  it("offers New, Edit and Delete to someone who holds accounts.manage", async () => {
    status = statusFor("accounts.view", "accounts.manage");
    await renderAs(<KycDocuments />);
    openTypes();
    expect(await screen.findByText("Halal certificate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New document type/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Trade licence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Halal certificate" })).toBeInTheDocument();
    // a default type still cannot be deleted, whoever asks
    expect(screen.queryByRole("button", { name: "Delete Trade licence" })).toBeNull();
  });
});
