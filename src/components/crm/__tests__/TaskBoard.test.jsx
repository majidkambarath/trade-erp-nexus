// The follow-up board. jsdom has no layout, so a real pointer drag cannot be simulated here (dnd-kit needs measured
// rectangles). Both ways of moving a card - dragging it and the "Move to" menu on it - end in the SAME function, so
// these tests drive that through the menu and assert on what the server is asked and what the person is told.
import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { formatDate } from "../../../utils/format";

const m = vi.hoisted(() => ({ updateActivity: vi.fn() }));
vi.mock("../../../lib/crmApi", () => ({ crm: { updateActivity: m.updateActivity }, CRM_WORK_CHANGED: "crm-work-changed", announceCrmWorkChanged: () => {} }));

const TaskBoard = (await import("../TaskBoard.jsx")).default;

const TODAY = "2026-10-20";
const task = (over = {}) => ({
  _id: "t1", kind: "call", subject: "Ring about the rice", dueAt: "2026-10-20", dueState: "today", ownerId: "u1", ownerName: "Asif", status: "OPEN", ...over,
});
const OWNERS = [{ id: "u1", name: "Asif" }, { id: "u2", name: "Maya" }];
const rows = () => [
  task(),
  task({ _id: "t2", subject: "Chase the contract", dueAt: "2026-10-15", dueState: "overdue" }),
  task({ _id: "t3", subject: "Works visit", dueAt: "2026-10-24", dueState: "soon", ownerId: "u2", ownerName: "Maya" }),
  task({ _id: "t4", subject: "Annual review", dueAt: "2026-12-01", dueState: "later", ownerId: null, ownerName: "" }),
];

const show = (props = {}) => {
  const notify = vi.fn();
  const onChanged = vi.fn(() => Promise.resolve());
  const view = render(<TaskBoard rows={rows()} today={TODAY} owners={OWNERS} canEdit notify={notify} onChanged={onChanged} onDone={() => {}} {...props} />);
  return { notify, onChanged, ...view };
};
const column = (name) => screen.getByRole("region", { name });
const moveTo = (card, label) => fireEvent.change(within(card).getByRole("combobox"), { target: { value: label } });

beforeEach(() => {
  m.updateActivity.mockReset();
  m.updateActivity.mockResolvedValue({});
});

describe("the board, by day", () => {
  it("puts every follow-up in the column its day belongs to, and counts them", () => {
    show();
    expect(within(column("Late")).getByText("Chase the contract")).toBeInTheDocument();
    expect(within(column("Today")).getByText("Ring about the rice")).toBeInTheDocument();
    expect(within(column("Within a week")).getByText("Works visit")).toBeInTheDocument();
    expect(within(column("Later")).getByText("Annual review")).toBeInTheDocument();
    expect(within(column("Tomorrow")).getByText("Drop one here")).toBeInTheDocument();
  });

  it("prints the day a drop will set in each column, and Late takes no drops", () => {
    show();
    // Built from formatDate itself: how a date is SHOWN is each person's own setting (Settings - Preferences).
    expect(within(column("Today")).getByText(`Dropped here: ${formatDate("2026-10-20")}`)).toBeInTheDocument();
    expect(within(column("Within a week")).getByText(`Dropped here: ${formatDate("2026-10-27")}`)).toBeInTheDocument();
    expect(within(column("Late")).getByText("Move these on")).toBeInTheDocument();
    // A late card's menu cannot send it into being late.
    const options = within(within(column("Late")).getByText("Chase the contract").closest("li")).getAllByRole("option").map((o) => o.textContent);
    expect(options).not.toContain("Late");
    expect(options).toEqual(["Today", "Tomorrow", "Within a week", "Later"]);
  });

  it("moving a card asks the server for exactly the named day, and says so", async () => {
    const { notify, onChanged } = show();
    moveTo(within(column("Late")).getByText("Chase the contract").closest("li"), "tomorrow");
    await waitFor(() => expect(m.updateActivity).toHaveBeenCalledWith("t2", { dueAt: "2026-10-21" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith(`Chase the contract is now due ${formatDate("2026-10-21")}`));
    expect(onChanged).toHaveBeenCalled();
  });

  it("moves the card at once, before the server has answered, and puts it back if the server refuses", async () => {
    let refuse;
    m.updateActivity.mockImplementation(() => new Promise((_, reject) => { refuse = reject; }));
    const { notify } = show();
    moveTo(within(column("Today")).getByText("Ring about the rice").closest("li"), "later");
    // Optimistic: it is already in Later while the call is still in flight.
    await waitFor(() => expect(within(column("Later")).getByText("Ring about the rice")).toBeInTheDocument());
    refuse(new Error("A follow-up that is done cannot be changed"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("A follow-up that is done cannot be changed", "error"));
    // ...and back where it was: nothing was lost to a failed save.
    await waitFor(() => expect(within(column("Today")).getByText("Ring about the rice")).toBeInTheDocument());
  });

  it("choosing the column a card is already in asks the server for nothing", () => {
    show();
    moveTo(within(column("Today")).getByText("Ring about the rice").closest("li"), "today");
    expect(m.updateActivity).not.toHaveBeenCalled();
  });
});

describe("the board, by person", () => {
  it("has a column for each person and a read-only one for nobody", () => {
    show();
    fireEvent.click(screen.getByRole("tab", { name: "By person" }));
    expect(within(column("Asif")).getByText("Ring about the rice")).toBeInTheDocument();
    expect(within(column("Maya")).getByText("Works visit")).toBeInTheDocument();
    expect(within(column("Nobody")).getByText("Annual review")).toBeInTheDocument();
    // Nobody can be READ but never dropped on: the server cannot un-assign.
    expect(within(column("Nobody")).getByText("Not given to anyone")).toBeInTheDocument();
  });

  it("giving a card to somebody asks the server to change its owner, and nobody is not an option", async () => {
    const { notify } = show();
    fireEvent.click(screen.getByRole("tab", { name: "By person" }));
    const card = within(column("Nobody")).getByText("Annual review").closest("li");
    expect(within(card).getAllByRole("option").map((o) => o.textContent)).toEqual(["Asif", "Maya"]);
    moveTo(card, "u2");
    await waitFor(() => expect(m.updateActivity).toHaveBeenCalledWith("t4", { ownerId: "u2" }));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Annual review is now Maya's"));
  });
});

describe("somebody who may only look", () => {
  it("sees the board and no way to change it", () => {
    show({ canEdit: false });
    expect(screen.getByText(/changing it needs permission to edit/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Drag / })).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    expect(within(column("Today")).getByText("Ring about the rice")).toBeInTheDocument();
  });
});

describe("a card that can be dragged", () => {
  it("has a handle of its own, so the buttons on it and a scrolling finger still work", () => {
    show();
    const card = within(column("Today")).getByText("Ring about the rice").closest("li");
    expect(within(card).getByRole("button", { name: "Drag Ring about the rice" })).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
