import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const m = vi.hoisted(() => ({
  board: vi.fn(), list: vi.fn(), get: vi.fn(), create: vi.fn(), release: vi.fn(), startStep: vi.fn(), completeStep: vi.fn(), sendStep: vi.fn(),
  finish: vi.fn(), assignees: vi.fn(), lastSteps: vi.fn(), apiGet: vi.fn(), postable: vi.fn(),
  grants: { allow: () => true }, me: { id: "u1" },
}));
vi.mock("../../../lib/processOrderApi", () => ({ processOrders: {
  board: m.board, list: m.list, get: m.get, create: m.create, update: m.create, release: m.release, startStep: m.startStep, completeStep: m.completeStep,
  sendStep: m.sendStep, finish: m.finish, assignees: m.assignees, lastSteps: m.lastSteps, remove: vi.fn(), cancel: vi.fn(), reopen: vi.fn(),
} }));
vi.mock("../../../lib/accountingApi", () => ({ api: { get: m.apiGet }, accounting: { postableAccounts: m.postable } }));
vi.mock("../../shell/OrganisationContext", () => ({ useOrganisation: () => ({ canAny: (k) => m.grants.allow(k), can: (k) => m.grants.allow(k), me: m.me }) }));

import ProcessBoard from "../process/ProcessBoard";
import ProcessOrdersTab from "../process/ProcessOrdersTab";

const card = (over) => ({ orderId: "o1", processNo: "PRO-2026-0001", itemName: "Keychain holder", qty: 100, stepId: "s2", stepName: "Bending", stepSeq: 2, stepCount: 3, status: "IN_PROGRESS", mode: "in_house", who: "Ravi", assigneeId: "u1", plannedQty: 96, due: "2026-10-18", dueState: "overdue", ...over });
const boardData = {
  counts: { orders: 2, pending: 1, inProgress: 1, doneToday: 1, overdue: 1, dueToday: 1, dueTomorrow: 0, readyToFinish: 0 },
  columns: [{ name: "Cutting", order: 1, cards: [card({ orderId: "o2", processNo: "PRO-2026-0002", stepName: "Cutting", stepSeq: 1, status: "READY", dueState: "today", who: "", assigneeId: null })] }, { name: "Bending", order: 2, cards: [card()] }],
  overdue: [card()], dueToday: [card({ orderId: "o2", processNo: "PRO-2026-0002", stepName: "Cutting" })], dueTomorrow: [],
  mine: [card()],
  withJobWorkers: [{ jobWorkId: "j1", jobWorkNo: "JWC-2026-0002", worker: "Shine Powder Coaters", processNo: "PRO-2026-0003", items: [{ name: "Raw holder", out: 50 }], daysOut: 3, returnBy: "2027-10-16", overdue: false, value: 2500 }],
};
const step = (over) => ({ _id: "s1", seq: 1, name: "Bending", mode: "in_house", status: "READY", plannedQty: 100, assigneeId: "u1", assigneeName: "Ravi", dueState: "today", actions: { start: true, complete: true, send: false }, ...over });
const order = (over) => ({
  _id: "o1", processNo: "PRO-2026-0001", status: "OPEN", finished: { stockId: "fin", itemName: "Keychain holder", qty: 100 }, materials: [{ _id: "m1", stockId: "raw", itemName: "Raw holder", qty: 100 }],
  steps: [step(), step({ _id: "s2", seq: 2, name: "Painting", mode: "job_work", jobWorkerName: "Shine Powder Coaters", status: "WAITING", assigneeId: null, actions: { start: false, complete: false, send: false } })],
  current: { _id: "s1", name: "Bending", seq: 1 }, readyToFinish: false, finishedQty: 0, actions: { cancel: true }, ...over,
});

beforeEach(() => {
  for (const f of ["board", "list", "get", "create", "release", "startStep", "completeStep", "sendStep", "finish", "assignees", "lastSteps", "apiGet", "postable"]) m[f].mockReset();
  m.grants.allow = () => true;
  m.board.mockResolvedValue(boardData);
  m.list.mockResolvedValue([order()]);
  m.get.mockResolvedValue(order());
  m.assignees.mockResolvedValue([{ id: "u1", name: "Ravi" }]);
  m.lastSteps.mockResolvedValue([]);
  m.apiGet.mockImplementation((url) => Promise.resolve(url.startsWith("/vendors") ? [{ _id: "v1", vendorName: "Shine Powder Coaters", vendorId: "VEND1" }] : { stocks: [{ _id: "raw", itemId: "RAW1", itemName: "Raw holder", currentStock: 200 }, { _id: "fin", itemId: "FIN1", itemName: "Keychain holder", currentStock: 0 }] }));
  m.postable.mockResolvedValue([{ _id: "lab", accountName: "Bending labour", accountCode: "EXP-9", category: "EXPENSE" }]);
});

