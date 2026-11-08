import React, { useMemo, useState } from "react";
import { Image as ImageIcon, Loader2, Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import { jobCards, filesFor } from "../../lib/garageApi";
import { CONDITIONS, CONDITION_LABEL, garageErrorText } from "../../lib/garage";
import { ErrorNote, Field, Modal, Select, TextInput } from "../accounting/kit";

const emptyRow = () => ({ item: "", condition: "ok", note: "", photos: [] });

// What the technician found, with the photographs that back it up - this is what the customer sees on
// the estimate link (components/send/EstimateApproval.jsx), which is why a photo matters here more than
// almost anywhere else in the module. jobCardService.recordInspection is a NARROW write, the same shape
// as recordCheckIn: it replaces the whole list, so this dialog edits a list and saves it in one call.
//
// Each row's photos are its OWN small set, not the job card's whole file list - AttachmentPanel (used for
// the check-in photos) lists everything one owner holds, which is right for a single flat gallery but
// wrong here: a brake-pad photo filed under "Battery" would be worse than no evidence at all. So this
// uploads straight through the same door (filesFor("jobcard", id).upload) and keeps each row's own
// attachment ids locally, rather than reusing the panel.
export default function InspectionDialog({ jobCardId, inspection, onClose, onDone }) {
  const [rows, setRows] = useState(() => (inspection?.length ? inspection.map((i) => ({ item: i.item || "", condition: i.condition || "ok", note: i.note || "", photos: [...(i.photos || [])] })) : [emptyRow()]));
  const [busy, setBusy] = useState(false);
  // A SET of row indices, not one scalar: a technician can start a photo on one row, then another on a
  // different row, before the first finishes. A single "which row is uploading" value would lose the
  // first row's spinner the moment the second starts, RE-ENABLE its input while its own upload was still
  // in flight, and a second click there would race the first - two uploads to one row, same closure over
  // `rows[i].photos`, the later one silently dropping the earlier photo.
  const [uploading, setUploading] = useState(() => new Set());
  const [failure, setFailure] = useState(null);
  const source = useMemo(() => filesFor("jobcard", jobCardId), [jobCardId]);

  const setRow = (i, patch) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeRow = (i) => setRows((r) => r.filter((_, idx) => idx !== i));
  // Appending a photo is its OWN functional update, not setRow(i, { photos: [...rows[i].photos, id] }):
  // that reads `rows` from the outer closure, captured at the moment the upload STARTED. If the user
  // removes an older photo from the same row while this one is still uploading, the removal and this
  // append would both be racing the same stale snapshot, and whichever write lands second wins outright -
  // so a completed upload can silently resurrect a photo the user just removed. Reading the row fresh
  // inside the updater, at the moment React actually applies it, closes that regardless of what else
  // happened to the row in between.
  const addPhotoToRow = (i, attachmentId) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, photos: [...row.photos, attachmentId] } : row)));
  const removePhoto = (i, attachmentId) => setRow(i, { photos: rows[i].photos.filter((p) => p !== attachmentId) });
  const markUploading = (i, on) => setUploading((s) => { const n = new Set(s); if (on) n.add(i); else n.delete(i); return n; });

  async function addPhoto(i, file) {
    if (!file || uploading.has(i)) return; // the input is disabled while this row's own upload is in flight, but guard the race anyway
    markUploading(i, true);
    setFailure(null);
    try {
      const saved = await source.upload(file);
      addPhotoToRow(i, saved.attachmentId);
    } catch (err) {
      setFailure(err);
    } finally {
      markUploading(i, false);
    }
  }

  async function submit() {
    const named = rows.filter((r) => r.item.trim());
    setBusy(true);
    setFailure(null);
    try {
      const c = await jobCards.recordInspection(jobCardId, { inspection: named.map((r) => ({ ...r, item: r.item.trim(), note: r.note.trim() })) });
      onDone(c, "Inspection recorded.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title="What was found"
      description="One item at a time, with a photo - this is what the customer sees on the estimate before they decide."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save inspection"}</Button></>}
    >
      <div className="grid gap-3">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}

        {rows.map((r, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3">
            <div className="grid grid-cols-[1fr_9rem_2.5rem] items-start gap-2">
              <Field label="What was checked"><TextInput value={r.item} onChange={(e) => setRow(i, { item: e.target.value })} placeholder="Front brake pads, battery…" aria-label="Item" /></Field>
              <Field label="Condition">
                <Select value={r.condition} onChange={(e) => setRow(i, { condition: e.target.value })} aria-label="Condition">
                  {CONDITIONS.map((k) => <option key={k} value={k}>{CONDITION_LABEL[k]}</option>)}
                </Select>
              </Field>
              <Button type="button" variant="outline" size="sm" className="mt-6" onClick={() => removeRow(i)} aria-label="Remove this item"><X className="h-4 w-4" /></Button>
            </div>
            <Field label="Note (what the customer should know)"><TextInput value={r.note} onChange={(e) => setRow(i, { note: e.target.value })} placeholder="2mm of pad left…" aria-label="Note" /></Field>

            <div className="flex flex-wrap items-center gap-2">
              {r.photos.map((id) => (
                <span key={id} className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2 py-1 text-xs">
                  <ImageIcon className="h-3 w-3" aria-hidden="true" /> Photo
                  <button type="button" onClick={() => removePhoto(i, id)} aria-label="Remove photo" className="ms-0.5 text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                </span>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                {uploading.has(i) ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
                Add photo
                <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading.has(i)} onChange={(e) => { addPhoto(i, e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setRows((r) => [...r, emptyRow()])}><Plus className="me-1 h-4 w-4" /> Add another item</Button>
      </div>
    </Modal>
  );
}
