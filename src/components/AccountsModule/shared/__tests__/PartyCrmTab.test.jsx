// The CRM tab on a customer's page belongs to a module the organisation may not have bought. It is drawn only when the
// person's grants are KNOWN and hold crm.view - never while the status is still loading, and never for a vendor.
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const m = vi.hoisted(() => ({ me: null }));
vi.mock("../../../shell/OrganisationContext", () => ({ useOrganisation: () => ({ me: m.me }) }));
vi.mock("../../../../lib/partyAccountApi", () => ({
  partyAccountApi: {
    party: vi.fn().mockResolvedValue({ _id: "c1", customerName: "Al Noor Trading", customerId: "CUST1", paymentTerms: "Net 30" }),
    summary: vi.fn().mockResolvedValue({ partyId: "c1", partyName: "Al Noor Trading", balance: 0, creditLimit: 0, overdue: 0, source: "ledger" }),
    ageing: vi.fn().mockResolvedValue({ rows: [], buckets: [] }),
    statement: vi.fn().mockResolvedValue({ party: { name: "Al Noor Trading" }, opening: 0, closing: 0, rows: [], totals: { debit: 0, credit: 0 } }),
  },
}));
vi.mock("../StatementTab", () => ({ default: () => <p>statement tab</p> }));
vi.mock("../OpenInvoicesTab", () => ({ default: () => <p>open invoices tab</p> }));
vi.mock("../PartyDetailsTab", () => ({ default: () => <p>details tab</p> }));
vi.mock("../../../salesDocs/CustomerDocumentsTab", () => ({ default: () => <p>documents tab</p> }));
vi.mock("../../../crm/CustomerCrmTab.jsx", () => ({ default: () => <p>the customer's CRM</p> }));

import PartyAccountPage from "../PartyAccountPage";

const show = (kind = "customer", url = "/x") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <PartyAccountPage kind={kind} partyId="c1" />
    </MemoryRouter>
  );
const crmTab = () => screen.queryByRole("tab", { name: "CRM" });

describe("the CRM tab on a customer's page", () => {
  beforeEach(() => {
    m.me = null;
  });

  it("is there for a person who holds crm.view", async () => {
    m.me = { grants: ["sales.view", "crm.view"] };
    show();
    expect(await screen.findByRole("tab", { name: "CRM" })).toBeInTheDocument();
  });

  it("is left out for a person without it - an organisation that did not buy the CRM has none to give them", async () => {
    m.me = { grants: ["sales.view", "accounts.view"] };
    show();
    expect(await screen.findByRole("tab", { name: "Statement" })).toBeInTheDocument();
    expect(crmTab()).toBeNull();
    expect(screen.getByRole("tab", { name: "Documents" })).toBeInTheDocument();
  });

  it("is not drawn while the person's grants are not known yet", async () => {
    m.me = null;
    show();
    expect(await screen.findByRole("tab", { name: "Statement" })).toBeInTheDocument();
    expect(crmTab()).toBeNull();
  });

  it("does not open from a typed address either: ?tab=crm falls back to the statement", async () => {
    m.me = { grants: ["sales.view"] };
    show("customer", "/x?tab=crm");
    expect(await screen.findByText("statement tab")).toBeInTheDocument();
    expect(screen.queryByText("the customer's CRM")).toBeNull();
  });

  it("opens the CRM for a person who holds it", async () => {
    m.me = { grants: ["crm.view"] };
    show("customer", "/x?tab=crm");
    expect(await screen.findByText("the customer's CRM")).toBeInTheDocument();
  });

  it("never appears on a vendor's page", async () => {
    m.me = { grants: ["crm.view"] };
    show("vendor");
    expect(await screen.findByRole("tab", { name: "Statement" })).toBeInTheDocument();
    expect(crmTab()).toBeNull();
  });
});
