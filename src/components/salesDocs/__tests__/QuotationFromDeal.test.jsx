import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";

// A quotation raised from a CRM deal: the form opens with the deal's customer and the lines that name an item, and it
// names the deal so the server links the two. The order form itself is replaced: what is checked is what it is handed.
const seen = vi.hoisted(() => ({ form: null }));
vi.mock("../../OrderEntry/OrderForm", () => ({ default: ({ formData }) => { seen.form = formData; return <div data-testid="form" />; } }));
vi.mock("../hooks", () => ({ useOrderLookups: () => ({ customers: [], stockItems: [{ _id: "s1", itemId: "RICE" }] }) }));
vi.mock("../../../lib/crmApi", () => ({
  crm: { deal: vi.fn(() => Promise.resolve({ _id: "d1", opportunityNo: "OPP-2026-0003", title: "Monthly rice", customerId: "c1", items: [{ itemId: "s1", description: "Rice 5kg", qty: 4, price: 25 }, { description: "Delivery to Al Ain", qty: 1, price: 150 }] })) },
}));

import QuotationsPage from "../QuotationsPage";

describe("a quotation from a deal", () => {
  it("starts with the customer, the item lines and the deal, and names the lines it could not take", async () => {
    render(<MemoryRouter initialEntries={["/quotations?mode=create&deal=d1"]}><QuotationsPage /></MemoryRouter>);
    expect(await screen.findByRole("status")).toHaveTextContent("From deal OPP-2026-0003. Not an item, so add by hand: Delivery to Al Ain.");
    await waitFor(() => expect(seen.form.opportunityId).toBe("d1"));
    expect(seen.form.partyId).toBe("c1");
    expect(seen.form.items).toHaveLength(1);
    expect(seen.form.items[0]).toMatchObject({ itemId: "s1", itemCode: "RICE", description: "Rice 5kg", qty: "4", rate: "25" });
  });
});
