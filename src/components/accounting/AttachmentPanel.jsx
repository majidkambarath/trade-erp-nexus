import React, { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Image as ImageIcon, Loader2, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { accounting, downloadAttachment, linkAttachment, uploadAttachment } from "../../lib/accountingApi";
import { cn } from "../../lib/utils";
import { ErrorNote } from "./kit";

// Mirrors the server's whitelist (services/core/attachmentService.js). The server re-checks the
// extension AND the file's contents; this only saves a round trip and gives a clearer message.
export const ALLOWED = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".xlsx", ".xls", ".csv", ".docx", ".doc", ".txt"];
export const MAX_BYTES = 10 * 1024 * 1024;

export const formatBytes = (n = 0) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function checkFile(file) {
  const ext = file.name.includes(".") ? `.${file.name.split(".").pop().toLowerCase()}` : "";
  if (!ALLOWED.includes(ext)) return `${file.name}: ${ext || "this file type"} is not allowed. Use ${ALLOWED.join(", ")}.`;
  if (file.size > MAX_BYTES) return `${file.name} is ${formatBytes(file.size)}; the limit is 10 MB.`;
  if (file.size === 0) return `${file.name} is empty.`;
  return null;
}

const iconFor = (type = "") =>
  type.startsWith("image/") ? ImageIcon : /sheet|excel|csv/.test(type) ? FileSpreadsheet : FileText;

// Attach supporting documents (supplier invoices, delivery notes, bank letters, statements).
//
//  - Saved document:  pass ownerType + ownerId. Files are uploaded and linked immediately, and the
//                     list is read from the server.
//  - New document:    omit ownerId and pass value + onChange. Files are uploaded now (unlinked) and
//                     the references kept in `value`; after the document is created, call
//                     linkPending(value, ownerType, newId).
export default function AttachmentPanel({ ownerType, ownerId, value, onChange, label = "Attachments", readOnly = false, className }) {
  const saved = Boolean(ownerId);
  const [items, setItems] = useState(value || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const input = useRef(null);

  const load = useCallback(async () => {
    if (!saved) return;
    try {
      setItems(await accounting.attachments(ownerType, ownerId));
    } catch (e) {
      setError(e);
    }
  }, [saved, ownerType, ownerId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!saved) setItems(value || []); }, [value, saved]);

  const push = (next) => {
    setItems(next);
    if (!saved) onChange?.(next);
  };

  async function addFiles(fileList) {
    const files = [...fileList];
    const problems = files.map(checkFile).filter(Boolean);
    if (problems.length) { setError(new Error(problems.join(" "))); }
    const ok = files.filter((f) => !checkFile(f));
    if (!ok.length) return;
    setBusy(true);
    if (!problems.length) setError(null);
    let next = items;
    for (const file of ok) {
      try {
        const ref = await uploadAttachment(file, saved ? { ownerType, ownerId } : {});
        next = [...next, ref];
        push(next);
      } catch (e) {
        setError(e);
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function remove(item) {
    try {
      await accounting.deleteAttachment(item.attachmentId);
      push(items.filter((x) => x.attachmentId !== item.attachmentId));
    } catch (e) {
      setError(e);
    }
  }

  async function download(item) {
    try { await downloadAttachment(item); } catch (e) { setError(e); }
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {label}
        {items.length > 0 && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>}
      </div>

      {!readOnly && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-input px-4 py-5 text-center transition-colors focus-within:ring-2 focus-within:ring-ring/40 hover:bg-accent",
            drag && "border-ring bg-accent",
            busy && "pointer-events-none opacity-70"
          )}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" /> : <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden="true" />}
          <span className="text-sm font-medium text-foreground">{busy ? "Uploading…" : "Drop files here or choose files"}</span>
          <span className="text-xs text-muted-foreground">PDF, images, Excel, CSV, Word · up to 10 MB each</span>
          <input
            ref={input}
            type="file"
            multiple
            aria-label={`Add ${label.toLowerCase()}`}
            accept={ALLOWED.join(",")}
            className="sr-only"
            onChange={(e) => addFiles(e.target.files)}
          />
        </label>
      )}

      {error && <div className="mt-2"><ErrorNote error={error} /></div>}

      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
          {items.map((it) => {
            const Icon = iconFor(it.fileType);
            return (
              <li key={it.attachmentId} className="flex items-center gap-3 px-3 py-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{it.fileName}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(it.fileSize)}{it.label ? ` · ${it.label}` : ""}</p>
                </div>
                <button type="button" onClick={() => download(it)} aria-label={`Download ${it.fileName}`} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
                  <Download className="h-4 w-4" aria-hidden="true" />
                </button>
                {!readOnly && (
                  <button type="button" onClick={() => remove(it)} aria-label={`Remove ${it.fileName}`} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-status-danger-soft hover:text-status-danger">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// After a new document is saved, attach the files that were uploaded while it was being typed.
export async function linkPending(refs = [], ownerType, ownerId) {
  const failed = [];
  for (const r of refs) {
    try { await linkAttachment(r.attachmentId, { ownerType, ownerId }); } catch { failed.push(r); }
  }
  return failed;
}
