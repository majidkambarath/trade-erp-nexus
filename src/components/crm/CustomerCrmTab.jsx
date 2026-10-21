// The CRM tab on a customer's own page: what we are working on with them, and the story of the contact.
//
// It sits beside the existing Documents tab, which is the DOCUMENT story (quotation, order, delivery, invoice, paid).
// This is the RELATIONSHIP story. Neither replaces the other, and nothing here repeats the deal chain.
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Spinner, ErrorNote, EmptyState, useAsync, useToasts } from "../accounting/kit.jsx";
import Can from "../shell/Can.jsx";
import { formatCurrencyAED, formatDate } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { StagePill, Tag, ActivityTimeline, LogActivityDialog, useOwners } from "./crmShared.jsx";

export default function CustomerCrmTab({ customerId }) {
  const owners = useOwners();
  const { notify, toastNode } = useToasts();
  const [logging, setLogging] = useState(false);
  const [reload, setReload] = useState(0);
  const deals = useAsync(() => crm.deals({ customerId }), [customerId, reload]);
  // The people. The same records the Details tab's contact list shows - one person, stored under one id.
  const people = useAsync(() => crm.contacts({ customerId }), [customerId, reload]);
  const timeline = useAsync(() => crm.timeline({ customerId }), [customerId, reload]);
  const again = () => setReload((n) => n + 1);

  const rows = Array.isArray(deals.data) ? deals.data : [];
  const open = rows.filter((d) => d.status === "OPEN");

  const contacts = Array.isArray(people.data) ? people.data : [];

  return (
    <div className="grid gap-6">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Who we speak to</h3>
          <Link to="/crm/contacts" className="text-sm text-muted-foreground hover:underline">
            All contacts
          </Link>
        </div>
        {people.loading && !people.data && <Spinner label="Reading the people" />}
        {people.data && contacts.length === 0 && (
          <EmptyState title="Nobody named yet" text="Add a person on the Details tab, or on Contacts, and they appear here." />
        )}
        {contacts.length > 0 && (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {contacts.map((c) => (
              <li key={c._id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/crm/contacts?contact=${c._id}`} className="font-medium text-foreground hover:underline">
                    {c.name}
                  </Link>
                  {c.isPrimary && <Tag tone="info">Main</Tag>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[c.designation, c.phone, c.email].filter(Boolean).join(" · ") || "No details yet"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Deals</h3>
          <Can permission="crm.create">
            <button type="button" onClick={() => setLogging(true)} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
              Log a follow-up
            </button>
          </Can>
        </div>

        {deals.loading && !deals.data && <Spinner label="Reading the deals" />}
        {deals.error && <ErrorNote error={deals.error} onRetry={deals.reload} />}
        {deals.data && rows.length === 0 && <EmptyState title="No deals" text="Nothing is being worked on with this customer at the moment." />}

        {rows.length > 0 && (
          <>
            <p className="mt-2 text-xs text-muted-foreground">
              {open.length} open{open.length > 0 ? ` · ${formatCurrencyAED(open.reduce((t, d) => t + (d.value || 0), 0))}` : ""}
            </p>
            <ul className="mt-3 grid gap-2">
              {rows.map((deal) => (
                <li key={deal._id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/crm/pipeline?deal=${deal._id}`} className="text-sm font-medium text-foreground hover:underline">
                        {deal.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {deal.opportunityNo}
                        {deal.ownerName ? ` · ${deal.ownerName}` : ""}
                        {deal.expectedCloseDate ? ` · expected ${formatDate(deal.expectedCloseDate)}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums">{formatCurrencyAED(deal.value)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StagePill deal={deal} />
                    {deal.stale?.isStale && <Tag tone="warning">Quiet {deal.stale.days}d</Tag>}
                    {deal.nextActionAt && <Tag tone={deal.overdueAction ? "danger" : "default"}>{rules.nextActionText(deal, deal.nextActionAt)}</Tag>}
                    {deal.links?.quotationNo && <Tag>Quotation {deal.links.quotationNo}</Tag>}
                    {deal.links?.orderNo && <Tag>Invoice {deal.links.orderNo}</Tag>}
                    {deal.lostReason && <Tag tone="danger">{rules.lostLabel(deal.lostReason)}</Tag>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground">Contact</h3>
        {timeline.loading && !timeline.data && <Spinner label="Reading the contact" />}
        {timeline.error && <ErrorNote error={timeline.error} onRetry={timeline.reload} />}
        {timeline.data && <ActivityTimeline rows={timeline.data} empty="Nobody has recorded a call or a visit with this customer yet." />}
      </section>

      {logging && (
        <LogActivityDialog
          regarding={{ kind: "customer", id: customerId }}
          owners={owners}
          notify={notify}
          onClose={() => setLogging(false)}
          onSaved={() => {
            setLogging(false);
            again();
          }}
        />
      )}
      {toastNode}
    </div>
  );
}
