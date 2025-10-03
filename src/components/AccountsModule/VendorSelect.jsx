import React, { useState, useEffect } from "react";
import { User, Receipt } from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../axios/axios";

// This component now fetches vouchers for a selected vendor and exposes
// the linked invoices to the parent for amount calculations.
const VendorSelect = ({ vendors, value, onChange, onInvoiceSelect }) => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  useEffect(() => {
    if (!value) {
      setInvoices([]);
      setSelectedInvoices([]);
      onInvoiceSelect([]);
      return;
    }

    const fetchVendorVouchers = async () => {
      try {
        const params = new URLSearchParams();
        params.append("partyId", value);
        params.append("voucherType", "payment");
        const response = await axiosInstance.get(
          `/vouchers/vouchers?${params.toString()}`
        );
        const vouchers = Array.isArray(response.data)
          ? response.data
          : response.data?.data?.data || response.data?.data || [];

        // Build a unique invoice list based on linked vouchers
        const uniqueInvoicesMap = new Map();
        vouchers.forEach((voucher) => {
          (voucher.linkedInvoices || []).forEach((link) => {
            const invoiceId = link.invoiceId?._id || link.invoiceId;
            if (!invoiceId) return;
            if (!uniqueInvoicesMap.has(invoiceId)) {
              uniqueInvoicesMap.set(invoiceId, {
                _id: invoiceId,
                transactionNo: link.invoiceNo || "Unknown",
                totalAmount: Number(link.total) || 0,
                taxPercent: Number(link.taxPercent) || 5,
                status: link.status || "unpaid",
              });
            }
          });
        });

        setInvoices(Array.from(uniqueInvoicesMap.values()));
      } catch (err) {
        console.error("Failed to fetch vouchers:", err);
        setInvoices([]);
      }
    };

    fetchVendorVouchers();
  }, [value, onInvoiceSelect]);

  const vendorOptions = vendors.map((vendor) => ({
    value: vendor._id,
    label: vendor.vendorName,
  }));

  const invoiceOptions = invoices.map((invoice) => ({
    value: invoice._id,
    label: invoice.transactionNo,
    invoice,
  }));

  const handleInvoiceChange = (selectedOptions) => {
    setSelectedInvoices(selectedOptions);
    onInvoiceSelect(selectedOptions ? selectedOptions.map((opt) => opt.invoice) : []);
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        <User size={16} className="inline mr-2" /> Vendor *
      </label>
      <Select
        value={vendorOptions.find((option) => option.value === value)}
        onChange={(option) => onChange({ target: { name: "vendorId", value: option ? option.value : "" } })}
        options={vendorOptions}
        isSearchable
        placeholder="Select vendor..."
        classNamePrefix="react-select"
      />
      <label className="block text-sm font-semibold text-gray-700 mb-2 mt-4">
        <Receipt size={16} className="inline mr-2" /> Invoices (from selected vendor's vouchers) *
      </label>
      <Select
        value={selectedInvoices}
        onChange={handleInvoiceChange}
        options={invoiceOptions}
        isMulti
        isSearchable
        placeholder="Select invoices..."
        isDisabled={!value}
        classNamePrefix="react-select"
      />
    </div>
  );
};

export default VendorSelect;