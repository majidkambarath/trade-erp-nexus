import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronLeft, ChevronRight, Download, Printer, TriangleAlert } from "lucide-react";
import { vat } from "../../lib/accountingApi";
import { downloadCSV, formatDate, formatNumber, todayInput } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ConfirmDialog, DateInput, EmptyState, Field, Modal, PageHeader, Panel, Pill, Select, TextInput, errorMessage, useAsync, useToasts } from "../accounting/kit";
import { DateRange, Frame, lastQuarter, quarterStart } from "./reportKit";

const money = (n) => formatNumber(n, 2);
const TAB_IDS = ["return", "documents", "saved"];
const QUARTERS = [
  { id: "quarter", label: "This quarter", range: (t) => ({ from: quarterStart(t), to: t }) },
  { id: "lastq", label: "Last quarter", range: (t) => lastQuarter(t) },
  { id: "month", label: "This month", range: (t) => ({ from: `${t.slice(0, 7)}-01`, to: t }) },
];
const KIND = {
  standard: { label: "Standard 5%", tone: "info" }, zero_rated: { label: "Zero-rated", tone: "neutral" }, exempt: { label: "Exempt", tone: "neutral" },
  out_of_scope: { label: "Out of scope", tone: "neutral" }, reverse_charge: { label: "Reverse charge", tone: "warning" }, unclassified: { label: "No treatment", tone: "danger" },
};
const STATUS = { DRAFT: "neutral", FINALIZED: "info", FILED: "success" };
const SECTIONS = [
  { title: "VAT on sales and all other outputs", boxes: ["1a", "1b", "1c", "1d", "1e", "1f", "1g", "3", "4", "5", "8"] },
  { title: "VAT on expenses and all other inputs", boxes: ["9", "10", "11"] },
  { title: "Net VAT due", boxes: ["12", "13", "14"] },
];
const TOTAL_BOXES = new Set(["8", "11", "12", "13", "14"]);

// The UAE VAT return (FTA form 201), built live from the approved documents by their tax
// treatment, reconciled to the VAT accounts of the ledger, and saved / finalised / filed here.
export default function VatReturn() {
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.includes(params.get("tab")) ? params.get("tab") : "return";
  const today = todayInput();
  const [range, setRange] = useState(() => ({ from: quarterStart(today), to: today })); // the quarter so far; "Last quarter" is one click away
  const { notify, toastNode } = useToasts();
  const [kindFocus, setKindFocus] = useState("");
  const go = (next, extra = {}) => { if (extra.kind !== undefined) setKindFocus(extra.kind); setParams({ tab: next }, { replace: true }); };

  return (
    <div className="mx-auto max-w-[1400px] p-6 sm:p-8">
      <PageHeader title="VAT return" description="The FTA VAT return worked out from your approved invoices, returns, notes and expenses, by tax treatment." />
      <DateRange value={range} onChange={setRange} presets={QUARTERS} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="overflow-x-auto"><TabsList><TabsTrigger value="return">Return</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger><TabsTrigger value="saved">Saved returns</TabsTrigger></TabsList></div>
        <TabsContent value="return">{tab === "return" && <ReturnTab range={range} notify={notify} onShowUnclassified={() => go("documents", { kind: "unclassified" })} onSaved={() => go("saved")} />}</TabsContent>
        <TabsContent value="documents">{tab === "documents" && <Documents range={range} initialKind={kindFocus} />}</TabsContent>
        <TabsContent value="saved">{tab === "saved" && <Saved notify={notify} />}</TabsContent>
      </Tabs>
      {toastNode}
    </div>
  );
}

// ---------------------------------------------------------------- the return

