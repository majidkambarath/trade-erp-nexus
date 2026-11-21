import React from "react";
import { useLocation } from "react-router-dom";
import { einvoice } from "../../lib/accountingApi";
import { ErrorNote, PageHeader, Pill, Spinner, useAsync, useToasts } from "../accounting/kit";
import EInvoiceDashboard from "./EInvoiceDashboard";
import Outbound from "./Outbound";
import Inbound from "./Inbound";
import Readiness from "./Readiness";
import EInvoiceSettings from "./EInvoiceSettings";

// The five sections are the module's own tabs in the header (config/navigation.js), one path each, so this page draws only the one
// the address names.
const SECTIONS = ["dashboard", "outbound", "inbound", "readiness", "settings"];
const TITLES = {
  dashboard: "Track what was sent, what needs you, and what suppliers sent you.",
  outbound: "Send approved sales invoices and credit notes, and follow each one.",
  inbound: "Review the invoices your suppliers sent, and record them as purchases.",
  readiness: "What a business and its customers still need before an invoice can go.",
  settings: "Connect the e-invoicing provider and set how sending behaves.",
};

export default function EInvoicing() {
  const { pathname } = useLocation();
  const { notify, toastNode } = useToasts();
  const settings = useAsync(() => einvoice.settings(), []);
  const last = pathname.replace(/\/+$/, "").split("/").pop();
  const active = SECTIONS.includes(last) ? last : "dashboard";

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="e-Invoicing"
        description={TITLES[active]}
        actions={settings.data && (settings.data.connected ? <Pill tone={settings.data.environment === "live" ? "success" : "info"}>Wafeq · {settings.data.environment === "live" ? "live" : "test mode"}</Pill> : <Pill tone="info">Built-in sandbox · connect Wafeq in Settings</Pill>)}
      />
      {settings.loading && !settings.data && <Spinner />}
      {settings.error && <ErrorNote error={settings.error} onRetry={settings.reload} />}
      {settings.data && (
        <div className="mt-2">
          {active === "dashboard" && <EInvoiceDashboard settings={settings.data} />}
          {active === "outbound" && <Outbound notify={notify} enabled={settings.data.enabled} />}
          {active === "inbound" && <Inbound notify={notify} />}
          {active === "readiness" && <Readiness notify={notify} />}
          {active === "settings" && <EInvoiceSettings settings={settings.data} notify={notify} onSaved={settings.reload} />}
        </div>
      )}
      {toastNode}
    </div>
  );
}
