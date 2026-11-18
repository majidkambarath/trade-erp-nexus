import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Download, TriangleAlert } from "lucide-react";
import { gst } from "../../lib/accountingApi";
import { CURRENCY, downloadCSV, formatDate, formatNumber, todayInput } from "../../utils/format";
import { Button } from "../ui/button";
import StatCard from "../ui/stat-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { PageHeader, Panel, Pill, useAsync } from "../accounting/kit";
import { DateRange, Frame, lastMonth, monthStart, quarterStart, useExportPreamble } from "./reportKit";
import { stateName } from "../../lib/gstStates";

const money = (n) => formatNumber(n, 2);
const TAB_IDS = ["gstr1", "gstr3b"];
const PRESETS = [
  { id: "month", label: "This month", range: (t) => ({ from: monthStart(t), to: t }) },
  { id: "last", label: "Last month", range: (t) => lastMonth(t) },
  { id: "quarter", label: "This quarter", range: (t) => ({ from: quarterStart(t), to: t }) },
];
const place = (code) => (code ? `${code} ${stateName(code)}`.trim() : "");

// India's GST returns, worked out live from the approved invoices, credit notes, bills and returns. Not the filed return itself:
// they are the figures to enter in (or upload to) the GST portal, reconciled to the ledger.
export default function GstReturn() {
  const [params, setParams] = useSearchParams();
  const tab = TAB_IDS.includes(params.get("tab")) ? params.get("tab") : "gstr1";
  const today = todayInput();
  const [range, setRange] = useState(() => ({ from: monthStart(today), to: today })); // returns are monthly for most; the quarter is a click away

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="GST returns" description="GSTR-1 (what you sold) and GSTR-3B (the summary and what to pay), worked out from your approved invoices, credit notes, bills and returns." />
      <DateRange value={range} onChange={setRange} presets={PRESETS} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="erp-scroll table-pin-first overflow-x-auto">
          <TabsList><TabsTrigger value="gstr1">GSTR-1</TabsTrigger><TabsTrigger value="gstr3b">GSTR-3B</TabsTrigger></TabsList>
        </div>
        <TabsContent value="gstr1">{tab === "gstr1" && <Gstr1 range={range} />}</TabsContent>
        <TabsContent value="gstr3b">{tab === "gstr3b" && <Gstr3b range={range} />}</TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------- shared pieces

function NotReported({ notReported }) {
  const w = notReported?.withoutGstDetail;
  const u = notReported?.unclassified;
  if (!w?.documents && !u?.lines) return null;
  return (
    <div role="alert" className="mb-4 space-y-2 rounded-xl border border-status-warning/25 bg-status-warning-soft p-4 text-sm text-status-warning">
      {w?.documents > 0 && (
        <p className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {w.documents} approved document{w.documents === 1 ? " is" : "s are"} not in the tables below ({money(w.taxable)} taxable, {money(w.tax)} tax {CURRENCY}). {w.documents === 1 ? "It was" : "They were"} made before the tax was split into CGST / SGST / IGST, or while the company's state was not set
            (Settings &gt; Business rules &gt; Tax identity). Their tax is in the ledger as one amount.
          </span>
        </p>
      )}
      {u?.lines > 0 && (
        <p className="flex items-start gap-2">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{u.lines} line{u.lines === 1 ? " has" : "s have"} no tax treatment (0% and no tax code), so {u.lines === 1 ? "it is" : "they are"} in no table. Choose nil-rated, exempt or non-GST on {u.lines === 1 ? "that document" : "those documents"}.</span>
        </p>
      )}
    </div>
  );
}

// One table of rows with a CSV button. `columns`: [{ key, label, align, render(row), csv(row) }].
function Section({ title, description, rows, columns, filename, preamble, footer, emptyText = "Nothing in this period." }) {
  const exportCsv = () =>
    downloadCSV(filename, columns.map((c) => c.label), rows.map((r) => columns.map((c) => (c.csv ? c.csv(r) : r[c.key] ?? ""))), { preamble: preamble?.() });
  return (
    <Panel
      bodyClassName="p-0"
      title={title}
      description={description}
      actions={rows.length > 0 && <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-3.5 w-3.5" aria-hidden="true" />CSV</Button>}
    >
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="erp-scroll table-pin-first overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>{columns.map((c) => <th key={c.label} scope="col" className={`px-3 py-2 first:ps-5 last:pe-5 ${c.align === "end" ? "text-end" : "text-start"}`}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {columns.map((c) => <td key={c.label} className={`whitespace-nowrap px-3 py-2 first:ps-5 last:pe-5 ${c.align === "end" ? "text-end tabular-nums" : "text-start"}`}>{c.render ? c.render(r) : r[c.key]}</td>)}
                </tr>
              ))}
            </tbody>
            {footer}
          </table>
        </div>
      )}
    </Panel>
  );
}

