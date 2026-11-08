import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";

import EstimateApproval from "../EstimateApproval";

// The one page a customer WRITES to, with no login. Covers what the backend's own HTTP tests prove it
// refuses - here, what the SCREEN does with that refusal, and that it never adds money up for itself.

const payload = () => ({
  kind: "job_estimate",
  currency: "AED",
  job: {
    jobNo: "JC-2026-0001", status: "AWAITING_APPROVAL", receivedAt: "2026-11-01T00:00:00.000Z", odometerIn: 84500,
    vehicle: { plateNumber: "12345", plateCode: "A", plateEmirate: "Dubai", make: "Toyota", model: "Land Cruiser" },
    estimate: { version: 1, total: 441, sentAt: "2026-11-01T00:00:00.000Z" },
    complaints: [{ seq: 1, concern: "Noise when braking", cause: "Front pads worn" }],
    inspection: [{ _id: "insp1", item: "Front brake pads", condition: "urgent", note: "2mm left", photos: ["a1b2c3"] }],
    lines: [
      { _id: "line1", kind: "part", description: "Front brake pads", qty: 1, lineTotal: 441, approved: undefined },
      { _id: "line2", kind: "labour", description: "Fit brake pads", qty: 1, lineTotal: 210, approved: undefined },
    ],
  },
  totals: { total: 651 },
  party: { customerName: "Ali Hassan" },
  company: { companyName: "Al Manara Auto Garage" },
});

const reply = (status, body) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const open = (p = payload(), expiresAt = "2026-12-01T00:00:00.000Z") => render(<EstimateApproval token="PUB123.secretsecretsecretsecretsecretsecretsecretsecr" payload={p} expiresAt={expiresAt} />);

afterEach(() => vi.unstubAllGlobals());

describe("what the customer sees before deciding", () => {
  it("shows the car, what was told to us, what was found with its photo, and every line checked to start", () => {
    open();
    expect(screen.getByText(/Dubai · A · 12345/)).toBeInTheDocument();
    expect(screen.getByText(/"Noise when braking" - Front pads worn/)).toBeInTheDocument();
    expect(screen.getByText("Front brake pads", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Needs doing now")).toBeInTheDocument();
    expect(document.querySelector("img[src*='/share/PUB123.secretsecretsecretsecretsecretsecretsecretsecr/photo/a1b2c3']")).not.toBeNull();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((c) => c.getAttribute("aria-checked") === "true")).toBe(true);
    expect(screen.getByRole("button", { name: /Approve 2 of 2/ })).toBeInTheDocument();
  });

  it("with everything checked the selected total matches the fixed header total; unchecking a line moves only the selected figure", () => {
    open();
    // Both lines checked (441 + 210): the running "selected" total and the fixed header total agree.
    expect(screen.getAllByText("AED 651.00").length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getAllByRole("checkbox")[1]); // uncheck line2 (210)
    expect(screen.getByRole("button", { name: /Approve 1 of 2/ })).toBeInTheDocument();
    const selectedRow = screen.getByText("Selected total (incl. VAT)").closest("div");
    expect(within(selectedRow).getByText("AED 441.00")).toBeInTheDocument(); // matches line1 alone now
    expect(screen.getByText("AED 651.00")).toBeInTheDocument(); // the header is a fixed reference, untouched
  });

  it("unchecking every line disables Approve and explains why, without asking the server anything", async () => {
    const fetchMock = reply(200, { success: true, data: { outcome: "approved" } });
    vi.stubGlobal("fetch", fetchMock);
    open();
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    const approve = screen.getByRole("button", { name: "Approve" });
    expect(approve).toBeDisabled();
    expect(screen.getByText(/Check at least one item to approve, or use Decline/)).toBeInTheDocument();
    fireEvent.click(approve);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("approving", () => {
  it("needs a name before it sends anything", async () => {
    const fetchMock = reply(200, { success: true, data: { outcome: "approved" } });
    vi.stubGlobal("fetch", fetchMock);
    open();
    fireEvent.click(screen.getByRole("button", { name: /Approve 2 of 2/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please enter your name first");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends exactly the checked lines, the typed name, and no price of any kind", async () => {
    const fetchMock = reply(200, { success: true, data: { outcome: "approved", status: "IN_PROGRESS", jobNo: "JC-2026-0001" } });
    vi.stubGlobal("fetch", fetchMock);
    open();
    fireEvent.click(screen.getAllByRole("checkbox")[1]); // uncheck line2
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ali Hassan" } });
    fireEvent.click(screen.getByRole("button", { name: /Approve 1 of 2/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/share\/PUB123\.secretsecretsecretsecretsecretsecretsecretsecr\/estimate-decision$/);
    expect(init.credentials).toBe("omit");
    const body = JSON.parse(init.body);
    expect(body).toEqual({ outcome: "approved", name: "Ali Hassan", lineIds: ["line1"] });
    expect(JSON.stringify(body)).not.toMatch(/price|lineTotal|vat|total/i);

    expect(await screen.findByText(/the workshop has been told/)).toBeInTheDocument();
    expect(screen.getByText(/Work on job JC-2026-0001 can now go ahead/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("a server refusal (a line no longer on the estimate) is shown in its own words, and the form stays on screen", async () => {
    vi.stubGlobal("fetch", reply(400, { success: false, errorCode: "LINE_NOT_ON_ESTIMATE", message: "That is not an item on this estimate." }));
    open();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ali" } });
    fireEvent.click(screen.getByRole("button", { name: /Approve 2 of 2/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That is not an item on this estimate.");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("the server's own 'no longer waiting' message is shown plainly when the card has moved on since", async () => {
    vi.stubGlobal("fetch", reply(409, { success: false, errorCode: "JOB_NOT_AWAITING_APPROVAL", message: "This job is in_progress, not waiting for a decision" }));
    open();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ali" } });
    fireEvent.click(screen.getByRole("button", { name: /Approve 2 of 2/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This job is in_progress, not waiting for a decision");
  });
});

describe("declining", () => {
  it("needs no line selection at all - it is a whole-estimate answer", async () => {
    const fetchMock = reply(200, { success: true, data: { outcome: "declined", jobNo: "JC-2026-0001" } });
    vi.stubGlobal("fetch", fetchMock);
    open();
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]); // nothing checked - Approve would be disabled, Decline must not care
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Mona K" } });
    fireEvent.change(screen.getByLabelText(/note back to the workshop/i), { target: { value: "Too expensive" } });
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ outcome: "declined", name: "Mona K", note: "Too expensive" });
    expect("lineIds" in body).toBe(false);
    expect(await screen.findByText(/Your answer has been sent/)).toBeInTheDocument();
    expect(screen.getByText(/The workshop will be in touch to discuss the estimate/)).toBeInTheDocument();
  });
});

describe("when the link itself has run out", () => {
  it("a network failure mid-decision says so, in words a person reads, not a bare OFFLINE code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    open();
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Ali" } });
    fireEvent.click(screen.getByRole("button", { name: /Approve 2 of 2/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Check your connection and try again.");
    expect(alert.textContent).not.toMatch(/OFFLINE/);
  });
});
