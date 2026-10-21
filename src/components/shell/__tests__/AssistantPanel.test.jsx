import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => navigate, useLocation: () => ({ pathname: "/sales-order" }) };
});

const ask = vi.fn();
const helpful = vi.fn().mockResolvedValue({});
const escalate = vi.fn().mockResolvedValue({ supportRequestId: "s1" });
const screenTip = vi.fn().mockResolvedValue({ topics: [{ title: "Order to cash" }] });
vi.mock("../../../lib/assistantApi", () => ({
  assistant: {
    ask: (...a) => ask(...a),
    helpful: (...a) => helpful(...a),
    escalate: (...a) => escalate(...a),
    screen: (...a) => screenTip(...a),
  },
}));

import AssistantPanel from "../AssistantPanel";

const draw = (onClose = vi.fn()) =>
  render(
    <MemoryRouter initialEntries={["/sales-order"]}>
      <AssistantPanel onClose={onClose} />
    </MemoryRouter>
  );

beforeAll(() => {
  globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
});

beforeEach(() => {
  vi.clearAllMocks();
  screenTip.mockResolvedValue({ topics: [{ title: "Order to cash" }] });
});

describe("Zarvia AI panel", () => {
  it("opens knowing what the screen is about", async () => {
    draw();
    expect(await screen.findByText("I can tell you about Order to cash.")).toBeInTheDocument();
    expect(screenTip).toHaveBeenCalledWith("/sales-order");
    expect(screen.getByRole("button", { name: "How do I raise an invoice?" })).toBeInTheDocument();
  });

  it("asks, then shows the answer with where it came from", async () => {
    ask.mockResolvedValue({
      messageId: "m1",
      conversationId: "c1",
      answer: "Save the draft, then press Approve.",
      citations: [{ title: "Order to cash" }],
      links: [],
      outcome: "answered",
    });
    draw();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "how do I approve an invoice" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    expect(await screen.findByText("Save the draft, then press Approve.")).toBeInTheDocument();
    expect(screen.getByText("From: Order to cash")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ question: "how do I approve an invoice", screen: "/sales-order" }));
  });

  it("draws a button for a real screen and refuses one that does not exist", async () => {
    ask.mockResolvedValue({
      messageId: "m2",
      answer: "Open the setup screen.",
      citations: [],
      links: [
        { path: "/accounting-setup", label: "Open setup" },
        { path: "/claim-your-refund", label: "Click here" },
      ],
    });
    const onClose = vi.fn();
    draw(onClose);
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "where is the fiscal year" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    const button = await screen.findByRole("button", { name: /Open setup/ });
    // the invented one is never rendered, whatever the server called it
    expect(screen.queryByRole("button", { name: /Click here/ })).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(navigate).toHaveBeenCalledWith("/accounting-setup");
    expect(onClose).toHaveBeenCalled();
  });

  it("records a thumbs-down, which is the list of articles to write next", async () => {
    ask.mockResolvedValue({ messageId: "m3", answer: "Something.", citations: [], links: [] });
    draw();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "anything" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    await screen.findByText("Something.");
    fireEvent.click(screen.getByRole("button", { name: "This did not help" }));
    expect(helpful).toHaveBeenCalledWith("m3", false);
  });

  it("offers the team when it could not answer, and says so once it has passed it on", async () => {
    ask.mockResolvedValue({
      messageId: "m4",
      answer: "I do not have anything reliable to tell you about that.",
      citations: [],
      links: [],
      outcome: "no_answer",
      canEscalate: true,
    });
    draw();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "how do I do job work" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Ask the Zarvia team/ }));
    await waitFor(() => expect(screen.getByText("Passed to the Zarvia team.")).toBeInTheDocument());
    expect(escalate).toHaveBeenCalledWith(expect.objectContaining({ messageId: "m4", question: "how do I do job work" }));
  });

  it("keeps the question when it could not be sent, so nobody has to type it again", async () => {
    ask.mockRejectedValue(new Error("Network is down"));
    draw();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "how do I raise an invoice" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    expect(await screen.findByText("Network is down")).toBeInTheDocument();
    expect(screen.getByLabelText("Your question")).toHaveValue("how do I raise an invoice");
  });
});

describe("test mode", () => {
  it("says plainly when the answers are canned, because one that reads as real is worse than none", async () => {
    ask.mockResolvedValue({ messageId: "m5", answer: "A canned example.", citations: [], links: [], testMode: true });
    draw();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "anything" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    expect(await screen.findByText(/Test mode: these answers are canned examples/)).toBeInTheDocument();
  });

  it("says nothing of the sort once the real service is answering", async () => {
    ask.mockResolvedValue({ messageId: "m6", answer: "A real answer.", citations: [], links: [], testMode: false });
    draw();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "anything" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    await screen.findByText("A real answer.");
    expect(screen.queryByText(/Test mode/)).not.toBeInTheDocument();
  });
});
