// Switching between the two halves of the product. What matters: it lands on the other workspace's first page, and a
// person who can only see one half is offered nothing at all.
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { MemoryRouter, useLocation } from "react-router-dom";
import WorkspaceSwitcher from "../WorkspaceSwitcher";
import { MODULES, modulesIn, ERP } from "../../../config/navigation";

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

// Radix opens a dropdown on pointerdown, which jsdom does not synthesise from a click; the trigger's own key
// handling is the reliable way in (and it is how a keyboard user opens it anyway).
const openMenu = (name) => fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });

const show = (modules, activeModule) =>
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <WorkspaceSwitcher modules={modules} activeModule={activeModule} />
      <Where />
    </MemoryRouter>
  );

const erpOnly = modulesIn(ERP, MODULES);
const crmOnly = modulesIn("crm", MODULES);

describe("the workspace switcher", () => {
  it("names the half you are in", () => {
    show(MODULES, erpOnly[0]);
    expect(screen.getByRole("button", { name: /Workspace: ERP/ })).toBeInTheDocument();
  });

  it("goes to the CRM's first page when the CRM is chosen", async () => {
    show(MODULES, erpOnly[0]);
    openMenu(/Workspace: ERP/);
    const crm = await screen.findByRole("menuitem", { name: /CRM/ });
    fireEvent.click(crm);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/crm/dashboard"));
  });

  it("comes back to the ERP's first page", async () => {
    show(MODULES, crmOnly[0]);
    expect(screen.getByRole("button", { name: /Workspace: CRM/ })).toBeInTheDocument();
    openMenu(/Workspace: CRM/);
    const erp = await screen.findByRole("menuitem", { name: /ERP/ });
    fireEvent.click(erp);
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/dashboard"));
  });

  it("draws nothing for somebody who can only see one half", () => {
    // A role with no crm.view never has a CRM module in its visible list, so there is nowhere to switch to.
    const { container } = show(erpOnly, erpOnly[0]);
    expect(screen.queryByRole("button", { name: /Workspace/ })).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });
});
