import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import ApproveButton, { trackApproval } from "../ApproveButton";

describe("ApproveButton", () => {
  it("is disabled with a spinner while its own document is being approved, and only that one", async () => {
    render(<><ApproveButton id="a" title="Confirm">Confirm</ApproveButton><ApproveButton id="b" title="Confirm b">Confirm</ApproveButton></>);
    let release;
    const pending = new Promise((r) => { release = r; });
    let run;
    await act(async () => { run = trackApproval("a", () => pending); });
    const a = screen.getByTitle("Confirm");
    expect(a).toBeDisabled();
    expect(a).toHaveAttribute("aria-busy", "true");
    expect(a.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.getByTitle("Confirm b")).toBeEnabled();
    await act(async () => { release(); await run; });
    expect(screen.getByTitle("Confirm")).toBeEnabled();
    expect(screen.getByTitle("Confirm").querySelector(".animate-spin")).toBeNull();
  });

  it("frees the button when the approval fails", async () => {
    render(<ApproveButton id="c" title="Confirm c">Confirm</ApproveButton>);
    await act(async () => { await trackApproval("c", async () => { throw new Error("no"); }).catch(() => {}); });
    expect(screen.getByTitle("Confirm c")).toBeEnabled();
  });
});
