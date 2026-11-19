import React, { useEffect, useState } from "react";
import OrderForm from "../OrderEntry/OrderForm";
import { VARIANTS } from "../OrderEntry/variants";
import { loadFormForEdit } from "../OrderEntry/editForm";
import { useToasts } from "../accounting/kit";
import { useRecordRoute } from "../../lib/useRecordRoute";
import { newRecurringForm } from "../../lib/recurring";
import { useOrderLookups } from "../salesDocs/hooks";
import RecurringList from "./RecurringList";
import ScheduleFields from "./ScheduleFields";

const schedule = (props) => <ScheduleFields {...props} />;

// Recurring invoices: the list, and the shared order form configured as a template (VARIANTS.recurringInvoice) with the
// schedule drawn inside it. What is open lives in the URL (?open=<id>, ?mode=create), so a notification can link to one.
export default function RecurringPage() {
  const route = useRecordRoute({ defaultMode: "edit" });
  const view = route.recordMode || "list"; // list | edit | create
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(newRecurringForm);
  const [reloadKey, setReloadKey] = useState(0);
  const { customers, stockItems } = useOrderLookups();
  const { notify, toastNode } = useToasts();
  const V = VARIANTS.recurringInvoice;

  useEffect(() => {
    if (view !== "edit" || !route.recordId || editing?.id === route.recordId) return;
    loadFormForEdit(V, route.recordId)
      .then((f) => { setForm(f); setEditing({ id: route.recordId }); })
      .catch((e) => { notify(e.response?.data?.message || e.message, "error"); route.close(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, route.recordId]);

  const toList = () => { setEditing(null); route.close(); setReloadKey((k) => k + 1); };

  return (
    <>
      {view === "list" && (
        <RecurringList
          onNew={() => { setForm(newRecurringForm()); setEditing(null); route.open(null, "create"); }}
          onEdit={(id) => { setEditing(null); route.open(id, "edit"); }}
          notify={notify}
          reloadKey={reloadKey}
        />
      )}
      {(view === "create" || (view === "edit" && editing)) && (
        <div className="p-4 sm:p-6 lg:p-8">
          <OrderForm
            variant={V}
            formData={form}
            setFormData={setForm}
            parties={customers}
            stockItems={stockItems}
            notify={notify}
            selected={editing}
            setActiveView={(v) => (v === "list" ? toList() : null)}
            resetForm={() => setForm(newRecurringForm())}
            onSuccess={toList}
            activeView={view}
            extraSection={schedule}
          />
        </div>
      )}
      {toastNode}
    </>
  );
}
