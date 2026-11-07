// HRMS > Assets (/hr/assets): the organisation-wide register of what is in whose hands. Issuing and
// returning one asset is done from the employee's own page (People > an employee > Assets) - this screen
// is the register, like Documents is for the expiry report.
import React, { useState } from "react";
import { Package } from "lucide-react";
import { Link } from "react-router-dom";
import { Select, Spinner, ErrorNote, Pill, useAsync } from "../accounting/kit";
import { formatDate } from "../../utils/format";
import { assets } from "../../lib/hrApi";

export default function AssetsPage() {
  const [status, setStatus] = useState("withEmployee");
  const list = useAsync(() => assets.list({ status: status || undefined }), [status]);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Assets</h1>
          <p className="text-sm text-muted-foreground">What was issued to whom, and when it came back. Never a stock movement - this is not the Inventory module.</p>
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
          <option value="withEmployee">With an employee</option>
          <option value="returned">Returned</option>
          <option value="">Everything</option>
        </Select>
      </div>

      {list.loading && <Spinner label="Reading the register" />}
      {list.error && <ErrorNote error={list.error} onRetry={list.reload} />}

      {!list.loading && !list.error && (
        (list.data || []).length ? (
          <div className="grid gap-2">
            {list.data.map((a) => (
              <div key={a._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{a.assetName}{a.assetTag ? ` · ${a.assetTag}` : ""}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <Link to={`/hr/people/${a.staffId}`} className="font-medium text-foreground hover:underline">{a.staffName || "Unknown employee"}</Link>
                    {" · "}Issued {formatDate(a.issuedDate)}{a.returnedDate ? ` · returned ${formatDate(a.returnedDate)}` : ""}
                  </p>
                </div>
                <Pill tone={a.returnedDate ? "neutral" : "success"}>{a.returnedDate ? "Returned" : "With employee"}</Pill>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <Package className="h-6 w-6" aria-hidden="true" />
            Nothing here. Issue an asset from an employee's own page.
          </div>
        )
      )}
    </div>
  );
}
