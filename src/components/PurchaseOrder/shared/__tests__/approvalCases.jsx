import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { AsRole, roleLoaded, statusFor } from "../../../shell/__tests__/asRole";
import { FIRST_APPROVAL_MESSAGE } from "../../../../lib/approvals";
import { todayInput } from "../../../../utils/format";

// Test support (not a test): what an order module's list page does about APPROVING, shared by the four modules.
//
// The server is the lock (utils/approvalRules.js): it refuses an approver who prepared the document (when the organisation says
// so), who is over their role's limit, or who already gave the first of two approvals; and above the organisation's second-approver
// amount the first approval is only recorded. The screen's half, pinned here against a page with the real OrganisationProvider:
//
//   - the Confirm / Approve control is hidden (never disabled) on a row this person could not approve, and shown on the others
//   - a document that has had its first approval is badged "Awaiting second approval" (table and cards), and one that has not is not
//   - approving answers a first approval with an information message - never "approved" - and the list is read again
//   - a refusal shows the server's own sentence
//   - a bulk approve says how many were approved, how many wait for a second person, how many were refused and why
//
// Every absence is asserted AFTER the grants are known (`roleLoaded`) and the rows are on screen, with a control that IS there:
// while the grants are on their way nothing is hidden, so an earlier check would prove nothing.

const httpError = (status, data) => Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
const FIRST_OF_TWO = { data: { data: { transaction: { status: "DRAFT" }, approval: { awaitingSecond: true, given: 1 } } } };
const FINAL = { data: { data: { transaction: { status: "APPROVED" } } } };

/**
 * @param module     "sales" | "purchase"
 * @param open       the status of a document that can be approved: "DRAFT" (sales, returns) or "PENDING" (purchase)
 * @param Page       the module's list page
 * @param api        the mocked axios instance ({ get, post, put, delete, patch } as vi.fn)
 * @param setStatus  points the file's mocked organisation status at this person
 */
