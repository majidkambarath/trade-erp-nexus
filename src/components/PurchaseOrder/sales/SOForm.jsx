import React, { useCallback, useMemo, useEffect } from "react";
import {
  Package,
  Plus,
  Trash2,
  Calendar,
  User,
  Save,
  ArrowLeft,
  Hash,
  AlertCircle,
} from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../../axios/axios";

const SOForm = React.memo(
  ({
    formData,
    setFormData,
    customers,
    stockItems,
    addNotification,
    selectedSO,
    setSelectedSO,
    setActiveView,
    setSalesOrders,
    activeView = "create",
    resetForm,
    calculateTotals,
    onSOSuccess,
    formErrors,
    setFormErrors,
  }) => {
    const isEditing = activeView === "edit";

    // Recalculate totals on item change
    useEffect(() => {
      const { subtotal, tax, total } = calculateTotals(formData.items);
      setFormData((prev) => ({
        ...prev,
        totals: { subtotal, tax, total },
      }));
    }, [formData.items]);

    const validateForm = useCallback(() => {
      const errors = {};
      if (!formData.partyId) errors.partyId = "Customer is required";
      if (!formData.date) errors.date = "Date is required";
      if (!formData.deliveryDate)
        errors.deliveryDate = "Delivery date is required";

      let hasValidItem = false;
      formData.items.forEach((item, i) => {
        const hasInput = item.itemId || item.qty || item.rate;
        if (hasInput) {
          if (!item.itemId) errors[`itemId_${i}`] = "Item required";
          if (!item.qty || parseFloat(item.qty) <= 0)
            errors[`qty_${i}`] = "Qty > 0";
          if (!item.rate || parseFloat(item.rate) <= 0)
            errors[`rate_${i}`] = "Rate > 0";
          if (parseFloat(item.vatPercent) < 0)
            errors[`vatPercent_${i}`] = "VAT ≥ 0";

          if (
            item.itemId &&
            parseFloat(item.qty) > 0 &&
            parseFloat(item.rate) > 0
          )
            hasValidItem = true;
        }
      });

      if (!hasValidItem) errors.items = "At least one valid item required";
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    }, [formData, setFormErrors]);

    const handleInputChange = useCallback(
      (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setFormErrors((prev) => ({ ...prev, [name]: null }));
      },
      [setFormData, setFormErrors]
    );

    const handleCustomerSelect = useCallback(
      (selected) => {
        const id = selected ? selected.value : "";
        setFormData((prev) => ({ ...prev, partyId: id }));
        setFormErrors((prev) => ({ ...prev, partyId: null }));
        if (selected) {
          const c = customers.find((x) => x._id === selected.value);
          if (c) addNotification(`Customer: ${c.customerName}`, "success");
        }
      },
      [customers, addNotification, setFormData, setFormErrors]
    );

    const handleItemChange = useCallback(
      (index, field, value) => {
        const items = [...formData.items];
        items[index] = { ...items[index], [field]: value };

        if (field === "itemId") {
          const stock = stockItems.find((s) => s._id === value);
          if (stock) {
            items[index].description = stock.itemName;
            items[index].rate = stock.salesPrice.toString();
            items[index].salesPrice = stock.salesPrice.toString();
            items[index].purchasePrice = stock.purchasePrice.toString();
            items[index].vatPercent = (stock.taxPercent || 5).toString();
            items[index].package = "1";
            items[index].category = stock.category || "";
            items[index].unitOfMeasure = stock.unitOfMeasure || "";
            items[index].stockDetails = {
              currentStock: stock.currentStock,
              reorderLevel: stock.reorderLevel,
            };
            if (stock.currentStock <= stock.reorderLevel) {
              addNotification(`Low stock: ${stock.itemName}`, "warning");
            }
          } else {
            items[index].description = "";
            items[index].rate = "0.00";
            items[index].salesPrice = "0.00";
            items[index].purchasePrice = "0.00";
            items[index].vatPercent = "5";
            items[index].package = "1";
          }
        }

        setFormData((prev) => ({ ...prev, items }));
        setFormErrors((prev) => ({ ...prev, [`${field}_${index}`]: null }));
      },
      [formData.items, stockItems, setFormData, addNotification, setFormErrors]
    );

    const addItem = useCallback(() => {
      setFormData((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          {
            itemId: "",
            description: "",
            purchasePrice: "0.00",
            salesPrice: "0.00",
            rate: "0.00",
            qty: "",
            package: "1",
            vatPercent: "5",
            vatAmount: "0.00",
            lineTotal: "0.00",
          },
        ],
      }));
    }, [setFormData]);

    const removeItem = useCallback(
      (index) => {
        if (formData.items.length > 1) {
          const items = formData.items.filter((_, i) => i !== index);
          setFormData((prev) => ({ ...prev, items }));
          const errors = { ...formErrors };
          Object.keys(errors).forEach(
            (k) => k.endsWith(`_${index}`) && delete errors[k]
          );
          setFormErrors(errors);
        }
      },
      [formData.items, formErrors, setFormData, setFormErrors]
    );

    const saveSO = useCallback(async () => {
      if (!validateForm()) {
        addNotification("Fix errors first", "error");
        return;
      }

      const { total } = calculateTotals(formData.items);
      const payload = {
        transactionNo: formData.transactionNo,
        type: "sales_order",
        partyId: formData.partyId,
        partyType: "Customer",
        date: formData.date,
        deliveryDate: formData.deliveryDate,
        status: formData.status,
        priority: formData.priority || "Medium",
        totalAmount: parseFloat(total),
        terms: formData.terms || "",
        notes: formData.notes || "",
        items: formData.items
          .filter(
            (i) => i.itemId && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0
          )
          .map((i) => {
            const qty = parseFloat(i.qty);
            const rate = parseFloat(i.rate);
            const vatPct = parseFloat(i.vatPercent) || 0;
            const subtotal = qty * rate;
            const vat = subtotal * (vatPct / 100);
            const lineTotal = subtotal + vat;
            const salesPrice = parseFloat(i.salesPrice) || 0;

            return {
              itemId: i.itemId,
              description: i.description,
              qty,
              rate: parseFloat(subtotal.toFixed(2)),
              vatPercent: vatPct,
              price: salesPrice,
              purchasePrice: i.purchasePrice || 0,
              vatAmount: parseFloat(vat.toFixed(2)),
              grandTotal: parseFloat(lineTotal.toFixed(2)),
              package: i.package ? parseFloat(i.package) : 1,
              // unitOfMeasure: i.unitOfMeasure || "",
              // stockDetails: i.stockDetails || {},
            };
          }),
      };

      try {
        let res;
        if (isEditing && selectedSO) {
          res = await axiosInstance.put(
            `/transactions/transactions/${selectedSO.id}`,
            payload
          );
          addNotification("SO updated!", "success");
        } else {
          res = await axiosInstance.post("/transactions/transactions", payload);
          addNotification("SO created!", "success");
        }

        const saved = res.data.data;
        const newSO = {
          id: saved._id,
          transactionNo: saved.transactionNo,
          customerId: saved.partyId,
          customerName:
            customers.find((c) => c._id === saved.partyId)?.customerName ||
            "Unknown",
          date: saved.date,
          deliveryDate: saved.deliveryDate,
          status: saved.status,
          totalAmount: parseFloat(saved.totalAmount).toFixed(2),
          items: saved.items,
          terms: saved.terms,
          notes: saved.notes,
          priority: saved.priority || "Medium",
        };

        if (isEditing) {
          setSalesOrders((prev) =>
            prev.map((s) => (s.id === selectedSO.id ? newSO : s))
          );
        } else {
          setSalesOrders((prev) => [newSO, ...prev]);
        }

        onSOSuccess(newSO);
      } catch (err) {
        addNotification(
          "Save failed: " + (err.response?.data?.message || err.message),
          "error"
        );
      }
    }, [
      validateForm,
      formData,
      isEditing,
      selectedSO,
      customers,
      calculateTotals,
      setSalesOrders,
      addNotification,
      onSOSuccess,
    ]);

    const totals = formData.totals || {
      subtotal: "0.00",
      tax: "0.00",
      total: "0.00",
    };

    const customerOptions = useMemo(
      () =>
        (customers || []).map((c) => ({
          value: c._id,
          label: `${c.customerId} - ${c.customerName}`,
        })),
      [customers]
    );

    const itemOptions = useMemo(
      () =>
        (stockItems || []).map((s) => ({
          value: s._id,
          label: `${s.itemId} - ${s.itemName}`,
        })),
      [stockItems]
    );

    const selectedCustomer = customers.find((c) => c._id === formData.partyId);

    const selectStyles = {
      control: (base, state) => ({
        ...base,
        borderRadius: "0.5rem",
        border: formErrors.partyId ? "2px solid #ef4444" : "1px solid #e2e8f0",
        padding: "0.25rem",
        fontSize: "0.875rem",
        boxShadow: state.isFocused ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
      }),
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white/80 backdrop-blur-xl shadow-xl border-b border-gray-200/50">
          <div className="px-8 py-6 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setActiveView("list");
                  resetForm();
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
              >
                <ArrowLeft className="w-4 h-4" /> <span>Back</span>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  {isEditing ? "Edit Sales Order" : "Create Sales Order"}
                </h1>
                <p className="text-slate-600">Fill in all required fields</p>
              </div>
            </div>
            <button
              onClick={saveSO}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-lg"
            >
              <Save className="w-5 h-5" />
              <span>{isEditing ? "Update SO" : "Save SO"}</span>
            </button>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-2xl p-8">
            {/* Header: SO Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    SO Number
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={formData.transactionNo}
                      disabled
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 bg-white rounded-xl border ${
                          formErrors.date
                            ? "border-red-500"
                            : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {formErrors.date && (
                        <p className="text-red-500 text-xs mt-1 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.date}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Delivery Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="date"
                        name="deliveryDate"
                        value={formData.deliveryDate}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 bg-white rounded-xl border ${
                          formErrors.deliveryDate
                            ? "border-red-500"
                            : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {formErrors.deliveryDate && (
                        <p className="text-red-500 text-xs mt-1 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.deliveryDate}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Customer
                  </label>
                  <Select
                    options={customerOptions}
                    value={
                      customerOptions.find(
                        (o) => o.value === formData.partyId
                      ) || null
                    }
                    onChange={handleCustomerSelect}
                    placeholder="Search customer..."
                    isClearable
                    isSearchable
                    styles={selectStyles}
                  />
                  {formErrors.partyId && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {formErrors.partyId}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="APPROVED">Approved</option>
                    {isEditing && <option value="INVOICED">Invoiced</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Special instructions..."
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none"
                  />
                </div>
              </div>

              {/* Right: Summary */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Customer Summary
                </h3>
                {selectedCustomer ? (
                  <div className="text-sm space-y-2 text-slate-700">
                    <p className="font-semibold text-blue-600">
                      {selectedCustomer.customerId}
                    </p>
                    <p className="font-bold text-slate-800">
                      {selectedCustomer.customerName}
                    </p>
                    <p>{selectedCustomer.address}</p>
                    <p className="flex items-center">
                      <User className="w-3 h-3 mr-1" />
                      {selectedCustomer.phone}
                    </p>
                    <p>{selectedCustomer.email}</p>
                    <p>VAT: {selectedCustomer.vatNumber}</p>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Select a customer</p>
                )}

                <div className="mt-6 pt-6 border-t border-slate-300">
                  <h4 className="font-semibold text-slate-800 mb-3">
                    Order Totals
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Items:</span>
                      <span>
                        {formData.items.filter((i) => i.itemId).length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>AED {totals.subtotal}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT:</span>
                      <span>AED {totals.tax}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span className="text-emerald-600">
                          AED {totals.total}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-slate-800 flex items-center">
                  <Package className="w-6 h-6 mr-2 text-blue-600" /> Items
                </h3>
                <button
                  onClick={addItem}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 shadow"
                >
                  <Plus className="w-4 h-4" /> <span>Add Item</span>
                </button>
              </div>

              {formErrors.items && (
                <p className="text-red-500 text-sm mb-4 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {formErrors.items}
                </p>
              )}

              <div className="space-y-4">
                {formData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-6 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200"
                  >
                    {/* Item */}
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-600">
                        Item
                      </label>
                      <Select
                        options={itemOptions}
                        value={
                          itemOptions.find((o) => o.value === item.itemId) ||
                          null
                        }
                        onChange={(opt) =>
                          handleItemChange(idx, "itemId", opt ? opt.value : "")
                        }
                        placeholder="Select Item..."
                        isSearchable
                        styles={{
                          control: (b) => ({
                            ...b,
                            fontSize: "0.875rem",
                            minHeight: "38px",
                            borderRadius: "0.5rem",
                            border: formErrors[`itemId_${idx}`]
                              ? "2px solid #ef4444"
                              : "1px solid #e2e8f0",
                          }),
                        }}
                      />
                      {formErrors[`itemId_${idx}`] && (
                        <p className="text-red-500 text-xs mt-1">
                          {formErrors[`itemId_${idx}`]}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    <div className="col-span-2">
                      <label className="text-xs font-medium text-slate-600">
                        Description
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(idx, "description", e.target.value)
                        }
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Purchase Price */}
                    <div className="col-span-1">
                      <label className="text-xs font-medium text-slate-600">
                        Purchase Price
                      </label>
                      <input
                        type="text"
                        value={item.purchasePrice}
                        readOnly
                        className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-lg cursor-not-allowed"
                      />
                    </div>

                    {/* Sales Price */}
                    <div className="col-span-1">
                      <label className="text-xs font-medium text-slate-600">
                        Sales Price
                      </label>
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) =>
                          handleItemChange(idx, "rate", e.target.value)
                        }
                        min="0"
                        step="0.01"
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          formErrors[`rate_${idx}`]
                            ? "border-red-500"
                            : "border-slate-300"
                        }`}
                      />
                      {formErrors[`rate_${idx}`] && (
                        <p className="text-red-500 text-xs mt-1">
                          {formErrors[`rate_${idx}`]}
                        </p>
                      )}
                    </div>

                    {/* Package */}
                    <div className="col-span-1">
                      <label className="text-xs font-medium text-slate-600">
                        Package
                      </label>
                      <input
                        type="text"
                        value={item.package}
                        onChange={(e) =>
                          handleItemChange(idx, "package", e.target.value)
                        }
                        placeholder="1"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Quantity */}
                    <div className="col-span-1">
                      <label className="text-xs font-medium text-slate-600">
                        Quantity
                      </label>
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) =>
                          handleItemChange(idx, "qty", e.target.value)
                        }
                        min="0"
                        step="0.01"
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          formErrors[`qty_${idx}`]
                            ? "border-red-500"
                            : "border-slate-300"
                        }`}
                      />
                      {formErrors[`qty_${idx}`] && (
                        <p className="text-red-500 text-xs mt-1">
                          {formErrors[`qty_${idx}`]}
                        </p>
                      )}
                    </div>

                    {/* Total */}
                    <div className="col-span-1">
                      <label className="text-xs font-medium text-slate-600">
                        Total
                      </label>
                      <input
                        type="text"
                        value={(
                          (parseFloat(item.qty) || 0) *
                          (parseFloat(item.rate) || 0)
                        ).toFixed(2)}
                        readOnly
                        className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-lg cursor-not-allowed"
                      />
                    </div>

                    {/* VAT % */}
                    <div className="col-span-1">
                      <label className="text-xs font-medium text-slate-600">
                        VAT %
                      </label>
                      <input
                        type="number"
                        value={item.vatPercent}
                        onChange={(e) =>
                          handleItemChange(idx, "vatPercent", e.target.value)
                        }
                        min="0"
                        step="0.1"
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                          formErrors[`vatPercent_${idx}`]
                            ? "border-red-500"
                            : "border-slate-300"
                        }`}
                      />
                    </div>

                    {/* VAT Amount */}
                    <div className="col-span-1">
                      <label className="text-xs font-medium text-slate-600">
                        VAT Amount
                      </label>
                      <input
                        type="text"
                        value={item.vatAmount}
                        readOnly
                        className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-lg cursor-not-allowed"
                      />
                    </div>

                    {/* Grand Total */}
                    <div className="col-span-1">
                      <label className="text-xs font-medium text-slate-600">
                        Grand Total
                      </label>
                      <input
                        type="text"
                        value={item.lineTotal}
                        readOnly
                        className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-300 rounded-lg cursor-not-allowed"
                      />
                    </div>

                    {/* Delete */}
                    <div className="col-span-1 flex items-end">
                      {formData.items.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.formData === next.formData &&
    prev.customers === next.customers &&
    prev.stockItems === next.stockItems &&
    prev.formErrors === next.formErrors &&
    prev.selectedSO === next.selectedSO &&
    prev.activeView === next.activeView
);

export default SOForm;
