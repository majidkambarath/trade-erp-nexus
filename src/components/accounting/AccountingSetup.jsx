import React from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { PageHeader, useToasts } from "./kit";
import PostingAccounts from "./setup/PostingAccounts";
import FiscalYears from "./setup/FiscalYears";
import TaxCodes from "./setup/TaxCodes";
import AuditLog from "./setup/AuditLog";

const TABS = [
  { id: "posting", label: "Posting accounts", Component: PostingAccounts },
  { id: "years", label: "Fiscal years", Component: FiscalYears },
  { id: "tax", label: "Tax codes", Component: TaxCodes },
  { id: "audit", label: "Audit log", Component: AuditLog },
];

// Accounting setup: where the books are configured. The selected tab lives in the URL
// (?tab=years), so a link or a refresh lands on the same panel.
export default function AccountingSetup() {
  const [params, setParams] = useSearchParams();
  const { notify, toastNode } = useToasts();
  // credit control, returns and the tax identity moved to Settings; old links still land
  if (params.get("tab") === "rules") return <Navigate to="/settings?tab=rules" replace />;
  const active = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "posting";

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Accounting setup" description="Decide which accounts each transaction posts to, which periods are open and how tax codes apply, and review every change." />
      <Tabs value={active} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="overflow-x-auto"><TabsList>{TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}</TabsList></div>
        {TABS.map((tab) => {
          const View = tab.Component;
          return (
            <TabsContent key={tab.id} value={tab.id}>{active === tab.id && <View notify={notify} />}</TabsContent>
          );
        })}
      </Tabs>
      {toastNode}
    </div>
  );
}
