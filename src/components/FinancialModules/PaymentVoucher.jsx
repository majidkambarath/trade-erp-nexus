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
  Upload,
  File,
  Paperclip,
  Download,
  Eye,
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
      return this.storage[`payment_session_${key}`] || null;
    } catch {
      return null;
    }
  },

  set: (key, value) => {
    try {
      this.storage[`payment_session_${key}`] = value;
    } catch (error) {
      console.warn("Session storage failed:", error);
    }
  },

  remove: (key) => {
    try {
      delete this.storage[`payment_session_${key}`];
    } catch (error) {
      console.warn("Session removal failed:", error);
    }
  },

  clear: () => {
    Object.keys(this.storage).forEach((key) => {
      if (key.startsWith("payment_session_")) {
        delete this.storage[key];
      }
    });
  },
};

const PaymentVoucherManagement = () => {
  const [payments, setPayments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editPaymentId, setEditPaymentId] = useState(null);
  const [formData, setFormData] = useState({
    voucherNo: "",
    date: new Date().toISOString().split("T")[0],
    vendorName: "",
    vendorId: "",
    linkedInvoices: [],
    paymentMode: "Cash",
    amount: "",
    remarks: "",
    attachedProof: null,
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
    paymentId: null,
    voucherNo: "",
    isDeleting: false,
  });

  // New UX enhancement states
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [isFileUploading, setIsFileUploading] = useState(false);

  // Refs for enhanced UX
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
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

  // Fetch payment vouchers from backend
  const fetchPayments = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await axiosInstance.get("/vouchers/payment-vouchers");
      setPayments(response.data.data || []);

      if (showRefreshIndicator) {
        showToastMessage("Data refreshed successfully!", "success");
      }
    } catch (error) {
      console.error("Failed to fetch payment vouchers:", error);
      showToastMessage(
        error.response?.data?.message || "Failed to fetch payment vouchers.",
        "error"
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch vendors from backend
  const fetchVendors = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/vendors/vendors");
      setVendors(response.data.data || []);
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
      showToastMessage("Failed to fetch vendors.", "error");
    }
  }, []);

  // Fetch outstanding purchase invoices from backend
 const fetchOutstandingInvoices = useCallback(async (vendorId = null) => {
    try {
      const params = new URLSearchParams();
      
      if (vendorId) {
        params.append('partyId', vendorId);
      }
      
      params.append('partyType', 'vendor');
      params.append('type', 'purchase_order');
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
    fetchPayments();
    fetchVendors();
    fetchOutstandingInvoices();
  }, [fetchPayments, fetchVendors, fetchOutstandingInvoices]);

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

      // When vendor changes, fetch their outstanding invoices
      if (name === "vendorId" && value) {
        fetchOutstandingInvoices(value);
        const selectedVendor = vendors.find((v) => v._id === value);
        if (selectedVendor) {
          setFormData((prev) => ({
            ...prev,
            vendorName: selectedVendor.vendorName,
          }));
        }
      }
    },
    [errors, vendors, fetchOutstandingInvoices]
  );

  const handleFileUpload = useCallback(
    async (file) => {
      if (!file) return;

      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
      ];
      if (!allowedTypes.includes(file.type)) {
        showToastMessage("Please upload PDF, JPG, or PNG files only.", "error");
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        showToastMessage("File size should be less than 5MB.", "error");
        return;
      }

      setIsFileUploading(true);
      setFileUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "payment_proof");

        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
          setFileUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 100);

        const response = await axiosInstance.post("/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setFileUploadProgress(percentCompleted);
          },
        });

        clearInterval(progressInterval);
        setFileUploadProgress(100);

        setFormData((prev) => ({
          ...prev,
          attachedProof: response.data.data.fileName,
        }));

        showToastMessage("File uploaded successfully!", "success");
        setIsDraftSaved(false);
      } catch (error) {
        console.error("File upload failed:", error);
        showToastMessage("Failed to upload file.", "error");
      } finally {
        setIsFileUploading(false);
        setFileUploadProgress(0);
      }
    },
    [showToastMessage]
  );

  const handleFileSelect = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleInvoiceSelection = useCallback(
    (invoiceId) => {
      setFormData((prev) => {
        const currentInvoices = prev.linkedInvoices || [];
        const isSelected = currentInvoices.includes(invoiceId);

        let newInvoices;
        if (isSelected) {
          newInvoices = currentInvoices.filter((id) => id !== invoiceId);
        } else {
          newInvoices = [...currentInvoices, invoiceId];
        }

        // Calculate total amount based on selected invoices
        const totalAmount = newInvoices.reduce((sum, id) => {
          const invoice = availableInvoices.find((inv) => inv._id === id);
          return sum + (invoice ? invoice.totalAmount : 0);
        }, 0);

        return {
          ...prev,
          linkedInvoices: newInvoices,
          amount: totalAmount.toString(),
        };
      });
      setIsDraftSaved(false);
    },
    [availableInvoices]
  );

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.vendorId) newErrors.vendorId = "Vendor is required";
    if (!formData.date) newErrors.date = "Date is required";
    if (!formData.paymentMode)
      newErrors.paymentMode = "Payment mode is required";
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
        vendorId: formData.vendorId,
        vendorName: formData.vendorName,
        linkedInvoices: formData.linkedInvoices,
        paymentMode: formData.paymentMode,
        amount: Number(formData.amount),
        remarks: formData.remarks,
        attachedProof: formData.attachedProof,
      };

      if (editPaymentId) {
        await axiosInstance.put(`/vouchers/payment-vouchers/${editPaymentId}`, payload);
        showToastMessage("Payment voucher updated successfully!", "success");
      } else {
        await axiosInstance.post("/vouchers/payment-vouchers", payload);
        showToastMessage("Payment voucher created successfully!", "success");
      }

      await fetchPayments();
      resetForm();

      // Clear session data after successful submission
      SessionManager.remove("formData");
      SessionManager.remove("lastSaveTime");
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to save payment voucher.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [editPaymentId, formData, fetchPayments, validateForm, showToastMessage]);

  const handleEdit = useCallback(
    (payment) => {
      setEditPaymentId(payment._id);
      setFormData({
        voucherNo: payment.voucherNo,
        date: new Date(payment.date).toISOString().split("T")[0],
        vendorName: payment.vendorName,
        vendorId: payment.vendorId,
        linkedInvoices: payment.linkedInvoices || [],
        paymentMode: payment.paymentMode,
        amount: payment.amount.toString(),
        remarks: payment.remarks || "",
        attachedProof: payment.attachedProof || null,
      });
      setShowModal(true);
      setIsDraftSaved(false);

      // Fetch invoices for the selected vendor
      if (payment.vendorId) {
        fetchOutstandingInvoices(payment.vendorId);
      }

      // Clear any existing draft when editing
      SessionManager.remove("formData");
      SessionManager.remove("lastSaveTime");
    },
    [fetchOutstandingInvoices]
  );

  const showDeleteConfirmation = useCallback((payment) => {
    setDeleteConfirmation({
      visible: true,
      paymentId: payment._id,
      voucherNo: payment.voucherNo,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      paymentId: null,
      voucherNo: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));

    try {
      await axiosInstance.delete(
        `/vouchers/payment-vouchers/${deleteConfirmation.paymentId}`
      );
      setPayments((prev) =>
        prev.filter((payment) => payment._id !== deleteConfirmation.paymentId)
      );
      showToastMessage("Payment voucher deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchPayments();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete payment voucher.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [
    deleteConfirmation.paymentId,
    fetchPayments,
    showToastMessage,
    hideDeleteConfirmation,
  ]);

  const resetForm = useCallback(() => {
    setEditPaymentId(null);
    setFormData({
      voucherNo: "",
      date: new Date().toISOString().split("T")[0],
      vendorName: "",
      vendorId: "",
      linkedInvoices: [],
      paymentMode: "Cash",
      amount: "",
      remarks: "",
      attachedProof: null,
    });
    setErrors({});
    setShowModal(false);
    setIsDraftSaved(false);
    setLastSaveTime(null);
    setAvailableInvoices([]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

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
        const firstSelect = formRef.current.querySelector(
          'select[name="vendorId"]'
        );
        if (firstSelect) firstSelect.focus();
      }
    }, 10);
  }, [resetForm]);

  const handleRefresh = useCallback(() => {
    fetchPayments(true);
  }, [fetchPayments]);

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
      "Bank Transfer": "bg-blue-100 text-blue-800 border border-blue-200",
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
      "Bank Transfer": <Building size={14} className="text-blue-600" />,
      Cheque: <FileText size={14} className="text-purple-600" />,
      Online: <CreditCard size={14} className="text-indigo-600" />,
    };
    return icons[mode] || <DollarSign size={14} className="text-slate-600" />;
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
  const paymentStats = useMemo(() => {
    const totalPayments = payments.length;
    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const todayPayments = payments.filter((p) => {
      const paymentDate = new Date(p.date).toDateString();
      const today = new Date().toDateString();
      return paymentDate === today;
    }).length;
    const avgAmount = totalPayments > 0 ? totalAmount / totalPayments : 0;

    const paymentModeStats = payments.reduce((acc, payment) => {
      const mode = payment.paymentMode || "Unknown";
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPayments,
      totalAmount,
      todayPayments,
      avgAmount,
      paymentModeStats,
    };
  }, [payments]);

  const sortedAndFilteredPayments = useMemo(() => {
    let filtered = payments.filter(
      (payment) =>
        (payment.voucherNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment.vendorName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          payment.remarks?.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterPaymentMode ? payment.paymentMode === filterPaymentMode : true)
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
  }, [payments, searchTerm, filterPaymentMode, sortConfig]);

  // Enhanced Empty State Component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Receipt size={40} className="text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No payment vouchers found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm || filterPaymentMode
          ? "No payment vouchers match your current filters. Try adjusting your search criteria."
          : "Start recording vendor payments by creating your first payment voucher."}
      </p>
      <button
        onClick={openAddModal}
        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
      >
        <Plus size={20} />
        Create First Payment
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
          <p className="text-gray-600 text-lg">Loading payment vouchers...</p>
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
              Payment Voucher
            </h1>
            <p className="text-gray-600 mt-1">
              {paymentStats.totalPayments} total payments •{" "}
              {sortedAndFilteredPayments.length} displayed
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
              title: "Total Payments",
              count: paymentStats.totalPayments,
              icon: <Receipt size={24} />,
              bgColor: "bg-emerald-50",
              textColor: "text-emerald-700",
              borderColor: "border-emerald-200",
              iconBg: "bg-emerald-100",
              iconColor: "text-emerald-600",
            },
            {
              title: "Today's Payments",
              count: paymentStats.todayPayments,
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
                paymentStats.totalAmount,
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
              title: "Avg Payment Value",
              count: formatCurrency(
                paymentStats.avgAmount,
                "text-indigo-700",
                "w-6.5 h-7.5"
              ),
              icon: <Banknote size={24} />,
              bgColor: "bg-indigo-50",
              textColor: "text-indigo-700",
              borderColor: "border-indigo-200",
              iconBg: "bg-indigo-100",
              iconColor: "text-indigo-600",
              textSize: "text-xl",
            },
          ].map((stat, index) => (
            <div
              key={index}
              className={`${stat.bgColor} border ${stat.borderColor} rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:scale-105`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    {stat.title}
                  </p>
                  <p
                    className={`${stat.textSize || "text-2xl"} font-bold ${
                      stat.textColor
                    }`}
                  >
                    {stat.count}
                  </p>
                </div>
                <div className={`${stat.iconBg} p-3 rounded-xl`}>
                  <div className={stat.iconColor}>{stat.icon}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Enhanced Search and Filters */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 mb-8 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <Search
                size={20}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by voucher number, vendor name, or remarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Add Payment Button */}
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} />
              Add Payment
            </button>
          </div>

          {/* Collapsible Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Mode
                  </label>
                  <select
                    value={filterPaymentMode}
                    onChange={(e) => setFilterPaymentMode(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">All Payment Modes</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date Range
                  </label>
                  <select className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                    <option value="">All Dates</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFilterPaymentMode("");
                      setFilterStatus("");
                      setSearchTerm("");
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Vouchers List */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {sortedAndFilteredPayments.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                      onClick={() => handleSort("voucherNo")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Voucher No.</span>
                        <ArrowLeft
                          size={14}
                          className={`transform transition-transform duration-200 ${
                            sortConfig.key === "voucherNo"
                              ? sortConfig.direction === "desc"
                                ? "rotate-90"
                                : "-rotate-90"
                              : "rotate-0 opacity-0"
                          }`}
                        />
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 text-left text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center space-x-1">
                        <span>Date</span>
                        <ArrowLeft
                          size={14}
                          className={`transform transition-transform duration-200 ${
                            sortConfig.key === "date"
                              ? sortConfig.direction === "desc"
                                ? "rotate-90"
                                : "-rotate-90"
                              : "rotate-0 opacity-0"
                          }`}
                        />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Vendor
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Payment Mode
                    </th>
                    <th
                      className="px-6 py-4 text-right text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        <span>Amount</span>
                        <ArrowLeft
                          size={14}
                          className={`transform transition-transform duration-200 ${
                            sortConfig.key === "amount"
                              ? sortConfig.direction === "desc"
                                ? "rotate-90"
                                : "-rotate-90"
                              : "rotate-0 opacity-0"
                          }`}
                        />
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">
                      Invoices
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedAndFilteredPayments.map((payment) => (
                    <tr
                      key={payment._id}
                      className="hover:bg-gray-50 transition-colors duration-200"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-blue-100 rounded-lg flex items-center justify-center mr-3">
                            <Receipt size={18} className="text-purple-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {payment.voucherNo}
                            </p>
                            {payment.attachedProof && (
                              <div className="flex items-center mt-1">
                                <Paperclip
                                  size={12}
                                  className="text-gray-400 mr-1"
                                />
                                <span className="text-xs text-gray-500">
                                  Proof attached
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center text-gray-600">
                          <Calendar size={16} className="mr-2 text-gray-400" />
                          {new Date(payment.date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                            <User size={14} className="text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {payment.vendorName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getPaymentModeBadge(
                            payment.paymentMode
                          )}`}
                        >
                          {getPaymentModeIcon(payment.paymentMode)}
                          <span className="ml-2">{payment.paymentMode}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-semibold">
                          {formatCurrency(payment.amount, "text-gray-900")}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Link size={16} className="text-gray-400 mr-2" />
                          <span className="text-sm text-gray-600">
                            {payment.linkedInvoices?.length || 0} invoice(s)
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center space-x-2">
                          {payment.attachedProof && (
                            <button
                              onClick={() =>
                                window.open(
                                  `/api/files/${payment.attachedProof}`,
                                  "_blank"
                                )
                              }
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                              title="View attachment"
                            >
                              <Eye size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(payment)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                            title="Edit payment"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => showDeleteConfirmation(payment)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            title="Delete payment"
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

            {/* Mobile Card View */}
            <div className="lg:hidden">
              {sortedAndFilteredPayments.map((payment) => (
                <div
                  key={payment._id}
                  className="border-b border-gray-200 p-6 hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-blue-100 rounded-xl flex items-center justify-center mr-4">
                        <Receipt size={20} className="text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {payment.voucherNo}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {new Date(payment.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(payment)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => showDeleteConfirmation(payment)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Vendor:</span>
                      <span className="font-medium text-gray-900">
                        {payment.vendorName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        Payment Mode:
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPaymentModeBadge(
                          payment.paymentMode
                        )}`}
                      >
                        {getPaymentModeIcon(payment.paymentMode)}
                        <span className="ml-1">{payment.paymentMode}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Amount:</span>
                      <span className="font-semibold">
                        {formatCurrency(payment.amount, "text-gray-900")}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        Linked Invoices:
                      </span>
                      <span className="text-sm text-gray-600">
                        {payment.linkedInvoices?.length || 0} invoice(s)
                      </span>
                    </div>

                    {payment.attachedProof && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          Attachment:
                        </span>
                        <button
                          onClick={() =>
                            window.open(
                              `/api/files/${payment.attachedProof}`,
                              "_blank"
                            )
                          }
                          className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                        >
                          <Eye size={14} className="mr-1" />
                          View
                        </button>
                      </div>
                    )}

                    {payment.remarks && (
                      <div className="pt-2 border-t border-gray-100">
                        <span className="text-sm text-gray-500">Remarks:</span>
                        <p className="text-sm text-gray-700 mt-1">
                          {payment.remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-white/50 bg-opacity-50 flex items-center justify-center p-4 z-50 modal-container">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-95">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {editPaymentId
                      ? "Edit Payment Voucher"
                      : "Add Payment Voucher"}
                  </h2>
                  {isDraftSaved && lastSaveTime && (
                    <p className="text-sm text-gray-500 mt-1 flex items-center">
                      <Save size={14} className="mr-1" />
                      Draft saved {formatLastSaveTime(lastSaveTime)}
                    </p>
                  )}
                </div>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>
            </div>

            <form ref={formRef} className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vendor Selection */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Vendor *
                  </label>
                  <select
                    name="vendorId"
                    value={formData.vendorId}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.vendorId ? "border-red-500" : "border-gray-200"
                    }`}
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor._id} value={vendor._id}>
                        {vendor.vendorName}
                      </option>
                    ))}
                  </select>
                  {errors.vendorId && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle size={14} className="mr-1" />
                      {errors.vendorId}
                    </p>
                  )}
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.date ? "border-red-500" : "border-gray-200"
                    }`}
                  />
                  {errors.date && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle size={14} className="mr-1" />
                      {errors.date}
                    </p>
                  )}
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payment Mode *
                  </label>
                  <select
                    name="paymentMode"
                    value={formData.paymentMode}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.paymentMode ? "border-red-500" : "border-gray-200"
                    }`}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Online">Online</option>
                  </select>
                  {errors.paymentMode && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle size={14} className="mr-1" />
                      {errors.paymentMode}
                    </p>
                  )}
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Amount *
                  </label>
                  <div className="relative">
                    <img
                      src={DirhamIcon}
                      alt="AED"
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4"
                      style={{ filter: getColorFilter("text-gray-600") }}
                    />
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                        errors.amount ? "border-red-500" : "border-gray-200"
                      }`}
                    />
                  </div>
                  {errors.amount && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle size={14} className="mr-1" />
                      {errors.amount}
                    </p>
                  )}
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payment Proof
                  </label>
                  <div className="relative">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isFileUploading}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                      {isFileUploading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Uploading... {fileUploadProgress}%</span>
                        </>
                      ) : formData.attachedProof ? (
                        <>
                          <CheckCircle size={18} className="text-green-600" />
                          <span>File uploaded</span>
                        </>
                      ) : (
                        <>
                          <Upload size={18} />
                          <span>Upload proof</span>
                        </>
                      )}
                    </button>
                    {isFileUploading && (
                      <div
                        className="absolute bottom-0 left-0 h-1 bg-purple-600 rounded-b-xl transition-all duration-300"
                        style={{ width: `${fileUploadProgress}%` }}
                      ></div>
                    )}
                  </div>
                </div>

                {/* Linked Invoices */}
                {availableInvoices.length > 0 && (
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Link to Outstanding Invoices *
                    </label>
                    <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl p-4 bg-gray-50">
                      {availableInvoices.map((invoice) => (
                        <label
                          key={invoice._id}
                          className="flex items-center p-3 hover:bg-white rounded-lg cursor-pointer transition-colors duration-200"
                        >
                          <input
                            type="checkbox"
                            checked={formData.linkedInvoices.includes(
                              invoice._id
                            )}
                            onChange={() => handleInvoiceSelection(invoice._id)}
                            className="mr-3 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-900">
                                Invoice #{invoice.transactionId}
                              </span>
                              <span className="font-semibold">
                                {formatCurrency(
                                  invoice.totalAmount,
                                  "text-purple-700"
                                )}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              Date:{" "}
                              {new Date(invoice.date).toLocaleDateString()}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {errors.linkedInvoices && (
                      <p className="text-red-500 text-sm mt-1 flex items-center">
                        <AlertCircle size={14} className="mr-1" />
                        {errors.linkedInvoices}
                      </p>
                    )}
                  </div>
                )}

                {/* Remarks */}
                <div className="lg:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Remarks
                  </label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    placeholder="Additional notes or comments..."
                    rows="3"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span>
                        {editPaymentId ? "Update Payment" : "Create Payment"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.visible && (
        <div className="fixed inset-0 bg-white/50 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 transform transition-all duration-300 scale-95">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Payment Voucher
                </h3>
                <p className="text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              Are you sure you want to delete payment voucher{" "}
              <span className="font-semibold">
                {deleteConfirmation.voucherNo}
              </span>
              ? This will permanently remove the payment record from your
              system.
            </p>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={hideDeleteConfirmation}
                disabled={deleteConfirmation.isDeleting}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteConfirmation.isDeleting}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteConfirmation.isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete</span>
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

export default PaymentVoucherManagement;
