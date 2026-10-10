import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "../../theme-provider";
import Layout from "../../Layout";
import TwoFactorRequired from "../TwoFactorRequired";

// An organisation that requires two-factor sign-in: until the person has set it up, the app shows one page, and it is the setup.
const api = vi.hoisted(() => ({ twoFactor: { setup: vi.fn(), enable: vi.fn() } }));
vi.mock("../../../lib/authApi", () => api);
vi.mock("../../../lib/qr", () => ({ qrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,QR") }));
let status;
vi.mock("../../../axios/axios", () => ({
  default: {
    get: vi.fn((url) => Promise.resolve({ data: { success: true, data: url === "/organisation/status" ? status : { name: "Nadia", email: "nadia@acme.test" } } })),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
  signOutLocally: async () => (await import("../../../axios/session")).clearSession(),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});

const CODES = ["AAAAA-BBBBB", "CCCCC-DDDDD", "EEEEE-FFFFF", "GGGGG-HHHHH", "JJJJJ-KKKKK", "MMMMM-NNNNN", "PPPPP-QQQQQ", "RRRRR-SSSSS", "TTTTT-VVVVV", "WWWWW-XXXXX"];
const me = (twoFactorRequired) => ({ id: "u1", name: "Nadia", email: "nadia@acme.test", role: { key: "sales", name: "Sales", rank: 40 }, grants: ["sales.view"], twoFactorEnabled: !twoFactorRequired, twoFactorRequired });
const baseStatus = (twoFactorRequired) => ({
  organisation: { code: "acme", legalName: "Acme Trading LLC", baseCurrency: "AED" },
  subscription: { state: "active", blocked: false },
  features: {},
  me: me(twoFactorRequired),
  policy: { approvals: {}, security: { requireTwoFactor: true } },
});

beforeEach(() => {
  vi.clearAllMocks();
  api.twoFactor.setup.mockResolvedValue({ secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", formattedSecret: "GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ", uri: "otpauth://totp/x?secret=GEZD" });
  api.twoFactor.enable.mockResolvedValue({ recoveryCodes: CODES });
});

describe("the page", () => {
  it("says why, by name, and offers to sign out instead", () => {
    const onSignOut = vi.fn();
    render(<TwoFactorRequired name="Nadia" email="nadia@acme.test" onEnrolled={vi.fn()} onSignOut={onSignOut} />);
    expect(screen.getByRole("heading", { name: "Set up two-factor sign-in" })).toBeInTheDocument();
    expect(screen.getByText(/Nadia, your organisation requires a code from an authenticator app/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it("walks the three steps and then tells the app, which reads the status again so it opens", async () => {
    const onEnrolled = vi.fn();
    render(<TwoFactorRequired name="Nadia" email="nadia@acme.test" onEnrolled={onEnrolled} onSignOut={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^Your password/), { target: { value: "her-password-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(await screen.findByLabelText(/^Code from your app/), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    await screen.findByRole("list", { name: "Recovery codes" });
    expect(onEnrolled).not.toHaveBeenCalled(); // not until the codes have been kept
    fireEvent.click(screen.getByLabelText("I have saved these codes somewhere safe"));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onEnrolled).toHaveBeenCalledTimes(1);
  });
});

describe("in the shell", () => {
  const renderShell = () =>
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/sales-order"]}>
          <Routes>
            <Route path="/" element={<p>login page</p>} />
            <Route element={<Layout />}><Route path="*" element={<p>the page itself</p>} /></Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    );

  it("replaces the whole app, rail and page included, when the organisation requires it and the person has not set it up", async () => {
    status = baseStatus(true);
    renderShell();
    expect(await screen.findByRole("heading", { name: "Set up two-factor sign-in" })).toBeInTheDocument();
    expect(screen.queryByText("the page itself")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("opens the app for someone who has it", async () => {
    status = baseStatus(false);
    renderShell();
    expect(await screen.findByText("the page itself")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Set up two-factor sign-in" })).toBeNull();
  });

  it("a password someone else chose comes first: that gate is the server's first too", async () => {
    status = { ...baseStatus(true), me: { ...me(true), mustChangePassword: true } };
    renderShell();
    expect(await screen.findByRole("heading", { name: "Choose your own password" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Set up two-factor sign-in" })).toBeNull());
  });
});
