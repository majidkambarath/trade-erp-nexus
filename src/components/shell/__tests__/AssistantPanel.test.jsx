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
const saveProposal = vi.fn();
const conversations = vi.fn().mockResolvedValue([]);
const conversation = vi.fn().mockResolvedValue([]);
const forgetConversation = vi.fn().mockResolvedValue({ deleted: true });
const proposalSaved = vi.fn().mockResolvedValue({});
vi.mock("../../../lib/assistantApi", () => ({
  assistant: {
    ask: (...a) => ask(...a),
    helpful: (...a) => helpful(...a),
    escalate: (...a) => escalate(...a),
    screen: (...a) => screenTip(...a),
    saveProposal: (...a) => saveProposal(...a),
    conversations: (...a) => conversations(...a),
    conversation: (...a) => conversation(...a),
    forgetConversation: (...a) => forgetConversation(...a),
    proposalSaved: (...a) => proposalSaved(...a),
  },
}));

import { clearPageSessions } from "../../../lib/pageSession";
import { clearRefusal, noteRefusal } from "../../../lib/lastRefusal";
import AssistantPanel from "../AssistantPanel";
import { GuideContext } from "../../../guides/guideContext";
import { FLOWS } from "../../../guides/index";

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
    // wait for the screen to answer before judging what is offered: nothing is offered until it has
    await screen.findByText(/I have nothing written about/);
    expect(screen.getByText("I do know about")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How do I raise an invoice?" })).toBeInTheDocument();
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

  it("with nothing switched on for this person, it says what it can do and promises nothing more", async () => {
    draw();
    expect(await screen.findByText(/Ask me how to do something in Zarvia/)).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/)).toBeNull();
    expect(screen.queryByRole("button", { name: "List unpaid vendors" })).toBeNull();
  });
});

