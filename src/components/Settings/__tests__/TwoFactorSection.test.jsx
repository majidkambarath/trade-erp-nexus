import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Settings from "../Settings";
import TwoFactorSection from "../TwoFactorSection";
import { AsRole, roleLoaded, statusFor } from "../../shell/__tests__/asRole";
import { ThemeProvider } from "../../theme-provider";

// Settings -> Security: a person's own two-factor, and - only for someone who may change settings - the organisation's rule.
const api = vi.hoisted(() => ({
  twoFactor: { status: vi.fn(), setup: vi.fn(), enable: vi.fn(), disable: vi.fn(), recoveryCodes: vi.fn() },
  securityPolicy: { save: vi.fn() },
}));
vi.mock("../../../lib/authApi", () => api);
let orgStatus;
vi.mock("../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));
vi.mock("../../../lib/qr", () => ({ qrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,QR") }));
const http = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock("../../../axios/axios", () => ({ default: { get: http.get, put: http.put } }));

const statusWith = (grants, { twoFactorEnabled = false, requireTwoFactor = false } = {}) => {
  const s = statusFor(grants);
  return { ...s, me: { ...s.me, email: "nadia@acme.test", twoFactorEnabled }, policy: { approvals: {}, security: { requireTwoFactor } } };
};
const renderSection = () => render(<ThemeProvider><AsRole><TwoFactorSection notify={vi.fn()} /></AsRole></ThemeProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  api.twoFactor.status.mockResolvedValue({ enabled: false, enabledAt: null, recoveryCodesLeft: 0 });
  api.securityPolicy.save.mockImplementation(async (body) => body);
});

describe("the organisation's rule", () => {
  const RULE = /Require two-factor for everyone/;

  it("is shown to someone who may change settings, and hidden from everyone else", async () => {
    orgStatus = statusWith(["settings.view", "settings.manage"]);
    const first = renderSection();
    await roleLoaded();
    expect(await screen.findByLabelText(RULE)).toBeInTheDocument();
    first.unmount();

    orgStatus = statusWith(["settings.view"]);
    renderSection();
    await roleLoaded();
    await screen.findByText("Off"); // the person's own panel has loaded
    expect(screen.queryByLabelText(RULE)).toBeNull();
    expect(screen.queryByText(/Require two-factor/)).toBeNull();
  });

  it("will not switch the rule on for someone who has not set two-factor up themselves, and says why", async () => {
    orgStatus = statusWith(["settings.manage"], { twoFactorEnabled: false });
    renderSection();
    await roleLoaded();
    fireEvent.click(await screen.findByLabelText(RULE));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Turn on two-factor for your own account first/);
    expect(api.securityPolicy.save).not.toHaveBeenCalled();
  });

  it("saves the rule when the person has it on themselves, and reads the status again", async () => {
    orgStatus = statusWith(["settings.manage"], { twoFactorEnabled: true });
    api.twoFactor.status.mockResolvedValue({ enabled: true, enabledAt: "2026-10-01T08:00:00.000Z", recoveryCodesLeft: 10 });
    renderSection();
    await roleLoaded();
    const box = await screen.findByLabelText(RULE);
    expect(box).not.toBeChecked();
    orgStatus = statusWith(["settings.manage"], { twoFactorEnabled: true, requireTwoFactor: true }); // what the status says after the save
    fireEvent.click(box);
    await waitFor(() => expect(api.securityPolicy.save).toHaveBeenCalledWith({ requireTwoFactor: true }));
    await waitFor(() => expect(screen.getByLabelText(RULE)).toBeChecked());
    // and now nobody, the person included, can turn their own off
    expect(screen.queryByRole("button", { name: "Turn off two-factor" })).toBeNull();
  });

  it("shows the server's words if it refuses", async () => {
    orgStatus = statusWith(["settings.manage"], { twoFactorEnabled: true });
    api.securityPolicy.save.mockRejectedValue(Object.assign(new Error("x"), { response: { data: { message: "Turn on two-factor for your own account first." } } }));
    renderSection();
    await roleLoaded();
    fireEvent.click(await screen.findByLabelText(RULE));
    expect(await screen.findByRole("alert")).toHaveTextContent("Turn on two-factor for your own account first.");
  });
});

describe("on the Settings page", () => {
  it("the Security tab holds the password change and, under it, the two-factor panel", async () => {
    orgStatus = statusWith(["settings.view"]);
    http.get.mockImplementation(async () => ({ data: { success: true, data: { companyName: "Harbour Trading" } } }));
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/settings?tab=security"]}>
          <AsRole><Settings /></AsRole>
        </MemoryRouter>
      </ThemeProvider>
    );
    expect(await screen.findByText("Change password")).toBeInTheDocument();
    expect(await screen.findByText("Two-factor sign-in")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Turn on two-factor/ })).toBeInTheDocument();
  });
});
