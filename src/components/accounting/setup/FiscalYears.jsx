import React, { useState } from "react";
import { Lock, LockOpen, Plus } from "lucide-react";
import { accounting } from "../../../lib/accountingApi";
import { formatDateGB, toInputDate } from "../../../utils/format";
import { Button } from "../../ui/button";
import { ConfirmDialog, DataTable, DateInput, EmptyState, errorMessage, ErrorNote, Field, Modal, Panel, Pill, Spinner, TextInput, useAsync } from "../kit";

export default function FiscalYears({ notify }) {
  const years = useAsync(() => accounting.fiscalYears(), []);
  const series = useAsync(() => accounting.numberSeries(), []);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(null); // { year, action }
  const [busy, setBusy] = useState(false);

  async function change() {
    setBusy(true);
    try {
      await (confirm.action === "close" ? accounting.closeFiscalYear(confirm.year._id) : accounting.reopenFiscalYear(confirm.year._id));
      notify(`${confirm.year.code} ${confirm.action === "close" ? "closed" : "reopened"}`);
      setConfirm(null);
      years.reload();
    } catch (e) {
      setConfirm(null);
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Fiscal years"
        description="Nothing can be created, approved or deleted in a closed year. While no fiscal year is defined, posting is not restricted."
        bodyClassName="p-0"
        actions={<Button size="sm" onClick={() => setModal(true)}><Plus className="h-4 w-4" aria-hidden="true" />New fiscal year</Button>}
      >
        {years.loading && !years.data && <Spinner />}
        {years.error && <div className="p-5"><ErrorNote error={years.error} onRetry={years.reload} /></div>}
        {years.data?.length === 0 && <EmptyState title="No fiscal years" text="Add the current year to start controlling which periods are open." />}
        {years.data?.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-2 text-start">Year</th><th className="px-3 py-2 text-start">From</th><th className="px-3 py-2 text-start">To</th><th className="px-3 py-2 text-start">Status</th><th className="px-5 py-2 text-end">Action</th></tr>
            </thead>
            <tbody>
              {years.data.map((y) => (
                <tr key={y._id} className="border-t border-border">
                  <td className="px-5 py-3 font-semibold">{y.code}</td>
                  <td className="px-3 py-3">{formatDateGB(y.startDate)}</td>
                  <td className="px-3 py-3">{formatDateGB(y.endDate)}</td>
                  <td className="px-3 py-3">{y.status === "closed" ? <Pill tone="danger"><Lock className="h-3 w-3" aria-hidden="true" />Closed</Pill> : <Pill tone="success">Open</Pill>}</td>
                  <td className="px-5 py-3 text-end">
                    {y.status === "closed"
                      ? <Button size="sm" variant="outline" onClick={() => setConfirm({ year: y, action: "reopen" })}><LockOpen className="h-3.5 w-3.5" aria-hidden="true" />Reopen</Button>
                      : <Button size="sm" variant="outline" onClick={() => setConfirm({ year: y, action: "close" })}><Lock className="h-3.5 w-3.5" aria-hidden="true" />Close year</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <ConfirmDialog
          title={confirm.action === "close" ? `Close ${confirm.year.code}?` : `Reopen ${confirm.year.code}?`} busy={busy}
          danger={confirm.action === "close"} confirmLabel={confirm.action === "close" ? "Close year" : "Reopen year"}
          text={confirm.action === "close"
            ? "No order or voucher dated in this year can be created, approved, edited, deleted or reversed until it is reopened. Costs of earlier sales are never restated."
            : "Documents dated in this year can be changed again. The reopening is recorded in the audit log."}
          onConfirm={change} onClose={() => setConfirm(null)}
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
