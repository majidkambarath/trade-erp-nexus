import React from "react";
import { Pill } from "../accounting/kit";
import { daysLeftText, expirySummary, DOC_STATUS } from "../../lib/partyForms";

// A small flag for a customer or vendor list row when one of its documents has expired or is about
// to. Nothing is drawn when every document is in order (or there are none).
export default function ExpiryPill({ documents }) {
  const s = expirySummary(documents);
  if (!s) return null;
  const expired = s.status === DOC_STATUS.EXPIRED;
  const detail = `${s.typeName}: ${daysLeftText(s.daysLeft).toLowerCase()}${s.count > 1 ? ` (${s.count} documents need attention)` : ""}`;
  return (
    <span title={detail}>
      <Pill tone={expired ? "danger" : "warning"}>
        {expired ? "Document expired" : "Document expiring"}
        <span className="sr-only">. {detail}</span>
      </Pill>
    </span>
  );
}
