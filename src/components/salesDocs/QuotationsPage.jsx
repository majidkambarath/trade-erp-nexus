import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import OrderForm from "../OrderEntry/OrderForm";
import { VARIANTS } from "../OrderEntry/variants";
import { loadFormForEdit } from "../OrderEntry/editForm";
import { useToasts } from "../accounting/kit";
import { newQuotationForm } from "../../lib/salesDocuments";
import QuotationList from "./QuotationList";
import QuotationView from "./QuotationView";
import { useOrderLookups } from "./hooks";

// Quotations: the list, one quotation, and the form that writes it. The shared order form does the
// writing (item search, tax codes, charges, quick-create), configured as a quotation by its variant.
// `?open=<id>` opens one directly, which is how other screens link here.
export default function QuotationsPage() {
  const [params] = useSearchParams();
  const [view, setView] = useState(() => (params.get("open") ? "view" : "list")); // list | view | create | edit
  const [openId, setOpenId] = useState(() => params.get("open"));
  const [editing, setEditing] = useState(null); // { id } while editing a saved quotation
  const [form, setForm] = useState(newQuotationForm);
  const [reloadKey, setReloadKey] = useState(0);
  const { customers, stockItems } = useOrderLookups();
  const { notify, toastNode } = useToasts();

  const bump = () => setReloadKey((k) => k + 1);
  const open = (id) => {
    setOpenId(id);
    setView("view");
    window.scrollTo?.(0, 0);
  };
  const toList = () => { setView("list"); setEditing(null); bump(); };
  const create = () => { setForm(newQuotationForm()); setEditing(null); setView("create"); };
  const edit = async (id) => {
    try {
      setForm(await loadFormForEdit(VARIANTS.quotation, id));
      setEditing({ id });
      setView("edit");
    } catch (e) {
      notify(e.response?.data?.message || e.message, "error");
    }
  };

  return (
    <>
      {view === "list" && <QuotationList onOpen={open} onNew={create} onEdit={edit} notify={notify} reloadKey={reloadKey} />}
      {view === "view" && openId && (
        <QuotationView id={openId} notify={notify} onBack={toList} onEdit={edit} onOpenQuotation={open} onChanged={bump} />
      )}
      {(view === "create" || view === "edit") && (
        <OrderForm
          variant={VARIANTS.quotation}
          formData={form}
          setFormData={setForm}
          parties={customers}
          stockItems={stockItems}
          notify={notify}
          selected={editing}
          setActiveView={(v) => (v === "list" ? toList() : setView(v))}
          resetForm={() => setForm(newQuotationForm())}
          onSuccess={(doc) => { bump(); open(doc.id || doc._id); }}
          activeView={view}
        />
      )}
      {toastNode}
    </>
  );
}
