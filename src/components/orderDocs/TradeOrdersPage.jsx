import React, { useEffect, useState } from "react";
import OrderForm from "../OrderEntry/OrderForm";
import { VARIANTS } from "../OrderEntry/variants";
import { loadFormForEdit } from "../OrderEntry/editForm";
import { useToasts } from "../accounting/kit";
import { newOrderForm } from "../../lib/orderDocuments";
import { useRecordRoute } from "../../lib/useRecordRoute";
import TradeOrderList from "./TradeOrderList";
import TradeOrderView from "./TradeOrderView";
import { useTradeLookups } from "./hooks";

// Orders: the list, one order, and the form that writes it. The shared order form does the writing (item search, tax codes,
// charges, quick-create), configured as a sales or purchase order by its variant. An order is a commitment: it posts nothing.
// What is open lives in the URL (?open=<id>&mode=view|edit|create), not component state: the browser Back button returns
// to the list, a reload reopens the same order, and the address can be shared.
export default function TradeOrdersPage({ kind }) {
  const variant = kind === "sales" ? VARIANTS.salesOrderDoc : VARIANTS.purchaseOrderDoc;
  const route = useRecordRoute();
  const view = route.recordMode || "list"; // list | view | edit | create
  const [editing, setEditing] = useState(null); // { id } while editing a saved order
  const [form, setForm] = useState(() => newOrderForm(kind));
  const [reloadKey, setReloadKey] = useState(0);
  const { parties, stockItems } = useTradeLookups(kind);
  const { notify, toastNode } = useToasts();

  // a reload (or a shared link) landing directly on ?mode=edit has no form state yet
  useEffect(() => {
    if (view !== "edit" || editing?.id === route.recordId || !route.recordId) return;
    loadFormForEdit(variant, route.recordId)
      .then((f) => { setForm(f); setEditing({ id: route.recordId }); })
      .catch((e) => { notify(e.response?.data?.message || e.message, "error"); route.open(route.recordId, "view"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, route.recordId]);

  const bump = () => setReloadKey((k) => k + 1);
  const toList = () => { setEditing(null); route.close(); bump(); };
  const create = () => { setForm(newOrderForm(kind)); setEditing(null); route.open(null, "create"); };
  const edit = async (id) => {
    try {
      setForm(await loadFormForEdit(variant, id));
      setEditing({ id });
      route.open(id, "edit");
    } catch (e) {
      notify(e.response?.data?.message || e.message, "error");
    }
  };

  return (
    <>
      {view === "list" && <TradeOrderList kind={kind} onOpen={(id) => route.open(id)} onNew={create} onEdit={edit} notify={notify} reloadKey={reloadKey} />}
      {view === "view" && route.recordId && <TradeOrderView kind={kind} id={route.recordId} notify={notify} onBack={toList} onEdit={edit} onChanged={bump} />}
      {(view === "create" || view === "edit") && (
        <OrderForm
          variant={variant}
          formData={form}
          setFormData={setForm}
          parties={parties}
          stockItems={stockItems}
          notify={notify}
          selected={editing}
          setActiveView={(v) => (v === "list" ? toList() : null)}
          resetForm={() => setForm(newOrderForm(kind))}
          onSuccess={(doc) => { bump(); route.replace(doc.id || doc._id, "view"); }}
          activeView={view}
        />
      )}
      {toastNode}
    </>
  );
}
