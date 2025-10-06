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
  Package,
  Sparkles,
  CreditCard,
  FileText,
} from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../../axios/axios";
import CustomerSelect from "./CustomerSelect";

const FormInput = ({ label, icon: Icon, error, readOnly, hint, ...props }) => (
  <div className="group relative">
    <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
      <Icon size={16} className="inline mr-2 text-purple-500" /> {label}{" "}
      {props.required && <span className="text-red-500">*</span>}
    </label>
    <input
      {...props}
      readOnly={readOnly}
      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all duration-200 ${
        error
          ? "border-red-300 bg-red-50 focus:ring-red-500"
          : readOnly
          ? "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 cursor-not-allowed"
          : "border-gray-300 hover:border-gray-400"
      }`}
    />
    {hint && !error && (
      <p className="mt-1 text-xs text-gray-500 flex items-center">
        <Sparkles size={10} className="mr-1" /> {hint}
      </p>
    )}
    {error && (
      <p className="mt-1 text-sm text-red-600 flex items-center animate-shake">
        <AlertCircle size={12} className="mr-1" /> {error}
      </p>
    )}
  </div>
);

const Toast = ({ show, message, type }) =>
  show && (
    <div
      className={`fixed top-4 right-4 p-4 rounded-xl shadow-2xl text-white z-50 animate-slide-in ${
        type === "success"
          ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
          : "bg-gradient-to-r from-red-500 to-red-600"
      }`}
    >
      <div className="flex items-center space-x-3">
        {type === "success" ? (
          <CheckCircle size={20} className="animate-bounce" />
        ) : (
          <XCircle size={20} className="animate-pulse" />
        )}
        <span className="font-medium">{message}</span>
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
    className={`${bgColor} ${borderColor} rounded-2xl p-6 border-2 transition-all duration-300 hover:shadow-xl cursor-pointer hover:scale-105 hover:-translate-y-1`}
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 ${iconBg} rounded-xl shadow-md`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <button className={`text-xs ${textColor} hover:opacity-80 transition-opacity font-semibold`}>
        View Details →
      </button>
    </div>
    <h3 className={`text-sm font-semibold ${textColor} mb-2 uppercase tracking-wide`}>
      {title}
    </h3>
    <p className="text-3xl font-bold text-gray-900 mb-1">{count}</p>
    <p className="text-xs text-gray-600 font-medium">{subText}</p>
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
    <span className={`inline-flex items-center font-semibold ${colorClass}`}>
      {isNegative && <span className="text-red-600">-</span>}
      <span className="text-xs mr-1 opacity-70">AED</span>
      {absAmount.toLocaleString()}
    </span>
  );
};

const badgeClassForStatus = (status) => {
  const badges = {
    Paid: "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border border-emerald-300",
    Unpaid: "bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-300",
    "Partially Paid": "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300",
  };
  return badges[status] || "bg-gray-100 text-gray-800";
};

const SaleAccountsManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    customerId: "",
    invoiceNumber: "",
    date: new Date().toISOString().split("T")[0], // Set default to current date
    saleAmount: "",
    taxAmount: "",
    total: "",
    returnAmount: "",
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
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const formRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    fetchCustomers();
    fetchInvoices();
    fetchVouchers();
  }, []);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showModal]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(() => setShowToast((prev) => ({ ...prev, visible: false })), 3000);
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/customers/customers");
      setCustomers(takeArray(response));
    } catch (err) {
      showToastMessage("Failed to fetch customers.", "error");
      setCustomers([]);
    }
  }, [showToastMessage]);

  const fetchInvoices = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append("partyType", "Customer");
      params.append("type", "sale_order");
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
        params: { voucherType: "receipt" },
      });
      setVouchers(takeArray(response));
    } catch (err) {
      showToastMessage("Failed to fetch receipts.", "error");
      setVouchers([]);
    }
  }, [showToastMessage]);

  const fetchAvailableVouchers = useCallback(
    async (customerId = null) => {
      try {
        const params = new URLSearchParams();
        if (customerId) params.append("partyId", customerId);
        params.append("voucherType", "receipt");
        const response = await axiosInstance.get(
          `/vouchers/vouchers?${params.toString()}`
        );
        const available = takeArray(response).filter(
          (v) => v._id && v.voucherNo && v.totalAmount
        );
        setAvailableVouchers(available);
      } catch (err) {
        showToastMessage("Failed to fetch available receipts.", "error");
        setAvailableVouchers([]);
      }
    },
    [showToastMessage]
  );

  const handleCustomerChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        invoiceNumber: "",
        date: new Date().toISOString().split("T")[0], // Reset to current date
        saleAmount: "",
        taxAmount: "",
        total: "",
        returnAmount: "",
        paidAmount: "",
        balanceAmount: "",
        status: "Unpaid",
      }));
      setErrors({});
      setSelectedInvoices([]);
      if (name === "customerId") {
        fetchAvailableVouchers(value);
      }
    },
    [fetchAvailableVouchers]
  );

  const handleInvoiceSelect = useCallback(
    (selectedInvoicesData, autoFillData = {}) => {
      setSelectedInvoices(selectedInvoicesData);
      if (selectedInvoicesData && selectedInvoicesData.length > 0) {
        const totalSaleAmount = selectedInvoicesData.reduce((sum, inv) => {
          const itemTotal = inv.items.reduce(
            (itemSum, item) => itemSum + (Number(item.lineTotal) || 0),
            0
          );
          return sum + itemTotal;
        }, 0);

        const taxAmount = selectedInvoicesData.reduce((sum, inv) => {
          const itemTaxPercent =
            inv.items.length > 0 ? inv.items[0].taxPercent || 5 : 5;
          const itemTotal = inv.items.reduce(
            (itemSum, item) => itemSum + (Number(item.lineTotal) || 0),
            0
          );
          return sum + (itemTotal - itemTotal / (1 + itemTaxPercent / 100));
        }, 0);

        const totalAmount = totalSaleAmount;

        const paidAmount = selectedInvoicesData.reduce((sum, inv) => {
          const linkedVoucher = vouchers.find((voucher) =>
            voucher.linkedInvoices?.some(
              (link) => (link.invoiceId?._id || link.invoiceId) === inv._id
            )
          );
          if (linkedVoucher) {
            const linkedInvoice = linkedVoucher.linkedInvoices.find(
              (link) => (link.invoiceId?._id || link.invoiceId) === inv._id
            );
            return sum + (Number(linkedInvoice?.amount) || 0);
          }
          return sum;
        }, 0);

        const balanceAmount = totalAmount - paidAmount;
        const status =
          balanceAmount <= 0
            ? "Paid"
            : paidAmount === 0
            ? "Unpaid"
            : "Partially Paid";

        const date = selectedInvoicesData[0]?.date
          ? new Date(selectedInvoicesData[0].date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]; // Default to current date if no invoice date

        setFormData((prev) => ({
          ...prev,
          invoiceNumber: selectedInvoicesData
            .map((inv) => inv.transactionNo)
            .join(", "),
          date,
          saleAmount: totalSaleAmount.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          total: totalAmount.toFixed(2),
          returnAmount: "0.00",
          paidAmount: paidAmount.toFixed(2),
          balanceAmount: balanceAmount.toFixed(2),
          status,
          ...autoFillData,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          invoiceNumber: "",
          date: new Date().toISOString().split("T")[0], // Reset to current date
          saleAmount: "",
          taxAmount: "",
          total: "",
          returnAmount: "",
          paidAmount: "",
          balanceAmount: "",
          status: "Unpaid",
        }));
      }
    },
    [vouchers]
  );

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === "date") {
      const selectedDate = new Date(value);
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0); // Normalize to start of day
      if (selectedDate > currentDate) {
        setErrors((prev) => ({
          ...prev,
          date: "Future dates are not allowed",
        }));
        return;
      }
    }
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === "returnAmount") {
        const saleAmount = Number(prev.saleAmount) || 0;
        const returnAmount = Number(value) || 0;
        const total =
          saleAmount - returnAmount + (Number(prev.taxAmount) || 0);
        const balanceAmount = total - (Number(prev.paidAmount) || 0);
        const status =
          balanceAmount <= 0
            ? "Paid"
            : (Number(prev.paidAmount) || 0) === 0
            ? "Unpaid"
            : "Partially Paid";
        return {
          ...newData,
          total: total.toFixed(2),
          balanceAmount: balanceAmount.toFixed(2),
          status,
        };
      }
      return newData;
    });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const validateForm = useCallback(() => {
    const e = {};
    if (!formData.customerId) e.customerId = "Please select a customer";
    if (!formData.invoiceNumber)
      e.invoiceNumber = "Please select at least one invoice";
    if (!formData.date) e.date = "Please select a date";
    const selectedDate = new Date(formData.date);
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Normalize to start of day
    if (selectedDate > currentDate) {
      e.date = "Future dates are not allowed";
    }
    return e;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData({
      customerId: "",
      invoiceNumber: "",
      date: new Date().toISOString().split("T")[0], // Reset to current date
      saleAmount: "",
      taxAmount: "",
      total: "",
      returnAmount: "",
      paidAmount: "",
      balanceAmount: "",
      status: "Unpaid",
    });
    setErrors({});
    setShowModal(false);
    setAvailableVouchers([]);
    setSelectedInvoices([]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const e = validateForm();
    if (Object.keys(e).length) {
      setErrors(e);
      showToastMessage("Please fill all required fields", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const selectedInvoiceIds = selectedInvoices.map((invoice) => invoice._id);
      const invoiceBalances = selectedInvoices.map((inv) => {
        const itemTotal = inv.items.reduce(
          (sum, item) => sum + (Number(item.lineTotal) || 0),
          0
        );
        const taxPercent =
          inv.items.length > 0 ? inv.items[0].taxPercent || 5 : 5;
        const total = itemTotal;
        const linkedPayments = vouchers.reduce((acc, voucher) => {
          const link = voucher.linkedInvoices?.find(
            (l) => (l.invoiceId?._id || l.invoiceId) === inv._id
          );
          if (link) acc += Number(link.amount) || 0;
          return acc;
        }, 0);
        const balance = total - linkedPayments - (Number(formData.returnAmount) || 0);
        return {
          invoiceId: inv._id,
          transactionNo: inv.transactionNo,
          balanceAmount: balance.toFixed(2),
        };
      });

      const payload = {
        partyId: formData.customerId,
        partyType: "Customer",
        type: "sale_order",
        invoiceIds: selectedInvoiceIds,
        transactionNo: formData.invoiceNumber,
        date: formData.date,
        totalAmount: Number(formData.total),
        returnAmount: Number(formData.returnAmount) || 0,
        paidAmount: Number(formData.paidAmount) || 0,
        balanceAmount: Number(formData.balanceAmount) || 0,
        status: formData.status,
        invoiceBalances,
      };
      console.log(payload);
      // await axiosInstance.post("/transactions/transactions", payload);
      // showToastMessage("Sale invoice created successfully!", "success");
      // fetchInvoices();
      // resetForm();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to create sale invoice.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, fetchInvoices, resetForm, showToastMessage, validateForm, selectedInvoices, vouchers]);

  const openAddModal = useCallback(() => {
    setShowModal(true);
    setTimeout(() => {
      if (modalRef.current) {
        modalRef.current.classList.add("scale-100", "opacity-100");
      }
    }, 10);
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.all([fetchInvoices(), fetchVouchers()]).finally(() => {
      setIsRefreshing(false);
      showToastMessage("Data refreshed successfully", "success");
    });
  }, [fetchInvoices, fetchVouchers, showToastMessage]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const filteredInvoices = useMemo(() => {
    let filtered = asArray(invoices).filter((inv) => {
      if (selectedCustomer && inv.partyId !== selectedCustomer.value) return false;
      const term = searchTerm.toLowerCase();
      return inv.transactionNo?.toLowerCase().includes(term);
    });

    filtered = filtered.map((inv) => {
      const itemTotal = inv.items.reduce(
        (sum, item) => sum + (Number(item.lineTotal) || 0),
        0
      );
      const taxPercent =
        inv.items.length > 0 ? inv.items[0].taxPercent || 5 : 5;
      const saleAmount = itemTotal / (1 + taxPercent / 100);
      const taxAmount = itemTotal - saleAmount;
      const total = itemTotal;
      const linkedPayments = asArray(vouchers).reduce((acc, voucher) => {
        if (voucher.partyId?._id !== inv.partyId) return acc;
        const link = asArray(voucher.linkedInvoices).find(
          (l) => (l.invoiceId?._id || l.invoiceId) === inv._id
        );
        if (link) acc += Number(link.amount) || 0;
        return acc;
      }, 0);
      const paidAmount = linkedPayments;
      const balanceAmount = total - paidAmount;
      const status =
        balanceAmount <= 0
          ? "Paid"
          : paidAmount === 0
          ? "Unpaid"
          : "Partially Paid";
      const customer = customers.find((c) => c._id === inv.partyId);

      return {
        ...inv,
        customerName: customer?.customerName || "",
        saleAmount,
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
            : sortConfig.key === "customerName"
            ? a[sortConfig.key].toLowerCase()
            : a[sortConfig.key];
        const bv =
          sortConfig.key === "date"
            ? new Date(b.date).getTime()
            : sortConfig.key === "customerName"
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
  }, [invoices, vouchers, selectedCustomer, searchTerm, sortConfig, customers]);

  const filteredVouchers = useMemo(() => {
    let filtered = asArray(vouchers).filter((voucher) => {
      if (selectedCustomer && voucher.partyId?._id !== selectedCustomer.value)
        return false;
      const term = searchTerm.toLowerCase();
      return voucher.voucherNo?.toLowerCase().includes(term);
    });

    filtered = filtered.map((voucher) => {
      const linkedInvoices = asArray(voucher.linkedInvoices).map((link) => {
        const invoice = invoices.find(
          (inv) => inv._id === link.invoiceId?._id || inv._id === link.invoiceId
        );
        const itemTotal =
          invoice?.items.reduce(
            (sum, item) => sum + (Number(item.lineTotal) || 0),
            0
          ) || 0;
        const taxPercent =
          invoice?.items.length > 0 ? invoice.items[0].taxPercent || 5 : 5;
        const saleAmount = itemTotal / (1 + taxPercent / 100);
        const taxAmount = itemTotal - saleAmount;
        const total = itemTotal;
        return {
          ...link,
          invoiceNo: invoice?.transactionNo || "Unknown",
          saleAmount,
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
        customerName: voucher.partyName || "",
        linkedInvoices,
      };
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const av =
          sortConfig.key === "date"
            ? new Date(a.date).getTime()
            : sortConfig.key === "customerName"
            ? a[sortConfig.key].toLowerCase()
            : a[sortConfig.key];
        const bv =
          sortConfig.key === "date"
            ? new Date(b.date).getTime()
            : sortConfig.key === "customerName"
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
  }, [vouchers, invoices, selectedCustomer, searchTerm, sortConfig]);

  const stats = useMemo(() => {
    const totalInvoices = filteredInvoices.length;
    const totalVouchers = filteredVouchers.length;
    const totalAmount = filteredInvoices.reduce(
      (sum, inv) => sum + inv.total,
      0
    );
    const paidAmount = filteredInvoices.reduce(
      (sum, inv) => sum + inv.paidAmount,
      0
    );
    const balanceAmount = filteredInvoices.reduce(
      (sum, inv) => sum + inv.balanceAmount,
      0
    );
    return {
      totalInvoices,
      totalVouchers,
      totalAmount,
      paidAmount,
      balanceAmount,
    };
  }, [filteredInvoices, filteredVouchers]);

  const customerOptions = useMemo(
    () => [
      { value: "", label: "All Customers" },
      ...customers.map((c) => ({ value: c._id, label: c.customerName })),
    ],
    [customers]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="text-purple-600 animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg font-medium">
            Loading sale accounts...
          </p>
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
          : `No ${type} available for the selected customer.`}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      <style>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        .modal-backdrop {
          backdrop-filter: blur(8px);
          animation: fadeIn 0.2s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      
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
            <h1 className="text-3xl font-bold text-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Sale Accounts
            </h1>
            <p className="text-gray-600 mt-1 font-medium">
              {activeTab === "invoices"
                ? `${stats.totalInvoices} total invoices`
                : `${stats.totalVouchers} total receipts`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          {activeTab === "invoices" && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
            >
              <Plus size={18} /> Add Sale
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 hover:scale-105"
            title="Refresh data"
          >
            <RefreshCw
              size={18}
              className={`text-gray-600 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 ${
              showFilters
                ? "bg-purple-100 text-purple-600 ring-2 ring-purple-300"
                : "bg-white text-gray-600"
            }`}
            title="Toggle filters"
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Records"
            count={
              activeTab === "invoices"
                ? stats.totalInvoices
                : stats.totalVouchers
            }
            icon={<Receipt size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText={
              activeTab === "invoices" ? "All invoices" : "All receipts"
            }
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
            subText="Total sale value"
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
                {activeTab === "invoices"
                  ? "Sale Invoices"
                  : "Receipt Vouchers"}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {activeTab === "invoices"
                  ? "View sale invoices and payment status"
                  : "View receipt vouchers linked to invoices"}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab("invoices")}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "invoices"
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Invoices
              </button>
              <button
                onClick={() => setActiveTab("vouchers")}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "vouchers"
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Receipts
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
                  activeTab === "invoices" ? "invoice" : "receipt"
                } number...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all duration-200 hover:border-gray-300"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                <div className="w-full">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <User size={16} className="inline mr-2" /> Customer Name
                  </label>
                  <Select
                    value={selectedCustomer}
                    onChange={(selectedOption) =>
                      setSelectedCustomer(selectedOption)
                    }
                    options={customerOptions}
                    isSearchable={true}
                    placeholder="Search and select customer..."
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
          <EmptyState type="receipts" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "customerName", label: "Customer Name" },
                    {
                      key:
                        activeTab === "invoices"
                          ? "transactionNo"
                          : "voucherNo",
                      label:
                        activeTab === "invoices"
                          ? "Invoice Number"
                          : "Receipt Number",
                    },
                    { key: "date", label: "Date" },
                    { key: "saleAmount", label: "Sale Amount" },
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
                          <span className="text-purple-600 font-bold">
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
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {inv.customerName}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {inv.transactionNo}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(inv.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.saleAmount)}
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
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClassForStatus(
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
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {voucher.customerName}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            {voucher.voucherNo} (Inv: {link.invoiceNo})
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(voucher.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.saleAmount)}
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
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClassForStatus(
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
        <div className="fixed inset-0 bg-black/30 modal-backdrop flex items-center justify-center p-4 z-50">
          <div
            ref={modalRef}
            className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden transform scale-95 opacity-0 transition-all duration-300"
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Package size={28} />
                  Add Sale Invoice
                </h3>
                <p className="text-purple-100 text-sm mt-1">
                  Create a new sale invoice with automatic calculations
                </p>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-white hover:bg-white/20 rounded-xl transition-all duration-200 hover:rotate-90"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]" ref={formRef}>
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-l-4 border-purple-500">
                <div className="flex items-start gap-3">
                  <Sparkles size={20} className="text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Smart Auto-Fill
                    </h4>
                    <p className="text-sm text-gray-600">
                      Select a customer and invoices to automatically calculate amounts,
                      taxes, and payment status
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <CustomerSelect
                    customers={customers}
                    value={formData.customerId}
                    onChange={handleCustomerChange}
                    onInvoiceSelect={handleInvoiceSelect}
                  />
                </div>

                <FormInput
                  label="Invoice Number"
                  icon={Receipt}
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleChange}
                  readOnly
                  required
                  error={errors.invoiceNumber}
                  hint="Auto-filled from selected invoices"
                />

                <FormInput
                  label="Date"
                  icon={Calendar}
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  error={errors.date}
                  hint="Select invoice date (cannot be future date)"
                />

                <FormInput
                  label="Sale Amount"
                  icon={DollarSign}
                  type="number"
                  name="saleAmount"
                  value={formData.saleAmount}
                  onChange={handleChange}
                  readOnly
                  required
                  hint="Calculated excluding tax"
                />

                <FormInput
                  label="Tax Amount"
                  icon={DollarSign}
                  type="number"
                  name="taxAmount"
                  value={formData.taxAmount}
                  onChange={handleChange}
                  readOnly
                  hint="VAT/Tax calculation"
                />

                <FormInput
                  label="Total Amount"
                  icon={DollarSign}
                  type="number"
                  name="total"
                  value={formData.total}
                  onChange={handleChange}
                  readOnly
                  hint="Sale + Tax - Return"
                />

                <FormInput
                  label="Return Amount"
                  icon={DollarSign}
                  type="number"
                  name="returnAmount"
                  value={formData.returnAmount}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  hint="Enter any return amount"
                />

                <FormInput
                  label="Paid Amount"
                  icon={CreditCard}
                  type="number"
                  name="paidAmount"
                  value={formData.paidAmount}
                  readOnly
                  hint="Calculated from receipts"
                />

                <FormInput
                  label="Balance Amount"
                  icon={DollarSign}
                  type="number"
                  name="balanceAmount"
                  value={formData.balanceAmount}
                  readOnly
                  hint="Remaining to be paid"
                />

                <div className="md:col-span-2">
                  <FormInput
                    label="Payment Status"
                    icon={AlertCircle}
                    name="status"
                    value={formData.status}
                    readOnly
                    hint="Auto-updated based on balance"
                  />
                </div>
              </div>

              <div className="mt-8 p-4 bg-gray-50 rounded-xl">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileText size={18} className="text-purple-600" />
                  Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Sale</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(formData.saleAmount || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Tax</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(formData.taxAmount || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total</p>
                    <p className="font-semibold text-purple-600">
                      {formatCurrency(formData.total || 0, "text-purple-600")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Balance</p>
                    <p className="font-semibold text-red-600">
                      {formatCurrency(formData.balanceAmount || 0, "text-red-600")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={resetForm}
                disabled={isSubmitting}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all duration-200 font-semibold disabled:opacity-50 hover:scale-105"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-semibold disabled:opacity-50 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 min-w-[160px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" /> Save Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaleAccountsManagement;