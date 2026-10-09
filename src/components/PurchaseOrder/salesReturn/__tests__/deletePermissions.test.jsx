import { vi } from "vitest";

// Deleting an approved sales return reverses its stock and ledger postings, so the server asks for sales.deletePosted (not plain
// sales.delete) for it. This pins the screen's half for the salesReturn list, as a table and as cards: Delete is hidden (never
// disabled) on an approved row unless the person holds sales.deletePosted. The bulk Delete is covered in
// deleteBulk.test.jsx.
let orgStatus = null;
vi.mock("../../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import TableView from "../TableView.jsx";
import GridView from "../GridView.jsx";
import { deleteRowCases } from "../../shared/__tests__/deleteCases";

deleteRowCases({
  module: "sales",
  statuses: ["DRAFT"],
  names: { rows: "paginatedSOs", selected: "selectedSOs", setSelected: "setSelectedSOs", del: "deleteSO" },
  views: [["table", TableView], ["cards", GridView]],
  setStatus: (s) => { orgStatus = s; },
});
