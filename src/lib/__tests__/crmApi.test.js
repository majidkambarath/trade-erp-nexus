// The CRM's API client, tested at the WIRE. The screen tests mock crmApi itself, so they prove a screen calls the
// mock correctly and nothing about what leaves the browser - which is how four calls shipped sending
// `?params[from]=...` instead of `?from=...`: the server then never saw a date, a search or a customer id, and a
// customer's CRM tab would have listed everybody's contacts. This mocks one layer lower, the axios instance.
import { describe, it, expect, beforeEach, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../axios/axios", () => ({ default: http }));

const { crm } = await import("../crmApi");
const { api } = await import("../accountingApi");

beforeEach(() => {
  for (const fn of Object.values(http)) fn.mockReset().mockResolvedValue({ data: { data: [] } });
});

// The same flat object has to arrive as axios's `params`, whichever method sent it.
const ASKED = { from: "2026-10-01", to: "2026-10-31", search: "rao", customerId: "c1", status: "all" };

describe("every read that takes a filter sends it flat, as the query string", () => {
  const reads = [
    ["calendar", "/crm/calendar"],
    ["activityReport", "/crm/reports/activity"],
    ["activities", "/crm/activities"],
    ["contacts", "/crm/contacts"],
    ["analysis", "/crm/analysis"],
    ["pipeline", "/crm/pipeline"],
    ["timeline", "/crm/timeline"],
    ["leads", "/crm/leads"],
    ["duplicates", "/crm/leads/duplicates"],
    ["deals", "/crm/opportunities"],
    ["followUps", "/crm/follow-ups"],
  ];

  it.each(reads)("%s -> GET %s", async (method, url) => {
    await crm[method](ASKED);
    expect(http.get).toHaveBeenCalledTimes(1);
    const [path, config] = http.get.mock.calls[0];
    expect(path).toBe(url);
    // Flat. `{ params: { params: ASKED } }` is the bug this test exists for.
    expect(config).toEqual({ params: ASKED });
    expect(config.params.params).toBeUndefined();
  });
});

describe("reads that take no filter", () => {
  it("dashboard and aging name their own paths", async () => {
    await crm.dashboard();
    await crm.aging();
    expect(http.get.mock.calls.map((c) => c[0])).toEqual(["/crm/dashboard", "/crm/reports/aging"]);
  });
});

describe("a route the server has never heard of", () => {
  const express404 = () => Object.assign(new Error("Request failed with status code 404"), { response: { status: 404, data: "<!DOCTYPE html><pre>Cannot GET /api/v1/crm/calendar</pre>" } });

  it("says the server needs updating, not 'Request failed with status code 404'", async () => {
    http.get.mockRejectedValue(express404());
    const error = await crm.calendar(ASKED).catch((e) => e);
    expect(error.message).toMatch(/needs updating or restarting/);
    expect(error.message).not.toMatch(/status code 404/);
    expect(error.code).toBe("ROUTE_NOT_FOUND");
    expect(error.status).toBe(404);
  });

  it("but a record that is genuinely not found keeps the server's own words and code", async () => {
    http.get.mockRejectedValue(
      Object.assign(new Error("x"), { response: { status: 404, data: { success: false, message: "Contact not found", errorCode: "CONTACT_NOT_FOUND" } } })
    );
    const error = await crm.contact("nope").catch((e) => e);
    expect(error.message).toBe("Contact not found");
    expect(error.code).toBe("CONTACT_NOT_FOUND");
  });

  it("leaves every other failure as it was", async () => {
    http.get.mockRejectedValue(Object.assign(new Error("Network Error"), {}));
    expect((await api.get("/x").catch((e) => e)).message).toBe("Network Error");
    http.get.mockRejectedValue(Object.assign(new Error("x"), { response: { status: 500, data: { message: "Boom", errorCode: "E" } } }));
    expect((await api.get("/x").catch((e) => e)).message).toBe("Boom");
  });
});
