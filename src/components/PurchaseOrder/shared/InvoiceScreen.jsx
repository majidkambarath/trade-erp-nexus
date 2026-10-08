import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, History, Loader2, Printer, Send } from "lucide-react";
import DocumentAuditTrail from "../../audit/AuditTrail";
import { useToasts } from "../../accounting/kit";
import SendDialog from "../../send/SendDialog";
import SendHistory from "../../send/SendHistory";
import { SendStatusPill, sendSentence, sendStateOf, summaryOfSend } from "../../send/shared";
import { readAccent } from "./invoiceModel";
import { downloadSheetsPdf, printMarkup, sheetComponent, sheetMarkup, sheetsPdfFile } from "./documentPdf";
import { cn } from "../../../lib/utils";
import { statusClasses } from "../../../lib/status";

const COPIES = ["Customer copy", "Internal copy"];

// The page around the sheet: the actions, a note about missing settings, and the preview.
// Everything the document needs comes in as `sheet`; this component only handles the session.
// Print, the PDF and the list's downloads all render the same markup (documentPdf.js), so the
// preview, the print and the file cannot disagree.
//
// A document that is not an invoice can hand the screen more, all optional: `copies` (the names of the
// copies it prints), `actions` (its own buttons, ahead of the print ones), `banner` (what to know before
// reading it) and `footer` (what happened to it). `status` may be any label.
//
// `send` is what lets the document go to a customer (components/send): a descriptor { kind, id, number,
// title, companyName, party, notice, sourceType, lastSend }. A document that cannot be sent passes none and
// shows no Send button at all, not a disabled one.
export default function InvoiceScreen({ sheet, fileName, status, statusLabel, onBack, missingTrn, auditId, copies = COPIES, actions, banner, footer, send }) {
  const [copy, setCopy] = useState(copies[0]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sendOpen, setSendOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sent, setSent] = useState(send?.lastSend || null); // how it last went to the customer
  const { notify, toastNode } = useToasts();
  const accent = readAccent();
  const Sheet = sheetComponent(sheet);

  const handlePrint = () => printMarkup(sheetMarkup(sheet, { copy, accent }));

  const handleDownload = async () => {
    setBusy(true);
    setError("");
    try {
      const markups = copies.map((c) => sheetMarkup(sheet, { copy: c, accent }));
      await downloadSheetsPdf(markups, fileName);
    } catch (e) {
      console.error(e);
      setError(`The PDF could not be created: ${e.message || "unknown error"}. Try Print, then save as PDF.`);
    } finally {
      setBusy(false);
    }
  };

  // The customer copy as a file, drawn the same way the download draws it, for attaching to an email.
  const attachment = send ? { label: copies[0], build: () => sheetsPdfFile([sheetMarkup(sheet, { copy: copies[0], accent })], fileName) } : null;

  // Ctrl/Cmd+P prints the document, not the whole app shell behind it.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        printMarkup(sheetMarkup(sheet, { copy, accent }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, copy, accent]);

  const button =
    "inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

  return (
    <div className="mx-auto max-w-[1000px] space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className={button}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to list
          </button>
          {status && (
            <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", statusClasses(status))}>
              {statusLabel ?? status}
            </span>
          )}
          {send && sent && <SendStatusPill send={sent} />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <div className="inline-flex rounded-lg border border-input p-0.5 text-xs font-semibold" role="group" aria-label="Copy">
            {copies.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={copy === c}
                onClick={() => setCopy(c)}
                className={cn("rounded-md px-2.5 py-1.5", copy === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {c}
              </button>
            ))}
          </div>
          {send && sent && (
            <button type="button" onClick={() => setHistoryOpen(true)} className={button}>
              <History className="h-4 w-4" aria-hidden="true" />
              Send history
            </button>
          )}
          {auditId && (
            <button type="button" onClick={() => setAuditOpen(true)} className={button}>
              <History className="h-4 w-4" aria-hidden="true" />
              Audit trail
            </button>
          )}
          <button type="button" onClick={handleDownload} disabled={busy} className={button}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            {busy ? "Creating PDF…" : "Download PDF"}
          </button>
          {/* one strong button per screen: when the document brings its own actions (send, accept, deliver),
              they are the next step and Print steps back */}
          <button type="button" onClick={handlePrint} className={actions ? button : "erp-btn-primary"}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print
            <kbd className="ms-1 rounded border border-white/30 px-1 text-[11px] font-semibold opacity-80">Ctrl P</kbd>
          </button>
          {send && (
            <button type="button" onClick={() => setSendOpen(true)} className={button}>
              <Send className="h-4 w-4" aria-hidden="true" />
              Send
            </button>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-status-danger-soft px-3 py-2 text-sm font-semibold text-status-danger">
          {error}
        </p>
      )}

      {missingTrn && (
        <p className="rounded-lg border border-status-warning/40 bg-status-warning-soft px-3 py-2 text-sm text-foreground">
          Your TRN is not set. A tax invoice must show it, so add it in{" "}
          <Link to="/settings" className="font-semibold underline underline-offset-2">Settings</Link> before you issue this invoice.
        </p>
      )}

      {send && sent && (
        <p className={cn("rounded-lg border px-3 py-2 text-sm", sendStateOf(sent) === "FAILED" ? "border-status-danger/40 bg-status-danger-soft text-foreground" : "border-border bg-secondary/40 text-muted-foreground")}>
          {sendSentence(sent)}
        </p>
      )}

      {banner}

      {/* the sheet is always white paper: it is what gets printed and filed, whatever the theme */}
      <div data-print-preview="" className="overflow-x-auto rounded-xl border border-border bg-secondary p-4 sm:p-8">
        <div className="mx-auto w-fit shadow-card">
          <Sheet {...sheet} copy={copy} accent={accent} />
        </div>
      </div>

      {footer}

      {auditOpen && <DocumentAuditTrail id={auditId} onClose={() => setAuditOpen(false)} />}

      {toastNode}
      {sendOpen && (
        <SendDialog
          doc={send} attachment={attachment} notify={notify} onClose={() => setSendOpen(false)}
          onSent={(r) => { setSent(summaryOfSend(r.send)); send.onSent?.(r); }}
        />
      )}
      {historyOpen && <SendHistory sourceType={send.sourceType} sourceId={send.id} title={`${send.title} ${send.number}`} notify={notify} onClose={() => setHistoryOpen(false)} onChanged={(row) => row && setSent(summaryOfSend(row))} />}
    </div>
  );
}
