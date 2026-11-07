// HRMS > Reports: the compliance panels this module keeps - gratuity and Emiratisation.
//
// These cases came OFF the dashboard. That screen used to draw both of these as well, which was two
// panels of weight spent on figures this page already owned in full; removing them from there would have
// deleted the only frontend coverage the Emiratisation rules had, because this page had no test at all.
// So the coverage moved to where the behaviour lives, which is here.
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ gratuity: { preview: vi.fn(), accruals: vi.fn(), accrue: vi.fn(), reverse: vi.fn() }, emiratisation: vi.fn() }));
vi.mock("../../../lib/hrApi", () => api);
vi.mock("../../shell/Can.jsx", () => ({ default: ({ children }) => children }));

import ReportsPage from "../ReportsPage";
import { ThemeProvider } from "../../theme-provider";

const show = () => render(<ThemeProvider><MemoryRouter><ReportsPage /></MemoryRouter></ThemeProvider>);
// fireEvent, not element.click(): a bare click triggers a React state update outside act(), which React
// reports through console.error - and the afterEach below (rightly) fails a test that logs one.
const openTab = async (name) => {
  const tab = await screen.findByRole("tab", { name });
  fireEvent.click(tab);
  return tab;
};

const PREVIEW = { month: "2026-10", day: "2026-10-31", cumulativeLiability: 88340.73, previousCumulative: 80000, amount: 8340.73, employeeCount: 12, missingCount: 0, employees: [], missing: [] };

let errors;
beforeEach(() => {
  api.emiratisation.mockReset();
  api.gratuity.preview.mockReset().mockResolvedValue(PREVIEW);
  api.gratuity.accruals.mockReset().mockResolvedValue([]);
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(errors, "the page logs no errors or React warnings").not.toHaveBeenCalled();
  errors.mockRestore();
});

describe("HR Reports", () => {
  it("opens on the gratuity liability the books should already be carrying", async () => {
    api.emiratisation.mockResolvedValue(null);
    show();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Gratuity/i })).toBeInTheDocument());
    expect(api.gratuity.preview).toHaveBeenCalled();
  });

  it("says what Emiratisation costs per month if nothing changes", async () => {
    api.emiratisation.mockResolvedValue({
      day: "2026-11-07", configured: true, requiredPercent: 2, finePerPosition: 9000,
      headcount: 12, nationals: 0, required: 1, shortfall: 1, compliant: false, monthlyExposure: 9000,
    });
    show();
    await openTab(/Emiratisation/i);
    await waitFor(() => expect(screen.getByText(/Short by 1/)).toBeInTheDocument());
    // The reason the tracker earns its place: one month's fine pays for the software many times over.
    expect(screen.getByText(/9,000/)).toBeInTheDocument();
  });

  it("says the quota is being met rather than showing an exposure of nothing", async () => {
    api.emiratisation.mockResolvedValue({
      day: "2026-11-07", configured: true, requiredPercent: 2, finePerPosition: 9000,
      headcount: 12, nationals: 2, required: 1, shortfall: 0, compliant: true, monthlyExposure: 0,
    });
    show();
    await openTab(/Emiratisation/i);
    await waitFor(() => expect(screen.getByText("Meeting the quota")).toBeInTheDocument());
    expect(screen.queryByText(/Short by/)).not.toBeInTheDocument();
  });

  it("sends somebody to Setup when the quota and the fine were never set", async () => {
    api.emiratisation.mockResolvedValue({ day: "2026-11-07", configured: false });
    show();
    await openTab(/Emiratisation/i);
    await waitFor(() => expect(screen.getByText(/have not been set up yet/)).toBeInTheDocument());
  });

  it("says plainly that it does not apply outside the UAE, rather than drawing an empty tracker", async () => {
    api.emiratisation.mockResolvedValue(null);
    show();
    await openTab(/Emiratisation/i);
    await waitFor(() => expect(screen.getByText(/applies to UAE organisations only/)).toBeInTheDocument());
  });
});
