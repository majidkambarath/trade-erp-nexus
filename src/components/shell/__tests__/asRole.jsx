import React from "react";
import { screen } from "@testing-library/react";
import { OrganisationProvider, useOrganisation } from "../OrganisationContext";

// Test helper: render a screen as a person whose role holds exactly these grants, through the real
// OrganisationProvider. The test file supplies the status with
//
//   let orgStatus;
//   vi.mock("<path>/lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));
//   ...
//   orgStatus = statusFor(["sales.view"]);
//
// and renders <AsRole>...</AsRole>, then `await roleLoaded()` BEFORE asserting that something is absent:
// while the grants are unknown the app hides nothing, so a check made before they arrive says nothing.
// `features` names only what is OFF: an absent key is on, as the server's own featureOn reads it, so every existing
// caller that passes grants alone gets an organisation with every feature - which is what it had before this argument.
export const statusFor = (grants, features = {}) => ({
  organisation: { legalName: "Harbour Trading", baseCurrency: "AED", timezone: "Asia/Dubai" },
  subscription: { state: "active", blocked: false },
  features,
  me: { id: "u1", name: "Someone", role: { key: "custom", name: "A role", rank: 40 }, grants },
});

function Loaded() {
  const { me } = useOrganisation();
  return me ? <span data-testid="role-loaded" /> : null;
}

export const roleLoaded = () => screen.findByTestId("role-loaded");

export const AsRole = ({ children }) => (
  <OrganisationProvider>
    <Loaded />
    {children}
  </OrganisationProvider>
);
