import React from "react";

// The UAE e-invoicing programme as published by the Ministry of Finance / FTA. Shown so the dates
// that matter are visible inside the product. Update when the programme changes.
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

const toneClass = (tone) =>
  tone === "warning"
    ? "bg-status-warning-soft text-status-warning"
    : "bg-secondary text-muted-foreground";

export default function MandateTimeline() {
  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading" className="mb-3 text-sm font-semibold text-foreground">UAE mandate timeline</h2>
      <ol className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {MILESTONES.map(({ date, title, detail, tone }, i) => (
          <li key={date} className={`flex flex-col gap-1 p-4 sm:flex-row sm:gap-5 ${i > 0 ? "border-t border-border" : ""}`}>
            <span className={`inline-flex h-fit w-fit shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums sm:w-44 sm:justify-center ${toneClass(tone)}`}>{date}</span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{title}</span>
              <span className="block text-sm text-muted-foreground">{detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        Applies to B2B and B2G transactions. B2C is excluded until a later phase is announced. Dates reflect the Ministry of
        Finance programme as published in October 2026 and have been extended before: confirm against the current official guidance.
      </p>
    </section>
  );
}
