// The CRM's API client, tested at the WIRE. The screen tests mock crmApi itself, so they prove a screen calls the
// mock correctly and nothing about what leaves the browser - which is how four calls shipped sending
// `?params[from]=...` instead of `?from=...`: the server then never saw a date, a search or a customer id, and a
// customer's CRM tab would have listed everybody's contacts. This mocks one layer lower, the axios instance.
import { describe, it, expect, beforeEach, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("../../axios/axios", () => ({ default: http }));

const { crm, filesFor, CRM_WORK_CHANGED } = await import("../crmApi");
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
    ["customers", "/crm/customers"],
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

describe("importing a spreadsheet", () => {
  const rows = [{ line: 2, name: "Ali", phone: "0501" }];

  it("posts the rows to the lead and the contact import, as they are", async () => {
    await crm.importLeads({ rows, dryRun: true, fileName: "a.csv" });
    await crm.importContacts({ rows, dryRun: true });
    expect(http.post.mock.calls.map((c) => c[0])).toEqual(["/crm/leads/import", "/crm/contacts/import"]);
    expect(http.post.mock.calls[0][1]).toEqual({ rows, dryRun: true, fileName: "a.csv" });
  });

  it("announces a change of work for a real import, and not for a preview that changed nothing", async () => {
    const heard = vi.fn();
    window.addEventListener(CRM_WORK_CHANGED, heard);
    try {
      await crm.importLeads({ rows, dryRun: true });
      expect(heard).not.toHaveBeenCalled();
      await crm.importLeads({ rows }); // no dryRun is the preview too
      expect(heard).not.toHaveBeenCalled();
      await crm.importLeads({ rows, dryRun: false });
      expect(heard).toHaveBeenCalledTimes(1); // new leads can mean new first-contact follow-ups: the badge must refresh
    } finally {
      window.removeEventListener(CRM_WORK_CHANGED, heard);
    }
  });
});

describe("files on a lead or a deal", () => {
  it("are listed from the lead's own path or the deal's", async () => {
    await filesFor("lead", "L1").list();
    await filesFor("deal", "D1").list();
    expect(http.get.mock.calls.map((c) => c[0])).toEqual(["/crm/leads/L1/attachments", "/crm/opportunities/D1/attachments"]);
  });

  it("go up as multipart, with the file and its label - the shared instance would otherwise flatten them to JSON", async () => {
    const file = new File(["%PDF-1.4"], "spec.pdf", { type: "application/pdf" });
    await filesFor("deal", "D1").upload(file, "Contract");
    const [path, body, config] = http.post.mock.calls[0];
    expect(path).toBe("/crm/opportunities/D1/attachments");
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("file")).toBe(file);
    expect(body.get("label")).toBe("Contract");
    expect(config.headers["Content-Type"]).toBe("multipart/form-data");
    await filesFor("lead", "L1").upload(file);
    expect(http.post.mock.calls[1][1].has("label")).toBe(false); // no label, no empty field
  });

  it("are removed and downloaded by the file's own id, never through the accounting routes", async () => {
    const files = filesFor("lead", "L1");
    await files.remove({ attachmentId: "F1" });
    expect(http.delete.mock.calls[0][0]).toBe("/crm/attachments/F1");

    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {}); // jsdom cannot navigate to a download
    http.get.mockResolvedValue({ data: new Blob(["bytes"]) });
    await files.download({ attachmentId: "F1", fileName: "spec.pdf" });
    const [path, config] = http.get.mock.calls[0];
    expect(path).toBe("/crm/attachments/F1");
    expect(config).toEqual({ responseType: "blob" });
    for (const [url] of [...http.get.mock.calls, ...http.post.mock.calls, ...http.delete.mock.calls]) expect(url).not.toMatch(/accounting/);
  });
});
