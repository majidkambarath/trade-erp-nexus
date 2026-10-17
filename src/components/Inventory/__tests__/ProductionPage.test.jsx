import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), post: vi.fn(), reverse: vi.fn(), costReport: vi.fn(),
  apiGet: vi.fn(), postable: vi.fn(), grants: { allow: () => true },
}));
vi.mock("../../../lib/productionApi", () => ({ productions: { list: m.list, get: m.get, create: m.create, update: m.update, remove: m.remove, post: m.post, reverse: m.reverse, costReport: m.costReport } }));
vi.mock("../../../lib/accountingApi", () => ({ api: { get: m.apiGet }, accounting: { postableAccounts: m.postable } }));
vi.mock("../../shell/OrganisationContext", () => ({ useOrganisation: () => ({ canAny: (k) => m.grants.allow(k), can: (k) => m.grants.allow(k) }) }));
vi.mock("../../audit/AuditTrail", () => ({ VoucherAuditTrail: () => <div>trail</div> }));

import ProductionPage, { ProductionView } from "../ProductionPage";

const posted = {
  _id: "p1", productionNo: "PRD-2026-0001", date: "2026-10-17T00:00:00.000Z", status: "POSTED", ledgerPosted: true,
  finished: { stockId: "fin", itemId: "FIN1", itemName: "Coated part", qty: 1 },
  materials: [{ _id: "m1", stockId: "raw", itemId: "RAW1", itemName: "Raw part", qty: 1, cost: 50 }],
  costs: [{ _id: "c1", accountId: "trav", accountName: "Travelling", amount: 50 }, { _id: "c2", accountId: "pack", accountName: "Packing", amount: 20 }],
  totals: { materials: 50, costs: 70, total: 120, unitCost: 120 },
  actions: { edit: false, delete: false, post: false, reverse: true },
};

beforeEach(() => {
  for (const f of ["list", "get", "create", "update", "remove", "post", "reverse", "costReport", "apiGet", "postable"]) m[f].mockReset();
  m.grants.allow = () => true;
  m.list.mockResolvedValue([posted]);
  m.apiGet.mockResolvedValue({ stocks: [
    { _id: "raw", itemId: "RAW1", itemName: "Raw part", purchasePrice: 50, currentStock: 1 },
    { _id: "fin", itemId: "FIN1", itemName: "Coated part", purchasePrice: 0, currentStock: 0 },
    { _id: "srv", itemId: "SRV1", itemName: "Consulting", itemType: "service" },
  ] });
  m.postable.mockResolvedValue([
    { _id: "trav", accountName: "Travelling", accountCode: "EXP-1", category: "EXPENSE" },
    { _id: "cash", accountName: "Cash in Hand", accountCode: "CASH-1", category: "ASSET" },
  ]);
});

