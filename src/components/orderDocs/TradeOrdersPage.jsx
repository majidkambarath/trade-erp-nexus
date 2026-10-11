import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import OrderForm from "../OrderEntry/OrderForm";
import { VARIANTS } from "../OrderEntry/variants";
import { loadFormForEdit } from "../OrderEntry/editForm";
import { useToasts } from "../accounting/kit";
import { newOrderForm } from "../../lib/orderDocuments";
import TradeOrderList from "./TradeOrderList";
import TradeOrderView from "./TradeOrderView";
import { useTradeLookups } from "./hooks";

// Orders: the list, one order, and the form that writes it. The shared order form does the writing (item search, tax codes,
// charges, quick-create), configured as a sales or purchase order by its variant. An order is a commitment: it posts nothing.
// `?open=<id>` opens one directly, which is how other screens link here.
export default function TradeOrdersPage({ kind }) {
  const variant = kind === "sales" ? VARIANTS.salesOrderDoc : VARIANTS.purchaseOrderDoc;
  const [params] = useSearchParams();
  const [view, setView] = useState(() => (params.get("open") ? "view" : "list")); // list | view | create | edit
  const [openId, setOpenId] = useState(() => params.get("open"));
  const [editing, setEditing] = useState(null); // { id } while editing a saved order
  const [form, setForm] = useState(() => newOrderForm(kind));
  const [reloadKey, setReloadKey] = useState(0);
  const { parties, stockItems } = useTradeLookups(kind);
  const { notify, toastNode } = useToasts();

  const bump = () => setReloadKey((k) => k + 1);
  const open = (id) => { setOpenId(id); setView("view"); window.scrollTo?.(0, 0); };
  const toList = () => { setView("list"); setEditing(null); bump(); };
  const create = () => { setForm(newOrderForm(kind)); setEditing(null); setView("create"); };
  const edit = async (id) => {
    try {
      setForm(await loadFormForEdit(variant, id));
      setEditing({ id });
      setView("edit");
    } catch (e) {
      notify(e.response?.data?.message || e.message, "error");
    }
  };

  return (
    <>
      {view === "list" && <TradeOrderList kind={kind} onOpen={open} onNew={create} onEdit={edit} notify={notify} reloadKey={reloadKey} />}
      {view === "view" && openId && <TradeOrderView kind={kind} id={openId} notify={notify} onBack={toList} onEdit={edit} onChanged={bump} />}
      {(view === "create" || view === "edit") && (
        <OrderForm
          variant={variant}
          formData={form}
          setFormData={setForm}
          parties={parties}
          stockItems={stockItems}
          notify={notify}
          selected={editing}
          setActiveView={(v) => (v === "list" ? toList() : setView(v))}
          resetForm={() => setForm(newOrderForm(kind))}
          onSuccess={(doc) => { bump(); open(doc.id || doc._id); }}
          activeView={view}
        />
      )}
      {toastNode}
    </>
  );
}
