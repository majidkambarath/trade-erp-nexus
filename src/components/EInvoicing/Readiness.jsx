import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleAlert, Pencil } from "lucide-react";
import { einvoice } from "../../lib/accountingApi";
import { Button } from "../ui/button";
import { EmptyState, ErrorNote, Field, Modal, Panel, Pill, Spinner, TextInput, useAsync } from "../accounting/kit";

// Where to go to fix each company-level check.
const FIX = {
  trn: ["/accounting-setup?tab=rules", "Company profile"],
  legalName: ["/accounting-setup?tab=rules", "Company profile"],
  address: ["/accounting-setup?tab=rules", "Company profile"],
  taxCodes: ["/accounting-setup?tab=tax", "Tax codes"],
  participantId: ["/e-invoicing?tab=settings", "Settings"],
};

export default function Readiness({ notify, onChanged }) {
  const { data, loading, error, reload } = useAsync(() => einvoice.readiness(), []);
  const [editing, setEditing] = useState(null);
  if (loading && !data) return <Spinner label="Checking readiness" />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <Panel title="Your company" description="What an invoice needs about the seller.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {data.seller.map((c) => (
            <li key={c.key} className="flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm">
              {c.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-status-success" aria-label="Ready" /> : <CircleAlert className="h-4 w-4 shrink-0 text-status-warning" aria-label="Needs attention" />}
              <span className="min-w-0 flex-1">{c.label}</span>
              {!c.ok && FIX[c.key] && <Link to={FIX[c.key][0]} className="shrink-0 text-xs font-semibold underline underline-offset-2">Fix in {FIX[c.key][1]}</Link>}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel bodyClassName="p-0" title="Your customers" description="A VAT-registered customer in the UAE must have every detail below before an invoice can be sent to them. Customers without a TRN are not affected."
        actions={<Pill tone={data.parties.notReady.length ? "warning" : "success"}>{data.parties.ready} of {data.parties.total} ready</Pill>}>
        {data.parties.total === 0 && <EmptyState title="No VAT-registered customers" text="Add a customer's TRN to include them here." />}
        {data.parties.notReady.length > 0 && (
          <ul className="divide-y divide-border">
            {data.parties.notReady.map((p) => (
              <li key={p._id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{p.customerName}</span>
                  <span className="block text-xs text-status-warning">{[...p.missing.map((m) => `Missing ${m}`), ...p.problems].join(" · ")}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Complete details</Button>
              </li>
            ))}
          </ul>
        )}
        {data.parties.total > 0 && data.parties.notReady.length === 0 && <p className="px-5 py-6 text-sm text-muted-foreground">Every VAT-registered customer is ready.</p>}
      </Panel>
      {editing && <PartyModal party={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); notify(`${editing.customerName} updated`); reload(); onChanged?.(); }} />}
    </div>
  );
}

function PartyModal({ party, onClose, onSaved }) {
  const [f, setF] = useState({ trnNumber: "", billingAddress: "", city: "", countryCode: "AE", participantId: "" });
  const [errors, setErrors] = useState({});
  const [topError, setTopError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function submit(ev) {
    ev.preventDefault();
    const e = {};
    if (f.trnNumber && !/^\d{15}$/.test(f.trnNumber)) e.trnNumber = "A TRN is 15 digits";
    if (f.participantId && !/^\d+:\d+$/.test(f.participantId)) e.participantId = "Looks like 0235:100123456700003";
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = Object.fromEntries(Object.entries(f).filter(([, v]) => String(v).trim() !== ""));
    if (!Object.keys(body).length) return setTopError(new Error("Fill in at least one missing detail"));
    setBusy(true);
    try {
      await einvoice.fixParty(party._id, body);
      onSaved();
    } catch (err) {
      setTopError(err);
      setBusy(false);
    }
  }
  return (
    <Modal size="md" onClose={onClose} title={party.customerName} description={`Still needed: ${party.missing.join(", ") || "corrections"}. Leave a field empty to keep what is saved.`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="party-form" disabled={busy}>{busy ? "Saving…" : "Save details"}</Button></>}>
      <form id="party-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {topError && <div className="sm:col-span-2"><ErrorNote error={topError} /></div>}
        <Field label="VAT number (TRN)" error={errors.trnNumber}><TextInput inputMode="numeric" maxLength={15} value={f.trnNumber} onChange={set("trnNumber")} data-autofocus /></Field>
        <Field label="Participant ID" error={errors.participantId} hint="Their Peppol id."><TextInput value={f.participantId} onChange={set("participantId")} placeholder="0235:…" /></Field>
        <Field label="Address" className="sm:col-span-2"><TextInput value={f.billingAddress} onChange={set("billingAddress")} /></Field>
        <Field label="City"><TextInput value={f.city} onChange={set("city")} /></Field>
        <Field label="Country code" hint="Two letters, e.g. AE."><TextInput value={f.countryCode} onChange={(e) => setF((x) => ({ ...x, countryCode: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} /></Field>
      </form>
    </Modal>
  );
}
