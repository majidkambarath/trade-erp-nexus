import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FileStack, ShoppingCart } from "lucide-react";
import OrderForm from "../OrderEntry/OrderForm";
import { VARIANTS } from "../OrderEntry/variants";
import { loadFormForEdit } from "../OrderEntry/editForm";
import { Modal, useToasts } from "../accounting/kit";
import { Button } from "../ui/button";
import { goodsReceipts } from "../../lib/orderDocumentsApi";
import { newReceiptForm } from "../../lib/orderDocuments";
import GoodsReceivedList from "./GoodsReceivedList";
import GoodsReceivedView from "./GoodsReceivedView";
import ReceiptFromOrder from "./ReceiptFromOrder";
import { useTradeLookups } from "./hooks";

// Goods received: the list, one receipt, and the two ways to make one - against a purchase order (part by part, the order's
// own prices), or on its own for goods that came without one.
//   ?open=<id>    opens a receipt        ?order=<id>   starts a receipt against that purchase order
//   ?status=UNINVOICED   opens the list on the receipts waiting for an invoice
export default function GoodsReceivedPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [view, setView] = useState(() => (params.get("open") ? "view" : params.get("order") ? "order" : "list")); // list | view | order | create | edit
  const [openId, setOpenId] = useState(() => params.get("open"));
  const [orderId, setOrderId] = useState(() => params.get("order")); // only until the user moves on from the link they arrived by
  const [editing, setEditing] = useState(null); // the saved receipt being edited
  const [form, setForm] = useState(newReceiptForm);
  const [choosing, setChoosing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { parties: vendors, stockItems } = useTradeLookups("purchase");
  const { notify, toastNode } = useToasts();

  const bump = () => setReloadKey((k) => k + 1);
  const open = (id) => { setOpenId(id); setOrderId(null); setView("view"); setChoosing(false); window.scrollTo?.(0, 0); };
  const toList = () => { setView("list"); setEditing(null); setOrderId(null); setChoosing(false); bump(); };
  const startOrder = () => { setEditing(null); setOrderId(null); setChoosing(false); setView("order"); };
  const startManual = () => { setForm(newReceiptForm()); setEditing(null); setChoosing(false); setView("create"); };

  // A receipt against an order is edited by the order screen (its lines are the order's); any other by the shared form.
  const edit = async (receiptOrId) => {
    try {
      const id = typeof receiptOrId === "string" ? receiptOrId : receiptOrId._id;
      const receipt = await goodsReceipts.get(id);
      if (receipt.source?.kind === "purchase_order") {
        setEditing(receipt);
        setView("order");
      } else {
        setForm(await loadFormForEdit(VARIANTS.goodsReceived, id));
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
        <GoodsReceivedList
          onOpen={open} onNew={() => setChoosing(true)} onEdit={edit} notify={notify} reloadKey={reloadKey}
          initialStatus={params.get("status") || ""}
          onInvoiced={(invoice) => { bump(); navigate(`/purchase-order?search=${encodeURIComponent(invoice.transactionNo)}`); }}
        />
      )}
      {view === "view" && openId && <GoodsReceivedView id={openId} notify={notify} onBack={toList} onEdit={edit} onChanged={bump} />}
      {view === "order" && (
        <ReceiptFromOrder
          orderId={editing ? null : orderId} editing={editing} vendors={vendors} notify={notify}
          onBack={editing ? () => open(editing._id) : toList} onSaved={(id) => { bump(); open(id); }}
        />
      )}
      {(view === "create" || view === "edit") && (
        <OrderForm
          variant={VARIANTS.goodsReceived}
          formData={form}
          setFormData={setForm}
          parties={vendors}
          stockItems={stockItems}
          notify={notify}
          selected={editing}
          setActiveView={(v) => (v === "list" ? toList() : setView(v))}
          resetForm={() => setForm(newReceiptForm())}
          onSuccess={(doc) => { bump(); open(doc.id || doc._id); }}
          activeView={view}
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
