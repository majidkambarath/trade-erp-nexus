import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import TwoFactorEnrol from "../TwoFactorEnrol";

// Setting two-factor up: the password again, the key and the QR code, the code from the app, and the recovery codes shown once.
const qr = vi.hoisted(() => ({ qrDataUrl: vi.fn() }));
vi.mock("../../../lib/qr", () => ({ qrDataUrl: qr.qrDataUrl }));

const CODES = ["AAAAA-BBBBB", "CCCCC-DDDDD", "EEEEE-FFFFF", "GGGGG-HHHHH", "JJJJJ-KKKKK", "MMMMM-NNNNN", "PPPPP-QQQQQ", "RRRRR-SSSSS", "TTTTT-VVVVV", "WWWWW-XXXXX"];
const SHOWN = { secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", formattedSecret: "GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ", uri: "otpauth://totp/Zarvia:nadia%40acme.test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Zarvia" };
const refused = (status, errorCode, message) => Object.assign(new Error("refused"), { response: { status, data: { success: false, errorCode, message } } });
const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

let api, onFinished, onCancel;
const renderEnrol = () => render(<TwoFactorEnrol api={api} account="nadia@acme.test" issuer="Zarvia" onFinished={onFinished} onCancel={onCancel} />);
const toScanStep = async () => {
  renderEnrol();
  type(/^Your password/, "her-password-1");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Setup key");
};

beforeEach(() => {
  qr.qrDataUrl.mockReset().mockResolvedValue("data:image/png;base64,QRPICTURE");
  api = { setup: vi.fn().mockResolvedValue(SHOWN), enable: vi.fn().mockResolvedValue({ recoveryCodes: CODES }) };
  onFinished = vi.fn();
  onCancel = vi.fn();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue() } });
});

describe("step one: the password", () => {
  it("asks for it before anything else, and starts nothing without it", () => {
    renderEnrol();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your password");
    expect(api.setup).not.toHaveBeenCalled();
  });

  it("a wrong password is said in words, and the key is not shown", async () => {
    api.setup.mockRejectedValue(refused(400, "PASSWORD_INCORRECT"));
    renderEnrol();
    type(/^Your password/, "nope");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That password is not right.");
    expect(screen.queryByLabelText("Setup key")).toBeNull();
  });

  it("can be cancelled", () => {
    renderEnrol();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("step two: the key and the code", () => {
  it("sends the password, then shows the QR code and the key to type, and forgets the password", async () => {
    await toScanStep();
    expect(api.setup).toHaveBeenCalledWith("her-password-1");
    expect(screen.getByLabelText("Setup key")).toHaveTextContent("GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ");
    const picture = await screen.findByRole("img", { name: /QR code to add nadia@acme\.test/ });
    expect(picture).toHaveAttribute("src", "data:image/png;base64,QRPICTURE");
    expect(qr.qrDataUrl).toHaveBeenCalledWith(SHOWN.uri);
    expect(screen.queryByDisplayValue("her-password-1")).toBeNull();
  });

  it("copies the key", async () => {
    await toScanStep();
    fireEvent.click(screen.getByRole("button", { name: /Copy key/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SHOWN.secret));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  it("if the picture cannot be drawn the key is still there to type", async () => {
    qr.qrDataUrl.mockRejectedValue(new Error("no canvas"));
    await toScanStep();
    expect(await screen.findByText(/picture could not be drawn/)).toBeInTheDocument();
    expect(screen.getByLabelText("Setup key")).toBeInTheDocument();
  });

  it("asks for six digits only - a recovery code is no proof the app works - and does not send anything else", async () => {
    await toScanStep();
    for (const bad of ["", "12345", "abcde-fghjk"]) {
      type(/^Code from your app/, bad);
      fireEvent.click(screen.getByRole("button", { name: "Turn on two-factor" }));
      expect(screen.getByRole("alert")).toBeInTheDocument();
    }
    expect(api.enable).not.toHaveBeenCalled();
  });

  it("a wrong code is said in words and nothing is turned on", async () => {
    api.enable.mockRejectedValue(refused(400, "INVALID_TWO_FACTOR_CODE"));
    await toScanStep();
    type(/^Code from your app/, "000000");
    fireEvent.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/That code is not right/);
    expect(onFinished).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Recovery codes")).toBeNull();
  });

  it("types the digits grouped, and sends them plain", async () => {
    await toScanStep();
    const box = screen.getByLabelText(/^Code from your app/);
    fireEvent.change(box, { target: { value: "123456" } });
    expect(box).toHaveValue("123 456");
    fireEvent.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    await screen.findByRole("list", { name: "Recovery codes" });
    expect(api.enable).toHaveBeenCalledWith("123456");
  });
});

describe("step three: the recovery codes, once", () => {
  const toCodes = async () => {
    await toScanStep();
    type(/^Code from your app/, "123456");
    fireEvent.click(screen.getByRole("button", { name: "Turn on two-factor" }));
    return screen.findByRole("list", { name: "Recovery codes" });
  };

  it("shows all ten, and does not let go until the person says they are saved", async () => {
    const list = await toCodes();
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(CODES);
    const done = screen.getByRole("button", { name: "Done" });
    expect(done).toBeDisabled();
    fireEvent.click(screen.getByLabelText("I have saved these codes somewhere safe"));
    expect(done).toBeEnabled();
    fireEvent.click(done);
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it("copies them, one to a line", async () => {
    await toCodes();
    fireEvent.click(screen.getByRole("button", { name: /^Copy$/ }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CODES.join("\n")));
  });

  it("saves them as a file named for the account, with the date the app shows dates in", async () => {
    await toCodes();
    const blobs = [];
    URL.createObjectURL = vi.fn((b) => { blobs.push(b); return "blob:codes"; });
    URL.revokeObjectURL = vi.fn();
    const clicked = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click() { clicked.push(this.download); };
    try {
      fireEvent.click(screen.getByRole("button", { name: "Save as a file" }));
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
    expect(clicked).toEqual(["recovery-codes-nadia@acme.test.txt"]);
    const text = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blobs[0]); }); // (jsdom has no Blob.text)
    expect(text).toContain("Zarvia recovery codes for nadia@acme.test");
    for (const code of CODES) expect(text).toContain(code);
  });
});
