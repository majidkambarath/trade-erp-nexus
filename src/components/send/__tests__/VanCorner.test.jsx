import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import VanCorner from "../VanCorner";

const TOKEN = "ABCDEFGHJKM.secret";
const PAGE = {
  statement: { owed: 300, overdue: 100, open: [{ number: "SO-2026-0001", date: "2026-11-01T00:00:00.000Z", outstanding: 300, overdue: true }] },
  nextVisit: "2026-11-19",
  orders: [{ orderNo: "SORD-2026-0003", expectedDate: "2026-11-19", requested: false, items: [{ name: "Rice 5kg", qty: 6 }] }],
  canRequest: true,
  items: [{ stockId: "s1", name: "Rice 5kg", price: 17 }, { stockId: "s2", name: "Oil 1.8L", price: 30 }],
};
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

describe("the customer's page under a van invoice", () => {
  it("shows what they owe, the next visit and what is ordered, and sends a request for the next visit", async () => {
    const fetchMock = vi.fn(async (u) => {
      if (String(u).endsWith("/van-request")) return json(201, { success: true, data: { orderNo: "SORD-2026-0009", expectedDate: "2026-11-19", lines: 1 } });
      return json(200, { success: true, data: PAGE });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<VanCorner token={TOKEN} />);
    expect(await screen.findByText("You owe")).toBeInTheDocument();
    expect(screen.getByText(/of it is overdue/)).toBeInTheDocument();
    expect(screen.getByText("The van comes next")).toBeInTheDocument();
    expect(screen.getByText(/SORD-2026-0003/)).toBeInTheDocument();
    const send = screen.getByRole("button", { name: /Send to the van/ });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText("How many Oil 1.8L"), { target: { value: "4x" } });
    expect(screen.getByLabelText("How many Oil 1.8L")).toHaveValue("4");
    fireEvent.click(send);
    expect(await screen.findByText(/Sent as SORD-2026-0009/)).toBeInTheDocument();
    const [, opts] = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/van-request"));
    expect(JSON.parse(opts.body)).toEqual({ lines: [{ stockId: "s2", qty: 4 }], note: "" });
    expect(opts.credentials).toBe("omit");
  });

  it("shows nothing for a link that is not a van invoice, or an answer that is not its own", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(404, { success: false, errorCode: "SHARE_NOT_FOUND" })));
    const { container, unmount } = render(<VanCorner token={TOKEN} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    unmount();
    vi.stubGlobal("fetch", vi.fn(async () => json(200, { success: true, data: { kind: "tax_invoice" } })));
    const second = render(<VanCorner token={TOKEN} />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(second.container).toBeEmptyDOMElement();
  });

  it("the server's refusal is shown in its words", async () => {
    vi.stubGlobal("fetch", vi.fn(async (u) => (String(u).endsWith("/van-request") ? json(409, { success: false, errorCode: "REQUEST_LIMIT", message: "You already have requests waiting for the van." }) : json(200, { success: true, data: PAGE }))));
    render(<VanCorner token={TOKEN} />);
    fireEvent.change(await screen.findByLabelText("How many Rice 5kg"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /Send to the van/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You already have requests waiting for the van.");
  });
});
