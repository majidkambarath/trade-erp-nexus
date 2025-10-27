import React, { useCallback, useMemo, useState, useEffect } from "react";
import { Package, Plus, Trash2, Calendar, User, Save, ArrowLeft, Hash } from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../../axios/axios"; // Adjust path as needed

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

    useEffect(() => {
      const totals = calculateTotals(formData.items);
      setFormData((prev) => ({ ...prev, totals }));
    }, [formData.items, calculateTotals, setFormData]);

    useEffect(() => {
      console.log("SOForm rendered");
    }, []);

    const validateForm = useCallback(() => {
      const errors = {};
      if (!formData.partyId) {
        errors.partyId = "Customer is required";
      }
      if (!formData.date) {
        errors.date = "Date is required";
      }
      if (!formData.deliveryDate) {
        errors.deliveryDate = "Delivery date is required";
      }
      if (
        !formData.items.some(
          (item) => item.itemId && item.qty && item.salesPrice
        )
      ) {
        errors.items = "At least one valid item is required";
      }
      formData.items.forEach((item, index) => {
        if (item.itemId || item.qty || item.salesPrice) {
          if (!item.itemId) errors[`itemId_${index}`] = "Item code is required";
          if (!item.qty || parseFloat(item.qty) <= 0)
            errors[`qty_${index}`] = "Quantity must be greater than 0";
          if (!item.salesPrice || parseFloat(item.salesPrice) <= 0)
            errors[`salesPrice_${index}`] = "Sales price must be greater than 0";
          if (!item.vatPercent || parseFloat(item.vatPercent) < 0)
            errors[`vatPercent_${index}`] = "VAT % must be non-negative";
        }
      });
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
        const customerId = selected ? selected.value : "";
        setFormData((prev) => ({ ...prev, partyId: customerId }));
        setFormErrors((prev) => ({ ...prev, partyId: null }));
        if (selected) {
          const customer = customers.find((c) => c._id === selected.value);
          if (customer) {
            addNotification(`Customer ${customer.customerName} selected`, "success");
          }
        }
      },
      [customers, setFormData, addNotification, setFormErrors]
    );

    const handleItemChange = useCallback(
      (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === "itemId") {
          const item = stockItems.find((i) => i._id === value);
          if (item) {
            newItems[index].description = item.itemName;
            newItems[index].salesPrice = item.salesPrice;
            newItems[index].purchasePrice = item.purchasePrice;
            newItems[index].vatPercent =
              item.taxPercent !== undefined
                ? item.taxPercent.toString()
                : newItems[index].vatPercent || "5";
            const qty = parseFloat(newItems[index].qty) || 0;
            const salesPrice = parseFloat(newItems[index].salesPrice) || 0;
            const vatPercent = parseFloat(newItems[index].vatPercent) || 0;
            newItems[index].total = qty
              ? (salesPrice * qty).toFixed(2)
              : "0.00";
            newItems[index].vatAmount = qty
              ? (salesPrice * qty * (vatPercent / 100)).toFixed(2)
              : "0.00";
            newItems[index].grandTotal = qty
              ? (salesPrice * qty * (1 + vatPercent / 100)).toFixed(2)
              : "0.00";
            if (item.currentStock < item.reorderLevel) {
              addNotification(
                `Warning: ${item.itemName} is running low on stock (${item.currentStock} remaining)`,
                "warning"
              );
            }
          } else {
            newItems[index].description = "";
            newItems[index].salesPrice = 0;
            newItems[index].purchasePrice = 0;
            newItems[index].vatPercent = "5";
            newItems[index].total = "0.00";
            newItems[index].vatAmount = "0.00";
            newItems[index].grandTotal = "0.00";
          }
        } else if (
          field === "qty" ||
          field === "salesPrice" ||
          field === "vatPercent"
        ) {
          const qty = parseFloat(newItems[index].qty) || 0;
          const salesPrice = parseFloat(newItems[index].salesPrice) || 0;
          const vatPercent = parseFloat(newItems[index].vatPercent) || 0;
          newItems[index].total = qty
            ? (salesPrice * qty).toFixed(2)
            : "0.00";
          newItems[index].vatAmount = qty
            ? (salesPrice * qty * (vatPercent / 100)).toFixed(2)
            : "0.00";
          newItems[index].grandTotal = qty
            ? (salesPrice * qty * (1 + vatPercent / 100)).toFixed(2)
            : "0.00";
        }

        setFormData((prev) => ({ ...prev, items: newItems }));
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
            qty: "",
            total: "0.00",
            vatPercent: "5",
            vatAmount: "0.00",
            salesPrice: 0,
            purchasePrice: 0,
            grandTotal: "0.00",
          },
        ],
      }));
    }, [setFormData]);

    const removeItem = useCallback(
      (index) => {
        if (formData.items.length > 1) {
          const newItems = formData.items.filter((_, i) => i !== index);
          setFormData((prev) => ({ ...prev, items: newItems }));
          setFormErrors((prev) => {
            const updatedErrors = { ...prev };
            Object.keys(prev).forEach((key) => {
              if (key.includes(`_${index}`)) {
                delete updatedErrors[key];
              }
            });
            return updatedErrors;
          });
        }
      },
      [formData.items, setFormData, setFormErrors]
    );

    const saveSO = useCallback(async () => {
      if (!validateForm()) {
        addNotification("Please fix form errors before saving", "error");
        return;
      }

      try {
        const totals = calculateTotals(formData.items);
        const transactionData = {
          transactionNo: formData.transactionNo,
          type: "sales_order",
          partyId: formData.partyId,
          partyType: "customer",
          date: formData.date,
          deliveryDate: formData.deliveryDate,
          status: formData.status,
          totalAmount: parseFloat(totals.total),
          items: formData.items
            .filter((item) => item.itemId && item.qty && item.salesPrice)
            .map((item) => {
              const qty = parseFloat(item.qty) || 0;
              const salesPrice = parseFloat(item.salesPrice) || 0;
              const vatPercent = parseFloat(item.vatPercent) || 0;
              const total = qty * salesPrice;
              const vatAmount = total * (vatPercent / 100);
              const grandTotal = total + vatAmount;

              return {
                itemId: item.itemId,
                description: item.description,
                qty,
                rate: parseFloat(total.toFixed(2)),
                vatPercent,
                vatAmount: parseFloat(vatAmount.toFixed(2)),
                price:salesPrice,
                purchasePrice: item.purchasePrice || 0,
                grandTotal: parseFloat(grandTotal.toFixed(2)),
              };
            }),
          terms: formData.terms,
          notes: formData.notes,
          createdBy: "Current User",
          priority: formData.priority,
        };

        let response;
        if (selectedSO) {
          response = await axiosInstance.put(
            `/transactions/transactions/${selectedSO.id}`,
            transactionData
          );
          addNotification("Sales Order updated successfully", "success");
        } else {
          response = await axiosInstance.post(
            "/transactions/transactions",
            transactionData
          );
          addNotification("Sales Order created successfully", "success");
        }

        const newSO = {
          id: response.data.data._id,
          transactionNo: response.data.data.transactionNo,
          customerId: response.data.data.partyId,
          customerName:
            customers.find((c) => c._id === response.data.data.partyId)?.customerName || "Unknown",
          date: response.data.data.date,
          deliveryDate: response.data.data.deliveryDate,
          status: response.data.data.status,
          approvalStatus: response.data.data.status,
          totalAmount: response.data.data.totalAmount.toFixed(2),
          items: response.data.data.items,
          terms: response.data.data.terms,
          notes: response.data.data.notes,
          createdBy: response.data.data.createdBy,
          createdAt: response.data.data.createdAt,
          invoiceGenerated: response.data.data.invoiceGenerated,
          priority: response.data.data.priority,
        };

        if (selectedSO) {
          setSalesOrders((prev) =>
            prev.map((so) => (so.id === selectedSO.id ? newSO : so))
          );
        } else {
          setSalesOrders((prev) => [newSO, ...prev]);
        }

        onSOSuccess(newSO);
      } catch (error) {
        addNotification(
          "Failed to save sales order: " + (error.response?.data?.message || error.message),
          "error"
        );
      }
    }, [
      validateForm,
      formData,
      selectedSO,
      customers,
      setSalesOrders,
      addNotification,
      onSOSuccess,
      calculateTotals,
    ]);

    const totals = formData.totals || calculateTotals(formData.items);

    const stableCustomers = useMemo(() => customers || [], [customers]);
    const stableStockItems = useMemo(() => stockItems || [], [stockItems]);

    const itemOptions = useMemo(
      () =>
        stableStockItems.map((stock) => ({
          value: stock._id,
          label: `${stock.itemId} - ${stock.itemName}`,
        })),
      [stableStockItems]
    );

    const customerOptions = useMemo(
      () =>
        stableCustomers.map((customer) => ({
          value: customer._id,
          label: `${customer.customerId} - ${customer.customerName}`,
        })),
      [stableCustomers]
    );

    const customSelectStyles = {
      control: (provided, state) => ({
        ...provided,
        width: "100%",
        padding: "0.75rem 1rem",
        backgroundColor: "#fff",
        borderRadius: "0.75rem",
        border: formErrors.partyId
          ? "1px solid #ef4444"
          : "1px solid #e2e8f0",
        outline: "none",
        boxShadow: state.isFocused ? "0 0 0 2px #3b82f6" : "none",
        "&:hover": {
          border: formErrors.partyId
            ? "1px solid #ef4444"
            : "1px solid #e2e8f0",
        },
        fontSize: "0.875rem",
      }),
      menu: (provided) => ({
        ...provided,
        backgroundColor: "#fff",
        borderRadius: "0.75rem",
        border: "1px solid #e2e8f0",
      }),
      option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected
          ? "#3b82f6"
          : state.isFocused
          ? "#f1f5f9"
          : "#fff",
        color: state.isSelected ? "#fff" : "#1e293b",
        "&:hover": {
          backgroundColor: "#f1f5f9",
        },
      }),
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="relative bg-white/80 backdrop-blur-xl shadow-xl border-b border-gray-200/50">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setActiveView("list");
                    resetForm();
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-slate-800">
                    {isEditing ? "Edit Sales Order" : "Create Sales Order"}
                  </h1>
                  <p className="text-slate-600 mt-1">
                    {isEditing ? "Update sales order details" : "Create a new sales order"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={saveSO}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  <span>{isEditing ? "Update SO" : "Save SO"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-2xl p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    SO Number
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      name="transactionNo"
                      value={formData.transactionNo || ""}
                      onChange={handleInputChange}
                      disabled
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="date"
                        name="date"
                        value={formData.date || ""}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 bg-white rounded-xl border ${
                          formErrors.date ? "border-red-500" : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      />
                      {formErrors.date && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.date}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Delivery Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="date"
                        name="deliveryDate"
                        value={formData.deliveryDate || ""}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 bg-white rounded-xl border ${
                          formErrors.deliveryDate ? "border-red-500" : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      />
                      {formErrors.deliveryDate && (
                        <p className="text-red-500 text-xs mt-1">{formErrors.deliveryDate}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Select Customer
                  </label>
                  <Select
                    options={customerOptions}
                    value={customerOptions.find((opt) => opt.value === formData.partyId) || null}
                    onChange={handleCustomerSelect}
                    placeholder="Select a customer..."
                    isClearable
                    isSearchable
                    classNamePrefix="select"
                    className={`text-sm ${formErrors.partyId ? "border-red-500 rounded-lg" : ""}`}
                    styles={customSelectStyles}
                  />
                  {formErrors.partyId && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.partyId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status || "DRAFT"}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="CONFIRMED">Confirmed</option>
                    {isEditing && <option value="INVOICED">Invoiced</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    key="notes"
                    name="notes"
                    value={formData.notes || ""}
                    onChange={handleInputChange}
                    placeholder="Additional notes or special instructions"
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
                  />
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Customer Preview</h3>
                {formData.partyId ? (
                  (() => {
                    const customer = stableCustomers.find((c) => c._id === formData.partyId);
                    return customer ? (
                      <div className="text-sm text-slate-700 space-y-2">
                        <p className="font-semibold text-blue-600">{customer.customerId}</p>
                        <p className="font-bold text-slate-800">{customer.customerName}</p>
                        <p>{customer.address}</p>
                        <p className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{customer.phone}</span>
                        </p>
                        <p>{customer.email}</p>
                        <p>VAT: {customer.vatNumber}</p>
                        <p>Terms: {customer.paymentTerms}</p>
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">Customer not found</p>
                    );
                  })()
                ) : (
                  <p className="text-slate-500 italic">Select a customer to see details</p>
                )}

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-3">Order Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Items:</span>
                      <span>{formData.items.filter((item) => item.itemId).length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>AED {totals.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>VAT:</span>
                      <span>AED {totals.vat}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span className="text-emerald-600">AED {totals.total}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-slate-800 flex items-center">
                  <Package className="w-6 h-6 mr-2 text-blue-600" />
                  Sales Items
                </h3>
                <button
                  onClick={addItem}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Item</span>
                </button>
              </div>

              {formErrors.items && (
                <p className="text-red-500 text-sm mb-4">{formErrors.items}</p>
              )}

              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div
                    key={`item-${index}`}
                    className="grid grid-cols-10 gap-4 items-center p-4 bg-slate-50 rounded-xl border border-slate-200 relative"
                  >
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Item</label>
                      <Select
                        options={itemOptions}
                        value={itemOptions.find((opt) => opt.value === item.itemId) || null}
                        onChange={(selected) =>
                          handleItemChange(index, "itemId", selected ? selected.value : "")
                        }
                        placeholder="Select Item..."
                        isClearable
                        isSearchable
                        classNamePrefix="select"
                        className={`text-sm ${
                          formErrors[`itemId_${index}`] ? "border-red-500 rounded-lg" : ""
                        }`}
                      />
                      {formErrors[`itemId_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">{formErrors[`itemId_${index}`]}</p>
                      )}
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={item.description || ""}
                        onChange={(e) => handleItemChange(index, "description", e.target.value)}
                        placeholder="Description"
                        className="w-full px-4 py-3 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Price</label>
                      <input
                        type="number"
                        value={item.purchasePrice || ""}
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Sales Price</label>
                      <input
                        type="number"
                        value={item.salesPrice || ""}
                        onChange={(e) => handleItemChange(index, "salesPrice", e.target.value)}
                        placeholder="Price"
                        min="0"
                        step="0.01"
                        className={`w-full px-4 py-3 bg-white rounded-lg border ${
                          formErrors[`salesPrice_${index}`] ? "border-red-500" : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`}
                      />
                      {formErrors[`salesPrice_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">{formErrors[`salesPrice_${index}`]}</p>
                      )}
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={item.qty || ""}
                        onChange={(e) => handleItemChange(index, "qty", e.target.value)}
                        placeholder="Qty"
                        min="0"
                        className={`w-full px-4 py-3 bg-white rounded-lg border ${
                          formErrors[`qty_${index}`] ? "border-red-500" : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`}
                      />
                      {formErrors[`qty_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">{formErrors[`qty_${index}`]}</p>
                      )}
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Total</label>
                      <input
                        type="number"
                        value={item.total || ""}
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">VAT %</label>
                      <input
                        type="number"
                        value={item.vatPercent || ""}
                        onChange={(e) => handleItemChange(index, "vatPercent", e.target.value)}
                        placeholder="VAT %"
                        min="0"
                        step="0.1"
                        className={`w-full px-4 py-3 bg-white rounded-lg border ${
                          formErrors[`vatPercent_${index}`] ? "border-red-500" : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`}
                      />
                      {formErrors[`vatPercent_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">{formErrors[`vatPercent_${index}`]}</p>
                      )}
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">VAT Amount</label>
                      <input
                        type="number"
                        value={item.vatAmount || ""}
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Grand Total</label>
                      <input
                        type="number"
                        value={item.grandTotal || ""}
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1 flex justify-end">
                      {formData.items.length > 1 && (
                        <button
                          onClick={() => removeItem(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
  (prevProps, nextProps) => {
    return (
      prevProps.formData === nextProps.formData &&
      prevProps.customers === nextProps.customers &&
      prevProps.stockItems === nextProps.stockItems &&
      prevProps.addNotification === nextProps.addNotification &&
      prevProps.selectedSO === nextProps.selectedSO &&
      prevProps.setSelectedSO === nextProps.setSelectedSO &&
      prevProps.setActiveView === nextProps.setActiveView &&
      prevProps.setSalesOrders === nextProps.setSalesOrders &&
      prevProps.activeView === nextProps.activeView &&
      prevProps.resetForm === nextProps.resetForm &&
      prevProps.calculateTotals === nextProps.calculateTotals &&
      prevProps.onSOSuccess === nextProps.onSOSuccess &&
      prevProps.formErrors === nextProps.formErrors &&
      prevProps.setFormErrors === nextProps.setFormErrors
    );
  }
);

export default SOForm;