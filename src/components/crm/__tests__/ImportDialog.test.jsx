import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";

// The import dialog against a stubbed API. What is asserted is what a person sees and presses: the columns guessed from
// their headings, a preview that writes nothing, a button that names how many it will add, and the plain words when
// something goes wrong halfway.
const m = vi.hoisted(() => ({ importLeads: vi.fn(), importContacts: vi.fn(), downloadCSV: vi.fn() }));

vi.mock("../../../lib/crmApi", () => ({ crm: { importLeads: m.importLeads, importContacts: m.importContacts } }));
vi.mock("../../../utils/format", async (importOriginal) => ({ ...(await importOriginal()), downloadCSV: m.downloadCSV }));

import ImportDialog from "../ImportDialog.jsx";

// A File as far as the reader needs one.
const csv = (text, name = "enquiries.csv") => ({ name, arrayBuffer: async () => new TextEncoder().encode(text).buffer });
const choose = async (file) => {
  const input = await screen.findByLabelText(/Choose a file of .* to import/);
  fireEvent.change(input, { target: { files: [file] } });
};

const SUMMARY = { total: 0, create: 0, invalid: 0, duplicate: 0, skipped: 0 };
// The server's preview: every row will be made, unless a test says otherwise.
const preview = (over = {}) => (body) =>
  Promise.resolve({
    dryRun: true,
    summary: { ...SUMMARY, total: body.rows.length, create: body.rows.length },
    issues: [],
    sample: body.rows.slice(0, 5).map((r) => ({ name: r.name, company: r.company, phone: r.phone })),
    ...over,
  });
const real = (over = {}) => (body) =>
  Promise.resolve({
    dryRun: false,
    summary: { ...SUMMARY, total: body.rows.length, create: body.rows.length, created: body.rows.length, failed: 0 },
    issues: [],
    failed: [],
    created: body.rows.map((r, i) => ({ line: r.line, id: `id${i}` })),
    ...over,
  });
const answers = (previewFn = preview(), realFn = real()) => (body) => (body.dryRun === false ? realFn(body) : previewFn(body));

const FILE = "Name,Company,Phone,Source\nAli Traders,Ali Co,0501234567,Walk-in\nSara,,0502222222,WhatsApp\n";

beforeEach(() => {
  m.importLeads.mockReset();
  m.importContacts.mockReset();
  m.downloadCSV.mockReset();
});

const open = (props = {}) => {
  const onClose = vi.fn();
  const onDone = vi.fn();
  const notify = vi.fn();
  render(<ImportDialog kind="lead" onClose={onClose} onDone={onDone} notify={notify} {...props} />);
  return { onClose, onDone, notify };
};

describe("choosing the file", () => {
  it("explains the shape, and offers a template to copy from", async () => {
    open();
    expect(await screen.findByText(/The first row must be the column names/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Download a template/ }));
    expect(m.downloadCSV).toHaveBeenCalledTimes(1);
    const [fileName, headers] = m.downloadCSV.mock.calls[0];
    expect(fileName).toMatch(/\.csv$/);
    expect(headers).toContain("Name");
  });

  it("says in words when the file is not a list, and stays on the first step", async () => {
    open();
    await choose(csv("Name,Phone\n")); // a header and nothing under it
    expect(await screen.findByText(/nothing under it|no rows/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Choose a file of .* to import/)).toBeInTheDocument();
  });
});

