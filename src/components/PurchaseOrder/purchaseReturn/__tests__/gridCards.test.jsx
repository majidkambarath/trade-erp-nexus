import { vi } from "vitest";

// What a purchaseReturn document card has to survive on a phone (see shared/__tests__/gridCardCases.jsx).
let orgStatus = null;
vi.mock("../../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import GridView from "../GridView.jsx";
import { gridCardCases } from "../../shared/__tests__/gridCardCases";

gridCardCases({
  module: "purchase",
  names: { rows: "paginatedPOs", selected: "selectedPOs", setSelected: "setSelectedPOs", del: "deletePO" },
  View: GridView,
  setStatus: (s) => { orgStatus = s; },
});
