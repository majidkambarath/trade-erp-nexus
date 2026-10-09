import { vi } from "vitest";

// The toolbar's Delete for a selection on the purchaseReturn list page. An approved document needs purchase.deletePosted, so for someone who
// holds only purchase.delete the approved ones are left out of the request and the person is told how many and why.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../../../../axios/axios", () => ({ default: api }));
let orgStatus = null;
vi.mock("../../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import Page from "../PurchaseOrderPage.jsx";
import { deleteBulkCases } from "../../shared/__tests__/deleteBulkCases";

deleteBulkCases({ module: "purchase", Page, api, setStatus: (s) => { orgStatus = s; } });
