import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useCompanyProfile } from "../useCompanyProfile";
import axiosInstance from "../../../../axios/axios";

vi.mock("../../../../axios/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("../../../../axios/session", () => ({ getAccessToken: () => "token" }));

const LETTERHEAD = {
  success: true,
  data: {
    companyName: "Harbour Trading LLC", emailAddress: "a@h.ae", vatNumber: "100123456700003", companyLogo: { url: "https://x/l.png" },
    addressLine1: "Deira", bankDetails: { bankName: "Emirates NBD", ibanNumber: "AE070331234567890123456" }, branch: "Deira",
  },
};

function Probe() {
  const p = useCompanyProfile();
  return <p data-testid="p">{JSON.stringify({ n: p.companyName, t: p.vatNumber, e: p.email, l: p.logo, b: p.bankName, i: p.ibanNumber, br: p.branch })}</p>;
}
const read = async (check) => { render(<Probe />); await waitFor(() => check(JSON.parse(screen.getByTestId("p").textContent))); };

beforeEach(() => vi.clearAllMocks());

describe("the company on a printed invoice", () => {
  it("is the organisation's letterhead, read from one place", async () => {
    axiosInstance.get.mockResolvedValue({ data: LETTERHEAD });
    await read((p) => expect(p).toEqual({ n: "Harbour Trading LLC", t: "100123456700003", e: "a@h.ae", l: "https://x/l.png", b: "Emirates NBD", i: "AE070331234567890123456", br: "Deira" }));
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
    expect(axiosInstance.get).toHaveBeenCalledWith("/company/profile");
  });

  it("takes the TRN from the letterhead's own answer: one source, so the invoice and the VAT return cannot differ", async () => {
    axiosInstance.get.mockResolvedValue({ data: LETTERHEAD });
    await read((p) => expect(p.t).toBe("100123456700003"));
    expect(axiosInstance.get).not.toHaveBeenCalledWith("/accounting/settings");
  });

  it("no TRN anywhere stays empty, never a placeholder", async () => {
    axiosInstance.get.mockResolvedValue({ data: { success: true, data: { companyName: "Harbour Trading LLC" } } });
    await read((p) => expect(p).toMatchObject({ n: "Harbour Trading LLC", t: "", b: "", l: null }));
  });

  it("if the letterhead cannot be read nothing is invented", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    axiosInstance.get.mockRejectedValue(new Error("500"));
    render(<Probe />);
    await waitFor(() => expect(log).toHaveBeenCalled());
    expect(JSON.parse(screen.getByTestId("p").textContent)).toMatchObject({ n: "", t: "", l: null });
    log.mockRestore();
  });
});
