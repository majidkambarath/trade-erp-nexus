import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import QuickCreateDialog from "../QuickCreateDialog";
import { QUICK_CREATE } from "../quickCreate";
import { resetOrgLocale, setOrgLocale } from "../../../utils/orgLocale";

// A party quick-added from an order could never be registered for tax: the dialog asked for three
// fields and sent trnNumber: null, so the invoice printed no TRN until somebody opened the full
// Customers screen. The box below is that gap closed.

const open = (kind, onCreate) =>
  render(<QuickCreateDialog open spec={QUICK_CREATE[kind]} onOpenChange={() => {}} onCreate={onCreate} />);

const fill = () => {
  fireEvent.change(screen.getByLabelText(/Customer name/), { target: { value: "Spinneys" } });
  fireEvent.change(screen.getByLabelText(/Contact person/), { target: { value: "Ali" } });
  fireEvent.change(screen.getByLabelText(/Billing address/), { target: { value: "Abu Dhabi" } });
};

beforeEach(() => resetOrgLocale());

describe("the VAT tick on the quick-add dialog", () => {
  it("hides the tax number until the box is ticked", () => {
    open("customer", vi.fn());
    expect(screen.queryByLabelText(/^TRN/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/VAT registered/));
    expect(screen.getByLabelText(/^TRN/)).toBeTruthy();
  });

  it("creates an unregistered party on Cash terms when the box is left alone", async () => {
    const onCreate = vi.fn().mockResolvedValue();
    open("customer", onCreate);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /Create/ }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    const sent = QUICK_CREATE.customer.payload(onCreate.mock.calls[0][0]);
    expect(sent.vat).toEqual({ status: "unregistered", trn: "" });
    expect(sent.paymentTerms).toBe("Cash");
  });

  it("refuses a malformed tax number before the request, and sends a good one", async () => {
    const onCreate = vi.fn().mockResolvedValue();
    open("customer", onCreate);
    fill();
    fireEvent.click(screen.getByLabelText(/VAT registered/));
    fireEvent.change(screen.getByLabelText(/^TRN/), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /Create/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(onCreate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/^TRN/), { target: { value: "100123456700003" } });
    fireEvent.click(screen.getByRole("button", { name: /Create/ }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(QUICK_CREATE.customer.payload(onCreate.mock.calls[0][0]).vat)
      .toEqual({ status: "registered", trn: "100123456700003" });
  });

  it("an empty tax number is still required once the box is ticked", async () => {
    const onCreate = vi.fn().mockResolvedValue();
    open("customer", onCreate);
    fill();
    fireEvent.click(screen.getByLabelText(/VAT registered/));
    fireEvent.click(screen.getByRole("button", { name: /Create/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/required/));
    expect(onCreate).not.toHaveBeenCalled();
  });

  // The wording follows the organisation's country, as the master form's does.
  it("asks an Indian organisation for a GSTIN", () => {
    setOrgLocale({ country: "IN" });
    open("vendor", vi.fn());
    fireEvent.click(screen.getByLabelText(/GST registered/));
    expect(screen.getByLabelText(/^GSTIN/)).toBeTruthy();
    resetOrgLocale();
  });
});
