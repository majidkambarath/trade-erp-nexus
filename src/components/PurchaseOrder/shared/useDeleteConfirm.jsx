import React, { useState } from "react";
import { ConfirmDialog } from "../../accounting/kit";

// One confirmation for every order delete: the user types "delete" before the record goes. The
// caller renders `dialog` once; `ask` opens it with the action to run when the word is typed.
//
//   const [askDelete, deleteDialog] = useDeleteConfirm();
//   askDelete({ title: "Delete SO-1?", text: "...", onConfirm: async () => { ... } });
//   ...
//   {deleteDialog}
export function useDeleteConfirm() {
  const [request, setRequest] = useState(null);
  const [busy, setBusy] = useState(false);

  const dialog = request ? (
    <ConfirmDialog
      title={request.title}
      text={request.text}
      confirmLabel="Delete"
      danger
      typeToConfirm="delete"
      busy={busy}
      onClose={() => {
        if (!busy) setRequest(null);
      }}
      onConfirm={async () => {
        setBusy(true);
        try {
          await request.onConfirm();
        } finally {
          setBusy(false);
          setRequest(null);
        }
      }}
    />
  ) : null;

  return [setRequest, dialog];
}