const amountCol = (key, label) => ({ key, label, align: "end", render: (r) => money(r[key]), csv: (r) => r[key] });
const taxCols = [amountCol("taxable", "Taxable"), amountCol("igst", "IGST"), amountCol("cgst", "CGST"), amountCol("sgst", "SGST / UTGST")];
const rateCol = { key: "rate", label: "Rate %", align: "end", render: (r) => formatNumber(r.rate, 0), csv: (r) => r.rate };
const docCols = (withGstin) => [
  ...(withGstin ? [{ key: "gstin", label: "GSTIN", render: (r) => r.gstin || "" }] : []),
  { key: "party", label: "Party" },
  { key: "docNo", label: "Number" },
  { key: "date", label: "Date", render: (r) => formatDate(r.date), csv: (r) => String(r.date).slice(0, 10) },
  amountCol("docValue", "Document value"),
  { key: "placeOfSupply", label: "Place of supply", render: (r) => place(r.placeOfSupply), csv: (r) => place(r.placeOfSupply) },
  rateCol,
  ...taxCols,
];

// ---------------------------------------------------------------- GSTR-1

function Gstr1({ range }) {
  const state = useAsync(() => gst.gstr1({ from: range.from, to: range.to }), [range.from, range.to]);
  const preamble = useExportPreamble("GSTR-1");
  const file = (name) => `gstr1-${name}-${range.from}-${range.to}.csv`;
  const period = `${formatDate(range.from)} to ${formatDate(range.to)}`;
  const pre = () => preamble(period);

  return (
    <Frame state={state} label="Working out GSTR-1">
      {(d) => {
        const n = d.documentsIssued;
        const nil = d.nil;
        const nonGst = d.nonGst;
        const nilRows = [
          ["Inter-state, registered buyers", "interRegistered"], ["Intra-state, registered buyers", "intraRegistered"],
          ["Inter-state, unregistered buyers", "interUnregistered"], ["Intra-state, unregistered buyers", "intraUnregistered"],
        ].map(([label, key]) => ({ label, nil: nil[key].taxable, nonGst: nonGst[key].taxable }));
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard title="Taxable value" count={money(d.totals.taxable)} tone="teal" subText={`net of credit notes, ${CURRENCY}`} />
              <StatCard title="Tax charged" count={money(d.totals.tax)} tone="plum" subText={`IGST ${money(d.totals.igst)} · CGST ${money(d.totals.cgst)} · SGST ${money(d.totals.sgst)}`} />
              <StatCard title="Invoices" count={String(n.invoices.count)} tone="neutral" subText={n.invoices.count ? `${n.invoices.from} to ${n.invoices.to}` : "none"} />
              <StatCard title="Credit notes" count={String(n.creditNotes.count)} tone="neutral" subText={n.creditNotes.count ? `${n.creditNotes.from} to ${n.creditNotes.to}` : "none"} />
            </div>
            <NotReported notReported={d.notReported} />
            {d.hsnMissing && (
              <p role="note" className="flex items-start gap-2 rounded-xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Some sales have no HSN / SAC code. The portal asks for one on every line: add it to the item (Inventory &gt; Stock items) and it is used from the next document.
              </p>
            )}

            <Section title="B2B invoices (4A)" description="Sales to buyers with a GSTIN, invoice by invoice and rate." rows={d.b2b} columns={docCols(true)} filename={file("b2b")} preamble={pre} />
            <Section title="B2C large invoices (5)" description="Inter-state sales to unregistered buyers over ₹1,00,000, invoice by invoice." rows={d.b2cl} columns={docCols(false)} filename={file("b2cl")} preamble={pre} />
            <Section
              title="B2C small (7)" description="All other sales to unregistered buyers, by state and rate. Their credit notes reduce it."
              rows={d.b2cs} filename={file("b2cs")} preamble={pre}
              columns={[{ key: "placeOfSupply", label: "Place of supply", render: (r) => place(r.placeOfSupply), csv: (r) => place(r.placeOfSupply) }, rateCol, ...taxCols]}
            />
            <Section title="Credit notes to registered buyers (9B)" rows={d.cdnr} columns={docCols(true)} filename={file("credit-notes-registered")} preamble={pre} />
            <Section title="Credit notes to unregistered buyers (9B)" description="Only those over ₹1,00,000 inter-state; smaller ones are inside B2C small." rows={d.cdnur} columns={docCols(false)} filename={file("credit-notes-unregistered")} preamble={pre} />
            <Section
              title="Zero-rated supplies (6)" description="Exports and supplies to a special economic zone."
              rows={d.zeroRated} filename={file("zero-rated")} preamble={pre}
              columns={[{ key: "party", label: "Party" }, { key: "docNo", label: "Number" }, { key: "date", label: "Date", render: (r) => formatDate(r.date), csv: (r) => String(r.date).slice(0, 10) }, ...taxCols]}
            />
            <Section
              title="Nil-rated, exempt and non-GST supplies (8)" rows={nilRows} filename={file("nil-exempt")} preamble={pre}
              columns={[{ key: "label", label: "Supplies" }, amountCol("nil", "Nil-rated and exempt"), amountCol("nonGst", "Non-GST")]}
            />
            <Section
              title="HSN / SAC summary (12)" description="Quantity and value by code and rate, after credit notes."
              rows={d.hsn} filename={file("hsn")} preamble={pre}
              columns={[{ key: "hsnCode", label: "HSN / SAC", render: (r) => r.hsnCode || "(none)", csv: (r) => r.hsnCode }, rateCol, { key: "qty", label: "Quantity", align: "end", render: (r) => formatNumber(r.qty, 2), csv: (r) => r.qty }, ...taxCols]}
            />
          </div>
        );
      }}
    </Frame>
  );
}

