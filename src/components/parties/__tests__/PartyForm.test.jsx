import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  uploadAttachment: vi.fn(),
  deleteAttachment: vi.fn(),
  downloadAttachment: vi.fn(),
  banks: vi.fn(),
  documentTypes: vi.fn(),
  save: vi.fn(),
}));

vi.mock("../../../lib/accountingApi", () => ({
  accounting: { deleteAttachment: mocks.deleteAttachment, attachments: vi.fn() },
  uploadAttachment: mocks.uploadAttachment,
  downloadAttachment: mocks.downloadAttachment,
  linkAttachment: vi.fn(),
}));
vi.mock("../../../lib/bankingApi", () => ({ banking: { banks: mocks.banks } }));
vi.mock("../../../lib/partyMasterApi", () => ({
  partyMaster: { documentTypes: { list: mocks.documentTypes }, parties: { save: mocks.save } },
}));

import PartyForm from "../PartyForm";
import PartyModal from "../PartyModal";
import ExpiryPill from "../ExpiryPill";
import { emptyParty, partyToForm } from "../../../lib/partyForms";
import { todayInput } from "../../../utils/format";

const TYPES = [
  { _id: "tl", name: "Trade licence", requiresExpiry: true, minLength: 3, maxLength: 30, isActive: true },
  { _id: "eid", name: "Emirates ID", requiresExpiry: true, minLength: 15, maxLength: 18, isActive: true },
  { _id: "bl", name: "Bank letter", requiresExpiry: false, minLength: null, maxLength: null, isActive: true },
];
const BANKS = [{ _id: "b1", bankName: "Emirates NBD", bankCode: "ENBD" }, { _id: "b2", bankName: "Abu Dhabi Commercial Bank", bankCode: "ADCB" }];

// the page owns the form: a stand-in page that keeps it in state and exposes the latest value
let latest;
function Harness({ kind = "customer", initial, errors = {}, types = TYPES, banks = BANKS, sections }) {
  const [value, setValue] = useState(initial || emptyParty(kind));
  latest = value;
  return <PartyForm kind={kind} value={value} onChange={setValue} errors={errors} banks={banks} documentTypes={types} sections={sections} />;
}
// a tab's name can carry a row count or "n to fix", so it is found by how it starts
const openTab = (name) => fireEvent.mouseDown(screen.getByRole("tab", { name: new RegExp(`^${name}`) }), { button: 0 });
const pick = (label, text) => {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter" });
};
const today = () => todayInput();
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.banks.mockResolvedValue(BANKS);
  mocks.documentTypes.mockResolvedValue(TYPES);
});

