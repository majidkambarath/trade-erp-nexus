import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import OrderForm from "../OrderEntry/OrderForm";
import { VARIANTS, recalcRow } from "../OrderEntry/variants";
import { crm } from "../../lib/crmApi";
import { quoteLinesFromDeal } from "../../lib/crm";
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
  const [params] = useSearchParams();
  const fromDeal = view === "create" ? params.get("deal") : null;
  const [dealNote, setDealNote] = useState("");

  // ?mode=create&deal=<id>: a quotation raised from a CRM deal starts with its customer and the lines that name an item,
  // and names the deal so the deal is linked to it (whatever else the customer has open).
  useEffect(() => {
    if (!fromDeal) return undefined;
    let live = true;
    crm.deal(fromDeal)
      .then((deal) => {
        if (!live || !deal) return;
        const V = VARIANTS.quotation;
        const { lines, skipped } = quoteLinesFromDeal(deal);
        const code = (itemId) => stockItems.find((s) => String(s._id) === itemId)?.itemId || "";
        const items = lines.map((l) => recalcRow(V, { ...V.rowTemplate(), itemId: l.itemId, itemCode: code(l.itemId), description: l.description, qty: String(l.qty), rate: String(l.price) }));
        setForm({ ...newQuotationForm(), partyId: String(deal.customerId), opportunityId: String(deal._id), reference: deal.title || "", items });
        setDealNote(
          `From deal ${deal.opportunityNo}.` + (skipped.length ? ` Not an item, so add by hand: ${skipped.join(", ")}.` : "")
        );
      })
      .catch((e) => notify(e.response?.data?.message || e.message, "error"));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDeal, stockItems.length]);

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
        <div className="p-4 sm:p-6 lg:p-8">
          {fromDeal && dealNote && <p className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm" role="status">{dealNote}</p>}
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
        </div>
      )}
      {toastNode}
    </>
  );
}
