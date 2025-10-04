import React, { useState, useEffect } from "react";
import { User, Receipt, CheckCircle, Loader2, Package, AlertCircle } from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../../axios/axios";

const VendorSelect = ({ vendors, value, onChange, onInvoiceSelect }) => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [selectedVendorName, setSelectedVendorName] = useState("");
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (value) {
      fetchVendorVouchers(value);
      const vendor = vendors.find((v) => v._id === value);
      setSelectedVendorName(vendor ? vendor.vendorName : "");
    } else {
      setInvoices([]);
      setSelectedInvoices([]);
      setSelectedVendorName("");
      setError(null);
      onInvoiceSelect([]);
    }
  }, [value, vendors, onInvoiceSelect]);

  const fetchVendorVouchers = async (vendorId) => {
    if (!vendorId) {
      setError("No vendor selected.");
      setInvoices([]);
      setIsLoadingInvoices(false);
      return;
    }

    setIsLoadingInvoices(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("partyId", vendorId);
      params.append("voucherType", "payment");

      const response = await axiosInstance.get(`/vouchers/vouchers?${params.toString()}`);

      const vouchers = Array.isArray(response.data)
        ? response.data
        : response.data?.data?.data || response.data?.data || [];

      if (!vouchers.length) {
        setInvoices([]);
        setIsLoadingInvoices(false);
        return;
      }

      const uniqueInvoices = [];
      vouchers.forEach((voucher) => {
        voucher.linkedInvoices?.forEach((link) => {
          const invoiceId = link.invoiceId?._id || link.invoiceId;

          if (!uniqueInvoices.some((inv) => (inv._id || inv.invoiceId) === invoiceId)) {
            const invoiceItems = link.invoiceId?.items || [];
            const totalLineTotal = invoiceItems.reduce(
              (sum, item) => sum + (Number(item.lineTotal) || 0),
              0
            );
            const taxPercent = invoiceItems.length > 0 ? invoiceItems[0].taxPercent || 5 : 5;
            const taxAmount = totalLineTotal - totalLineTotal / (1 + taxPercent / 100);

            const invoiceDetails = {
              _id: invoiceId,
              transactionNo: link.invoiceId?.transactionNo || "Unknown",
              totalAmount: totalLineTotal,
              taxPercent: taxPercent,
              taxAmount: taxAmount.toFixed(2),
              status: link.invoiceId?.status || "unpaid",
              items: invoiceItems,
              amount: link.amount || 0,
              balance:
                (totalLineTotal - (link.amount || 0)) ||
                (link.invoiceId?.totalAmount || 0) - (link.amount || 0),
            };
            uniqueInvoices.push(invoiceDetails);
          }
        });
      });

      setInvoices(uniqueInvoices);
    } catch (err) {
      console.error("Failed to fetch vouchers:", err);
      setError("Failed to load invoices. Please try again.");
      setInvoices([]);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const vendorOptions = vendors.map((vendor) => ({
    value: vendor._id,
    label: vendor.vendorName,
  }));

  const invoiceOptions = invoices.map((invoice) => ({
    value: invoice._id,
    label: `${invoice.transactionNo} - AED ${invoice.totalAmount.toFixed(2)}`,
    invoice,
  }));

  const handleInvoiceChange = (selectedOptions) => {
    setSelectedInvoices(selectedOptions || []);
    const selectedInvoiceData = selectedOptions
      ? selectedOptions.map((opt) => opt.invoice)
      : [];

    if (selectedInvoiceData.length > 0) {
      const totalPurchaseAmount = selectedInvoiceData.reduce(
        (sum, inv) => sum + (inv.totalAmount || 0),
        0
      );

      const taxAmount = selectedInvoiceData.reduce((sum, inv) => {
        const itemTaxPercent = inv.items.length > 0 ? inv.items[0].taxPercent || 5 : 5;
        return sum + (inv.totalAmount - inv.totalAmount / (1 + itemTaxPercent / 100));
      }, 0);

      const totalAmount = totalPurchaseAmount;
      const paidAmount = selectedInvoiceData.reduce(
        (sum, inv) => sum + (inv.amount || 0),
        0
      );
      const balanceAmount = totalAmount - paidAmount;

      const status =
        balanceAmount <= 0 ? "Paid" : paidAmount === 0 ? "Unpaid" : "Partially Paid";

      onInvoiceSelect(selectedInvoiceData, {
        purchaseAmount: totalPurchaseAmount.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        total: totalAmount.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        balanceAmount: balanceAmount.toFixed(2),
        status,
      });
    } else {
      onInvoiceSelect([], {
        purchaseAmount: "0.00",
        taxAmount: "0.00",
        total: "0.00",
        paidAmount: "0.00",
        balanceAmount: "0.00",
        status: "Unpaid",
      });
    }
  };

  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      borderRadius: "0.75rem",
      padding: "0.5rem",
      borderColor: state.isFocused ? "#a855f7" : "#d1d5db",
      boxShadow: state.isFocused ? "0 0 0 3px rgba(168, 85, 247, 0.1)" : "none",
      "&:hover": {
        borderColor: "#9ca3af",
      },
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "#a855f7"
        : state.isFocused
        ? "#f3e8ff"
        : "white",
      color: state.isSelected ? "white" : "#1f2937",
      padding: "0.75rem 1rem",
      cursor: "pointer",
      "&:active": {
        backgroundColor: "#9333ea",
      },
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: "#ede9fe",
      borderRadius: "0.5rem",
      padding: "0.25rem",
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: "#7c3aed",
      fontWeight: "600",
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: "#7c3aed",
      "&:hover": {
        backgroundColor: "#c4b5fd",
        color: "#6d28d9",
      },
    }),
  };

  return (
    <div className="space-y-4">
      <div className="group">
        <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
          <User size={16} className="inline mr-2 text-purple-500" />
          Select Vendor <span className="text-red-500">*</span>
        </label>
        <Select
          value={vendorOptions.find((option) => option.value === value)}
          onChange={(option) =>
            onChange({
              target: { name: "vendorId", value: option ? option.value : "" },
            })
          }
          options={vendorOptions}
          isSearchable
          placeholder="Search and select vendor..."
          styles={customStyles}
          classNamePrefix="react-select"
          isDisabled={!vendors.length}
        />
        <p className="mt-1 text-xs text-gray-500 flex items-center">
          <CheckCircle size={10} className="mr-1" />
          {vendors.length ? "Choose the vendor for this purchase" : "No vendors available"}
        </p>
      </div>

      <div className="group relative">
        <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
          <Receipt size={16} className="inline mr-2 text-purple-500" />
          Select Invoices <span className="text-red-500">*</span>
        </label>

        {error ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-red-300 rounded-xl bg-red-50">
            <AlertCircle size={32} className="text-red-400 mb-2" />
            <p className="text-sm text-red-600 font-medium mb-1">{error}</p>
            <button
              className="text-xs text-blue-600 hover:underline"
              onClick={() => fetchVendorVouchers(value)}
            >
              Retry
            </button>
          </div>
        ) : isLoadingInvoices ? (
          <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
            <Loader2 size={24} className="text-purple-600 animate-spin mr-2" />
            <span className="text-gray-600 font-medium">Loading invoices...</span>
          </div>
        ) : !value ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gradient-to-br from-gray-50 to-blue-50">
            <Package size={32} className="text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 text-center">
              Please select a vendor first to view available invoices
            </p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50">
            <Receipt size={32} className="text-orange-400 mb-2" />
            <p className="text-sm text-gray-600 font-medium mb-1">No invoices found</p>
            <p className="text-xs text-gray-500 text-center">
              No linked invoices available for {selectedVendorName}
            </p>
          </div>
        ) : (
          <>
            <Select
              value={selectedInvoices}
              onChange={handleInvoiceChange}
              options={invoiceOptions}
              isMulti
              isSearchable
              placeholder="Select one or more invoices..."
              isDisabled={!value}
              styles={customStyles}
              classNamePrefix="react-select"
            />
            <p className="mt-1 text-xs text-gray-500 flex items-center">
              <CheckCircle size={10} className="mr-1" />
              {selectedInvoices.length > 0
                ? `${selectedInvoices.length} invoice(s) selected`
                : "Select invoices to include in this purchase"}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default VendorSelect;