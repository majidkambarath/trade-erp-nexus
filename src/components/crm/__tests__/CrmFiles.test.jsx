import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

// The files panel on a lead or a deal. It is the accounting documents' own panel, pointed at the CRM's door by a `source`;
// what matters here is that it works through that source and never through the accounting routes (a CRM-only organisation
// holds no key to those), that the list is read once, and that a person who may only look can still download.
const m = vi.hoisted(() => ({
  source: { list: vi.fn(), upload: vi.fn(), remove: vi.fn(), download: vi.fn() },
  filesFor: vi.fn(),
  accounting: { attachments: vi.fn(() => { throw new Error("the accounting door must not be used"); }), deleteAttachment: vi.fn() },
  uploadAttachment: vi.fn(() => { throw new Error("the accounting door must not be used"); }),
  downloadAttachment: vi.fn(() => { throw new Error("the accounting door must not be used"); }),
}));

// Like the real one, `filesFor` hands back a NEW source for each record (the functions are shared, so the spies still count).
vi.mock("../../../lib/crmApi", () => ({ crm: {}, filesFor: (...a) => (m.filesFor(...a), { ...m.source }) }));
vi.mock("../../../lib/accountingApi", () => ({
  accounting: m.accounting,
  uploadAttachment: m.uploadAttachment,
  downloadAttachment: m.downloadAttachment,
  linkAttachment: vi.fn(),
  api: { get: vi.fn() },
}));

import { CrmFiles } from "../crmShared.jsx";

const PDF = { attachmentId: "f1", fileName: "spec sheet.pdf", fileType: "application/pdf", fileSize: 2048, label: "Specification" };
const file = (name, size = 100, type = "application/pdf") => {
  const f = new File(["x".repeat(size)], name, { type });
  return f;
};

beforeEach(() => {
  m.source.list.mockReset().mockResolvedValue([PDF]);
  m.source.upload.mockReset();
  m.source.remove.mockReset().mockResolvedValue({ deleted: true });
  m.source.download.mockReset().mockResolvedValue(undefined);
  m.filesFor.mockReset();
});

describe("the files on a lead or a deal", () => {
  it("lists them from the CRM's own source, with size and label, and asks for the right record", async () => {
    render(<CrmFiles kind="deal" id="D1" />);
    expect(await screen.findByText("spec sheet.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2 KB · Specification/)).toBeInTheDocument();
    expect(m.filesFor).toHaveBeenCalledWith("deal", "D1");
    expect(m.accounting.attachments).not.toHaveBeenCalled();
  });

  it("reads the list once, however often the screen draws again", async () => {
    const { rerender } = render(<CrmFiles kind="lead" id="L1" />);
    await screen.findByText("spec sheet.pdf");
    rerender(<CrmFiles kind="lead" id="L1" readOnly={false} />);
    rerender(<CrmFiles kind="lead" id="L1" />);
    await waitFor(() => expect(m.source.list).toHaveBeenCalledTimes(1));
  });

  it("reads another list when it is another record", async () => {
    const { rerender } = render(<CrmFiles kind="lead" id="L1" />);
    await screen.findByText("spec sheet.pdf");
    rerender(<CrmFiles kind="lead" id="L2" />);
    await waitFor(() => expect(m.source.list).toHaveBeenCalledTimes(2));
  });

  it("uploads through the source and shows the file at once", async () => {
    m.source.upload.mockResolvedValue({ attachmentId: "f2", fileName: "photo.png", fileType: "image/png", fileSize: 500 });
    render(<CrmFiles kind="lead" id="L1" />);
    await screen.findByText("spec sheet.pdf");
    const input = screen.getByLabelText(/Add files/i);
    const photo = file("photo.png", 500, "image/png");
    fireEvent.change(input, { target: { files: [photo] } });
    expect(await screen.findByText("photo.png")).toBeInTheDocument();
    expect(m.source.upload).toHaveBeenCalledWith(photo);
    expect(m.uploadAttachment).not.toHaveBeenCalled();
  });

  it("refuses a type we do not keep before it leaves the browser, in words", async () => {
    render(<CrmFiles kind="lead" id="L1" />);
    await screen.findByText("spec sheet.pdf");
    fireEvent.change(screen.getByLabelText(/Add files/i), { target: { files: [file("setup.exe", 100, "application/octet-stream")] } });
    expect(await screen.findByText(/setup\.exe: \.exe is not allowed/)).toBeInTheDocument();
    expect(m.source.upload).not.toHaveBeenCalled();
  });

  it("refuses a file that is too big or empty", async () => {
    render(<CrmFiles kind="lead" id="L1" />);
    await screen.findByText("spec sheet.pdf");
    const big = file("big.pdf", 10 * 1024 * 1024 + 1);
    fireEvent.change(screen.getByLabelText(/Add files/i), { target: { files: [big] } });
    expect(await screen.findByText(/the limit is 10 MB/)).toBeInTheDocument();
    expect(m.source.upload).not.toHaveBeenCalled();
  });

  it("shows the server's own words when an upload is refused, and keeps what was already there", async () => {
    m.source.upload.mockRejectedValue(Object.assign(new Error("A lead can hold 25 files: remove one first"), { code: "ATTACHMENT_LIMIT" }));
    render(<CrmFiles kind="lead" id="L1" />);
    await screen.findByText("spec sheet.pdf");
    fireEvent.change(screen.getByLabelText(/Add files/i), { target: { files: [file("one-more.pdf")] } });
    expect(await screen.findByText(/A lead can hold 25 files/)).toBeInTheDocument();
    expect(screen.getByText("spec sheet.pdf")).toBeInTheDocument();
  });

  it("removes through the source, and the file is gone from the list", async () => {
    render(<CrmFiles kind="lead" id="L1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove spec sheet.pdf" }));
    await waitFor(() => expect(screen.queryByText("spec sheet.pdf")).toBeNull());
    expect(m.source.remove).toHaveBeenCalledWith(PDF);
    expect(m.accounting.deleteAttachment).not.toHaveBeenCalled();
  });

  it("downloads through the source", async () => {
    render(<CrmFiles kind="lead" id="L1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Download spec sheet.pdf" }));
    await waitFor(() => expect(m.source.download).toHaveBeenCalledWith(PDF));
    expect(m.downloadAttachment).not.toHaveBeenCalled();
  });

  it("lets somebody who may only look download, and offers them nothing to add or remove", async () => {
    render(<CrmFiles kind="lead" id="L1" readOnly />);
    expect(await screen.findByRole("button", { name: "Download spec sheet.pdf" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Add files/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("says what went wrong when the list cannot be read, rather than showing an empty box", async () => {
    m.source.list.mockRejectedValue(new Error("The server does not have this yet."));
    render(<CrmFiles kind="lead" id="L1" />);
    expect(await screen.findByText(/The server does not have this yet/)).toBeInTheDocument();
  });
});
