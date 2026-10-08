import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import "@testing-library/jest-dom";

import SharedDocument, { problemText } from "../SharedDocument";
import { SHEET_DESIGN_WIDTH, buildFromShare, fitScale } from "../shareSheet";

vi.mock("html2canvas", () => ({ default: vi.fn(async () => ({ width: 800, height: 1000, toDataURL: vi.fn(() => "data:image/png;base64,FAKE") })) }));
const pdfs = [];
vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => {
    const d = { addImage: vi.fn(), addPage: vi.fn(), save: vi.fn() };
    pdfs.push(d);
    return d;
  }),
}));

const SNAPSHOT = {
  kind: "tax_invoice", currency: "AED", expiresAt: "2026-11-05T00:00:00.000Z",
  document: {
    transactionNo: "SO-2026-0042", invoiceNumber: "INV-2026-0042", status: "APPROVED", date: "2026-10-06T00:00:00.000Z", lpono: "LPO-7",
    items: [{ itemCode: "RICE5", description: "Basmati Rice 5kg", qty: 10, rate: 200, vatPercent: 5, vatAmount: 10, lineTotal: 210 }],
    charges: [], pricing: { gross: 200, lineDiscount: 0, net: 200, lineVat: 10, chargesNet: 0, chargesVat: 0, headerDiscount: 0, roundOff: 0, grandTotal: 210 },
  },
  party: { customerName: "Al Noor Trading", customerId: "C1", billingAddress: "Al Quoz", trnNumber: "100123456700003", paymentTerms: "Net 30" },
  company: { companyName: "Harbour Trading LLC", phoneNumber: "04 123 4567", email: "accounts@harbour.ae", vatNumber: "100123456700003", addressLine1: "Al Quoz, Dubai", logo: "https://cdn.example/logo.png" },
};
const TOKEN = "ABCDEFGHJKM.secretsecretsecretsecretsecretsecretsecr";

const reply = (status, body) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const open = (token = TOKEN) =>
  render(<MemoryRouter initialEntries={[`/d/${token}`]}><Routes><Route path="/d/:token" element={<SharedDocument />} /></Routes></MemoryRouter>);
const viewedCalls = (fetchMock) => fetchMock.mock.calls.filter(([u]) => /\/viewed$/.test(String(u)));

