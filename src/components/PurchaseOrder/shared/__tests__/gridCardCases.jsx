import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AsRole, roleLoaded, statusFor } from "../../../shell/__tests__/asRole";
import { NO_OP, row } from "./deleteCases";

// Test support (not a test): what a document CARD has to survive on a phone, shared by the four order modules.
//
// A card is `overflow-hidden`, so whatever does not fit is not scrolled to, it is simply gone: a row of buttons wider than the
// card lost its last ones (Send, Audit trail, Edit, Confirm, Delete all sat up to 337px outside it at 390px wide), and the document
// number broke at its hyphen. jsdom has no layout, so these pin the causes: the rows wrap, the number stays on one line, and a
// line that was saved without a description still names its item. (The sweep, `npm run check:mobile`, measures the real thing:
// its "cut off" check fails on any control outside the box that clips it.)
//
// @param module     "sales" | "purchase"
// @param names      the list props of this module's views: { rows, selected, setSelected, del }
// @param setStatus  points the file's mocked organisation status at this person's grants
export function gridCardCases({ module, names, View: view, setStatus }) {
  const View = view; // a capitalised local, so the linter sees it used in the JSX below
  const grants = [`${module}.view`, `${module}.delete`, `${module}.edit`, `${module}.approve`, `${module}.send`];
  const show = async (rows) => {
    setStatus(statusFor(grants));
    const props = {
      [names.rows]: rows, [names.selected]: [], [names.setSelected]: NO_OP, [names.del]: vi.fn(),
      getPriorityColor: () => "bg-muted", getStatusColor: () => "", getStatusIcon: () => null, handleSort: NO_OP, sortBy: "date", sortOrder: "desc",
      setSelectedSO: NO_OP, setSelectedPO: NO_OP, setActiveView: NO_OP,
      editSO: NO_OP, editPO: NO_OP, confirmSO: NO_OP, approvePO: NO_OP, rejectPO: NO_OP, deleteSO: NO_OP, deletePO: NO_OP,
      onDownloadInternal: NO_OP, onDownloadCustomer: NO_OP, onShowAudit: NO_OP, onSendDocument: NO_OP,
    };
    render(<AsRole><View {...props} /></AsRole>);
    await roleLoaded();
    for (const r of rows) expect((await screen.findAllByText(r.transactionNo)).length).toBeGreaterThan(0);
  };
  const card = (number) => screen.getByText(number).closest(".overflow-hidden");

  describe(`a ${module} document card on a narrow screen`, () => {
    it("keeps every action reachable: the rows of buttons wrap instead of running out of the card", async () => {
      await show([row("one", "DRAFT")]);
      const c = card("DOC-one");
      const audit = within(c).getByRole("button", { name: /audit trail/i });
      const del = within(c).getByRole("button", { name: /^delete$/i });
      const view = within(c).getByRole("button", { name: /^view$/i });
      // each button sits in a group that wraps, and the groups sit in a row that wraps
      for (const b of [audit, del, view]) {
        expect(b.parentElement, b.textContent).toHaveClass("flex-wrap");
        expect(b.parentElement.parentElement, `row of ${b.textContent}`).toHaveClass("flex-wrap");
      }
    });

    it("keeps the document number on one line, and lets the header (number, status, sent-state) wrap around it", async () => {
      await show([row("two", "APPROVED")]);
      const c = card("DOC-two");
      const number = within(c).getByText("DOC-two");
      expect(number).toHaveClass("whitespace-nowrap");
      expect(number.closest(".flex-wrap"), "a header row that wraps").not.toBeNull();
      expect(within(c).getByText("APPROVED").closest(".flex-wrap"), "a status cluster that wraps").not.toBeNull();
    });

    it("keeps a line's quantity and price together, and lets the NAME give way (it truncates)", async () => {
      await show([row("three", "DRAFT", { items: [{ description: "A very long item name that cannot possibly fit beside its price on a phone", qty: 6, rate: 20 }] })]);
      const c = card("DOC-three");
      const price = within(c).getByText("6 × 20");
      expect(price).toHaveClass("whitespace-nowrap");
      expect(price).toHaveClass("shrink-0");
      expect(within(c).getByText(/A very long item name/)).toHaveClass("truncate");
    });

    it("names an item even when its line was saved without a description", async () => {
      await show([
        row("four", "DRAFT", { items: [{ description: "", itemName: "Basmati rice 5kg", qty: 1, rate: 20 }] }),
        row("five", "DRAFT", { items: [{ description: "", stockDetails: { itemName: "Sunflower oil 1.8L" }, qty: 1, rate: 11 }] }),
        row("six", "DRAFT", { items: [{ description: "", qty: 1, rate: 5 }] }),
      ]);
      expect(within(card("DOC-four")).getByText("Basmati rice 5kg")).toBeInTheDocument();
      expect(within(card("DOC-five")).getByText("Sunflower oil 1.8L")).toBeInTheDocument();
      expect(within(card("DOC-six")).getByText("Item"), "never a blank").toBeInTheDocument();
    });

    it("prefers the description the person wrote", async () => {
      await show([row("seven", "DRAFT", { items: [{ description: "Rice, the good one", itemName: "Rice 5kg", qty: 1, rate: 20 }] })]);
      const c = card("DOC-seven");
      expect(within(c).getByText("Rice, the good one")).toBeInTheDocument();
      expect(within(c).queryByText("Rice 5kg")).toBeNull();
    });
  });
}
