import { vi } from "vitest";

// The sales order list page's period and pages: it opens on this calendar month, reads every page of it, and pages in the
// browser. The rules and the cases are in shared/__tests__/listPeriodCases.jsx.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() }));
vi.mock("../../../../axios/axios", () => ({ default: api }));
let orgStatus = null;
vi.mock("../../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import Page from "../SalesOrderPage.jsx";
import { listPeriodCases } from "../../shared/__tests__/listPeriodCases";

listPeriodCases({ module: "sales", type: "sales_order", serverDates: true, Page, api, setStatus: (s) => { orgStatus = s; } });