beforeEach(() => {
  pdfs.length = 0;
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/jpeg;base64,AA");
  window.sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("the page a customer opens", () => {
  it("shows the invoice with no sign-in, no menu, and who it is from", async () => {
    vi.stubGlobal("fetch", reply(200, { success: true, data: SNAPSHOT }));
    open();
    expect(await screen.findByRole("heading", { name: /Tax invoice INV-2026-0042/ })).toBeInTheDocument();
    expect(screen.getAllByText("Harbour Trading LLC").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Basmati Rice 5kg/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Al Noor Trading").length).toBeGreaterThan(0);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByText(/dashboard|sign in|log in/i)).toBeNull();
    expect(screen.getByText(/sent to you by Harbour Trading LLC\. Questions\? 04 123 4567 · accounts@harbour\.ae/)).toBeInTheDocument();
    expect(screen.getByText(/This link works until /)).toBeInTheDocument();
    expect(document.querySelector("img[src='https://cdn.example/logo.png']")).not.toBeNull();
  });

  it("asks for the document without any credentials, and only with fetch", async () => {
    const fetchMock = reply(200, { success: true, data: SNAPSHOT });
    vi.stubGlobal("fetch", fetchMock);
    open();
    await screen.findByRole("heading", { name: /Tax invoice/ });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/share\/ABCDEFGHJKM\.secretsecretsecretsecretsecretsecretsecr$/);
    expect(init.credentials).toBe("omit");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("says 'I loaded' once, after the document is on screen, without credentials", async () => {
    const fetchMock = reply(200, { success: true, data: SNAPSHOT });
    vi.stubGlobal("fetch", fetchMock);
    open();
    await screen.findByRole("heading", { name: /Tax invoice/ });
    await waitFor(() => expect(viewedCalls(fetchMock)).toHaveLength(1));
    expect(viewedCalls(fetchMock)[0][1]).toMatchObject({ method: "POST", credentials: "omit" });
  });

  it("does not say it loaded when the link did not work", async () => {
    const fetchMock = reply(404, { success: false, errorCode: "SHARE_NOT_FOUND", message: "x" });
    vi.stubGlobal("fetch", fetchMock);
    open();
    await screen.findByRole("alert");
    expect(viewedCalls(fetchMock)).toHaveLength(0);
  });

  it("downloads exactly the customer's copy, never the internal one", async () => {
    vi.stubGlobal("fetch", reply(200, { success: true, data: SNAPSHOT }));
    open();
    fireEvent.click(await screen.findByRole("button", { name: /download pdf/i }));
    await waitFor(() => expect(pdfs[0]?.save).toHaveBeenCalledWith("Tax-invoice_INV-2026-0042.pdf"));
    expect(pdfs).toHaveLength(1);
    expect(pdfs[0].addPage).not.toHaveBeenCalled();
    expect(screen.queryByText(/internal copy/i)).toBeNull();
  });
});

describe("a link that cannot be shown", () => {
  const failWith = async (status, body) => {
    vi.stubGlobal("fetch", reply(status, body));
    open();
    return screen.findByRole("alert");
  };

  it("withdrawn: names who to ask", async () => {
    const a = await failWith(410, { success: false, errorCode: "SHARE_REVOKED", details: { company: "Harbour Trading LLC" } });
    expect(a).toHaveTextContent("This link has been withdrawn");
    expect(a).toHaveTextContent("Harbour Trading LLC withdrew this link. Ask them to send the document again.");
    expect(screen.queryByRole("button", { name: /download/i })).toBeNull();
  });

  it("expired: names who to ask for a new one", async () => {
    const a = await failWith(410, { success: false, errorCode: "SHARE_EXPIRED", details: { company: "Harbour Trading LLC" } });
    expect(a).toHaveTextContent("This link has expired");
    expect(a).toHaveTextContent("Ask Harbour Trading LLC for a new one.");
  });

  it("not found: has no company to name, and does not pretend to", async () => {
    const a = await failWith(404, { success: false, errorCode: "SHARE_NOT_FOUND" });
    expect(a).toHaveTextContent("This link does not work");
    expect(a).toHaveTextContent("Ask the sender to send it again.");
    expect(a.textContent).not.toMatch(/null|undefined/);
  });

  it("too many requests: asks to wait", async () => {
    expect(await failWith(429, { success: false, errorCode: "SHARE_RATE_LIMIT" })).toHaveTextContent("Too many requests");
  });

  it("offline: says so and tries again on request", async () => {
    const ok = () => new Response(JSON.stringify({ success: true, data: SNAPSHOT }), { status: 200, headers: { "content-type": "application/json" } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockImplementation(async () => ok()));
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("The document could not be loaded");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("heading", { name: /Tax invoice/ })).toBeInTheDocument();
  });

  it("every code has its own wording and none leaks a raw code", () => {
    for (const code of ["SHARE_REVOKED", "SHARE_EXPIRED", "SHARE_NOT_FOUND", "SHARE_RATE_LIMIT", "OFFLINE", "ERROR", "SOMETHING_ELSE"]) {
      const p = problemText({ code, company: "X Ltd" });
      expect(p.title.length, code).toBeGreaterThan(5);
      expect(`${p.title} ${p.text}`, code).not.toMatch(/SHARE_|undefined|null/);
    }
  });
});

describe("the sheet is built from the frozen copy", () => {
  it("is the same sheet the signed-in screen builds, with only the customer copy", () => {
    const built = buildFromShare(SNAPSHOT);
    expect(built.title).toBe("Tax invoice");
    expect(built.number).toBe("INV-2026-0042");
    expect(built.fileName).toBe("Tax-invoice_INV-2026-0042");
    expect(built.copies).toEqual(["Customer copy"]);
    expect(built.sheet.totals.grandTotal).toBe(210);
    expect(built.sheet.company.nameEn).toBe("Harbour Trading LLC");
    expect(built.sheet.party.name).toBe("Al Noor Trading");
  });

  it("a kind it does not know is not drawn", () => {
    expect(buildFromShare({ kind: "nonsense" })).toBeNull();
    expect(buildFromShare(null)).toBeNull();
  });
});

describe("fitting the page to a phone", () => {
  it("scales the A4 page down to the width it has, and never up", () => {
    expect(SHEET_DESIGN_WIDTH).toBe(794);
    expect(fitScale(397)).toBeCloseTo(0.5, 5);
    expect(fitScale(342)).toBeCloseTo(0.4307, 3);
    expect(fitScale(794)).toBe(1);
    expect(fitScale(1440)).toBe(1);
  });

  it("with no width to go on, it keeps the true size", () => {
    for (const v of [0, -5, NaN, undefined, null, "abc"]) expect(fitScale(v), String(v)).toBe(1);
  });

  it("the page still renders, with the sheet inside a box sized to it", async () => {
    vi.stubGlobal("fetch", reply(200, { success: true, data: SNAPSHOT }));
    open();
    await screen.findByRole("heading", { name: /Tax invoice/ });
    const sheet = document.querySelector("[data-print-preview] > div > div");
    expect(sheet).not.toBeNull();
    expect(sheet.firstElementChild.style.width).toBe("794px");
  });
});
