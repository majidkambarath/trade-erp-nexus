import React, { useState } from "react";
import { Lock, LockOpen, Plus } from "lucide-react";
import { accounting } from "../../../lib/accountingApi";
import { closedNote } from "../../../lib/yearEnd";
import { formatDateGB, toInputDate } from "../../../utils/format";
import { Button } from "../../ui/button";
import Can from "../../shell/Can";
import { useOrganisation } from "../../shell/OrganisationContext";
import { DataTable, DateInput, EmptyState, ErrorNote, Field, Modal, Panel, Pill, Spinner, TextInput, useAsync } from "../kit";
import YearEndDialog from "./YearEndDialog";

export default function FiscalYears({ notify }) {
  // Adding a year is accounts.manage; closing or reopening one is its own permission, accounts.close.
  const { canAny } = useOrganisation();
  const canManage = canAny("accounts.manage");
  const canClose = canAny("accounts.close");
  const years = useAsync(() => accounting.fiscalYears(), []);
  const series = useAsync(() => accounting.numberSeries(), []);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(null); // { year, action }: the year-end dialog, which reads what closing would do first

  return (
    <div className="space-y-5">
      <Panel
        title="Fiscal years"
        description="Closing a year moves its profit to Retained Earnings and locks it: nothing can be created, approved or deleted in a closed year. While no fiscal year is defined, posting is not restricted."
        bodyClassName="p-0"
        actions={<Can permission="accounts.manage"><Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" aria-hidden="true" />New fiscal year</Button></Can>}
      >
        {years.loading && !years.data && <Spinner />}
        {years.error && <div className="p-5"><ErrorNote error={years.error} onRetry={years.reload} /></div>}
        {years.data?.length === 0 && <EmptyState title="No fiscal years" text={canManage ? "Add the current year to start controlling which periods are open." : "No fiscal year has been defined yet, so posting is not restricted by period."} />}
        {years.data?.length > 0 && (
          <DataTable
            caption="Fiscal years"
            rows={years.data}
            rowKey={(y) => y._id}
            columns={[
              { key: "year", header: "Year", card: "primary", className: "font-semibold", cell: (y) => y.code },
              { key: "from", header: "From", card: "meta", className: "whitespace-nowrap", cell: (y) => formatDateGB(y.startDate) },
              { key: "to", header: "To", card: "meta", className: "whitespace-nowrap", cell: (y) => formatDateGB(y.endDate) },
              { key: "status", header: "Status", card: "badge", cell: (y) => (y.status === "closed" ? <Pill tone="danger"><Lock className="h-3 w-3" aria-hidden="true" />Closed</Pill> : <Pill tone="success">Open</Pill>) },
              // no card hint: on a phone it is a labelled line that wraps (the sentence is the point), and an open year has none
              { key: "closed", header: "How it was closed", label: "How it was closed", className: "max-w-xs text-muted-foreground", cell: (y) => closedNote(y) },
              // closing and reopening a year need accounts.close; without it the column is not drawn at all
              ...(canClose ? [{
                key: "action", header: "Action", align: "end", card: "actions",
                cell: (y) => (y.status === "closed"
                  ? <Button size="sm" variant="outline" onClick={() => setConfirm({ year: y, action: "reopen" })}><LockOpen className="h-3.5 w-3.5" aria-hidden="true" />Reopen</Button>
                  : <Button size="sm" variant="outline" onClick={() => setConfirm({ year: y, action: "close" })}><Lock className="h-3.5 w-3.5" aria-hidden="true" />Close year</Button>),
              }] : []),
            ]}
          />
        )}
      </Panel>

      <Panel title="Document numbering" description="One counter per series and year. Numbers are never reused: a gap means a number was issued and its document did not complete." bodyClassName="p-0">
        {series.data?.length === 0 && <EmptyState title="No numbers issued yet" text="A series appears here the first time a document of that kind is created." />}
        {series.data?.length > 0 && (
          <DataTable
            caption="Number series"
            rows={series.data}
            rowKey={(s) => s._id}
            columns={[
              { key: "series", header: "Series", card: "primary", className: "font-semibold", cell: (s) => s.series },
              { key: "year", header: "Year", card: "meta", cell: (s) => s.fiscalYear },
              { key: "prefix", header: "Prefix", card: "title", className: "font-mono text-xs", cell: (s) => s.prefix },
              { key: "next", header: "Last number issued", align: "end", card: "amount", className: "tabular-nums", cell: (s) => s.next },
            ]}
          />
        )}
      </Panel>

      {modal && <YearModal onClose={() => setModal(false)} onSaved={(code) => { setModal(false); notify(`Fiscal year ${code} added`); years.reload(); }} />}
      {confirm && (
        <YearEndDialog
          year={confirm.year} mode={confirm.action} onClose={() => setConfirm(null)}
          onDone={(message) => { setConfirm(null); notify(message); years.reload(); }}
        />
      )}
    </div>
  );
}

function YearModal({ onClose, onSaved }) {
  const y = new Date().getFullYear();
  const [form, setForm] = useState({ code: String(y), startDate: `${y}-01-01`, endDate: `${y}-12-31` });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(ev) {
    ev.preventDefault();
    if (!form.code.trim() || !form.startDate || !form.endDate) return setError(new Error("Fill in the name and both dates"));
    if (form.endDate <= form.startDate) return setError(new Error("The end date must be after the start date"));
    setBusy(true);
    try {
      await accounting.createFiscalYear({ code: form.code.trim(), startDate: form.startDate, endDate: form.endDate });
      onSaved(form.code);
    } catch (e) {
      setError(e.code === "DATE_OVERLAP" ? new Error(`${e.message}. Years cannot overlap.`) : e);
      setBusy(false);
    }
  }
  return (
    <Modal size="sm" title="New fiscal year" onClose={onClose}
      footer={<><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="fy-form" disabled={busy}>{busy ? "Saving…" : "Add year"}</Button></>}>
      <form id="fy-form" onSubmit={submit} noValidate className="grid gap-4">
        <ErrorNote error={error} />
        <Field label="Name" required hint="Shown in document numbers, e.g. SO-2026-0001."><TextInput value={form.code} onChange={set("code")} maxLength={20} data-autofocus /></Field>
        <Field label="Starts" required><DateInput value={form.startDate} onChange={set("startDate")} /></Field>
        <Field label="Ends" required><DateInput value={form.endDate} onChange={set("endDate")} min={toInputDate(form.startDate)} /></Field>
      </form>
    </Modal>
  );
}
