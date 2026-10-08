import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Download, FileX, Loader2, Printer, WifiOff } from "lucide-react";
import { fetchShared, markViewed } from "../../lib/shareApi";
import { downloadSheetsPdf, printMarkup, sheetComponent, sheetMarkup } from "../PurchaseOrder/shared/documentPdf";
import { readAccent } from "../PurchaseOrder/shared/invoiceModel";
import { SHEET_DESIGN_WIDTH, buildFromShare, fitScale } from "./shareSheet";
import { formatDate } from "../../utils/format";

// The page a customer opens from the emailed or WhatsApp link: no sign-in, no menu, nothing of ours but
// the document and who it is from. It must not use the signed-in helpers (the company profile hook and
// the session both call the authenticated API, and would come back empty or send the visitor to a
// sign-in page they cannot use).

const button = "inline-flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

// One plain sentence per way a link can fail. Only a link that is real can name who to ask; for the rest
// the server has no company to give, so the wording has to stand without one.
export const problemText = (error) => {
  const who = error?.company;
  switch (error?.code) {
    case "SHARE_REVOKED":
      return { title: "This link has been withdrawn", text: who ? `${who} withdrew this link. Ask them to send the document again.` : "The sender withdrew this link. Ask them to send the document again." };
    case "SHARE_EXPIRED":
      return { title: "This link has expired", text: who ? `Document links stay open for a limited time. Ask ${who} for a new one.` : "Document links stay open for a limited time. Ask the sender for a new one." };
    case "SHARE_RATE_LIMIT":
      return { title: "Too many requests", text: "Please wait a few minutes and try again." };
    case "OFFLINE":
      return { title: "The document could not be loaded", text: "Check your connection and try again.", retry: true };
    case "SHARE_NOT_FOUND":
      return { title: "This link does not work", text: "It may have been typed wrongly, or the document has been withdrawn. Ask the sender to send it again." };
    default:
      return { title: "Something went wrong", text: "The document could not be shown. Try again, or ask the sender to send it again.", retry: true };
  }
};

// The A4 page, scaled to the width it has been given. The outer box is exactly as wide and as tall as the
// scaled page, so nothing around it is left with a gap or scrolls sideways.
function FitToWidth({ children }) {
  const outer = useRef(null);
  const inner = useRef(null);
  const [fit, setFit] = useState({ scale: 1, height: null });
  useLayoutEffect(() => {
    const measure = () => {
      const scale = fitScale(outer.current?.clientWidth);
      setFit({ scale, height: inner.current ? inner.current.offsetHeight * scale : null });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(outer.current);
    observer.observe(inner.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={outer} className="w-full">
      <div style={{ width: SHEET_DESIGN_WIDTH * fit.scale, height: fit.height ?? undefined, margin: "0 auto" }}>
        <div ref={inner} style={{ width: SHEET_DESIGN_WIDTH, transform: `scale(${fit.scale})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}

function Problem({ error, onRetry }) {
  const p = problemText(error);
  const Icon = error?.code === "OFFLINE" ? WifiOff : FileX;
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div role="alert" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-muted-foreground"><Icon className="h-6 w-6" aria-hidden="true" /></span>
        <h1 className="mt-4 text-lg font-semibold text-foreground">{p.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
        {p.retry && <button type="button" onClick={onRetry} className={`${button} mt-5`}>Try again</button>}
      </div>
    </main>
  );
}

export default function SharedDocument() {
  const { token } = useParams();
  const [state, setState] = useState({ status: "loading", data: null, error: null });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(() => {
    setState({ status: "loading", data: null, error: null });
    fetchShared(token).then(
      (payload) => setState({ status: "ready", data: payload, error: null }),
      (error) => setState({ status: "error", data: null, error })
    );
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Once the document is on screen, and only then, say so: this is what separates a person from a scanner.
  const shown = state.status === "ready";
  useEffect(() => { if (shown) markViewed(token); }, [shown, token]);

  if (state.status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Opening the document…</div>
      </main>
    );
  }
  if (state.status === "error") return <Problem error={state.error} onRetry={load} />;

  const doc = buildFromShare(state.data);
  if (!doc) return <Problem error={{ code: "ERROR" }} onRetry={load} />;
  const Sheet = sheetComponent(doc.sheet);
  const accent = readAccent();
  const company = doc.company;
  const markup = () => sheetMarkup(doc.sheet, { copy: doc.copies[0], accent });

  const download = async () => {
    setBusy(true);
    setSaveError("");
    try {
      await downloadSheetsPdf([markup()], doc.fileName);
    } catch (e) {
      setSaveError(`The PDF could not be created: ${e.message || "unknown error"}. Try Print, then save as PDF.`);
    } finally {
      setBusy(false);
    }
  };

  const reach = [company.phoneNumber, company.email].filter(Boolean).join(" · ");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1000px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {typeof company.logo === "string" && company.logo.startsWith("https://") && <img src={company.logo} alt="" className="h-9 w-auto max-w-[8rem] object-contain" />}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{company.companyName || "Document"}</p>
              <h1 className="truncate text-xs text-muted-foreground">{doc.title} {doc.number}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={download} disabled={busy} className={button}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              {busy ? "Creating PDF…" : "Download PDF"}
            </button>
            <button type="button" onClick={() => printMarkup(markup())} className={button}><Printer className="h-4 w-4" aria-hidden="true" />Print</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1000px] space-y-4 px-4 py-5 sm:px-6">
        {saveError && <p role="alert" className="rounded-lg bg-status-danger-soft px-3 py-2 text-sm font-semibold text-status-danger">{saveError}</p>}
        {/* the sheet is always white paper, whatever the theme: it is what gets printed and filed */}
        <div data-print-preview="" className="rounded-xl border border-border bg-secondary p-2 sm:p-8">
          <FitToWidth><div className="shadow-card"><Sheet {...doc.sheet} copy={doc.copies[0]} accent={accent} /></div></FitToWidth>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          This document was sent to you by {company.companyName || "the sender"}.{reach ? ` Questions? ${reach}.` : ""}
          {state.data.expiresAt ? ` This link works until ${formatDate(state.data.expiresAt)}.` : ""}
        </p>
      </main>
    </div>
  );
}
