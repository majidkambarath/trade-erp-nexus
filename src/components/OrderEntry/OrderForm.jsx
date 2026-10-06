import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowLeft, Calendar, Hash, Plus, Save, Trash2, User } from "lucide-react";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { applyAfterSave } from "../../lib/processTransaction";
import axiosInstance from "../../axios/axios";
import LineItemsGrid from "./LineItemsGrid";
import QuickCreateDialog from "./QuickCreateDialog";
import { QUICK_CREATE, MEASURE_TYPES } from "./quickCreate";
import { buildPayload, recalcRow, rowFromReturnLine } from "./variants";
import { chargesTotals } from "./lineMath";
import AttachmentPanel, { linkPending } from "../accounting/AttachmentPanel";
import { formatNumber } from "../../utils/format";
import { availabilityWarning } from "../../lib/salesDocuments";
import { cn } from "../../lib/utils";

import { DateInput } from "../accounting/kit";
const num = (v) => parseFloat(v) || 0;

// Lookup endpoints answer either a bare array or an object keyed by the collection name.
const listOf = (body, key) => {
  const d = body?.data;
  return Array.isArray(d) ? d : d?.[key] || [];
};

// Where each quick-create record lives, and which field holds the name that was typed.
// Several create endpoints answer { success } without the new record, so it is read back.
const READ_BACK = {
  vendor: { listPath: "/vendors/vendors", listKey: "vendors", name: "vendorName" },
  customer: { listPath: "/customers/customers", listKey: "customers", name: "customerName" },
  category: { listPath: "/categories/categories", listKey: "categories", name: "name" },
  unit: { listPath: "/uom/units", listKey: "units", name: "unitName" },
  stockItem: { listPath: "/stock/stock", listKey: "stocks", name: "itemName" },
};

const NESTED_OPTIONS = { measureTypes: MEASURE_TYPES.map((t) => ({ value: t, label: t })) };

// The created record is either the data itself or nested under one key (data.stock, data.category).
const createdIn = (body) => {
  const d = body?.data;
  if (!d) return null;
  if (d._id) return d;
  return Object.values(d).find((v) => v && v._id) || null;
};

const savedRecord = async (res, where, values) => {
  const rec = createdIn(res.data);
  if (rec) return rec;
  const typed = String(values[where.name] || "").trim();
  const list = listOf((await axiosInstance.get(where.listPath)).data, where.listKey);
  const found = [...list].reverse().find((r) => String(r[where.name] || "").trim() === typed);
  if (!found) throw new Error("Saved, but the new record could not be read back. Reload the page and select it.");
  return found;
};

const uniqById = (list) => {
  const m = new Map();
  for (const x of list) if (x && x._id) m.set(String(x._id), x);
  return [...m.values()];
};

const recalc = recalcRow;

const fieldCls = (invalid) =>
  cn(
    "h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground outline-none transition-colors",
    "focus-visible:ring-2 focus-visible:ring-ring",
    invalid ? "border-status-danger" : "border-input"
  );

const selectStyles = (invalid) => ({
  control: (base, s) => ({
    ...base,
    minHeight: 40,
    borderRadius: 8,
    borderColor: invalid ? "var(--status-danger)" : s.isFocused ? "var(--ring)" : "var(--input)",
    boxShadow: s.isFocused ? "0 0 0 2px var(--ring)" : "none",
    backgroundColor: "var(--card)",
    fontSize: 14,
  }),
  menu: (base) => ({ ...base, zIndex: 70, borderRadius: 10, overflow: "hidden" }),
  menuPortal: (base) => ({ ...base, zIndex: 70 }),
  option: (base, s) => ({
    ...base,
    fontSize: 14,
    backgroundColor: s.isSelected ? "var(--primary)" : s.isFocused ? "var(--accent)" : "var(--card)",
    color: s.isSelected ? "var(--primary-foreground)" : "var(--foreground)",
  }),
});

