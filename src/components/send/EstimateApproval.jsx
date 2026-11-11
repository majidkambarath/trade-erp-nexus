import React, { useMemo, useState } from "react";
import { CheckCircle2, Circle, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { postEstimateDecision, sharePhotoUrl, ShareError } from "../../lib/shareApi";
import { CONDITION_LABEL, vehiclePlateText } from "../../lib/garage";
import { setOrgLocale } from "../../utils/orgLocale";
import { formatDate } from "../../utils/format";

// One plain sentence per refusal code this door can give (jobCardService.js recordCustomerDecision /
// utils/garage.js checkApproval). Kept local, not imported from SharedDocument.jsx's own problemText:
// that one is for a link that fails to OPEN at all, these are for a decision that is refused once it
// is open, and the two must never import each other.
const DECISION_PROBLEM = {
  NAME_REQUIRED: "Please enter your name first, so we have a record of who decided.",
  LINE_NOT_ON_ESTIMATE: "That item is no longer part of this estimate. Please reload the page.",
  NOTHING_APPROVED: "Check at least one item to approve, or use Decline instead.",
  JOB_NOT_AWAITING_APPROVAL: "This job is no longer waiting for a decision. Please speak to the workshop.",
  SHARE_RATE_LIMIT: "Too many attempts. Please wait a few minutes and try again.",
  OFFLINE: "Check your connection and try again.",
};
// The server's own words win when it sent any (it knows the real status, the real reason); the table
// above only covers what has no message of its own - a bare "OFFLINE", or a check made before the
// request even went out.
const decisionProblemText = (error) =>
  (error?.message && error.message !== error.code ? error.message : DECISION_PROBLEM[error?.code]) ||
  "Something went wrong. Please try again, or speak to the workshop.";

// The page a customer approves or declines an estimate from - no sign-in, nothing of ours but the car,
// what was found, and the decision. See SharedDocument.jsx's own note on why this cannot use the
// signed-in helpers (the company profile hook and the session both call the authenticated API).
//
// Design choice, matching how the backend actually works (jobCardService.recordCustomerDecision /
// utils/garage.js recordApproval): approving is PER LINE - a line left unchecked when "Approve" is
// pressed is declined, exactly as if the customer had crossed it out on a paper estimate - and
// declining is a single whole-estimate "no", with an optional note back to the advisor. There is no
// third state: the trade's own estimate is accepted whole far more often than it is picked apart, so
// every line starts checked.

const money = (n, currency) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "AED", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${currency || ""} ${v.toFixed(2)}`.trim();
  }
};

const KIND_LABEL = { part: "Part", labour: "Labour", sublet: "Sublet", consumable: "Consumable" };

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="shrink-0 rounded-full text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {checked ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <Circle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
    </button>
  );
}

function PhotoStrip({ token, photos }) {
  if (!photos?.length) return null;
  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
      {photos.map((id) => (
        <a key={id} href={sharePhotoUrl(token, id)} target="_blank" rel="noreferrer" className="shrink-0">
          <img src={sharePhotoUrl(token, id)} alt="" loading="lazy" className="h-20 w-20 rounded-lg border border-border object-cover" />
        </a>
      ))}
    </div>
  );
}

function Confirmation({ outcome, jobNo }) {
  const approved = outcome === "approved";
  return (
    <div role="status" className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <span className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${approved ? "bg-status-success-soft text-status-success" : "bg-secondary text-muted-foreground"}`}>
        {approved ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <XCircle className="h-6 w-6" aria-hidden="true" />}
      </span>
      <h1 className="mt-4 text-lg font-semibold text-foreground">{approved ? "Thank you - the workshop has been told" : "Your answer has been sent"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {approved
          ? `Work on job ${jobNo || "your vehicle"} can now go ahead. We will be in touch when it is ready.`
          : "The workshop will be in touch to discuss the estimate."}
      </p>
    </div>
  );
}

