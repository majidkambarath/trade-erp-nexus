import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

// Process orders, phase 2: a product's saved route plans a new order; costs recorded while it runs (from the expense
// voucher that paid them) fill the finish dialog; a reject reason is sent; the Routes and Analysis tabs.
const m = vi.hoisted(() => ({
  list: vi.fn(), get: vi.fn(), create: vi.fn(), release: vi.fn(), completeStep: vi.fn(), finish: vi.fn(), addCost: vi.fn(), removeCost: vi.fn(),
  expenseVouchers: vi.fn(), analysis: vi.fn(), plan: vi.fn(), routes: vi.fn(), routeCreate: vi.fn(), routeUpdate: vi.fn(),
  apiGet: vi.fn(), postable: vi.fn(), grants: { allow: () => true },
}));
vi.mock("../../../lib/processOrderApi", () => ({
  PROCESS_WORK_CHANGED: "process-work-changed",
  processOrders: {
    list: m.list, get: m.get, create: m.create, update: m.create, release: m.release, completeStep: m.completeStep, finish: m.finish,
    addCost: m.addCost, removeCost: m.removeCost, expenseVouchers: m.expenseVouchers, analysis: m.analysis,
    assignees: () => Promise.resolve([{ id: "u1", name: "Ravi" }]), lastSteps: () => Promise.resolve([]),
    startStep: vi.fn(), sendStep: vi.fn(), remove: vi.fn(), cancel: vi.fn(), reopen: vi.fn(), board: vi.fn(),
  },
  processRoutes: { plan: m.plan, list: m.routes, create: m.routeCreate, update: m.routeUpdate, remove: vi.fn(), get: vi.fn() },
}));
vi.mock("../../../lib/accountingApi", () => ({ api: { get: m.apiGet }, accounting: { postableAccounts: m.postable } }));
vi.mock("../../shell/OrganisationContext", () => ({ useOrganisation: () => ({ canAny: (k) => m.grants.allow(k), can: (k) => m.grants.allow(k), me: { id: "u1" } }) }));

import ProcessOrdersTab, { CompleteStepDialog } from "../process/ProcessOrdersTab";
import RoutesTab from "../process/RoutesTab";
import ProcessAnalysis from "../process/ProcessAnalysis";

const route = { _id: "r1", finished: { stockId: "fin", itemId: "FIN1", itemName: "Keychain holder" }, batchQty: 10, materials: [{ stockId: "raw", itemName: "Raw holder", qty: 10 }], steps: [{ name: "Bending", mode: "in_house", assigneeId: "u1", assigneeName: "Ravi", days: 2 }, { name: "Packing", mode: "in_house", days: 1 }], totalDays: 3 };
const doneStep = { _id: "s1", seq: 1, name: "Bending", mode: "in_house", status: "DONE", plannedQty: 10, qtyDone: 9, dueState: "done", actions: {} };
const order = (over) => ({
  _id: "o1", processNo: "PRO-2026-0001", status: "OPEN", finished: { stockId: "fin", itemName: "Keychain holder", qty: 10 }, materials: [{ stockId: "raw", itemName: "Raw holder", qty: 10 }],
  steps: [doneStep], current: null, readyToFinish: true, finishedQty: 9, costs: [], costTotal: 0, actions: { finish: true, addCost: true }, ...over,
});

beforeEach(() => {
  for (const f of Object.keys(m)) if (typeof m[f] === "function" && m[f].mockReset) m[f].mockReset();
  m.grants.allow = () => true;
  m.list.mockResolvedValue([order()]);
  m.get.mockResolvedValue(order());
  m.plan.mockResolvedValue({ route, order: null });
  m.routes.mockResolvedValue([route]);
  m.expenseVouchers.mockResolvedValue([{ id: "v1", voucherNo: "EV-2026-0004", date: "2026-10-18", accountId: "coat", accountName: "Powder Coating Charges", party: "Shine", description: "Coating", net: 90, used: 30, left: 60 }]);
  m.apiGet.mockImplementation((url) => Promise.resolve(url.startsWith("/vendors") ? [] : { stocks: [{ _id: "raw", itemId: "RAW1", itemName: "Raw holder", currentStock: 50 }, { _id: "fin", itemId: "FIN1", itemName: "Keychain holder", currentStock: 0 }] }));
  m.postable.mockResolvedValue([{ _id: "coat", accountName: "Powder Coating Charges", accountCode: "EXP-7", category: "EXPENSE" }]);
});