describe("earlier chats", () => {
  const list = [
    { id: "c1", title: "list unpaid vendors", questions: 2, lastAskedAt: "2026-11-14T10:00:00Z" },
    { id: "c2", title: "how do I raise an invoice", questions: 1, lastAskedAt: "2026-11-13T10:00:00Z" },
  ];

  it("lists them, and opening one brings back its messages and tables to carry on", async () => {
    conversations.mockResolvedValue(list);
    conversation.mockResolvedValue([{ _id: "m1", question: "list unpaid vendors", answer: "2 vendors are unpaid.", citations: [], links: [], tables: [{ title: "Unpaid vendors", rows: [{ label: "Gulf", value: "AED 1.00" }] }], outcome: "answered" }]);
    draw();
    fireEvent.click(await screen.findByRole("button", { name: "Earlier chats" }));
    expect(await screen.findByText("2 questions", { exact: false })).toBeInTheDocument();
    fireEvent.click(screen.getByText("how do I raise an invoice").closest("button"));
    expect(await screen.findByText("2 vendors are unpaid.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Unpaid vendors" })).toBeInTheDocument();
    expect(conversation).toHaveBeenCalledWith("c2");
    ask.mockResolvedValue({ messageId: "m2", conversationId: "c2", answer: "More.", citations: [], links: [], outcome: "answered" });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "and now?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await waitFor(() => expect(ask).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "c2" })));
  });

  it("deletes one from the list, and says so when there are none", async () => {
    conversations.mockResolvedValue([list[0]]);
    draw();
    fireEvent.click(await screen.findByRole("button", { name: "Earlier chats" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete chat: list unpaid vendors" }));
    await waitFor(() => expect(forgetConversation).toHaveBeenCalledWith("c1"));
    expect(await screen.findByText(/No earlier chats yet/)).toBeInTheDocument();
  });

  it("the empty state offers the most recent ones", async () => {
    conversations.mockResolvedValue(list);
    draw();
    expect(await screen.findByText("Recent chats")).toBeInTheDocument();
  });
});

describe("looking things up in the books", () => {
  const table = {
    title: "Unpaid vendors",
    rows: [
      { label: "Gulf Packaging", sub: "2 bills · AED 315.00 overdue, oldest 10 days", value: "AED 945.00", tone: "danger" },
      { label: "Al Noor Steel", sub: "1 bill · not yet due", value: "AED 110.25", tone: "" },
    ],
    total: { label: "Total", value: "AED 1,055.25" },
    more: 0,
    link: { path: "/ageing?type=payable", label: "Open payables ageing" },
  };

  it("offers the lookups this person may ask for, and only those", async () => {
    screenTip.mockResolvedValue({ topics: [{ title: "Order to cash" }], lookups: ["unpaid_bills", "stock_levels"] });
    draw();
    expect(await screen.findByRole("button", { name: "List unpaid vendors" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What is running low?" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "How much is in the bank?" })).toBeNull();
    expect(screen.getByText(/I can look things up in your books/)).toBeInTheDocument();
  });

  it("draws the server's table under the answer, and its button opens the full report and closes the panel", async () => {
    const onClose = vi.fn();
    ask.mockResolvedValue({ messageId: "m9", conversationId: "c1", answer: "2 vendors are unpaid: AED 1,055.25 on 3 bills.", citations: [], links: [], tables: [table], outcome: "answered" });
    draw(onClose);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "list unpaid vendors" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const section = await screen.findByRole("region", { name: "Unpaid vendors" });
    expect(section).toHaveTextContent("Gulf Packaging");
    expect(section).toHaveTextContent("AED 945.00");
    expect(section).toHaveTextContent("AED 1,055.25");
    expect(screen.getByText("AED 945.00")).toHaveClass("text-destructive");
    fireEvent.click(screen.getByRole("button", { name: "Open payables ageing" }));
    expect(navigate).toHaveBeenCalledWith("/ageing?type=payable");
    expect(onClose).toHaveBeenCalled();
  });

  it("a statement's headline tiles are drawn above its lines, a loss in red with the word loss", async () => {
    const pl = { title: "Profit and loss, 1 Nov 2026 to 16 Nov 2026", stats: [{ label: "Net loss", value: "AED 80.00", tone: "danger" }, { label: "Revenue", value: "AED 1,000.00" }], rows: [{ label: "Revenue", value: "AED 1,000.00" }], link: { path: "/financial-statements", label: "Open financial statements" } };
    ask.mockResolvedValue({ messageId: "m11", answer: "For this month you have a loss.", citations: [], links: [], tables: [pl], outcome: "answered" });
    draw();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "profit this month" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    const region = await screen.findByRole("region", { name: pl.title });
    expect(region).toHaveTextContent("Net loss");
    expect(screen.getByText("AED 80.00")).toHaveClass("text-destructive");
    fireEvent.click(screen.getByRole("button", { name: "Open financial statements" }));
    expect(navigate).toHaveBeenCalledWith("/financial-statements");
  });

  it("offers the position questions first, from the lookups this person holds", async () => {
    screenTip.mockResolvedValue({ topics: [{ title: "Order to cash" }], lookups: ["profit_and_loss", "balance_sheet", "stock_alerts", "business_snapshot"] });
    draw();
    for (const name of ["How are we doing?", "Profit this month", "Balance sheet", "Stock alerts"]) {
      expect(await screen.findByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("a table pointing somewhere the app does not know gets no button", async () => {
    ask.mockResolvedValue({ messageId: "m10", answer: "x", citations: [], links: [], tables: [{ ...table, link: { path: "https://evil.example/x", label: "Go" } }], outcome: "answered" });
    draw();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "list unpaid vendors" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await screen.findByRole("region", { name: "Unpaid vendors" });
    expect(screen.queryByRole("button", { name: "Go" })).toBeNull();
  });
});

describe("the panel itself", () => {
  it("is a dialog you can close with Escape, docked rather than covering the page", async () => {
    const onClose = vi.fn();
    draw(onClose);
    const panel = screen.getByRole("dialog", { name: "Zarvia AI" });
    // fixed, never absolute: an absolutely positioned element deep in a long page takes the window
    // as its containing block and makes the document itself scroll, which the sweep calls DOCSCR.
    expect(panel.className).toMatch(/\bfixed\b/);
    expect(panel.className).not.toMatch(/\babsolute\b/);
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("says which screen it is looking at, so the answers have a context you can see", async () => {
    draw();
    expect(await screen.findByText("Looking at Invoices")).toBeInTheDocument();
  });

  describe("preparing documents", () => {
    const proposal = {
      id: "p1", kind: "payment", endpoint: "voucher", title: "Payment", confirm: "Pay AED 500.00 to Gulf Packaging",
      lines: [["Pay", "Gulf Packaging"], ["Amount", "AED 500.00"]],
      body: { voucherType: "payment", vendorId: "v1", totalAmount: 500, paymentMode: "cash", paymentDetails: {} },
      missing: [], warnings: [], prefill: { partyId: "v1", amount: 500, mode: "cash", accountId: "", reference: "" },
    };
    const prepared = () =>
      ask.mockResolvedValue({ messageId: "m7", conversationId: "c1", answer: "I have prepared it below. Please check and confirm.", citations: [], links: [], proposals: [proposal], outcome: "answered" });
    const send = async () => {
      draw();
      fireEvent.change(await screen.findByRole("textbox"), { target: { value: "pay Gulf Packaging 500 cash" } });
      fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    };

    it("draws a card under the answer, and nothing is saved until its button is pressed", async () => {
      prepared();
      await send();
      expect(await screen.findByRole("button", { name: "Pay AED 500.00 to Gulf Packaging" })).toBeInTheDocument();
      expect(saveProposal).not.toHaveBeenCalled();
    });

    it("confirming saves through the person's own route and remembers it on the answer", async () => {
      prepared();
      saveProposal.mockResolvedValue({ data: { voucherNo: "PV-2026-0003", status: "approved" } });
      await send();
      fireEvent.click(await screen.findByRole("button", { name: "Pay AED 500.00 to Gulf Packaging" }));
      expect(await screen.findByText(/Payment PV-2026-0003 is recorded/)).toBeInTheDocument();
      expect(proposalSaved).toHaveBeenCalledWith("m7", "p1", "PV-2026-0003");
    });

    it("Change details opens the normal payment screen already filled in, and closes the panel", async () => {
      prepared();
      const onClose = vi.fn();
      draw(onClose);
      fireEvent.change(await screen.findByRole("textbox"), { target: { value: "pay Gulf Packaging 500 cash" } });
      fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
      fireEvent.click(await screen.findByRole("button", { name: /Change details/ }));
      expect(navigate).toHaveBeenCalledWith("/payment-voucher", { state: { assistantPrefill: expect.objectContaining({ kind: "payment", partyId: "v1", amount: 500 }) } });
      expect(onClose).toHaveBeenCalled();
    });

    it("offers examples only where the server says this person can prepare documents", async () => {
      screenTip.mockResolvedValue({ topics: [{ title: "Order to cash" }], actions: true });
      draw();
      expect(await screen.findByText(/pay Al Noor 5,000 by bank transfer/)).toBeInTheDocument();
    });

    it("without it, no prepare example is offered", async () => {
      draw();
      expect(await screen.findByText(/Ask me how to do something/)).toBeInTheDocument();
      expect(screen.queryByText(/pay Al Noor/)).toBeNull();
    });
  });

  describe("Guide me under an answer", () => {
    const withGuides = (start, flows = FLOWS, onClose = vi.fn()) => {
      render(
        <MemoryRouter initialEntries={["/sales-order"]}>
          <GuideContext.Provider value={{ flows, start, table: null }}>
            <AssistantPanel onClose={onClose} />
          </GuideContext.Provider>
        </MemoryRouter>
      );
      return onClose;
    };
    const askIt = async (question) => {
      fireEvent.change(await screen.findByRole("textbox"), { target: { value: question } });
      fireEvent.click(screen.getByRole("button", { name: /Ask/ }));
    };

    it("offers the walkthrough the question names, even when the answer could not help, and starts it", async () => {
      ask.mockResolvedValue({ messageId: "m9", conversationId: "c1", answer: "I do not have anything reliable to tell you about that.", citations: [], links: [], outcome: "no_answer", canEscalate: true });
      const start = vi.fn();
      const onClose = withGuides(start);
      await askIt("i need to purcahse");
      const button = await screen.findByRole("button", { name: "Guide me: Create a purchase order" });
      fireEvent.click(button);
      expect(start).toHaveBeenCalledWith("create-purchase-order");
      expect(onClose).toHaveBeenCalled();
    });

    it("offers nothing when no guide fits, or the person may run none", async () => {
      ask.mockResolvedValue({ messageId: "m10", conversationId: "c1", answer: "Here is how.", citations: [], links: [], outcome: "answered" });
      withGuides(vi.fn(), []);
      await askIt("i need to purchase");
      await screen.findByText("Here is how.");
      expect(screen.queryByRole("button", { name: /^Guide me:/ })).toBeNull();
    });
  });
});
