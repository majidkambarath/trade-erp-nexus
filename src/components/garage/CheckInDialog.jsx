import React, { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "../ui/button";
import AttachmentPanel from "../accounting/AttachmentPanel.jsx";
import { jobCards, filesFor } from "../../lib/garageApi";
import { CHECK_IN_ITEMS, DAMAGE_KINDS, garageErrorText } from "../../lib/garage";
import { ErrorNote, Field, Modal, Select, Textarea, TextInput } from "../accounting/kit";

const emptyDamage = () => ({ panel: "", kind: "scratch", notes: "" });

// The walk-around, recorded separately from the estimate (jobCardService.recordCheckIn is a NARROW write - it
// touches nothing else on the card): what the customer had with them, any existing damage noted panel by
// panel, general condition, and the photos that back it up. This is the garage's only defence when a
// customer later claims the car arrived undamaged.
export default function CheckInDialog({ jobCardId, checkIn, onClose, onDone }) {
  const [items, setItems] = useState(() => new Set(checkIn?.itemsPresent || []));
  const [damage, setDamage] = useState(() => (checkIn?.damagePoints?.length ? checkIn.damagePoints.map((d) => ({ panel: d.panel || "", kind: d.kind || "scratch", notes: d.notes || "" })) : []));
  const [notes, setNotes] = useState(checkIn?.notes || "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const source = useMemo(() => filesFor("jobcard", jobCardId), [jobCardId]);

  const toggleItem = (name) => setItems((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const setRow = (i, patch) => setDamage((d) => d.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeRow = (i) => setDamage((d) => d.filter((_, idx) => idx !== i));

  async function submit() {
    // A damage row with a kind/notes typed but no panel named used to vanish silently on save (D11).
    if (damage.some((d) => !d.panel.trim() && (d.notes.trim() || d.kind !== "scratch"))) {
      setFailure({ message: "A damage mark has a kind or a note but no panel named. Name the panel, or remove the row." });
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const c = await jobCards.recordCheckIn(jobCardId, {
        itemsPresent: [...items],
        damagePoints: damage.filter((d) => d.panel.trim()),
        notes,
      });
      onDone(c, "Check-in recorded.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title="The walk-around"
      description="What the customer had with them, any existing damage, and photos - the garage's own record of how the car arrived."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save check-in"}</Button></>}
    >
      <div className="grid gap-5">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}

        <section aria-labelledby="ci-items">
          <h3 id="ci-items" className="mb-2 text-sm font-semibold">What they had with them</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {CHECK_IN_ITEMS.map((name) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={items.has(name)} onChange={() => toggleItem(name)} />
                {name}
              </label>
            ))}
          </div>
        </section>

        <section aria-labelledby="ci-damage">
          <h3 id="ci-damage" className="mb-2 text-sm font-semibold">Existing damage</h3>
          <div className="grid gap-2">
            {damage.map((d, i) => (
              <div key={i} className="grid grid-cols-[1fr_7rem_1fr_2.5rem] items-start gap-2 rounded-lg border p-2">
                <TextInput value={d.panel} onChange={(e) => setRow(i, { panel: e.target.value })} placeholder="Front bumper, rear door…" aria-label="Panel" />
                <Select value={d.kind} onChange={(e) => setRow(i, { kind: e.target.value })} aria-label="Kind of mark">
                  {DAMAGE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </Select>
                <TextInput value={d.notes} onChange={(e) => setRow(i, { notes: e.target.value })} placeholder="Notes…" aria-label="Notes" />
                <Button type="button" variant="outline" size="sm" onClick={() => removeRow(i)} aria-label="Remove"><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setDamage((d) => [...d, emptyDamage()])}><Plus className="me-1 h-4 w-4" /> Add a mark</Button>
          </div>
        </section>

        <Field label="Condition notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Fuel level, warning lights, anything else worth recording…" /></Field>

        <section aria-labelledby="ci-photos">
          <h3 id="ci-photos" className="mb-2 text-sm font-semibold">Photos</h3>
          <AttachmentPanel source={source} label="Check-in photos" />
        </section>
      </div>
    </Modal>
  );
}
