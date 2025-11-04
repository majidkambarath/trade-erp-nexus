import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  Package,
  Plus,
  Trash2,
  Calendar,
  User,
  Save,
  ArrowLeft,
  Hash,
} from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../../axios/axios";

// FIX: Refined memoization to prevent unnecessary re-renders.
// By moving the comparator function outside, it's not recreated on every render.
const arePropsEqual = (prevProps, nextProps) => {
  return (
    prevProps.formData === nextProps.formData &&
    prevProps.vendors === nextProps.vendors &&
    prevProps.stockItems === nextProps.stockItems &&
    prevProps.selectedPO === nextProps.selectedPO &&
    prevProps.activeView === nextProps.activeView &&
    // Functions from parent are generally stable, but props like formData are what matter
    // We can assume functions like addNotification, resetForm etc. are stable.
    prevProps.calculateTotals === nextProps.calculateTotals
  );
};

const POForm = React.memo(
  ({
    formData,
    setFormData,
    vendors,
    stockItems,
    addNotification,
    selectedPO,
    setSelectedPO,
    setActiveView,
    setPurchaseOrders,
    activeView = "create",
    resetForm,
    calculateTotals,
    onPOSuccess,
  }) => {
    const isEditing = activeView === "edit";
    const [formErrors, setFormErrors] = useState({});

    // This is correct. `useMemo` is the right tool for derived state.
    const totals = useMemo(() => {
      return calculateTotals(formData.items);
    }, [formData.items, calculateTotals]);

    useEffect(() => {
      console.log("POForm rendered");
    }, []);

    const validateForm = useCallback(() => {
      const errors = {};
      if (!formData.partyId) errors.partyId = "Vendor is required";
      if (!formData.date) errors.date = "Date is required";
      if (!formData.deliveryDate) errors.deliveryDate = "Delivery date is required";
      if (!formData.items.some((item) => item.itemId && parseFloat(item.qty) > 0)) {
        errors.items = "At least one item with a quantity greater than 0 is required";
      }
      formData.items.forEach((item, index) => {
        // Only validate rows that have been started
        if (item.itemId || item.qty || item.currentPurchasePrice) {
          if (!item.itemId) errors[`itemId_${index}`] = "Item is required";
          if (!item.qty || parseFloat(item.qty) <= 0)
            errors[`qty_${index}`] = "Quantity must be > 0";
          if (!item.currentPurchasePrice || parseFloat(item.currentPurchasePrice) <= 0)
            errors[`currentPurchasePrice_${index}`] = "Price must be > 0";
        }
      });
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    }, [formData]);

    const handleInputChange = useCallback(
      (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setFormErrors((prev) => ({ ...prev, [name]: null }));
      },
      [setFormData]
    );

    const handleVendorSelect = useCallback(
      (selected) => {
        const vendorId = selected ? selected.value : "";
        setFormData((prev) => ({ ...prev, partyId: vendorId }));
        setFormErrors((prev) => ({ ...prev, partyId: null }));
      },
      [setFormData]
    );

    // FIX: Centralized and robust item calculation logic.
    const handleItemChange = useCallback(
      (index, field, value) => {
        const newItems = [...formData.items];
        const currentItem = { ...newItems[index] };
        
        // Update the field that was changed
        currentItem[field] = value;

        // If the item ID changes, populate details from stock
        if (field === "itemId") {
          const stockItem = stockItems.find((i) => i._id === value);
          if (stockItem) {
            currentItem.description = stockItem.itemName;
            currentItem.brand = stockItem.brand || "";
            currentItem.origin = stockItem.origin || "";
            currentItem.vatPercent = (stockItem.vatPercent !== undefined ? stockItem.vatPercent : 5).toString();
            // Only set purchase price if not already set, to avoid overwriting a manual entry
            if (!currentItem.currentPurchasePrice || parseFloat(currentItem.currentPurchasePrice) === 0) {
              currentItem.currentPurchasePrice = (stockItem.purchasePrice || 0).toString();
            }
            // Always update the system price for reference
            currentItem.purchasePrice = stockItem.purchasePrice || 0;
          } else {
            // Reset fields if item is cleared
            currentItem.description = "";
            currentItem.brand = "";
            currentItem.origin = "";
          }
        }
        
        // --- Single Source of Truth for Calculations ---
        const qty = parseFloat(currentItem.qty) || 0;
        const price = parseFloat(currentItem.currentPurchasePrice) || 0;
        const vatPercent = parseFloat(currentItem.vatPercent) || 0;

        const subtotal = qty * price;
        const vatAmount = subtotal * (vatPercent / 100);
        const grandTotal = subtotal + vatAmount;

        // Update the item object with calculated values (as strings for input fields)
        currentItem.total = subtotal.toFixed(2);
        currentItem.vatAmount = vatAmount.toFixed(2);
        currentItem.grandTotal = grandTotal.toFixed(2);

        newItems[index] = currentItem;

        setFormData((prev) => ({ ...prev, items: newItems }));
        setFormErrors((prev) => ({ ...prev, [`${field}_${index}`]: null }));
      },
      [formData.items, stockItems, setFormData]
    );

    const addItem = useCallback(() => {
      setFormData((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          {
            itemId: "", description: "", qty: "",
            purchasePrice: 0, currentPurchasePrice: "", vatPercent: "5",
            brand: "", origin: "", total: "0.00", vatAmount: "0.00", grandTotal: "0.00",
          },
        ],
      }));
    }, [setFormData]);

    const removeItem = useCallback(
      (index) => {
        if (formData.items.length <= 1) return;
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData((prev) => ({ ...prev, items: newItems }));
      },
      [formData.items, setFormData]
    );
    
    // FIX: CRITICAL FIX for data integrity during save and hydration.
    const savePO = useCallback(async () => {
      if (!validateForm()) {
        addNotification("Please fix form errors before saving", "error");
        return;
      }

      // Use the already calculated totals from useMemo for consistency
      const finalTotals = calculateTotals(formData.items);

      // 1. Prepare a clean payload for the API
      const transactionData = {
    // Keep top-level fields from the form state
    transactionNo: formData.transactionNo,
    partyId: formData.partyId,
    vendorReference: formData.vendorReference,
    date: formData.date,
    deliveryDate: formData.deliveryDate,
    status: formData.status,
    terms: formData.terms,
    notes: formData.notes,
    priority: formData.priority,
    
    // FIX 1: Add back the mandatory 'type' and 'partyType' fields
    type: "purchase_order", 
    partyType: "Vendor",

    // FIX 2: Add a placeholder for 'createdBy' as it's often required
    createdBy: "Current User", // Or get the actual user ID if available

    // Use the calculated total
    totalAmount: parseFloat(finalTotals.total),

    // Filter and map the items
    items: formData.items
      .filter(item => item.itemId && parseFloat(item.qty) > 0)
      .map(item => {
        const qty = parseFloat(item.qty) || 0;
        const currentPurchasePrice = parseFloat(item.currentPurchasePrice) || 0;
        const vatPercent = parseFloat(item.vatPercent) || 0;
        const lineSubtotal = qty * currentPurchasePrice;
        const vatAmount = lineSubtotal * (vatPercent / 100);
        const grandTotal = lineSubtotal + vatAmount;
        
        return {
          itemId: item.itemId,
          description: item.description,
          qty: qty,
          price: currentPurchasePrice, 
          currentPurchasePrice: currentPurchasePrice,
          rate: parseFloat(lineSubtotal.toFixed(2)),
          
          // FIX 3: Add 'lineTotal' as an alias for 'rate'. The backend might need this exact name.
          lineTotal: parseFloat(lineSubtotal.toFixed(2)),

          vatPercent: vatPercent,
          vatAmount: parseFloat(vatAmount.toFixed(2)),
          grandTotal: parseFloat(grandTotal.toFixed(2)),
          brand: item.brand,
          origin: item.origin,
        };
      }),
  };
  
  console.log("Sending payload to backend:", JSON.stringify(transactionData, null, 2));

      
      try {
        let response;
        if (selectedPO) {
          response = await axiosInstance.put(`/transactions/transactions/${selectedPO.id}`, transactionData);
          addNotification("Purchase Order updated successfully", "success");
        } else {
          response = await axiosInstance.post("/transactions/transactions", transactionData);
          addNotification("Purchase Order created successfully", "success");
        }

        const savedPOData = response.data.data;

        // 2. Hydrate the full PO object for the InvoiceView
        const newPO = {
          ...savedPOData, // Start with what the backend returned
          id: savedPOData._id,
          vendorId: savedPOData.partyId,
          vendorName: vendors.find(v => v._id === savedPOData.partyId)?.vendorName || "Unknown",
          // Ensure items array is complete
          items: (savedPOData.items || []).map(backendItem => {
            // Find the original item from the form to get complete data
            const originalItem = transactionData.items.find(i => i.itemId === backendItem.itemId);
            
            // Merge backend data with original data, prioritizing backend where it exists
            return {
              ...originalItem, // Provides fallbacks for everything (currentPurchasePrice, etc.)
              ...backendItem, // Overwrites with confirmed saved data from backend
              // Explicitly ensure critical calculated fields are correct
              rate: backendItem.rate || originalItem?.rate || 0,
              vatAmount: backendItem.vatAmount || originalItem?.vatAmount || 0,
              grandTotal: backendItem.grandTotal || originalItem?.grandTotal || 0,
              currentPurchasePrice: originalItem?.currentPurchasePrice || (backendItem.rate / backendItem.qty) || 0,
            };
          }),
        };

        if (selectedPO) {
          setPurchaseOrders(prev => prev.map(po => (po.id === selectedPO.id ? newPO : po)));
        } else {
          setPurchaseOrders(prev => [newPO, ...prev]);
        }

        onPOSuccess(newPO); // Pass the fully hydrated object to the success handler

      } catch (error) {
        console.error("Save PO Error:", error.response?.data || error.message);
        addNotification(`Failed to save PO: ${error.response?.data?.message || error.message}`, "error");
      }
    }, [formData, selectedPO, vendors, addNotification, calculateTotals, onPOSuccess, setPurchaseOrders, validateForm]);

    const stableVendors = useMemo(() => vendors || [], [vendors]);
    const stableStockItems = useMemo(() => stockItems || [], [stockItems]);

    const itemOptions = useMemo(
      () =>
        stableStockItems.map((stock) => ({
          value: stock._id,
          label: `${stock.itemId} - ${stock.itemName}`,
        })),
      [stableStockItems]
    );

    const vendorOptions = useMemo(
      () =>
        stableVendors.map((vendor) => ({
          value: vendor._id,
          label: `${vendor.vendorId} - ${vendor.vendorName}`,
        })),
      [stableVendors]
    );

    // Custom styles for react-select to match input styling
    const customSelectStyles = {
      control: (provided, state) => ({
        ...provided,
        width: "100%",
        padding: "0.75rem 1rem",
        backgroundColor: "#fff",
        borderRadius: "0.75rem",
        border: formErrors.partyId ? "1px solid #ef4444" : "1px solid #e2e8f0",
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
                    {isEditing
                      ? "Edit Purchase Order"
                      : "Create Purchase Order"}
                  </h1>
                  <p className="text-slate-600 mt-1">
                    {isEditing
                      ? "Update purchase order details"
                      : "Create a new purchase order"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={savePO}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  <span>{isEditing ? "Update PO" : "Save PO"}</span>
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
                    PO Number
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
                          formErrors.date
                            ? "border-red-500"
                            : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      />
                      {formErrors.date && (
                        <p className="text-red-500 text-xs mt-1">
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
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="date"
                        name="deliveryDate"
                        value={formData.deliveryDate || ""}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 bg-white rounded-xl border ${
                          formErrors.deliveryDate
                            ? "border-red-500"
                            : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      />
                      {formErrors.deliveryDate && (
                        <p className="text-red-500 text-xs mt-1">
                          {formErrors.deliveryDate}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Select Vendor
                  </label>
                  <Select
                    options={vendorOptions}
                    value={
                      vendorOptions.find(
                        (opt) => opt.value === formData.partyId
                      ) || null
                    }
                    onChange={handleVendorSelect}
                    placeholder="Select a vendor..."
                    isClearable
                    isSearchable
                    classNamePrefix="select"
                    className={`text-sm  ${
                      formErrors.partyId ? "border-red-500 rounded-lg" : ""
                    }`}
                    styles={customSelectStyles}
                  />
                  {formErrors.partyId && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.partyId}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Reference
                  </label>
                  <input
                    type="text"
                    name="vendorReference"
                    value={formData.vendorReference || ""}
                    onChange={handleInputChange}
                    placeholder="Enter reference"
                    className={`w-full px-4 py-3 bg-white rounded-xl border ${
                      formErrors.vendorReference
                        ? "border-red-500"
                        : "border-slate-200"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`}
                  />
                  {formErrors.vendorReference && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.vendorReference}
                    </p>
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
                    <option value="PENDING">Pending Approval</option>
                    {isEditing && <option value="APPROVED">Approved</option>}
                    {isEditing && <option value="REJECTED">Rejected</option>}
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
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Vendor Preview
                </h3>
                {formData.partyId ? (
                  (() => {
                    const vendor = stableVendors.find(
                      (v) => v._id === formData.partyId
                    );
                    return vendor ? (
                      <div className="text-sm text-slate-700 space-y-2">
                        <p className="font-semibold text-blue-600">
                          {vendor.vendorId}
                        </p>
                        <p className="font-bold text-slate-800">
                          {vendor.vendorName}
                        </p>
                        <p>{vendor.address}</p>
                        <p className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{vendor.phone}</span>
                        </p>
                        <p>{vendor.email}</p>
                        <p>VAT: {vendor.vatNumber}</p>
                        <p>Terms: {vendor.paymentTerms}</p>
                        <p>Reference: {formData.vendorReference || "N/A"}</p>
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">Vendor not found</p>
                    );
                  })()
                ) : (
                  <p className="text-slate-500 italic">
                    Select a vendor to see details
                  </p>
                )}

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-3">
                    Order Summary
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Items:</span>
                      <span>
                        {formData.items.filter((item) => item.itemId).length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>AED {parseFloat(totals.subtotal || 0).toFixed(2)}</span>  {/* FIX: Ensure display */}
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>VAT:</span>
                      <span>AED {parseFloat(totals.tax || 0).toFixed(2)}</span>  {/* FIX: Use 'tax' from calculateTotals */}
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span className="text-emerald-600">
                          AED {parseFloat(totals.total || 0).toFixed(2)}
                        </span>
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
                  Purchase Items
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
                    className="grid grid-cols-7 gap-4 items-center p-4 bg-slate-50 rounded-xl border border-slate-200 relative"
                  >
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Item
                      </label>
                      <Select
                        options={itemOptions}
                        value={
                          itemOptions.find(
                            (opt) => opt.value === item.itemId
                          ) || null
                        }
                        onChange={(selected) =>
                          handleItemChange(
                            index,
                            "itemId",
                            selected ? selected.value : ""
                          )
                        }
                        placeholder="Select Item..."
                        isClearable
                        isSearchable
                        classNamePrefix="select"
                        className={`text-sm ${
                          formErrors[`itemId_${index}`]
                            ? "border-red-500 rounded-lg"
                            : ""
                        }`}
                      />
                      {formErrors[`itemId_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">
                          {formErrors[`itemId_${index}`]}
                        </p>
                      )}
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={item.description || ""}
                        onChange={(e) =>
                          handleItemChange(index, "description", e.target.value)
                        }
                        placeholder="Description"
                        className="w-full px-4 py-3 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Brand
                      </label>
                      <input
                        type="text"
                        value={item.brand || ""}
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Origin
                      </label>
                      <input
                        type="text"
                        value={item.origin || ""}
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Quantity
                      </label>
                      <input
                      type="text"  // FIX: Change to text for free typing
                      value={item.qty || ""}  // FIX: String for smooth typing (empty fallback)
                      onChange={(e) => handleItemChange(index, "qty", e.target.value)}  // Passes raw string
                      placeholder="Qty"
                      pattern="[0-9]*\.?[0-9]+"  // FIX: Allow decimals (0-9, optional dot, more 0-9)
                      className={`w-full px-4 py-3 bg-white rounded-lg border ${
                      formErrors[`qty_${index}`]
                      ? "border-red-500"
                      :"border-slate-200"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`}
                      />                                                
                      {formErrors[`qty_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">
                          {formErrors[`qty_${index}`]}
                        </p>
                      )}
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        System Purchase Price
                      </label>
                      <input
                        type="number"
                        value={item.purchasePrice || "0.00"}  /* FIX: Default display */
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        New Purchase Price
                      </label>
                      <input
                      type="text"  // FIX: Change to text
                      value={item.currentPurchasePrice || ""}  // FIX: String fallback
                      onChange={(e) => handleItemChange(index, "currentPurchasePrice", e.target.value)}
                      placeholder="New Price"
                      pattern="[0-9]*\.?[0-9]+"  // FIX: Decimal pattern
                      className={`w-full px-4 py-3 bg-white rounded-lg border ${
                      formErrors[`currentPurchasePrice_${index}`]
                      ? "border-red-500"
                      : "border-slate-200"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`}
                      />
                      {formErrors[`currentPurchasePrice_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">
                          {formErrors[`currentPurchasePrice_${index}`]}
                        </p>
                      )}
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Total
                      </label>
                      <input
                        type="number"
                        value={item.total || "0.00"}  /* FIX: Ensure display */
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        VAT %
                      </label>
                      <input
                        type="number"
                        value={item.vatPercent || "5.00"}  /* FIX: Default display */
                        onChange={(e) =>
                          handleItemChange(index, "vatPercent", e.target.value)
                        }
                        placeholder="VAT %"
                        min="0"
                        step="0.1"
                        className={`w-full px-4 py-3 bg-white rounded-lg border ${
                          formErrors[`vatPercent_${index}`]
                            ? "border-red-500"
                            : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`}
                      />
                      {formErrors[`vatPercent_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">
                          {formErrors[`vatPercent_${index}`]}
                        </p>
                      )}
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        VAT Amount
                      </label>
                      <input
                        type="number"
                        value={item.vatAmount || "0.00"}  /* FIX: Ensure display */
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Grand Total
                      </label>
                      <input
                        type="number"
                        value={item.grandTotal || "0.00"}  /* FIX: Ensure display */
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
  // FIX: Refined memo deps (removed set* functions, added calculateTotals)
  (prevProps, nextProps) => {
    return (
      prevProps.formData === nextProps.formData &&
      prevProps.vendors === nextProps.vendors &&
      prevProps.stockItems === nextProps.stockItems &&
      prevProps.addNotification === nextProps.addNotification &&
      prevProps.selectedPO === nextProps.selectedPO &&
      prevProps.activeView === nextProps.activeView &&
      prevProps.calculateTotals === nextProps.calculateTotals
    );
  },
   arePropsEqual
);

export default POForm;