// a searchable picker: type to find, Enter to choose
const pick = (label, text) => {
  const picker = screen.getByLabelText(label);
  fireEvent.change(picker, { target: { value: text } });
  fireEvent.keyDown(picker, { key: "Enter" });
};

const openFirst = async () => {
  render(<ProcessOrdersTab />);
  fireEvent.click(await screen.findByRole("button", { name: "View PRO-2026-0001" }));
};

describe("costs recorded on an order", () => {
  it("a cost is taken from the expense voucher that paid it, with what that voucher has left", async () => {
    m.addCost.mockResolvedValue(order({ costs: [{ _id: "c1", accountName: "Powder Coating Charges", amount: 60, voucherNo: "EV-2026-0004" }] }));
    await openFirst();
    fireEvent.click(await screen.findByRole("button", { name: "Add cost" }));
    await waitFor(() => expect(m.expenseVouchers).toHaveBeenCalled());
    pick("Expense voucher", "EV-2026");
    expect(screen.getByText(/60.00 left to move \(30.00 already in other orders\)/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog", { name: "Add a cost" })).getByRole("button", { name: "Add cost" }));
    await waitFor(() => expect(m.addCost).toHaveBeenCalledWith("o1", { voucherId: "v1", narration: undefined }));
  });

  it("someone who cannot read vouchers picks an expense account instead", async () => {
    m.grants.allow = (k) => k !== "finance.view";
    await openFirst();
    fireEvent.click(await screen.findByRole("button", { name: "Add cost" }));
    expect(screen.queryByLabelText("Taken from")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Expense")).toBeInTheDocument();
    expect(m.expenseVouchers).not.toHaveBeenCalled();
  });

  it("Finish starts from the costs recorded on the order", async () => {
    m.get.mockResolvedValue(order({ costs: [{ _id: "c1", accountId: "coat", accountName: "Powder Coating Charges", amount: 60, voucherNo: "EV-2026-0004", stepName: "Bending" }], costTotal: 60 }));
    await openFirst();
    expect(await screen.findByText("Costs so far")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    expect(await screen.findByLabelText("Cost 1 amount")).toHaveValue(60);
    expect(screen.getByLabelText("Cost 1 note")).toHaveValue("EV-2026-0004 · Bending");
  });
});

describe("a saved route", () => {
  it("the new order form offers the product's route and fills the steps from it", async () => {
    m.list.mockResolvedValue([]);
    m.plan.mockImplementation(({ qty }) => Promise.resolve(qty
      ? { route, order: { dueDate: "2026-10-22", materials: [{ stockId: "raw", qty: 25 }], steps: [{ name: "Bending", mode: "in_house", assigneeId: "u1", dueDate: "2026-10-21" }, { name: "Packing", mode: "in_house", dueDate: "2026-10-22" }] } }
      : { route, order: null }));
    render(<ProcessOrdersTab />);
    fireEvent.click(await screen.findByRole("button", { name: /New process order/ }));
    await waitFor(() => expect(m.apiGet).toHaveBeenCalled());
    await screen.findByText("Choose the product");
    pick("Product to make", "Keychain");
    fireEvent.change(screen.getByRole("spinbutton", { name: "Quantity" }), { target: { value: "25" } });
    fireEvent.click(await screen.findByRole("button", { name: "Use the saved route" }));
    await waitFor(() => expect(screen.getByLabelText("Step 2 name")).toHaveValue("Packing"));
    expect(m.plan).toHaveBeenLastCalledWith(expect.objectContaining({ stockId: "fin", qty: "25" }));
    expect(screen.getByLabelText("Material 1 quantity")).toHaveValue(25);
    expect(screen.getByText(/saved route: 2 steps, 3 days/)).toBeInTheDocument();
  });

  it("the Routes tab lists each product's route and saves a new one with its days", async () => {
    m.routes.mockResolvedValue([route]);
    m.routeCreate.mockResolvedValue({ ...route, steps: [route.steps[0]], totalDays: 2 });
    render(<RoutesTab />);
    const table = await screen.findByRole("table", { name: "Routes" });
    expect(within(table).getByText("Bending › Packing")).toBeInTheDocument();
    expect(within(table).getByText("3 days")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /New route/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save route" }));
    expect(screen.getByText("Choose the product to make")).toBeInTheDocument();
    expect(m.routeCreate).not.toHaveBeenCalled();
  });

  it("a person without inventory.adjust can open a route to look, but every field is disabled and only Close is offered", async () => {
    m.grants.allow = (k) => k !== "inventory.adjust";
    render(<RoutesTab />);
    const table = await screen.findByRole("table", { name: "Routes" });
    fireEvent.click(within(table).getByRole("button", { name: /Open the route for/ }));
    expect(await screen.findByLabelText("Product")).toBeDisabled();
    expect(screen.getByLabelText("Materials are for")).toBeDisabled();
    expect(screen.getByLabelText("Material 1 quantity")).toBeDisabled();
    expect(screen.getByLabelText("Step 1 name")).toBeDisabled();
    expect(screen.getByLabelText("Step 1 done by")).toBeDisabled();
    expect(screen.getByLabelText("Step 1 person")).toBeDisabled();
    expect(screen.getByLabelText("Notes")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add material" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add step" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save route" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog.querySelector("footer")).getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});

describe("rejects and the analysis", () => {
  it("rejected units ask why, and the reason is sent", async () => {
    m.completeStep.mockResolvedValue({ current: null });
    render(<CompleteStepDialog orderId="o1" step={{ _id: "s1", name: "Bending", plannedQty: 10 }} onClose={() => {}} onDone={() => {}} />);
    expect(screen.queryByLabelText("Why rejected")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Good"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Rejected"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Why rejected"), { target: { value: "Bent or cracked" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    await waitFor(() => expect(m.completeStep).toHaveBeenCalledWith("o1", "s1", { qtyDone: 8, qtyRejected: 2, rejectReason: "Bent or cracked", notes: undefined }));
  });

  it("the analysis shows lead time, on time, and each step's waiting, working time and rejects", async () => {
    m.analysis.mockResolvedValue({
      orders: { finished: 2, unitsOrdered: 150, unitsMade: 145, yieldPct: 96.7, avgLeadDays: 5, withDue: 2, onTime: 1, onTimePct: 50 },
      steps: [{ key: "Bending", label: "Bending", done: 2, good: 146, rejected: 4, rejectPct: 2.7, waitHours: 13, workHours: 18, late: 1, withDue: 1, latePct: 100 }],
      people: [{ key: "job_work:v1", label: "Shine", mode: "job_work", done: 1, good: 95, rejected: 1, rejectPct: 1, waitHours: 0.5, workHours: 48, late: 0, withDue: 1, latePct: 0 }],
      reasons: [{ reason: "Bent or cracked", qty: 4 }], daily: [{ day: "2026-10-04", stepsDone: 2, unitsFinished: 0 }],
    });
    render(<ProcessAnalysis />);
    expect(await screen.findByText("96.7%")).toBeInTheDocument();
    expect(screen.getByText("5 days")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 with a due date")).toBeInTheDocument();
    const steps = screen.getByRole("table", { name: "By step" });
    expect(within(steps).getByText("13 h")).toBeInTheDocument();
    expect(within(steps).getByText("18 h")).toBeInTheDocument();
    expect(within(steps).getByText("4 (2.7%)")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "By who did it" })).getByText("job worker")).toBeInTheDocument();
    expect(screen.getByText("Bent or cracked")).toBeInTheDocument();
  });
});
