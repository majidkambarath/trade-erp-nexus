// Bringing a spreadsheet of enquiries or of people into the CRM. Four steps, and nothing is written until the third:
//
//   file     choose a CSV or Excel file (or download the template to see the shape we read)
//   match    say which column is the name, the phone, the company... - guessed from the headings, always changeable
//   preview  ask the server what WOULD happen: how many are new, which we already hold, which have a problem and why
//   import   do it, a lot at a time, with a bar; then say what was done
//
// The preview is the server's own answer (the same rules decide both), not a guess made in the browser, so the numbers a
// person agrees to are the numbers they get. The one thing the preview cannot know is a row that repeats a row in a
// DIFFERENT lot (nothing has been written yet for the second lot to see), so the final count is the one to trust, and the
// last screen says so when it differs.
import React, { useMemo, useRef, useState } from "react";
import { Download, UploadCloud } from "lucide-react";
import { Field, Modal, Select } from "../accounting/kit.jsx";
import { Note } from "../salesDocs/parts.jsx";
import { downloadCSV } from "../../utils/format";
import { crm } from "../../lib/crmApi";
import * as imp from "../../lib/crmImport";

const WORDS = {
  lead: { one: "lead", many: "leads", noun: "enquiries", title: "Import enquiries", row: "enquiry" },
  contact: { one: "person", many: "people", noun: "people", title: "Import people", row: "person" },
};
const SHOWN = 50;

const Count = ({ n, children, tone = "" }) => (
  <div className="rounded-xl border border-border p-3">
    <p className={`text-2xl font-semibold tabular-nums ${tone}`}>{n}</p>
    <p className="text-sm text-muted-foreground">{children}</p>
  </div>
);

const IssueList = ({ issues, truncated, total }) => {
  if (!issues.length) return null;
  const shown = issues.slice(0, SHOWN);
  const hidden = Math.max(total ?? issues.length, issues.length) - shown.length;
  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-sm font-medium text-foreground">Rows to look at</h3>
      <ul className="divide-y divide-border rounded-xl border border-border text-sm">
        {shown.map((issue, i) => (
          <li key={`${issue.line}-${i}`} className={`px-3 py-2 ${issue.status === "invalid" ? "text-status-danger" : "text-foreground"}`}>
            {imp.issueText(issue)}
          </li>
        ))}
      </ul>
      {(hidden > 0 || truncated) && <p className="mt-1.5 text-xs text-muted-foreground">…and {hidden > 0 ? hidden : "more"} more.</p>}
    </div>
  );
};

