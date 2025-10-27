import React, { useCallback, useMemo, useState, useEffect } from "react";
import { Package, Plus, Trash2, Calendar, User, Save, ArrowLeft, Hash } from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../../axios/axios";
import { debounce } from "lodash";

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
    const [availablePOs, setAvailablePOs] = useState([]);
    const [selectedPOId, setSelectedPOId] = useState(null);

    // Memoize debouncedAddNotification
    const debouncedAddNotification = useMemo(() => {
      return debounce((message, type) => {
        addNotification(message, type);
      }, 300);
    }, [addNotification]);

    // Clean up debounce on unmount
    useEffect(() => {
      return () => {
        debouncedAddNotification.cancel();
      };
    }, [debouncedAddNotification]);

    // Update totals when items change
    useEffect(() => {
      const totals = calculateTotals(formData.items);
      setFormData((prev) => ({ ...prev, totals }));
    }, [formData.items.length]);

    // Fetch approved purchase orders for the selected vendor
    const fetchApprovedPOs = useCallback(
      async (vendorId) => {
        if (!vendorId) {
          setAvailablePOs([]);
          return;
        }
        try {
          const params = new URLSearchParams();
          params.append("partyId", vendorId);
          params.append("partyType", "Vendor");
          params.append("type", "purchase_order");
          params.append("status", "APPROVED");
          const response = await axiosInstance.get(`/transactions/transactions?${params.toString()}`);
          const pos = response.data.data || [];
          setAvailablePOs(pos);
          if (pos.length > 0) {
            debouncedAddNotification("Approved purchase orders fetched successfully", "success");
          }
        } catch (err) {
          debouncedAddNotification("Failed to fetch approved purchase orders.", "error");
          setAvailablePOs([]);
        }
      },
      []
    );

    // Fetch POs when vendor changes
    useEffect(() => {
      fetchApprovedPOs(formData.partyId);
    }, [formData.partyId, fetchApprovedPOs]);

    // Handle PO selection and auto-populate form and vendor preview
    const handlePOSelect = useCallback(
      (selected) => {
        const poId = selected ? selected.value : null;
        setSelectedPOId(poId);
        if (poId) {
          const po = availablePOs.find((p) => p._id === poId);
          if (po) {
            const newItems = po.items.map((item) => ({
              itemId: item.itemId,
              description: item.description || "",
              qty: item.qty.toString(),
              total: item.rate.toString(),
              vatPercent: item.vatPercent.toString(),
              vatAmount: item.vatAmount.toString(),
              currentPurchasePrice: item.stockDetails?.purchasePrice || item.rate / item.qty || 0,
              purchasePrice: item.stockDetails?.purchasePrice || item.rate / item.qty || 0,
              brand: item.stockDetails?.brand || "",
              origin: item.stockDetails?.origin || "",
              grandTotal: item.lineTotal.toString(),
            }));
            setFormData((prev) => ({
              ...prev,
              items: newItems.length > 0 ? newItems : prev.items,
              transactionNo: prev.transactionNo || `PR${Math.floor(Math.random() * 10000)}`,
              date: prev.date || new Date().toISOString().split("T")[0],
              deliveryDate: prev.deliveryDate || po.deliveryDate.split("T")[0],
              vendorReference: po.vendorReference || "",
              vendorDetails: {
                ...prev.vendorDetails,
                paymentTerms: po.terms || "30 days",
                vendorReference: po.vendorReference || "",
              },
            }));
            debouncedAddNotification(`Purchase order ${po.transactionNo} selected`, "success");
          }
        } else {
          setFormData((prev) => ({
            ...prev,
            items: [
              {
                itemId: "",
                description: "",
                qty: "",
                total: "0.00",
                vatPercent: "5",
                vatAmount: "0.00",
                currentPurchasePrice: 0,
                purchasePrice: 0,
                brand: "",
                origin: "",
                grandTotal: "0.00",
              },
            ],
            vendorReference: "",
            vendorDetails: { ...prev.vendorDetails, paymentTerms: "", vendorReference: "" },
          }));
        }
      },
      [availablePOs, setFormData, debouncedAddNotification]
    );

    // Validate form data
    const validateForm = useCallback(() => {
      const errors = {};
      if (!formData.partyId) errors.partyId = "Vendor is required";
      if (!formData.date) errors.date = "Date is required";
      if (!formData.deliveryDate) errors.deliveryDate = "Return date is required";
      if (!formData.vendorReference) errors.vendorReference = "Vendor reference is required";
      if (!formData.items.some((item) => item.itemId && item.qty && item.currentPurchasePrice)) {
        errors.items = "At least one valid item is required";
      }
      formData.items.forEach((item, index) => {
        if (item.itemId || item.qty || item.currentPurchasePrice) {
          if (!item.itemId) errors[`itemId_${index}`] = "Item code is required";
          if (!item.qty || parseFloat(item.qty) <= 0) {
            errors[`qty_${index}`] = "Quantity must be greater than 0";
          }
          if (!item.currentPurchasePrice || parseFloat(item.currentPurchasePrice) <= 0) {
            errors[`currentPurchasePrice_${index}`] = "Current purchase price must be greater than 0";
          }
          if (!item.vatPercent || parseFloat(item.vatPercent) < 0) {
            errors[`vatPercent_${index}`] = "VAT % must be non-negative";
          }
        }
      });
      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    }, [formData]);

    // Handle input changes
    const handleInputChange = useCallback(
      (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setFormErrors((prev) => ({ ...prev, [name]: null }));
      },
      [setFormData]
    );

    // Handle vendor selection with auto-fill for preview
    const handleVendorSelect = useCallback(
      (selected) => {
        const vendorId = selected ? selected.value : "";
        const vendor = vendors.find((v) => v._id === vendorId);
        setFormData((prev) => ({
          ...prev,
          partyId: vendorId,
          items: prev.items,
          vendorDetails: vendor || {},
        }));
        setFormErrors((prev) => ({ ...prev, partyId: null }));
        setSelectedPOId(null);
        setAvailablePOs([]);
        if (selected) {
          if (vendor) {
            debouncedAddNotification(`Vendor ${vendor.vendorName} selected`, "success");
          }
          fetchApprovedPOs(vendorId);
        }
      },
      [vendors, setFormData, debouncedAddNotification, fetchApprovedPOs]
    );

    // Handle item field changes
    const handleItemChange = useCallback(
      (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === "itemId") {
          const item = stockItems.find((i) => i._id === value);
          if (item) {
            newItems[index].description = item.itemName || "";
            newItems[index].currentPurchasePrice = item.purchasePrice || 0;
            newItems[index].purchasePrice = item.purchasePrice || 0;
            newItems[index].vatPercent = item.vatPercent !== undefined ? item.vatPercent.toString() : newItems[index].vatPercent || "5";
            newItems[index].brand = item.brand || "";
            newItems[index].origin = item.origin || "";
            const qty = parseFloat(newItems[index].qty) || 0;
            const currentPurchasePrice = parseFloat(newItems[index].currentPurchasePrice) || 0;
            const vatPercent = parseFloat(newItems[index].vatPercent) || 0;
            newItems[index].total = qty ? (currentPurchasePrice * qty).toFixed(2) : "0.00";
            newItems[index].vatAmount = qty ? (currentPurchasePrice * qty * (vatPercent / 100)).toFixed(2) : "0.00";
            newItems[index].grandTotal = qty ? (currentPurchasePrice * qty * (1 + vatPercent / 100)).toFixed(2) : "0.00";
            if (item.currentStock < item.reorderLevel) {
              debouncedAddNotification(`Warning: ${item.itemName} is running low on stock (${item.currentStock} remaining)`, "warning");
            }
          } else {
            newItems[index].description = "";
            newItems[index].currentPurchasePrice = 0;
            newItems[index].purchasePrice = 0;
            newItems[index].vatPercent = "5";
            newItems[index].brand = "";
            newItems[index].origin = "";
            newItems[index].total = "0.00";
            newItems[index].vatAmount = "0.00";
            newItems[index].grandTotal = "0.00";
          }
        } else if (field === "qty" || field === "currentPurchasePrice" || field === "vatPercent") {
          const qty = parseFloat(newItems[index].qty) || 0;
          const currentPurchasePrice = parseFloat(newItems[index].currentPurchasePrice) || 0;
          const vatPercent = parseFloat(newItems[index].vatPercent) || 0;
          newItems[index].total = qty ? (currentPurchasePrice * qty).toFixed(2) : "0.00";
          newItems[index].vatAmount = qty ? (currentPurchasePrice * qty * (vatPercent / 100)).toFixed(2) : "0.00";
          newItems[index].grandTotal = qty ? (currentPurchasePrice * qty * (1 + vatPercent / 100)).toFixed(2) : "0.00";
        }

        setFormData((prev) => ({ ...prev, items: newItems }));
        setFormErrors((prev) => ({ ...prev, [`${field}_${index}`]: null }));
      },
      [formData.items, stockItems, setFormData, debouncedAddNotification]
    );

    // Add a new item
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
            currentPurchasePrice: 0,
            purchasePrice: 0,
            brand: "",
            origin: "",
            grandTotal: "0.00",
          },
        ],
      }));
    }, [setFormData]);

    // Remove an item
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
      [formData.items, setFormData]
    );

    // Save or update the purchase return order
    const savePO = useCallback(async () => {
      if (!validateForm()) {
        debouncedAddNotification("Please fix form errors before saving", "error");
        return;
      }

      try {
        const totals = calculateTotals(formData.items);
        const transactionData = {
          transactionNo: formData.transactionNo,
          type: "purchase_return",
          partyId: formData.partyId,
          partyType: "Vendor",
          date: formData.date,
          deliveryDate: formData.deliveryDate,
          status: formData.status,
          totalAmount: parseFloat(totals.total),
          vendorReference: formData.vendorReference,
          items: formData.items
            .filter((item) => item.itemId && item.qty && item.currentPurchasePrice)
            .map((item) => {
              const qty = parseFloat(item.qty) || 0;
              const currentPurchasePrice = parseFloat(item.currentPurchasePrice) || 0;
              const vatPercent = parseFloat(item.vatPercent) || 0;
              const total = qty * currentPurchasePrice;
              const vatAmount = total * (vatPercent / 100);
              const grandTotal = total + vatAmount;

              return {
                itemId: item.itemId,
                description: item.description,
                qty,
                rate: parseFloat(total.toFixed(2)),
                vatPercent,
                vatAmount: parseFloat(vatAmount.toFixed(2)),
                currentPurchasePrice,
                price: item.purchasePrice || 0,
                brand: item.brand || "",
                origin: item.origin || "",
                lineTotal: parseFloat(grandTotal.toFixed(2)),
              };
            }),
          terms: formData.terms,
          notes: formData.notes,
          createdBy: "Current User",
          priority: formData.priority || "Medium",
          linkedRef: selectedPOId || null,
        };

        let response;
        if (selectedPO) {
          response = await axiosInstance.put(
            `/transactions/transactions/${selectedPO.id}`,
            transactionData
          );
          debouncedAddNotification("Purchase Return Order updated successfully", "success");
        } else {
          response = await axiosInstance.post("/transactions/transactions", transactionData);
          debouncedAddNotification("Purchase Return Order created successfully", "success");
        }

        const newPO = {
          id: response.data.data._id,
          transactionNo: response.data.data.transactionNo,
          vendorId: response.data.data.partyId,
          vendorName: vendors.find((v) => v._id === response.data.data.partyId)?.vendorName || "Unknown",
          date: response.data.data.date,
          deliveryDate: response.data.data.deliveryDate,
          status: response.data.data.status,
          approvalStatus: response.data.data.status,
          totalAmount: response.data.data?.totalAmount.toFixed(2),
          vendorReference: response.data.data.vendorReference,
          items: response.data.data.items,
          terms: response.data.data.terms,
          notes: response.data.data.notes,
          createdBy: response.data.data.createdBy,
          createdAt: response.data.data.createdAt,
          grnGenerated: response.data.data.grnGenerated,
          invoiceGenerated: response.data.data.invoiceGenerated,
          priority: response.data.data.priority,
          linkedRef: response.data.data.linkedRef,
        };

        if (selectedPO) {
          setPurchaseOrders((prev) => prev.map((po) => (po.id === selectedPO.id ? newPO : po)));
        } else {
          setPurchaseOrders((prev) => [newPO, ...prev]);
        }

        onPOSuccess(newPO);
      } catch (error) {
        debouncedAddNotification(
          "Failed to save purchase return order: " + (error.response?.data?.message || error.message),
          "error"
        );
      }
    }, [
      validateForm,
      formData,
      selectedPO,
      vendors,
      setPurchaseOrders,
      debouncedAddNotification,
      onPOSuccess,
      calculateTotals,
      selectedPOId,
    ]);

    const totals = formData.totals || calculateTotals(formData.items);

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

    const poOptions = useMemo(
      () =>
        availablePOs.map((po) => ({
          value: po._id,
          label: `${po.transactionNo} - ${po.totalAmount.toFixed(2)} AED`,
        })),
      [availablePOs]
    );

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
          border: formErrors.partyId ? "1px solid #ef4444" : "1px solid #e2e8f0",
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
        backgroundColor: state.isSelected ? "#3b82f6" : state.isFocused ? "#f1f5f9" : "#fff",
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
                    {isEditing ? "Edit Purchase Return Order" : "Create Purchase Return Order"}
                  </h1>
                  <p className="text-slate-600 mt-1">
                    {isEditing ? "Update purchase return order details" : "Create a new purchase return order"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={savePO}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  <span>{isEditing ? "Update PR" : "Save PR"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-2xl p-8">
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">PR Number</label>
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
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="date"
                        name="date"
                        value={formData.date || new Date().toISOString().split("T")[0]}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3 bg-white rounded-xl border ${
                          formErrors.date ? "border-red-500" : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                      />
                      {formErrors.date && <p className="text-red-500 text-xs mt-1">{formErrors.date}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Return Date</label>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Select Vendor</label>
                  <Select
                    options={vendorOptions}
                    value={vendorOptions.find((opt) => opt.value === formData.partyId) || null}
                    onChange={handleVendorSelect}
                    placeholder="Select a vendor..."
                    isClearable
                    isSearchable
                    classNamePrefix="select"
                    className={`text-sm ${formErrors.partyId ? "border-red-500 rounded-lg" : ""}`}
                    styles={customSelectStyles}
                  />
                  {formErrors.partyId && <p className="text-red-500 text-xs mt-1">{formErrors.partyId}</p>}
                </div>

                {formData.partyId && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Select Purchase Order</label>
                    <Select
                      options={poOptions}
                      value={poOptions.find((opt) => opt.value === selectedPOId) || null}
                      onChange={handlePOSelect}
                      placeholder="Select a purchase order..."
                      isClearable
                      isSearchable
                      classNamePrefix="select"
                      className="text-sm"
                      styles={customSelectStyles}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Vendor Reference</label>
                  <input
                    type="text"
                    name="vendorReference"
                    value={formData.vendorReference || ""}
                    onChange={handleInputChange}
                    placeholder="Enter vendor reference"
                    className={`w-full px-4 py-3 bg-white rounded-xl border ${
                      formErrors.vendorReference ? "border-red-500" : "border-slate-200"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`}
                  />
                  {formErrors.vendorReference && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.vendorReference}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes || ""}
                    onChange={handleInputChange}
                    placeholder="Additional notes or special instructions"
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
                  />
                </div>
              </div>

              {/* <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Vendor Preview</h3>
                {formData.partyId && formData.vendorDetails ? (
                  <div className="text-sm text-slate-700 space-y-2">
                    <p className="font-semibold text-blue-600">{formData.vendorDetails.vendorId || "N/A"}</p>
                    <p className="font-bold text-slate-800">{formData.vendorDetails.vendorName || "N/A"}</p>
                    <p>{formData.vendorDetails.address || "N/A"}</p>
                    <p className="flex items-center space-x-1">
                      <User className="w-3 h-3" />
                      <span>{formData.vendorDetails.phone || "N/A"}</span>
                    </p>
                    <p>{formData.vendorDetails.email || "N/A"}</p>
                    <p>VAT: {formData.vendorDetails.vatNumber || "N/A"}</p>
                    <p>Terms: {formData.vendorDetails.paymentTerms || "N/A"}</p>
                    <p>Reference: {formData.vendorReference || "N/A"}</p>
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Select a vendor to see details</p>
                )}

                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-3">Return Order Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Items:</span>
                      <span>{formData.items.filter((item) => item.itemId).length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>AED {totals.subtotal || "0.00"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>VAT:</span>
                      <span>AED {totals.vat || "0.00"}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span className="text-emerald-600">AED {totals.total || "0.00"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div> */}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-slate-800 flex items-center">
                  <Package className="w-6 h-6 mr-2 text-blue-600" />
                  Return Items
                </h3>
                <button
                  onClick={addItem}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Item</span>
                </button>
              </div>

              {formErrors.items && <p className="text-red-500 text-sm mb-4">{formErrors.items}</p>}

              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div
                    key={`item-${index}`}
                    className="grid grid-cols-7 gap-4 items-center p-4 bg-slate-50 rounded-xl border border-slate-200 relative"
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
                        className={`text-sm ${formErrors[`itemId_${index}`] ? "border-red-500 rounded-lg" : ""}`}
                      />
                      {formErrors[`itemId_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">{formErrors[`itemId_${index}`]}</p>
                      )}
                    </div>

                    <div className="col-span-1">
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
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                      <input
                        type="text"
                        value={item.brand || ""}
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Origin</label>
                      <input
                        type="text"
                        value={item.origin || ""}
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
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
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Price</label>
                      <input
                        type="number"
                        value={item.purchasePrice || ""}
                        readOnly
                        className="w-full px-4 py-3 bg-slate-100 rounded-lg border border-slate-200 text-sm cursor-not-allowed"
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Current Purchase Price</label>
                      <input
                        type="number"
                        value={item.currentPurchasePrice || ""}
                        onChange={(e) => handleItemChange(index, "currentPurchasePrice", e.target.value)}
                        placeholder="Price"
                        min="0"
                        step="0.01"
                        className={`w-full px-4 py-3 bg-white rounded-lg border ${
                          formErrors[`currentPurchasePrice_${index}`] ? "border-red-500" : "border-slate-200"
                        } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm`}
                      />
                      {formErrors[`currentPurchasePrice_${index}`] && (
                        <p className="text-red-500 text-xs mt-1">{formErrors[`currentPurchasePrice_${index}`]}</p>
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
      prevProps.vendors === nextProps.vendors &&
      prevProps.stockItems === nextProps.stockItems &&
      prevProps.addNotification === nextProps.addNotification &&
      prevProps.selectedPO === nextProps.selectedPO &&
      prevProps.setSelectedPO === nextProps.setSelectedPO &&
      prevProps.setActiveView === nextProps.setActiveView &&
      prevProps.setPurchaseOrders === nextProps.setPurchaseOrders &&
      prevProps.activeView === nextProps.activeView &&
      prevProps.resetForm === nextProps.resetForm &&
      prevProps.calculateTotals === nextProps.calculateTotals &&
      prevProps.onPOSuccess === nextProps.onPOSuccess
    );
  }
);

export default POForm;