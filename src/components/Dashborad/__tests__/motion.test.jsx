import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { motionOK } from "../motion";
import { CountUp } from "../CountUp";

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
});
const media = (reduce) => {
  window.matchMedia = vi.fn((query) => ({ matches: reduce && query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
};

describe("motionOK", () => {
  it("is off where there is no matchMedia, so a test or an old WebView sees final figures", () => {
    window.matchMedia = undefined;
    expect(motionOK()).toBe(false);
  });

  it("is off when the person asked for reduced motion, on otherwise", () => {
    media(true);
    expect(motionOK()).toBe(false);
    media(false);
    expect(motionOK()).toBe(true);
  });
});

describe("CountUp", () => {
  const money = (v) => `AED ${Math.round(v).toLocaleString("en-US")}`;

  it("with reduced motion the real figure is there at once and nothing animates", () => {
    media(true);
    render(<CountUp value={12500} format={money} />);
    expect(screen.getByText("AED 12,500")).toBeInTheDocument();
  });

  it("with motion it counts up from zero and ends on exactly the real figure", async () => {
    media(false);
    const { container } = render(<CountUp value={12500} format={money} duration={0.4} />);
    const el = container.querySelector("span");
    expect(el.textContent).toBe("AED 0"); // set before paint: the final figure never flashes first
    await waitFor(() => expect(el.textContent).toBe("AED 12,500"), { timeout: 3000 });
  });

  it("a value that is not a number reads as a dash, never NaN", () => {
    media(true);
    const { container } = render(<CountUp value={undefined} format={money} />);
    expect(container.textContent).toBe("—");
  });

  it("a new value replaces the old one without leaving the count half way", async () => {
    media(false);
    const { container, rerender } = render(<CountUp value={100} format={money} duration={0.3} />);
    await waitFor(() => expect(container.textContent).toBe("AED 100"), { timeout: 3000 });
    rerender(<CountUp value={900} format={money} duration={0.3} />);
    await waitFor(() => expect(container.textContent).toBe("AED 900"), { timeout: 3000 });
  });
});