export default function EstimateApproval({ token, payload, expiresAt }) {
  // The sender's date format and calendar, not the visitor's - see SharedDocument.jsx.
  if (payload?.locale) setOrgLocale(payload.locale);
  const { job, totals, party, company } = payload;
  const lines = useMemo(() => job.lines || [], [job.lines]);
  const [checked, setChecked] = useState(() => new Set(lines.filter((l) => l.approved !== false).map((l) => l._id)));
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null); // { outcome, jobNo }

  const toggle = (id) => setChecked((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const selectedTotal = useMemo(() => lines.filter((l) => checked.has(l._id)).reduce((s, l) => s + (Number(l.lineTotal) || 0), 0), [lines, checked]);

  const submit = async (outcome) => {
    const who = name.trim();
    if (!who) { setError({ code: "NAME_REQUIRED" }); return; }
    setError(null);
    setBusy(outcome);
    try {
      const out = await postEstimateDecision(token, { outcome, name: who, note: note.trim() || undefined, lineIds: outcome === "approved" ? [...checked] : undefined });
      setDone({ outcome: out.outcome, jobNo: out.jobNo });
    } catch (e) {
      if (e instanceof ShareError) setError({ code: e.code, message: e.message });
      else setError({ code: "ERROR", message: "Something went wrong. Please try again." });
    } finally {
      setBusy("");
    }
  };

  if (done) return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="w-full max-w-md"><Confirmation outcome={done.outcome} jobNo={done.jobNo} /></div>
    </main>
  );

  const vehicleText = vehiclePlateText(job.vehicle) || [job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ");
  const carLine = [vehicleText, [job.vehicle?.make, job.vehicle?.model].filter(Boolean).join(" ")].filter((v, i, a) => v && a.indexOf(v) === i).join(" - ");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{company?.companyName || "Your workshop"}</p>
            <h1 className="truncate text-xs text-muted-foreground">Estimate for job {job.jobNo}{job.status === "IN_PROGRESS" ? " - a supplementary estimate" : ""}</h1>
          </div>
          {/* The estimate as it was sent, worked out server-side - a fixed reference point beside the
              "selected total" below, which moves as items are unchecked. */}
          {totals?.total != null && <span className="shrink-0 text-sm font-semibold text-foreground">{money(totals.total, payload.currency)}</span>}
        </div>
      </header>

      <main className="mx-auto max-w-[720px] space-y-4 px-4 py-5 sm:px-6">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">{carLine || "Your vehicle"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {party?.customerName ? `${party.customerName} · ` : ""}Received {job.receivedAt ? formatDate(job.receivedAt) : ""}
            {job.odometerIn ? ` · ${job.odometerIn.toLocaleString()} km` : ""}
          </p>
          {job.complaints?.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-foreground">
              {job.complaints.map((c) => <li key={c.seq ?? c.concern}>"{c.concern}"{c.cause ? ` - ${c.cause}` : ""}</li>)}
            </ul>
          )}
        </div>

        {job.inspection?.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground">What we found</h2>
            <ul className="mt-3 space-y-3">
              {job.inspection.map((i) => (
                <li key={i._id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{i.item}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${i.condition === "urgent" ? "bg-status-danger-soft text-status-danger" : i.condition === "advisory" ? "bg-status-warning-soft text-status-warning" : "bg-status-success-soft text-status-success"}`}>
                      {CONDITION_LABEL[i.condition] || i.condition}
                    </span>
                  </div>
                  {i.note && <p className="mt-1 text-sm text-muted-foreground">{i.note}</p>}
                  <PhotoStrip token={token} photos={i.photos} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">The estimate</h2>
          <p className="mt-1 text-xs text-muted-foreground">Tap an item to leave it off the job. Everything is checked to start.</p>
          <ul className="mt-3 divide-y divide-border">
            {lines.map((l) => (
              <li key={l._id} className="flex items-start gap-3 py-3">
                <Toggle checked={checked.has(l._id)} onChange={() => toggle(l._id)} label={l.description || KIND_LABEL[l.kind]} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{l.description || KIND_LABEL[l.kind] || "Item"}</p>
                  <p className="text-xs text-muted-foreground">{KIND_LABEL[l.kind] || l.kind}{l.qty > 1 ? ` · qty ${l.qty}` : ""}</p>
                </div>
                <span className="shrink-0 tabular-nums text-sm font-semibold text-foreground">{money(l.lineTotal, payload.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Selected total (incl. VAT)</span>
            <span className="text-base font-bold text-foreground">{money(selectedTotal, payload.currency)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="block text-sm font-medium text-foreground" htmlFor="estimate-name">Your name</label>
          <input
            id="estimate-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="So we have a record of who decided" maxLength={120}
            className="mt-1 h-11 w-full rounded-lg border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <label className="mt-3 block text-sm font-medium text-foreground" htmlFor="estimate-note">A note back to the workshop (optional)</label>
          <textarea
            id="estimate-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300}
            className="mt-1 w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          {error && <p role="alert" className="mt-3 rounded-lg bg-status-danger-soft px-3 py-2 text-sm font-semibold text-status-danger">{decisionProblemText(error)}</p>}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button" onClick={() => submit("approved")} disabled={Boolean(busy) || checked.size === 0}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary text-base font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {busy === "approved" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
              Approve {checked.size > 0 ? `${checked.size} of ${lines.length}` : ""}
            </button>
            <button
              type="button" onClick={() => submit("declined")} disabled={Boolean(busy)}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-input bg-card text-base font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {busy === "declined" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <XCircle className="h-5 w-5" aria-hidden="true" />}
              Decline
            </button>
          </div>
          {checked.size === 0 && <p className="mt-2 text-xs text-muted-foreground">Check at least one item to approve, or use Decline.</p>}
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Sent to you by {company?.companyName || "the workshop"}.{expiresAt ? ` This link works until ${formatDate(expiresAt)}.` : ""}
        </p>
      </main>
    </div>
  );
}
