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
  Upload,
  Eye,
  File,
  Check,
  Minus,
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
    case "text-orange-700":
      return "invert(65%) sepia(50%) saturate(1000%) hue-rotate(10deg) brightness(100%) contrast(100%)";
    default:
      return "none";
  }
};

// In-memory session manager
const SessionManager = {
  storage: {},
  key: (k) => `purchase_accounts_session_${k}`,
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
      if (k.startsWith("purchase_accounts_session_")) delete SessionManager.storage[k];
    });
  },
};

// Safe array helper
const asArray = (x) => (Array.isArray(x) ? x : []);

// Normalize API responses
const takeArray = (resp) => {
  if (!resp) return [];
  const d = resp.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data.data ?? d.data;
  if (Array.isArray(d?.purchases)) return d.purchases;
  return [];
};

// Status display helpers
const displayStatus = (status) => {
  const s = (status || "").toString().toLowerCase();
  const statusMap = {
    paid: "Paid",
    unpaid: "Unpaid",
    "partially paid": "Partially Paid",
    partial: "Partially Paid",
    pending: "Unpaid",
  };
  return statusMap[s] || status || "Unpaid";
};

const badgeClassForStatus = (status) => {
  const s = displayStatus(status);
  const badges = {
    Paid: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    "Partially Paid": "bg-amber-100 text-amber-800 border border-amber-200",
    Unpaid: "bg-red-100 text-red-800 border border-red-200",
  };
  return badges[s] || "bg-slate-100 text-slate-800 border border-slate-200";
};

