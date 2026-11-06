// HRMS > Overview: the real figure wave 1 has to offer, and nothing invented to fill the rest of the page.
// Attendance, leave and payroll have no dashboard tiles here because none of them exist yet - an empty card
// standing in for a module nobody built is exactly the "form that saves nothing" CLAUDE.md's own convention
// refuses, just at the scale of a whole page instead of one control.
import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Users } from "lucide-react";
import StatCard from "../ui/stat-card";
import { ErrorNote, Pill, Spinner, useAsync } from "../accounting/kit";
import { coverage } from "../../lib/hrApi";

export default function OverviewPage() {
  const data = useAsync(() => coverage(), []);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-semibold text-foreground">Overview</h1>
      <p className="mb-6 text-sm text-muted-foreground">What the organisation employs, and whether each person can be costed yet.</p>

      {data.loading && <Spinner />}
      {data.error && <ErrorNote error={data.error} onRetry={data.reload} />}

      {!data.loading && !data.error && data.data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={Users} title="Active employees" count={data.data.employees} />
            <StatCard icon={Users} title="Have a cost rate" count={data.data.costed} />
            <StatCard icon={AlertTriangle} title="Missing a cost rate" count={data.data.missing.length} tone={data.data.missing.length ? "warning" : undefined} />
          </div>

          {data.data.missing.length > 0 && (
            <div className="mt-6 rounded-xl border border-border p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Cannot be costed yet</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Their work will not be included in a product's cost or a job's labour margin until a contract
                gives them a cost rate.
              </p>
              <div className="grid gap-2">
                {data.data.missing.map((m) => (
                  <Link
                    key={m._id}
                    to={`/hr/people/${m._id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm hover:bg-muted/40"
                  >
                    <span className="font-medium text-foreground">{m.name}</span>
                    <span className="text-muted-foreground">{m.designation}{m.staffId ? ` · ${m.staffId}` : ""}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
