import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Field, Select, Textarea, TextInput } from "../accounting/kit";
import { BankAccountsSection, ContactsSection, DocumentsSection } from "./PartyRows";
import {
  CUSTOMER_STATUSES, SECTIONS, VAT_STATUSES, VENDOR_STATUSES,
  errorCountBySection, termOptions, validateParty, withCreditDays, withPaymentTerms,
} from "../../lib/partyForms";

// The customer / vendor form, in sections: Basic, VAT, Credit and terms, Contacts, Bank accounts and
// KYC documents. It is a controlled component: the page owns the form fields (lib/partyForms.js
// builds them from a record and turns them back into an API body) and the errors.
//
//   kind        "customer" | "vendor"
//   value       the form fields          onChange(next)  receives the whole next form
//   errors      by field path ("name", "vat.trn", "bankAccounts.1.iban"...), from validateParty / the server
//   banks       the bank master          documentTypes   the document-type master
//   sections    which sections to show (default all)
//   section / onSection   optional: control the open section from outside (to jump to the first error)
export default function PartyForm({
  kind, value, onChange, errors = {}, banks = [], banksLoading = false, documentTypes = [], typesLoading = false,
  sections, section, onSection, autoFocus = true,
}) {
  const shown = SECTIONS.filter((s) => !sections || sections.includes(s.id));
  const [inner, setInner] = useState(shown[0]?.id || "basic");
  const open = section ?? inner;
  const setOpen = (id) => (onSection ? onSection(id) : setInner(id));
  const counts = errorCountBySection(errors);
  const rowCounts = { contacts: value.contacts.length, bank: value.bankAccounts.length, documents: value.documents.length };
  const set = (patch) => onChange({ ...value, ...patch });
  const ctx = { kind, value, set, onChange, errors, banks, banksLoading, documentTypes, typesLoading };

  return (
    <Tabs value={open} onValueChange={setOpen} className="gap-4">
      <div className="overflow-x-auto">
        <TabsList aria-label={kind === "vendor" ? "Vendor details" : "Customer details"}>
          {shown.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>
              {s.label}
              {rowCounts[s.id] > 0 && <span className="rounded-full bg-secondary px-1.5 text-xs text-muted-foreground">{rowCounts[s.id]}</span>}
              {counts[s.id] > 0 && (
                <span className="rounded-full bg-status-danger-soft px-1.5 text-xs font-semibold text-status-danger">
                  <span aria-hidden="true">{counts[s.id]}</span>
                  <span className="sr-only">{counts[s.id]} to fix</span>
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {shown.map((s) => (
        <TabsContent key={s.id} value={s.id}>
          {s.id === "basic" && <BasicSection {...ctx} autoFocus={autoFocus} />}
          {s.id === "vat" && <VatSection {...ctx} />}
          {s.id === "credit" && <CreditSection {...ctx} />}
          {s.id === "contacts" && <ContactsSection {...ctx} />}
          {s.id === "bank" && <BankAccountsSection {...ctx} />}
          {s.id === "documents" && <DocumentsSection {...ctx} />}
        </TabsContent>
      ))}
    </Tabs>
  );
}

// ---------- basic ----------

function BasicSection({ kind, value, set, errors, autoFocus }) {
  const noun = kind === "vendor" ? "Vendor" : "Customer";
  const statuses = kind === "vendor" ? VENDOR_STATUSES : CUSTOMER_STATUSES;
  const text = (k) => (e) => set({ [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={`${noun} name`} required error={errors.name} className="sm:col-span-2">
        <TextInput value={value.name} onChange={text("name")} maxLength={100} placeholder={kind === "vendor" ? "e.g. Gulf Mills Trading LLC" : "e.g. Al Noor Mart LLC"} data-autofocus={autoFocus ? true : undefined} />
      </Field>
      <Field label="Contact person" required error={errors.contactPerson}>
        <TextInput value={value.contactPerson} onChange={text("contactPerson")} maxLength={100} autoComplete="off" />
      </Field>
      <Field label="Phone" error={errors.phone} hint="With the country code, for example +971 50 123 4567.">
        <TextInput type="tel" value={value.phone} onChange={text("phone")} maxLength={30} />
      </Field>
      <Field label="Email" error={errors.email}>
        <TextInput type="email" value={value.email} onChange={text("email")} maxLength={120} placeholder={`${kind}@example.ae`} />
      </Field>
      <Field label="Website" error={errors.website}>
        <TextInput value={value.website} onChange={text("website")} maxLength={200} placeholder="www.example.ae" />
      </Field>
      {kind === "customer" && (
        <Field label="Sales person" hint="Optional.">
          <TextInput value={value.salesPerson} onChange={text("salesPerson")} maxLength={100} />
        </Field>
      )}
      <Field label="Status">
        <Select value={value.status} onChange={text("status")}>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Field>
      {kind === "customer" ? (
        <>
          <Field label="Billing address" required error={errors.billingAddress}>
            <Textarea value={value.billingAddress} onChange={text("billingAddress")} maxLength={500} />
          </Field>
          <Field label="Shipping address" hint="Optional. Leave empty when it is the billing address.">
            <Textarea value={value.shippingAddress} onChange={text("shippingAddress")} maxLength={500} />
          </Field>
        </>
      ) : (
        <Field label="Address" required error={errors.address} className="sm:col-span-2">
          <Textarea value={value.address} onChange={text("address")} maxLength={500} />
        </Field>
      )}
    </div>
  );
}

// ---------- VAT ----------

function VatSection({ kind, value, set, errors, documentTypes }) {
  const [touched, setTouched] = useState(false);
  const needsTrn = value.vatStatus === "registered" || value.vatStatus === "designated_zone";
  const showTrn = value.vatStatus !== "unregistered";
  // the 15-digit rule is shown once the field has been left, or as soon as it has too many digits
  const live = validateParty(kind, value, { documentTypes, strict: false })["vat.trn"];
  const digits = value.trn.replace(/[\s-]/g, "").length;
  const trnError = errors["vat.trn"] || (touched || digits > 15 ? live : undefined);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="VAT status" hint="Whether this party is registered for UAE VAT.">
        <Select value={value.vatStatus} onChange={(e) => set({ vatStatus: e.target.value, ...(e.target.value === "unregistered" ? { trn: "" } : {}) })}>
          {VAT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </Select>
      </Field>
      {showTrn ? (
        <Field label="TRN (tax registration number)" required={needsTrn} error={trnError} hint={needsTrn ? "15 digits, for example 100123456700003." : "Optional. If given, 15 digits."}>
          <TextInput
            inputMode="numeric" value={value.trn} maxLength={19} placeholder="100123456700003"
            onChange={(e) => set({ trn: e.target.value })} onBlur={() => setTouched(true)}
          />
        </Field>
      ) : (
        <p className="self-end pb-2 text-sm text-muted-foreground">An unregistered party has no TRN.</p>
      )}
      <Field label="Trade licence number" hint="Optional. Keep the licence itself under KYC documents.">
        <TextInput value={value.tradeLicenseNo} onChange={(e) => set({ tradeLicenseNo: e.target.value })} maxLength={60} />
      </Field>
      {value.vatStatus === "designated_zone" && (
        <p className="rounded-xl border border-border bg-secondary/50 p-3 text-sm text-muted-foreground sm:col-span-2">
          A business in a designated zone can be treated differently for VAT on goods. A 15-digit TRN is still needed, and the VAT code on each invoice is chosen as usual.
        </p>
      )}
    </div>
  );
}

// ---------- credit and terms ----------

function CreditSection({ kind, value, set, onChange, errors }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {kind === "customer" && (
        <Field label="Credit limit (AED)" error={errors.creditLimit} hint="0 means no limit is set. Credit control, in Settings, compares the balance with it.">
          <TextInput type="number" inputMode="decimal" min="0" step="0.01" value={value.creditLimit} onChange={(e) => set({ creditLimit: e.target.value })} placeholder="0.00" />
        </Field>
      )}
      <Field label="Payment terms">
        <Select value={value.paymentTerms} onChange={(e) => onChange(withPaymentTerms(value, kind, e.target.value))}>
          {termOptions(kind, value.paymentTerms).map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Field>
      <Field label="Credit days" error={errors["credit.days"]} hint="Days allowed to pay. It follows the payment terms; type another number for a different period.">
        <TextInput type="number" inputMode="numeric" min="0" max="365" step="1" value={value.creditDays} onChange={(e) => onChange(withCreditDays(value, kind, e.target.value))} />
      </Field>
    </div>
  );
}
