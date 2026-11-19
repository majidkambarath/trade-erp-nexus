import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrderForm from "../../OrderEntry/OrderForm";
import { VARIANTS, recalcRow } from "../../OrderEntry/variants";
import ScheduleFields from "../ScheduleFields";
import { newRecurringForm } from "../../../lib/recurring";
import axiosInstance from "../../../axios/axios";

// The shared order form, configured as a recurring invoice TEMPLATE: a name in place of the number, no date of its own (the
// schedule says when), the schedule drawn inside the Details card, and a save to /recurring-invoices.
vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => null, linkPending: vi.fn(async () => []) }));

const customers = [{ _id: "c1", customerId: "C1", customerName: "Al Noor Grocery", billingAddress: "Deira" }];
const stockItems = [{ _id: "s1", itemId: "RENT", itemName: "Office rent", itemType: "service", salesPrice: 5000, taxPercent: 5 }];
const V = VARIANTS.recurringInvoice;
const row = () => recalcRow(V, { ...V.rowTemplate(), itemId: "s1", itemCode: "RENT", description: "Office rent", qty: "1", rate: "5000", vatPercent: "5" });

function Harness({ initial, onSuccess }) {
  const [formData, setFormData] = useState(initial);
  return (
    <OrderForm
      variant={V} formData={formData} setFormData={setFormData} parties={customers} stockItems={stockItems}
      notify={() => {}} selected={null} setActiveView={() => {}} resetForm={() => {}} onSuccess={onSuccess} activeView="create"
      extraSection={(p) => <ScheduleFields {...p} />}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  axiosInstance.get.mockResolvedValue({ data: { data: [] } });
  axiosInstance.post.mockResolvedValue({ data: { data: { _id: "r1", partyId: "c1", items: [] } } });
});

describe("the recurring invoice form", () => {
  it("asks for a name and a schedule, not a number or a date, and saves the template", async () => {
    const onSuccess = vi.fn();
    render(<Harness initial={{ ...newRecurringForm("2026-12-01"), partyId: "c1", items: [row()] }} onSuccess={onSuccess} />);
    await act(async () => {});
    expect(screen.queryByLabelText("Date")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Assigned when saved")).not.toBeInTheDocument();
    expect(screen.getByTestId("schedule-preview")).toHaveTextContent("Next invoices");

    fireEvent.click(screen.getByRole("button", { name: /Save recurring invoice/ }));
    expect(await screen.findByText("Give it a name")).toBeInTheDocument();
    expect(axiosInstance.post).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("e.g. Monthly maintenance"), { target: { value: "Office rent" } });
    fireEvent.click(screen.getByRole("button", { name: /Save recurring invoice/ }));
    await waitFor(() => expect(axiosInstance.post).toHaveBeenCalled());
    const [url, body] = axiosInstance.post.mock.calls[0];
    expect(url).toBe("/recurring-invoices");
    expect(body).toMatchObject({ name: "Office rent", partyId: "c1", frequency: "monthly", interval: 1, startDay: "2026-12-01" });
    expect(body.items).toHaveLength(1);
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });
});
