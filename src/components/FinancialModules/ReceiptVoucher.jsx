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
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Building,
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  UserPlus,
  Loader2,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Receipt,
  Calendar,
  DollarSign,
  FileText,
  Link,
  Banknote,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import DirhamIcon from "../../assets/dirham.svg";

// Utility to apply color filter based on class
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

// Session management utilities
const SessionManager = {
  storage: {},

  get: (key) => {
    try {
      return this.storage[`receipt_session_${key}`] || null;
    } catch {
      return null;
    }
  },

  set: (key, value) => {
    try {
      this.storage[`receipt_session_${key}`] = value;
    } catch (error) {
      console.warn("Session storage failed:", error);
    }
  },

  remove: (key) => {
    try {
      delete this.storage[`receipt_session_${key}`];
    } catch (error) {
      console.warn("Session removal failed:", error);
    }
  },

  clear: () => {
    Object.keys(this.storage).forEach((key) => {
      if (key.startsWith("receipt_session_")) {
        delete this.storage[key];
      }
    });
  },
};

const ReceiptVoucherManagement = () => {
  const [receipts, setReceipts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editReceiptId, setEditReceiptId] = useState(null);
  const [formData, setFormData] = useState({
    voucherNo: "",
    date: new Date().toISOString().split('T')[0],
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
  const [filterStatus, setFilterStatus] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    receiptId: null,
    voucherNo: "",
    isDeleting: false,
  });

  // New UX enhancement states
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Refs for enhanced UX
  const formRef = useRef(null);
  const autoSaveInterval = useRef(null);
  const searchInputRef = useRef(null);

  // Updated formatCurrency function using DirhamIcon
  const formatCurrency = useCallback(
    (amount, colorClass = "text-gray-900", textSize) => {
      const numAmount = Number(amount) || 0;
      const absAmount = Math.abs(numAmount).toFixed(2);
      const isNegative = numAmount < 0;

      return (
        <span className={`inline-flex items-center ${colorClass} `}>
          {isNegative && "-"}
          <img
            src={DirhamIcon}
            alt="AED"
            className={`${textSize ? "w-6.5 h-7.5" : "w-4.5 h-4.5"}  mr-1 `}
            style={{ filter: getColorFilter(colorClass) }}
          />
          {absAmount}
        </span>
      );
    },
    []
  );

  // Load session data on component mount
  useEffect(() => {
    const savedFormData = SessionManager.get("formData");
    const savedFilters = SessionManager.get("filters");
    const savedSearchTerm = SessionManager.get("searchTerm");

    if (savedFormData && Object.values(savedFormData).some((val) => val)) {
      setFormData(savedFormData);
      setIsDraftSaved(true);
      setLastSaveTime(SessionManager.get("lastSaveTime"));
    }

    if (savedFilters) {
      setFilterPaymentMode(savedFilters.paymentMode || "");
      setFilterStatus(savedFilters.status || "");
    }

    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
  }, []);

  // Auto-save form data to session
  useEffect(() => {
    if (showModal && Object.values(formData).some((val) => val)) {
      autoSaveInterval.current = setTimeout(() => {
        SessionManager.set("formData", formData);
        SessionManager.set("lastSaveTime", new Date().toISOString());
        setIsDraftSaved(true);
        setLastSaveTime(new Date().toISOString());
      }, 2000);
    }

    return () => {
      if (autoSaveInterval.current) {
        clearTimeout(autoSaveInterval.current);
      }
    };
  }, [formData, showModal]);

  // Save search and filter preferences
  useEffect(() => {
    SessionManager.set("searchTerm", searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    SessionManager.set("filters", {
      paymentMode: filterPaymentMode,
      status: filterStatus,
    });
  }, [filterPaymentMode, filterStatus]);

  // Fetch receipts from backend
  const fetchReceipts = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await axiosInstance.get("/receipts");
      setReceipts(response.data.data || []);

      if (showRefreshIndicator) {
        showToastMessage("Data refreshed successfully!", "success");
      }
    } catch (error) {
      console.error("Failed to fetch receipts:", error);
      showToastMessage(
        error.response?.data?.message || "Failed to fetch receipt vouchers.",
        "error"
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch customers from backend
  const fetchCustomers = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/customers/customers");
      setCustomers(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      showToastMessage("Failed to fetch customers.", "error");
    }
  }, []);

  // Fetch unpaid invoices from backend
  // const fetchUnpaidInvoices = useCallback(async (customerId = null) => {
  //   try {
  //     const params = customerId 
  //       ? `?partyId=${customerId}&partyType=customer&status=PENDING` 
  //       : "?partyType=customer&status=PENDING";
      
  //     const response = await axiosInstance.get(`/transactions/transactions${params}`);
  //     const transactions = response.data.data || [];
      
  //     // Filter only sales orders that are pending
  //     const unpaidInvoices = transactions.filter(
  //       (transaction) => 
  //         transaction.type === "sales_order" && 
  //         transaction.status === "PENDING" &&
  //         transaction.invoiceGenerated === true
  //     );
      
  //     setAvailableInvoices(unpaidInvoices);
  //   } catch (error) {
  //     console.error("Failed to fetch unpaid invoices:", error);
  //     showToastMessage("Failed to fetch unpaid invoices.", "error");
  //   }
  // }, []);

  const fetchUnpaidInvoices = useCallback(async (customerId = null) => {
    try {
      const params = new URLSearchParams();
      
      if (customerId) {
        params.append('partyId', customerId);
      }
      
      params.append('partyType', 'customer');
      params.append('type', 'sales_order');
      params.append('status', 'DRAFT');

      const response = await axiosInstance.get(
        `/transactions/transactions?${params.toString()}`
      );

      const transactions = response.data.data || [];

      // Filter for invoices that have been generated
      const availableInvoices = transactions.filter(
        (transaction) => transaction.invoiceGenerated === true
      );

      setAvailableInvoices(availableInvoices);
    } catch (error) {
      console.error("Failed to fetch available invoices:", error);
      showToastMessage("Failed to fetch available invoices.", "error");
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
    fetchCustomers();
    fetchUnpaidInvoices();
  }, [fetchReceipts, fetchCustomers, fetchUnpaidInvoices]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  }, []);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
      setIsDraftSaved(false);

      // When customer changes, fetch their unpaid invoices
      if (name === "customerId" && value) {
        fetchUnpaidInvoices(value);
        const selectedCustomer = customers.find(c => c._id === value);
        if (selectedCustomer) {
          setFormData(prev => ({
            ...prev,
            customerName: selectedCustomer.customerName
          }));
        }
      }
    },
    [errors, customers, fetchUnpaidInvoices]
  );

  const handleInvoiceSelection = useCallback((invoiceId) => {
    setFormData(prev => {
      const currentInvoices = prev.linkedInvoices || [];
      const isSelected = currentInvoices.includes(invoiceId);
      
      let newInvoices;
      if (isSelected) {
        newInvoices = currentInvoices.filter(id => id !== invoiceId);
      } else {
        newInvoices = [...currentInvoices, invoiceId];
      }

      // Calculate total amount based on selected invoices
      const totalAmount = newInvoices.reduce((sum, id) => {
        const invoice = availableInvoices.find(inv => inv._id === id);
        return sum + (invoice ? invoice.totalAmount : 0);
      }, 0);

      return {
        ...prev,
        linkedInvoices: newInvoices,
        amount: totalAmount.toString()
      };
    });
    setIsDraftSaved(false);
  }, [availableInvoices]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.customerId) newErrors.customerId = "Customer is required";
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.paymentMode) newErrors.paymentMode = "Payment mode is required";
    if (!formData.amount || Number(formData.amount) <= 0) 
      newErrors.amount = "Amount must be greater than 0";
    if (formData.linkedInvoices.length === 0) 
      newErrors.linkedInvoices = "At least one invoice must be selected";
    
    return newErrors;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        date: formData.date,
        customerId: formData.customerId,
        customerName: formData.customerName,
        linkedInvoices: formData.linkedInvoices,
        paymentMode: formData.paymentMode,
        amount: Number(formData.amount),
        narration: formData.narration,
      };

      if (editReceiptId) {
        await axiosInstance.put(`/receipts/${editReceiptId}`, payload);
        showToastMessage("Receipt voucher updated successfully!", "success");
      } else {
        await axiosInstance.post("/receipts", payload);
        showToastMessage("Receipt voucher created successfully!", "success");
      }

      await fetchReceipts();
      resetForm();

      // Clear session data after successful submission
      SessionManager.remove("formData");
      SessionManager.remove("lastSaveTime");
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to save receipt voucher.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    editReceiptId,
    formData,
    fetchReceipts,
    validateForm,
    showToastMessage,
  ]);

  const handleEdit = useCallback((receipt) => {
    setEditReceiptId(receipt._id);
    setFormData({
      voucherNo: receipt.voucherNo,
      date: new Date(receipt.date).toISOString().split('T')[0],
      customerName: receipt.customerName,
      customerId: receipt.customerId,
      linkedInvoices: receipt.linkedInvoices || [],
      paymentMode: receipt.paymentMode,
      amount: receipt.amount.toString(),
      narration: receipt.narration || "",
    });
    setShowModal(true);
    setIsDraftSaved(false);

    // Fetch invoices for the selected customer
    if (receipt.customerId) {
      fetchUnpaidInvoices(receipt.customerId);
    }

    // Clear any existing draft when editing
    SessionManager.remove("formData");
    SessionManager.remove("lastSaveTime");
  }, [fetchUnpaidInvoices]);

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
      await axiosInstance.delete(`/receipts/${deleteConfirmation.receiptId}`);
      setReceipts((prev) =>
        prev.filter(
          (receipt) => receipt._id !== deleteConfirmation.receiptId
        )
      );
      showToastMessage("Receipt voucher deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchReceipts();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete receipt voucher.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [
    deleteConfirmation.receiptId,
    fetchReceipts,
    showToastMessage,
    hideDeleteConfirmation,
  ]);

  const resetForm = useCallback(() => {
    setEditReceiptId(null);
    setFormData({
      voucherNo: "",
      date: new Date().toISOString().split('T')[0],
      customerName: "",
      customerId: "",
      linkedInvoices: [],
      paymentMode: "Cash",
      amount: "",
      narration: "",
    });
    setErrors({});
    setShowModal(false);
    setIsDraftSaved(false);
    setLastSaveTime(null);
    setAvailableInvoices([]);

    // Clear session draft
    SessionManager.remove("formData");
    SessionManager.remove("lastSaveTime");
  }, []);

  const openAddModal = useCallback(() => {
    resetForm();
    setShowModal(true);
    setTimeout(() => {
      const modal = document.querySelector(".modal-container");
      if (modal) {
        modal.classList.add("scale-100");
      }

      // Focus first input
      if (formRef.current) {
        const firstSelect = formRef.current.querySelector('select[name="customerId"]');
        if (firstSelect) firstSelect.focus();
      }
    }, 10);
  }, [resetForm]);

  const handleRefresh = useCallback(() => {
    fetchReceipts(true);
  }, [fetchReceipts]);

  const handleSort = useCallback((key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction:
        prevConfig.key === key && prevConfig.direction === "asc"
          ? "desc"
          : "asc",
    }));
  }, []);

  const getPaymentModeBadge = useCallback((mode) => {
    const badges = {
      Cash: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      Bank: "bg-blue-100 text-blue-800 border border-blue-200",
      Cheque: "bg-purple-100 text-purple-800 border border-purple-200",
      Online: "bg-indigo-100 text-indigo-800 border border-indigo-200",
    };
    return (
      badges[mode] || "bg-slate-100 text-slate-800 border border-slate-200"
    );
  }, []);

  const getPaymentModeIcon = useCallback((mode) => {
    const icons = {
      Cash: <DollarSign size={14} className="text-emerald-600" />,
      Bank: <Building size={14} className="text-blue-600" />,
      Cheque: <FileText size={14} className="text-purple-600" />,
      Online: <CreditCard size={14} className="text-indigo-600" />,
    };
    return (
      icons[mode] || <DollarSign size={14} className="text-slate-600" />
    );
  }, []);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return "";
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    return time.toLocaleTimeString();
  }, []);

  // Enhanced statistics calculations
  const receiptStats = useMemo(() => {
    const totalReceipts = receipts.length;
    const totalAmount = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
    const todayReceipts = receipts.filter(r => {
      const receiptDate = new Date(r.date).toDateString();
      const today = new Date().toDateString();
      return receiptDate === today;
    }).length;
    const avgAmount = totalReceipts > 0 ? totalAmount / totalReceipts : 0;

    const paymentModeStats = receipts.reduce((acc, receipt) => {
      const mode = receipt.paymentMode || "Unknown";
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
  }, [receipts]);

  const sortedAndFilteredReceipts = useMemo(() => {
    let filtered = receipts.filter(
      (receipt) =>
        (receipt.voucherNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          receipt.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          receipt.narration?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterPaymentMode ? receipt.paymentMode === filterPaymentMode : true)
    );

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [receipts, searchTerm, filterPaymentMode, sortConfig]);

  // Enhanced Empty State Component
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      {/* Enhanced Header */}
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
            onClick={() => setShowFilters(!showFilters)}
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

      {/* Toast Notification */}
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

      {/* Enhanced Statistics Cards */}
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
                "text-purple-700",
                "w-6.5 h-7.5"
              ),
              icon: <TrendingUp size={24} />,
              bgColor: "bg-purple-50",
              textColor: "text-purple-700",
              borderColor: "border-purple-200",
              iconBg: "bg-purple-100",
              iconColor: "text-purple-600",
              textSize: "text-4xl",
            },
            {
              title: "Avg Receipt Value",
              count: formatCurrency(
                receiptStats.avgAmount,
                "text-indigo-700",
                "w-6.5 h-7.5"
              ),
              icon: <Banknote size={24} />,
              bgColor: "bg-indigo-50",
              textColor: "text-indigo-700",
              borderColor: "border-indigo-200",
              iconBg: "bg-indigo-100",
              iconColor: "text-indigo-600",
            },
          ].map((card, index) => (
            <div
              key={index}
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

      {/* Main Content */}
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

          {/* Search and Filters */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
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
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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

        {/* Table/Content */}
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
                  ].map((column) => (
                    <th
                      key={column.key || "actions"}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={
                        column.key ? () => handleSort(column.key) : undefined
                      }
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {column.key && sortConfig.key === column.key && (
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
                {sortedAndFilteredReceipts.map((receipt) => (
                  <tr
                    key={receipt._id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {receipt.voucherNo}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(receipt.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                          <User size={16} className="text-purple-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {receipt.customerName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {(receipt.linkedInvoices || []).map((invoiceId, index) => {
                          const invoice = availableInvoices.find(inv => inv._id === invoiceId);
                          return (
                            <span
                              key={index}
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium flex items-center"
                            >
                              <Link size={10} className="mr-1" />
                              {invoice?.transactionNo || invoiceId}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getPaymentModeIcon(receipt.paymentMode)}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentModeBadge(
                            receipt.paymentMode
                          )}`}
                        >
                          {receipt.paymentMode}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {formatCurrency(receipt.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {receipt.narration || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleEdit(receipt)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          title="Edit receipt"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(receipt)}
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

      {/* Enhanced Delete Confirmation Modal */}
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
                This action cannot be undone and will permanently remove the
                receipt voucher from your records.
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
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} className="mr-2" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editReceiptId ? "Edit Receipt Voucher" : "Add Receipt Voucher"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {editReceiptId
                      ? "Update receipt voucher information"
                      : "Create a new receipt voucher"}
                  </p>
                  {isDraftSaved && lastSaveTime && (
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

            {/* Modal Body */}
            <div className="p-6" ref={formRef}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Voucher No - Auto-generated */}
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
                    {customers.map((customer) => (
                      <option key={customer._id} value={customer._id}>
                        {customer.customerName}
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
                    <Link size={16} className="inline mr-2" /> Linked Invoice(s) *
                  </label>
                  <div className={`border rounded-xl p-4 max-h-48 overflow-y-auto ${
                    errors.linkedInvoices ? "border-red-300 bg-red-50" : "border-gray-300"
                  }`}>
                    {availableInvoices.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">
                        {formData.customerId 
                          ? "No unpaid invoices found for selected customer"
                          : "Please select a customer first to view unpaid invoices"
                        }
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {availableInvoices.map((invoice) => (
                          <div
                            key={invoice._id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                          >
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={formData.linkedInvoices.includes(invoice._id)}
                                onChange={() => handleInvoiceSelection(invoice._id)}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                              />
                              <div>
                                <p className="font-medium text-sm text-gray-900">
                                  {invoice.transactionNo}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(invoice.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-sm text-gray-900">
                                {formatCurrency(invoice.totalAmount)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {invoice.status}
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
                    <CreditCard size={16} className="inline mr-2" /> Payment Mode *
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

              {/* Modal Footer */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                  {isDraftSaved ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle size={14} className="mr-1" />
                      Changes saved automatically
                    </span>
                  ) : formData.customerId ||
                    formData.amount ||
                    formData.narration ? (
                    <span className="flex items-center text-amber-600">
                      <Clock size={14} className="mr-1" />
                      Unsaved changes
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
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Saving...
                      </>
                    ) : editReceiptId ? (
                      <>
                        <Save size={16} className="mr-2" />
                        Update Receipt
                      </>
                    ) : (
                      <>
                        <Plus size={16} className="mr-2" />
                        Add Receipt
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