import React from "react";
import { render, screen } from "@testing-library/react";
import { OrganisationProvider, useOrganisation } from "../../shell/OrganisationContext";

// Test support (not a test): draws a screen as a person whose role holds exactly `grants`.
//
// The organisation status is fetched by the provider after the first paint, and until it arrives nothing is hidden
// (a missing answer must never lock anyone out). So "the button is not there" proves nothing on its own: the screen
// may simply not have heard who is asking yet. `renderAs` therefore waits until the grants are known before it
// returns, and a test then asserts on the data it expects AND on the absence.
//
// The calling test file mocks the status call itself (vi.mock is per file), pointing it at the object this returns:
//
//   let status;
//   vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(status)) }));
//   status = statusFor("accounts.view");
//   await renderAs(<ChartOfAccounts />);

export const statusFor = (...grants) => ({
  organisation: { legalName: "Acc Trading" },
  subscription: { state: "active", blocked: false },
  features: {}, limits: {}, usage: {}, support: {},
  branches: [{ code: "main", name: "Head office", isHeadOffice: true }],
  branch: { code: "main", name: "Head office", canSwitch: false },
  me: { id: "u1", name: "Olivia", role: { key: "custom", name: "A role", rank: 40 }, grants: grants.flat() },
});

export async function renderAs(ui) {
  // Draws a marker once the role is known. Nothing is hidden while it is not, so the marker is what the test waits for.
  const GrantsKnown = () => {
    const { me } = useOrganisation();
    return me ? <span data-testid="grants-known" /> : null;
  };
  const view = render(
    <OrganisationProvider>
      <GrantsKnown />
      {ui}
    </OrganisationProvider>
  );
  await screen.findByTestId("grants-known");
  return view;
}