function ReturnTab({ range, notify, onShowUnclassified, onSaved }) {
  const state = useAsync(() => vat.compute({ from: range.from, to: range.to }), [range.from, range.to]);
  const [busy, setBusy] = useState(false);

  async function saveDraft() {
    setBusy(true);
    try {
      await vat.saveDraft({ from: range.from, to: range.to });
      notify("Saved as a draft return");
      onSaved();
    } catch (e) {
      notify(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame state={state} label="Working out the return">
      {(d) => {
        const byBox = Object.fromEntries(d.boxes.map((b) => [b.box, b]));
        const exportCsv = () => downloadCSV(`vat-return-${range.from}-${range.to}.csv`, ["Box", "Description", "Amount (AED)", "VAT (AED)"], d.boxes.map((b) => [b.box, b.label, b.amount, b.vat]));
        const net = d.totals.netPayable;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard title="VAT due on sales" count={money(d.totals.outputVat)} tone="plum" subText="box 12" />
              <StatCard title="Recoverable on expenses" count={money(d.totals.recoverableVat)} tone="olive" subText="box 13" />
              <StatCard title={net >= 0 ? "Net VAT payable" : "Net VAT refundable"} count={money(Math.abs(net))} tone={net >= 0 ? "teal" : "neutral"} subText="box 14, AED" />
              <StatCard title="Lines without a tax treatment" count={String(d.unclassified.count)} tone={d.unclassified.count ? "danger" : "neutral"} onClick={d.unclassified.count ? onShowUnclassified : undefined} subText={d.unclassified.count ? `${money(d.unclassified.amount)} AED` : "Every line is classified"} />
            </div>

            {d.unclassified.count > 0 && (
              <div role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border border-status-warning/25 bg-status-warning-soft p-4 text-sm text-status-warning">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.unclassified.count} line{d.unclassified.count === 1 ? " has" : "s have"} VAT of 0% and no tax code, so they are in no box.</p>
                  <p className="mt-0.5 text-foreground/80">Choose zero-rated, exempt or out of scope on those documents (for example {d.unclassified.lines.slice(0, 3).map((l) => l.docNo).join(", ")}), then the return is complete.</p>
                </div>
                <Button size="sm" variant="outline" onClick={onShowUnclassified}>Show the documents</Button>
              </div>
            )}

            <Panel bodyClassName="p-0" title={`VAT 201 · ${formatDate(range.from)} to ${formatDate(range.to)}`} description={`Amounts in AED. Supplies are reported under ${d.emirate} until customers carry their own emirate.`}
              actions={<><Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button><Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" aria-hidden="true" />Print</Button><Button size="sm" onClick={saveDraft} disabled={busy}>{busy ? "Saving…" : "Save as draft"}</Button></>}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="w-16 px-5 py-2 text-start">Box</th><th className="px-3 py-2 text-start">Description</th><th className="px-3 py-2 text-end">Amount</th><th className="px-5 py-2 text-end">VAT</th></tr>
                  </thead>
                  {SECTIONS.map((s) => (
                    <tbody key={s.title}>
                      <tr className="border-t border-border bg-secondary/40"><th colSpan={4} scope="colgroup" className="px-5 py-2 text-start text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.title}</th></tr>
                      {s.boxes.map((id) => {
                        const b = byBox[id];
                        const total = TOTAL_BOXES.has(id);
                        const zero = !b.amount && !b.vat;
                        return (
                          <tr key={id} className={`border-t border-border/60 ${total ? "bg-secondary/30 font-semibold" : zero ? "text-muted-foreground" : ""}`}>
                            <td className="px-5 py-2 font-mono text-xs">{id}</td>
                            <td className="px-3 py-2">{b.label}</td>
                            <td className="px-3 py-2 text-end tabular-nums">{["12", "13", "14"].includes(id) ? "" : zero ? "-" : money(b.amount)}</td>
                            <td className="px-5 py-2 text-end tabular-nums">{zero && !total ? "-" : money(b.vat)}</td>
                          </tr>
                        );
                      })}
                      {s.title.startsWith("VAT on sales") && d.notTracked.map((n) => (
                        <tr key={n.box} className="border-t border-border/60 text-muted-foreground"><td className="px-5 py-2 font-mono text-xs">{n.box}</td><td className="px-3 py-2">{n.label}</td><td colSpan={2} className="px-5 py-2 text-end"><Pill>Not tracked yet</Pill></td></tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            </Panel>

            <Panel title="Agrees with the ledger?" description="The VAT in the boxes against the VAT accounts of the books for the same days.">
              <ul className="divide-y divide-border">
                {d.reconciliation.rows.map((r) => (
                  <li key={r.label} className="flex flex-wrap items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
                    <span className="w-28 font-medium">{r.label}</span>
                    <span className="text-muted-foreground">Documents {money(r.documents)}</span>
                    <span className="text-muted-foreground">Ledger {r.ledger == null ? "not set up" : money(r.ledger)}</span>
                    <span className="ms-auto">{r.agrees ? <Pill tone="success"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />Agrees</Pill> : <Pill tone="warning"><TriangleAlert className="h-3 w-3" aria-hidden="true" />{r.ledger == null ? "No account to compare" : `Differs by ${money(Math.abs(r.difference))}`}</Pill>}</span>
                  </li>
                ))}
              </ul>
              {d.notReported.count > 0 && <p className="mt-3 text-xs text-muted-foreground">{d.notReported.count} line{d.notReported.count === 1 ? "" : "s"} ({money(d.notReported.amount)} AED) are out of scope, or zero-rated or exempt purchases, and appear in no box.</p>}
            </Panel>
          </div>
        );
      }}
    </Frame>
  );
}

// ---------------------------------------------------------------- the documents behind it

const PAGE = 50;

function Documents({ range, initialKind }) {
  const [direction, setDirection] = useState("");
  const [kind, setKind] = useState(initialKind || "");
  const [search, setSearch] = useState("");
  const [needle, setNeedle] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setNeedle(search.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [range.from, range.to, direction, kind]);
  const state = useAsync(() => vat.detail({ from: range.from, to: range.to, direction: direction || undefined, kind: kind || undefined, search: needle || undefined, page, limit: PAGE }), [range.from, range.to, direction, kind, needle, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Direction" className="w-48"><Select value={direction} onChange={(e) => setDirection(e.target.value)}><option value="">Sales and purchases</option><option value="output">Sales (output VAT)</option><option value="input">Purchases (input VAT)</option></Select></Field>
        <Field label="Treatment" className="w-52"><Select value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Every treatment</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        <Field label="Search" className="w-72"><TextInput type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Document, party or TRN" /></Field>
      </div>
      <Frame state={state}>
        {(d) => {
          const pages = Math.max(1, Math.ceil(d.total / PAGE));
          const exportCsv = () => downloadCSV(`vat-documents-${range.from}-${range.to}.csv`, ["Date", "Document", "Direction", "Party", "TRN", "Treatment", "Taxable (AED)", "VAT (AED)"],
            d.rows.map((r) => [formatDate(r.date), r.docNo, r.direction, r.partyName, r.trn, r.kinds.map((k) => KIND[k]?.label || k).join(" / "), r.taxable, r.vat]));
          return (
            <Panel bodyClassName="p-0" title="Documents in the return" description={`${d.total} document${d.total === 1 ? "" : "s"} · taxable ${money(d.totals.taxable)} · VAT ${money(d.totals.vat)} AED`}
              actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!d.rows.length}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}>
              {d.rows.length === 0 ? <EmptyState title="No documents" text="No approved document matches this selection." /> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr><th className="px-5 py-2 text-start">Date</th><th className="px-3 py-2 text-start">Document</th><th className="px-3 py-2 text-start">Party</th><th className="px-3 py-2 text-start">TRN</th><th className="px-3 py-2 text-start">Treatment</th><th className="px-3 py-2 text-end">Taxable</th><th className="px-5 py-2 text-end">VAT</th></tr>
                    </thead>
                    <tbody>
                      {d.rows.map((r) => (
                        <tr key={`${r.source}-${r.docId}`} className="border-t border-border hover:bg-accent/40">
                          <td className="whitespace-nowrap px-5 py-2">{formatDate(r.date)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.docNo}<span className="ms-2 font-sans text-muted-foreground">{r.direction === "output" ? "Sale" : "Purchase"}</span></td>
                          <td className="px-3 py-2">{r.partyName || <span className="text-muted-foreground">-</span>}</td>
                          <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.trn || "-"}</td>
                          <td className="px-3 py-2"><span className="flex flex-wrap gap-1">{r.kinds.map((k) => <Pill key={k} tone={KIND[k]?.tone}>{KIND[k]?.label || k}</Pill>)}</span></td>
                          <td className="px-3 py-2 text-end tabular-nums">{money(r.taxable)}</td>
                          <td className="px-5 py-2 text-end tabular-nums">{money(r.vat)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {d.total > PAGE && (
                <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted-foreground">
                  <span>Page {page} of {pages}</span>
                  <span className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />Previous</Button>
                    <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next<ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                  </span>
                </div>
              )}
            </Panel>
          );
        }}
      </Frame>
    </div>
  );
}

// ---------------------------------------------------------------- saved returns

function Saved({ notify }) {
  const state = useAsync(() => vat.returns(), []);
  const [view, setView] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: finalize|anyway|delete, ret }
  const [filing, setFiling] = useState(null);
  const [busy, setBusy] = useState(false);

  async function run(fn, message) {
    setBusy(true);
    try {
      await fn();
      notify(message);
      setConfirm(null);
      setFiling(null);
      state.reload();
    } catch (e) {
      if (e.code === "UNCLASSIFIED_LINES") { setConfirm((c) => ({ ...c, kind: "anyway", message: e.message })); } else { setConfirm(null); notify(errorMessage(e), "error"); }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame state={state} label="Loading saved returns">
      {(rows) => (
        <>
          <Panel bodyClassName="p-0" title="Saved returns" description="A return keeps the figures it had when it was prepared, so a later change to a document does not restate it.">
            {rows.length === 0 ? <EmptyState title="No saved returns" text="Open the Return tab, check the figures and choose Save as draft." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-5 py-2 text-start">Period</th><th className="px-3 py-2 text-start">Status</th><th className="px-3 py-2 text-end">VAT due</th><th className="px-3 py-2 text-end">Recoverable</th><th className="px-3 py-2 text-end">Net</th><th className="px-3 py-2 text-start">Filing</th><th className="px-5 py-2"><span className="sr-only">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r._id} className="border-t border-border hover:bg-accent/40">
                        <td className="whitespace-nowrap px-5 py-2.5">{formatDate(r.periodFrom)} to {formatDate(r.periodTo)}</td>
                        <td className="px-3 py-2.5"><Pill tone={STATUS[r.status]}>{r.status === "DRAFT" ? "Draft" : r.status === "FINALIZED" ? "Finalised" : "Filed"}</Pill></td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{money(r.totals.outputVat)}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums">{money(r.totals.recoverableVat)}</td>
                        <td className="px-3 py-2.5 text-end font-medium tabular-nums">{money(r.totals.netPayable)}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{r.status === "FILED" ? `${r.filingReference} · ${formatDate(r.filedAt)}` : r.unclassifiedLines ? `${r.unclassifiedLines} line(s) without a treatment` : "-"}</td>
                        <td className="px-5 py-2.5 text-end">
                          <span className="inline-flex gap-1.5">
                            <Button size="sm" variant="outline" onClick={() => setView(r)} aria-label={`View return ${r.periodFrom} to ${r.periodTo}`}>View</Button>
                            {r.status === "DRAFT" && <Button size="sm" onClick={() => setConfirm({ kind: "finalize", ret: r })}>Finalise</Button>}
                            {r.status === "FINALIZED" && <Button size="sm" onClick={() => setFiling({ ret: r, reference: "", filedOn: todayInput() })}>Mark filed</Button>}
                            {r.status === "DRAFT" && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "delete", ret: r })}>Delete</Button>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {view && (
            <Modal size="lg" onClose={() => setView(null)} title={`VAT return ${formatDate(view.periodFrom)} to ${formatDate(view.periodTo)}`} description={`${view.status === "FILED" ? `Filed · reference ${view.filingReference}` : view.status === "FINALIZED" ? "Finalised" : "Draft"} · AED`}>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="w-14 px-4 py-2 text-start">Box</th><th className="px-3 py-2 text-start">Description</th><th className="px-3 py-2 text-end">Amount</th><th className="px-4 py-2 text-end">VAT</th></tr></thead>
                  <tbody>
                    {view.boxes.filter((b) => b.amount || b.vat || TOTAL_BOXES.has(b.box)).map((b) => (
                      <tr key={b.box} className={`border-t border-border ${TOTAL_BOXES.has(b.box) ? "bg-secondary/30 font-semibold" : ""}`}>
                        <td className="px-4 py-1.5 font-mono text-xs">{b.box}</td><td className="px-3 py-1.5">{b.label}</td>
                        <td className="px-3 py-1.5 text-end tabular-nums">{["12", "13", "14"].includes(b.box) ? "" : money(b.amount)}</td><td className="px-4 py-1.5 text-end tabular-nums">{money(b.vat)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Modal>
          )}

          {confirm && (
            <ConfirmDialog
              busy={busy} danger={confirm.kind === "delete"}
              title={confirm.kind === "delete" ? "Delete this draft?" : confirm.kind === "anyway" ? "Finalise with lines that have no treatment?" : "Finalise this return?"}
              confirmLabel={confirm.kind === "delete" ? "Delete draft" : confirm.kind === "anyway" ? "Finalise anyway" : "Finalise"}
              text={confirm.kind === "delete" ? "The saved figures are removed. The documents are not touched."
                : confirm.kind === "anyway" ? `${confirm.message} Those lines stay out of every box.`
                : "The figures are recalculated from the documents and kept as prepared. A finalised return can be marked filed, and cannot be deleted."}
              onClose={() => setConfirm(null)}
              onConfirm={() => (confirm.kind === "delete" ? run(() => vat.removeReturn(confirm.ret._id), "Draft deleted") : run(() => vat.finalize(confirm.ret._id, { allowUnclassified: confirm.kind === "anyway" }), "Return finalised"))}
            />
          )}

          {filing && (
            <Modal size="sm" onClose={() => setFiling(null)} title="Mark as filed" description={`${formatDate(filing.ret.periodFrom)} to ${formatDate(filing.ret.periodTo)}`}
              footer={<><Button variant="outline" onClick={() => setFiling(null)}>Cancel</Button><Button disabled={busy || !filing.reference.trim()} onClick={() => run(() => vat.file(filing.ret._id, { reference: filing.reference, filedOn: filing.filedOn }), "Marked as filed")}>{busy ? "Saving…" : "Mark filed"}</Button></>}>
              <div className="grid gap-4">
                <Field label="FTA filing reference" required hint="From the confirmation you received on the FTA portal."><TextInput value={filing.reference} onChange={(e) => setFiling((f) => ({ ...f, reference: e.target.value }))} data-autofocus /></Field>
                <Field label="Filed on"><DateInput value={filing.filedOn} onChange={(e) => setFiling((f) => ({ ...f, filedOn: e.target.value }))} /></Field>
              </div>
            </Modal>
          )}
        </>
      )}
    </Frame>
  );
}

