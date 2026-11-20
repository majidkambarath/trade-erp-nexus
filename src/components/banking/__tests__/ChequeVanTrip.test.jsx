import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// The cheque register can be narrowed to the cheques one van trip took (the server filters by vanTripId). The choice is only
// offered to somebody who may look at van sales, and arriving from a trip ("Cheques on this trip") opens on that trip.
const m = vi.hoisted(() => ({ cheques: vi.fn(), trips: vi.fn(), can: () => true }));
vi.mock("../../../lib/bankingApi", () => ({ banking: { cheques: m.cheques, clearCheque: vi.fn(), bounceCheque: vi.fn(), cancelCheque: vi.fn() }, vouchers: { get: vi.fn() } }));
vi.mock("../../../lib/vanSalesApi", () => ({ trips: { list: m.trips } }));
vi.mock("../../shell/OrganisationContext", () => ({ useOrganisation: () => ({ can: (k) => m.can(k), canAny: () => true, featureOn: () => true }) }));

import ChequeRegister from "../ChequeRegister";

const summary = { receivable: { amount: 0, count: 0 }, payable: { amount: 0, count: 0 } };
const last = () => m.cheques.mock.calls[m.cheques.mock.calls.length - 1][0];

beforeEach(() => {
  m.can = () => true;
  m.cheques.mockReset();
  m.cheques.mockResolvedValue({ rows: [], total: 0, summary });
  m.trips.mockReset();
  m.trips.mockResolvedValue([{ id: "t1", tripNo: "VTR-2026-0001", vanCode: "VAN-1" }, { id: "t2", tripNo: "VTR-2026-0002", vanCode: "VAN-2" }]);
});

describe("cheques by van trip", () => {
  it("sends the chosen trip to the server, and clears it again", async () => {
    render(<ChequeRegister />);
    const box = await screen.findByRole("combobox", { name: "Van trip" });
    expect(last().vanTripId).toBeUndefined();
    fireEvent.change(box, { target: { value: "t2" } });
    await waitFor(() => expect(last().vanTripId).toBe("t2"));
    fireEvent.change(box, { target: { value: "" } });
    await waitFor(() => expect(last().vanTripId).toBeUndefined());
  });

  it("opens on the trip it came from, showing every status", async () => {
    render(<ChequeRegister initialTrip="t1" />);
    await screen.findByRole("combobox", { name: "Van trip" });
    expect(m.cheques.mock.calls[0][0]).toMatchObject({ vanTripId: "t1" });
    expect(m.cheques.mock.calls[0][0].status).toBeUndefined();
  });

  it("is not offered to a person who may not look at van sales, and asks nothing of it", async () => {
    m.can = (k) => k !== "vansales.view";
    render(<ChequeRegister />);
    await waitFor(() => expect(m.cheques).toHaveBeenCalled());
    expect(screen.queryByRole("combobox", { name: "Van trip" })).toBeNull();
    expect(m.trips).not.toHaveBeenCalled();
  });
});
