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

import { clearPageSessions } from "../../../lib/pageSession";
import { clearRefusal, noteRefusal } from "../../../lib/lastRefusal";
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
  // The panel keeps its conversation while it is shut, which is the point - so each test starts
  // from an empty one, exactly as signing out leaves it.
  clearPageSessions();
  clearRefusal();
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

describe("the chat itself", () => {
  const stepsAnswer = {
    messageId: "m7",
    answer: "To raise an invoice:\n1. Open Sales, then Orders.\n2. Add the lines.\n3. Press Approve.",
    citations: [],
    links: [],
  };

  it("draws numbered steps as steps, because that is how the guide is written", async () => {
    ask.mockResolvedValue(stepsAnswer);
    draw();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "how do I raise an invoice" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    const list = await screen.findByRole("list");
    expect(list.tagName).toBe("OL");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Press Approve.")).toBeInTheDocument();
  });

  it("keeps the conversation when the panel is closed and opened again", async () => {
    ask.mockResolvedValue(stepsAnswer);
    const { unmount } = draw();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "how do I raise an invoice" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    await screen.findByRole("list");
    unmount();
    draw();
    // it is there without asking again
    expect(await screen.findByText("Press Approve.")).toBeInTheDocument();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("starts again on request, and the button is not there until there is something to clear", async () => {
    ask.mockResolvedValue(stepsAnswer);
    draw();
    expect(screen.queryByRole("button", { name: /Start again/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "anything" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    await screen.findByRole("list");
    fireEvent.click(screen.getByRole("button", { name: /Start again/ }));
    await waitFor(() => expect(screen.queryByText("Press Approve.")).not.toBeInTheDocument());
    // the empty state is back, suggestions and all, rather than an answer merely hidden
    expect(screen.getByRole("button", { name: "How do I raise an invoice?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start again/ })).not.toBeInTheDocument();
  });

  it("copies an answer as plain text, without the markup", async () => {
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    ask.mockResolvedValue({ messageId: "m8", answer: "Open **Sales**, then Orders.", citations: [], links: [] });
    draw();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "where" } });
    fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy this answer" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Open Sales, then Orders."));
  });
});

describe("what it offers before anybody has asked", () => {
  it("offers the screen's own questions when the documentation has them", async () => {
    screenTip.mockResolvedValue({
      topics: [{ title: "Order to cash" }],
      suggestions: ["How do I sell something?", "How is cost of goods booked?"],
    });
    draw();
    expect(await screen.findByRole("button", { name: "How do I sell something?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How is cost of goods booked?" })).toBeInTheDocument();
    // the general ones step aside when the screen has its own
    expect(screen.queryByRole("button", { name: "How do I record a payment?" })).not.toBeInTheDocument();
  });

  it("falls back to the general questions when a screen has none of its own", async () => {
    screenTip.mockResolvedValue({ topics: [], suggestions: [] });
    draw();
    expect(await screen.findByRole("button", { name: "How do I raise an invoice?" })).toBeInTheDocument();
  });

  it("puts the refusal they just hit first, because that is why most people open it", async () => {
    noteRefusal({ response: { data: { errorCode: "PERIOD_CLOSED", message: "Posting is closed up to 31 Aug 2026" } } });
    screenTip.mockResolvedValue({ topics: [], suggestions: ["How do I sell something?"] });
    draw();
    // wait for the screen's own question to arrive before judging the order: the chips render once
    // on mount with the general ones, and again when the documentation answers.
    await screen.findByRole("button", { name: "How do I sell something?" });
    const chips = screen.getAllByRole("button", { name: /^(Why did it say|How do I)/ });
    expect(chips[0]).toHaveAccessibleName("Why did it say: Posting is closed up to 31 Aug 2026");
    expect(chips[1]).toHaveAccessibleName("How do I sell something?");
  });

  it("says plainly that asking about their own figures is not built yet", async () => {
    draw();
    expect(await screen.findByText(/Asking about your own figures/)).toBeInTheDocument();
    expect(screen.getByText("coming soon")).toBeInTheDocument();
  });
});
