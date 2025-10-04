import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Link as LinkIcon,
  Loader2,
  Upload,
  Eye,
  Download,
  Printer,
} from "lucide-react";
import axiosInstance from "../../../axios/axios";
// import DirhamIcon from "../../assets/dirham.svg";
import VendorSelect from './PartySelect'

const FormInput = ({ label, icon: Icon, error, ...props }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      <Icon size={16} className="inline mr-2" /> {label} {props.required && "*"}
    </label>
    <input
      {...props}
      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${error ? "border-red-300 bg-red-50" : "border-gray-300"
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
      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${error ? "border-red-300 bg-red-50" : "border-gray-300"
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
      className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg text-white z-50 ${type === "success" ? "bg-emerald-500" : "bg-red-500"
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

const SessionManager = {
  storage: {},
  key: (k) => `payment_voucher_${k}`,
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
    } catch { }
  },
  remove(key) {
    try {
      delete SessionManager.storage[SessionManager.key(key)];
    } catch { }
  },
  clear() {
    Object.keys(SessionManager.storage).forEach((k) => {
      if (k.startsWith("payment_voucher_")) delete SessionManager.storage[k];
    });
  },
};

const asArray = (x) => (Array.isArray(x) ? x : []);

const takeArray = (resp) => {
  if (!resp) return [];
  const d = resp.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data.data ?? d.data;
  if (Array.isArray(d?.vouchers)) return d.vouchers;
  return [];
};

const displayMode = (mode) => {
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
      {isNegative && "-"}<span className="mr-1">AED</span>{absAmount}
    </span>
  );
}

const by = (v) => (typeof v === "string" ? v.toLowerCase() : v);

const isImage = (fileOrFilename) => {
  if (fileOrFilename instanceof File) {
    return fileOrFilename.type.startsWith("image/");
  }
  if (typeof fileOrFilename === "string") {
    const ext = fileOrFilename.split(".").pop()?.toLowerCase() || "";
    return ["jpg", "jpeg", "png"].includes(ext);
  }
  return false;
};

const getFileName = (fileOrFilename) => {
  if (fileOrFilename instanceof File) return fileOrFilename.name;
  return fileOrFilename || "Unknown file";
};

const getFileSize = (file) => {
  if (file instanceof File) {
    return (file.size / 1024).toFixed(2) + " KB";
  }
  if (file?.fileSize) {
    return (file.fileSize / 1024).toFixed(2) + " KB";
  }
  return "";
};

const PaymentVoucherManagement = () => {
  const [payments, setPayments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [availableInvoices, setAvailableInvoices] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(
    SessionManager.get("searchTerm") || ""
  );
  const [editPaymentId, setEditPaymentId] = useState(null);
  const [formData, setFormData] = useState({
    voucherNo: "",
    date: new Date().toISOString().split("T")[0],
    vendorName: "",
    vendorId: "",
    linkedInvoices: [],
    paymentMode: "Cash",
    amount: "",
    narration: "",
    bankDetails: { accountNumber: "", accountName: "" },
    chequeDetails: { chequeNumber: "", chequeDate: "" },
    onlineDetails: { transactionId: "", transactionDate: "" },
    attachedProof: null,
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [existingProof, setExistingProof] = useState(null);
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
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    paymentId: null,
    voucherNo: "",
    isDeleting: false,
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const formRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const savedFormData = SessionManager.get("formData");
    if (savedFormData && typeof savedFormData === "object") {
      setFormData((prev) => ({ ...prev, ...savedFormData }));
    }
    fetchPayments();
    fetchVendors();
    fetchOutstandingInvoices();
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

  useEffect(() => {
    return () => {
      if (previewUrl && selectedFile) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, selectedFile]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      2800
    );
  }, []);

  const fetchPayments = useCallback(
    async (showRefreshIndicator = false) => {
      try {
        showRefreshIndicator ? setIsRefreshing(true) : setIsLoading(true);
        const response = await axiosInstance.get("/vouchers/vouchers", {
          params: { voucherType: "payment" },
        });
        console.log(response)
        setPayments(takeArray(response));
        if (showRefreshIndicator) showToastMessage("Data refreshed", "success");
      } catch (err) {
        showToastMessage(
          err.response?.data?.message || "Failed to fetch payment vouchers.",
          "error"
        );
        setPayments([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showToastMessage]
  );

  const fetchVendors = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/vendors/vendors");
      setVendors(takeArray(response));
    } catch (err) {
      showToastMessage("Failed to fetch vendors.", "error");
      setVendors([]);
    }
  }, [showToastMessage]);

  const fetchOutstandingInvoices = useCallback(
    async (vendorId = null) => {
      try {
        const params = new URLSearchParams();
        if (vendorId) params.append("partyId", vendorId);
        params.append("partyType", "Vendor");
        params.append("type", "purchase_order");
        params.append("status", "APPROVED");
        const response = await axiosInstance.get(
          `/transactions/transactions?${params.toString()}`
        );
        console.log(response)
        const invoices = takeArray(response).filter(
          (t) =>
            t?.invoiceGenerated === false && t._id && t.transactionNo && t.totalAmount
        );
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
      if (name === "vendorId") {
        const selected = vendors.find((v) => v._id === value);
        setFormData((prev) => ({
          ...prev,
          vendorName: selected?.vendorName || "",
          linkedInvoices: [],
          amount: "",
        }));
        fetchOutstandingInvoices(value);
      }
    },
    [vendors, fetchOutstandingInvoices]
  );

  const handleFileSelect = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (!file) return;

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

      if (file.size > 5 * 1024 * 1024) {
        showToastMessage("File size should be less than 5MB.", "error");
        return;
      }

      if (previewUrl && selectedFile) {
        URL.revokeObjectURL(previewUrl);
      }

      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setExistingProof(null);
    },
    [previewUrl, selectedFile, showToastMessage]
  );

  const handleRemoveFile = useCallback(() => {
    if (previewUrl && selectedFile) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setExistingProof(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [previewUrl, selectedFile]);

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
    if (!formData.vendorId) e.vendorId = "Vendor is required";
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
    setEditPaymentId(null);
    setFormData({
      voucherNo: "",
      date: new Date().toISOString().split("T")[0],
      vendorName: "",
      vendorId: "",
      linkedInvoices: [],
      paymentMode: "Cash",
      amount: "",
      narration: "",
      bankDetails: { accountNumber: "", accountName: "" },
      chequeDetails: { chequeNumber: "", chequeDate: "" },
      onlineDetails: { transactionId: "", transactionDate: "" },
      attachedProof: null,
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setExistingProof(null);
    setErrors({});
    setShowModal(false);
    setAvailableInvoices([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        vendorId: formData.vendorId,
        vendorName: formData.vendorName,
        linkedInvoices: formData.linkedInvoices.map((inv) => ({
          invoiceId: inv.invoiceId,
          amount: Number(inv.amount),
          balance: Number(inv.balance),
        })),
        paymentMode: formData.paymentMode.toLowerCase(),
        totalAmount: Number(formData.amount),
        narration: formData.narration,
        voucherType: "payment",
        paymentDetails: {
          bankDetails:
            formData.paymentMode === "Bank" ? formData.bankDetails : null,
          chequeDetails:
            formData.paymentMode === "Cheque" ? formData.chequeDetails : null,
          onlineDetails:
            formData.paymentMode === "Online" ? formData.onlineDetails : null,
        },
        attachedProof: existingProof?._id || null,
      };
      const fd = new FormData();
      fd.append("data", JSON.stringify(payload));
      if (selectedFile) fd.append("attachedProof", selectedFile);

      if (editPaymentId) {
        await axiosInstance.put(`/vouchers/vouchers/${editPaymentId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        showToastMessage("Payment voucher updated successfully!", "success");
      } else {
        await axiosInstance.post("/vouchers/vouchers", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        showToastMessage("Payment voucher created successfully!", "success");
      }
      await fetchPayments();
      resetForm();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to save payment voucher.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    editPaymentId,
    formData,
    existingProof,
    selectedFile,
    fetchPayments,
    resetForm,
    showToastMessage,
    validateForm,
  ]);

  const handleEdit = useCallback(
    (payment) => {
      setEditPaymentId(payment._id);
      const linkedInvoices = asArray(payment.linkedInvoices).map((inv) => ({
        invoiceId:
          typeof inv === "object" ? inv.invoiceId?._id || inv.invoiceId : inv,
        amount: String(inv.amount || payment.totalAmount || 0),
        balance: String(
          inv.balance ||
          ((typeof inv.invoiceId === "object"
            ? inv.invoiceId?.totalAmount
            : payment.totalAmount) || 0) - (inv.amount || 0)
        ),
      }));
      const paymentDetails = payment.paymentDetails || {};
      setFormData({
        voucherNo: payment.voucherNo || "",
        date: payment.date
          ? new Date(payment.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        vendorName:
          payment.partyName ||
          payment.vendorName ||
          (typeof payment.partyId === "object"
            ? payment.partyId?.vendorName
            : "") ||
          "",
        vendorId:
          typeof payment.partyId === "object"
            ? payment.partyId?._id
            : payment.partyId || payment.vendorId || "",
        linkedInvoices,
        paymentMode: displayMode(payment.paymentMode) || "Cash",
        amount: String(payment.totalAmount || payment.amount || 0),
        narration: payment.narration || payment.remarks || "",
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
        attachedProof: null,
      });
      const proof = asArray(payment.attachments)[0] || null;
      setExistingProof(proof);
      setPreviewUrl(proof?.filePath || null);
      setSelectedFile(null);
      setShowModal(true);
      const vendorId =
        typeof payment.partyId === "object"
          ? payment.partyId?._id
          : payment.partyId || payment.vendorId;
      if (vendorId) fetchOutstandingInvoices(vendorId);
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
        `/vouchers/vouchers/${deleteConfirmation.paymentId}`
      );
      setPayments((prev) =>
        asArray(prev).filter((p) => p._id !== deleteConfirmation.paymentId)
      );
      showToastMessage("Payment voucher deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchPayments();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to delete payment voucher.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [
    deleteConfirmation.paymentId,
    fetchPayments,
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
        formRef.current.querySelector('select[name="vendorId"]')?.focus();
    }, 10);
  }, [resetForm]);

  const handleRefresh = useCallback(() => fetchPayments(true), [fetchPayments]);

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

  const handleViewPayment = useCallback((payment) => {
    setSelectedPayment(payment);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedPayment(null);
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    try {
      setIsGeneratingPDF(true);
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const input = document.getElementById("payment-content");
      if (!input) {
        showToastMessage("Payment content not found!", "error");
        return;
      }

      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: input.scrollWidth,
        height: input.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById("payment-content");
          if (clonedElement) {
            clonedElement.style.display = 'block';
            clonedElement.style.visibility = 'visible';
          }
        }
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / (imgWidth * 0.264583), pdfHeight / (imgHeight * 0.264583));

      const imgX = (pdfWidth - (imgWidth * 0.264583 * ratio)) / 2;
      const imgY = 0;

      pdf.addImage(
        imgData,
        'PNG',
        imgX,
        imgY,
        imgWidth * 0.264583 * ratio,
        imgHeight * 0.264583 * ratio,
        undefined,
        'FAST'
      );

      const filename = `Payment_${selectedPayment.voucherNo}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error('Error generating PDF:', error);
      showToastMessage("Failed to generate PDF. Please try again or use the Print option.", "error");
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [selectedPayment, showToastMessage]);

  const handlePrintPDF = useCallback(() => {
    const printWindow = window.open('', '_blank');
    const paymentContent = document.getElementById("payment-content");

    if (!paymentContent || !printWindow) {
      showToastMessage("Unable to open print dialog", "error");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment_${selectedPayment.voucherNo}</title>
          <style>
            * { box-sizing: border-box; }
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
              line-height: 1.4;
              color: #000;
            }
            @media print { 
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
            table { border-collapse: collapse; width: 100%; }
            th, td { padding: 8px; text-align: left; border: 1px solid #000; }
          </style>
        </head>
        <body>
          ${paymentContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }, [selectedPayment, showToastMessage]);

  const safePayments = useMemo(() => asArray(payments), [payments]);

  const paymentStats = useMemo(() => {
    const totalPayments = safePayments.length;
    const totalAmount = safePayments.reduce(
      (sum, p) => sum + (Number(p.totalAmount ?? p.amount) || 0),
      0
    );
    const todayPayments = safePayments.filter(
      (p) => new Date(p.date).toDateString() === new Date().toDateString()
    ).length;
    const avgAmount = totalPayments ? totalAmount / totalPayments : 0;
    return { totalPayments, totalAmount, todayPayments, avgAmount };
  }, [safePayments]);

  const sortedAndFilteredPayments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let filtered = safePayments.filter((p) => {
      const voucherNo = p.voucherNo?.toLowerCase() || "";
      const vendorName = (p.partyName || p.vendorName || "").toLowerCase();
      const narration = p.narration?.toLowerCase() || "";
      const modeOk = filterPaymentMode
        ? displayMode(p.paymentMode) === filterPaymentMode
        : true;
      return (
        (voucherNo.includes(term) ||
          vendorName.includes(term) ||
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
  }, [safePayments, searchTerm, filterPaymentMode, sortConfig]);

  if (selectedPayment) {
    const vendor = vendors.find(
      (v) => v._id === (typeof selectedPayment.partyId === "object" ? selectedPayment.partyId._id : selectedPayment.partyId)
    );
    const totals = asArray(selectedPayment.linkedInvoices).reduce(
      (acc, inv) => ({
        total: acc.total + (Number(inv.amount) || 0),
      }),
      { total: 0 }
    );

    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBackToList}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to List</span>
            </button>
            <div className="flex space-x-3">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingPDF ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>{isGeneratingPDF ? 'Generating...' : 'Download PDF'}</span>
              </button>
              <button
                onClick={handlePrintPDF}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print PDF</span>
              </button>
            </div>
          </div>
          <div
            id="payment-content"
            className="bg-white shadow-lg"
            style={{
              width: '210mm',
              minHeight: '297mm',
              margin: '0 auto',
              padding: '20mm',
              fontSize: '12px',
              lineHeight: '1.4',
              fontFamily: 'Arial, sans-serif',
              color: '#000'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #8B5CF6', paddingBottom: '15px' }}>
              <h1 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 5px 0', direction: 'rtl' }}>
                نجم لتجارة المواد الغذائية ذ.م.م ش.ش.و
              </h1>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 15px 0', color: '#0f766e' }}>
                NH FOODSTUFF TRADING LLC S.O.C.
              </h2>
              <div style={{ backgroundColor: '#c8a2c8', color: 'white', padding: '8px', margin: '0 -20mm 20px -20mm' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0' }}>PAYMENT VOUCHER</h3>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '10px' }}>
              <div>
                <p style={{ margin: '2px 0' }}>Dubai, UAE</p>
                <p style={{ margin: '2px 0' }}>VAT Reg. No: 10503303</p>
                <p style={{ margin: '2px 0' }}>Email: finance@nhfo.com</p>
                <p style={{ margin: '2px 0' }}>Phone: +971 58 724 2111</p>
                <p style={{ margin: '2px 0' }}>Web: www.nhfo.com</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <img
                  src="https://res.cloudinary.com/dmkdrwpfp/image/upload/v1755452581/erp_Uploads/NH%20foods_1755452579855.jpg"
                  alt="NH Foods Logo"
                  style={{ width: '80px', height: '80px', objectFit: 'contain' }}
                />
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: '2px 0' }}>Date: {new Date(selectedPayment.date).toLocaleDateString("en-GB")}</p>
                <p style={{ margin: '2px 0' }}>Voucher No: {selectedPayment.voucherNo}</p>
                <p style={{ margin: '2px 0' }}>Payment Mode: {displayMode(selectedPayment.paymentMode)}</p>
              </div>
            </div>
            <div style={{ backgroundColor: '#e6d7e6', padding: '10px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '5px' }}>Paid To:</div>
                  <div style={{ fontSize: '10px' }}>
                    <p style={{ margin: '2px 0', fontWeight: 'bold' }}>{selectedPayment.partyName || selectedPayment.vendorName}</p>
                    <p style={{ margin: '2px 0' }}>{vendor?.address?.split("\n")[0] || ''}</p>
                    <p style={{ margin: '2px 0' }}>{vendor?.address?.split("\n")[1] || ''}</p>
                    <p style={{ margin: '2px 0' }}>Tel: {vendor?.phone || '-'}</p>
                  </div>
                </div>
                <div style={{ fontSize: '10px' }}>
                  <p style={{ margin: '2px 0' }}>VAT Reg. No:</p>
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>{vendor?.vatNumber || '-'}</p>
                </div>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '10px' }}>
              <thead>
                <tr style={{ backgroundColor: '#e6d7e6' }}>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Invoice No</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Description</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Amount</th>
                  <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {asArray(selectedPayment.linkedInvoices).map((inv, index) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>
                      {inv.invoiceId?.transactionNo || inv.transactionNo || inv.invoiceId || "N/A"}
                    </td>
                    <td style={{ border: '1px solid #000', padding: '6px' }}>{selectedPayment.narration || "-"}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{Number(inv.amount).toFixed(2)}</td>
                    <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{Number(inv.balance).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ width: '45%' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>BANK DETAILS:-</div>
                <div style={{ fontSize: '10px', lineHeight: '1.5' }}>
                  <p style={{ margin: '2px 0' }}><strong>BANK:</strong> NATIONAL BANK OF ABUDHABI</p>
                  <p style={{ margin: '2px 0' }}><strong>ACCOUNT NO:</strong> 087989283001</p>
                </div>
              </div>
              <div style={{ width: '40%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <tr>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Total</td>
                    <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{totals.total.toFixed(2)}</td>
                  </tr>
                </table>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', lineHeight: '1.5' }}>
                <p style={{ margin: '2px 0' }}><strong>IBAN NO:</strong> AE410547283001</p>
                <p style={{ margin: '2px 0' }}><strong>CURRENCY:</strong> AED</p>
                <p style={{ margin: '2px 0' }}><strong>ACCOUNT NAME:</strong> NH FOODSTUFF TRADING LLC S.O.C</p>
              </div>
              <div style={{ border: '2px solid #000', padding: '10px 20px', backgroundColor: '#f9f9f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>GRAND TOTAL</span>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '30px' }}>
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <p style={{ fontSize: '11px', margin: '0' }}>Payment issued in good order.</p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '20px' }}>
                <div style={{ fontSize: '11px', width: '45%' }}>
                  <p style={{ margin: '0 0 30px 0' }}>Received by:</p>
                  <div style={{ borderBottom: '1px solid #000', marginBottom: '5px' }}></div>
                </div>
                <div style={{ fontSize: '11px', width: '45%', textAlign: 'right' }}>
                  <p style={{ margin: '0 0 30px 0' }}>Prepared by:</p>
                  <div style={{ borderBottom: '1px solid #000', marginBottom: '5px' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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
          <p className="text-gray-600 text-lg">Loading payment vouchers...</p>
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
        No payment vouchers found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm || filterPaymentMode
          ? "No payment vouchers match your current filters. Try adjusting your search criteria."
          : "Start recording payments by creating your first payment voucher."}
      </p>
      <button
        onClick={openAddModal}
        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
      >
        <Plus size={20} /> Create First Payment
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
            <h1 className="text-3xl font-bold text-black">Payment Voucher</h1>
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
            onClick={() => setShowFilters((v) => !v)}
            className={`p-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${showFilters
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
            title="Total Payments"
            count={paymentStats.totalPayments}
            icon={<Receipt size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText="All time records"
          />
          <StatCard
            title="Today's Payments"
            count={paymentStats.todayPayments}
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
            count={formatCurrency(paymentStats.totalAmount, "text-purple-700")}
            icon={<TrendingUp size={24} />}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
            borderColor="border-purple-200"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            subText="All disbursed payments"
          />
          <StatCard
            title="Avg Payment Value"
            count={formatCurrency(paymentStats.avgAmount, "text-indigo-700")}
            icon={<Banknote size={24} />}
            bgColor="bg-indigo-50"
            textColor="text-indigo-700"
            borderColor="border-indigo-200"
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
            subText="Per payment average"
          />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Payment Vouchers
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage payment vouchers and transactions
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} /> Add Payment
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
                placeholder="Search by voucher number, vendor, or narration..."
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
                  icon={CreditCard}
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
        {sortedAndFilteredPayments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "voucherNo", label: "Voucher No" },
                    { key: "date", label: "Date" },
                    { key: "vendorName", label: "Vendor" },
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
                {sortedAndFilteredPayments.map((p) => (
                  <tr
                    key={p._id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <button
                        onClick={() => handleViewPayment(p)}
                        className="text-blue-600 hover:underline"
                      >
                        {p.voucherNo}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(p.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                          <User size={16} className="text-purple-600" />
                        </div>
                        <div className="font-medium">
                          {p.partyName || p.vendorName || "-"}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {asArray(p.linkedInvoices).map((inv, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium flex items-center"
                          >
                            <LinkIcon size={10} className="mr-1" />
                            {inv.invoiceId?.transactionNo ||
                              inv.transactionNo ||
                              inv.invoiceId ||
                              "N/A"}
                            {inv.amount && (
                              <span className="ml-1">
                                ({formatCurrency(inv.amount)})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {iconForMode(p.paymentMode)}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${badgeClassForMode(
                            p.paymentMode
                          )}`}
                        >
                          {displayMode(p.paymentMode)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {formatCurrency(p.totalAmount ?? p.amount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {p.narration || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {asArray(p.attachments).length > 0 && (
                          <button
                            onClick={() =>
                              window.open(
                                asArray(p.attachments)[0].filePath,
                                "_blank"
                              )
                            }
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                            title="View attachment"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          title="Edit payment"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(p)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
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
                Delete Payment Voucher
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
                  {editPaymentId
                    ? "Edit Payment Voucher"
                    : "Add Payment Voucher"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {editPaymentId
                      ? "Update payment voucher information"
                      : "Create a new payment voucher"}
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
                {editPaymentId && (
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
                <VendorSelect
                  vendor={vendors}
                  value={formData.vendorId}
                  onChange={handleChange}
                  error={errors.vendorId}
                />
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <LinkIcon size={16} className="inline mr-2" /> Linked Invoice(s) *
                  </label>
                  <div
                    className={`border rounded-xl p-4 max-h-48 overflow-y-auto ${errors.linkedInvoices
                      ? "border-red-300 bg-red-50"
                      : "border-gray-300"
                      }`}
                  >
                    {availableInvoices.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">
                        {formData.vendorId
                          ? "No outstanding invoices found for selected vendor"
                          : "Please select a vendor first to view outstanding invoices"}
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
                                checked={asArray(formData.linkedInvoices).some(
                                  (i) => i.invoiceId === inv._id
                                )}
                                onChange={() => handleInvoiceSelection(inv._id, inv.totalAmount)}
                                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                              />
                              <div>
                                <p className="font-medium text-sm text-gray-900">
                                  {inv.transactionNo || inv.transactionId}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {new Date(inv.date).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-3">
                              <input
                                type="number"
                                value={
                                  asArray(formData.linkedInvoices).find(
                                    (i) => i.invoiceId === inv._id
                                  )?.amount || ""
                                }
                                onChange={(e) =>
                                  handleInvoiceAmountChange(inv._id, e.target.value)
                                }
                                placeholder="Amount"
                                min="0"
                                step="0.01"
                                className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm"
                                disabled={
                                  !asArray(formData.linkedInvoices).some(
                                    (i) => i.invoiceId === inv._id
                                  )
                                }
                              />
                              <p className="font-medium text-sm text-gray-900">
                                {formatCurrency(
                                  asArray(formData.linkedInvoices).find(
                                    (i) => i.invoiceId === inv._id
                                  )?.balance || inv.totalAmount
                                )}
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FileText size={16} className="inline mr-2" /> Payment Proof
                  </label>
                  {!previewUrl ? (
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
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center justify-center space-x-2"
                      >
                        <Upload size={18} />
                        <span>Upload proof</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {isImage(selectedFile || existingProof?.fileName) ? (
                            <img
                              src={previewUrl}
                              alt="Proof preview"
                              className="w-12 h-12 object-cover rounded-md border border-gray-200"
                            />
                          ) : (
                            <FileText size={32} className="text-blue-600" />
                          )}
                          <div>
                            <p className="font-medium text-sm text-gray-900">
                              {getFileName(selectedFile || existingProof?.fileName)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {getFileSize(selectedFile || existingProof)}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => window.open(previewUrl, "_blank")}
                            className="p-1 text-blue-600 hover:text-blue-800"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="p-1 text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
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
                    placeholder="Enter any additional details or notes..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-y min-h-[100px]"
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
                      {editPaymentId ? "Update Payment" : "Save Payment"}
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

export default PaymentVoucherManagement;