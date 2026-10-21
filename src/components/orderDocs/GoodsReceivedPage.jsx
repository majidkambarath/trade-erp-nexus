import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileStack, ShoppingCart } from "lucide-react";
import OrderForm from "../OrderEntry/OrderForm";
import { VARIANTS } from "../OrderEntry/variants";
import { loadFormForEdit } from "../OrderEntry/editForm";
import { Modal, Spinner, useToasts } from "../accounting/kit";
import { Button } from "../ui/button";
import { goodsReceipts } from "../../lib/orderDocumentsApi";
import { newReceiptForm } from "../../lib/orderDocuments";
import { useRecordRoute } from "../../lib/useRecordRoute";
import GoodsReceivedList from "./GoodsReceivedList";
import GoodsReceivedView from "./GoodsReceivedView";
import ReceiptFromOrder from "./ReceiptFromOrder";
import { useTradeLookups } from "./hooks";

const isOrderSourced = (r) => r?.source?.kind === "purchase_order";

// Goods received: the list, one receipt, and the two ways to make one - against a purchase order (part by part, the order's
// own prices), or on its own for goods that came without one. What is open lives in the URL, not component state (the
// same pattern as DeliveryNotesPage, its sales-side twin):
//   ?open=<id>&mode=view       a receipt          ?open=<id>&mode=edit   a receipt being edited
//   ?open=<orderId>&mode=order   starting a receipt against that purchase order (or ?order=<id> on arrival)
//   ?mode=create                on its own          ?status=UNINVOICED   opens the list on that tab
export default function GoodsReceivedPage() {
  const route = useRecordRoute();
  const [params] = useSearchParams(); // entry-point params only: status, and the order= this page arrived on
  const navigate = useNavigate();
  const [editing, setEditing] = useState(null); // the saved receipt being edited, of either kind
  const [form, setForm] = useState(newReceiptForm);
  const [choosing, setChoosing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { parties: vendors, stockItems } = useTradeLookups("purchase");
  const { notify, toastNode } = useToasts();

  // A deep link naming a purchase order starts a receipt against it straight away, with no redirect round
  // trip - read directly so the list is never rendered even for a single frame.
  const entryOrderId = params.get("order");
  const view = route.recordMode || (!route.recordId && entryOrderId ? "order" : "list"); // list | view | order | create | edit
  const editedId = editing?._id || editing?.id || null;

  // Editing a receipt whose kind (order-sourced or manual) is not yet known - a fresh click from the list
  // already has the row and sets `editing` synchronously, so this only fires on a reload or a shared link.
  useEffect(() => {
    if (view !== "edit" || !route.recordId || editedId === route.recordId) return;
    goodsReceipts
      .get(route.recordId)
      .then((r) => {
        if (isOrderSourced(r)) setEditing(r);
        else return loadFormForEdit(VARIANTS.goodsReceived, route.recordId).then((f) => { setForm(f); setEditing({ id: route.recordId }); });
      })
      .catch((e) => { notify(e.response?.data?.message || e.message, "error"); route.open(route.recordId, "view"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, route.recordId]);

  const bump = () => setReloadKey((k) => k + 1);
  const open = (id) => { setEditing(null); setChoosing(false); route.open(id); };
  const toList = () => { setEditing(null); setChoosing(false); route.close(); bump(); };
  const startOrder = () => { setEditing(null); setChoosing(false); route.open(null, "order"); };
  const startManual = () => { setForm(newReceiptForm()); setEditing(null); setChoosing(false); route.open(null, "create"); };

  // A receipt against an order is edited by the order screen (its lines are the order's); any other by the shared form.
  const edit = async (receiptOrId) => {
    const row = typeof receiptOrId === "string" ? null : receiptOrId;
    const id = row ? row._id : receiptOrId;
    route.open(id, "edit");
    if (!row) return; // the fetch effect above takes it from here
    if (isOrderSourced(row)) { setEditing(row); return; }
    try {
      setForm(await loadFormForEdit(VARIANTS.goodsReceived, id));
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
        <GoodsReceivedList
          onOpen={open} onNew={() => setChoosing(true)} onEdit={edit} notify={notify} reloadKey={reloadKey}
          initialStatus={params.get("status") || ""}
          onInvoiced={(invoice) => { bump(); navigate(`/purchase-order?search=${encodeURIComponent(invoice.transactionNo)}`); }}
        />
      )}
      {view === "view" && route.recordId && <GoodsReceivedView id={route.recordId} notify={notify} onBack={toList} onEdit={edit} onChanged={bump} />}
      {(view === "order" || (view === "edit" && editing && isOrderSourced(editing))) && (
        <ReceiptFromOrder
          orderId={editing ? null : startAgainstOrderId} editing={editing} vendors={vendors} notify={notify}
          onBack={editing ? () => route.open(editedId, "view") : toList}
          onSaved={(id) => { bump(); open(id); }}
        />
      )}
      {view === "edit" && !editing && <Spinner label="Loading the receipt" />}
      {(view === "create" || (view === "edit" && editing && !isOrderSourced(editing))) && (
        <OrderForm
          variant={VARIANTS.goodsReceived}
          formData={form}
          setFormData={setForm}
          parties={vendors}
          stockItems={stockItems}
          notify={notify}
          selected={editing}
          setActiveView={(v) => (v === "list" ? toList() : null)}
          resetForm={() => setForm(newReceiptForm())}
          onSuccess={(doc) => { bump(); route.replace(doc.id || doc._id, "view"); }}
          activeView={view === "edit" ? "edit" : "create"}
        />
      )}

      {choosing && (
        <Modal
          size="md" title="New goods receipt" onClose={() => setChoosing(false)}
          description="How did these goods arrive?"
          footer={<Button variant="outline" onClick={() => setChoosing(false)}>Cancel</Button>}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={startOrder} className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-start hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ShoppingCart className="h-5 w-5 text-brand" aria-hidden="true" />
              <span className="font-semibold">Against a purchase order</span>
              <span className="text-sm text-muted-foreground">Receive all or part of an order, in one or several loads. The order's prices apply and it tracks what is left.</span>
            </button>
            <button type="button" onClick={startManual} className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-start hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <FileStack className="h-5 w-5 text-brand" aria-hidden="true" />
              <span className="font-semibold">On its own</span>
              <span className="text-sm text-muted-foreground">Goods that came without an order. You enter the items and the price the vendor charges.</span>
            </button>
          </div>
        </Modal>
      )}
      {toastNode}
    </>
  );
}
