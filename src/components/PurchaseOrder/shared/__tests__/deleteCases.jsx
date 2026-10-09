import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AsRole, roleLoaded, statusFor } from "../../../shell/__tests__/asRole";

// Test support (not a test): the "who is offered Delete on a row" cases, shared by the four order modules.
//
// The server judges a delete by the STORED status (byDocumentDelete): an approved document has moved stock and posted to
// the ledger, and deleting it reverses all of that, so it needs <module>.deletePosted; anything else needs <module>.delete.
// A row therefore offers Delete to a person who holds the plain right only on a document that is not approved, and offers
// it on an approved one only to someone who holds deletePosted (which the server's grant set always pairs with delete).
//
// Every absence is asserted AFTER the grants are known (`roleLoaded`) and the rows are on screen, with a Delete that IS
// there as the control: while the grants are on their way the app hides nothing, so an earlier check would prove nothing.

export const NO_OP = () => {};

/** A list row the way the pages map one: both parties' names, a number, one line item. */
export const row = (id, status, over = {}) => ({
  id, _id: id, transactionNo: `DOC-${id}`, displayTransactionNo: `DOC-${id}`, status,
  date: "2026-10-01T00:00:00.000Z", deliveryDate: "2026-10-05T00:00:00.000Z", priority: "Medium", createdBy: "Boss", totalAmount: "525.00",
  customerId: "c1", customerName: "Acme Corp", vendorId: "v1", vendorName: "Gulf Supplies",
  items: [{ itemCode: "ITM1", description: "Item One", itemName: "Item One", qty: 2, rate: 200, vatAmount: 10, vatPercent: 5 }],
  ...over,
});

/**
 * @param module      "sales" | "purchase"
 * @param statuses    the statuses (besides APPROVED) on which the screen offers Delete to someone holding plain delete
 * @param names       the list props of this module's views: { rows, selected, setSelected, del }
 * @param views       [["table", TableView], ["cards", GridView]]
 * @param setStatus   points the file's mocked organisation status at this person's grants
 */
export function deleteRowCases({ module, statuses, names, views, setStatus }) {
  const plain = [`${module}.view`, `${module}.delete`];
  const posted = [...plain, `${module}.deletePosted`]; // the server expands deletePosted to hold delete as well

  const rows = [...statuses.map((s, i) => row(`${s.toLowerCase()}${i}`, s)), row("approved", "APPROVED")];
  const draftIds = statuses.map((s, i) => `${s.toLowerCase()}${i}`);

  describe.each(views)(`Delete on a ${module} row, as %s`, (_name, view) => {
    const View = view; // a capitalised local, so the linter sees it used in the JSX below
    const del = vi.fn();
    const list = (grants) => {
      setStatus(statusFor(grants));
      const props = {
        [names.rows]: rows, [names.selected]: [], [names.setSelected]: NO_OP, [names.del]: del,
        getPriorityColor: () => "bg-muted", getStatusColor: () => "", getStatusIcon: () => null, handleSort: NO_OP, sortBy: "date", sortOrder: "desc",
        setSelectedSO: NO_OP, setSelectedPO: NO_OP, setActiveView: NO_OP,
        editSO: NO_OP, editPO: NO_OP, confirmSO: NO_OP, approvePO: NO_OP, rejectPO: NO_OP,
        onDownloadInternal: NO_OP, onDownloadCustomer: NO_OP, onShowAudit: NO_OP, onSendDocument: NO_OP,
      };
      return render(<AsRole><View {...props} /></AsRole>);
    };
    const deleteButtons = () => screen.queryAllByRole("button", { name: /^delete$/i });
    // the list is loaded: every row is on screen, the approved one included
    const listLoaded = async () => {
      await roleLoaded();
      for (const r of rows) expect((await screen.findAllByText(r.transactionNo)).length).toBeGreaterThan(0);
    };
    beforeEach(() => del.mockClear());

    it(`a person who holds ${module}.delete but not ${module}.deletePosted can delete the documents that are not approved, and is not offered Delete on an approved one`, async () => {
      list(plain);
      await listLoaded();
      const buttons = deleteButtons();
      expect(buttons).toHaveLength(draftIds.length); // a Delete is there (the control) ...
      buttons.forEach((b) => fireEvent.click(b));
      expect(del.mock.calls.map((c) => c[0])).toEqual(draftIds); // ... on exactly the documents that are not approved
      expect(del).not.toHaveBeenCalledWith("approved");
    });

    it(`a person who holds ${module}.deletePosted is offered Delete on the approved one too`, async () => {
      list(posted);
      await listLoaded();
      const buttons = deleteButtons();
      expect(buttons).toHaveLength(draftIds.length + 1);
      buttons.forEach((b) => fireEvent.click(b));
      expect(del.mock.calls.map((c) => c[0])).toEqual([...draftIds, "approved"]);
    });

    it(`a person who holds neither is offered Delete on no row, though they see all of them`, async () => {
      list([`${module}.view`]);
      await listLoaded();
      expect(deleteButtons()).toHaveLength(0);
    });
  });
}