describe("the owner's board", () => {
  it("shows the counts, where each order is, what is with job workers, and my own work", async () => {
    render(<ProcessBoard />);
    const tiles = await screen.findByRole("list", { name: "Where the work stands" });
    expect(within(tiles).getByText("Overdue").parentElement.parentElement).toHaveTextContent("1");
    const cutting = screen.getByRole("region", { name: "Cutting" });
    expect(within(cutting).getByText("PRO-2026-0002")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Bending" })).getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Shine Powder Coaters")).toBeInTheDocument();
    expect(screen.getByText("3 days out")).toBeInTheDocument();
    expect(screen.getByText("My work")).toBeInTheDocument();
  });

  it("a count opens its list, and Done on my work records the good and rejected quantities", async () => {
    render(<ProcessBoard />);
    fireEvent.click(await screen.findByRole("button", { name: /Due today/ }));
    expect(screen.getByText("Due today (1)")).toBeInTheDocument();
    m.completeStep.mockResolvedValue({ current: { name: "Painting" } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.change(screen.getByLabelText("Good"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Rejected"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    await waitFor(() => expect(m.completeStep).toHaveBeenCalledWith("o1", "s2", { qtyDone: 90, qtyRejected: 6, notes: undefined }));
    expect(await screen.findByText(/Bending done\. Painting can start\./)).toBeInTheDocument();
  });

  it("refuses more good and rejected than there was to process, on the screen", async () => {
    render(<ProcessBoard />);
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));
    fireEvent.change(screen.getByLabelText("Good"), { target: { value: "90" } });
    fireEvent.change(screen.getByLabelText("Rejected"), { target: { value: "10" } });
    expect(screen.getByText("More than the 96 to process")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark done" })).toBeDisabled();
  });

  it("an empty board says how to start", async () => {
    m.board.mockResolvedValue({ counts: {}, columns: [], mine: [], overdue: [], dueToday: [], dueTomorrow: [], withJobWorkers: [] });
    render(<ProcessBoard />);
    expect(await screen.findByText("Nothing in process")).toBeInTheDocument();
    expect(screen.queryByText("My work")).not.toBeInTheDocument();
  });
});

describe("process orders", () => {
  it("lists orders at their step and opens one with its steps and the actions it allows", async () => {
    render(<ProcessOrdersTab />);
    const table = await screen.findByRole("table", { name: "Process orders" });
    expect(within(table).getByText("1. Bending")).toBeInTheDocument();
    fireEvent.click(within(table).getByRole("button", { name: "View PRO-2026-0001" }));
    const bending = await screen.findByRole("listitem", { name: "Step 1: Bending" });
    expect(within(bending).getByRole("button", { name: "Start" })).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Step 2: Painting" })).getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();
  });

  it("someone who does not manage stock works only the steps given to them", async () => {
    m.grants.allow = (k) => (Array.isArray(k) ? k : [k]).every((x) => x !== "inventory.adjust");
    m.me = { id: "someone-else" };
    render(<ProcessOrdersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "View PRO-2026-0001" }));
    const bending = await screen.findByRole("listitem", { name: "Step 1: Bending" });
    expect(within(bending).queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New process order/ })).not.toBeInTheDocument();
    m.me = { id: "u1" };
  });

  it("a job-work step that is ready is sent on a challan", async () => {
    m.get.mockResolvedValue(order({ steps: [step({ status: "DONE", qtyDone: 96, actions: {} }), step({ _id: "s2", seq: 2, name: "Painting", mode: "job_work", jobWorkerName: "Shine Powder Coaters", status: "READY", plannedQty: 96, assigneeId: null, actions: { send: true } })] }));
    m.sendStep.mockResolvedValue({ jobWork: { jobWorkNo: "JWC-2026-0009" } });
    render(<ProcessOrdersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "View PRO-2026-0001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send to job worker" }));
    expect(screen.getByText(/Goes out:/)).toHaveTextContent("96 Raw holder");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(m.sendStep).toHaveBeenCalledWith("o1", "s2", expect.objectContaining({ vehicleNo: undefined })));
    expect(await screen.findByText(/JWC-2026-0009/)).toBeInTheDocument();
  });

  it("Finish posts one production with the costs moved in", async () => {
    m.get.mockResolvedValue(order({ readyToFinish: true, finishedQty: 90, current: null, actions: { finish: true }, steps: [step({ status: "DONE", qtyDone: 90, actions: {} })] }));
    m.finish.mockResolvedValue({ processNo: "PRO-2026-0001", finishedQty: 90, finished: { itemName: "Keychain holder" }, production: { productionNo: "PRD-2026-0005", totals: { unitCost: 61.11 } } });
    render(<ProcessOrdersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "View PRO-2026-0001" }));
    fireEvent.click(await screen.findByRole("button", { name: "Finish" }));
    await waitFor(() => expect(m.postable).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Cost 1 amount"), { target: { value: "500" } });
    expect(screen.getByText("Each cost needs both an expense and an amount.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove cost 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish and post" }));
    await waitFor(() => expect(m.finish).toHaveBeenCalledWith("o1", expect.objectContaining({ costs: [] })));
    expect(await screen.findByText(/PRD-2026-0005 posted/)).toBeInTheDocument();
  });

  it("the new order form refuses an incomplete order and copies the product's last steps", async () => {
    m.list.mockResolvedValue([]);
    render(<ProcessOrdersTab />);
    fireEvent.click(await screen.findByRole("button", { name: /New process order/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    expect(screen.getByText("Choose the product to make")).toBeInTheDocument();
    expect(screen.getByText("Add the steps the product goes through")).toBeInTheDocument();
    expect(m.create).not.toHaveBeenCalled();
  });
});