describe("the party form: sections", () => {
  it("shows the six sections, with the customer's two addresses and a vendor's one", () => {
    const { unmount } = render(<Harness />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Basic", "VAT", "Credit and terms", "Contacts", "Bank accounts", "KYC documents"]);
    expect(screen.getByLabelText(/Customer name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Billing address/)).toBeInTheDocument();
    expect(screen.getByLabelText("Shipping address")).toBeInTheDocument();
    expect(screen.getByLabelText("Sales person")).toBeInTheDocument();
    expect(screen.getByLabelText("Website")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Status")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Active", "Inactive"]);
    unmount();

    render(<Harness kind="vendor" />);
    expect(screen.getByLabelText(/Vendor name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Address/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Billing address/)).toBeNull();
    expect(screen.queryByLabelText("Sales person")).toBeNull();
    expect(within(screen.getByLabelText("Status")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Compliant", "Non-compliant", "Pending", "Expired"]);
  });

  it("can show only the sections it is given", () => {
    render(<Harness sections={["basic", "vat"]} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Basic", "VAT"]);
  });

  it("flags the sections that have errors, and the field errors it is handed", () => {
    render(<Harness errors={{ name: "Customer name is required", "vat.trn": "Enter the 15-digit TRN", "documents.0.number": "x", "documents.1.number": "y" }} />);
    expect(screen.getByText("Customer name is required")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^VAT\s*1 to fix/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /KYC documents\s*2 to fix/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Basic\s*1 to fix/ })).toBeInTheDocument();
  });
});

describe("the party form: VAT configuration", () => {
  it("an unregistered party has no TRN field; registering asks for one and checks it has 15 digits", () => {
    render(<Harness />);
    openTab("VAT");
    expect(screen.getByLabelText("VAT status")).toHaveValue("unregistered");
    expect(screen.queryByLabelText(/TRN/)).toBeNull();
    expect(screen.getByText("An unregistered party has no TRN.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("VAT status"), { target: { value: "registered" } });
    const trn = screen.getByLabelText(/TRN/);
    fireEvent.change(trn, { target: { value: "1001234567" } });
    expect(screen.queryByText(/exactly 15 digits/)).toBeNull(); // not while still typing
    fireEvent.blur(trn);
    expect(screen.getByText("A UAE TRN is exactly 15 digits (10 entered)")).toBeInTheDocument();
    expect(trn).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(trn, { target: { value: "100123456700003" } });
    expect(screen.queryByText(/exactly 15 digits/)).toBeNull();
    expect(latest).toMatchObject({ vatStatus: "registered", trn: "100123456700003" });
  });

  it("shows an error as soon as there are too many digits", () => {
    render(<Harness initial={{ ...emptyParty("customer"), vatStatus: "registered" }} />);
    openTab("VAT");
    fireEvent.change(screen.getByLabelText(/TRN/), { target: { value: "1001234567000031" } });
    expect(screen.getByText("A UAE TRN is exactly 15 digits (16 entered)")).toBeInTheDocument();
  });

  it("explains a designated zone, and going back to unregistered clears the TRN", () => {
    render(<Harness initial={{ ...emptyParty("customer"), vatStatus: "registered", trn: "100123456700003" }} />);
    openTab("VAT");
    expect(screen.queryByText(/A business in a designated zone/)).toBeNull();
    fireEvent.change(screen.getByLabelText("VAT status"), { target: { value: "designated_zone" } });
    expect(screen.getByText(/A business in a designated zone can be treated differently/)).toBeInTheDocument();
    expect(screen.getByLabelText(/TRN/)).toHaveValue("100123456700003");
    fireEvent.change(screen.getByLabelText("VAT status"), { target: { value: "unregistered" } });
    expect(latest.trn).toBe("");
    expect(screen.queryByLabelText(/TRN/)).toBeNull();
  });

  it("exempt may have a TRN or none; the trade licence number is kept", () => {
    render(<Harness />);
    openTab("VAT");
    fireEvent.change(screen.getByLabelText("VAT status"), { target: { value: "exempt" } });
    expect(screen.getByText("Optional. If given, 15 digits.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Trade licence number"), { target: { value: "CN-1234567" } });
    expect(latest.tradeLicenseNo).toBe("CN-1234567");
  });
});

describe("the party form: credit and terms", () => {
  it("a customer has a credit limit; choosing terms sets the days and typing days sets the terms", () => {
    render(<Harness />);
    openTab("Credit and terms");
    fireEvent.change(screen.getByLabelText(/Credit limit/), { target: { value: "25000" } });
    expect(latest.creditLimit).toBe("25000");
    expect(screen.getByLabelText("Payment terms")).toHaveValue("Net 30");
    expect(screen.getByLabelText("Credit days")).toHaveValue(30);

    fireEvent.change(screen.getByLabelText("Payment terms"), { target: { value: "Net 60" } });
    expect(screen.getByLabelText("Credit days")).toHaveValue(60);
    fireEvent.change(screen.getByLabelText("Credit days"), { target: { value: "90" } });
    expect(screen.getByLabelText("Payment terms")).toHaveValue("Net 90");
    expect(within(screen.getByLabelText("Payment terms")).getByRole("option", { name: "Net 90" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Payment terms"), { target: { value: "Cash on Delivery" } });
    expect(screen.getByLabelText("Credit days")).toHaveValue(0);
  });

  it("a vendor has terms and days, but no credit limit", () => {
    render(<Harness kind="vendor" />);
    openTab("Credit and terms");
    expect(screen.queryByLabelText(/Credit limit/)).toBeNull();
    expect(within(screen.getByLabelText("Payment terms")).getAllByRole("option").map((o) => o.textContent)).toEqual(["30 days", "Net 30", "45 days", "Net 60", "60 days", "COD"]);
    fireEvent.change(screen.getByLabelText("Payment terms"), { target: { value: "45 days" } });
    expect(screen.getByLabelText("Credit days")).toHaveValue(45);
  });

  it("shows the error it is given for the days", () => {
    render(<Harness errors={{ "credit.days": "Credit days is a whole number from 0 to 365" }} />);
    openTab("Credit and terms");
    expect(screen.getByText("Credit days is a whole number from 0 to 365")).toBeInTheDocument();
  });
});

describe("the party form: contacts", () => {
  it("adds contacts, the first is primary, the radio moves it, removing the primary hands it on", () => {
    render(<Harness />);
    openTab("Contacts");
    expect(screen.getByText("No extra contacts yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add contact/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add contact/ }));
    const radios = screen.getAllByRole("radio", { name: "Primary contact" });
    expect(radios.map((r) => r.checked)).toEqual([true, false]);

    const names = screen.getAllByLabelText(/^Name/);
    fireEvent.change(names[0], { target: { value: "Huda Saeed" } });
    fireEvent.change(names[1], { target: { value: "Majid Rashid" } });
    fireEvent.click(radios[1]);
    expect(latest.contacts.map((c) => [c.name, c.isPrimary])).toEqual([["Huda Saeed", false], ["Majid Rashid", true]]);

    fireEvent.click(screen.getByRole("button", { name: "Remove contact 2" }));
    expect(latest.contacts.map((c) => [c.name, c.isPrimary])).toEqual([["Huda Saeed", true]]);
    expect(screen.getByRole("tab", { name: /Contacts\s*1/ })).toBeInTheDocument();
  });

  it("shows the errors it is given on the row", () => {
    render(<Harness initial={{ ...emptyParty("customer"), contacts: [{ name: "", designation: "", email: "bad", phone: "", isPrimary: true }] }} errors={{ "contacts.0.name": "Enter the contact's name", "contacts.0.email": "Enter a valid email address" }} />);
    openTab("Contacts");
    expect(screen.getByText("Enter the contact's name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
  });
});

describe("the party form: bank accounts", () => {
  it("picks the bank from the bank master, checks the IBAN and the SWIFT code once they are left", () => {
    render(<Harness kind="vendor" />);
    openTab("Bank accounts");
    fireEvent.click(screen.getByRole("button", { name: /Add bank account/ }));
    expect(screen.getByLabelText("Bank name")).toBeInTheDocument(); // a name can be typed when the bank is not in the master
    pick(/^Bank\*?$/, "emir");
    expect(latest.bankAccounts[0]).toMatchObject({ bankId: "b1", isPrimary: true });
    expect(screen.queryByLabelText("Bank name")).toBeNull();

    const iban = screen.getByLabelText("IBAN");
    fireEvent.change(iban, { target: { value: "ae070331234567890123457" } });
    expect(screen.queryByText(/IBAN is not valid/)).toBeNull();
    fireEvent.blur(iban);
    expect(screen.getByText("That IBAN is not valid. Check it for a typing mistake.")).toBeInTheDocument();
    fireEvent.change(iban, { target: { value: "ae07 0331 2345 6789 0123 456" } });
    expect(screen.queryByText(/IBAN is not valid/)).toBeNull();
    expect(latest.bankAccounts[0].iban).toBe("AE07 0331 2345 6789 0123 456");

    const swift = screen.getByLabelText(/SWIFT/);
    fireEvent.change(swift, { target: { value: "ebil" } });
    fireEvent.blur(swift);
    expect(screen.getByText("A SWIFT / BIC code has 8 or 11 characters")).toBeInTheDocument();
    fireEvent.change(swift, { target: { value: "ebilaead" } });
    expect(screen.queryByText(/8 or 11 characters$/)).toBeNull();
    expect(latest.bankAccounts[0].swiftCode).toBe("EBILAEAD");
  });

  it("keeps one primary account and lets a row be removed", () => {
    render(<Harness />);
    openTab("Bank accounts");
    fireEvent.click(screen.getByRole("button", { name: /Add bank account/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add bank account/ }));
    const radios = screen.getAllByRole("radio", { name: "Primary account" });
    fireEvent.click(radios[1]);
    expect(latest.bankAccounts.map((b) => b.isPrimary)).toEqual([false, true]);
    fireEvent.click(screen.getByRole("button", { name: "Remove bank account 2" }));
    expect(latest.bankAccounts.map((b) => b.isPrimary)).toEqual([true]);
  });

  it("says so when the bank master is empty", () => {
    render(<Harness banks={[]} />);
    openTab("Bank accounts");
    fireEvent.click(screen.getByRole("button", { name: /Add bank account/ }));
    expect(screen.getByText("No bank in the bank master yet. Type the bank's name.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Bank name"), { target: { value: "Mashreq" } });
    expect(latest.bankAccounts[0].bankName).toBe("Mashreq");
  });
});

describe("the party form: KYC documents", () => {
  const typeDate = (label, iso) => fireEvent.change(screen.getByLabelText(label), { target: { value: iso } });

  it("choosing a type shows its number limits and makes the expiry date required", () => {
    render(<Harness />);
    openTab("KYC documents");
    expect(screen.getByText(/Reminders by email: Coming soon/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add document/ }));
    pick(/Document type/, "trade");
    expect(latest.documents[0]).toMatchObject({ documentTypeId: "tl", typeName: "Trade licence" });
    expect(screen.getByText("3 to 30 characters.")).toBeInTheDocument();
    const expiry = screen.getByLabelText(/^Expiry date/);
    expect(document.querySelector(`label[for="${expiry.id}"]`).textContent).toContain("*"); // required for this type
    expect(screen.getByLabelText(/^Number/)).toHaveAttribute("maxlength", "30");

    // a type with no expiry leaves it optional
    pick(/Document type/, "bank letter");
    expect(latest.documents[0].typeName).toBe("Bank letter");
    expect(screen.queryByText("3 to 30 characters.")).toBeNull();
  });

  it("shows the status from the expiry date: valid, expiring, expired", () => {
    render(<Harness />);
    openTab("KYC documents");
    fireEvent.click(screen.getByRole("button", { name: /Add document/ }));
    expect(screen.queryByText("Valid")).toBeNull();
    typeDate(/^Expiry date/, addDays(today(), 200));
    expect(screen.getByText("Valid")).toBeInTheDocument();
    typeDate(/^Expiry date/, addDays(today(), 12));
    expect(screen.getByText("Expires in 12 days")).toBeInTheDocument();
    typeDate(/^Expiry date/, addDays(today(), 0));
    expect(screen.getByText("Expires today")).toBeInTheDocument();
    typeDate(/^Expiry date/, addDays(today(), -3));
    expect(screen.getByText("Expired 3 days ago")).toBeInTheDocument();
  });

  it("uploads a file for a document, and takes a file that was only just uploaded off straight away", async () => {
    mocks.uploadAttachment.mockResolvedValue({ attachmentId: "f1", fileName: "licence.pdf", fileSize: 2048 });
    mocks.deleteAttachment.mockResolvedValue({});
    render(<Harness />);
    openTab("KYC documents");
    fireEvent.click(screen.getByRole("button", { name: /Add document/ }));
    const file = new File(["%PDF-1.4"], "licence.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Upload file for document 1"), { target: { files: [file] } });
    expect(await screen.findByText("licence.pdf")).toBeInTheDocument();
    expect(mocks.uploadAttachment).toHaveBeenCalledTimes(1);
    expect(latest.documents[0]).toMatchObject({ attachmentId: "f1", fileName: "licence.pdf", pending: true });

    fireEvent.click(screen.getByRole("button", { name: "Download file of document 1" }));
    expect(mocks.downloadAttachment).toHaveBeenCalledWith({ attachmentId: "f1", fileName: "licence.pdf" });

    fireEvent.click(screen.getByRole("button", { name: "Remove file of document 1" }));
    await waitFor(() => expect(mocks.deleteAttachment).toHaveBeenCalledWith("f1"));
    expect(latest.documents[0]).toMatchObject({ attachmentId: "", fileName: "" });
    expect(screen.getByLabelText("Upload file for document 1")).toBeInTheDocument();
  });

  it("a saved file is only detached; the server removes it when the party is saved", async () => {
    const saved = partyToForm("customer", { customerName: "Co", documents: [{ _id: "d1", typeName: "Trade licence", number: "CN-1", attachmentId: "f9", fileName: "tl.pdf" }] });
    render(<Harness initial={saved} />);
    openTab("KYC documents");
    expect(screen.getByText("tl.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove file of document 1" }));
    expect(latest.documents[0].attachmentId).toBe("");
    expect(mocks.deleteAttachment).not.toHaveBeenCalled();
  });

  it("refuses a file type that is not allowed before uploading it", async () => {
    render(<Harness />);
    openTab("KYC documents");
    fireEvent.click(screen.getByRole("button", { name: /Add document/ }));
    fireEvent.change(screen.getByLabelText("Upload file for document 1"), { target: { files: [new File(["MZ"], "run.exe")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(".exe");
    expect(mocks.uploadAttachment).not.toHaveBeenCalled();
  });

  it("marks a document verified and removes a row", () => {
    render(<Harness />);
    openTab("KYC documents");
    fireEvent.click(screen.getByRole("button", { name: /Add document/ }));
    fireEvent.click(screen.getByLabelText("Verified"));
    expect(latest.documents[0].isVerified).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove document 1" }));
    expect(latest.documents).toEqual([]);
    expect(screen.getByText("No documents yet.")).toBeInTheDocument();
  });
});

describe("the expiry flag on the customer and vendor lists", () => {
  it("shows nothing when every document is in order, a warning when one is about to expire, and an alert when one has", () => {
    const { container, rerender } = render(<ExpiryPill documents={[{ typeName: "Passport", expiryDate: addDays(today(), 200) }, { typeName: "Bank letter" }]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<ExpiryPill documents={[{ typeName: "Trade licence", expiryDate: addDays(today(), 9) }]} />);
    expect(screen.getByText("Document expiring")).toBeInTheDocument();
    expect(screen.getByTitle("Trade licence: expires in 9 days")).toBeInTheDocument();
    rerender(<ExpiryPill documents={[{ typeName: "Trade licence", expiryDate: addDays(today(), 9) }, { typeName: "Emirates ID", expiryDate: addDays(today(), -2) }]} />);
    expect(screen.getByText("Document expired")).toBeInTheDocument();
    expect(screen.getByTitle("Emirates ID: expired 2 days ago (2 documents need attention)")).toBeInTheDocument();
    rerender(<ExpiryPill documents={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("the add / edit dialog", () => {
  const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it("will not save an incomplete form, and opens the section that needs attention", async () => {
    render(<PartyModal kind="customer" onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));
    expect(await screen.findByText("Customer name is required")).toBeInTheDocument();
    expect(screen.getByText("Contact person is required")).toBeInTheDocument();
    expect(screen.getByText("Billing address is required")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();

    // a registered customer without a TRN: the VAT tab opens
    fill(/Customer name/, "Al Noor Mart");
    fill(/Contact person/, "Sara Khan");
    fill(/Billing address/, "Deira, Dubai");
    openTab("VAT");
    fireEvent.change(screen.getByLabelText("VAT status"), { target: { value: "registered" } });
    openTab("Basic");
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));
    expect(await screen.findByText("Enter the 15-digit TRN")).toBeInTheDocument();
    expect(screen.getByLabelText(/TRN/)).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("clears an error as soon as it is fixed", async () => {
    render(<PartyModal kind="customer" onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));
    expect(await screen.findByText("Customer name is required")).toBeInTheDocument();
    fill(/Customer name/, "Al Noor");
    expect(screen.queryByText("Customer name is required")).toBeNull();
    expect(screen.getByText("Contact person is required")).toBeInTheDocument();
  });

  it("sends the customer in the API's shape and reports it saved", async () => {
    mocks.save.mockResolvedValue({ _id: "c1" });
    const onSaved = vi.fn();
    render(<PartyModal kind="customer" onClose={() => {}} onSaved={onSaved} />);
    fill(/Customer name/, "Al Noor Mart");
    fill(/Contact person/, "Sara Khan");
    fill(/Billing address/, "Deira, Dubai");
    fill("Email", "buyer@alnoor.ae");
    openTab("VAT");
    fireEvent.change(screen.getByLabelText("VAT status"), { target: { value: "registered" } });
    fill(/TRN/, "1001 2345 6700 003");
    openTab("Credit and terms");
    fill(/Credit limit/, "25000");
    fill("Credit days", "45");
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    const [kind, id, body] = mocks.save.mock.calls[0];
    expect([kind, id]).toEqual(["customer", undefined]);
    expect(body).toMatchObject({
      customerName: "Al Noor Mart", contactPerson: "Sara Khan", billingAddress: "Deira, Dubai", email: "buyer@alnoor.ae", creditLimit: 25000,
      paymentTerms: "Net 45", credit: { days: 45 }, vat: { status: "registered", trn: "100123456700003" },
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ _id: "c1" }, "Customer created successfully!"));
  });

  it("puts a refused TRN on the TRN field", async () => {
    mocks.save.mockRejectedValue(Object.assign(new Error("TRN already in use by another customer"), { code: "DUPLICATE_TRN" }));
    render(<PartyModal kind="customer" onClose={() => {}} onSaved={() => {}} />);
    fill(/Customer name/, "Twin");
    fill(/Contact person/, "x");
    fill(/Billing address/, "Deira");
    openTab("VAT");
    fireEvent.change(screen.getByLabelText("VAT status"), { target: { value: "registered" } });
    fill(/TRN/, "100123456700003");
    fireEvent.click(screen.getByRole("button", { name: "Add customer" }));
    expect(await screen.findByText("TRN already in use by another customer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add customer" })).toBeEnabled();
  });

  it("opens an existing vendor filled in, and saves the change to that vendor", async () => {
    mocks.save.mockResolvedValue({ _id: "v1" });
    const onSaved = vi.fn();
    const vendor = { _id: "v1", vendorId: "VEND2026001", vendorName: "Gulf Mills", contactPerson: "Omar", address: "Jebel Ali", paymentTerms: "COD", status: "Pending", trnNO: "100123456700003", email: "o@gulf.ae" };
    render(<PartyModal kind="vendor" record={vendor} onClose={() => {}} onSaved={onSaved} />);
    expect(screen.getByRole("dialog", { name: "Edit vendor" })).toBeInTheDocument();
    expect(screen.getByText("Gulf Mills · VEND2026001")).toBeInTheDocument();
    expect(screen.getByLabelText(/Vendor name/)).toHaveValue("Gulf Mills");
    expect(screen.getByLabelText("Status")).toHaveValue("Pending");
    openTab("VAT");
    expect(screen.getByLabelText("VAT status")).toHaveValue("registered");
    expect(screen.getByLabelText(/TRN/)).toHaveValue("100123456700003");
    openTab("Credit and terms");
    expect(screen.getByLabelText("Credit days")).toHaveValue(0);
    fireEvent.click(screen.getByRole("button", { name: "Update vendor" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0].slice(0, 2)).toEqual(["vendor", "v1"]);
    expect(mocks.save.mock.calls[0][2]).toMatchObject({ vendorName: "Gulf Mills", status: "Pending", paymentTerms: "COD", vat: { status: "registered", trn: "100123456700003" } });
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ _id: "v1" }, "Vendor updated successfully!"));
  });
});
