import React from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { formatDate, formatNumber } from "../../../utils/format";
import { Button } from "../../ui/button";
import { ErrorNote, Panel, Pill } from "../../accounting/kit";
import { DetailList, Skeleton } from "./partyAccountParts";
import { partyStatusTone } from "./partyAccountUtils";

const tel = (v) => (v ? <a className="underline underline-offset-2" href={`tel:${v}`}>{v}</a> : null);
const mail = (v) => (v ? <a className="break-all underline underline-offset-2" href={`mailto:${v}`}>{v}</a> : null);
const text = (v) => (v ? <span className="whitespace-pre-line">{v}</span> : null);

// What the record holds, grouped the way someone reads it. Edited on the Customers / Vendors page.
function sections(kind, p) {
  if (kind === "vendor") {
    return [
      { title: "Contact", items: [{ label: "Contact person", value: p.contactPerson }, { label: "Phone", value: tel(p.phone) }, { label: "Email", value: mail(p.email) }, { label: "Vendor since", value: p.enrollDate ? formatDate(p.enrollDate) : null }] },
      { title: "Tax and e-invoicing", items: [{ label: "TRN", value: p.trnNO }, { label: "Peppol participant ID", value: p.participantId }] },
      { title: "Terms", items: [{ label: "Payment terms", value: p.paymentTerms }, { label: "Status", value: p.status ? <Pill tone={partyStatusTone(p.status)}>{p.status}</Pill> : null }] },
      { title: "Address", items: [{ label: "Address", value: text(p.address), wide: true }] },
    ];
  }
  return [
    { title: "Contact", items: [{ label: "Contact person", value: p.contactPerson }, { label: "Phone", value: tel(p.phone) }, { label: "Email", value: mail(p.email) }, { label: "Sales person", value: p.salesPerson }, { label: "Customer since", value: p.joinDate ? formatDate(p.joinDate) : null }] },
    { title: "Tax and e-invoicing", items: [{ label: "TRN", value: p.trnNumber }, { label: "Peppol participant ID", value: p.eInvoice?.participantId }, { label: "City", value: p.eInvoice?.city }, { label: "Country", value: p.eInvoice?.countryCode }] },
    {
      title: "Terms and credit",
      items: [
        { label: "Payment terms", value: p.paymentTerms },
        { label: "Credit limit", value: Number(p.creditLimit) > 0 ? formatNumber(p.creditLimit, 2) : "No credit limit set" },
        { label: "Minimum shelf life on dispatch", value: Number(p.minShelfLifeDays) > 0 ? `${p.minShelfLifeDays} days` : "No minimum" },
        { label: "Status", value: p.status ? <Pill tone={partyStatusTone(p.status)}>{p.status}</Pill> : null },
      ],
    },
    { title: "Addresses", items: [{ label: "Billing address", value: text(p.billingAddress) }, { label: "Shipping address", value: text(p.shippingAddress) }] },
  ];
}

/** Read-only party details with a way into the page where they are edited. */
export default function PartyDetailsTab({ k, party }) {
  const { data, loading, error, reload } = party;

  if (loading && !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
      </div>
    );
  }
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">These details are kept on the {k.manageLabel} page.</p>
        <Button asChild variant="outline">
          <Link to={k.managePath}><Pencil className="h-4 w-4" aria-hidden="true" />Edit on the {k.manageLabel} page</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {sections(k.kind, data).map((s) => (
          <Panel key={s.title} title={s.title}><DetailList items={s.items} /></Panel>
        ))}
      </div>
      {data.notes && <Panel title="Notes"><p className="whitespace-pre-line text-sm text-foreground">{data.notes}</p></Panel>}
    </div>
  );
}