export default function ImportDialog({ kind = "lead", onClose, onDone, notify }) {
  const words = WORDS[kind] || WORDS.lead;
  const fields = useMemo(() => imp.fieldsFor(kind), [kind]);
  const [step, setStep] = useState("file");
  const [file, setFile] = useState(null); // { fileName, grid }
  const [mapping, setMapping] = useState({});
  const [options, setOptions] = useState({ followUp: false, allowDuplicates: false, unmatched: "import" });
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [problem, setProblem] = useState(null);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const headers = file?.grid?.[0] || [];
  const rows = useMemo(() => (file ? imp.mappedRows(file.grid, mapping, fields) : []), [file, mapping, fields]);
  const missing = imp.missingFields(mapping, fields);
  const send = (dryRun) => (lot) => {
    const body = { rows: lot, dryRun, fileName: file.fileName };
    if (kind === "contact") return crm.importContacts({ ...body, unmatched: options.unmatched });
    return crm.importLeads({ ...body, followUp: options.followUp, allowDuplicates: options.allowDuplicates });
  };

  async function choose(selected) {
    if (!selected) return;
    setProblem(null);
    setBusy(true);
    try {
      const read = await imp.readSpreadsheet(selected);
      setFile(read);
      setMapping(imp.guessMapping(read.grid[0], fields));
      setStep("match");
    } catch (error) {
      setProblem(error.message || "This file could not be read");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function check() {
    setProblem(null);
    setBusy(true);
    setProgress({ done: 0, total: rows.length });
    const out = await imp.sendInLots(rows, send(true), { onProgress: (done, total) => setProgress({ done, total }) });
    setBusy(false);
    if (out.error) {
      setProblem(out.error.message || "The file could not be checked");
      return;
    }
    setPreview(out);
    setStep("preview");
  }

  async function run() {
    setProblem(null);
    setStep("import");
    setBusy(true);
    setProgress({ done: 0, total: rows.length });
    const out = await imp.sendInLots(rows, send(false), { onProgress: (done, total) => setProgress({ done, total }) });
    setBusy(false);
    setResult(out);
    setStep("done");
    if (out.summary.created > 0) notify?.(`${out.summary.created} ${out.summary.created === 1 ? words.one : words.many} imported`);
  }

  const template = () => {
    const t = imp.templateFor(kind);
    downloadCSV(t.fileName, t.headers, t.rows);
  };

  const finish = () => (result?.summary?.created > 0 ? onDone?.(result) : onClose?.());

  let body = null;
  let footer = null;

  if (step === "file") {
    body = (
      <>
        <p className="text-sm text-muted-foreground">
          Choose a CSV or Excel file with one row per {words.row}. The first row must be the column names. You will see exactly what
          will happen before anything is added.
        </p>
        <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-input px-4 py-6 text-center transition-colors focus-within:ring-2 focus-within:ring-ring/40 hover:bg-accent">
          <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{busy ? "Reading the file…" : "Choose a file"}</span>
          <span className="text-xs text-muted-foreground">CSV, XLSX or XLS · up to {imp.MAX_FILE_ROWS} rows</span>
          <input ref={input} type="file" accept=".csv,.xlsx,.xls,text/csv" aria-label={`Choose a file of ${words.noun} to import`} className="sr-only" onChange={(e) => choose(e.target.files?.[0])} />
        </label>
        <button type="button" onClick={template} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline lg:min-h-0">
          <Download className="h-4 w-4" aria-hidden="true" /> Download a template
        </button>
      </>
    );
    footer = (
      <button type="button" onClick={onClose} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
        Cancel
      </button>
    );
  }

  if (step === "match") {
    const sampleRow = file.grid[1] || [];
    body = (
      <>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{file.fileName}</span> has {rows.length} {rows.length === 1 ? words.row : words.noun}. Say which column
          holds what. We guessed from the headings; change any that are wrong.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {fields.map((f) => {
            const col = mapping[f.key];
            const sample = col !== null && col !== undefined ? String(sampleRow[col] ?? "").trim() : "";
            return (
              <Field key={f.key} label={f.label} required={f.required} hint={sample ? `e.g. ${sample.slice(0, 40)}` : undefined}>
                <Select
                  value={col ?? ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                >
                  <option value="">Not in my file</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {imp.columnLabel(i, h)}
                    </option>
                  ))}
                </Select>
              </Field>
            );
          })}
        </div>

        {kind === "lead" ? (
          <div className="mt-4 grid gap-1">
            <label className="flex min-h-11 items-start gap-2 text-sm lg:min-h-0">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={options.followUp} onChange={(e) => setOptions((o) => ({ ...o, followUp: e.target.checked }))} />
              <span>
                Add a first follow-up for each lead, due today
                <span className="block text-xs text-muted-foreground">Leave this off for old enquiries, or every one lands on today's list.</span>
              </span>
            </label>
            <label className="flex min-h-11 items-start gap-2 text-sm lg:min-h-0">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={options.allowDuplicates} onChange={(e) => setOptions((o) => ({ ...o, allowDuplicates: e.target.checked }))} />
              <span>
                Add people I already have, as new leads too
                <span className="block text-xs text-muted-foreground">Normally a repeated phone number or email is left out.</span>
              </span>
            </label>
          </div>
        ) : (
          <div className="mt-4">
            <Field label="A person whose company is not a customer yet">
              <Select value={options.unmatched} onChange={(e) => setOptions((o) => ({ ...o, unmatched: e.target.value }))}>
                <option value="import">Add them, with the company in their notes</option>
                <option value="skip">Leave them out</option>
              </Select>
            </Field>
          </div>
        )}

        {missing.length > 0 && (
          <Note tone="warning" className="mt-4">
            Choose which column holds the {missing.map((f) => f.label.toLowerCase()).join(" and ")}.
          </Note>
        )}
        {busy && <p className="mt-3 text-sm text-muted-foreground">Checking {progress.done} of {progress.total}…</p>}
      </>
    );
    footer = (
      <>
        <button type="button" onClick={() => { setStep("file"); setProblem(null); }} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
          Back
        </button>
        <button type="button" onClick={check} disabled={busy || missing.length > 0 || rows.length === 0} data-shortcut="save" className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10">
          {busy ? "Checking…" : "Check the file"}
        </button>
      </>
    );
  }

  if (step === "preview") {
    const s = preview.summary;
    body = (
      <>
        <div className={`grid gap-3 ${kind === "contact" ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <Count n={s.create} tone="text-status-success">will be added</Count>
          <Count n={s.duplicate}>already held</Count>
          <Count n={s.invalid} tone={s.invalid ? "text-status-danger" : ""}>have a problem</Count>
          {kind === "contact" && <Count n={s.skipped}>left out</Count>}
        </div>
        {s.create === 0 && <Note tone="warning" className="mt-4">Nothing here would be added. Go back to change the columns, or fix the rows below in your file and choose it again.</Note>}
        {preview.sample.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1.5 text-sm font-medium text-foreground">The first {preview.sample.length} to be added</h3>
            <ul className="divide-y divide-border rounded-xl border border-border text-sm">
              {preview.sample.map((r, i) => (
                <li key={i} className="px-3 py-2">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground">{[r.company, r.phone || r.email].filter(Boolean).map((x) => ` · ${x}`).join("")}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <IssueList issues={preview.issues} truncated={preview.truncated} total={s.invalid + s.duplicate + s.skipped} />
        {rows.length > imp.LOT && <p className="mt-3 text-xs text-muted-foreground">A big file is read in lots, so a row that repeats one in another lot is only caught as it is added: the final count is the one to trust.</p>}
      </>
    );
    footer = (
      <>
        <button type="button" onClick={() => setStep("match")} className="h-11 rounded-lg border border-border px-4 text-sm font-medium lg:h-10">
          Back
        </button>
        <button type="button" onClick={run} disabled={s.create === 0} data-shortcut="save" className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 lg:h-10">
          Import {s.create} {s.create === 1 ? words.one : words.many}
        </button>
      </>
    );
  }

  if (step === "import") {
    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    body = (
      <>
        <p className="text-sm text-foreground">Importing {progress.done} of {progress.total}…</p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Import progress" className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Keep this window open until it finishes.</p>
      </>
    );
  }

  if (step === "done") {
    const s = result.summary;
    const stopped = result.error;
    body = (
      <>
        {stopped ? (
          <Note tone="danger">It stopped after {result.stoppedAt} rows: {stopped.message}. What was added before that is kept; choose the same file again to carry on (rows already added are skipped).</Note>
        ) : (
          <Note tone={s.created > 0 ? "teal" : "warning"}>
            {s.created > 0 ? `${s.created} ${s.created === 1 ? words.one : words.many} added.` : `Nothing was added.`}
          </Note>
        )}
        <div className={`mt-4 grid gap-3 ${kind === "contact" ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <Count n={s.created} tone="text-status-success">added</Count>
          <Count n={s.duplicate}>already held</Count>
          <Count n={s.invalid + s.failed} tone={s.invalid + s.failed ? "text-status-danger" : ""}>could not be added</Count>
          {kind === "contact" && <Count n={s.skipped}>left out</Count>}
        </div>
        {preview && preview.summary.create !== s.created && !stopped && (
          <p className="mt-3 text-xs text-muted-foreground">The check said {preview.summary.create}; {s.created} were added. Rows that repeat a row in another lot are caught only as they are added.</p>
        )}
        <IssueList issues={[...result.issues, ...result.failed.map((f) => ({ line: f.line, status: "invalid", errors: [{ message: f.message }] }))]} truncated={result.truncated} />
      </>
    );
    footer = (
      <button type="button" onClick={finish} data-shortcut="save" className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground lg:h-10">
        Done
      </button>
    );
  }

  return (
    <Modal title={words.title} size="md" onClose={onClose} confirmClose={() => step !== "import"} footer={footer}>
      {problem && <Note tone="danger" className="mb-3">{problem}</Note>}
      {body}
    </Modal>
  );
}
