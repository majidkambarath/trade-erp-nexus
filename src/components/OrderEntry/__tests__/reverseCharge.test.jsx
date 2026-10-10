import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

import OrderForm from "../OrderForm";
import { VARIANTS, buildPayload, recalcRow, rowFromReturnLine } from "../variants";
import axiosInstance from "../../../axios/axios";

// Reverse charge on the order forms: pick the reverse-charge tax code and the line charges no VAT (the VAT column reads 0 and says what is
// assessed instead), the summary shows the VAT self-assessed beside the total and never in it, and what is saved is what the server prices.

vi.mock("../../../axios/axios", () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock("../../accounting/AttachmentPanel", () => ({ default: () => <div>Attachments panel</div>, linkPending: vi.fn(async () => []) }));
vi.mock("../../../lib/processTransaction", () => ({ applyAfterSave: vi.fn(async () => ({ done: true, status: "APPROVED" })) }));

const taxCodes = [
  { _id: "tc-std", name: "Standard 5%", kind: "standard", ratePercent: 5, isActive: true },
  { _id: "tc-rc", name: "Reverse charge 5%", kind: "reverse_charge", ratePercent: 5, isActive: true },
];
const vendors = [{ _id: "v1", vendorId: "V1", vendorName: "Gulf Freight", address: "Jebel Ali" }];
const customers = [{ _id: "c1", customerId: "C1", customerName: "Al Noor Grocery", billingAddress: "Deira", phone: "04 1", trnNumber: "1", paymentTerms: "Net 30" }];
const rice = { _id: "s1", itemId: "ITM1", itemName: "Basmati 5kg", purchasePrice: 100, salesPrice: 100, currentStock: 40, taxPercent: 5 };

const rowOf = (V, extra = {}) => recalcRow(V, { ...V.rowTemplate(), itemId: rice._id, itemCode: rice.itemId, qty: "4", ...V.hydrate(V.rowTemplate(), rice), ...extra });
const show = async (ui) => {
  const out = render(ui);
  await act(async () => {});
  return out;
};
function Harness({ variant, initial, parties }) {
  const [formData, setFormData] = useState(initial);
  return <OrderForm variant={variant} formData={formData} setFormData={setFormData} parties={parties} stockItems={[rice]} notify={() => {}} setActiveView={() => {}} resetForm={() => {}} onSuccess={() => {}} activeView="create" />;
}
const purchaseForm = (items) => ({ transactionNo: "", partyId: "v1", partyType: "Vendor", date: "2026-10-06", deliveryDate: "2026-10-07", status: "DRAFT", notes: "", discount: "0", charges: [], items });

beforeEach(() => {
  vi.clearAllMocks();
  axiosInstance.get.mockImplementation(async (url) => (url === "/accounting/tax-codes" ? { data: { data: taxCodes } } : { data: { data: [] } }));
});

describe("the line", () => {
  const V = VARIANTS.purchase;

  it("charges no VAT once its row is reverse charge, and shows the VAT assessed instead", () => {
    const row = rowOf(V, { taxCodeId: "tc-rc", reverseCharge: true });
    expect(row).toMatchObject({ total: "400.00", vatAmount: "0.00", grandTotal: "400.00", rcmVat: "20.00" });
    expect(rowOf(V, { taxCodeId: "tc-std" })).toMatchObject({ vatAmount: "20.00", grandTotal: "420.00", rcmVat: "" });
  });

  it("opens a saved reverse-charge line as one", () => {
    const saved = { _id: "l1", itemId: "s1", itemCode: "ITM1", description: "x", qty: 4, price: 100, vatPercent: 5, taxCodeId: "tc-rc", taxKind: "reverse_charge", rcmVat: 20 };
    for (const key of ["purchase", "sales", "salesReturn", "purchaseReturn"]) {
      expect(VARIANTS[key].rowFromSaved(saved).reverseCharge, key).toBe(true);
    }
    expect(VARIANTS.purchase.rowFromSaved({ ...saved, taxKind: "standard" }).reverseCharge).toBe(false);
  });

  it("sends the tax code and the usual line, with no VAT in it and none in the total (the server prices it again)", () => {
    const row = rowOf(V, { taxCodeId: "tc-rc", reverseCharge: true });
    const p = buildPayload(V, { partyId: "v1" }, [row], new Map([["s1", rice]]));
    expect(p.items[0]).toMatchObject({ taxCodeId: "tc-rc", vatPercent: 5, vatAmount: 0, lineTotal: 400 });
    expect(p.totalAmount).toBe(400);
    expect(p.items[0]).not.toHaveProperty("rcmVat");
    expect(p.items[0]).not.toHaveProperty("reverseCharge");
  });
});

describe("a return of a reverse-charge line", () => {
  const original = { lineId: "l1", itemId: "s1", itemCode: "ITM1", description: "Imported", remainingQty: 1, price: 100, vatPercent: 5, discountPercent: 0 };

  it("brings the original's tax code across, so it is priced as the server will price it", () => {
    for (const key of ["purchaseReturn", "salesReturn"]) {
      const V = VARIANTS[key];
      const row = rowFromReturnLine(V, { ...original, taxCodeId: "tc-rc", taxKind: "reverse_charge" });
      expect(row, key).toMatchObject({ taxCodeId: "tc-rc", reverseCharge: true });
      expect(row[V.fields.vat], key).toBe("0.00");
    }
  });

  it("leaves any other line as it was: no tax code, ordinary VAT", () => {
    const row = rowFromReturnLine(VARIANTS.purchaseReturn, { ...original, taxCodeId: "tc-std", taxKind: "standard" });
    expect(row.taxCodeId).toBe("");
    expect(row.vatAmount).toBe("5.00");
    expect(rowFromReturnLine(VARIANTS.salesReturn, original).taxCodeId).toBe("");
  });
});

describe("the purchase form", () => {
  it("offers the reverse-charge code by what it does, and choosing it zeroes the VAT column with a hint and a summary row", async () => {
    await show(<Harness variant={VARIANTS.purchase} initial={purchaseForm([rowOf(VARIANTS.purchase)])} parties={vendors} />);
    const select = await screen.findByLabelText(/^Tax code, row 1/);
    expect(await within(select).findByRole("option", { name: "Reverse charge 5% (5% self-assessed)" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Standard 5% (5%)" })).toBeInTheDocument();

    // before: ordinary VAT of 20 and a total of 420
    const summary = screen.getByRole("heading", { name: "Summary" }).closest("section");
    expect(within(summary).getByText("420.00")).toBeInTheDocument();
    expect(screen.queryByText(/self-assessed \(reverse charge\)/i)).not.toBeInTheDocument();

    await act(async () => { fireEvent.change(select, { target: { value: "tc-rc" } }); });
    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText("Reverse charge: 5% = AED 20.00 self-assessed")).toBeInTheDocument();
    // the VAT cell reads 0, the line and the document are the net
    expect(within(summary).getByText("VAT self-assessed (reverse charge)", { exact: false })).toBeInTheDocument();
    expect(within(summary).getByText("20.00")).toBeInTheDocument();
    expect(within(summary).getByText(/Not in the total: you account for it, not the supplier/)).toBeInTheDocument();
    expect(within(summary).getByText("400.00", { selector: "dd.text-xl" })).toBeInTheDocument();
    expect(within(summary).queryByText("420.00")).not.toBeInTheDocument();

    // and back to an ordinary code: the hint and the row go
    await act(async () => { fireEvent.change(select, { target: { value: "tc-std" } }); });
    expect(screen.queryByText(/Reverse charge: 5%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/VAT self-assessed \(reverse charge\)/)).not.toBeInTheDocument();
    expect(within(summary).getByText("420.00")).toBeInTheDocument();
  });

  it("saves the tax code with the line and a total without the assessed VAT", async () => {
    axiosInstance.post.mockResolvedValue({ data: { data: { _id: "t1", partyId: "v1", items: [] } } });
    await show(<Harness variant={VARIANTS.purchase} initial={purchaseForm([rowOf(VARIANTS.purchase)])} parties={vendors} />);
    const select = await screen.findByLabelText(/^Tax code, row 1/);
    await act(async () => { fireEvent.change(select, { target: { value: "tc-rc" } }); });
    await act(async () => { screen.getByRole("button", { name: /save po/i }).click(); });
    const [url, body] = axiosInstance.post.mock.calls[0];
    expect(url).toBe("/transactions/transactions");
    expect(body.items[0]).toMatchObject({ taxCodeId: "tc-rc", vatAmount: 0, lineTotal: 400 });
    expect(body.totalAmount).toBe(400);
  });
});

describe("the sales form (the supplier's side)", () => {
  it("also charges no VAT on the line and says the customer assesses it", async () => {
    const form = { transactionNo: "", partyId: "c1", partyType: "Customer", date: "2026-10-06", deliveryDate: "2026-10-07", status: "DRAFT", refNo: "", docNo: "", notes: "", discount: "0", charges: [], items: [rowOf(VARIANTS.sales)] };
    await show(<Harness variant={VARIANTS.sales} initial={form} parties={customers} />);
    const select = await screen.findByLabelText(/^Tax code, row 1/);
    await act(async () => { fireEvent.change(select, { target: { value: "tc-rc" } }); });
    const summary = screen.getByRole("heading", { name: "Summary" }).closest("section");
    expect(within(summary).getByText(/your customer accounts for it/)).toBeInTheDocument();
    expect(within(summary).getByText("400.00", { selector: "dd.text-xl" })).toBeInTheDocument();
  });
});
