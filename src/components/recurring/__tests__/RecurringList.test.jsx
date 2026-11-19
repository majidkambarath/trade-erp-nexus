import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

import RecurringList from "../RecurringList";
import ScheduleFields from "../ScheduleFields";
import { recurringInvoices } from "../../../lib/recurringApi";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";

vi.mock("../../../lib/recurringApi", () => ({
  recurringInvoices: { list: vi.fn(), pause: vi.fn(), resume: vi.fn(), run: vi.fn(), remove: vi.fn() },
}));
let orgStatus = null;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

const rent = {
  _id: "r1", name: "Office rent", partyName: "Al Noor", describe: "Every month", status: "ACTIVE", nextRunDay: "2026-12-01",
  made: 3, maxCount: 12, totalAmount: 5250, lastRun: { day: "2026-11-01", transactionNo: "SO-2026-0042" },
};
const lease = { ...rent, _id: "r2", name: "Warehouse lease", status: "PAUSED", lastRun: null, made: 0, maxCount: undefined, lastError: null };
const failing = { ...rent, _id: "r3", name: "Fees", lastError: { day: "2026-10-01", message: "Posting is closed up to 31 Oct 2026" } };

const notify = vi.fn();
const show = () => render(<MemoryRouter><AsRole><RecurringList onNew={vi.fn()} onEdit={vi.fn()} notify={notify} reloadKey={0} /></AsRole></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  recurringInvoices.list.mockResolvedValue([rent, lease, failing]);
});

describe("Recurring invoices list", () => {
  it("shows each template: how often, the next date, the last draft made, the count, and why a run failed", async () => {
    orgStatus = statusFor(["sales.view", "sales.create", "sales.edit", "sales.delete"]);
    show();
    const table = await screen.findByRole("table", { name: "Recurring invoices" });
    const row = within(table).getByText("Office rent").closest("tr");
    expect(within(row).getByText("Every month")).toBeInTheDocument();
    expect(within(row).getByText("3 of 12")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "SO-2026-0042" })).toHaveAttribute("href", "/sales-order?search=SO-2026-0042");
    expect(within(table).getByText(/Could not make the invoice for .*Posting is closed/)).toBeInTheDocument();
    expect(within(within(table).getByText("Warehouse lease").closest("tr")).getByText("Paused")).toBeInTheDocument();
  });

  it("makes the next one now, pauses and resumes, saying what happened", async () => {
    orgStatus = statusFor(["sales.view", "sales.create", "sales.edit", "sales.delete"]);
    recurringInvoices.run.mockResolvedValue({ invoice: { transactionNo: "SO-2026-0043" }, day: "2026-12-01" });
    recurringInvoices.resume.mockResolvedValue({ nextRunDay: "2027-01-01" });
    recurringInvoices.pause.mockResolvedValue({});
    show();
    const table = await screen.findByRole("table", { name: "Recurring invoices" });
    const rentRow = within(table).getByText("Office rent").closest("tr");
    fireEvent.click(within(rentRow).getByRole("button", { name: /Make next now/ }));
    await waitFor(() => expect(recurringInvoices.run).toHaveBeenCalledWith("r1"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Draft invoice SO-2026-0043 made/)));
    fireEvent.click(within(rentRow).getByRole("button", { name: /Pause/ }));
    await waitFor(() => expect(recurringInvoices.pause).toHaveBeenCalledWith("r1"));
    const leaseRow = within(table).getByText("Warehouse lease").closest("tr");
    fireEvent.click(within(leaseRow).getByRole("button", { name: /Resume/ }));
    await waitFor(() => expect(recurringInvoices.resume).toHaveBeenCalledWith("r2"));
  });

  it("a person who can only look sees no actions", async () => {
    orgStatus = statusFor(["sales.view"]);
    show();
    await screen.findByRole("table", { name: "Recurring invoices" });
    await roleLoaded();
    expect(screen.queryByRole("button", { name: /New recurring invoice/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Make next now|Pause|Resume|Delete|Edit/ })).not.toBeInTheDocument();
  });
});

describe("Schedule fields", () => {
  it("previews the next dates from what is typed and reports a change", () => {
    const setHeader = vi.fn();
    render(<ScheduleFields formData={{ frequency: "monthly", interval: "1", startDay: "2026-01-31" }} setHeader={setHeader} errors={{}} fid={(k) => `f-${k}`} />);
    expect(screen.getByTestId("schedule-preview")).toHaveTextContent(/Next invoices: .*31.*28.*31/);
    fireEvent.change(screen.getByLabelText("How often"), { target: { value: "quarterly" } });
    expect(setHeader).toHaveBeenCalledWith("frequency", "quarterly");
  });
});