export function approvalCases(config) {
  const { module, open, api, setStatus } = config;
  const Page = config.Page; // a capitalised local, so the linter sees it used in the JSX below
  const GRANTS = [`${module}.view`, `${module}.approve`];

  // dated TODAY: the list opens on the current calendar month, so a fixed date would drop out of it when the month turns
  const raw = (id, over = {}) => ({
    _id: id, transactionNo: `DOC-${id}`, status: open, partyId: "p1", partyName: "Acme Corp", party: { customerName: "Acme Corp", vendorName: "Acme Corp" },
    date: `${todayInput()}T00:00:00.000Z`, deliveryDate: "2026-10-05T00:00:00.000Z", totalAmount: 100, createdBy: "u2", priority: "Medium", approvals: [],
    items: [{ itemId: "i1", itemCode: "ITM1", description: "Item One", qty: 2, rate: 200, vatAmount: 10, vatPercent: 5 }],
    ...over,
  });
  // who is signed in (u1), their role's approval limit, and the organisation's rules
  const person = ({ limit = null, separateApprover = false, secondApprovalAbove = null, grants = GRANTS } = {}) => {
    const base = statusFor(grants);
    return { ...base, me: { ...base.me, id: "u1", role: { ...base.me.role, approvalLimit: limit } }, policy: { approvals: { separateApprover, secondApprovalAbove } } };
  };

  let rows = [];
  const isList = (url) => String(url).includes("/transactions/transactions");
  const show = async (who, list, view = "table") => {
    rows = list;
    setStatus(who);
    api.get.mockImplementation(async (url) => ({ data: { data: isList(url) ? rows : [] } }));
    render(<MemoryRouter><AsRole><Page /></AsRole></MemoryRouter>);
    await roleLoaded();
    fireEvent.click(await screen.findByRole("button", { name: view === "table" ? "Table view" : "Card view" }));
    for (const r of list) expect((await screen.findAllByText(`DOC-${r._id}`)).length).toBeGreaterThan(0);
  };
  const where = (id, view) => {
    const el = screen.getAllByText(`DOC-${id}`)[0];
    return view === "cards" ? el.closest(".group") : el.closest("tr");
  };
  const confirmButton = (id, view) => within(where(id, view)).queryByRole("button", { name: /^(approve|confirm)$/i });
  const badge = (id, view) => within(where(id, view)).queryByText("Awaiting second approval");
  // the toolbar's Approve / Confirm, not a row's: a row's sits inside the table
  const bulkApprove = () => screen.queryAllByRole("button", { name: /^(approve|confirm)( selected)?$/i }).filter((b) => !b.closest("table"));
  const tick = (id) => fireEvent.click(within(where(id, "table")).getByRole("checkbox"));
  const processed = () => api.patch.mock.calls.map((c) => c[0]);

  beforeEach(() => {
    api.patch.mockReset();
    api.patch.mockResolvedValue(FINAL);
  });

  describe.each([["table", "table"], ["cards", "cards"]])(`Approve on a ${module} row, as %s`, (_name, view) => {
    it("is hidden on the person's own work when the organisation asks for a separate approver, and shown on someone else's", async () => {
      await show(person({ separateApprover: true }), [raw("mine", { createdBy: "u1" }), raw("theirs", { createdBy: "u2" })], view);
      expect(confirmButton("theirs", view)).toBeInTheDocument(); // the control is there on the other row ...
      expect(confirmButton("mine", view)).toBeNull(); // ... and not on their own
    });

    it("is offered on their own work when the organisation has not asked for a separate approver", async () => {
      await show(person(), [raw("mine", { createdBy: "u1" })], view);
      expect(confirmButton("mine", view)).toBeInTheDocument();
    });

    it("is hidden on a document over the person's approval limit, and shown on one at it", async () => {
      await show(person({ limit: 500 }), [raw("small", { totalAmount: 500 }), raw("big", { totalAmount: 500.01 })], view);
      expect(confirmButton("small", view)).toBeInTheDocument(); // exactly the limit: theirs
      expect(confirmButton("big", view)).toBeNull(); // a fils over it: not theirs
    });

    it("is hidden for the person who gave the first of two approvals, and shown to someone else", async () => {
      await show(person({ secondApprovalAbove: 500 }), [
        raw("mineFirst", { totalAmount: 900, approvals: [{ by: "u1", name: "Me", step: 1 }] }),
        raw("samFirst", { totalAmount: 900, approvals: [{ by: "u9", name: "Sam", step: 1 }] }),
      ], view);
      expect(confirmButton("samFirst", view)).toBeInTheDocument();
      expect(confirmButton("mineFirst", view)).toBeNull();
    });

    it("badges a document that has had its first approval and needs a second, and no other", async () => {
      await show(person({ secondApprovalAbove: 500 }), [
        raw("waiting", { totalAmount: 900, approvals: [{ by: "u9", name: "Sam", step: 1 }] }),
        raw("fresh", { totalAmount: 900 }),
        raw("small", { totalAmount: 100, approvals: [{ by: "u9", name: "Sam", step: 1 }] }),
      ], view);
      expect(badge("waiting", view)).toBeInTheDocument();
      expect(badge("fresh", view)).toBeNull(); // nobody has approved it yet
      expect(badge("small", view)).toBeNull(); // under the amount a single approval stands
    });

    it("shows no badge at all when the organisation asks for no second approver", async () => {
      await show(person(), [raw("waiting", { totalAmount: 900, approvals: [{ by: "u9", name: "Sam", step: 1 }] }), raw("other")], view);
      expect(confirmButton("other", view)).toBeInTheDocument();
      expect(screen.queryByText("Awaiting second approval")).toBeNull();
    });
  });

  describe(`approving one ${module} document`, () => {
    const press = async (id) => {
      const button = confirmButton(id, "table");
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
    };

    it("says it was approved when it was", async () => {
      await show(person(), [raw("a")]);
      await press("a");
      expect(await screen.findByText(/(approved|confirmed) successfully/i)).toBeInTheDocument();
      expect(processed()).toEqual(["/transactions/transactions/a/process"]);
      expect(api.patch).toHaveBeenCalledWith("/transactions/transactions/a/process", { action: "approve" });
    });

    it("answers a first approval with an information message - never 'approved' - and reads the list again", async () => {
      await show(person({ secondApprovalAbove: 500 }), [raw("big", { totalAmount: 900 })]);
      const before = api.get.mock.calls.filter((c) => isList(c[0])).length;
      api.patch.mockResolvedValue(FIRST_OF_TWO);
      // the server now has the first approval; the list read after it shows the badge
      await press("big");
      expect(await screen.findByText(FIRST_APPROVAL_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByText(/(approved|confirmed) successfully/i)).toBeNull();
      await waitFor(() => expect(api.get.mock.calls.filter((c) => isList(c[0])).length).toBeGreaterThan(before));
    });

    it("shows the badge once the list has been read again with the first approval on it", async () => {
      await show(person({ secondApprovalAbove: 500 }), [raw("big", { totalAmount: 900 })]);
      api.patch.mockImplementation(async () => {
        rows = [raw("big", { totalAmount: 900, approvals: [{ by: "u1", name: "Me", step: 1 }] })];
        return FIRST_OF_TWO;
      });
      await press("big");
      expect(await screen.findByText(FIRST_APPROVAL_MESSAGE)).toBeInTheDocument();
      await waitFor(() => expect(badge("big", "table")).toBeInTheDocument());
      expect(confirmButton("big", "table")).toBeNull(); // they gave the first; a different person gives the second
    });

    it("shows the server's own sentence when it refuses", async () => {
      await show(person(), [raw("a")]);
      api.patch.mockRejectedValue(httpError(403, { errorCode: "SELF_APPROVAL_NOT_ALLOWED", message: "You prepared this document, so someone else has to approve it." }));
      await press("a");
      expect(await screen.findByText(/You prepared this document, so someone else has to approve it\./)).toBeInTheDocument();
      expect(screen.queryByText(/(approved|confirmed) successfully/i)).toBeNull();
    });
  });

  describe(`approving several ${module} documents at once`, () => {
    const REFUSED = "This document is 900.00 AED and your approval limit is 500.00 AED. Ask someone with a higher limit to approve it.";

    it("says how many were approved, how many wait for a second approver and how many were refused - and why", async () => {
      await show(person({ separateApprover: true }), [raw("a"), raw("b"), raw("c"), raw("own", { createdBy: "u1" })]);
      api.patch.mockImplementation(async (url) => {
        if (url.includes("/a/")) return FINAL;
        if (url.includes("/b/")) return FIRST_OF_TWO;
        throw httpError(403, { errorCode: "APPROVAL_LIMIT_EXCEEDED", message: REFUSED });
      });
      for (const id of ["a", "b", "c", "own"]) tick(id);
      const [button] = bulkApprove();
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(await screen.findByText(`1 approved, 1 waiting for a second approver, 2 refused: ${REFUSED} / You prepared this document, so someone else has to approve it.`)).toBeInTheDocument();
      // their own work was never sent; the other three were
      expect(processed()).toEqual(["/transactions/transactions/a/process", "/transactions/transactions/b/process", "/transactions/transactions/c/process"]);
    });

    it("reports a plain success when every one was approved", async () => {
      await show(person(), [raw("a"), raw("b")]);
      for (const id of ["a", "b"]) tick(id);
      fireEvent.click(bulkApprove()[0]);
      expect(await screen.findByText("2 approved")).toBeInTheDocument();
      expect(processed()).toHaveLength(2);
    });

    it("goes on past a refusal instead of stopping at it", async () => {
      await show(person(), [raw("a"), raw("b")]);
      api.patch.mockImplementation(async (url) => {
        if (url.includes("/a/")) throw httpError(403, { message: "No." });
        return FINAL;
      });
      for (const id of ["a", "b"]) tick(id);
      fireEvent.click(bulkApprove()[0]);
      expect(await screen.findByText("1 approved, 1 refused: No.")).toBeInTheDocument();
      expect(processed()).toHaveLength(2);
    });

    it("offers no Approve for a selection of nothing but the person's own work, though the toolbar is up", async () => {
      await show(person({ separateApprover: true }), [raw("mine", { createdBy: "u1" }), raw("theirs", { createdBy: "u2" })]);
      tick("mine");
      expect(await screen.findByRole("button", { name: /^export( selected)?$/i })).toBeInTheDocument(); // the toolbar is up (Export is the control)
      expect(bulkApprove()).toHaveLength(0);
      tick("theirs");
      expect(bulkApprove()).toHaveLength(1); // as soon as one of the selection can be approved by them
    });
  });
}