describe("production page", () => {
  it("lists productions with the item made, the unit cost and the status", async () => {
    render(<ProductionPage />);
    const table = await screen.findByRole("table", { name: "Productions" });
    expect(within(table).getByText("PRD-2026-0001")).toBeInTheDocument();
    expect(within(table).getByText("Coated part")).toBeInTheDocument();
    expect(within(table).getAllByText("120.00").length).toBeGreaterThan(0);
    expect(within(table).getByText("Posted")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New production/ })).toBeInTheDocument();
  });

  it("hides New production from a role without inventory.adjust (after the list has loaded)", async () => {
    m.grants.allow = (k) => (Array.isArray(k) ? k : [k]).every((x) => x !== "inventory.adjust");
    render(<ProductionPage />);
    await screen.findByRole("table", { name: "Productions" });
    expect(screen.queryByRole("button", { name: /New production/ })).not.toBeInTheDocument();
  });

  it("the form adds up the unit cost as costs are typed, and refuses an incomplete form on the screen", async () => {
    render(<ProductionPage />);
    fireEvent.click(await screen.findByRole("button", { name: /New production/ }));
    const dialog = await screen.findByRole("dialog", { name: "New production" });
    await waitFor(() => expect(m.postable).toHaveBeenCalled());
    expect(within(dialog).getByTestId("prd-unit-cost")).toHaveTextContent("0.00");
    fireEvent.change(within(dialog).getByLabelText("Cost 1 amount"), { target: { value: "70" } });
    expect(within(dialog).getByTestId("prd-unit-cost")).toHaveTextContent("70.00");
    // nothing chosen yet: refused on the screen, nothing sent
    fireEvent.click(within(dialog).getByRole("button", { name: "Save and post" }));
    expect(await within(dialog).findByText("Choose the item this production makes")).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();
  });

  it("asks for a tick when posting answers with a warning, and posts with it", async () => {
    m.get.mockResolvedValue({ ...posted, status: "DRAFT", actions: { edit: true, delete: true, post: true, reverse: false }, preview: { materials: [], totals: posted.totals } });
    const warning = Object.assign(new Error("w"), { code: "PRODUCTION_WARNINGS", details: { warnings: [{ code: "COST_EXCEEDS_SPEND", message: "Travelling: 50.00 is being moved into stock, but only 0.00 has been spent" }] } });
    m.post.mockRejectedValueOnce(warning).mockResolvedValueOnce(posted);
    render(<ProductionView id="p1" onClose={() => {}} onEdit={() => {}} onChanged={() => {}} onRemoved={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Post" }));
    const check = await screen.findByRole("dialog", { name: "Check before posting" });
    expect(within(check).getByText(/only 0.00 has been spent/)).toBeInTheDocument();
    const go = within(check).getByRole("button", { name: "Post anyway" });
    expect(go).toBeDisabled();
    fireEvent.click(within(check).getByRole("checkbox"));
    fireEvent.click(go);
    await waitFor(() => expect(m.post).toHaveBeenLastCalledWith("p1", { acknowledge: ["COST_EXCEEDS_SPEND"] }));
  });

  it("shows a posted production's materials and costs, and offers Reverse behind a typed confirmation", async () => {
    m.get.mockResolvedValue(posted);
    m.reverse.mockResolvedValue({ ...posted, status: "REVERSED" });
    const changed = vi.fn();
    render(<ProductionView id="p1" onClose={() => {}} onEdit={() => {}} onChanged={changed} onRemoved={() => {}} />);
    expect(await screen.findByText("Raw part x 1")).toBeInTheDocument();
    expect(screen.getByText("Travelling")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reverse" }));
    const confirm = await screen.findByRole("dialog", { name: /Reverse PRD-2026-0001/ });
    const button = within(confirm).getByRole("button", { name: "Reverse" });
    expect(button).toBeDisabled();
    fireEvent.change(within(confirm).getByRole("textbox"), { target: { value: "reverse" } });
    fireEvent.click(button);
    await waitFor(() => expect(changed).toHaveBeenCalledWith("PRD-2026-0001 reversed."));
  });

  it("the product cost tab breaks each item's cost down by material and by expense", async () => {
    m.costReport.mockResolvedValue({
      items: [{ stockId: "fin", itemId: "FIN1", itemName: "Coated part", qty: 1, count: 1, total: 170, unitCost: 170,
        materialLines: [{ stockId: "raw", itemName: "Raw part", qty: 1, cost: 50 }],
        costLines: [{ accountId: "trav", accountName: "Travelling", accountCode: "EXP-1", amount: 50 }, { accountId: "coat", accountName: "Coating powder", amount: 50 }, { accountId: "pack", accountName: "Packing", amount: 20 }] }],
      totals: { materials: 50, costs: 120, total: 170 },
    });
    render(<ProductionPage />);
    await screen.findByRole("table", { name: "Productions" });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Product cost" }));
    const card = await screen.findByRole("article", { name: "Coated part" });
    expect(within(card).getByText("Coating powder")).toBeInTheDocument();
    expect(within(card).getAllByText(/170\.00/).length).toBe(2);
  });
});
