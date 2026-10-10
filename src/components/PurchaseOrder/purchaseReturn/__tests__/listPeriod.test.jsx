import { vi } from "vitest";

// The purchase return list page's period and pages: it opens on this calendar month, reads every return (the server's date
// filter for returns matches nothing, so none is sent) and cuts to the period and pages in the browser. The rules and the
// cases are in shared/__tests__/listPeriodCases.jsx.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() }));
vi.mock("../../../../axios/axios", () => ({ default: api }));
let orgStatus = null;
vi.mock("../../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import Page from "../PurchaseOrderPage.jsx";
import { listPeriodCases } from "../../shared/__tests__/listPeriodCases";

listPeriodCases({ module: "purchase", type: "purchase_return", serverDates: false, Page, api, setStatus: (s) => { orgStatus = s; } });
