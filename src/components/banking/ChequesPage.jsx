import React from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../accounting/kit";
import { PillTabs } from "../salesDocs/parts.jsx";
import ChequeRegister from "./ChequeRegister";
import { CashForecast, DueDates } from "./ChequeReports";

// The cheque register, what falls due and when, and what it does to the bank. The view is in the address
// (?view=due, ?view=forecast) so a report can be linked to; the register is the default and keeps its own address.
const VIEWS = [["register", "Register"], ["due", "Due dates"], ["forecast", "Cash forecast"]];
const DESCRIPTION = {
  register: "Cheques you have received and issued. They move to the bank account when they clear.",
  due: "Every cheque still in the air, and how soon it falls due.",
  forecast: "What your cheques will do to the bank, week by week.",
};

export default function ChequesPage() {
  const [params, setParams] = useSearchParams();
  const asked = params.get("view");
  const view = VIEWS.some(([v]) => v === asked) ? asked : "register";
  const choose = (v) => setParams(v === "register" ? {} : { view: v }, { replace: true });
  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Cheques" description={DESCRIPTION[view]} />
      <div className="mb-5"><PillTabs tabs={VIEWS} value={view} onChange={choose} label="Cheque views" /></div>
      {view === "register" && <ChequeRegister embedded />}
      {view === "due" && <DueDates />}
      {view === "forecast" && <CashForecast />}
    </div>
  );
}
