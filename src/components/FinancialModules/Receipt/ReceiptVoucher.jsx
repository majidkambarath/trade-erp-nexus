import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  User,
  TrendingUp,
  Calendar,
  CreditCard,
  FileText,
  DollarSign,
  Building,
  Banknote,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Receipt,
  AlertTriangle,
  Link2,
  Loader2,
} from "lucide-react";
import axios from "../../../axios/axios";
import InvoiceSelection from "./InvoiceSelection";
import ReceiptView from "./ReceiptView";
import CustomerSelect from "./CustomerSelect";
import {
  asArray,
  takeArray,
  displayMode,
  badgeClassForMode,
  iconForMode,
  formatCurrency,
  by,
  SessionManager,
} from "./utils";

const FormInput = ({ label, icon: Icon, error, ...props }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      <Icon size={16} className="inline mr-2" /> {label} {props.required && "*"}
    </label>
    <input
      {...props}
      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
        error ? "border-red-300 bg-red-50" : "border-gray-300"
      }`}
    />
    {error && (
      <p className="mt-1 text-sm text-red-600 flex items-center">
        <AlertCircle size={12} className="mr-1" /> {error}
      </p>
    )}
  </div>
);

const FormSelect = ({ label, icon: Icon, error, options, ...props }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      <Icon size={16} className="inline mr-2" /> {label} *
    </label>
    <select
      {...props}
      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
        error ? "border-red-300 bg-red-50" : "border-gray-300"
      }`}
    >
      {options.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
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

const ReceiptVoucherManagement = () => {
  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(
    SessionManager.get("searchTerm") || ""
  );
  const [editReceiptId, setEditReceiptId] = useState(null);
  const [formData, setFormData] = useState({
    voucherNo: "",
    date: new Date().toISOString().split("T")[0],
    customerName: "",
    customerId: "",
    linkedInvoices: [],
    paymentMode: "Cash",
    amount: "",
    narration: "",
    bankDetails: { accountNumber: "", accountName: "" },
    chequeDetails: { chequeNumber: "", chequeDate: "" },
    onlineDetails: { transactionId: "", transactionDate: "" },
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [filterPaymentMode, setFilterPaymentMode] = useState(
    SessionManager.get("filters")?.paymentMode || ""
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    receiptId: null,
    voucherNo: "",
    isDeleting: false,
  });

  const formRef = useRef(null);

  useEffect(() => {
    const savedFormData = SessionManager.get("formData");
    if (savedFormData && typeof savedFormData === "object") {
      setFormData((prev) => ({ ...prev, ...savedFormData }));
    }
    fetchReceipts();
    fetchCustomers();
    fetchUnpaidInvoices();
  }, []);

  useEffect(() => {
    let timer;
    if (showModal) {
      timer = setTimeout(() => {
        SessionManager.set("formData", formData);
        SessionManager.set("lastSaveTime", new Date().toISOString());
      }, 800);
    }
    return () => clearTimeout(timer);
  }, [formData, showModal]);

  useEffect(() => {
    SessionManager.set("searchTerm", searchTerm);
    SessionManager.set("filters", { paymentMode: filterPaymentMode });
  }, [searchTerm, filterPaymentMode]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      2800
    );
  }, []);

  const fetchReceipts = useCallback(
    async (showRefreshIndicator = false) => {
      try {
        showRefreshIndicator ? setIsRefreshing(true) : setIsLoading(true);
        const response = await axios.get("/vouchers/vouchers", {
          params: { voucherType: "receipt" },
        });
        setReceipts(takeArray(response));
        if (showRefreshIndicator) showToastMessage("Data refreshed", "success");
      } catch (err) {
        showToastMessage(
          err.response?.data?.message || "Failed to fetch receipt vouchers.",
          "error"
        );
        setReceipts([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showToastMessage]
  );

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await axios.get("/customers/customers");
      setCustomers(takeArray(response));
    } catch (err) {
      showToastMessage("Failed to fetch customers.", "error");
      setCustomers([]);
    }
  }, [showToastMessage]);

  const fetchUnpaidInvoices = useCallback(
    async (customerId = null) => {
      try {
        const params = new URLSearchParams();
        if (customerId) params.append("partyId", customerId);
        params.append("partyType", "Customer");
        params.append("type", "sales_order");
        params.append("status", "APPROVED");
        const response = await axios.get(
          `/transactions/transactions?${params.toString()}`
        );
        console.log("object")
        console.log(response.data)
        const invoices = takeArray(response)
        setAvailableInvoices(invoices);
      } catch (err) {
        showToastMessage("Failed to fetch available invoices.", "error");
        setAvailableInvoices([]);
      }
    },
    [showToastMessage]
  );

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      const [section, field] = name.includes(".")
        ? name.split(".")
        : [name, null];
      setFormData((prev) => ({
        ...prev,
        [field ? section : name]: field
          ? { ...prev[section], [field]: value }
          : value,
      }));
      setErrors((prev) => ({ ...prev, [section]: "" }));
      if (name === "customerId") {
        const selected = customers.find((c) => c._id === value);
        setFormData((prev) => ({
          ...prev,
          customerName: selected?.customerName || "",
          linkedInvoices: [],
          amount: "",
        }));
        fetchUnpaidInvoices(value);
      }
    },
    [customers, fetchUnpaidInvoices]
  );

  const handleInvoiceSelection = useCallback((invoiceId, totalAmount) => {
    setFormData((prev) => {
      const list = asArray(prev.linkedInvoices);
      const isSelected = list.some((inv) => inv.invoiceId === invoiceId);
      const newList = isSelected
        ? list.filter((inv) => inv.invoiceId !== invoiceId)
        : [
            ...list,
            { invoiceId, amount: String(totalAmount), balance: String(0) },
          ];
      const total = newList.reduce(
        (sum, inv) => sum + (Number(inv.amount) || 0),
        0
      );
      return { ...prev, linkedInvoices: newList, amount: String(total) };
    });
  }, []);

  const handleInvoiceAmountChange = useCallback(
    (invoiceId, value) => {
      setFormData((prev) => {
        const list = asArray(prev.linkedInvoices);
        const invoice = availableInvoices.find((inv) => inv._id === invoiceId);
        const totalAmount = Number(invoice?.totalAmount) || 0;
        const amount = Math.min(Number(value) || 0, totalAmount);
        const balance = totalAmount - amount;
        const newList = list.map((inv) =>
          inv.invoiceId === invoiceId
            ? {
                ...inv,
                amount: String(amount),
                balance: String(balance >= 0 ? balance : 0),
              }
            : inv
        );
        const total = newList.reduce(
          (sum, inv) => sum + (Number(inv.amount) || 0),
          0
        );
        return { ...prev, linkedInvoices: newList, amount: String(total) };
      });
    },
    [availableInvoices]
  );

  const validateForm = useCallback(() => {
    const e = {};
    if (!formData.customerId) e.customerId = "Customer is required";
    if (!formData.date) e.date = "Date is required";
    if (!formData.paymentMode) e.paymentMode = "Payment mode is required";
    if (!formData.amount || Number(formData.amount) <= 0)
      e.amount = "Amount must be greater than 0";
    if (!asArray(formData.linkedInvoices).length)
      e.linkedInvoices = "At least one invoice must be selected";
    if (formData.paymentMode === "Bank") {
      if (!formData.bankDetails.accountNumber)
        e["bankDetails.accountNumber"] = "Account number is required";
      if (!formData.bankDetails.accountName)
        e["bankDetails.accountName"] = "Account name is required";
    }
    if (formData.paymentMode === "Cheque") {
      if (!formData.chequeDetails.chequeNumber)
        e["chequeDetails.chequeNumber"] = "Cheque number is required";
      if (!formData.chequeDetails.chequeDate)
        e["chequeDetails.chequeDate"] = "Cheque date is required";
    }
    if (formData.paymentMode === "Online") {
      if (!formData.onlineDetails.transactionId)
        e["onlineDetails.transactionId"] = "Transaction ID is required";
      if (!formData.onlineDetails.transactionDate)
        e["onlineDetails.transactionDate"] = "Transaction date is required";
    }
    return e;
  }, [formData]);

  const resetForm = useCallback(() => {
    setEditReceiptId(null);
    setFormData({
      voucherNo: "",
      date: new Date().toISOString().split("T")[0],
      customerName: "",
      customerId: "",
      linkedInvoices: [],
      paymentMode: "Cash",
      amount: "",
      narration: "",
      bankDetails: { accountNumber: "", accountName: "" },
      chequeDetails: { chequeNumber: "", chequeDate: "" },
      onlineDetails: { transactionId: "", transactionDate: "" },
    });
    setErrors({});
    setShowModal(false);
    setAvailableInvoices([]);
    SessionManager.remove("formData");
    SessionManager.remove("lastSaveTime");
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
        date: formData.date,
        customerId: formData.customerId,
        customerName: formData.customerName,
        linkedInvoices: formData.linkedInvoices.map((inv) => ({
          invoiceId: inv.invoiceId,
          amount: Number(inv.amount),
          balance: Number(inv.balance),
        })),
        paymentMode: formData.paymentMode.toLowerCase(),
        totalAmount: Number(formData.amount),
        narration: formData.narration,
        voucherType: "receipt",
        paymentDetails: {
          bankDetails:
            formData.paymentMode === "Bank" ? formData.bankDetails : null,
          chequeDetails:
            formData.paymentMode === "Cheque" ? formData.chequeDetails : null,
          onlineDetails:
            formData.paymentMode === "Online" ? formData.onlineDetails : null,
        },
      };
      if (editReceiptId) {
        await axios.put(`/vouchers/vouchers/${editReceiptId}`, payload);
        showToastMessage("Receipt voucher updated successfully!", "success");
      } else {
        await axios.post("/vouchers/vouchers", payload);
        showToastMessage("Receipt voucher created successfully!", "success");
      }
      await fetchReceipts();
      resetForm();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to save receipt voucher.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    editReceiptId,
    formData,
    fetchReceipts,
    resetForm,
    showToastMessage,
    validateForm,
  ]);

  const handleEdit = useCallback(
    (receipt) => {
      setEditReceiptId(receipt._id);
      const linkedInvoices = asArray(receipt.linkedInvoices).map((inv) => ({
        invoiceId:
          typeof inv.invoiceId === "object" ? inv.invoiceId._id : inv.invoiceId,
        amount: String(inv.amount || 0),
        balance: String(
          inv.balance ||
            (typeof inv.invoiceId === "object"
              ? inv.invoiceId.totalAmount
              : 0) - (inv.amount || 0)
        ),
      }));
      const paymentDetails = receipt.paymentDetails || {};
      setFormData({
        voucherNo: receipt.voucherNo || "",
        date: receipt.date
          ? new Date(receipt.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        customerName:
          receipt.partyName ||
          receipt.customerName ||
          (typeof receipt.partyId === "object"
            ? receipt.partyId.customerName
            : "") ||
          "",
        customerId:
          typeof receipt.partyId === "object"
            ? receipt.partyId._id
            : receipt.partyId || receipt.customerId || "",
        linkedInvoices,
        paymentMode: displayMode(receipt.paymentMode) || "Cash",
        amount: String(receipt.totalAmount || receipt.amount || 0),
        narration: receipt.narration || "",
        bankDetails: paymentDetails.bankDetails || {
          accountNumber: "",
          accountName: "",
        },
        chequeDetails: paymentDetails.chequeDetails || {
          chequeNumber: "",
          chequeDate: "",
        },
        onlineDetails: paymentDetails.onlineDetails || {
          transactionId: "",
          transactionDate: "",
        },
      });
      setShowModal(true);
      const customerId =
        typeof receipt.partyId === "object"
          ? receipt.partyId._id
          : receipt.partyId || receipt.customerId;
      if (customerId) fetchUnpaidInvoices(customerId);
      SessionManager.remove("formData");
      SessionManager.remove("lastSaveTime");
    },
    [fetchUnpaidInvoices]
  );

  const showDeleteConfirmation = useCallback((receipt) => {
    setDeleteConfirmation({
      visible: true,
      receiptId: receipt._id,
      voucherNo: receipt.voucherNo,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      receiptId: null,
      voucherNo: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axios.delete(`/vouchers/vouchers/${deleteConfirmation.receiptId}`);
      setReceipts((prev) =>
        asArray(prev).filter((r) => r._id !== deleteConfirmation.receiptId)
      );
      showToastMessage("Receipt voucher deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchReceipts();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to delete receipt voucher.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [
    deleteConfirmation.receiptId,
    fetchReceipts,
    hideDeleteConfirmation,
    showToastMessage,
  ]);

  const openAddModal = useCallback(() => {
    resetForm();
    setShowModal(true);
    setTimeout(() => {
      const modal = document.querySelector(".modal-container");
      if (modal) modal.classList.add("scale-100");
      if (formRef.current)
        formRef.current.querySelector('input[name="searchTerm"]')?.focus();
    }, 10);
  }, [resetForm]);

  const handleRefresh = useCallback(() => fetchReceipts(true), [fetchReceipts]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return "";
    const t = new Date(timeString);
    const diffMins = Math.floor((Date.now() - t.getTime()) / 60000);
    return diffMins < 1
      ? "just now"
      : diffMins < 60
      ? `${diffMins} min${diffMins > 1 ? "s" : ""} ago`
      : t.toLocaleTimeString();
  }, []);

  const handleViewReceipt = useCallback(
    (receipt) => setSelectedReceipt(receipt),
    []
  );

  const handleBackToList = useCallback(() => setSelectedReceipt(null), []);

  const safeReceipts = useMemo(() => asArray(receipts), [receipts]);

  const receiptStats = useMemo(() => {
    const totalReceipts = safeReceipts.length;
    const totalAmount = safeReceipts.reduce(
      (sum, r) => sum + (Number(r.totalAmount ?? r.amount) || 0),
      0
    );
    const todayReceipts = safeReceipts.filter(
      (r) => new Date(r.date).toDateString() === new Date().toDateString()
    ).length;
    const avgAmount = totalReceipts ? totalAmount / totalReceipts : 0;
    return { totalReceipts, totalAmount, todayReceipts, avgAmount };
  }, [safeReceipts]);

  const sortedAndFilteredReceipts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let filtered = safeReceipts.filter((r) => {
      const voucherNo = r.voucherNo?.toLowerCase() || "";
      const customerName = (r.partyName || r.customerName || "").toLowerCase();
      const narration = r.narration?.toLowerCase() || "";
      const modeOk = filterPaymentMode
        ? displayMode(r.paymentMode) === filterPaymentMode
        : true;
      return (
        (voucherNo.includes(term) ||
          customerName.includes(term) ||
          narration.includes(term)) &&
        modeOk
      );
    });
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const av =
          sortConfig.key === "amount"
            ? Number(a.totalAmount ?? a.amount)
            : sortConfig.key === "date"
            ? new Date(a.date).getTime()
            : sortConfig.key === "linkedInvoices"
            ? asArray(a.linkedInvoices).length
            : by(a[sortConfig.key]);
        const bv =
          sortConfig.key === "amount"
            ? Number(b.totalAmount ?? b.amount)
            : sortConfig.key === "date"
            ? new Date(b.date).getTime()
            : sortConfig.key === "linkedInvoices"
            ? asArray(b.linkedInvoices).length
            : by(b[sortConfig.key]);
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
  }, [safeReceipts, searchTerm, filterPaymentMode, sortConfig]);

  if (selectedReceipt) {
    return (
      <ReceiptView
        receipt={selectedReceipt}
        customers={customers}
        onBack={handleBackToList}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="text-purple-600 animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg">Loading receipt vouchers...</p>
        </div>
      </div>
    );
  }

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Receipt size={40} className="text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No receipt vouchers found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm || filterPaymentMode
          ? "No receipt vouchers match your current filters. Try adjusting your search criteria."
          : "Start recording payments by creating your first receipt voucher."}
      </p>
      <button
        onClick={openAddModal}
        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
      >
        <Plus size={20} /> Create First Receipt
      </button>
    </div>
  );

  const lastSaveTime = SessionManager.get("lastSaveTime");

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
            <h1 className="text-3xl font-bold text-black">Receipt Voucher</h1>
            <p className="text-gray-600 mt-1">
              {receiptStats.totalReceipts} total receipts •{" "}
              {sortedAndFilteredReceipts.length} displayed
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
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
            title="Total Receipts"
            count={receiptStats.totalReceipts}
            icon={<Receipt size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText="All time records"
          />
          <StatCard
            title="Today's Receipts"
            count={receiptStats.todayReceipts}
            icon={<Calendar size={24} />}
            bgColor="bg-blue-50"
            textColor="text-blue-700"
            borderColor="border-blue-200"
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            subText="Current day activity"
          />
          <StatCard
            title="Total Amount"
            count={formatCurrency(receiptStats.totalAmount, "text-purple-700")}
            icon={<TrendingUp size={24} />}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
            borderColor="border-purple-200"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            subText="All collected payments"
          />
          <StatCard
            title="Avg Receipt Value"
            count={formatCurrency(receiptStats.avgAmount, "text-indigo-700")}
            icon={<Banknote size={24} />}
            bgColor="bg-indigo-50"
            textColor="text-indigo-700"
            borderColor="border-indigo-200"
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
            subText="Per receipt average"
          />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Receipt Vouchers
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage payment receipts and vouchers
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} /> Add Receipt
            </button>
          </div>
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search by voucher number, customer, or narration..."
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
                <FormSelect
                  label="Payment Mode"
                  value={filterPaymentMode}
                  onChange={(e) => setFilterPaymentMode(e.target.value)}
                  options={[
                    { value: "", label: "All Payment Modes" },
                    { value: "Cash", label: "Cash" },
                    { value: "Bank", label: "Bank" },
                    { value: "Cheque", label: "Cheque" },
                    { value: "Online", label: "Online" },
                  ]}
                />
                <button
                  onClick={() => {
                    setFilterPaymentMode("");
                    setSearchTerm("");
                  }}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
        {sortedAndFilteredReceipts.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "voucherNo", label: "Voucher No" },
                    { key: "date", label: "Date" },
                    { key: "customerName", label: "Customer" },
                    { key: "linkedInvoices", label: "Linked Invoices" },
                    { key: "paymentMode", label: "Payment Mode" },
                    { key: "amount", label: "Amount" },
                    { key: "narration", label: "Narration" },
                    { key: null, label: "Actions" },
                  ].map((col) => (
                    <th
                      key={col.key || "actions"}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={col.key ? () => handleSort(col.key) : undefined}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{col.label}</span>
                        {col.key && sortConfig.key === col.key && (
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
                {sortedAndFilteredReceipts.map((r) => (
                  <tr
                    key={r._id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <button
                        onClick={() => handleViewReceipt(r)}
                        className="text-blue-600 hover:underline"
                      >
                        {r.voucherNo}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(r.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                          <User size={16} className="text-purple-600" />
                        </div>
                        <div className="font-medium">
                          {r.partyName || r.customerName || "-"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {asArray(r.linkedInvoices).map((invoice, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium flex items-center"
                          >
                            <Link2 size={10} className="mr-1" />
                            {invoice.invoiceId?.transactionNo ||
                              invoice.transactionNo ||
                              invoice.invoiceId ||
                              "N/A"}
                            {invoice.amount && (
                              <span className="ml-1">
                                ({formatCurrency(invoice.amount)})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {iconForMode(r.paymentMode, {
                          DollarSign,
                          Building,
                          FileText,
                          CreditCard,
                        })}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${badgeClassForMode(
                            r.paymentMode
                          )}`}
                        >
                          {displayMode(r.paymentMode)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {formatCurrency(r.totalAmount ?? r.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {r.narration || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleEdit(r)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          title="Edit receipt"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(r)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Delete receipt"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {deleteConfirmation.visible && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Receipt Voucher
              </h3>
              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                "{deleteConfirmation.voucherNo}"?
              </p>
              <p className="text-sm text-gray-500 text-center mb-8">
                This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={hideDeleteConfirmation}
                  disabled={deleteConfirmation.isDeleting}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteConfirmation.isDeleting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  {deleteConfirmation.isDeleting ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />{" "}
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} className="mr-2" /> Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editReceiptId
                    ? "Edit Receipt Voucher"
                    : "Add Receipt Voucher"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {editReceiptId
                      ? "Update receipt voucher information"
                      : "Create a new receipt voucher"}
                  </p>
                  {lastSaveTime && (
                    <p className="text-sm text-green-600 flex items-center">
                      <Save size={12} className="mr-1" /> Draft saved{" "}
                      {formatLastSaveTime(lastSaveTime)}
                    </p>
                  )}
                </div>
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
                {editReceiptId && (
                  <FormInput
                    label="Voucher No"
                    icon={Receipt}
                    value={formData.voucherNo}
                    disabled
                    className="md:col-span-2 bg-gray-50 text-gray-500"
                  />
                )}
                <FormInput
                  label="Date"
                  icon={Calendar}
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  error={errors.date}
                  required
                />
                <CustomerSelect
                  customers={customers}
                  value={formData.customerId}
                  onChange={handleChange}
                  error={errors.customerId}
                />
                <InvoiceSelection
                  availableInvoices={availableInvoices}
                  linkedInvoices={formData.linkedInvoices}
                  onInvoiceSelection={handleInvoiceSelection}
                  onInvoiceAmountChange={handleInvoiceAmountChange}
                  customerId={formData.customerId}
                  error={errors.linkedInvoices}
                />
                <FormSelect
                  label="Payment Mode"
                  icon={CreditCard}
                  name="paymentMode"
                  value={formData.paymentMode}
                  onChange={handleChange}
                  error={errors.paymentMode}
                  options={[
                    { value: "Cash", label: "Cash" },
                    { value: "Bank", label: "Bank" },
                    { value: "Cheque", label: "Cheque" },
                    { value: "Online", label: "Online" },
                  ]}
                />
                <FormInput
                  label="Total Amount"
                  icon={DollarSign}
                  type="number"
                  name="amount"
                  value={formData.amount}
                  readOnly
                  error={errors.amount}
                  className="bg-gray-50 text-gray-500"
                />
                {formData.paymentMode === "Bank" && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput
                      label="Account Number"
                      icon={Building}
                      name="bankDetails.accountNumber"
                      value={formData.bankDetails.accountNumber}
                      onChange={handleChange}
                      error={errors["bankDetails.accountNumber"]}
                      required
                    />
                    <FormInput
                      label="Account Name"
                      icon={User}
                      name="bankDetails.accountName"
                      value={formData.bankDetails.accountName}
                      onChange={handleChange}
                      error={errors["bankDetails.accountName"]}
                      required
                    />
                  </div>
                )}
                {formData.paymentMode === "Cheque" && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput
                      label="Cheque Number"
                      icon={FileText}
                      name="chequeDetails.chequeNumber"
                      value={formData.chequeDetails.chequeNumber}
                      onChange={handleChange}
                      error={errors["chequeDetails.chequeNumber"]}
                      required
                    />
                    <FormInput
                      label="Cheque Date"
                      icon={Calendar}
                      type="date"
                      name="chequeDetails.chequeDate"
                      value={formData.chequeDetails.chequeDate}
                      onChange={handleChange}
                      error={errors["chequeDetails.chequeDate"]}
                      required
                    />
                  </div>
                )}
                {formData.paymentMode === "Online" && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormInput
                      label="Transaction ID"
                      icon={CreditCard}
                      name="onlineDetails.transactionId"
                      value={formData.onlineDetails.transactionId}
                      onChange={handleChange}
                      error={errors["onlineDetails.transactionId"]}
                      required
                    />
                    <FormInput
                      label="Transaction Date"
                      icon={Calendar}
                      type="date"
                      name="onlineDetails.transactionDate"
                      value={formData.onlineDetails.transactionDate}
                      onChange={handleChange}
                      error={errors["onlineDetails.transactionDate"]}
                      required
                    />
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FileText size={16} className="inline mr-2" /> Narration
                  </label>
                  <textarea
                    name="narration"
                    value={formData.narration}
                    onChange={handleChange}
                    placeholder="Enter any additional details or notes..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-y min-h-[100px]"
                  />
                </div>
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
                      <Loader2 size={16} className="mr-2 animate-spin" />{" "}
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />{" "}
                      {editReceiptId ? "Update Receipt" : "Save Receipt"}
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

export default ReceiptVoucherManagement;
