import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  User,
  TrendingUp,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Receipt,
  Calendar,
  CreditCard,
  FileText,
  Link as LinkIcon,
  DollarSign,
  Building,
  Banknote,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import DirhamIcon from "../../assets/dirham.svg";

/* -------------------------- Utilities & Helpers -------------------------- */

const getColorFilter = (colorClass) => {
  switch (colorClass) {
    case "text-emerald-700":
      return "invert(34%) sepia(94%) saturate(1352%) hue-rotate(145deg) brightness(94%) contrast(101%)";
    case "text-blue-700":
      return "invert(35%) sepia(99%) saturate(1352%) hue-rotate(200deg) brightness(94%) contrast(101%)";
    case "text-indigo-700":
      return "invert(38%) sepia(99%) saturate(1352%) hue-rotate(230deg) brightness(94%) contrast(101%)";
    case "text-purple-700":
      return "invert(35%) sepia(99%) saturate(1352%) hue-rotate(280deg) brightness(94%) contrast(101%)";
    default:
      return "none";
  }
};

// In-memory session manager (fixed 'this' references)
// If you want persistence across reloads, switch to localStorage safely.
const SessionManager = {
  storage: {},
  key: (k) => `receipt_session_${k}`,
  get(key) {
    try {
      return SessionManager.storage[SessionManager.key(key)] ?? null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      SessionManager.storage[SessionManager.key(key)] = value;
    } catch {}
  },
  remove(key) {
    try {
      delete SessionManager.storage[SessionManager.key(key)];
    } catch {}
  },
  clear() {
    Object.keys(SessionManager.storage).forEach((k) => {
      if (k.startsWith("receipt_session_")) delete SessionManager.storage[k];
    });
  },
};

// Safe array helper
const asArray = (x) => (Array.isArray(x) ? x : []);

// Normalize API responses that might wrap data
const takeArray = (resp) => {
  // supports: resp.data -> array | {data: array} | {data: {data: array}}
  if (!resp) return [];
  const d = resp.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data.data ?? d.data; // tolerate either
  if (Array.isArray(d?.vouchers)) return d.vouchers;
  return [];
};

// Payment mode display helpers
const displayMode = (mode) => {
  // Normalize case from backend ('cash') or frontend ('Cash')
  const m = (mode || "").toString().toLowerCase();
  return m === "cash"
    ? "Cash"
    : m === "bank"
    ? "Bank"
    : m === "cheque"
    ? "Cheque"
    : m === "online"
    ? "Online"
    : mode || "Unknown";
};

const badgeClassForMode = (mode) => {
  const m = displayMode(mode);
  const badges = {
    Cash: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    Bank: "bg-blue-100 text-blue-800 border border-blue-200",
    Cheque: "bg-purple-100 text-purple-800 border border-purple-200",
    Online: "bg-indigo-100 text-indigo-800 border border-indigo-200",
  };
  return badges[m] || "bg-slate-100 text-slate-800 border border-slate-200";
};

const iconForMode = (mode) => {
  const m = displayMode(mode);
  const map = {
    Cash: <DollarSign size={14} className="text-emerald-600" />,
    Bank: <Building size={14} className="text-blue-600" />,
    Cheque: <FileText size={14} className="text-purple-600" />,
    Online: <CreditCard size={14} className="text-indigo-600" />,
  };
  return map[m] || <DollarSign size={14} className="text-slate-600" />;
};

const formatCurrency = (amount, colorClass = "text-gray-900") => {
  const numAmount = Number(amount) || 0;
  const absAmount = Math.abs(numAmount).toFixed(2);
  const isNegative = numAmount < 0;
  return (
    <span className={`inline-flex items-center ${colorClass}`}>
      {isNegative && "-"}
      <img
        src={DirhamIcon}
        alt="AED"
        className="w-4.5 h-4.5 mr-1"
        style={{ filter: getColorFilter(colorClass) }}
      />
      {absAmount}
    </span>
  );
};

const by = (v) => (typeof v === "string" ? v.toLowerCase() : v);

/* ------------------------------ Main Component ------------------------------ */

