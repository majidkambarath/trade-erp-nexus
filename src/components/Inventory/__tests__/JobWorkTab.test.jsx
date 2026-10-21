import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), send: vi.fn(), receive: vi.fn(), cancel: vi.fn(), remove: vi.fn(), reverseReceipt: vi.fn(), activity: vi.fn(),
  apiGet: vi.fn(), postable: vi.fn(), allow: () => true,
}));
vi.mock("../../../lib/jobWorkApi", () => ({ jobWork: { list: m.list, get: m.get, create: m.create, update: m.update, send: m.send, receive: m.receive, cancel: m.cancel, remove: m.remove, reverseReceipt: m.reverseReceipt, activity: m.activity } }));
vi.mock("../../../lib/accountingApi", () => ({ api: { get: m.apiGet }, accounting: { postableAccounts: m.postable } }));
vi.mock("../../shell/OrganisationContext", () => ({ useOrganisation: () => ({ status: { organisation: { country: "IN" } }, canAny: (k) => m.allow(k), can: (k) => m.allow(k) }) }));
vi.mock("../../PurchaseOrder/shared/useCompanyProfile", () => ({ useCompanyProfile: () => ({ companyName: "Brivox Production" }) }));
vi.mock("../../PurchaseOrder/shared/InvoiceScreen", () => ({
  default: ({ sheet, actions, banner, statusLabel, copies }) => (
    <div><h1>{sheet.title}</h1><p>{statusLabel}</p><p>{copies.join(" | ")}</p>{actions}{banner}</div>
  ),
}));

import JobWorkTab from "../jobWork/JobWorkTab";
import { clearPageSessions } from "../../../lib/pageSession";

const sent = {
  _id: "j1", jobWorkNo: "JWC-2026-0001", status: "SENT", date: "2026-10-18T00:00:00.000Z", returnBy: "2027-10-18T00:00:00.000Z", overdue: false,
  purpose: "Powder coating", jobWorker: { name: "Shine Powder Coaters", taxId: "27ABCDE1234F1Z5" },
  lines: [{ _id: "L1", rawStockId: "raw", rawItemId: "KH-RAW", rawName: "Holder (raw)", qtySent: 10, unitValue: 50, finishedStockId: "fin", finishedName: "Holder", finishedPerRaw: 1 }],
  receipts: [], progress: { lines: [{ lineId: "L1", qtySent: 10, atWorker: 10, finished: 0, returned: 0 }] }, atWorker: 10,
  actions: { edit: false, delete: false, send: false, receive: true, cancel: true, challan: true },
};

beforeEach(() => {
  clearPageSessions(); // the tab remembers the open job between visits
  for (const k of Object.keys(m)) if (typeof m[k]?.mockReset === "function") m[k].mockReset();
  m.allow = () => true;
  m.list.mockResolvedValue([sent]);
  m.get.mockResolvedValue(sent);
  m.apiGet.mockImplementation((url) => {
    if (url === "/vendors/vendors") return Promise.resolve([{ _id: "v1", vendorName: "Shine Powder Coaters", vendorId: "V1" }]);
    if (url === "/job-work/with-job-worker") return Promise.resolve({ raw: 10 });
    return Promise.resolve({ stocks: [{ _id: "raw", itemId: "KH-RAW", itemName: "Holder (raw)", currentStock: 14, purchasePrice: 50 }, { _id: "fin", itemId: "KH", itemName: "Holder", currentStock: 0 }] });
  });
  m.postable.mockResolvedValue([{ _id: "coat", accountName: "Powder Coating Charges", accountCode: "C1", category: "EXPENSE" }]);
});

describe("job work tab", () => {
  it("lists jobs with what is still out and the return-by day (India)", async () => {
    render(<JobWorkTab />);
    const table = await screen.findByRole("table", { name: "Job work" });
    expect(within(table).getByText("JWC-2026-0001")).toBeInTheDocument();
    expect(within(table).getByText("Shine Powder Coaters")).toBeInTheDocument();
    expect(within(table).getByText("With job worker")).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Return by" })).toBeInTheDocument();
    expect(screen.getByText(/s\.143, Rule 55/)).toBeInTheDocument();
  });

  it("the send form says how many are free to send, and refuses an item coming back as itself", async () => {
    render(<JobWorkTab />);
    fireEvent.click(await screen.findByRole("button", { name: /Send to job worker/ }));
    const dialog = await screen.findByRole("dialog", { name: "Send to job worker" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and send" }));
    expect(await within(dialog).findByText("Choose the job worker (the coater)")).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("opens the challan, and receiving back posts with the costs, asking for a tick on a warning", async () => {
    const warning = Object.assign(new Error("w"), { code: "PRODUCTION_WARNINGS", details: { warnings: [{ code: "COST_EXCEEDS_SPEND", message: "Powder Coating Charges: 240.00 is being moved into stock, but only 0.00 has been spent" }] } });
    m.receive.mockRejectedValueOnce(warning).mockResolvedValueOnce({ ...sent, productions: [{ id: "p1", no: "PRD-2026-0001" }] });
    render(<JobWorkTab />);
    fireEvent.click(await screen.findByRole("button", { name: "View JWC-2026-0001" }));
    expect(await screen.findByRole("heading", { name: "Delivery challan - job work" })).toBeInTheDocument();
    expect(screen.getByText(/Original for the job worker/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Receive back/ }));
    const dialog = await screen.findByRole("dialog", { name: /Receive back on JWC-2026-0001/ });
    fireEvent.change(within(dialog).getByLabelText("Came back finished 1"), { target: { value: "6" } });
    expect(within(dialog).getByLabelText("Parts used 1")).toHaveValue(6);
    fireEvent.change(within(dialog).getByLabelText("Cost 1 amount"), { target: { value: "240" } });
    await waitFor(() => expect(m.postable).toHaveBeenCalled());
    fireEvent.click(within(dialog).getByRole("button", { name: "Receive and post" }));
    const check = await screen.findByRole("dialog", { name: "Check before posting" });
    fireEvent.click(within(check).getByRole("checkbox"));
    fireEvent.click(within(check).getByRole("button", { name: "Post anyway" }));
    await waitFor(() => expect(m.receive).toHaveBeenCalledTimes(2));
    expect(m.receive.mock.calls[1][1]).toMatchObject({ lines: [{ lineId: "L1", finishedQty: 6, rawConsumed: 6, rawReturned: 0 }], acknowledge: ["COST_EXCEEDS_SPEND"] });
  });

  it("hides the actions from a role without inventory.adjust", async () => {
    m.allow = (k) => (Array.isArray(k) ? k : [k]).every((x) => x !== "inventory.adjust");
    render(<JobWorkTab />);
    await screen.findByRole("table", { name: "Job work" });
    expect(screen.queryByRole("button", { name: /Send to job worker/ })).not.toBeInTheDocument();
  });
});