describe("matching the columns", () => {
  it("guesses them from the headings and shows a sample of what is in each", async () => {
    open();
    await choose(csv(FILE));
    expect(await screen.findByText(/has 2 enquiries/)).toBeInTheDocument();
    const name = screen.getByLabelText(/Name/);
    expect(name).toHaveValue("0");
    expect(within(name).getByRole("option", { name: "Name - column A" })).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toHaveValue("2");
    expect(screen.getByLabelText("City")).toHaveValue(""); // nothing in the file is a city
    expect(screen.getByText("e.g. Ali Traders")).toBeInTheDocument();
  });

  it("will not go on while the name has no column, and says which one is missing", async () => {
    open();
    await choose(csv("Phone,Email\n0501,a@x.com\n"));
    expect(await screen.findByText(/Choose which column holds the name/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check the file" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "0" } }); // the person says: the first column
    expect(screen.getByRole("button", { name: "Check the file" })).toBeEnabled();
  });

  it("lets the person change a guess", async () => {
    m.importLeads.mockImplementation(answers());
    open();
    await choose(csv("Customer,Mobile\nAli,0501\n"));
    await screen.findByText(/has 1 enquiry/);
    // "Customer" alone is not a heading we can place, so the name has no column yet: the person says which
    expect(screen.getByRole("button", { name: "Check the file" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Company"), { target: { value: "0" } }); // the same column may feed two fields
    expect(screen.getByLabelText("Company")).toHaveValue("0");
    fireEvent.click(screen.getByRole("button", { name: "Check the file" }));
    await waitFor(() => expect(m.importLeads).toHaveBeenCalled());
    expect(m.importLeads.mock.calls[0][0].rows[0]).toMatchObject({ line: 2, name: "Ali", company: "Ali", phone: "0501" });
  });
});

describe("the preview", () => {
  it("asks the server what would happen and writes nothing, whatever the person presses", async () => {
    m.importLeads.mockImplementation(answers());
    open();
    await choose(csv(FILE));
    await screen.findByText(/has 2 enquiries/);
    fireEvent.click(screen.getByRole("button", { name: "Check the file" }));
    expect(await screen.findByText("will be added")).toBeInTheDocument();
    expect(m.importLeads).toHaveBeenCalledTimes(1);
    const body = m.importLeads.mock.calls[0][0];
    expect(body.dryRun).toBe(true); // the only thing sent so far is the preview
    expect(body.fileName).toBe("enquiries.csv");
    expect(body.rows.map((r) => r.line)).toEqual([2, 3]);
    expect(screen.getByText("Ali Traders")).toBeInTheDocument(); // the first rows to be made
  });

  it("shows the rows that need a look, numbered as the person's own file is", async () => {
    m.importLeads.mockImplementation(
      answers(
        preview({
          summary: { total: 3, create: 1, invalid: 1, duplicate: 1, skipped: 0 },
          issues: [
            { line: 3, status: "invalid", errors: [{ message: "Give the person or company a name" }] },
            { line: 4, status: "duplicate", duplicateOf: { kind: "lead", by: "phone" } },
          ],
        })
      )
    );
    open();
    await choose(csv(`${FILE}Omar,,0503333333,Referral\n`));
    await screen.findByText(/has 3 enquiries/);
    fireEvent.click(screen.getByRole("button", { name: "Check the file" }));
    expect(await screen.findByText("Line 3: Give the person or company a name")).toBeInTheDocument();
    expect(screen.getByText("Line 4: already a lead (same phone number)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 1 lead" })).toBeEnabled(); // it names the number, and the word agrees
  });

  it("will not offer to import when nothing would be added", async () => {
    m.importLeads.mockImplementation(answers(preview({ summary: { total: 2, create: 0, invalid: 0, duplicate: 2, skipped: 0 } })));
    open();
    await choose(csv(FILE));
    await screen.findByText(/has 2 enquiries/);
    fireEvent.click(screen.getByRole("button", { name: "Check the file" }));
    expect(await screen.findByText(/Nothing here would be added/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Import 0 leads$/ })).toBeDisabled();
  });

  it("can go back to change the columns", async () => {
    m.importLeads.mockImplementation(answers());
    open();
    await choose(csv(FILE));
    await screen.findByText(/has 2 enquiries/);
    fireEvent.click(screen.getByRole("button", { name: "Check the file" }));
    await screen.findByText("will be added");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByText(/Say which column holds what/)).toBeInTheDocument();
  });
});

describe("importing", () => {
  const through = async (props) => {
    const handlers = open(props);
    await choose(csv(FILE));
    await screen.findByText(/has 2 enquiries/);
    fireEvent.click(screen.getByRole("button", { name: "Check the file" }));
    await screen.findByText("will be added");
    return handlers;
  };

  it("sends the real import only when the person presses the button that names the number", async () => {
    m.importLeads.mockImplementation(answers());
    const { onDone, notify } = await through();
    expect(m.importLeads.mock.calls.every(([b]) => b.dryRun === true)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Import 2 leads" }));
    expect(await screen.findByText("2 leads added.")).toBeInTheDocument();
    const last = m.importLeads.mock.calls.at(-1)[0];
    expect(last.dryRun).toBe(false);
    expect(last.followUp).toBe(false); // old enquiries must not flood today's list unless the person asks
    expect(last.allowDuplicates).toBe(false);
    expect(notify).toHaveBeenCalledWith("2 leads imported");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("passes on a first follow-up and duplicates only when the person ticked them", async () => {
    m.importLeads.mockImplementation(answers());
    open();
    await choose(csv(FILE));
    await screen.findByText(/has 2 enquiries/);
    fireEvent.click(screen.getByLabelText(/Add a first follow-up for each lead/));
    fireEvent.click(screen.getByLabelText(/Add people I already have/));
    fireEvent.click(screen.getByRole("button", { name: "Check the file" }));
    await screen.findByText("will be added");
    fireEvent.click(screen.getByRole("button", { name: "Import 2 leads" }));
    await screen.findByText("2 leads added.");
    expect(m.importLeads.mock.calls.at(-1)[0]).toMatchObject({ dryRun: false, followUp: true, allowDuplicates: true });
  });

  it("reports what the import could not do, row by row", async () => {
    m.importLeads.mockImplementation(
      answers(preview(), real({
        summary: { ...SUMMARY, total: 2, create: 1, invalid: 1, created: 1, failed: 1 },
        issues: [{ line: 3, status: "invalid", errors: [{ message: "That email address does not look right" }] }],
        failed: [{ line: 2, code: "X", message: "Could not be saved" }],
      }))
    );
    await through();
    fireEvent.click(screen.getByRole("button", { name: "Import 2 leads" }));
    expect(await screen.findByText("Line 3: That email address does not look right")).toBeInTheDocument();
    expect(screen.getByText("Line 2: Could not be saved")).toBeInTheDocument();
  });

  it("says what was done before a lot failed, and that the same file will carry on", async () => {
    let calls = 0;
    m.importLeads.mockImplementation((body) => {
      calls += 1;
      if (body.dryRun === false) return Promise.reject(new Error("Network Error"));
      return preview()(body);
    });
    await through();
    fireEvent.click(screen.getByRole("button", { name: "Import 2 leads" }));
    expect(await screen.findByText(/It stopped after 0 rows: Network Error/)).toBeInTheDocument();
    expect(screen.getByText(/choose the same file again to carry on/)).toBeInTheDocument();
    expect(calls).toBeGreaterThan(1);
  });

  it("closes without refreshing the list when nothing was added", async () => {
    m.importLeads.mockImplementation(answers(preview(), real({ summary: { ...SUMMARY, total: 2, duplicate: 2, created: 0, failed: 0 } })));
    const { onDone, onClose } = await through();
    fireEvent.click(screen.getByRole("button", { name: "Import 2 leads" }));
    expect(await screen.findByText("Nothing was added.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("importing people", () => {
  it("uses the people's own endpoint and asks what to do about a company that is not a customer", async () => {
    m.importContacts.mockImplementation(answers());
    open({ kind: "contact" });
    await choose(csv("Name,Job title,Email,Company\nOmar,Buyer,omar@x.com,Al Noor\n", "people.csv"));
    expect(await screen.findByText(/has 1 person/)).toBeInTheDocument();
    expect(screen.getByLabelText("Job title")).toHaveValue("1");
    fireEvent.change(screen.getByLabelText(/A person whose company is not a customer yet/), { target: { value: "skip" } });
    fireEvent.click(screen.getByRole("button", { name: "Check the file" }));
    await screen.findByText("will be added");
    expect(m.importLeads).not.toHaveBeenCalled();
    expect(m.importContacts.mock.calls[0][0]).toMatchObject({ dryRun: true, unmatched: "skip", fileName: "people.csv" });
    expect(m.importContacts.mock.calls[0][0].rows[0]).toMatchObject({ name: "Omar", designation: "Buyer", company: "Al Noor" });
    fireEvent.click(screen.getByRole("button", { name: "Import 1 person" }));
    expect(await screen.findByText("1 person added.")).toBeInTheDocument();
  });
});
