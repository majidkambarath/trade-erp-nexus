import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "@testing-library/jest-dom";
import { AsRole, roleLoaded, statusFor } from "../../../shell/__tests__/asRole";

// Test support (not a test): the bulk Delete of an order module's list page, shared by the four modules.
//
// A person selects rows and presses Delete in the toolbar. An approved document needs <module>.deletePosted (the server
// judges each by its stored status), so for someone who holds only <module>.delete the approved ones in the selection must
// never be sent to the server: they are left alone and the person is told how many and why. A selection of approved
// documents only offers no Delete at all. Someone who holds deletePosted deletes everything selected and is warned that the
// approved ones are reversed in stock and in the ledger.

const raw = (id, status) => ({
  _id: id, transactionNo: `DOC-${id}`, status, partyId: "p1", partyName: "Acme Corp", party: { customerName: "Acme Corp", vendorName: "Acme Corp" },
  date: "2026-10-01T00:00:00.000Z", deliveryDate: "2026-10-05T00:00:00.000Z", totalAmount: 525, createdBy: "Boss", priority: "Medium",
  items: [{ itemId: "i1", itemCode: "ITM1", description: "Item One", qty: 2, rate: 200, vatAmount: 10, vatPercent: 5 }],
});

const URL_OF = (id) => `/transactions/transactions/${id}`;

/**
 * @param module     "sales" | "purchase"
 * @param Page       the module's list page
 * @param api        the mocked axios instance ({ get, delete, post, put } as vi.fn)
 * @param setStatus  points the file's mocked organisation status at this person's grants
 */
export function deleteBulkCases(config) {
  const { module, api, setStatus } = config;
  const Page = config.Page; // a capitalised local, so the linter sees it used in the JSX below
  const plain = [`${module}.view`, `${module}.delete`];
  const posted = [...plain, `${module}.deletePosted`]; // the server expands deletePosted to hold delete as well

  const open = async (grants) => {
    setStatus(statusFor(grants));
    api.get.mockImplementation(async (url) => ({ data: { data: String(url).includes("/transactions/transactions") ? [raw("draft0", "DRAFT"), raw("approved", "APPROVED")] : [] } }));
    render(<MemoryRouter><AsRole><Page /></AsRole></MemoryRouter>);
    await roleLoaded();
    fireEvent.click(await screen.findByRole("button", { name: "Table view" }));
    // the list is loaded: both rows, the approved one included
    const rowOf = async (id) => (await screen.findByText(`DOC-${id}`)).closest("tr");
    return { draft: await rowOf("draft0"), approved: await rowOf("approved") };
  };
  const tick = (row) => fireEvent.click(within(row).getByRole("checkbox"));
  // the toolbar's Delete, not a row's: a row's sits inside the table
  const bulkDelete = () => screen.queryAllByRole("button", { name: /^delete( selected)?$/i }).filter((b) => !b.closest("table"));
  const deleteCalls = () => api.delete.mock.calls.map((c) => c[0]);
  const confirm = () => screen.findByRole("dialog");
  const typeDelete = (dialog) => {
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "delete" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
  };

  describe(`bulk Delete on the ${module} list`, () => {
    beforeEach(() => { api.delete.mockReset(); api.delete.mockResolvedValue({ data: { success: true } }); });

    it(`a person who holds ${module}.delete but not ${module}.deletePosted deletes the draft and leaves the approved one alone, and is told`, async () => {
      const { draft, approved } = await open(plain);
      tick(draft);
      tick(approved);
      const [button] = bulkDelete();
      expect(button).toBeInTheDocument(); // offered: part of the selection can be deleted
      fireEvent.click(button);
      const dialog = await confirm();
      expect(dialog).toHaveTextContent(/Delete 1 /); // one document, not two
      expect(dialog).toHaveTextContent("1 approved document was left alone: deleting an approved document needs the Delete approved permission.");
      expect(dialog).not.toHaveTextContent(/REVERSES/);
      typeDelete(dialog);
      await waitFor(() => expect(api.delete).toHaveBeenCalledTimes(1));
      expect(deleteCalls()).toEqual([URL_OF("draft0")]); // the approved one was never sent
      // and after it is done the person is told again, plainly
      expect(await screen.findByText(/1 approved document was left alone/)).toBeInTheDocument();
    });

    it(`a selection of approved documents only gives a person without ${module}.deletePosted no Delete to press`, async () => {
      const { approved } = await open(plain);
      tick(approved);
      // the selection toolbar is up (Export is the control) ...
      expect(await screen.findByRole("button", { name: /^export( selected)?$/i })).toBeInTheDocument();
      // ... and offers no Delete
      expect(bulkDelete()).toHaveLength(0);
      expect(api.delete).not.toHaveBeenCalled();
    });

    it(`a person who holds ${module}.deletePosted deletes both, and is warned that the approved one is reversed`, async () => {
      const { draft, approved } = await open(posted);
      tick(draft);
      tick(approved);
      fireEvent.click(bulkDelete()[0]);
      const dialog = await confirm();
      expect(dialog).toHaveTextContent(/Delete 2 /);
      expect(dialog).toHaveTextContent("1 of them is approved: deleting it REVERSES its stock and ledger postings.");
      expect(dialog).not.toHaveTextContent(/left alone/);
      typeDelete(dialog);
      await waitFor(() => expect(api.delete).toHaveBeenCalledTimes(2));
      expect(deleteCalls()).toEqual([URL_OF("draft0"), URL_OF("approved")]);
    });

    it(`a person who holds ${module}.deletePosted is offered Delete for approved documents only`, async () => {
      const { approved } = await open(posted);
      tick(approved);
      expect(bulkDelete()).toHaveLength(1);
    });
  });
}