const ReceiptVoucherManagement = () => {
  const [receipts, setReceipts] = useState([]); // always array
  const [customers, setCustomers] = useState([]); // always array
  const [availableInvoices, setAvailableInvoices] = useState([]); // for selected customer
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
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
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [filterPaymentMode, setFilterPaymentMode] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const formRef = useRef(null);
  const autoSaveTimer = useRef(null);
  const searchInputRef = useRef(null);

  /* ------------------------------ Effects: Session ------------------------------ */

  useEffect(() => {
    const savedFormData = SessionManager.get("formData");
    const savedFilters = SessionManager.get("filters");
    const savedSearchTerm = SessionManager.get("searchTerm");

    if (savedFormData && typeof savedFormData === "object") {
      setFormData((prev) => ({ ...prev, ...savedFormData }));
    }
    if (savedFilters) {
      setFilterPaymentMode(savedFilters.paymentMode || "");
    }
    if (savedSearchTerm) setSearchTerm(savedSearchTerm);
  }, []);

  useEffect(() => {
    if (showModal) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        SessionManager.set("formData", formData);
        SessionManager.set("lastSaveTime", new Date().toISOString());
      }, 800);
    }
    return () => autoSaveTimer.current && clearTimeout(autoSaveTimer.current);
  }, [formData, showModal]);

  useEffect(() => {
    SessionManager.set("searchTerm", searchTerm);
  }, [searchTerm]);
  useEffect(() => {
    SessionManager.set("filters", { paymentMode: filterPaymentMode });
  }, [filterPaymentMode]);

  /* ------------------------------ Data Fetchers ------------------------------ */

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
        // adjust path to match your API
        const response = await axiosInstance.get("/vouchers/vouchers", {
          params: { voucherType: "receipt" }, // only receipts for this screen
        });
        console.log(response);
        const arr = takeArray(response);
        setReceipts(asArray(arr));
        if (showRefreshIndicator) showToastMessage("Data refreshed", "success");
      } catch (err) {
        console.error("Failed to fetch receipts:", err);
        showToastMessage(
          err.response?.data?.message || "Failed to fetch receipt vouchers.",
          "error"
        );
        setReceipts([]); // ensure array
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showToastMessage]
  );

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/customers/customers");
      setCustomers(asArray(takeArray(response)));
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      showToastMessage("Failed to fetch customers.", "error");
      setCustomers([]);
    }
  }, [showToastMessage]);

  const fetchUnpaidInvoices = useCallback(
    async (customerId = null) => {
      try {
        const params = new URLSearchParams();
        if (customerId) params.append("partyId", customerId);
        params.append("partyType", "customer");
        params.append("type", "sales_order");
        params.append("status", "DRAFT");

        const response = await axiosInstance.get(
          `/transactions/transactions?${params.toString()}`
        );
        const transactions = asArray(takeArray(response));
        // business rule: show only those without invoice generated
        setAvailableInvoices(
          transactions.filter((t) => t?.invoiceGenerated === false)
        );
      } catch (err) {
        console.error("Failed to fetch available invoices:", err);
        showToastMessage("Failed to fetch available invoices.", "error");
        setAvailableInvoices([]);
      }
    },
    [showToastMessage]
  );

  useEffect(() => {
    fetchReceipts();
    fetchCustomers();
    fetchUnpaidInvoices();
  }, [fetchReceipts, fetchCustomers, fetchUnpaidInvoices]);

  /* ------------------------------ Handlers ------------------------------ */

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));

      if (name === "customerId") {
        const selected = customers.find((c) => c._id === value);
        setFormData((prev) => ({
          ...prev,
          customerName: selected?.customerName || "",
        }));
        fetchUnpaidInvoices(value);
      }
    },
    [errors, customers, fetchUnpaidInvoices]
  );

  const handleInvoiceSelection = useCallback(
    (invoiceId) => {
      setFormData((prev) => {
        const list = asArray(prev.linkedInvoices);
        const isSelected = list.includes(invoiceId);
        const newList = isSelected
          ? list.filter((id) => id !== invoiceId)
          : [...list, invoiceId];

        const total = newList.reduce((sum, id) => {
          const inv = availableInvoices.find((x) => x._id === id);
          return sum + (Number(inv?.totalAmount) || 0);
        }, 0);

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
      // map display PaymentMode to backend lowercase mode
      const modeLower = formData.paymentMode.toString().toLowerCase();

      const payload = {
        date: formData.date,
        customerId: formData.customerId,
        customerName: formData.customerName,
        linkedInvoices: asArray(formData.linkedInvoices),
        paymentMode: modeLower, // backend expects lower-case per your service
        totalAmount: Number(formData.amount), // FinancialService expects totalAmount
        narration: formData.narration,
        voucherType: "receipt",
      };

      if (editReceiptId) {
        await axiosInstance.put(`/vouchers/vouchers/${editReceiptId}`, payload);
        showToastMessage("Receipt voucher updated successfully!", "success");
      } else {
        await axiosInstance.post("/vouchers/vouchers", payload);
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
      setFormData({
        voucherNo: receipt.voucherNo,
        date: new Date(receipt.date).toISOString().split("T")[0],
        customerName:
          receipt.partyName ||
          receipt.customerName ||
          receipt.partyId?.customerName ||
          "",
        customerId:
          typeof receipt.partyId === "object"
            ? receipt.partyId?._id
            : receipt.partyId || receipt.customerId || "",
        linkedInvoices: asArray(receipt.linkedInvoices),
        paymentMode: displayMode(receipt.paymentMode),
        amount: String(receipt.totalAmount || receipt.amount || 0),
        narration: receipt.narration || "",
      });

      setShowModal(true);
      const customerId =
        typeof receipt.partyId === "object"
          ? receipt.partyId?._id
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

  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    receiptId: null,
    voucherNo: "",
    isDeleting: false,
  });

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
      await axiosInstance.delete(
        `/vouchers/vouchers/${deleteConfirmation.receiptId}`
      );
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
      if (formRef.current) {
        const firstSelect = formRef.current.querySelector(
          'select[name="customerId"]'
        );
        if (firstSelect) firstSelect.focus();
      }
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
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    return t.toLocaleTimeString();
  }, []);

  /* ------------------------------ Derived Data ------------------------------ */

  const safeReceipts = useMemo(() => asArray(receipts), [receipts]);

  // FIX: receipts?.reduce -> safeReceipts.reduce (always an array)
  const receiptStats = useMemo(() => {
    const totalReceipts = safeReceipts.length;
    const totalAmount = safeReceipts.reduce(
      (sum, r) => sum + (Number(r.totalAmount ?? r.amount) || 0),
      0
    );
    const todayStr = new Date().toDateString();
    const todayReceipts = safeReceipts.filter(
      (r) => new Date(r.date).toDateString() === todayStr
    ).length;
    const avgAmount = totalReceipts ? totalAmount / totalReceipts : 0;

    const paymentModeStats = safeReceipts.reduce((acc, r) => {
      const mode = displayMode(r.paymentMode);
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    }, {});

    return {
      totalReceipts,
      totalAmount,
      todayReceipts,
      avgAmount,
      paymentModeStats,
    };
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
      const { key, direction } = sortConfig;
      filtered = [...filtered].sort((a, b) => {
        const av =
          key === "amount"
            ? Number(a.totalAmount ?? a.amount)
            : key === "date"
            ? new Date(a.date).getTime()
            : key === "linkedInvoices"
            ? asArray(a.linkedInvoices).length
            : by(a[key]);
        const bv =
          key === "amount"
            ? Number(b.totalAmount ?? b.amount)
            : key === "date"
            ? new Date(b.date).getTime()
            : key === "linkedInvoices"
            ? asArray(b.linkedInvoices).length
            : by(b[key]);

        if (av < bv) return direction === "asc" ? -1 : 1;
        if (av > bv) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [safeReceipts, searchTerm, filterPaymentMode, sortConfig]);

  /* ------------------------------ UI ------------------------------ */

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
        <Plus size={20} />
        Create First Receipt
      </button>
    </div>
  );

  const lastSaveTime = SessionManager.get("lastSaveTime");

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black bg-clip-text">
              Receipt Voucher
            </h1>
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

      {/* Toast */}
      {showToast.visible && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg text-white z-50 transform transition-all duration-300 ${
            showToast.type === "success" ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          <div className="flex items-center space-x-2">
            {showToast.type === "success" ? (
              <CheckCircle size={16} />
            ) : (
              <XCircle size={16} />
            )}
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: "Total Receipts",
              count: receiptStats.totalReceipts,
              icon: <Receipt size={24} />,
              bgColor: "bg-emerald-50",
              textColor: "text-emerald-700",
              borderColor: "border-emerald-200",
              iconBg: "bg-emerald-100",
              iconColor: "text-emerald-600",
            },
            {
              title: "Today's Receipts",
              count: receiptStats.todayReceipts,
              icon: <Calendar size={24} />,
              bgColor: "bg-blue-50",
              textColor: "text-blue-700",
              borderColor: "border-blue-200",
              iconBg: "bg-blue-100",
              iconColor: "text-blue-600",
            },
            {
              title: "Total Amount",
              count: formatCurrency(
                receiptStats.totalAmount,
                "text-purple-700"
              ),
              icon: <TrendingUp size={24} />,
              bgColor: "bg-purple-50",
              textColor: "text-purple-700",
              borderColor: "border-purple-200",
              iconBg: "bg-purple-100",
              iconColor: "text-purple-600",
            },
            {
              title: "Avg Receipt Value",
              count: formatCurrency(receiptStats.avgAmount, "text-indigo-700"),
              icon: <Banknote size={24} />,
              bgColor: "bg-indigo-50",
              textColor: "text-indigo-700",
              borderColor: "border-indigo-200",
              iconBg: "bg-indigo-100",
              iconColor: "text-indigo-600",
            },
          ].map((card, i) => (
            <div
              key={i}
              className={`${card.bgColor} ${card.borderColor} rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-105`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${card.iconBg} rounded-xl`}>
                  <div className={card.iconColor}>{card.icon}</div>
                </div>
                <button
                  className={`text-xs ${card.textColor} hover:opacity-80 transition-opacity font-medium`}
                >
                  View Details →
                </button>
              </div>
              <h3 className={`text-sm font-medium ${card.textColor} mb-2`}>
                {card.title}
              </h3>
              <p className="text-3xl font-bold text-gray-900">{card.count}</p>
              <p className="text-xs text-gray-500 mt-1">
                {card.title.includes("Total Receipts")
                  ? "All time records"
                  : card.title.includes("Today")
                  ? "Current day activity"
                  : card.title.includes("Total Amount")
                  ? "All collected payments"
                  : "Per receipt average"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        {/* Header */}
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
              <Plus size={18} />
              Add Receipt
            </button>
          </div>

          {/* Search + Filters */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
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
                <select
                  value={filterPaymentMode}
                  onChange={(e) => setFilterPaymentMode(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">All Payment Modes</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Online">Online</option>
                </select>

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

        {/* Table */}
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
                      {r.voucherNo}
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
                        {asArray(r.linkedInvoices).map((invoiceId, idx) => {
                          const inv = availableInvoices.find(
                            (x) =>
                              x._id === invoiceId || x.invoiceId === invoiceId
                          );
                          return (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium flex items-center"
                            >
                              <LinkIcon size={10} className="mr-1" />
                              {inv?.transactionNo ||
                                inv?.invoiceNo ||
                                String(invoiceId)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {iconForMode(r.paymentMode)}
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

      {/* Delete Confirmation */}
      {deleteConfirmation.visible && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
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

      {/* Modal */}
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
                      <Save size={12} className="mr-1" />
                      Draft saved {formatLastSaveTime(lastSaveTime)}
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
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Receipt size={16} className="inline mr-2" /> Voucher No
                    </label>
                    <input
                      type="text"
                      value={formData.voucherNo}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-2" /> Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.date
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.date && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.date}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <User size={16} className="inline mr-2" /> Customer Name *
                  </label>
                  <select
                    name="customerId"
                    value={formData.customerId}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.customerId
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.customerName}
                      </option>
                    ))}
                  </select>
                  {errors.customerId && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.customerId}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <LinkIcon size={16} className="inline mr-2" /> Linked
                    Invoice(s) *
                  </label>
                  <div
                    className={`border rounded-xl p-4 max-h-48 overflow-y-auto ${
                      errors.linkedInvoices
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    {availableInvoices.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">
                        {formData.customerId
                          ? "No unpaid invoices found for selected customer"
                          : "Please select a customer first to view unpaid invoices"}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {availableInvoices.map((inv) => (
                          <div
                            key={inv._id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={asArray(
                                  formData.linkedInvoices
                                ).includes(inv._id)}
                                onChange={() => handleInvoiceSelection(inv._id)}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                              />
                              <div>
                                <p className="font-medium text-sm text-gray-900">
                                  {inv.transactionNo}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(inv.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-sm text-gray-900">
                                {formatCurrency(inv.totalAmount)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {inv.status}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.linkedInvoices && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.linkedInvoices}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <CreditCard size={16} className="inline mr-2" /> Payment
                    Mode *
                  </label>
                  <select
                    name="paymentMode"
                    value={formData.paymentMode}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.paymentMode
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                  </select>
                  {errors.paymentMode && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.paymentMode}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <DollarSign size={16} className="inline mr-2" /> Amount *
                  </label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.amount
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.amount && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.amount}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FileText size={16} className="inline mr-2" /> Narration
                  </label>
                  <textarea
                    name="narration"
                    value={formData.narration}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter payment details or notes (optional)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                  {formData.customerId ||
                  formData.amount ||
                  formData.narration ? (
                    <span className="flex items-center text-amber-600">
                      <Clock size={14} className="mr-1" /> Unsaved changes
                    </span>
                  ) : null}
                </div>

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={isSubmitting}
                    className="px-6 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />{" "}
                        Saving...
                      </>
                    ) : editReceiptId ? (
                      <>
                        <Save size={16} className="mr-2" /> Update Receipt
                      </>
                    ) : (
                      <>
                        <Plus size={16} className="mr-2" /> Add Receipt
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiptVoucherManagement;
