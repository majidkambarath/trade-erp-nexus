import { vi } from "vitest";

// Approving on the sales list page: who is offered Confirm / Approve, the "Awaiting second approval" badge, what a first approval
// and a refusal say, and the bulk Approve's honest tally. The rules and the cases are in shared/__tests__/approvalCases.jsx.
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() }));
vi.mock("../../../../axios/axios", () => ({ default: api }));
let orgStatus = null;
vi.mock("../../../../lib/organisationApi", () => ({ getOrganisationStatus: vi.fn(() => Promise.resolve(orgStatus)) }));

import Page from "../SalesOrderPage.jsx";
import { approvalCases } from "../../shared/__tests__/approvalCases";

approvalCases({ module: "sales", open: "DRAFT", Page, api, setStatus: (s) => { orgStatus = s; } });