// ---------------------------------------------------------------- GSTR-3B

function Gstr3b({ range }) {
  const state = useAsync(() => gst.gstr3b({ from: range.from, to: range.to }), [range.from, range.to]);
  const preamble = useExportPreamble("GSTR-3B");
  const period = `${formatDate(range.from)} to ${formatDate(range.to)}`;

  return (
    <Frame state={state} label="Working out GSTR-3B">
      {(d) => {
        const o = d.outward;
        const c = (t) => ({ taxable: t.taxable, igst: t.igst, cgst: t.cgst, sgst: t.sgst });
        const outward = [
          { label: "3.1(a) Outward taxable supplies (other than zero-rated, nil-rated and exempt)", ...c(o.taxable) },
          { label: "3.1(b) Outward taxable supplies (zero-rated)", ...c(o.zeroRated) },
          { label: "3.1(c) Other outward supplies (nil-rated, exempt)", ...c(o.nilExempt) },
          { label: "3.1(d) Inward supplies liable to reverse charge", ...c(o.reverseCharge) },
          { label: "3.1(e) Non-GST outward supplies", ...c(o.nonGst) },
        ];
        const itc = [
          { label: "4(A)(3) Inward supplies liable to reverse charge", igst: d.itc.reverseCharge.igst, cgst: d.itc.reverseCharge.cgst, sgst: d.itc.reverseCharge.sgst },
          { label: "4(A)(5) All other input tax credit", igst: d.itc.other.igst, cgst: d.itc.other.cgst, sgst: d.itc.other.sgst },
          { label: "Input tax credit available", igst: d.itc.total.igst, cgst: d.itc.total.cgst, sgst: d.itc.total.sgst, strong: true },
        ];
        // d.utilised[credit][tax]: how much of each kind of credit paid each kind of tax
        const paidBy = (tax) => ["igst", "cgst", "sgst"].reduce((t, credit) => t + (d.utilised[credit]?.[tax] || 0), 0);
        const pay = [
          { label: "Tax on outward supplies", ...d.liability.ordinary },
          { label: "Tax on reverse charge (cash only)", ...d.liability.reverseCharge },
          { label: "Paid by input tax credit", igst: -paidBy("igst"), cgst: -paidBy("cgst"), sgst: -paidBy("sgst") },
          { label: "Payable in cash", ...d.payableInCash, strong: true },
          { label: "Credit carried forward", ...d.creditCarriedForward },
        ];
        const cols = (first) => [{ key: "label", label: first, render: (r) => <span className={`${r.strong ? "font-semibold" : ""} whitespace-normal`}>{r.label}</span>, csv: (r) => r.label }];
        const outwardCols = [...cols("Outward supplies"), amountCol("taxable", "Taxable"), amountCol("igst", "IGST"), amountCol("cgst", "CGST"), amountCol("sgst", "SGST / UTGST")];
        const taxOnly = (first) => [...cols(first), amountCol("igst", "IGST"), amountCol("cgst", "CGST"), amountCol("sgst", "SGST / UTGST")];
        const rec = d.reconciliation;
        const allAgree = rec.rows.every((r) => r.agrees);
        const cash = d.payableInCash;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard title="Payable in cash" count={money(cash.igst + cash.cgst + cash.sgst)} tone="teal" subText={`IGST ${money(cash.igst)} · CGST ${money(cash.cgst)} · SGST ${money(cash.sgst)}`} />
              <StatCard title="Input tax credit" count={money(d.itc.total.igst + d.itc.total.cgst + d.itc.total.sgst)} tone="olive" subText="available this period" />
              <StatCard title="Tax on sales" count={money(d.liability.ordinary.igst + d.liability.ordinary.cgst + d.liability.ordinary.sgst)} tone="plum" subText="outward, before credit" />
              <StatCard title="Credit carried forward" count={money(d.creditCarriedForward.igst + d.creditCarriedForward.cgst + d.creditCarriedForward.sgst)} tone="neutral" subText="unused" />
            </div>
            <NotReported notReported={d.notReported} />

            <Section title="3.1 Outward supplies and inward supplies liable to reverse charge" rows={outward} columns={outwardCols} filename={`gstr3b-outward-${range.from}-${range.to}.csv`} preamble={() => preamble(period)} />
            <Section title="4 Input tax credit" rows={itc} columns={taxOnly("Credit")} filename={`gstr3b-itc-${range.from}-${range.to}.csv`} preamble={() => preamble(period)} />
            <Section
              title="6.1 Payment of tax" rows={pay} columns={taxOnly("Tax")} filename={`gstr3b-payment-${range.from}-${range.to}.csv`} preamble={() => preamble(period)}
              description="Credit is used in the order the GST Act allows: IGST credit first, CGST and SGST credit only on their own tax and then IGST. The tax on a reverse charge is always paid in cash. Indicative: interest, late fee and credit reversals are not included."
            />

            <Panel
              bodyClassName="p-0" title="Against the ledger"
              description="The tax of the documents above, against what the six GST accounts moved in the period."
              actions={allAgree ? <Pill tone="success"><CheckCircle2 className="h-3 w-3" aria-hidden="true" />Agrees</Pill> : <Pill tone="warning"><TriangleAlert className="h-3 w-3" aria-hidden="true" />Differs</Pill>}
            >
              <div className="erp-scroll table-pin-first overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Documents against the ledger</caption>
                  <thead className="bg-secondary/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th scope="col" className="px-3 py-2 ps-5 text-start">Account</th><th scope="col" className="px-3 py-2 text-end">Documents</th><th scope="col" className="px-3 py-2 text-end">Ledger</th><th scope="col" className="px-3 py-2 pe-5 text-end">Difference</th></tr>
                  </thead>
                  <tbody>
                    {rec.rows.map((r) => (
                      <tr key={r.label} className="border-t border-border">
                        <td className="px-3 py-2 ps-5">{r.label}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{money(r.documents)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">{r.ledger == null ? "not set up" : money(r.ledger)}</td>
                        <td className={`px-3 py-2 pe-5 text-end tabular-nums ${r.agrees ? "" : "text-status-warning"}`}>{r.difference == null ? "" : money(r.difference)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(rec.unsplit.output !== 0 || rec.unsplit.input !== 0) && (
                <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground">
                  Tax posted as one amount, with no CGST / SGST / IGST (expense vouchers, debit and credit notes, and documents made before the split): output {money(rec.unsplit.output)}, input {money(rec.unsplit.input)} {CURRENCY}. It is in the ledger but not in the tables above.
                </p>
              )}
            </Panel>
          </div>
        );
      }}
    </Frame>
  );
}