const iconForStatus = (status) => {
  const s = displayStatus(status);
  const map = {
    Paid: <Check size={14} className="text-emerald-600" />,
    "Partially Paid": <Minus size={14} className="text-amber-600" />,
    Unpaid: <X size={14} className="text-red-600" />,
  };
  return map[s] || <X size={14} className="text-slate-600" />;
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

/* ------------------------------ Main Component ------------------------------ */

const PurchaseAccounts = () => {
  const [purchases, setPurchases] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [availableInvoices, setAvailableInvoices] = useState([]); // Added for invoice selection
  console.log(availableInvoices)
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editPurchaseId, setEditPurchaseId] = useState(null);
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    date: new Date().toISOString().split("T")[0],
    vendorName: "",
    vendorId: "",
    linkedInvoices: [], // Added for invoice selection
    purchaseAmount: "",
    returnAmount: "0",
    taxAmount: "0",
    totalAmount: "",
    paidAmount: "0",
    balanceAmount: "",
    status: "Unpaid",
    remarks: "",
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
  const [filterStatus, setFilterStatus] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    purchaseId: null,
    invoiceNumber: "",
    isDeleting: false,
  });

  const formRef = useRef(null);
  const fileInputRef = useRef(null);
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
      setFilterStatus(savedFilters.status || "");
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
    SessionManager.set("filters", { status: filterStatus });
  }, [filterStatus]);

  useEffect(() => {
    return () => {
      if (previewUrl && selectedFile) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, selectedFile]);

  /* ------------------------------ Data Fetchers ------------------------------ */

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      2800
    );
  }, []);

  const fetchPurchases = useCallback(
    async (showRefreshIndicator = false) => {
      try {
        showRefreshIndicator ? setIsRefreshing(true) : setIsLoading(true);
        const response = await axiosInstance.get("/purchases/accounts", {
          params: { type: "purchase" },
        });
        const arr = takeArray(response);
        setPurchases(asArray(arr));
        if (showRefreshIndicator) showToastMessage("Data refreshed", "success");
      } catch (err) {
        console.error("Failed to fetch purchases:", err);
        showToastMessage(
          err.response?.data?.message || "Failed to fetch purchase accounts.",
          "error"
        );
        setPurchases([]);
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
      setVendors(asArray(takeArray(response)));
    } catch (err) {
      console.error("Failed to fetch vendors:", err);
      showToastMessage("Failed to fetch vendors.", "error");
      setVendors([]);
    }
  }, [showToastMessage]);

  // Added: Fetch outstanding invoices for invoice selection
 const fetchOutstandingInvoices = useCallback(
  async (vendorId = null) => {
    try {
      const params = new URLSearchParams();
      if (vendorId) params.append("partyId", vendorId);
      params.append("partyType", "vendor");
      params.append("status", "APPROVED");

      // ✅ support both purchase_order and purchase_return
      ["purchase_order", "purchase_return"].forEach((type) =>
        params.append("type", type)
      );

      const response = await axiosInstance.get(
        `/transactions/transactions?${params.toString()}`
      );

      const transactions = asArray(takeArray(response));
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
    fetchPurchases();
    fetchVendors();
  }, [fetchPurchases, fetchVendors]);

  /* ------------------------------ Handlers ------------------------------ */

  // Added: Handle invoice selection
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

        // Update purchase amount based on selected invoices
        const newPurchaseAmount = String(total);
        const returnAmt = Number(formData.returnAmount) || 0;
        const tax = Number(formData.taxAmount) || 0;
        const netAmount = total - returnAmt;
        const totalAmount = netAmount + tax;
        const paid = Number(formData.paidAmount) || 0;
        const balance = totalAmount - paid;
        const status = getStatusFromAmounts(totalAmount, paid);

        return { 
          ...prev, 
          linkedInvoices: newList, 
          purchaseAmount: newPurchaseAmount,
          totalAmount: String(totalAmount),
          balanceAmount: String(balance),
          status: status,
        };
      });
    },
    [availableInvoices, formData.returnAmount, formData.taxAmount, formData.paidAmount]
  );

  const calculateTotal = useCallback(() => {
    const purchase = Number(formData.purchaseAmount) || 0;
    const returnAmt = Number(formData.returnAmount) || 0;
    const tax = Number(formData.taxAmount) || 0;
    const netAmount = purchase - returnAmt;
    const total = netAmount + tax;
    const paid = Number(formData.paidAmount) || 0;
    const balance = total - paid;
    
    return { netAmount, total, balance, status: getStatusFromAmounts(total, paid) };
  }, [formData]);

  const getStatusFromAmounts = useCallback((total, paid) => {
    if (paid >= total) return "Paid";
    if (paid > 0) return "Partially Paid";
    return "Unpaid";
  }, []);

  const updateCalculatedFields = useCallback(() => {
    const { netAmount, total, balance, status } = calculateTotal();
    
    setFormData(prev => ({
      ...prev,
      totalAmount: String(total),
      balanceAmount: String(balance),
      status: status,
    }));
  }, [calculateTotal]);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));

      if (name === "vendorId") {
        const selected = vendors.find((v) => v._id === value);
        setFormData((prev) => ({
          ...prev,
          vendorName: selected?.vendorName || "",
          linkedInvoices: [], // Reset linked invoices when vendor changes
        }));
        fetchOutstandingInvoices(value);
      }

      // Auto-calculate fields for manual amount changes
      if (["purchaseAmount", "returnAmount", "taxAmount", "paidAmount"].includes(name)) {
        setTimeout(updateCalculatedFields, 0);
      }
    },
    [errors, vendors, updateCalculatedFields, fetchOutstandingInvoices]
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

  const validateForm = useCallback(() => {
    const e = {};
    if (!formData.vendorId) e.vendorId = "Vendor is required";
    if (!formData.date) e.date = "Date is required";
    if (!editPurchaseId && !formData.invoiceNumber) e.invoiceNumber = "Invoice number is required";
    if (!asArray(formData.linkedInvoices).length) e.linkedInvoices = "At least one invoice must be selected";
    if (!formData.purchaseAmount || Number(formData.purchaseAmount) <= 0)
      e.purchaseAmount = "Purchase amount must be greater than 0";
    return e;
  }, [formData, editPurchaseId]);

  const resetForm = useCallback(() => {
    setEditPurchaseId(null);
    setFormData({
      invoiceNumber: "",
      date: new Date().toISOString().split("T")[0],
      vendorName: "",
      vendorId: "",
      linkedInvoices: [], // Reset linked invoices
      purchaseAmount: "",
      returnAmount: "0",
      taxAmount: "0",
      totalAmount: "",
      paidAmount: "0",
      balanceAmount: "",
      status: "Unpaid",
      remarks: "",
    });
    setSelectedFile(null);
    setPreviewUrl(null);
    setExistingProof(null);
    setErrors({});
    setAvailableInvoices([]); // Reset available invoices
    setShowModal(false);
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
      const { totalAmount, balanceAmount, status } = calculateTotal();
      
      const payload = {
        invoiceNumber: formData.invoiceNumber,
        date: formData.date,
        vendorId: formData.vendorId,
        partyName: formData.vendorName,
        linkedInvoices: asArray(formData.linkedInvoices), // Include linked invoices
        purchaseAmount: Number(formData.purchaseAmount),
        returnAmount: Number(formData.returnAmount),
        taxAmount: Number(formData.taxAmount),
        totalAmount: totalAmount,
        paidAmount: Number(formData.paidAmount),
        balanceAmount: balanceAmount,
        status: status.toLowerCase(),
        narration: formData.remarks,
        type: "purchase",
        attachedProof: existingProof?._id || null,
      };

      const fd = new FormData();
      fd.append("data", JSON.stringify(payload));
      if (selectedFile) fd.append("attachedProof", selectedFile);

      if (editPurchaseId) {
        await axiosInstance.put(`/purchases/accounts/${editPurchaseId}`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        showToastMessage("Purchase account updated successfully!", "success");
      } else {
        await axiosInstance.post("/purchases/accounts", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        showToastMessage("Purchase account created successfully!", "success");
      }

      await fetchPurchases();
      resetForm();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to save purchase account.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    editPurchaseId,
    formData,
    existingProof,
    selectedFile,
    fetchPurchases,
    resetForm,
    showToastMessage,
    validateForm,
    calculateTotal,
  ]);

  const handleEdit = useCallback(
    (purchase) => {
      setEditPurchaseId(purchase._id);
      setFormData({
        invoiceNumber: purchase.invoiceNumber || "",
        date: new Date(purchase.date).toISOString().split("T")[0],
        vendorName: purchase.partyName || purchase.vendorName || "",
        vendorId: typeof purchase.partyId === "object" ? purchase.partyId?._id : purchase.partyId || purchase.vendorId || "",
        linkedInvoices: asArray(purchase.linkedInvoices || []), // Load linked invoices
        purchaseAmount: String(purchase.purchaseAmount || 0),
        returnAmount: String(purchase.returnAmount || 0),
        taxAmount: String(purchase.taxAmount || 0),
        totalAmount: String(purchase.totalAmount || 0),
        paidAmount: String(purchase.paidAmount || 0),
        balanceAmount: String(purchase.balanceAmount || 0),
        status: displayStatus(purchase.status),
        remarks: purchase.narration || purchase.remarks || "",
      });

      // Handle attachments
      const proof = asArray(purchase.attachments)[0] || null;
      setExistingProof(proof);
      setPreviewUrl(proof?.filePath || null);
      setSelectedFile(null);
      
      // Load available invoices for the vendor
      const vendorId = typeof purchase.partyId === "object" 
        ? purchase.partyId?._id 
        : purchase.partyId || purchase.vendorId;
      if (vendorId) {
        fetchOutstandingInvoices(vendorId);
      }
      
      setShowModal(true);
      SessionManager.remove("formData");
      SessionManager.remove("lastSaveTime");
    },
    [fetchOutstandingInvoices]
  );

  const showDeleteConfirmation = useCallback((purchase) => {
    setDeleteConfirmation({
      visible: true,
      purchaseId: purchase._id,
      invoiceNumber: purchase.invoiceNumber,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      purchaseId: null,
      invoiceNumber: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(`/purchases/accounts/${deleteConfirmation.purchaseId}`);
      setPurchases((prev) =>
        asArray(prev).filter((p) => p._id !== deleteConfirmation.purchaseId)
      );
      showToastMessage("Purchase account deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchPurchases();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to delete purchase account.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [
    deleteConfirmation.purchaseId,
    fetchPurchases,
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
        const firstInput = formRef.current.querySelector('input[name="invoiceNumber"]');
        if (firstInput) firstInput.focus();
      }
    }, 10);
  }, [resetForm]);

  const handleRefresh = useCallback(() => fetchPurchases(true), [fetchPurchases]);

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

  const safePurchases = useMemo(() => asArray(purchases), [purchases]);

  const purchaseStats = useMemo(() => {
    const totalPurchases = safePurchases.length;
    const totalAmount = safePurchases.reduce(
      (sum, p) => sum + (Number(p.totalAmount) || 0),
      0
    );
    const totalPaid = safePurchases.reduce(
      (sum, p) => sum + (Number(p.paidAmount) || 0),
      0
    );
    const totalBalance = safePurchases.reduce(
      (sum, p) => sum + (Number(p.balanceAmount) || 0),
      0
    );
    const todayStr = new Date().toDateString();
    const todayPurchases = safePurchases.filter(
      (p) => new Date(p.date).toDateString() === todayStr
    ).length;
    const avgAmount = totalPurchases ? totalAmount / totalPurchases : 0;

    const statusStats = safePurchases.reduce((acc, p) => {
      const status = displayStatus(p.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalPurchases,
      totalAmount,
      totalPaid,
      totalBalance,
      todayPurchases,
      avgAmount,
      statusStats,
    };
  }, [safePurchases]);

  const sortedAndFilteredPurchases = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let filtered = safePurchases.filter((p) => {
      const invoiceNo = p.invoiceNumber?.toLowerCase() || "";
      const vendorName = (p.partyName || p.vendorName || "").toLowerCase();
      const remarks = p.narration?.toLowerCase() || p.remarks?.toLowerCase() || "";
      const statusOk = filterStatus
        ? displayStatus(p.status) === filterStatus
        : true;
      return (
        (invoiceNo.includes(term) ||
          vendorName.includes(term) ||
          remarks.includes(term)) &&
        statusOk
      );
    });

    if (sortConfig.key) {
      const { key, direction } = sortConfig;
      filtered = [...filtered].sort((a, b) => {
        const av =
          key === "totalAmount" || key === "paidAmount" || key === "balanceAmount"
            ? Number(a[key])
            : key === "date"
            ? new Date(a.date).getTime()
            : by(a[key]);
        const bv =
          key === "totalAmount" || key === "paidAmount" || key === "balanceAmount"
            ? Number(b[key])
            : key === "date"
            ? new Date(b.date).getTime()
            : by(b[key]);

        if (av < bv) return direction === "asc" ? -1 : 1;
        if (av > bv) return direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [safePurchases, searchTerm, filterStatus, sortConfig]);

  /* ------------------------------ UI ------------------------------ */

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

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <File size={40} className="text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No purchase accounts found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm || filterStatus
          ? "No purchase accounts match your current filters. Try adjusting your search criteria."
          : "Start managing your purchases by creating your first purchase account."}
      </p>
      <button
        onClick={openAddModal}
        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
      >
        <Plus size={20} />
        Create First Purchase
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
              Purchase Accounts
            </h1>
            <p className="text-gray-600 mt-1">
              {purchaseStats.totalPurchases} total purchases •{" "}
              {sortedAndFilteredPurchases.length} displayed
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
              title: "Total Purchases",
              count: purchaseStats.totalPurchases,
              icon: <Receipt size={24} />,
              bgColor: "bg-emerald-50",
              textColor: "text-emerald-700",
              borderColor: "border-emerald-200",
              iconBg: "bg-emerald-100",
              iconColor: "text-emerald-600",
            },
            {
              title: "Today's Purchases",
              count: purchaseStats.todayPurchases,
              icon: <Calendar size={24} />,
              bgColor: "bg-blue-50",
              textColor: "text-blue-700",
              borderColor: "border-blue-200",
              iconBg: "bg-blue-100",
              iconColor: "text-blue-600",
            },
            {
              title: "Total Amount",
              count: formatCurrency(purchaseStats.totalAmount, "text-purple-700"),
              icon: <TrendingUp size={24} />,
              bgColor: "bg-purple-50",
              textColor: "text-purple-700",
              borderColor: "border-purple-200",
              iconBg: "bg-purple-100",
              iconColor: "text-purple-600",
            },
            {
              title: "Total Balance",
              count: formatCurrency(purchaseStats.totalBalance, "text-orange-700"),
              icon: <DollarSign size={24} />,
              bgColor: "bg-orange-50",
              textColor: "text-orange-700",
              borderColor: "border-orange-200",
              iconBg: "bg-orange-100",
              iconColor: "text-orange-600",
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
                {card.title.includes("Total Purchases")
                  ? "All time records"
                  : card.title.includes("Today")
                  ? "Current day activity"
                  : card.title.includes("Total Amount")
                  ? "Total purchase value"
                  : "Outstanding balance"}
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
                Purchase Accounts
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage purchase invoices and accounts payable
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} />
              Add Purchase
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
                placeholder="Search by invoice number, vendor, or remarks..."
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
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">All Statuses</option>
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Unpaid">Unpaid</option>
                </select>

                <button
                  onClick={() => {
                    setFilterStatus("");
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
        {sortedAndFilteredPurchases.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "invoiceNumber", label: "Invoice No" },
                    { key: "date", label: "Date" },
                    { key: "vendorName", label: "Vendor" },
                    { key: "linkedInvoices", label: "Linked Invoices" }, // Added column
                    { key: "purchaseAmount", label: "Purchase Amount" },
                    { key: "returnAmount", label: "Return Amount" },
                    { key: "taxAmount", label: "Tax Amount" },
                    { key: "totalAmount", label: "Total" },
                    { key: "paidAmount", label: "Paid Amount" },
                    { key: "balanceAmount", label: "Balance" },
                    { key: "status", label: "Status" },
                    { key: "remarks", label: "Remarks" },
                    { key: null, label: "Actions" },
                  ].map((col) => (
                    <th
                      key={col.key || "actions"}
                      className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                {sortedAndFilteredPurchases.map((p) => (
                  <tr
                    key={p._id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                  >
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {p.invoiceNumber}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {new Date(p.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                          <User size={16} className="text-purple-600" />
                        </div>
                        <div className="font-medium">
                          {p.partyName || p.vendorName || "-"}
                        </div>
                      </div>
                    </td>
                    {/* Added: Linked Invoices column */}
                    <td className="px-4 py-4 text-sm text-gray-600">
                      <div className="flex flex-wrap gap-1">
                        {asArray(p.linkedInvoices).map((invoiceId, idx) => {
                          const inv = availableInvoices.find(
                            (x) => x._id === invoiceId || x.invoiceId === invoiceId
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
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {formatCurrency(p.purchaseAmount)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {formatCurrency(-p.returnAmount, "text-orange-600")}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">
                      {formatCurrency(p.taxAmount, "text-blue-600")}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-gray-900">
                      {formatCurrency(p.totalAmount)}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-900">
                      {formatCurrency(p.paidAmount, "text-emerald-600")}
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold">
                      {formatCurrency(p.balanceAmount, p.balanceAmount > 0 ? "text-red-600" : "text-emerald-600")}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${badgeClassForStatus(
                          p.status
                        )}`}
                      >
                        {iconForStatus(p.status)}
                        <span className="ml-1">{displayStatus(p.status)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {p.narration || p.remarks || "-"}
                    </td>
                    <td className="px-4 py-4">
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
                          title="Edit purchase"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(p)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Delete purchase"
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
                Delete Purchase Account
              </h3>
              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                Invoice "{deleteConfirmation.invoiceNumber}"?
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editPurchaseId ? "Edit Purchase Account" : "Add Purchase Account"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {editPurchaseId
                      ? "Update purchase invoice information"
                      : "Create a new purchase account"}
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
                {editPurchaseId && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Receipt size={16} className="inline mr-2" /> Invoice No
                    </label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
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
                    <User size={16} className="inline mr-2" /> Vendor Name *
                  </label>
                  <select
                    name="vendorId"
                    value={formData.vendorId}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.vendorId
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.vendorName}
                      </option>
                    ))}
                  </select>
                  {errors.vendorId && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.vendorId}
                    </p>
                  )}
                </div>

                {/* Added: Linked Invoices Section */}
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
                                checked={asArray(
                                  formData.linkedInvoices
                                ).includes(inv._id)}
                                onChange={() => handleInvoiceSelection(inv._id)}
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

                {!editPurchaseId && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Receipt size={16} className="inline mr-2" /> Invoice Number
                    </label>
                    <input
                      type="text"
                      name="invoiceNumber"
                      value={formData.invoiceNumber}
                      onChange={handleChange}
                      placeholder="Enter invoice number (optional)"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <DollarSign size={16} className="inline mr-2" /> Purchase Amount *
                  </label>
                  <input
                    type="text"
                    value={formatCurrency(formData.purchaseAmount)}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500 font-medium"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Auto-calculated from selected invoices
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Minus size={16} className="inline mr-2 text-orange-600" /> Return Amount
                  </label>
                  <input
                    type="number"
                    name="returnAmount"
                    value={formData.returnAmount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <DollarSign size={16} className="inline mr-2 text-blue-600" /> Tax Amount
                  </label>
                  <input
                    type="number"
                    name="taxAmount"
                    value={formData.taxAmount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <TrendingUp size={16} className="inline mr-2" /> Total Amount
                  </label>
                  <input
                    type="text"
                    value={formatCurrency(formData.totalAmount, "text-gray-500")}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <CreditCard size={16} className="inline mr-2 text-emerald-600" /> Paid Amount
                  </label>
                  <input
                    type="number"
                    name="paidAmount"
                    value={formData.paidAmount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    max={Number(formData.totalAmount)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <DollarSign size={16} className="inline mr-2" /> Balance Amount
                  </label>
                  <input
                    type="text"
                    value={formatCurrency(formData.balanceAmount, formData.balanceAmount > 0 ? "text-red-500" : "text-emerald-500")}
                    disabled
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 font-medium"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <CheckCircle size={16} className="inline mr-2" /> Status
                  </label>
                  <input
                    type="text"
                    value={displayStatus(formData.status)}
                    disabled
                    className={`w-full px-4 py-3 border rounded-xl bg-gray-50 text-sm font-medium ${
                      formData.status === "Paid"
                        ? "text-emerald-600 border-emerald-200"
                        : formData.status === "Partially Paid"
                        ? "text-amber-600 border-amber-200"
                        : "text-red-600 border-red-200"
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FileText size={16} className="inline mr-2" /> Invoice Proof
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
                        <span>Upload invoice proof</span>
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
                    <FileText size={16} className="inline mr-2" /> Remarks
                  </label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter purchase details or notes (optional)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                  {formData.vendorId ||
                  asArray(formData.linkedInvoices).length > 0 ||
                  formData.remarks ||
                  selectedFile ||
                  (editPurchaseId && !existingProof) ? (
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
                    ) : editPurchaseId ? (
                      <>
                        <Save size={16} className="mr-2" /> Update Purchase
                      </>
                    ) : (
                      <>
                        <Plus size={16} className="mr-2" /> Add Purchase
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

export default PurchaseAccounts;