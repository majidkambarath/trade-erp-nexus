// What the garage screens share: the pickers (items - parts AND labour, customers, vendors, staff and
// assignees) and the small dialog for marking a task done, used from both the Board (GarageBoard.jsx) and
// the job card itself (JobCardView.jsx). Follows components/Inventory/productionShared.jsx for the same job.
import React, { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { api } from "../../lib/accountingApi";
import { jobCards, partyChoices, setup } from "../../lib/garageApi";
import { pickerLabel, isService } from "../../lib/itemTypes";
import { garageErrorText } from "../../lib/garage";
import { Field, Modal, TextInput, useAsync, ErrorNote } from "../accounting/kit";

export function useGarageMasters() {
  const stocks = useAsync(() => api.get("/stock/stock"), []);
  const customers = useAsync(() => partyChoices.customers({ limit: 500 }), []);
  const vendors = useAsync(() => partyChoices.vendors({ limit: 500 }), []);
  const staff = useAsync(() => jobCards.staff(), []);
  const bays = useAsync(() => setup.bays(), []);
  const services = useAsync(() => setup.services(), []);

  return useMemo(() => {
    const items = stocks.data?.stocks || [];
    return {
      loading: stocks.loading || customers.loading || vendors.loading || staff.loading,
      bayOptions: (bays.data || []).map((b) => ({ value: b._id, label: b.name, hint: b.code })),
      serviceMenuOptions: (services.data || []).map((s) => ({ value: s._id, label: s.name, hint: s.code })),
      items,
      // A single picker for every line kind: parts and consumables are goods, labour and sublet are
      // services, and the item master (not what the line is called) is what actually governs posting.
      itemOptions: items.map((s) => ({ value: s._id, label: pickerLabel(s), hint: s.itemId, service: isService(s), searchText: `${s.itemId} ${s.sku || ""}` })),
      partOptions: items.filter((s) => !isService(s)).map((s) => ({ value: s._id, label: pickerLabel(s), hint: s.itemId })),
      serviceOptions: items.filter(isService).map((s) => ({ value: s._id, label: pickerLabel(s), hint: s.itemId })),
      itemsById: new Map(items.map((s) => [String(s._id), s])),
      customerOptions: (customers.data || []).map((c) => ({ value: c.id, label: c.name, hint: c.code })),
      customersById: new Map((customers.data || []).map((c) => [c.id, c])),
      insurerOptions: (customers.data || []).filter((c) => c.isInsurer).map((c) => ({ value: c.id, label: c.name, hint: c.code })),
      vendorOptions: (vendors.data || []).map((v) => ({ value: v.id, label: v.name, hint: v.code })),
      staffOptions: (staff.data || []).map((s) => ({ value: s.id, label: s.name, hint: s.designation })),
    };
  }, [stocks.data, stocks.loading, customers.data, customers.loading, vendors.data, vendors.loading, staff.data, staff.loading, bays.data, services.data]);
}

// Marking a task done (or skipped): the hours actually taken, defaulting to the task's own standard hours
// when left blank. Shared by the Board's "My work" panel and the job card's own task list.
export function CompleteTaskDialog({ jobCardId, task, onClose, onDone }) {
  const [hours, setHours] = useState("");
  const [skip, setSkip] = useState(false);
  const [holdReason, setHoldReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      await jobCards.completeTask(
        jobCardId,
        task.taskId || task._id,
        skip ? { skip: true, holdReason: holdReason || undefined } : { actualHours: hours === "" ? undefined : Number(hours) }
      );
      onDone(`${task.taskName || task.name} ${skip ? "skipped" : "done"}.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={task.taskName || task.name}
      description={task.jobNo ? `On ${task.jobNo}, ${task.vehicle}.` : undefined}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : skip ? "Mark skipped" : "Mark done"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={new Error(garageErrorText(failure))} />}
        {!skip && (
          <Field label="Hours actually taken" hint="Leave blank to use the standard hours for this task.">
            <TextInput type="number" min="0" step="any" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours actually taken" autoFocus />
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
          The customer declined this job after the card was released - skip it instead
        </label>
        {skip && (
          <Field label="Why (optional)">
            <TextInput value={holdReason} onChange={(e) => setHoldReason(e.target.value)} aria-label="Why it is skipped" />
          </Field>
        )}
      </div>
    </Modal>
  );
}
