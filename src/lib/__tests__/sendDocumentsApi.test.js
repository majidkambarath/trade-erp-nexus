import { describe, it, expect, vi, beforeEach } from "vitest";
import axiosInstance from "../../axios/axios";
import { documentSends } from "../sendDocumentsApi";

vi.mock("../../axios/axios", () => ({ default: { post: vi.fn(), get: vi.fn() } }));
vi.mock("../accountingApi", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  ApiError: class ApiError extends Error { constructor(message, extra = {}) { super(message); Object.assign(this, extra); } },
}));

const sent = (data) => ({ data: { success: true, data } });
beforeEach(() => vi.clearAllMocks());

describe("posting a document to be emailed", () => {
  it("is a multipart upload, so the file survives: the shared client's JSON default would flatten it away", async () => {
    axiosInstance.post.mockResolvedValue(sent({ send: { _id: "s1" } }));
    const file = new File(["%PDF-1.4 body"], "Tax-invoice_INV-1.pdf", { type: "application/pdf" });
    await documentSends.send({ docType: "tax_invoice", sourceId: "so1", to: ["a@x.ae", "b@x.ae"], cc: [], note: "Thanks", includeShareLink: true, force: undefined, subject: "" }, file, "send-key-1");

    const [url, form, options] = axiosInstance.post.mock.calls[0];
    expect(url).toBe("/messaging/send");
    expect(options.headers["Content-Type"]).toBe("multipart/form-data");
    expect(options.headers["Idempotency-Key"]).toBe("send-key-1");
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("pdf")).toBeInstanceOf(File);
    expect(form.get("pdf").name).toBe("Tax-invoice_INV-1.pdf");
    expect(form.get("docType")).toBe("tax_invoice");
    expect(form.get("sourceId")).toBe("so1");
    expect(JSON.parse(form.get("to"))).toEqual(["a@x.ae", "b@x.ae"]);
    expect(form.get("includeShareLink")).toBe("true");
    expect(form.get("note")).toBe("Thanks");
  });

  it("leaves out what is empty, so the server's own defaults apply", async () => {
    axiosInstance.post.mockResolvedValue(sent({ send: {} }));
    await documentSends.send({ docType: "tax_invoice", sourceId: "so1", to: ["a@x.ae"], cc: [], subject: "", force: undefined, note: "" }, null, "k");
    const form = axiosInstance.post.mock.calls[0][1];
    expect(form.has("pdf")).toBe(false);
    for (const k of ["subject", "force", "note"]) expect(form.has(k), k).toBe(false);
    expect(form.get("cc")).toBe("[]");
  });

  it("hands back what the server answered, and turns a refusal into an error with its code", async () => {
    axiosInstance.post.mockResolvedValueOnce(sent({ send: { _id: "s1" }, duplicate: false }));
    expect(await documentSends.send({ docType: "tax_invoice", sourceId: "so1", to: [] }, null, "k")).toEqual({ send: { _id: "s1" }, duplicate: false });

    axiosInstance.post.mockRejectedValueOnce({ message: "Request failed", response: { status: 422, data: { message: "Sending is switched off.", errorCode: "MESSAGING_DISABLED", details: { missing: ["key"] } } } });
    await expect(documentSends.send({ docType: "tax_invoice", sourceId: "so1", to: [] }, null, "k")).rejects.toMatchObject({ message: "Sending is switched off.", code: "MESSAGING_DISABLED", status: 422, details: { missing: ["key"] } });
  });

  it("a WhatsApp hand-over goes as JSON with its own key", async () => {
    axiosInstance.post.mockResolvedValue(sent({ waUrl: "https://wa.me/971501112222?text=x" }));
    const r = await documentSends.handoff({ docType: "tax_invoice", sourceId: "so1", phone: "050 111 2222" }, "wa-key-1");
    expect(r.waUrl).toMatch(/^https:\/\/wa\.me\//);
    const [url, body, options] = axiosInstance.post.mock.calls[0];
    expect(url).toBe("/messaging/handoff");
    expect(body).toEqual({ docType: "tax_invoice", sourceId: "so1", phone: "050 111 2222" });
    expect(options.headers["Idempotency-Key"]).toBe("wa-key-1");
  });
});
