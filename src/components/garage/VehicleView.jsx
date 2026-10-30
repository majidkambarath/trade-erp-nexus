// A vehicle's own service history: every job it has had, newest first, and when it is next due. This is the
// whole reason a workshop buys software (CLAUDE.md garage plan, part 1.2 step 2) - it sells the next job and
// settles an argument about what was done before. Reached by opening a row on VehiclesPage; Edit opens the
// ordinary VehicleForm on top of it.
import React, { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { vehicles, filesFor } from "../../lib/garageApi";
import { JOB_STATUS, INVOICE_STATUS_LABEL } from "../../lib/garage";
import { formatDate } from "../../utils/format";
import { ErrorNote, Modal, Pill, Spinner, useAsync } from "../accounting/kit";
import VehicleForm from "./VehicleForm";
import JobCardView from "./JobCardView";
import AttachmentPanel from "../accounting/AttachmentPanel.jsx";

function money(n) {
  return (Number(n) || 0).toFixed(2);
}

// Whichever runs out first ends the warranty (utils/garage.js warrantyUntil); print both when both are set
// (D09: warranty km was shown nowhere on this screen, same as the gate pass before its own fix).
function warrantyNote(w) {
  const parts = [];
  if (w?.until) parts.push(`until ${formatDate(w.until)}`);
  if (w?.untilOdometer) parts.push(`${w.untilOdometer} km`);
  return parts.length ? `Warranty ${parts.join(" or ")}` : null;
}

export default function VehicleView({ id, onClose, onChanged }) {
  const one = useAsync(() => vehicles.get(id), [id]);
  const history = useAsync(() => vehicles.jobs(id), [id]);
  const [editing, setEditing] = useState(false);
  const [openJob, setOpenJob] = useState(null);
  const v = one.data;
  const jobs = Array.isArray(history.data) ? history.data : [];
  const closedJobs = jobs.filter((j) => j.delivery?.gatePassAt);
  const totalSpend = closedJobs.reduce((t, j) => t + (Number(j.estimate?.total) || 0), 0);
  // D18: the backend door (garageAttachmentService, /garage/vehicles/:id/attachments) already existed
  // with no screen that opened it - the registration card, an insurance policy, a photo of existing damage.
  const vehicleFiles = useMemo(() => (v?._id ? filesFor("vehicle", v._id) : null), [v?._id]);

  return (
    <Modal
      size="lg"
      onClose={onClose}
      title={v ? `${v.plateNumber || v.chassisNo}${v.plateEmirate ? ` (${v.plateEmirate})` : ""}` : "Vehicle"}
      description={v ? `${[v.make, v.model, v.variant].filter(Boolean).join(" ")}${v.year ? ` · ${v.year}` : ""}${v.colour ? ` · ${v.colour}` : ""}` : undefined}
      footer={<><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => setEditing(true)}>Edit</Button></>}
    >
      {one.loading && !v && <Spinner label="Loading the vehicle" />}
      {one.error && <ErrorNote error={one.error} onRetry={one.reload} />}
      {v && (
        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Owner</p>
              <p className="text-sm font-medium">{v.customerName || "–"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Odometer</p>
              <p className="text-sm font-medium">{v.odometer ? `${v.odometer} km` : "–"}{v.odometerAt ? <span className="ms-1 text-xs text-muted-foreground">({formatDate(v.odometerAt)})</span> : null}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Next service due</p>
              <p className="text-sm font-medium">
                {v.serviceDue?.dueDay ? formatDate(v.serviceDue.dueDay) : v.serviceDue?.dueOdometer ? `${v.serviceDue.dueOdometer} km` : "Not set"}
                {v.serviceDue?.dueDay && v.serviceDue?.dueOdometer ? ` or ${v.serviceDue.dueOdometer} km` : ""}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Visits</p>
              <p className="text-sm font-medium">{closedJobs.length}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total spend</p>
              <p className="text-sm font-medium">AED {money(totalSpend)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Registration expiry</p>
              <p className="text-sm font-medium">{v.registrationExpiry ? formatDate(v.registrationExpiry) : "–"}</p>
            </div>
          </div>

          {v.ownerHistory?.length > 1 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Past owners</h3>
              <ul className="grid gap-1 text-sm text-muted-foreground">
                {v.ownerHistory.slice(0, -1).map((h, i) => (
                  <li key={i}>{h.customerName} ({formatDate(h.from)}{h.to ? ` – ${formatDate(h.to)}` : ""})</li>
                ))}
              </ul>
            </section>
          )}

          {vehicleFiles && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Attachments</h3>
              <AttachmentPanel source={vehicleFiles} label="Vehicle documents" />
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold">Job history</h3>
            {history.loading && <Spinner label="Loading the job history" />}
            {history.error && <ErrorNote error={history.error} onRetry={history.reload} />}
            {!history.loading && jobs.length === 0 && <p className="text-sm text-muted-foreground">No job cards yet.</p>}
            {jobs.length > 0 && (
              <ul className="divide-y rounded-lg border text-sm">
                {jobs.map((j) => (
                  <li key={j._id} className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 hover:bg-secondary/50" onClick={() => setOpenJob(j._id)}>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{j.jobNo || "(draft)"}</span>
                      <span className="ms-2 text-xs text-muted-foreground">{j.receivedAt ? formatDate(j.receivedAt) : ""}</span>
                      {j.comebackOf && <span className="ms-2 rounded bg-secondary px-1.5 py-0.5 text-xs">Comeback</span>}
                      {warrantyNote(j.warranty) && <span className="ms-2 text-xs text-muted-foreground">· {warrantyNote(j.warranty)}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{money(j.estimate?.total)}</span>
                    <Pill tone={JOB_STATUS[j.status]?.tone || "neutral"}>{JOB_STATUS[j.status]?.label || j.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {editing && (
        <VehicleForm
          vehicle={v}
          onClose={() => setEditing(false)}
          onSaved={async (_r, m) => { setEditing(false); onChanged?.(m); await one.reload(); }}
        />
      )}
      {openJob && (
        <JobCardView
          id={openJob}
          onClose={() => setOpenJob(null)}
          onChanged={(m) => { onChanged?.(m); history.reload(); }}
          onRemoved={(m) => { setOpenJob(null); onChanged?.(m); history.reload(); }}
        />
      )}
    </Modal>
  );
}
