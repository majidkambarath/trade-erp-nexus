import { vi } from "vitest";

// The toolbar's Delete for a selection on the sales list page. An approved document needs sales.deletePosted, so for someone who
// holds only sales.delete the approved ones are left out of the request and the person is told how many and why.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../../../axios/axios", () => ({ default: api }));
let orgStatus = null;
vi.mock("../../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import Page from "../SalesOrderPage.jsx";
import { deleteBulkCases } from "../../shared/__tests__/deleteBulkCases";

deleteBulkCases({ module: "sales", Page, api, setStatus: (s) => { orgStatus = s; } });
