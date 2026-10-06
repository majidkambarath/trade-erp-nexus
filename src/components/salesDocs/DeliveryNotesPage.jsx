import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileStack, ShoppingCart } from "lucide-react";
import OrderForm from "../OrderEntry/OrderForm";
import { VARIANTS } from "../OrderEntry/variants";
import { loadFormForEdit } from "../OrderEntry/editForm";
import { Modal, useToasts } from "../accounting/kit";
import { Button } from "../ui/button";
import { deliveryNotes } from "../../lib/salesDocumentsApi";
import { newDeliveryNoteForm } from "../../lib/salesDocuments";
import DeliveryFromOrder from "./DeliveryFromOrder";
import DeliveryNoteList from "./DeliveryNoteList";
import DeliveryNoteView from "./DeliveryNoteView";
import { useOrderLookups } from "./hooks";

// Delivery notes: the list, one note, and the two ways to make one - against a sales order (part by part,
// the order's own prices), or on its own for goods that go out before they are invoiced.
//   ?open=<id>      opens a note       ?order=<id>   starts a note against that sales order
//   ?status=UNINVOICED   opens the list on the notes waiting for an invoice
export default function DeliveryNotesPage() {
  const [params] = useSearchParams();
  const [view, setView] = useState(() => (params.get("open") ? "view" : params.get("order") ? "order" : "list")); // list | view | order | create | edit
  const [openId, setOpenId] = useState(() => params.get("open"));
  const [orderId, setOrderId] = useState(() => params.get("order")); // only until the user moves on from the link they arrived by
  const [editing, setEditing] = useState(null); // the saved note being edited
  const [form, setForm] = useState(newDeliveryNoteForm);
  const [choosing, setChoosing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { customers, stockItems } = useOrderLookups();
  const { notify, toastNode } = useToasts();

  const bump = () => setReloadKey((k) => k + 1);
  const open = (id) => { setOpenId(id); setOrderId(null); setView("view"); setChoosing(false); window.scrollTo?.(0, 0); };
  const toList = () => { setView("list"); setEditing(null); setOrderId(null); setChoosing(false); bump(); };
  const startOrder = () => { setEditing(null); setOrderId(null); setChoosing(false); setView("order"); };
  const startManual = () => { setForm(newDeliveryNoteForm()); setEditing(null); setChoosing(false); setView("create"); };

  // A note against an order is edited by the order form (its lines are the order's); any other by the shared one.
  const edit = async (noteOrId) => {
    try {
      const id = typeof noteOrId === "string" ? noteOrId : noteOrId._id;
      const note = await deliveryNotes.get(id);
      if (note.source?.kind === "sales_order") {
        setEditing(note);
        setView("order");
      } else {
        setForm(await loadFormForEdit(VARIANTS.deliveryNote, id));
        setEditing({ id });
        setView("edit");
      }
    } catch (e) {
      notify(e.response?.data?.message || e.message, "error");
    }
  };

  return (
    <>
      {view === "list" && (
        <DeliveryNoteList
          onOpen={open} onNew={() => setChoosing(true)} onEdit={edit} notify={notify} reloadKey={reloadKey}
          initialStatus={params.get("status") || ""}
        />
      )}
      {view === "view" && openId && <DeliveryNoteView id={openId} notify={notify} onBack={toList} onEdit={edit} onChanged={bump} />}
      {view === "order" && (
        <DeliveryFromOrder
          orderId={editing ? null : orderId} editing={editing} customers={customers} notify={notify}
          onBack={editing ? () => open(editing._id) : toList} onSaved={(id) => { bump(); open(id); }}
        />
      )}
      {(view === "create" || view === "edit") && (
        <OrderForm
          variant={VARIANTS.deliveryNote}
          formData={form}
          setFormData={setForm}
          parties={customers}
          stockItems={stockItems}
          notify={notify}
          selected={editing}
          setActiveView={(v) => (v === "list" ? toList() : setView(v))}
          resetForm={() => setForm(newDeliveryNoteForm())}
          onSuccess={(doc) => { bump(); open(doc.id || doc._id); }}
          activeView={view}
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
