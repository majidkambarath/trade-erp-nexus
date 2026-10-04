import React from "react";
import { CalendarClock, FileCode2, Network, ShieldCheck } from "lucide-react";

// Placeholder for UAE e-invoicing. The feature is NOT built yet - this page exists so the
// mandate and its dates are visible inside the product, and so the nav item leads
// somewhere real instead of 404ing. Nothing here claims the system is compliant today.
//
// Facts below are from the Ministry of Finance / FTA programme as published; see the
// dated note at the foot of the page. Update them when the programme changes.

const MILESTONES = [
  {
    date: "30 October 2026",
    title: "Appoint an Accredited Service Provider",
    detail:
      "Required for businesses with annual revenue of AED 50 million or more. Invoices may only be transmitted through a provider accredited by the Ministry of Finance.",
    tone: "warning",
  },
  {
    date: "1 January 2027",
    title: "E-invoicing becomes mandatory",
    detail: "For businesses with annual revenue of AED 50 million or more.",
    tone: "neutral",
  },
  {
    date: "31 March 2027",
    title: "Appoint a provider — everyone else",
    detail: "Deadline for smaller businesses and government entities.",
    tone: "neutral",
  },
  {
    date: "1 July 2027",
    title: "Mandatory for remaining businesses",
    detail: "Businesses below the AED 50 million threshold.",
    tone: "neutral",
  },
  {
    date: "1 October 2027",
    title: "Mandatory for government entities",
    detail: "Completes the phased rollout.",
    tone: "neutral",
  },
];

const PLANNED = [
  {
    icon: FileCode2,
    title: "PINT AE invoice format",
    text: "Invoices generated as structured XML in the UAE Peppol profile, alongside the PDF you send today.",
  },
  {
    icon: Network,
    title: "Delivery through an accredited provider",
    text: "Documents exchanged over the Peppol network via a Ministry-accredited service provider, with delivery status tracked per invoice.",
  },
  {
    icon: ShieldCheck,
    title: "Validation before sending",
    text: "Required fields, TRNs and VAT totals checked against the schema so an invoice is corrected before it is submitted, not after it is rejected.",
  },
];

const toneClass = (tone) =>
  tone === "warning"
    ? "bg-status-warning-soft text-status-warning"
    : "bg-secondary text-muted-foreground";

export default function EInvoicingComingSoon() {
  return (
    <div className="mx-auto max-w-5xl p-6 sm:p-8">
      <header className="mb-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-on-soft">
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          Coming soon
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">
          UAE e-Invoicing
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          The UAE is moving to mandatory electronic invoicing over the Peppol network. We are
          building this into the ERP now. It is not available yet, and nothing in the system
          submits invoices electronically today.
        </p>
      </header>

      <section className="mb-8" aria-labelledby="planned-heading">
        <h2 id="planned-heading" className="mb-3 text-lg font-bold tracking-tight text-foreground">
          What we are building
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANNED.map(({ icon, title, text }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-teal-soft text-accent-teal">
                {React.createElement(icon, { className: "h-[18px] w-[18px]", "aria-hidden": "true" })}
              </span>
              <h3 className="mt-3 font-bold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="mb-3 text-lg font-bold tracking-tight text-foreground">
          Mandate timeline
        </h2>
        <ol className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          {MILESTONES.map(({ date, title, detail, tone }, i) => (
            <li
              key={date}
              className={`flex flex-col gap-1 p-5 sm:flex-row sm:gap-5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span
                className={`inline-flex h-fit w-fit shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums sm:w-44 sm:justify-center ${toneClass(tone)}`}
              >
                {date}
              </span>
              <span>
                <span className="block font-bold text-foreground">{title}</span>
                <span className="block text-sm text-muted-foreground">{detail}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          Applies to B2B and B2G transactions. B2C is excluded until a later phase is
          announced. Dates reflect the Ministry of Finance programme as published in
          October 2026 and have been extended before — confirm against the current official
          guidance before relying on them.
        </p>
      </section>
    </div>
  );
}
