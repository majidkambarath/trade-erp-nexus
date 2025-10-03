import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  X,
  User,
  TrendingUp,
  Calendar,
  DollarSign,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Receipt,
  Loader2,
} from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../axios/axios";
import VendorSelect from "./VendorSelect";

const FormInput = ({ label, icon: Icon, error, readOnly, ...props }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      <Icon size={16} className="inline mr-2" /> {label} {props.required && "*"}
    </label>
    <input
      {...props}
      readOnly={readOnly}
      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
        error ? "border-red-300 bg-red-50" : readOnly ? "bg-gray-50 text-gray-500" : "border-gray-300"
      }`}
    />
    {error && (
      <p className="mt-1 text-sm text-red-600 flex items-center">
        <AlertCircle size={12} className="mr-1" /> {error}
      </p>
    )}
  </div>
);

const Toast = ({ show, message, type }) =>
  show && (
    <div
      className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg text-white z-50 ${
        type === "success" ? "bg-emerald-500" : "bg-red-500"
      }`}
    >
      <div className="flex items-center space-x-2">
        {type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
        <span>{message}</span>
      </div>
    </div>
  );

const StatCard = ({
  title,
  count,
  icon,
  bgColor,
  textColor,
  borderColor,
  iconBg,
  iconColor,
  subText,
}) => (
  <div
    className={`${bgColor} ${borderColor} rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-105`}
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 ${iconBg} rounded-xl`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <button
        className={`text-xs ${textColor} hover:opacity-80 transition-opacity font-medium`}
      >
        View Details →
      </button>
    </div>
    <h3 className={`text-sm font-medium ${textColor} mb-2`}>{title}</h3>
    <p className="text-3xl font-bold text-gray-900">{count}</p>
    <p className="text-xs text-gray-500 mt-1">{subText}</p>
  </div>
);

const asArray = (x) => (Array.isArray(x) ? x : []);

const takeArray = (resp) => {
  if (!resp) return [];
  const d = resp.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data.data ?? d.data;
  if (Array.isArray(d?.vouchers)) return d.vouchers;
  return [];
};

const formatCurrency = (amount, colorClass = "text-gray-900") => {
  const numAmount = Number(amount) || 0;
  const absAmount = Math.abs(numAmount).toFixed(2);
  const isNegative = numAmount < 0;
  return (
    <span className={`inline-flex items-center ${colorClass}`}>
      {isNegative && "-"}<span className="mr-1">AED</span>{absAmount}
    </span>
  );
};

const badgeClassForStatus = (status) => {
  const badges = {
    Paid: "bg-emerald-100 text-emerald-800",
    Unpaid: "bg-red-100 text-red-800",
    "Partially Paid": "bg-yellow-100 text-yellow-800",
  };
  return badges[status] || "bg-gray-100 text-gray-800";
};

const PurchaseAccountsManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    vendorId: "",
    invoiceNumber: "",
    date: new Date().toISOString().slice(0, 10),
    purchaseAmount: "",
    taxAmount: "",
    returnAmount: "",
    total: "",
    paidAmount: "",
    balanceAmount: "",
    status: "Unpaid",
  });
  const [availableVouchers, setAvailableVouchers] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [activeTab, setActiveTab] = useState("invoices");
  const formRef = useRef(null);

  useEffect(() => {
    fetchVendors();
    fetchInvoices();
    fetchVouchers();
  }, []);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      2800
    );
  }, []);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/vendors/vendors");
      setVendors(takeArray(response));
    } catch (err) {
      showToastMessage("Failed to fetch vendors.", "error");
      setVendors([]);
    }
  }, [showToastMessage]);

  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append("partyType", "Vendor");
      params.append("type", "purchase_order");
      params.append("status", "APPROVED");
      const response = await axiosInstance.get(
        `/transactions/transactions?${params.toString()}`
      );
      setInvoices(takeArray(response));
    } catch (err) {
      showToastMessage("Failed to fetch invoices.", "error");
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToastMessage]);

  const fetchVouchers = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/vouchers/vouchers", {
        params: { voucherType: "payment" },
      });
      setVouchers(takeArray(response));
    } catch (err) {
      showToastMessage("Failed to fetch payment vouchers.", "error");
      setVouchers([]);
    }
  }, [showToastMessage]);

  const fetchAvailableVouchers = useCallback(
    async (vendorId = null) => {
      try {
        const params = new URLSearchParams();
        if (vendorId) params.append("partyId", vendorId);
        params.append("voucherType", "payment");
        const response = await axiosInstance.get(
          `/vouchers/vouchers?${params.toString()}`
        );
        const available = takeArray(response).filter(
          (v) => v._id && v.voucherNo && v.totalAmount
        );
        setAvailableVouchers(available);
      } catch (err) {
        showToastMessage("Failed to fetch available vouchers.", "error");
        setAvailableVouchers([]);
      }
    },
    [showToastMessage]
  );

  const handleVendorChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        invoiceNumber: "",
        date: new Date().toISOString().slice(0, 10),
        purchaseAmount: "",
        taxAmount: "",
        returnAmount: "",
        total: "",
        paidAmount: "",
        balanceAmount: "",
        status: "Unpaid",
      }));
      setErrors((prev) => ({ ...prev, [name]: "" }));
      if (name === "vendorId") {
        fetchAvailableVouchers(value);
      }
    },
    [fetchAvailableVouchers]
  );

  const handleInvoiceSelect = useCallback(
    (selectedInvoices) => {
      if (selectedInvoices && selectedInvoices.length > 0) {
        // Compute per-invoice net and tax, then aggregate
        let aggregateNet = 0;
        let aggregateTax = 0;
        let aggregateGross = 0;

        selectedInvoices.forEach((invoice) => {
          const invoiceTotal = Number(invoice.totalAmount) || 0;
          const invoiceTaxPercent = Number(invoice.taxPercent) || 5;
          const net = invoiceTotal / (1 + invoiceTaxPercent / 100);
          const tax = invoiceTotal - net;
          aggregateNet += net;
          aggregateTax += tax;
          aggregateGross += invoiceTotal;
        });

        // Aggregate paid across ALL vouchers for these invoices
        let paidAmount = 0;
        selectedInvoices.forEach((invoice) => {
          const invoiceId = invoice._id;
          asArray(vouchers).forEach((voucher) => {
            asArray(voucher.linkedInvoices).forEach((link) => {
              const linkInvoiceId = link.invoiceId?._id || link.invoiceId;
              if (linkInvoiceId === invoiceId) {
                paidAmount += Number(link.amount) || 0;
              }
            });
          });
        });

        const returnAmountNum = Number(formData.returnAmount) || 0;
        const totalAfterReturn = Math.max(aggregateGross - returnAmountNum, 0);
        const balanceAmount = Math.max(totalAfterReturn - paidAmount, 0);

        const status =
          balanceAmount <= 0 ? "Paid" : paidAmount === 0 ? "Unpaid" : "Partially Paid";

        setFormData((prev) => ({
          ...prev,
          invoiceNumber: selectedInvoices.map((inv) => inv.transactionNo).join(", "),
          purchaseAmount: aggregateNet ? aggregateNet.toFixed(2) : "",
          taxAmount: aggregateTax ? aggregateTax.toFixed(2) : "",
          total: totalAfterReturn ? totalAfterReturn.toFixed(2) : "",
          paidAmount: paidAmount ? paidAmount.toFixed(2) : "",
          balanceAmount: balanceAmount ? balanceAmount.toFixed(2) : "",
          status,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          invoiceNumber: "",
          purchaseAmount: "",
          taxAmount: "",
          total: "",
          paidAmount: "",
          balanceAmount: "",
          status: "Unpaid",
        }));
      }
    },
    [vouchers, formData.returnAmount]
  );

  const validateForm = useCallback(() => {
    const e = {};
    if (!formData.vendorId) e.vendorId = "Vendor is required";
    return e;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData({
      vendorId: "",
      invoiceNumber: "",
      date: new Date().toISOString().slice(0, 10),
      purchaseAmount: "",
      taxAmount: "",
      returnAmount: "",
      total: "",
      paidAmount: "",
      balanceAmount: "",
      status: "Unpaid",
    });
    setErrors({});
    setShowModal(false);
    setAvailableVouchers([]);
    if (formRef.current) formRef.current.querySelector('input[name="vendorId"]')?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const e = validateForm();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        partyId: formData.vendorId,
        partyType: "Vendor",
        type: "purchase_order",
        date: formData.date,
        transactionNo: formData.invoiceNumber,
        totalAmount: Number(formData.total),
        returnAmount: Number(formData.returnAmount) || 0,
        status: formData.status,
      };
      await axiosInstance.post("/transactions/transactions", payload);
      showToastMessage("Purchase invoice created successfully!", "success");
      fetchInvoices();
      resetForm();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to create purchase invoice.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, fetchInvoices, resetForm, showToastMessage, validateForm]);

  const openAddModal = useCallback(() => {
    setShowModal(true);
    setTimeout(() => {
      const modal = document.querySelector(".modal-container");
      if (modal) modal.classList.add("scale-100");
      if (formRef.current) formRef.current.querySelector('input[name="vendorId"]')?.focus();
    }, 10);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.all([fetchInvoices(), fetchVouchers()]).finally(() => {
      setIsRefreshing(false);
      showToastMessage("Data refreshed", "success");
    });
  }, [fetchInvoices, fetchVouchers, showToastMessage]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => {
        const next = { ...prev, [name]: value };
        if (name === "returnAmount") {
          // Recompute totals when return amount changes
          const currentTotalGross = Number(prev.purchaseAmount || 0) + Number(prev.taxAmount || 0);
          const returnAmountNum = Number(value) || 0;
          const totalAfterReturn = Math.max(currentTotalGross - returnAmountNum, 0);
          const paid = Number(prev.paidAmount) || 0;
          const balance = Math.max(totalAfterReturn - paid, 0);
          const status = balance <= 0 ? "Paid" : paid === 0 ? "Unpaid" : "Partially Paid";
          next.total = totalAfterReturn ? totalAfterReturn.toFixed(2) : "";
          next.balanceAmount = balance ? balance.toFixed(2) : "";
          next.status = status;
        }
        return next;
      });
      setErrors((prev) => ({ ...prev, [name]: "" }));
    },
    []
  );

  const filteredInvoices = useMemo(() => {
    let filtered = asArray(invoices).filter((inv) => {
      if (selectedVendor && inv.partyId !== selectedVendor.value) return false;
      const term = searchTerm.toLowerCase();
      return inv.transactionNo?.toLowerCase().includes(term);
    });

    filtered = filtered.map((inv) => {
      const linkedPayments = asArray(vouchers).reduce((acc, voucher) => {
        if (voucher.partyId?._id !== inv.partyId) return acc;
        const link = asArray(voucher.linkedInvoices).find(
          (l) => (l.invoiceId?._id || l.invoiceId) === inv._id
        );
        if (link) acc += Number(link.amount) || 0;
        return acc;
      }, 0);

      const purchaseAmount = Number(inv.totalAmount) / (1 + (inv.items?.[0]?.taxPercent || 5) / 100);
      const taxAmount = Number(inv.totalAmount) - purchaseAmount;
      const total = purchaseAmount + taxAmount;
      const paidAmount = linkedPayments;
      const balanceAmount = total - paidAmount;
      const status =
        balanceAmount <= 0 ? "Paid" : paidAmount === 0 ? "Unpaid" : "Partially Paid";
      const vendor = vendors.find((v) => v._id === inv.partyId);

      return {
        ...inv,
        vendorName: vendor?.vendorName || "",
        purchaseAmount,
        taxAmount,
        total,
        paidAmount,
        balanceAmount,
        status,
      };
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const av =
          sortConfig.key === "date"
            ? new Date(a.date).getTime()
            : sortConfig.key === "vendorName"
            ? a[sortConfig.key].toLowerCase()
            : a[sortConfig.key];
        const bv =
          sortConfig.key === "date"
            ? new Date(b.date).getTime()
            : sortConfig.key === "vendorName"
            ? b[sortConfig.key].toLowerCase()
            : b[sortConfig.key];
        return av < bv
          ? sortConfig.direction === "asc"
            ? -1
            : 1
          : av > bv
          ? sortConfig.direction === "asc"
            ? 1
            : -1
          : 0;
      });
    }

    return filtered;
  }, [invoices, vouchers, selectedVendor, searchTerm, sortConfig, vendors]);

  const filteredVouchers = useMemo(() => {
    let filtered = asArray(vouchers).filter((voucher) => {
      if (selectedVendor && voucher.partyId?._id !== selectedVendor.value) return false;
      const term = searchTerm.toLowerCase();
      return voucher.voucherNo?.toLowerCase().includes(term);
    });

    filtered = filtered.map((voucher) => {
      const linkedInvoices = asArray(voucher.linkedInvoices).map((link) => {
        const invoice = invoices.find(
          (inv) => (inv._id === link.invoiceId?._id || inv._id === link.invoiceId)
        );
        const purchaseAmount = invoice
          ? Number(invoice.totalAmount) / (1 + (invoice.items?.[0]?.taxPercent || 5) / 100)
          : 0;
        const taxAmount = invoice ? Number(invoice.totalAmount) - purchaseAmount : 0;
        const total = invoice ? Number(invoice.totalAmount) : 0;
        return {
          ...link,
          invoiceNo: invoice?.transactionNo || "Unknown",
          purchaseAmount,
          taxAmount,
          total,
          paidAmount: Number(link.amount) || 0,
          balanceAmount: Number(link.balance) || 0,
          status:
            Number(link.balance) <= 0
              ? "Paid"
              : Number(link.amount) === 0
              ? "Unpaid"
              : "Partially Paid",
        };
      });

      return {
        ...voucher,
        vendorName: voucher.partyName || "",
        linkedInvoices,
      };
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const av =
          sortConfig.key === "date"
            ? new Date(a.date).getTime()
            : sortConfig.key === "vendorName"
            ? a[sortConfig.key].toLowerCase()
            : a[sortConfig.key];
        const bv =
          sortConfig.key === "date"
            ? new Date(b.date).getTime()
            : sortConfig.key === "vendorName"
            ? b[sortConfig.key].toLowerCase()
            : b[sortConfig.key];
        return av < bv
          ? sortConfig.direction === "asc"
            ? -1
            : 1
          : av > bv
          ? sortConfig.direction === "asc"
            ? 1
            : -1
          : 0;
      });
    }

    return filtered;
  }, [vouchers, invoices, selectedVendor, searchTerm, sortConfig]);

  const stats = useMemo(() => {
    const totalInvoices = filteredInvoices.length;
    const totalVouchers = filteredVouchers.length;
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const paidAmount = filteredInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
    const balanceAmount = filteredInvoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);
    return { totalInvoices, totalVouchers, totalAmount, paidAmount, balanceAmount };
  }, [filteredInvoices, filteredVouchers]);

  const vendorOptions = useMemo(
    () => [
      { value: "", label: "All Vendors" },
      ...vendors.map((v) => ({ value: v._id, label: v.vendorName })),
    ],
    [vendors]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="text-purple-600 animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg">Loading purchase accounts...</p>
        </div>
      </div>
    );
  }

  const EmptyState = ({ type }) => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Receipt size={40} className="text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No {type} found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm
          ? `No ${type} match your search.`
          : `No ${type} available for the selected vendor.`}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      <Toast
        show={showToast.visible}
        message={showToast.message}
        type={showToast.type}
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black">Purchase Accounts</h1>
            <p className="text-gray-600 mt-1">
              {activeTab === "invoices"
                ? `${stats.totalInvoices} total invoices`
                : `${stats.totalVouchers} total vouchers`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          {activeTab === "invoices" && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} /> Add Purchase
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw
              size={16}
              className={`text-gray-600 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
              showFilters
                ? "bg-purple-100 text-purple-600"
                : "bg-white text-gray-600"
            }`}
            title="Toggle filters"
          >
            <Filter size={16} />
          </button>
        </div>
      </div>
      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Records"
            count={activeTab === "invoices" ? stats.totalInvoices : stats.totalVouchers}
            icon={<Receipt size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText={activeTab === "invoices" ? "All invoices" : "All vouchers"}
          />
          <StatCard
            title="Total Amount"
            count={formatCurrency(stats.totalAmount, "text-purple-700")}
            icon={<TrendingUp size={24} />}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
            borderColor="border-purple-200"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            subText="Total purchase value"
          />
          <StatCard
            title="Paid Amount"
            count={formatCurrency(stats.paidAmount, "text-blue-700")}
            icon={<DollarSign size={24} />}
            bgColor="bg-blue-50"
            textColor="text-blue-700"
            borderColor="border-blue-200"
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            subText="Total paid"
          />
          <StatCard
            title="Balance Amount"
            count={formatCurrency(stats.balanceAmount, "text-red-700")}
            icon={<DollarSign size={24} />}
            bgColor="bg-red-50"
            textColor="text-red-700"
            borderColor="border-red-200"
            iconBg="bg-red-100"
            iconColor="text-red-600"
            subText="Outstanding balance"
          />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {activeTab === "invoices" ? "Purchase Invoices" : "Payment Vouchers"}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {activeTab === "invoices"
                  ? "View purchase invoices and payment status"
                  : "View payment vouchers linked to invoices"}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab("invoices")}
                className={`px-4 py-2 rounded-lg font-medium ${
                  activeTab === "invoices"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                } transition-all duration-200`}
              >
                Invoices
              </button>
              <button
                onClick={() => setActiveTab("vouchers")}
                className={`px-4 py-2 rounded-lg font-medium ${
                  activeTab === "vouchers"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                } transition-all duration-200`}
              >
                Vouchers
              </button>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder={`Search by ${
                  activeTab === "invoices" ? "invoice" : "voucher"
                } number...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-full">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <User size={16} className="inline mr-2" /> Vendor Name
                  </label>
                  <Select
                    value={selectedVendor}
                    onChange={(selectedOption) => setSelectedVendor(selectedOption)}
                    options={vendorOptions}
                    isSearchable={true}
                    placeholder="Search and select vendor..."
                    classNamePrefix="react-select"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        {activeTab === "invoices" && filteredInvoices.length === 0 ? (
          <EmptyState type="invoices" />
        ) : activeTab === "vouchers" && filteredVouchers.length === 0 ? (
          <EmptyState type="vouchers" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "vendorName", label: "Vendor Name" },
                    { key: activeTab === "invoices" ? "transactionNo" : "voucherNo", label: activeTab === "invoices" ? "Invoice Number" : "Voucher Number" },
                    { key: "date", label: "Date" },
                    { key: "purchaseAmount", label: "Purchase Amount" },
                    { key: "taxAmount", label: "Tax Amount" },
                    { key: "total", label: "Total" },
                    { key: "paidAmount", label: "Paid Amount" },
                    { key: "balanceAmount", label: "Balance Amount" },
                    { key: "status", label: "Status" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{col.label}</span>
                        {sortConfig.key === col.key && (
                          <span className="text-purple-600">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeTab === "invoices"
                  ? filteredInvoices.map((inv) => (
                      <tr
                        key={inv._id}
                        className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                      >
                        <td className="px-6 py-4 text-sm text-gray-900">{inv.vendorName}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.transactionNo}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(inv.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.purchaseAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.taxAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.total)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.paidAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.balanceAmount)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${badgeClassForStatus(
                              inv.status
                            )}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  : filteredVouchers.map((voucher) =>
                      voucher.linkedInvoices.map((link) => (
                        <tr
                          key={`${voucher._id}-${link.invoiceId?._id || link.invoiceId}`}
                          className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                        >
                          <td className="px-6 py-4 text-sm text-gray-900">{voucher.vendorName}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {voucher.voucherNo} (Inv: {link.invoiceNo})
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(voucher.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.purchaseAmount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.taxAmount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.total)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.paidAmount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.balanceAmount)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${badgeClassForStatus(
                                link.status
                              )}`}
                            >
                              {link.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Add Purchase Invoice
                </h3>
                <p className="text-gray-600 text-sm">
                  Create a new purchase invoice
                </p>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
              >
                <X size={22} />
              </button>
            </div>
            <div className="p-6" ref={formRef}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <VendorSelect
                  vendors={vendors}
                  value={formData.vendorId}
                  onChange={handleVendorChange}
                  onInvoiceSelect={handleInvoiceSelect}
                />
                <FormInput
                  label="Date"
                  icon={Calendar}
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
                <FormInput
                  label="Invoice Number"
                  icon={Receipt}
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleChange}
                  readOnly
                  required
                />
                <FormInput
                  label="Purchase Amount"
                  icon={DollarSign}
                  type="number"
                  name="purchaseAmount"
                  value={formData.purchaseAmount}
                  onChange={handleChange}
                  readOnly
                  required
                />
                <FormInput
                  label="Tax Amount"
                  icon={DollarSign}
                  type="number"
                  name="taxAmount"
                  value={formData.taxAmount}
                  onChange={handleChange}
                  readOnly
                />
                <FormInput
                  label="Total (Net Amount + Tax)"
                  icon={DollarSign}
                  type="number"
                  value={formData.total}
                  readOnly
                  className="bg-gray-50 text-gray-500"
                />
                <FormInput
                  label="Return Amount"
                  icon={DollarSign}
                  type="number"
                  name="returnAmount"
                  value={formData.returnAmount}
                  onChange={handleChange}
                  min="0"
                />
                <FormInput
                  label="Paid Amount"
                  icon={DollarSign}
                  type="number"
                  name="paidAmount"
                  value={formData.paidAmount}
                  readOnly
                  className="bg-gray-50 text-gray-500"
                />
                <FormInput
                  label="Balance Amount"
                  icon={DollarSign}
                  type="number"
                  name="balanceAmount"
                  value={formData.balanceAmount}
                  readOnly
                  className="bg-gray-50 text-gray-500"
                />
                <FormInput
                  label="Status"
                  icon={AlertCircle}
                  name="status"
                  value={formData.status}
                  readOnly
                  className="bg-gray-50 text-gray-500"
                />
              </div>
              <div className="flex justify-end space-x-3 mt-8">
                <button
                  onClick={resetForm}
                  disabled={isSubmitting}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" /> Save Purchase
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseAccountsManagement;