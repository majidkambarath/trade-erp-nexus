// HRMS > Documents (/hr/documents): the organisation's own view of whose KYC is expired or expiring soon
// - the same classify()/STATUS reasoning the customer/vendor expiry report already uses, read here as a
// third kind (services/masters/documentExpiryService.js). Adding or removing a document for one person is
// done from their own page (People > an employee > Documents) - this screen is the register, not the form.
import React, { useState } from "react";
import { AlertTriangle, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Pill, Select, Spinner, ErrorNote, useAsync } from "../accounting/kit";
import { formatDate } from "../../utils/format";
import { employeeDocuments } from "../../lib/hrApi";

const WITHIN_OPTIONS = [7, 14, 30, 60, 90];

export default function DocumentsPage() {
  const [withinDays, setWithinDays] = useState(30);
  const report = useAsync(() => employeeDocuments.expiring({ withinDays }), [withinDays]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
          <p className="text-sm text-muted-foreground">Everyone's own labour card, visa or passport that is expired or due soon - an expired one blocks assigning that person new work.</p>
        </div>
        <Select value={withinDays} onChange={(e) => setWithinDays(Number(e.target.value))} className="w-44">
          {WITHIN_OPTIONS.map((d) => <option key={d} value={d}>Within {d} days</option>)}
        </Select>
      </div>

      {report.loading && <Spinner label="Reading the register" />}
      {report.error && <ErrorNote error={report.error} onRetry={report.reload} />}

      {report.data && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-status-danger/25 bg-status-danger-soft p-3"><p className="text-xs text-status-danger">Expired</p><p className="text-lg font-semibold text-status-danger">{report.data.summary.expired}</p></div>
            <div className="rounded-lg border border-status-warning/25 bg-status-warning-soft p-3"><p className="text-xs text-status-warning">Expiring soon</p><p className="text-lg font-semibold text-status-warning">{report.data.summary.expiringSoon}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-semibold text-foreground">{report.data.summary.total}</p></div>
          </div>

          {report.data.rows.length ? (
            <div className="grid gap-2">
              {report.data.rows.map((r) => (
                <Link key={r.documentId} to={`/hr/people/${r.partyId}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm hover:bg-secondary/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{r.partyName} · {r.documentType || "Document"}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.number ? `${r.number} · ` : ""}{r.expiryDate ? formatDate(r.expiryDate) : "No expiry"}</p>
                  </div>
                  <Pill tone={r.status === "EXPIRED" ? "danger" : "warning"}>{r.status === "EXPIRED" ? "Expired" : `${r.daysLeft} days left`}</Pill>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <FileText className="h-6 w-6" aria-hidden="true" />
              Nothing expired or expiring within {withinDays} days.
            </div>
          )}
        </>
      )}
    </div>
  );
}
