import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileStack, ShoppingCart } from "lucide-react";
import OrderForm from "../OrderEntry/OrderForm";
import { VARIANTS } from "../OrderEntry/variants";
import { loadFormForEdit } from "../OrderEntry/editForm";
import { Modal, Spinner, useToasts } from "../accounting/kit";
import { Button } from "../ui/button";
import { deliveryNotes } from "../../lib/salesDocumentsApi";
import { newDeliveryNoteForm } from "../../lib/salesDocuments";
import { useRecordRoute } from "../../lib/useRecordRoute";
import DeliveryFromOrder from "./DeliveryFromOrder";
import DeliveryNoteList from "./DeliveryNoteList";
import DeliveryNoteView from "./DeliveryNoteView";
import { useOrderLookups } from "./hooks";

const isOrderSourced = (note) => note?.source?.kind === "sales_order" || note?.source?.kind === "trade_order";

// Delivery notes: the list, one note, and the two ways to make one - against a sales order (part by part,
// the order's own prices), or on its own for goods that go out before they are invoiced. What is open lives
// in the URL, not component state, the same as Quotations:
//   ?open=<id>&mode=view            a note
//   ?open=<id>&mode=edit            a note being edited (order-sourced or manual - found out by fetching it)
//   ?open=<orderId>&mode=order      starting a note against that sales order (or ?order=/?tradeOrder= on arrival)
//   ?mode=create                    a manual note, on its own
//   ?status=UNINVOICED              opens the list on the notes waiting for an invoice
export default function DeliveryNotesPage() {
  const route = useRecordRoute();
  const [params] = useSearchParams(); // entry-point params only: status, and the first order= this page saw
  const tradeLink = Boolean(params.get("tradeOrder"));
  const [editing, setEditing] = useState(null); // the saved note being edited, of either kind
  const [form, setForm] = useState(newDeliveryNoteForm);
  const [choosing, setChoosing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { customers, stockItems } = useOrderLookups();
  const { notify, toastNode } = useToasts();

  // A deep link naming a sales order (?order=/?tradeOrder=) starts a note against it straight away, with
  // no redirect round trip - read directly so the list is never rendered even for a single frame.
  const entryOrderId = params.get("order") || params.get("tradeOrder");
  const view = route.recordMode || (!route.recordId && entryOrderId ? "order" : "list"); // list | view | order | create | edit
  const editedId = editing?._id || editing?.id || null;

  // Editing a note whose kind (order-sourced or manual) is not yet known - on a fresh click `edit()` already
  // has the row and sets `editing` synchronously, so this only does the fetch on a reload or a shared link.
  useEffect(() => {
    if (view !== "edit" || !route.recordId || editedId === route.recordId) return;
    deliveryNotes
      .get(route.recordId)
      .then((note) => {
        if (isOrderSourced(note)) setEditing(note);
        else return loadFormForEdit(VARIANTS.deliveryNote, route.recordId).then((f) => { setForm(f); setEditing({ id: route.recordId }); });
      })
      .catch((e) => { notify(e.response?.data?.message || e.message, "error"); route.open(route.recordId, "view"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, route.recordId]);

  const bump = () => setReloadKey((k) => k + 1);
  const open = (id) => { setEditing(null); setChoosing(false); route.open(id); };
  const toList = () => { setEditing(null); setChoosing(false); route.close(); bump(); };
  const startOrder = () => { setEditing(null); setChoosing(false); route.open(null, "order"); };
  const startManual = () => { setForm(newDeliveryNoteForm()); setEditing(null); setChoosing(false); route.open(null, "create"); };

  // A note against an order is edited by the order form (its lines are the order's); any other by the shared one.
  const edit = async (noteOrId) => {
    const row = typeof noteOrId === "string" ? null : noteOrId;
    const id = row ? row._id : noteOrId;
    route.open(id, "edit");
    if (!row) return; // the fetch effect above takes it from here
    if (isOrderSourced(row)) { setEditing(row); return; }
    try {
      setForm(await loadFormForEdit(VARIANTS.deliveryNote, id));
      setEditing({ id });
    } catch (e) {
      notify(e.response?.data?.message || e.message, "error");
      route.open(id, "view");
    }
  };

  const startAgainstOrderId = view === "order" && !editing ? route.recordId || entryOrderId : null;

  return (
    <>
      {view === "list" && (
        <DeliveryNoteList
          onOpen={open} onNew={() => setChoosing(true)} onEdit={edit} notify={notify} reloadKey={reloadKey}
          initialStatus={params.get("status") || ""}
        />
      )}
      {view === "view" && route.recordId && <DeliveryNoteView id={route.recordId} notify={notify} onBack={toList} onEdit={edit} onChanged={bump} />}
      {(view === "order" || (view === "edit" && editing && isOrderSourced(editing))) && (
        <DeliveryFromOrder
          orderId={editing ? null : startAgainstOrderId} editing={editing} customers={customers} notify={notify} tradeLink={tradeLink}
          onBack={editing ? () => route.open(editedId, "view") : toList}
          onSaved={(id) => { bump(); open(id); }}
        />
      )}
      {view === "edit" && !editing && <Spinner label="Loading the note" />}
      {(view === "create" || (view === "edit" && editing && !isOrderSourced(editing))) && (
        <OrderForm
          variant={VARIANTS.deliveryNote}
          formData={form}
          setFormData={setForm}
          parties={customers}
          stockItems={stockItems}
          notify={notify}
          selected={editing}
          setActiveView={(v) => (v === "list" ? toList() : null)}
          resetForm={() => setForm(newDeliveryNoteForm())}
          onSuccess={(doc) => { bump(); route.replace(doc.id || doc._id, "view"); }}
          activeView={view === "edit" ? "edit" : "create"}
        />
      )}

      {choosing && (
        <Modal
          size="md" title="New delivery note" onClose={() => setChoosing(false)}
          description="How are these goods being sent?"
          footer={<Button variant="outline" onClick={() => setChoosing(false)}>Cancel</Button>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={startOrder} className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-start hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ShoppingCart className="h-5 w-5 text-brand" aria-hidden="true" />
              <span className="font-semibold">Against a sales order</span>
              <span className="text-sm text-muted-foreground">Deliver all or part of an order, in one or several loads. The order's prices apply and it tracks what is left.</span>
            </button>
            <button type="button" onClick={startManual} className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-start hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <FileStack className="h-5 w-5 text-brand" aria-hidden="true" />
              <span className="font-semibold">On its own</span>
              <span className="text-sm text-muted-foreground">The goods go first and are invoiced after, one note or a month of them on one invoice.</span>
            </button>
          </div>
        </Modal>
      )}
      {toastNode}
    </>
  );
}
