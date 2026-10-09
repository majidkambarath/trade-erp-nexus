import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OrganisationProvider, useOrganisation } from "../OrganisationContext";
import { CURRENCY, formatDate } from "../../../utils/format";
import { resetOrgLocale } from "../../../utils/orgLocale";

// When the organisation's status loads, its currency and time zone become the ones the whole app formats with, and a page
// that has already drawn itself is drawn again (its key changes) so no amount is left in the old currency.
let status;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));

const base = (organisation) => ({ organisation: { legalName: "Acc Trading", ...organisation }, subscription: { state: "active", blocked: false }, features: {}, me: null });

let mounts = 0;
function Page() {
  const { localeKey } = useOrganisation();
  React.useEffect(() => { mounts += 1; }, []);
  return <p data-testid="page">{`${CURRENCY} ${formatDate(new Date("2026-10-08T19:00:00Z"), "DD/MM/YYYY")} key=${localeKey}`}</p>;
}
// the shell re-keys its content on a change of locale, as Layout does
function Shell() {
  const { localeKey } = useOrganisation();
  return <div key={localeKey}><Page /></div>;
}
const renderShell = () => render(<OrganisationProvider><Shell /></OrganisationProvider>);

beforeEach(() => { mounts = 0; });
afterEach(() => resetOrgLocale());

describe("the organisation's currency and time zone", () => {
  it("are the product's own (AED, Dubai) for an organisation that has the same, and the page is drawn once", async () => {
    status = base({ baseCurrency: "AED", timezone: "Asia/Dubai" });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("page").textContent).toContain("AED 08/10/2026"));
    expect(mounts).toBe(1);
  });

  it("become the organisation's own once its status loads, and the page already drawn is drawn again", async () => {
    status = base({ baseCurrency: "INR", timezone: "Asia/Kolkata" });
    renderShell();
    await waitFor(() => expect(screen.getByTestId("page").textContent).toContain("INR 09/10/2026 key=INR|Asia/Kolkata"));
    expect(mounts).toBe(2); // once on the default, once on the organisation's own
  });

  it("are left as they were when the status says nothing about them", async () => {
    status = { subscription: { state: "active", blocked: false }, features: {}, me: null };
    renderShell();
    await waitFor(() => expect(screen.getByTestId("page").textContent).toContain("AED 08/10/2026"));
  });
});
