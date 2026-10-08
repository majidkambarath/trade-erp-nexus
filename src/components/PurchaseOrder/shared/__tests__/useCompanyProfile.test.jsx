import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { useCompanyProfile } from "../useCompanyProfile";
import axiosInstance from "../../../../axios/axios";

vi.mock("../../../../axios/axios", () => ({ default: { get: vi.fn() } }));
vi.mock("../../../../axios/session", () => ({ getAccessToken: () => "token" }));

const PROFILE = { success: true, data: { companyInfo: { companyName: "Harbour Trading LLC", emailAddress: "a@h.ae", companyLogo: { url: "https://x/l.png" } } } };
const answer = (map) => (url) => (url in map ? (map[url] instanceof Error ? Promise.reject(map[url]) : Promise.resolve({ data: map[url] })) : Promise.reject(new Error("unexpected " + url)));

function Probe() {
  const p = useCompanyProfile();
  return <p data-testid="p">{JSON.stringify({ n: p.companyName, t: p.vatNumber })}</p>;
}
const read = async (check) => { render(<Probe />); await waitFor(() => check(JSON.parse(screen.getByTestId("p").textContent))); };

beforeEach(() => vi.clearAllMocks());

describe("the company on a printed invoice", () => {
  it("takes the TRN from the tax identity in the accounting settings, because the profile has no field for it", async () => {
    axiosInstance.get.mockImplementation(answer({ "/profile/me": PROFILE, "/accounting/settings": { success: true, data: { profile: { trn: "100123456700003" } } } }));
    await read((p) => expect(p).toEqual({ n: "Harbour Trading LLC", t: "100123456700003" }));
  });

  it("a TRN already on the profile wins over the settings", async () => {
    const withTrn = { ...PROFILE, data: { companyInfo: { ...PROFILE.data.companyInfo, vatNumber: "111111111111111" } } };
    axiosInstance.get.mockImplementation(answer({ "/profile/me": withTrn, "/accounting/settings": { data: { profile: { trn: "100123456700003" } } } }));
    await read((p) => expect(p.t).toBe("111111111111111"));
  });

  it("if the settings cannot be read the rest of the company is still shown", async () => {
    axiosInstance.get.mockImplementation(answer({ "/profile/me": PROFILE, "/accounting/settings": new Error("500") }));
    await read((p) => expect(p).toEqual({ n: "Harbour Trading LLC", t: "" }));
  });

  it("no TRN anywhere stays empty, never a placeholder", async () => {
    axiosInstance.get.mockImplementation(answer({ "/profile/me": PROFILE, "/accounting/settings": { data: { profile: {} } } }));
    await read((p) => expect(p.t).toBe(""));
  });
});