function Field({ id, label, error, hint, className, children }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-status-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export default function OrderForm({
  variant: V,
  formData,
  setFormData,
  parties = [],
  stockItems = [],
  notify,
  selected,
  setActiveView,
  setList,
  resetForm,
  onSuccess,
  activeView = "create",
}) {
  const uid = useId();
  const fid = (k) => `${uid}-${k}`;
  const editing = activeView === "edit";
  const partyKind = V.partyType === "Vendor" ? "vendor" : "customer";
  const partySpec = QUICK_CREATE[partyKind];
  const formId = `order-${V.key}`;
  // The four order documents are Transactions. A quotation and a delivery note are not: each names its
  // own endpoint, second date ("valid until"), reference field and extra header fields on its variant.
  const endpoint = V.endpoint || "/transactions/transactions";
  const secondKey = V.secondDateKey || "deliveryDate";
  const refKey = V.referenceKey || "vendorReference";
  const isTransaction = !V.endpoint;

  const [errors, setErrors] = useState({});
  const [availability, setAvailability] = useState({}); // itemId -> { onHand, committed, available }
  const [extraParties, setExtraParties] = useState([]);
  const [extraStock, setExtraStock] = useState([]);
  const [quick, setQuick] = useState(null); // the open quick-create: { kind, rowIndex?, initial }
  const [nested, setNested] = useState(null); // a category or unit opened from inside stock
  const [pendingSelect, setPendingSelect] = useState(null);
  const [lookups, setLookups] = useState({ categories: [], units: [] });
  const [focusRequest, setFocusRequest] = useState(null);
  const [manualNumber, setManualNumber] = useState(false);
  const [sourceOpts, setSourceOpts] = useState([]);
  const [linkedRef, setLinkedRef] = useState(null);
  const [saving, setSaving] = useState(false);
  const [taxCodes, setTaxCodes] = useState([]);
  const [files, setFiles] = useState([]); // attachments added while the document is still being typed
  // Where focus goes when the stock dialog closes: the Qty cell of the line it was opened from.
  const returnFocus = useRef(null);

  const rows = useMemo(() => formData.items || [], [formData.items]);

  // Tax codes feed the "Tax code" column. If they cannot be loaded the column simply offers none
  // and the VAT % typed on the line is used, exactly as before.
  useEffect(() => {
    let live = true;
    axiosInstance
      .get("/accounting/tax-codes")
      .then((r) => live && setTaxCodes((r.data?.data || []).filter((c) => c.isActive)))
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const selectOptions = useMemo(
    () => ({ taxCodeId: taxCodes.map((c) => ({ value: c._id, label: `${c.name} (${c.ratePercent}%)` })) }),
    [taxCodes]
  );

  // A page that opens the form with no lines still gets one editable row.
  const hasRows = rows.length > 0;
  useEffect(() => {
    if (!hasRows) setFormData((prev) => ({ ...prev, items: [V.rowTemplate()] }));
  }, [hasRows, V, setFormData]);

  const allParties = useMemo(() => uniqById([...parties, ...extraParties]), [parties, extraParties]);
  const allStock = useMemo(() => uniqById([...stockItems, ...extraStock]), [stockItems, extraStock]);
  const stockById = useMemo(() => new Map(allStock.map((s) => [String(s._id), s])), [allStock]);

  const partyOptions = useMemo(
    () => allParties.map((p) => ({ value: p._id, label: `${p[V.party.idKey]} - ${p[V.party.nameKey]}` })),
    [allParties, V]
  );
  const itemOptions = useMemo(
    () => allStock.map((s) => ({ value: s._id, label: `${s.itemId} - ${s.itemName}` })),
    [allStock]
  );
  const party = allParties.find((p) => p._id === formData.partyId);

  const totals = useMemo(() => V.totals(rows), [rows, V]);
  const discount = V.discount ? num(formData.discount) : 0;
  const charges = useMemo(() => formData.charges || [], [formData.charges]);
  const chargeSums = useMemo(() => chargesTotals(charges), [charges]);
  const grandTotal = num(V.totalAmount(totals, formData)) + chargeSums.total;

  const clearErrors = useCallback((keys) => {
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of keys) delete next[k];
      return next;
    });
  }, []);

  const setRows = useCallback(
    (fn) => setFormData((prev) => ({ ...prev, items: fn(prev.items || []) })),
    [setFormData]
  );

  const setHeader = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearErrors([name]);
  };

  // A delivery note moves no stock, so what is free is what is on hand less what other notes that are
  // not invoiced yet have already promised. Asked of the server when the set of items changes, not on
  // every keystroke, and only a warning: a note can still be made for goods that are on their way.
  const itemKey = useMemo(() => [...new Set(rows.map((r) => r.itemId).filter(Boolean))].sort().join(","), [rows]);
  useEffect(() => {
    if (!V.checkAvailability || !itemKey) return undefined;
    let live = true;
    axiosInstance
      .get("/delivery-notes/availability", { params: { itemIds: itemKey, excludeId: selected?.id } })
      .then((r) => live && setAvailability(Object.fromEntries((r.data?.data || []).map((a) => [a.itemId, a]))))
      .catch(() => {});
    return () => { live = false; };
  }, [V.checkAvailability, itemKey, selected?.id]);
  const stockWarnings = useMemo(() => {
    if (!V.checkAvailability) return [];
    const wanted = new Map(); // two lines for one item draw on the same stock
    for (const r of rows) if (r.itemId) wanted.set(String(r.itemId), (wanted.get(String(r.itemId)) || 0) + num(r.qty));
    return [...wanted]
      .map(([id, qty]) => availabilityWarning(rows.find((r) => String(r.itemId) === id)?.description, qty, availability[id]))
      .filter(Boolean);
  }, [V.checkAvailability, rows, availability]);

  // ---- lines -------------------------------------------------------------------------
  const changeItem = useCallback(
    (r, itemId, known) => {
      const stock = known || (itemId ? stockById.get(String(itemId)) : null);
      setRows((items) =>
        items.map((row, i) => {
          if (i !== r) return row;
          let next = { ...row, itemId };
          if (stock) next = { ...next, ...V.hydrate(next, stock) };
          else next = { ...next, description: "", brand: "", origin: "" };
          return recalc(V, next);
        })
      );
      clearErrors([`itemId_${r}`]);
    },
    [V, stockById, setRows, clearErrors]
  );

  const changeCell = useCallback(
    (r, key, value) => {
      setRows((items) =>
        items.map((row, i) => {
          if (i !== r) return row;
          let next = { ...row, [key]: value };
          // A tax code carries its own rate; the server applies the rate in force on the document
          // date, this is the preview.
          if (key === "taxCodeId" && value) {
            const code = taxCodes.find((c) => c._id === value);
            if (code) next = { ...next, [V.fields.vatPercent]: String(code.ratePercent) };
          }
          return recalc(V, next);
        })
      );
      clearErrors([`${key}_${r}`]);
    },
    [V, setRows, clearErrors, taxCodes]
  );

  // ---- charges ------------------------------------------------------------------------
  const setCharges = (fn) => setFormData((prev) => ({ ...prev, charges: fn(prev.charges || []) }));
  const addCharge = () => setCharges((c) => [...c, { description: "Freight", amount: "", vatPercent: "5" }]);
  const changeCharge = (i, k, v) => {
    setCharges((c) => c.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
    clearErrors([`charge_${k}_${i}`]);
  };
  const removeCharge = (i) => setCharges((c) => c.filter((_, j) => j !== i));

  const addRow = useCallback(() => setRows((items) => [...items, V.rowTemplate()]), [V, setRows]);

  const removeRow = useCallback(
    (r) => {
      setRows((items) => (items.length <= 1 ? items : items.filter((_, i) => i !== r)));
      setErrors({});
    },
    [setRows]
  );

  // Alt+N adds a line from anywhere on the page.
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        addRow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [addRow]);

  // ---- validation and save -----------------------------------------------------------
  const validate = () => {
    const e = {};
    const F = V.fields;
    // A read-only price (sales return, as before) comes from the stock record and cannot be typed here.
    const priceEditable = V.columns.some((c) => c.key === F.unitPrice && c.kind === "number");
    if (!formData.partyId) e.partyId = `${V.labels.partyNoun} is required`;
    if (!formData.date) e.date = "Date is required";
    // a quotation is valid until a day, which cannot come before the quotation itself
    if (V.secondDateRequired) {
      if (!formData[secondKey]) e[secondKey] = `${V.labels.secondDate} is required`;
      else if (formData.date && formData[secondKey] < formData.date) e[secondKey] = `${V.labels.secondDate} cannot be before the date`;
    }
    if (V.referenceRequired && !formData.vendorReference) e.vendorReference = "Vendor reference is required";
    if (!rows.some((r) => r.itemId && num(r.qty) > 0)) e.items = "Add at least one item with a quantity above 0";
    rows.forEach((r, i) => {
      if (!(r.itemId || r.qty || r[F.unitPrice])) return; // a blank row is not part of the document
      if (!r.itemId) e[`itemId_${i}`] = "Choose an item";
      if (!(num(r.qty) > 0)) e[`qty_${i}`] = "Enter a quantity above 0";
      if (priceEditable && !(num(r[F.unitPrice]) > 0)) e[`${F.unitPrice}_${i}`] = "Enter a price above 0";
      if (num(r[F.vatPercent]) < 0) e[`${F.vatPercent}_${i}`] = "VAT cannot be negative";
      if (num(r.discountPercent) < 0 || num(r.discountPercent) > 100) e[`discountPercent_${i}`] = "Discount is 0 to 100%";
      // a return against an invoice cannot take back more than is left on that line
      if (r.maxQty !== "" && r.maxQty != null && num(r.qty) > num(r.maxQty)) e[`qty_${i}`] = `At most ${r.maxQty} can be returned`;
    });
    charges.forEach((c, i) => {
      if (c.amount === "" && !c.description) return;
      if (!(num(c.amount) > 0)) e[`charge_amount_${i}`] = "Enter an amount above 0";
      if (num(c.vatPercent) < 0) e[`charge_vatPercent_${i}`] = "VAT cannot be negative";
    });
    return e;
  };

  const focusFirst = (found) => {
    const key = Object.keys(found)[0];
    const m = key.match(/^(.*)_(\d+)$/);
    if (m) {
      setFocusRequest({ row: Number(m[2]), colKey: m[1], nonce: Date.now() });
      return;
    }
    document.getElementById(fid(key))?.focus();
  };

  const hydrateSaved = (saved, payload) => ({
    ...saved,
    id: saved._id,
    [V.party.idInDoc]: saved.partyId,
    [V.party.nameInDoc]: allParties.find((p) => p._id === saved.partyId)?.[V.party.nameKey] || "Unknown",
    items: (saved.items || []).map((bi) => {
      const orig = payload.items.find((i) => i.itemId === bi.itemId) || {};
      return {
        ...orig,
        ...bi,
        rate: bi.rate || orig.rate || 0,
        vatAmount: bi.vatAmount || orig.vatAmount || 0,
        grandTotal: bi.grandTotal || orig.grandTotal || 0,
      };
    }),
  });

  const save = async () => {
    if (saving) return;
    const found = validate();
    if (Object.keys(found).length) {
      setErrors(found);
      notify?.("Please fix the highlighted fields", "error");
      focusFirst(found);
      return;
    }
    setSaving(true);
    const payload = buildPayload(V, formData, rows, stockById, { charges, ...(V.sourceDocument ? { linkedRef } : {}) });
    // Approving or rejecting is an action of its own on the server (stock, ledger, credit control), so the
    // document is saved first and the action follows; saving never sets those statuses directly.
    const afterSave = { APPROVED: "approve", REJECTED: "reject" }[payload.status] || null;
    if (afterSave) payload.status = "DRAFT";
    try {
      const res = selected
        ? await axiosInstance.put(`${endpoint}/${selected.id}`, payload)
        : await axiosInstance.post(endpoint, payload);
      const doc = hydrateSaved(res.data.data, payload);
      if (afterSave) {
        const r = await applyAfterSave(res.data.data._id, afterSave);
        if (r.done) doc.status = r.status;
        else notify?.(`${V.noun} saved, but not ${afterSave === "approve" ? "approved" : "rejected"} - it was left as a draft${r.message ? `: ${r.message}` : ""}`, r.cancelled ? "info" : "error");
      }
      if (!selected && files.length && V.attachments !== false) {
        const failed = await linkPending(files, "transaction", res.data.data._id);
        if (failed.length) notify?.(`${failed.length} attachment(s) could not be attached; open the document to add them again`, "error");
      }
      notify?.(`${V.noun} ${selected ? "updated" : "created"} successfully`, "success");
      setList?.((prev) => (selected ? prev.map((d) => (d.id === selected.id ? doc : d)) : [doc, ...prev]));
      onSuccess?.(doc);
    } catch (err) {
      notify?.(`Failed to save: ${err.response?.data?.message || err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // ---- quick create ------------------------------------------------------------------
  const handleQuickCreate = async (values) => {
    if (!quick) return;
    if (quick.kind === "stockItem") {
      const categoryName = lookups.categories.find((c) => c._id === values.category)?.name || "";
      const existingSkus = allStock.map((s) => s.sku).filter(Boolean);
      const res = await axiosInstance.post(
        QUICK_CREATE.stockItem.endpoint,
        QUICK_CREATE.stockItem.payload(values, { categoryName, existingSkus })
      );
      // The category name is attached so a sales return can show it without another fetch.
      const created = await savedRecord(res, READ_BACK.stockItem, values);
      const rec = { ...created, category: { _id: values.category, name: categoryName } };
      setExtraStock((s) => [...s, rec]);
      if (quick.rowIndex != null) changeItem(quick.rowIndex, rec._id, rec);
      returnFocus.current = quick.rowIndex != null ? { row: quick.rowIndex, colKey: "qty" } : null;
      notify?.("Stock item created", "success");
      return;
    }
    // vendor or customer
    const res = await axiosInstance.post(QUICK_CREATE[quick.kind].endpoint, QUICK_CREATE[quick.kind].payload(values));
    const rec = await savedRecord(res, READ_BACK[quick.kind], values);
    setExtraParties((p) => [...p, rec]);
    setFormData((prev) => ({ ...prev, partyId: rec._id }));
    clearErrors(["partyId"]);
    notify?.(`${V.labels.partyNoun} created`, "success");
  };

  const handleNestedCreate = async (values) => {
    if (!nested) return;
    const spec = QUICK_CREATE[nested.kind];
    const res = await axiosInstance.post(spec.endpoint, spec.payload(values));
    const rec = await savedRecord(res, READ_BACK[nested.kind], values);
    setLookups((l) =>
      nested.kind === "category" ? { ...l, categories: [...l.categories, rec] } : { ...l, units: [...l.units, rec] }
    );
    setPendingSelect({ field: nested.field, id: rec._id, nonce: Date.now() });
    setNested(null);
  };

  // Load the lookups the stock dialog needs, once it opens.
  useEffect(() => {
    if (quick?.kind !== "stockItem") return;
    axiosInstance.get("/categories/categories").then((r) => setLookups((l) => ({ ...l, categories: listOf(r.data, "categories") }))).catch(() => {});
    axiosInstance.get("/uom/units").then((r) => setLookups((l) => ({ ...l, units: listOf(r.data, "units") }))).catch(() => {});
  }, [quick?.kind]);

  // ---- source document (a return against an approved invoice or order) ---------------
  useEffect(() => {
    if (!V.sourceDocument || !formData.partyId) {
      setSourceOpts([]);
      return;
    }
    const params = new URLSearchParams({
      partyId: formData.partyId,
      partyType: V.partyType,
      type: V.sourceDocument.docType,
      status: V.sourceDocument.fetchStatus,
    });
    axiosInstance
      .get(`/transactions/transactions?${params.toString()}`)
      .then((r) => setSourceOpts(r.data.data || []))
      .catch(() => setSourceOpts([]));
  }, [V, formData.partyId]);

  // Choosing the original asks the server what can still be returned on each line, so the form
  // starts from valid quantities and cannot be saved over the limit.
  const chooseSource = async (opt) => {
    if (!opt) {
      setLinkedRef(null);
      setRows(() => [V.rowTemplate()]);
      return;
    }
    const original = sourceOpts.find((p) => p._id === opt.value);
    if (!original) return;
    try {
      const r = await axiosInstance.get(`/accounting/returnable/${original._id}`);
      const lines = (r.data?.data?.lines || []).filter((l) => l.remainingQty > 0);
      if (!lines.length) {
        notify?.(`Everything on ${original.transactionNo} has already been returned`, "error");
        return;
      }
      setLinkedRef(original._id);
      setRows(() => lines.map((l) => rowFromReturnLine(V, l)));
      setFormData((prev) => ({
        ...prev,
        deliveryDate: prev.deliveryDate || (original.deliveryDate ? String(original.deliveryDate).split("T")[0] : prev.deliveryDate),
        ...(V.referenceRequired ? { vendorReference: original.vendorReference || original.transactionNo } : {}),
      }));
      notify?.(`${original.transactionNo} selected: lines filled with what can still be returned`, "success");
    } catch (err) {
      notify?.(err.response?.data?.message || "Could not read that document", "error");
    }
  };

  const stockDialogOptions = {
    categories: lookups.categories.map((c) => ({ value: c._id, label: c.name })),
    units: lookups.units.map((u) => ({ value: u._id, label: `${u.unitName} (${u.shortCode})` })),
  };

  const attachmentsLabel = V.party.idInDoc === "customerId"
    ? "Attachments (customer order, signed delivery note, proof of delivery)"
    : "Attachments (supplier invoice, delivery note, proof of delivery)";
  const numberIsEditable = V.numberMode && manualNumber;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setActiveView("list");
              resetForm?.();
            }}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              {editing ? V.title.edit : V.title.create}
            </h1>
            <p className="text-sm text-muted-foreground">
              Ctrl+Enter saves · Alt+N adds a line · Arrow keys move between line cells
            </p>
          </div>
        </div>
        <button type="submit" form={formId} disabled={saving} className="erp-btn-primary disabled:opacity-60">
          <Save className="h-4 w-4" aria-hidden="true" />
          {saving ? "Saving…" : editing ? V.title.saveEdit : V.title.save}
        </button>
      </header>

      <form
        id={formId}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
        className="space-y-6"
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-labelledby={fid("details")} className="rounded-xl border border-border bg-card p-6 shadow-card">
            <h2 id={fid("details")} className="mb-5 text-base font-bold text-foreground">
              Details
            </h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id={fid("transactionNo")} label={V.labels.doc}>
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Hash className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <input
                      id={fid("transactionNo")}
                      name="transactionNo"
                      type="text"
                      value={formData.transactionNo || ""}
                      placeholder={numberIsEditable ? "Enter a number" : "Assigned when saved"}
                      onChange={(e) => setHeader("transactionNo", e.target.value)}
                      readOnly={!numberIsEditable}
                      className={cn(fieldCls(false), "ps-9", !numberIsEditable && "bg-secondary text-muted-foreground")}
                    />
                  </div>
                  {V.numberMode && (
                    <div className="inline-flex rounded-lg border border-input p-0.5 text-xs font-semibold" role="group" aria-label="Number mode">
                      <button type="button" aria-pressed={!manualNumber} onClick={() => setManualNumber(false)} className={cn("rounded-md px-2.5 py-1.5", !manualNumber ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Auto</button>
                      <button type="button" aria-pressed={manualNumber} onClick={() => setManualNumber(true)} className={cn("rounded-md px-2.5 py-1.5", manualNumber ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>Manual</button>
                    </div>
                  )}
                </div>
              </Field>

              <Field id={fid("date")} label="Date" error={errors.date}>
                <DateInput
                  id={fid("date")}
                  name="date"
                  value={formData.date || ""}
                  onChange={(e) => setHeader("date", e.target.value)}
                  aria-invalid={Boolean(errors.date) || undefined}
                />
              </Field>

              <Field id={fid("partyId")} label={V.labels.partyNoun} error={errors.partyId} className="sm:col-span-2">
                <CreatableSelect
                  inputId={fid("partyId")}
                  options={partyOptions}
                  value={partyOptions.find((o) => o.value === formData.partyId) || null}
                  onChange={(o) => setHeader("partyId", o ? o.value : "")}
                  onCreateOption={(text) =>
                    setQuick({ kind: partyKind, initial: { [partySpec.fields[0].name]: text } })
                  }
                  formatCreateLabel={(t) => `Create ${V.labels.partyNoun.toLowerCase()} "${t}"`}
                  placeholder={V.labels.selectParty}
                  isClearable
                  isSearchable
                  styles={selectStyles(Boolean(errors.partyId))}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  menuPosition="fixed"
                  aria-invalid={Boolean(errors.partyId) || undefined}
                />
              </Field>

              {V.sourceDocument && formData.partyId && (
                <Field id={fid("source")} label={V.sourceDocument.label} hint={sourceOpts.length ? `${sourceOpts.length} approved document(s) for this ${V.labels.partyNoun.toLowerCase()}` : `No approved documents for this ${V.labels.partyNoun.toLowerCase()}`} className="sm:col-span-2">
                  <Select
                    inputId={fid("source")}
                    options={sourceOpts.map((p) => ({ value: p._id, label: `${p.transactionNo} · ${String(p.date || "").split("T")[0]}` }))}
                    value={linkedRef ? { value: linkedRef, label: sourceOpts.find((p) => p._id === linkedRef)?.transactionNo || linkedRef } : null}
                    onChange={chooseSource}
                    placeholder="Choose the document being returned"
                    isClearable
                    styles={selectStyles(false)}
                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                    menuPosition="fixed"
                  />
                </Field>
              )}

              {V.hasSecondDate && (
                <Field id={fid(secondKey)} label={V.labels.secondDate} error={errors[secondKey]}>
                  <DateInput
                    id={fid(secondKey)}
                    name={secondKey}
                    value={formData[secondKey] || ""}
                    onChange={(e) => setHeader(secondKey, e.target.value)}
                    aria-invalid={Boolean(errors[secondKey]) || undefined}
                  />
                </Field>
              )}

              {V.referenceRequired ? (
                <Field id={fid("vendorReference")} label={V.labels.reference} error={errors.vendorReference}>
                  <input id={fid("vendorReference")} name="vendorReference" type="text" value={formData.vendorReference || ""} onChange={(e) => setHeader("vendorReference", e.target.value)} placeholder="Enter reference" aria-invalid={Boolean(errors.vendorReference) || undefined} className={fieldCls(Boolean(errors.vendorReference))} />
                </Field>
              ) : V.key === "sales" ? (
                <>
                  <Field id={fid("refNo")} label="LPO no.">
                    <input id={fid("refNo")} name="refNo" type="text" value={formData.refNo || ""} onChange={(e) => setHeader("refNo", e.target.value)} className={fieldCls(false)} />
                  </Field>
                  <Field id={fid("docNo")} label="Doc no.">
                    <input id={fid("docNo")} name="docNo" type="text" value={formData.docNo || ""} onChange={(e) => setHeader("docNo", e.target.value)} className={fieldCls(false)} />
                  </Field>
                </>
              ) : V.labels.reference ? (
                <Field id={fid(refKey)} label={V.labels.reference}>
                  <input id={fid(refKey)} name={refKey} type="text" value={formData[refKey] || ""} onChange={(e) => setHeader(refKey, e.target.value)} placeholder="Enter reference" className={fieldCls(false)} />
                </Field>
              ) : null}

              {/* a quotation or delivery note has no status to pick: it moves through its own actions */}
              {V.statusOptions && (
                <Field id={fid("status")} label="Status">
                  <select id={fid("status")} name="status" value={formData.status || "DRAFT"} onChange={(e) => setHeader("status", e.target.value)} className={fieldCls(false)}>
                    {V.statusOptions(editing).map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </Field>
              )}

              {V.discount && (
                <Field id={fid("discount")} label="Discount (AED)">
                  <input id={fid("discount")} name="discount" type="number" min="0" step="any" inputMode="decimal" value={formData.discount ?? ""} onChange={(e) => setHeader("discount", e.target.value)} className={cn(fieldCls(false), "text-end tabular-nums")} />
                </Field>
              )}

              {V.priority && (
                <Field id={fid("priority")} label="Priority">
                  <select id={fid("priority")} name="priority" value={formData.priority || "Medium"} onChange={(e) => setHeader("priority", e.target.value)} className={fieldCls(false)}>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </Field>
              )}

              {(V.priority || V.terms) && (
                <Field id={fid("terms")} label="Terms" className="sm:col-span-2">
                  <textarea id={fid("terms")} name="terms" rows={2} value={formData.terms || ""} onChange={(e) => setHeader("terms", e.target.value)} className={cn(fieldCls(false), "h-auto py-2")} />
                </Field>
              )}

              {/* header fields only some documents have (a delivery note's vehicle, driver and address) */}
              {(V.extraFields || []).map((f) => (
                <Field key={f.key} id={fid(f.key)} label={f.label} className={f.span === 2 ? "sm:col-span-2" : undefined}>
                  {f.type === "textarea" ? (
                    <textarea id={fid(f.key)} name={f.key} rows={2} value={formData[f.key] || ""} onChange={(e) => setHeader(f.key, e.target.value)} className={cn(fieldCls(false), "h-auto py-2")} />
                  ) : (
                    <input id={fid(f.key)} name={f.key} type="text" value={formData[f.key] || ""} onChange={(e) => setHeader(f.key, e.target.value)} className={fieldCls(false)} />
                  )}
                </Field>
              ))}

              <Field id={fid("notes")} label="Notes" className="sm:col-span-2">
                <textarea id={fid("notes")} name="notes" rows={2} value={formData.notes || ""} onChange={(e) => setHeader("notes", e.target.value)} placeholder="Additional notes or special instructions" className={cn(fieldCls(false), "h-auto py-2")} />
              </Field>
            </div>
          </section>

          <aside className="space-y-6">
            <section aria-labelledby={fid("preview")} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 id={fid("preview")} className="mb-4 text-base font-bold text-foreground">
                {V.partyType === "Vendor" ? "Vendor" : "Customer"}
              </h2>
              {party ? (
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-brand">{party[V.party.idKey]}</p>
                  <p className="text-base font-bold text-foreground">{party[V.party.nameKey]}</p>
                  <dl className="space-y-1.5 pt-1">
                    {V.preview(party).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="flex gap-3">
                        <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
                        <dd className="min-w-0 break-words text-foreground">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {formData[refKey] && <p className="pt-1 text-muted-foreground">Reference: {formData[refKey]}</p>}
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" aria-hidden="true" />
                  Select a {V.labels.partyNoun.toLowerCase()} to see details
                </p>
              )}
            </section>

            <section aria-labelledby={fid("summary")} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h2 id={fid("summary")} className="mb-4 text-base font-bold text-foreground">Summary</h2>
              <dl className="space-y-2.5 text-sm tabular-nums">
                <div className="flex justify-between"><dt className="text-muted-foreground">Lines</dt><dd>{rows.filter((r) => r.itemId).length}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Net</dt><dd>{formatNumber(num(totals.subtotal))}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">VAT</dt><dd>{formatNumber(num(totals.tax))}</dd></div>
                {num(totals.discount) > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">Line discounts (included in net)</dt><dd>−{formatNumber(num(totals.discount))}</dd></div>
                )}
                {chargeSums.total > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">Charges (incl. VAT)</dt><dd>{formatNumber(chargeSums.total)}</dd></div>
                )}
                {V.discount && discount > 0 && (
                  <div className="flex justify-between"><dt className="text-muted-foreground">Discount</dt><dd>−{formatNumber(discount)}</dd></div>
                )}
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <dt className="font-semibold text-foreground">Total (AED)</dt>
                  <dd className="text-xl font-extrabold text-foreground">{formatNumber(grandTotal)}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>

        <section aria-labelledby={fid("lines")} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id={fid("lines")} className="text-base font-bold text-foreground">{V.title.items}</h2>
            <button type="button" onClick={addRow} className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add line
              <kbd className="ms-1 rounded border border-border bg-secondary px-1 text-[11px] font-semibold text-muted-foreground">Alt N</kbd>
            </button>
          </div>
          {errors.items && (
            <p role="alert" className="text-sm font-medium text-status-danger">{errors.items}</p>
          )}
          <LineItemsGrid
            label={V.title.items}
            columns={V.columns}
            rows={rows}
            errors={errors}
            itemOptions={itemOptions}
            onItemChange={changeItem}
            onCellChange={changeCell}
            onRemove={removeRow}
            onAddRow={addRow}
            onCreateItem={(r, text) => setQuick({ kind: "stockItem", rowIndex: r, initial: { itemName: text } })}
            focusRequest={focusRequest}
            selectOptions={selectOptions}
          />
          {stockWarnings.length > 0 && (
            <div role="status" className="rounded-lg border border-status-warning/40 bg-status-warning-soft px-3 py-2 text-sm text-foreground">
              <p className="font-semibold">Not enough free stock for this delivery note</p>
              <ul className="mt-1 list-disc ps-5">
                {stockWarnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">A delivery note moves no stock, so goods promised on other notes that are not invoiced yet are counted as taken. You can still save it.</p>
            </div>
          )}
        </section>

        <section aria-labelledby={fid("charges")} className="rounded-xl border border-border bg-card p-6 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id={fid("charges")} className="text-base font-bold text-foreground">Additional charges</h2>
              <p className="text-xs text-muted-foreground">Freight, handling or other costs on this document, each with its own VAT.</p>
            </div>
            <button type="button" onClick={addCharge} className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3.5 text-sm font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Plus className="h-4 w-4" aria-hidden="true" />Add charge
            </button>
          </div>
          {charges.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
          {charges.map((c, i) => (
            <div key={i} className="mb-2 grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_160px_110px_auto]">
              <Field id={fid(`chargeDesc${i}`)} label={i === 0 ? "Description" : <span className="sr-only">Description</span>}>
                <input id={fid(`chargeDesc${i}`)} type="text" value={c.description || ""} onChange={(e) => changeCharge(i, "description", e.target.value)} placeholder="e.g. Freight" className={fieldCls(false)} />
              </Field>
              <Field id={fid(`chargeAmt${i}`)} label={i === 0 ? "Amount (AED)" : <span className="sr-only">Amount</span>} error={errors[`charge_amount_${i}`]}>
                <input id={fid(`chargeAmt${i}`)} type="number" min="0" step="any" inputMode="decimal" value={c.amount ?? ""} onChange={(e) => changeCharge(i, "amount", e.target.value)} aria-invalid={Boolean(errors[`charge_amount_${i}`]) || undefined} className={cn(fieldCls(Boolean(errors[`charge_amount_${i}`])), "text-end tabular-nums")} />
              </Field>
              <Field id={fid(`chargeVat${i}`)} label={i === 0 ? "VAT %" : <span className="sr-only">VAT %</span>}>
                <input id={fid(`chargeVat${i}`)} type="number" min="0" step="any" inputMode="decimal" value={c.vatPercent ?? ""} onChange={(e) => changeCharge(i, "vatPercent", e.target.value)} className={cn(fieldCls(false), "text-end tabular-nums")} />
              </Field>
              <button type="button" onClick={() => removeCharge(i)} aria-label={`Remove charge ${i + 1}`} className={cn("grid h-10 w-10 place-items-center rounded-lg text-muted-foreground hover:bg-accent hover:text-status-danger", i === 0 && "sm:mt-[1.75rem]")}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </section>

        {/* attachments belong to transactions; a quotation or delivery note has none of its own yet */}
        {isTransaction && (
          <section className="rounded-xl border border-border bg-card p-6 shadow-card">
            {selected?.id
              ? <AttachmentPanel ownerType="transaction" ownerId={selected.id} label={attachmentsLabel} />
              : <AttachmentPanel value={files} onChange={setFiles} label={attachmentsLabel} />}
          </section>
        )}
      </form>

      <QuickCreateDialog
        open={quick !== null}
        onOpenChange={(open) => {
          if (!open) setQuick(null);
        }}
        spec={quick ? QUICK_CREATE[quick.kind] : null}
        initial={quick?.initial}
        onCreate={handleQuickCreate}
        options={quick?.kind === "stockItem" ? stockDialogOptions : {}}
        onRequestNew={quick?.kind === "stockItem" ? (f) => setNested({ kind: f.select === "categories" ? "category" : "unit", field: f.name }) : undefined}
        pendingSelect={quick?.kind === "stockItem" ? pendingSelect : null}
        onCloseFocus={() => {
          const target = returnFocus.current;
          returnFocus.current = null;
          if (!target) return false;
          setFocusRequest({ ...target, nonce: Date.now() });
          return true;
        }}
      />
      <QuickCreateDialog
        open={nested !== null}
        onOpenChange={(open) => {
          if (!open) setNested(null);
        }}
        spec={nested ? QUICK_CREATE[nested.kind] : null}
        options={NESTED_OPTIONS}
        onCreate={handleNestedCreate}
      />
    </div>
  );
}
