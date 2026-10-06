import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "../../ui/button";
import { DateInput, Field, Pill, Select, Spinner, TextInput, useAsync } from "../../accounting/kit";
import { ActionModal, Note } from "../../salesDocs/parts";
import { reconcile } from "../../../lib/bankReconcileApi";
import { readStatementFile } from "../../../lib/statementFile";
import { AMOUNT_MODES, DATE_ORDERS, columnOptions, formFromMapping, mappingFromForm, mappingReady } from "../../../lib/bankReconcile";
import { formatNumber, todayInput } from "../../../utils/format";
import { Amount, Day } from "./parts";

// Bringing a bank statement in. The file is read here (CSV, Excel or MT940) and sent to the server,
// which does the real reading, so the preview below is exactly what an import will do: how many lines,
// how many are already there, whether the running balance chains, and what could not be read. The
// column layout is remembered per account, so the second month is one click.

const ACCEPT = ".csv,.xlsx,.xls,.txt,.sta,.mt940";
const cents = (n) => Math.round((Number(n) || 0) * 100);

export default function ImportDialog({ account, onClose, onDone }) {
  const [source, setSource] = useState(null); // { kind, rows | text, fileName }
  const [form, setForm] = useState(null); // the person's choice of columns (a grid only)
  const [preview, setPreview] = useState(null);
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [setup, setSetup] = useState({ startDay: "", opening: "" });
  const [skipBad, setSkipBad] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const input = useRef(null);
  const checkId = useRef(0);

  // the preview for the current source and mapping; the latest request wins
  const check = useCallback(async (src, mapping) => {
    const id = ++checkId.current;
    setReading(true);
    setProblem(null);
    try {
      const body = { accountId: account._id, fileName: src.fileName, ...(src.kind === "mt940" ? { mt940: src.text } : { rows: src.rows, ...(mapping ? { mapping } : {}) }) };
      const p = await reconcile.previewImport(body);
      if (id !== checkId.current) return null;
      setPreview(p);
      return p;
    } catch (e) {
      if (id === checkId.current) { setPreview(null); setProblem(e); }
      return null;
    } finally {
      if (id === checkId.current) setReading(false);
    }
  }, [account._id]);

  const onFile = async (file) => {
    if (!file) return;
    setProblem(null);
    setPreview(null);
    setReading(true);
    try {
      const src = await readStatementFile(file);
      setSource(src);
      let p = null;
      let saved = null;
      if (src.kind === "grid") {
        // the layout used last time, if this file reads with it; otherwise the server's own guess
        saved = await reconcile.profile(account._id).catch(() => null);
        if (saved) p = await check(src, saved);
        if (!p || p.counts.total === 0 || p.issueCount > p.counts.total / 2) p = await check(src, null);
      } else {
        p = await check(src, null);
      }
      if (p?.mapping) setForm(formFromMapping(p.mapping));
      else setForm(null);
      if (p && !p.setup.exists) setSetup({ startDay: p.setup.suggestedStart || "", opening: p.setup.suggestedOpening === null || p.setup.suggestedOpening === undefined ? "" : String(p.setup.suggestedOpening) });
      setMapOpen(Boolean(p && (!p.guess?.complete || p.issueCount > 0 || p.counts.total === 0)));
    } catch (e) {
      setProblem(e);
      setReading(false);
    }
  };

  // changing a column choice re-reads the file
  const timer = useRef(null);
  const change = (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    clearTimeout(timer.current);
    if (source?.kind === "grid" && mappingReady(next)) timer.current = setTimeout(() => check(source, mappingFromForm(next)), 450);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const needsSetup = preview && !preview.setup.exists;
  const setupBooks = useAsync(() => (needsSetup && /^\d{4}-\d{2}-\d{2}$/.test(setup.startDay) ? reconcile.setupPreview(account._id, setup.startDay) : Promise.resolve(null)), [needsSetup, setup.startDay, account._id]);
  const opening = setup.opening !== "" && Number.isFinite(Number(setup.opening));
  const openingGap = setupBooks.data && opening ? (cents(setupBooks.data.bookBalanceBefore) - cents(setup.opening)) / 100 : null;

  const importable = preview && preview.counts.new > 0 && (preview.issueCount === 0 || skipBad)
    && (!needsSetup || (/^\d{4}-\d{2}-\d{2}$/.test(setup.startDay) && opening)) && !(preview.setup.exists && preview.setup.beforeStart > 0);

  const run = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const body = {
        accountId: account._id, fileName: source.fileName, skipBadRows: skipBad,
        ...(source.kind === "mt940" ? { mt940: source.text } : { rows: source.rows, mapping: preview.mapping }),
        ...(needsSetup ? { setup: { startDay: setup.startDay, statementOpening: Number(setup.opening) } } : {}),
      };
      const out = await reconcile.importStatement(body);
      onDone(`${out.imported} line${out.imported === 1 ? "" : "s"} imported${out.duplicates ? `, ${out.duplicates} were already there` : ""}`, out);
    } catch (e) {
      setProblem(e);
      setBusy(false);
    }
  };

  const opts = form && source?.kind === "grid" ? columnOptions(source.rows, Number(form.headerRow)) : [];
  const colSelect = (label, key, { required = false } = {}) => (
    <Field label={label} required={required}>
      <Select value={form[key]} onChange={(e) => change({ [key]: e.target.value })}>
        <option value="">{required ? "Choose…" : "None"}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </Field>
  );

  return (
    <ActionModal
      size="xl" title={`Import a statement into ${account.accountName}`} confirmLabel={preview ? `Import ${preview.counts.new} line${preview.counts.new === 1 ? "" : "s"}` : "Import"}
      busy={busy} disabled={!importable} problem={problem} onClose={onClose} onConfirm={run}
      description="Download the statement from your bank's online banking as CSV or Excel (or MT940), and choose it here."
    >
      <div>
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label="Statement file" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" onClick={() => input.current?.click()}><FileUp className="h-4 w-4" aria-hidden="true" />{source ? "Choose a different file" : "Choose the statement file"}</Button>
        {source && <span className="ms-3 text-sm text-muted-foreground">{source.fileName}</span>}
        {!source && <p className="mt-2 text-xs text-muted-foreground">CSV, Excel (.xlsx, .xls) and MT940 (.sta) files are read. PDF statements cannot be read: ask the bank for CSV or Excel.</p>}
      </div>

      {reading && <Spinner label="Reading the statement" />}

      {preview && (
        <>
          <section aria-label="What will be imported" className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">
              {preview.counts.total} line{preview.counts.total === 1 ? "" : "s"}{preview.periodFrom ? <> from <Day value={preview.periodFrom} /> to <Day value={preview.periodTo} /></> : ""}
            </p>
            <p className="mt-1 text-muted-foreground">
              {preview.counts.new} new{preview.counts.duplicates ? `, ${preview.counts.duplicates} already imported` : ""}
              {preview.opening !== null && preview.opening !== undefined ? ` · opening balance ${formatNumber(preview.opening, 2)}` : ""}
              {preview.closing !== null && preview.closing !== undefined ? ` · closing balance ${formatNumber(preview.closing, 2)}` : ""}
            </p>
          </section>

          {preview.fileDuplicate && <Note tone="warning">This exact file was imported before. Lines already in are skipped, so importing it again changes nothing.</Note>}
          {preview.continuity.checked && !preview.continuity.ok && (
            <Note tone="warning">The running balance does not follow from the amounts at {preview.continuity.breaks.length} place{preview.continuity.breaks.length === 1 ? "" : "s"}, first at row {preview.continuity.breaks[0].lineNo} (expected {formatNumber(preview.continuity.breaks[0].expected, 2)}, the file says {formatNumber(preview.continuity.breaks[0].found, 2)}). Lines may be missing, or a column may be read the wrong way round.</Note>
          )}
          {preview.gap && <Note tone="warning">This file starts {formatNumber(Math.abs(preview.gap.difference), 2)} {preview.gap.difference > 0 ? "above" : "below"} where the last import ended ({formatNumber(preview.gap.expected, 2)}). A day may be missing between the two files.</Note>}
          {preview.setup.exists && preview.setup.beforeStart > 0 && <Note tone="danger">{preview.setup.beforeStart} line{preview.setup.beforeStart === 1 ? " is" : "s are"} dated before the start day {preview.setup.startDay}. Remove them from the file, or set the account up from an earlier day.</Note>}
          {preview.counts.total === 0 && <Note tone="warning">No lines could be read. Check the column choices below.</Note>}
          {preview.issueCount > 0 && (
            <div>
              <Note tone="warning">{preview.issueCount} row{preview.issueCount === 1 ? "" : "s"} could not be read:</Note>
              <ul className="mt-2 list-disc ps-8 text-xs text-muted-foreground">
                {preview.issues.slice(0, 5).map((i) => <li key={`${i.lineNo}-${i.message}`}>Row {i.lineNo}: {i.message}</li>)}
              </ul>
              <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={skipBad} onChange={(e) => setSkipBad(e.target.checked)} />Import the rest and skip these rows</label>
            </div>
          )}

          {needsSetup && (
            <section aria-label="Where this statement starts" className="space-y-3 rounded-lg border border-border p-3">
              <h3 className="text-sm font-semibold">This is the first statement for this account</h3>
              <p className="text-sm text-muted-foreground">Say where it starts. The books before that day are taken as already reconciled.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Statement starts on" required><DateInput value={setup.startDay} max={todayInput()} onChange={(e) => setSetup({ ...setup, startDay: e.target.value })} /></Field>
                <Field label="Bank's balance the day before" required hint={preview.opening !== null && preview.opening !== undefined ? "Worked out from the file's first balance." : "From the old statement."}>
                  <TextInput inputMode="decimal" value={setup.opening} onChange={(e) => setSetup({ ...setup, opening: e.target.value.replace(/[^0-9.-]/g, "") })} placeholder="0.00" />
                </Field>
              </div>
              {setupBooks.data && openingGap !== null && (
                openingGap === 0
                  ? <p className="text-sm text-status-success">The books show the same balance that day.</p>
                  : <Note tone="warning">The books show {formatNumber(setupBooks.data.bookBalanceBefore, 2)} that day, {formatNumber(Math.abs(openingGap), 2)} {openingGap > 0 ? "more" : "less"} than the bank. If cheques or deposits were still outstanding then, say which in Set up after importing.</Note>
              )}
            </section>
          )}

          {source?.kind === "grid" && form && (
            <details className="rounded-lg border border-border" open={mapOpen} onToggle={(e) => setMapOpen(e.currentTarget.open)}>
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">How the columns were read {preview.guess?.complete ? "" : <Pill tone="warning" className="ms-2">Needs a look</Pill>}</summary>
              <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
                <Field label="Headings are on row" hint="0 means no heading row">
                  <Select value={form.headerRow} onChange={(e) => change({ headerRow: e.target.value })}>
                    <option value="-1">No heading row</option>
                    {Array.from({ length: Math.min(source.rows.length, 20) }, (_, i) => <option key={i} value={i}>Row {i + 1}</option>)}
                  </Select>
                </Field>
                <Field label="Dates are written">
                  <Select value={form.dateFormat} onChange={(e) => change({ dateFormat: e.target.value })}>{DATE_ORDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                </Field>
                {colSelect("Date", "date", { required: true })}
                <Field label="Description" hint="What the bank wrote about each line">
                  <Select value={form.description[0] ?? ""} onChange={(e) => change({ description: [e.target.value, form.description[1]].filter((v) => v !== undefined && v !== "") })}>
                    <option value="">None</option>
                    {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
                <Field label="More description (optional)" hint="If the text runs over two columns">
                  <Select value={form.description[1] ?? ""} onChange={(e) => change({ description: [form.description[0], e.target.value].filter((v) => v !== undefined && v !== "") })}>
                    <option value="">None</option>
                    {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
                <Field label="Amounts are shown as">
                  <Select value={form.amountMode} onChange={(e) => change({ amountMode: e.target.value })}>{AMOUNT_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                </Field>
                {form.amountMode === "split" ? (
                  <>
                    {colSelect("Debit column (money out)", "debit")}
                    {colSelect("Credit column (money in)", "credit")}
                  </>
                ) : (
                  <>
                    {colSelect("Amount column", "amount", { required: true })}
                    {form.amountMode === "drcr" && colSelect("Dr/Cr column", "flag", { required: true })}
                    <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={form.invert} onChange={(e) => change({ invert: e.target.checked })} />Turn the signs round (a credit-card statement shows payments in as negative)</label>
                  </>
                )}
                {colSelect("Balance column", "balance")}
                {colSelect("Reference column", "reference")}
                {colSelect("Cheque number column", "cheque")}
                {colSelect("Value date column", "valueDate")}
              </div>
            </details>
          )}

          {preview.lines.length > 0 && (
            <section aria-label="First lines of the statement">
              <h3 className="mb-2 text-sm font-semibold">First lines <span className="font-normal text-muted-foreground">(money in is +, money out is -)</span></h3>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {preview.lines.slice(0, 8).map((l) => (
                  <li key={l.lineNo} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0"><span className="block text-xs text-muted-foreground"><Day value={l.day} />{l.duplicate ? " · already imported" : ""}</span><span className="block truncate">{l.description || "(no description)"}</span></span>
                    <Amount value={l.amount} />
                  </li>
                ))}
              </ul>
              {preview.counts.total > 8 && <p className="mt-1 text-xs text-muted-foreground">and {preview.counts.total - 8} more</p>}
            </section>
          )}
        </>
      )}
    </ActionModal>
  );
}
