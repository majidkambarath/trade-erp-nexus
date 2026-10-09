import { vi } from "vitest";

// Deleting an approved purchase return reverses its stock and ledger postings, so the server asks for purchase.deletePosted (not plain
// purchase.delete) for it. This pins the screen's half for the purchaseReturn list, as a table and as cards: Delete is hidden (never
// disabled) on an approved row unless the person holds purchase.deletePosted. The bulk Delete is covered in
// deleteBulk.test.jsx.
let orgStatus = null;
vi.mock("../../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import TableView from "../TableView.jsx";
import GridView from "../GridView.jsx";
import { deleteRowCases } from "../../shared/__tests__/deleteCases";

deleteRowCases({
  module: "purchase",
  statuses: ["DRAFT", "REJECTED"],
  names: { rows: "paginatedPOs", selected: "selectedPOs", setSelected: "setSelectedPOs", del: "deletePO" },
  views: [["table", TableView], ["cards", GridView]],
  setStatus: (s) => { orgStatus = s; },
});
