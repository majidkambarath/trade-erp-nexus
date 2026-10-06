import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Installing behaves differently in every browser, and the difference is invisible until
// someone taps the thing on a phone. These pin down what the menu offers in each case - most
// importantly that it never offers an install the browser is going to refuse without saying so.

const load = async () => {
  vi.resetModules();
  const mod = await import("../InstallApp");
  return mod;
};

/** Pretend to be a browser: secure or not, iOS or not, already installed or not. */
function asBrowser({ secure = true, ios = false, standalone = false } = {}) {
  Object.defineProperty(window, "isSecureContext", { value: secure, configurable: true });
  Object.defineProperty(window.navigator, "userAgent", {
    value: ios
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
      : "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120",
    configurable: true,
  });
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: standalone && query.includes("display-mode"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

function Harness({ useInstall }) {
  const { canInstall, install, iosSheet } = useInstall();
  return (
    <>
      {canInstall && (
        <button type="button" onClick={install}>
          Install app
        </button>
      )}
      {iosSheet}
    </>
  );
}

beforeEach(() => {
  asBrowser();
});

afterEach(() => {
  delete window.matchMedia;
});

describe("the install offer", () => {
  it("says why a plain-http address cannot install, instead of doing nothing", async () => {
    asBrowser({ secure: false, ios: false });
    const { useInstall } = await load();
    render(<Harness useInstall={useInstall} />);

    fireEvent.click(screen.getByRole("button", { name: "Install app" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toMatch(/cannot be installed/i);
    expect(dialog.textContent).toMatch(/https/i);
  });

  it("tells an iPhone how, because Safari has no install prompt to call", async () => {
    asBrowser({ secure: false, ios: true });
    const { useInstall } = await load();
    render(<Harness useInstall={useInstall} />);

    fireEvent.click(screen.getByRole("button", { name: "Install app" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toMatch(/Add to Home Screen/i);
  });

  it("offers nothing once the app is already running installed", async () => {
    asBrowser({ secure: true, standalone: true });
    const { useInstall } = await load();
    render(<Harness useInstall={useInstall} />);
    expect(screen.queryByRole("button", { name: "Install app" })).toBeNull();
  });

  it("offers nothing on a browser that cannot install but is on a sound address", async () => {
    asBrowser({ secure: true, ios: false });
    const { useInstall } = await load();
    render(<Harness useInstall={useInstall} />);
    expect(screen.queryByRole("button", { name: "Install app" })).toBeNull();
  });

  it("runs the browser's own dialog once it has offered one", async () => {
    asBrowser({ secure: true, ios: false });
    const { useInstall } = await load();

    const prompt = vi.fn();
    const event = Object.assign(new Event("beforeinstallprompt"), {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);

    render(<Harness useInstall={useInstall} />);
    const button = await screen.findByRole("button", { name: "Install app" });
    fireEvent.click(button);
    await waitFor(() => expect(prompt).toHaveBeenCalled());
    // the browser's dialog is the browser's; nothing of ours is shown over it
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the explanation again", async () => {
    asBrowser({ secure: false, ios: true });
    const { useInstall } = await load();
    render(<Harness useInstall={useInstall} />);

    fireEvent.click(screen.getByRole("button", { name: "Install app" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
