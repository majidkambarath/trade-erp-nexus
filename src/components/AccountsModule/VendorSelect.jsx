import React, { useState, useEffect } from "react";
import { User, Receipt } from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../axios/axios";

const VendorSelect = ({ vendors, value, onChange, onInvoiceSelect }) => {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  useEffect(() => {
    if (value) {
      // Fetch vouchers for the selected vendor to get linked invoices
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
          const uniqueInvoices = [];
          vouchers.forEach((voucher) => {
            voucher.linkedInvoices?.forEach((link) => {
              if (!uniqueInvoices.some((inv) => (inv._id || inv.invoiceId) === (link.invoiceId?._id || link.invoiceId))) {
                uniqueInvoices.push({
                  _id: link.invoiceId?._id || link.invoiceId,
                  transactionNo: link.invoiceNo || "Unknown",
                  totalAmount: link.total || 0,
                  taxPercent: link.taxPercent || 5,
                  status: link.status || "unpaid",
                });
              }
            });
          });
          setInvoices(uniqueInvoices);
        } catch (err) {
          console.error("Failed to fetch vouchers:", err);
          setInvoices([]);
        }
      };
      fetchVendorVouchers();
    } else {
      setInvoices([]);
      setSelectedInvoices([]);
      onInvoiceSelect([]);
    }
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
        <Receipt size={16} className="inline mr-2" /> Invoices *
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