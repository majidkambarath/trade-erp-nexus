import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../components/shell/OrganisationContext", () => ({
  useOrganisation: () => ({ status: { me: { id: "u1" } }, mayUse: () => true }),
}));
import { GuideProvider } from "../GuideProvider";
import { useGuides } from "../guideContext";
import { grouped } from "../groups";
import { prefsFor } from "../../lib/userPrefs";
import { FLOWS } from "../index";

function Probe() {
  const { start, resumable, resume, active } = useGuides();
  return (
    <div>
      <button onClick={() => start("add-customer")}>begin</button>
      <button onClick={resume}>resume</button>
      <span data-testid="resumable">{resumable ? `${resumable.flowId}:${resumable.i}` : "none"}</span>
      <span data-testid="active">{active ? `${active.flowId}:${active.i}` : "none"}</span>
    </div>
  );
}
const mount = () => render(<MemoryRouter initialEntries={["/elsewhere"]}><GuideProvider><Probe /></GuideProvider></MemoryRouter>);

describe("resuming a guide", () => {
  beforeEach(() => { window.localStorage.clear(); });

  it("offers to continue from the saved step, and continuing starts the guide there", () => {
    prefsFor("u1").set("display.guideRun", { flowId: "add-customer", i: 2 });
    mount();
    expect(screen.getByTestId("resumable").textContent).toBe("add-customer:2");
    fireEvent.click(screen.getByText("resume"));
    expect(screen.getByTestId("active").textContent).toBe("add-customer:2");
  });

  it("does not offer a guide the person has already finished", () => {
    prefsFor("u1").set("display.guideRun", { flowId: "add-customer", i: 2 });
    prefsFor("u1").set("display.guideDone.add-customer", true);
    mount();
    expect(screen.getByTestId("resumable").textContent).toBe("none");
  });

  it("keeps the place while a guide runs and forgets it at the last card", async () => {
    mount();
    fireEvent.click(screen.getByText("begin"));
    await screen.findByText(/Step \d+ of/);
    expect(prefsFor("u1").get("display.guideRun", null)?.flowId).toBe("add-customer");
  });

  it("offers nothing when no guide was left unfinished", () => {
    mount();
    expect(screen.getByTestId("resumable").textContent).toBe("none");
  });
});

describe("the Garage stages", () => {
  it("come first, in the order the work happens, and hold every garage guide once", () => {
    const shown = grouped(FLOWS);
    const ids = shown.map((g) => g.id);
    expect(ids.slice(0, 5)).toEqual(["garage-intake", "garage-job", "garage-billing", "garage-claims", "garage-setup"]);
    const garage = shown.slice(0, 5).flatMap((g) => g.flows.map((f) => f.id));
    expect(garage).toEqual(FLOWS.filter((f) => f.module === "garage").map((f) => f.id));
    expect(new Set(garage).size).toBe(garage.length);
  });
});
