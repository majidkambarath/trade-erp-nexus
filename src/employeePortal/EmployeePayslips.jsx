import React, { useEffect, useState } from "react";
import { employeeApi, employeeError } from "./employeeApi";

export default function EmployeePayslips() {
  const [slips, setSlips] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    employeeApi.payslips().then(setSlips).catch((err) => setError(employeeError(err)));
  }, []);

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-semibold text-foreground">Payslips</h1>
      {error && <p role="alert" className="mb-4 rounded-lg border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{error}</p>}
      {slips === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : slips.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing paid yet.</p>
      ) : (
        <div className="grid gap-2">
          {slips.map((s) => (
            <div key={s._id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{s.period}</p>
                <p className="text-sm font-semibold text-foreground">{s.netPay?.toFixed(2)}</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Gross {s.grossPay?.toFixed(2)} · Deductions {s.totalDeductions?.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
