import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// F05: a person checking a tax code could not tell which VAT 201 box a line of that kind would
// land in. The server now sends a `box` on every code (services/financial/taxCodeService.js);
// the screen shows it as a column, UAE only - the box numbers belong to the UAE's own return, and
// an Indian (or any other) organisation never sees a UAE form's box numbers.
const m = vi.hoisted(() => ({ allow: vi.fn(() => true) }));
vi.mock("../../../../lib/accountingApi", () => ({ accounting: { taxCodes: vi.fn() } }));
vi.mock("../../../shell/OrganisationContext", () => ({ useOrganisation: () => ({ canAny: (k) => m.allow(k) }) }));
vi.mock("../../../shell/Can", () => ({ default: ({ children }) => <>{children}</> }));

import TaxCodes from "../TaxCodes";
import { accounting } from "../../../../lib/accountingApi";
import { setOrgLocale, resetOrgLocale } from "../../../../utils/orgLocale";

const standard = { _id: "t1", name: "Standard 5%", kind: "standard", ratePercent: 5, isDefault: true, isActive: true, box: { sales: "1 (by emirate)", purchases: "9" } };
const rcm = { _id: "t2", name: "Reverse charge 5%", kind: "reverse_charge", ratePercent: 5, isActive: true, box: { sales: "None - the customer declares it in box 3", purchases: "3 and 10" } };

beforeEach(() => {
  accounting.taxCodes.mockResolvedValue([standard, rcm]);
});

afterEach(() => {
  resetOrgLocale();
});

describe("the VAT return box column", () => {
  it("shows which box a code lands in, for a sale and for a purchase, in a UAE organisation", async () => {
    setOrgLocale({ country: "AE" });
    render(<TaxCodes notify={() => {}} />);
    await screen.findByText("Standard 5%");

    expect(screen.getByText("VAT return box")).toBeInTheDocument();
    expect(screen.getByText(/Sales: 1 \(by emirate\) · Purchases: 9/)).toBeInTheDocument();
    expect(screen.getByText(/Sales: None - the customer declares it in box 3 · Purchases: 3 and 10/)).toBeInTheDocument();
  });

  it("is absent for an organisation outside the UAE: the box numbers are not its return's", async () => {
    setOrgLocale({ country: "IN" });
    render(<TaxCodes notify={() => {}} />);
    await screen.findByText("Standard 5%");

    expect(screen.queryByText("VAT return box")).toBeNull();
    expect(screen.queryByText(/Purchases: 9/)).toBeNull();
  });
});
