import React from "react";
import { useSearchParams } from "react-router-dom";
import { einvoice } from "../../lib/accountingApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ErrorNote, PageHeader, Pill, Spinner, useAsync, useToasts } from "../accounting/kit";
import EInvoiceDashboard from "./EInvoiceDashboard";
import Outbound from "./Outbound";
import Inbound from "./Inbound";
import Readiness from "./Readiness";
import EInvoiceSettings from "./EInvoiceSettings";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "outbound", label: "Outbound" },
  { id: "inbound", label: "Inbound" },
  { id: "readiness", label: "Readiness" },
  { id: "settings", label: "Settings" },
];

export default function EInvoicing() {
  const [params, setParams] = useSearchParams();
  const { notify, toastNode } = useToasts();
  const settings = useAsync(() => einvoice.settings(), []);
  const active = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "dashboard";

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader
        title="e-Invoicing"
        description="Check, send and track UAE electronic invoices, and review the ones your suppliers send you."
        actions={settings.data && <Pill tone="info">Sandbox only · live connection coming soon</Pill>}
      />
      {settings.loading && !settings.data && <Spinner />}
      {settings.error && <ErrorNote error={settings.error} onRetry={settings.reload} />}
      {settings.data && (
        <Tabs value={active} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
          <div className="overflow-x-auto"><TabsList>{TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList></div>
          <TabsContent value="dashboard">{active === "dashboard" && <EInvoiceDashboard settings={settings.data} />}</TabsContent>
          <TabsContent value="outbound">{active === "outbound" && <Outbound notify={notify} enabled={settings.data.enabled} />}</TabsContent>
          <TabsContent value="inbound">{active === "inbound" && <Inbound notify={notify} />}</TabsContent>
          <TabsContent value="readiness">{active === "readiness" && <Readiness notify={notify} />}</TabsContent>
          <TabsContent value="settings">{active === "settings" && <EInvoiceSettings settings={settings.data} notify={notify} onSaved={settings.reload} />}</TabsContent>
        </Tabs>
      )}
      {toastNode}
    </div>
  );
}
