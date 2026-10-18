import React, { useEffect, useState } from "react";
import OrderForm from "../OrderEntry/OrderForm";
import { VARIANTS } from "../OrderEntry/variants";
import { loadFormForEdit } from "../OrderEntry/editForm";
import { useToasts } from "../accounting/kit";
import { newQuotationForm } from "../../lib/salesDocuments";
import { useRecordRoute } from "../../lib/useRecordRoute";
import QuotationList from "./QuotationList";
import QuotationView from "./QuotationView";
import { useOrderLookups } from "./hooks";

// Quotations: the list, one quotation, and the form that writes it. The shared order form does the
// writing (item search, tax codes, charges, quick-create), configured as a quotation by its variant.
// What is open lives in the URL (?open=<id>&mode=view|edit|create), not component state: the browser
// Back button returns to the list, a reload reopens the same quotation, and the address can be shared.
export default function QuotationsPage() {
  const route = useRecordRoute();
  const view = route.recordMode || "list"; // list | view | edit | create
  const [editing, setEditing] = useState(null); // { id } while editing a saved quotation
  const [form, setForm] = useState(newQuotationForm);
  const [reloadKey, setReloadKey] = useState(0);
  const { customers, stockItems } = useOrderLookups();
  const { notify, toastNode } = useToasts();

  // a reload (or a shared link) landing directly on ?mode=edit has no form state yet: load it before
  // the edit form can show. A normal in-app `edit()` click already has it, so this only fires once.
  useEffect(() => {
    if (view !== "edit" || editing?.id === route.recordId || !route.recordId) return;
    loadFormForEdit(VARIANTS.quotation, route.recordId)
      .then((f) => { setForm(f); setEditing({ id: route.recordId }); })
      .catch((e) => { notify(e.response?.data?.message || e.message, "error"); route.open(route.recordId, "view"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, route.recordId]);

  const bump = () => setReloadKey((k) => k + 1);
  const toList = () => { setEditing(null); route.close(); bump(); };
  const create = () => { setForm(newQuotationForm()); setEditing(null); route.open(null, "create"); };
  const edit = async (id) => {
    try {
      setForm(await loadFormForEdit(VARIANTS.quotation, id));
      setEditing({ id });
      route.open(id, "edit");
    } catch (e) {
      notify(e.response?.data?.message || e.message, "error");
    }
  };

  return (
    <>
      {view === "list" && <QuotationList onOpen={(id) => route.open(id)} onNew={create} onEdit={edit} notify={notify} reloadKey={reloadKey} />}
      {view === "view" && route.recordId && (
        <QuotationView id={route.recordId} notify={notify} onBack={toList} onEdit={edit} onOpenQuotation={(id) => route.open(id)} onChanged={bump} />
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
          setActiveView={(v) => (v === "list" ? toList() : null)}
          resetForm={() => setForm(newQuotationForm())}
          onSuccess={(doc) => { bump(); route.replace(doc.id || doc._id, "view"); }}
          activeView={view}
        />
      )}
      {toastNode}
    </>
  );
}
