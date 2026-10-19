import React, { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "../ui/button";
import { ConfirmDialog, Field, Modal, Pill, Select, TextInput, useToasts } from "../accounting/kit";
import { viewMatches } from "../../lib/savedViews";

// The saved-view picker in a list's toolbar. A view is a small list (typically under a dozen) so a native
// `<select>` is the right control here - the house rule to prefer SearchSelect is for a list that can be
// LONG, which this is not. "All" (no view chosen) is always first and cannot be removed.
//
//   <SavedViews list={list} />   // `list` is whatever useListView(...) returned
export default function SavedViews({ list }) {
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState(null); // the view being renamed
  const [deleting, setDeleting] = useState(null); // the view being deleted
  const { notify, toastNode } = useToasts();

  const current = list.views.find((v) => v.id === list.currentViewId) || null;
  const changed = !viewMatches(current, list); // `list` already carries search/filters/sort/hidden/density in the shape viewMatches expects

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Field label="View" className="w-full sm:w-52" labelClassName="sr-only">
        <Select value={list.currentViewId} onChange={(e) => list.goToView(e.target.value)} aria-label="View">
          <option value="">{list.DEFAULT_VIEW.name}</option>
          {list.views.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </Select>
      </Field>
      {changed && (
        <>
          <Pill tone="neutral">changed</Pill>
          <Button type="button" size="sm" variant="outline" onClick={() => setSaving(true)}>
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            Save {current ? "as a new view" : "view"}
          </Button>
          {current && (
            <Button type="button" size="sm" variant="ghost" onClick={() => list.goToView(current.id)}>
              Reset
            </Button>
          )}
        </>
      )}
      {current && !changed && (
        <>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(current)}>
            Rename
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDeleting(current)}>
            Delete
          </Button>
        </>
      )}

      {saving && (
        <SaveViewDialog
          onClose={() => setSaving(false)}
          onSave={(name, withSearch) => {
            const result = list.saveView(name, { withSearch });
            if (result.ok) { setSaving(false); notify(`"${name}" saved.`); }
            return result;
          }}
        />
      )}
      {renaming && (
        <RenameViewDialog
          view={renaming}
          onClose={() => setRenaming(null)}
          onRename={(name) => {
            const result = list.renameView(renaming.id, name);
            if (result.ok) setRenaming(null);
            return result;
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete "${deleting.name}"?`}
          text="The filters, sort and columns it remembers are gone; the rows themselves are not touched."
          confirmLabel="Delete"
          danger
          onClose={() => setDeleting(null)}
          onConfirm={() => { list.deleteView(deleting.id); setDeleting(null); notify(`"${deleting.name}" deleted.`); }}
        />
      )}
      {toastNode}
    </div>
  );
}

function SaveViewDialog({ onClose, onSave }) {
  const [name, setName] = useState("");
  const [withSearch, setWithSearch] = useState(false);
  const [error, setError] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Name it to save it."); return; }
    const result = onSave(trimmed, withSearch);
    if (!result.ok) setError(result.code === "DUPLICATE_NAME" ? "A view already has that name." : "Could not save that name.");
  };

  return (
    <Modal
      size="sm"
      title="Save view"
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit}>Save</Button></>}
    >
      <div className="grid gap-4">
        <Field label="Name" error={error} required>
          <TextInput value={name} onChange={(e) => { setName(e.target.value); setError(""); }} autoFocus maxLength={60} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={withSearch} onChange={(e) => setWithSearch(e.target.checked)} />
          <span>Also remember the search text</span>
        </label>
      </div>
    </Modal>
  );
}

function RenameViewDialog({ view, onClose, onRename }) {
  const [name, setName] = useState(view.name);
  const [error, setError] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Give it a name."); return; }
    const result = onRename(trimmed);
    if (!result.ok) setError(result.code === "DUPLICATE_NAME" ? "A view already has that name." : "Could not save that name.");
  };

  return (
    <Modal
      size="sm"
      title="Rename view"
      onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit}>Save</Button></>}
    >
      <Field label="Name" error={error} required>
        <TextInput value={name} onChange={(e) => { setName(e.target.value); setError(""); }} autoFocus maxLength={60} />
      </Field>
    </Modal>
  );
}
