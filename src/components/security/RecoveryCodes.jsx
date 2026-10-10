import React, { useState } from "react";
import { Copy, Download } from "lucide-react";
import { formatDate } from "../../utils/format";
import { recoveryCodesFileName, recoveryCodesText } from "../../lib/twoFactorForms";

// The ten recovery codes, shown ONCE (the server keeps only hashes, so a lost copy is replaced, never recovered). They can be
// copied or saved as a file, and the person confirms they have kept them before the screen lets go.
export default function RecoveryCodes({ codes, account, issuer, onDone, doneLabel = "Done", notice }) {
  const [saved, setSaved] = useState(false);
  const [note, setNote] = useState("");
  const text = recoveryCodesText(codes, { account, issuer, date: formatDate(new Date()) });

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setNote("Copied");
    } catch {
      setNote("Copying is not available here. Select the codes and copy them, or save the file.");
    }
  }

  function download() {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = recoveryCodesFileName(account);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote("Saved");
    } catch {
      setNote("Saving a file is not available here. Copy the codes instead.");
    }
  }

  return (
    <div className="grid gap-4">
      {notice && <p className="text-sm text-foreground">{notice}</p>}
      <p className="text-sm text-muted-foreground">
        If you lose your phone, each of these signs you in once, in place of the code from your app. They are shown only now. Keep them somewhere safe and private.
      </p>
      <ul aria-label="Recovery codes" className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/50 p-3 font-mono text-sm tabular-nums sm:grid-cols-2">
        {codes.map((code) => <li key={code} className="select-all rounded-md bg-card px-3 py-2 text-center">{code}</li>)}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="inline-flex h-11 items-center gap-2 rounded-full border border-input bg-card px-4 text-sm font-medium hover:bg-accent md:h-10">
          <Copy className="h-4 w-4" aria-hidden="true" />Copy
        </button>
        <button type="button" onClick={download} className="inline-flex h-11 items-center gap-2 rounded-full border border-input bg-card px-4 text-sm font-medium hover:bg-accent md:h-10">
          <Download className="h-4 w-4" aria-hidden="true" />Save as a file
        </button>
        <span role="status" className="self-center text-xs text-muted-foreground">{note}</span>
      </div>
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="mt-0.5 h-4 w-4 accent-foreground" />
        I have saved these codes somewhere safe
      </label>
      <div>
        <button type="button" onClick={onDone} disabled={!saved} className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-60 md:h-10">
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
