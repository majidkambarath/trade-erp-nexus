import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import TwoFactorPanel from "../TwoFactorPanel";
import { formatDate } from "../../../utils/format";

// A person's own two-factor: on or off, turning it off and replacing the recovery codes (both ask for the password AND a code).
vi.mock("../../../lib/qr", () => ({ qrDataUrl: vi.fn().mockResolvedValue("data:image/png;base64,QR") }));

const ENABLED_AT = "2026-10-01T08:00:00.000Z";
const NEW_CODES = ["AAAAA-BBBBB", "CCCCC-DDDDD", "EEEEE-FFFFF", "GGGGG-HHHHH", "JJJJJ-KKKKK", "MMMMM-NNNNN", "PPPPP-QQQQQ", "RRRRR-SSSSS", "TTTTT-VVVVV", "WWWWW-XXXXX"];
const refused = (status, errorCode, message) => Object.assign(new Error("refused"), { response: { status, data: { success: false, errorCode, message } } });
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

let api, onChanged, notify;
const renderPanel = (props = {}) => render(<TwoFactorPanel api={api} account="nadia@acme.test" issuer="Zarvia" onChanged={onChanged} notify={notify} {...props} />);

beforeEach(() => {
  api = {
    status: vi.fn().mockResolvedValue({ enabled: false, enabledAt: null, recoveryCodesLeft: 0, required: false }),
    setup: vi.fn(), enable: vi.fn(),
    disable: vi.fn().mockResolvedValue({ enabled: false }),
    recoveryCodes: vi.fn().mockResolvedValue({ recoveryCodes: NEW_CODES }),
  };
  onChanged = vi.fn();
  notify = vi.fn();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue() } });
});

describe("two-factor is off", () => {
  it("says so, and offers to turn it on", async () => {
    renderPanel();
    expect(await screen.findByText("Off")).toBeInTheDocument();
    expect(screen.getByText(/Anyone who learns your password can sign in as you/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Turn on two-factor/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New recovery codes/ })).toBeNull();
  });

  it("opens the setup in a dialog that starts with the password", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Turn on two-factor/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText(/^Your password/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("turning it on", () => {
  const SHOWN = { secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", formattedSecret: "GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ", uri: "otpauth://totp/x?secret=GEZD" };
  const toCodes = async () => {
    api.setup.mockResolvedValue(SHOWN);
    api.enable.mockImplementation(async () => {
      api.status.mockResolvedValue({ enabled: true, enabledAt: ENABLED_AT, recoveryCodesLeft: 10, required: false });
      return { recoveryCodes: NEW_CODES };
    });
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Turn on two-factor/ }));
    type(/^Your password/, "her-password-1");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(await screen.findByLabelText(/^Code from your app/), { target: { value: "123456" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Turn on two-factor" }));
    await screen.findByRole("list", { name: "Recovery codes" });
  };

  it("says On behind the dialog as soon as the server has turned it on, and tells the page", async () => {
    await toCodes();
    await waitFor(() => expect(screen.getByText("On")).toBeInTheDocument());
    expect(onChanged).toHaveBeenCalled();
  });

  it("closing before the recovery codes are kept asks first - they are shown only once - and Cancel keeps them on screen", async () => {
    await toCodes();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(await screen.findByText("Close without keeping your recovery codes?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("list", { name: "Recovery codes" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Close anyway" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(notify).toHaveBeenCalledWith("Two-factor sign-in is on");
  });

  it("closing the dialog on the password step needs no question", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /Turn on two-factor/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("two-factor is on", () => {
  beforeEach(() => {
    api.status.mockResolvedValue({ enabled: true, enabledAt: ENABLED_AT, recoveryCodesLeft: 8, required: false });
  });

  it("says since when and how many recovery codes are left", async () => {
    renderPanel();
    expect(await screen.findByText("On")).toBeInTheDocument();
    expect(screen.getByText(formatDate(ENABLED_AT))).toBeInTheDocument();
    expect(screen.getByText(/You have/)).toHaveTextContent("You have 8 recovery codes left.");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("warns when the recovery codes are nearly gone, and when they are", async () => {
    api.status.mockResolvedValue({ enabled: true, enabledAt: ENABLED_AT, recoveryCodesLeft: 1, required: false });
    const { unmount } = renderPanel();
    expect(await screen.findByRole("note")).toHaveTextContent(/running low on recovery codes/);
    expect(screen.getByText(/You have/)).toHaveTextContent("1 recovery code left");
    unmount();
    api.status.mockResolvedValue({ enabled: true, enabledAt: ENABLED_AT, recoveryCodesLeft: 0, required: false });
    renderPanel();
    expect(await screen.findByRole("note")).toHaveTextContent(/no recovery codes left/);
  });

  it("turns it off only with the password and a code, and tells the page to read the status again", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Turn off two-factor" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter your password");
    type(/^Your password/, "her-password-1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(/six-digit code/);
    expect(api.disable).not.toHaveBeenCalled();

    type(/^Code from your app, or a recovery code/, "123 456");
    fireEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(api.disable).toHaveBeenCalledWith({ password: "her-password-1", code: "123456" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(notify).toHaveBeenCalledWith("Two-factor sign-in is off");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("takes a recovery code in place of the app's code", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Turn off two-factor" }));
    type(/^Your password/, "her-password-1");
    type(/^Code from your app, or a recovery code/, "abcde-fghjk");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(api.disable).toHaveBeenCalledWith({ password: "her-password-1", recoveryCode: "ABCDEFGHJK" }));
  });

  it("a wrong password or code keeps the dialog open and says why", async () => {
    api.disable.mockRejectedValueOnce(refused(400, "PASSWORD_INCORRECT"));
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: "Turn off two-factor" }));
    type(/^Your password/, "wrong");
    type(/^Code from your app, or a recovery code/, "123456");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Turn off" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("That password is not right.");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("makes new recovery codes with the password and a code, and shows them once", async () => {
    renderPanel();
    fireEvent.click(await screen.findByRole("button", { name: /New recovery codes/ }));
    type(/^Your password/, "her-password-1");
    type(/^Code from your app, or a recovery code/, "123456");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Make new codes" }));
    const list = await screen.findByRole("list", { name: "Recovery codes" });
    expect(api.recoveryCodes).toHaveBeenCalledWith({ password: "her-password-1", code: "123456" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(10);
    fireEvent.click(screen.getByLabelText("I have saved these codes somewhere safe"));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(notify).toHaveBeenCalledWith("New recovery codes made");
  });

  it("when the organisation requires it there is no way to turn it off, and the screen says why", async () => {
    renderPanel({ locked: true });
    await screen.findByText("On");
    expect(screen.queryByRole("button", { name: "Turn off two-factor" })).toBeNull();
    expect(screen.getByText(/requires two-factor sign-in, so it cannot be turned off/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New recovery codes/ })).toBeInTheDocument();
  });
});

describe("when the status cannot be read", () => {
  it("says so and offers to try again, instead of showing a wrong state", async () => {
    api.status.mockRejectedValueOnce(new Error("offline"));
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the two-factor status");
    expect(screen.queryByText("Off")).toBeNull();
    api.status.mockResolvedValue({ enabled: false, enabledAt: null, recoveryCodesLeft: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Off")).toBeInTheDocument();
  });
});
