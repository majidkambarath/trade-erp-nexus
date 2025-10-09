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
  X,
  TrendingUp,
  Calendar,
  DollarSign,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  AlertCircle,
  Receipt,
  Loader2,
  Sparkles,
  FileText,
  ChevronDown,
  Eye,
  Download,
  BarChart3,
  Clock,
} from "lucide-react";
import DirhamIcon from "../../../assets/dirham.svg";
import axiosInstance from "../../../axios/axios";
import JournalVoucherView from "./JournalVoucherView";

const FormInput = ({
  label,
  icon: Icon,
  error,
  readOnly,
  hint,
  isTextarea = false,
  ...props
}) => (
  <div className="group relative">
    <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
      <Icon size={16} className="inline mr-2 text-purple-500" /> {label}{" "}
      {props.required && <span className="text-red-500">*</span>}
    </label>
    {isTextarea ? (
      <textarea
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
    ) : (
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
    )}
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
  trend,
}) => (
  <div
    className={`${bgColor} ${borderColor} rounded-2xl p-6 border-2 transition-all duration-300 hover:shadow-xl cursor-pointer hover:scale-105 hover:-translate-y-1`}
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 ${iconBg} rounded-xl shadow-md`}>
        <div className={iconColor}>{icon}</div>
      </div>
      {trend && (
        <div
          className={`text-xs ${textColor} hover:opacity-80 transition-opacity font-semibold flex items-center`}
        >
          <TrendingUp size={12} className="mr-1" /> {trend}
        </div>
      )}
    </div>
    <h3
      className={`text-sm font-semibold ${textColor} mb-2 uppercase tracking-wide`}
    >
      {title}
    </h3>
    <p className="text-3xl font-bold text-gray-900 mb-1">{count}</p>
    <p className="text-xs text-gray-600 font-medium">{subText}</p>
  </div>
);

const SelectDropdown = ({
  label,
  value,
  onChange,
  options,
  error,
  hint,
  icon: Icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="group relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
        {Icon && <Icon size={16} className="inline mr-2 text-purple-500" />}
        {label} <span className="text-red-500">*</span>
      </label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 border rounded-xl cursor-pointer transition-all duration-200 flex items-center justify-between ${
          error
            ? "border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500"
            : "border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-purple-500"
        }`}
      >
        <span className={selectedOption ? "text-gray-900" : "text-gray-400"}>
          {selectedOption
            ? selectedOption.label
            : `Select ${label.toLowerCase()}...`}
        </span>
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className="px-4 py-3 hover:bg-purple-50 cursor-pointer transition-colors duration-150 text-gray-900"
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
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
};

const formatCurrency = (amount, colorClass = "text-gray-900") => {
  const numAmount = Number(amount) || 0;
  const absAmount = Math.abs(numAmount).toFixed(2);
  const isNegative = numAmount < 0;
  return (
    <span className={`inline-flex items-center font-semibold ${colorClass}`}>
      {isNegative && <span className="text-red-600">-</span>}
      <img src={DirhamIcon} alt="AED" className="w-5 h-5 mr-1" />
      {absAmount.toLocaleString()}
    </span>
  );
};

const formatCurrencyText = (amount) => {
  const numAmount = Number(amount) || 0;
  const absAmount = Math.abs(numAmount).toFixed(2).toLocaleString();
  const isNegative = numAmount < 0;
  return `${isNegative ? "-" : ""}AED ${absAmount}`;
};

const badgeClassForStatus = (status) => {
  const badges = {
    Approved:
      "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border border-emerald-300",
    Pending:
      "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300",
    Rejected:
      "bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-300",
  };
  return badges[status] || "bg-gray-100 text-gray-800 border border-gray-300";
};

const asArray = (x) => (Array.isArray(x) ? x : []);

const takeArray = (resp) => {
  if (!resp) return [];
  const d = resp.data;
  let vouchers = Array.isArray(d)
    ? d
    : Array.isArray(d?.data)
    ? d.data.data ?? d.data
    : Array.isArray(d?.vouchers)
    ? d.vouchers
    : [];
  return vouchers;
};

const JournalVoucherManagement = () => {
  const [transactors, setTransactors] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  console.log(vouchers);
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 10,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    debitAccount: "",
    creditAccount: "",
    amount: "",
    narration: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    fetchTransactors();
    fetchVouchers();
  }, [pagination.current, searchTerm, sortConfig]);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.classList.add("scale-100", "opacity-100");
        }
      }, 10);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showModal]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  }, []);

  const fetchTransactors = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axiosInstance.get("/account-v2/Transactor");
      setTransactors(
        res.data.data.map((t) => ({
          _id: t._id,
          accountCode: t.accountCode,
          accountName: t.accountName,
          type: t.type || "Transactor",
          openingBalance: t.openingBalance || 0,
          currentBalance: t.currentBalance || 0,
          accountType: t.accountType,
          status: t.status,
          isTransactor: true,
        }))
      );
    } catch (err) {
      showToastMessage("Failed to fetch transactors.", "error");
      setTransactors([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToastMessage]);

  const fetchVouchers = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = {
        voucherType: "journal",
        search: searchTerm,
        page: pagination.current,
        limit: pagination.limit,
        sort: sortConfig.key
          ? `${sortConfig.key}:${sortConfig.direction}`
          : "createdAt:desc",
      };
      const response = await axiosInstance.get("/vouchers/vouchers", {
        params,
      });
      setVouchers(response.data.data);
      setPagination({
        current: response.data.pagination.current,
        pages: response.data.pagination.pages,
        total: response.data.pagination.total,
        limit: response.data.pagination.limit,
      });
    } catch (error) {
      showToastMessage("Failed to fetch vouchers", "error");
      console.error("Error fetching vouchers:", error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.current, searchTerm, sortConfig, showToastMessage]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const handleSelectChange = useCallback((value, name) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const validateForm = useCallback(() => {
    const e = {};
    if (!formData.debitAccount) e.debitAccount = "Debit account is required";
    if (!formData.creditAccount) e.creditAccount = "Credit account is required";
    if (formData.debitAccount === formData.creditAccount)
      e.creditAccount = "Credit account must be different from debit account";
    if (!formData.amount || Number(formData.amount) <= 0)
      e.amount = "Amount must be greater than 0";
    if (!formData.narration) e.narration = "Narration is required";
    if (!formData.date) e.date = "Date is required";
    return e;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData({
      debitAccount: "",
      creditAccount: "",
      amount: "",
      narration: "",
      date: new Date().toISOString().split("T")[0],
    });
    setErrors({});
    setShowModal(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    const e = validateForm();
    if (Object.keys(e).length) {
      setErrors(e);
      showToastMessage("Please fill all required fields correctly", "error");
      return;
    }
    setIsSubmitting(true);

    try {
      const debitAccount = transactors.find(
        (acc) => acc._id === formData.debitAccount
      );
      const creditAccount = transactors.find(
        (acc) => acc._id === formData.creditAccount
      );

      const payload = {
        voucherType: "journal",
        date: formData.date,
        totalAmount: Number(formData.amount),
        narration: formData.narration,
        debitAccount: debitAccount?.accountCode || "",
        creditAccount: creditAccount?.accountCode || "",
      };

      const response = await axiosInstance.post("/vouchers/vouchers", payload);
      setVouchers((prev) => [response.data.data, ...prev]);
      showToastMessage("Journal voucher created successfully!", "success");
      resetForm();
      fetchTransactors()
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to create voucher",
        "error"
      );
      console.error("Error creating voucher:", error);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, transactors, resetForm, showToastMessage, validateForm]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchVouchers().then(() => {
      setIsRefreshing(false);
      showToastMessage("Data refreshed successfully", "success");
    });
  }, [fetchVouchers, showToastMessage]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handlePageChange = useCallback((newPage) => {
    setPagination((prev) => ({ ...prev, current: newPage }));
  }, []);

  const handleViewVoucher = useCallback((voucher) => {
    setSelectedVoucher(voucher);
  }, []);

  const filteredVouchers = useMemo(() => {
    return vouchers.map((v) => {
      // Find debit and credit entries from the entries array
      const debitEntry = v.entries?.find((entry) => entry.debitAmount > 0);
      const creditEntry = v.entries?.find((entry) => entry.creditAmount > 0);
      
      return {
        ...v,
        debitAccountName: debitEntry?.accountName || "Unknown",
        creditAccountName: creditEntry?.accountName || "Unknown",
      };
    });
  }, [vouchers]);

  const stats = useMemo(() => {
    const totalVouchers = filteredVouchers.length;
    const totalAmount = filteredVouchers.reduce(
      (sum, v) => sum + Number(v.totalAmount),
      0
    );
    const approvedCount = filteredVouchers.filter(
      (v) => v.approvalStatus === "Approved"
    ).length;
    const pendingCount = filteredVouchers.filter(
      (v) => v.approvalStatus === "Pending"
    ).length;
    return {
      totalVouchers,
      totalAmount,
      approvedCount,
      pendingCount,
    };
  }, [filteredVouchers]);

  const accountOptions = useMemo(
    () =>
      transactors.map((acc) => ({
        value: acc._id,
        label: `${acc.accountName || "Unknown"} (${
          acc.accountCode || ""
        }) - Balance: ${formatCurrencyText(acc.currentBalance)}`,
      })),
    [transactors]
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
            Loading journal vouchers...
          </p>
        </div>
      </div>
    );
  }

  if (selectedVoucher) {
    return (
      <JournalVoucherView
        selectedVoucher={selectedVoucher}
        transactors={transactors}
        setSelectedVoucher={setSelectedVoucher}
        showToastMessage={showToastMessage}
      />
    );
  }

  const EmptyState = ({ type }) => (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-32 h-32 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse shadow-lg">
        <Receipt size={48} className="text-purple-600" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">No {type} found</h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm
          ? `No ${type} match your search criteria.`
          : `Get started by creating your first journal voucher.`}
      </p>
      {!searchTerm && (
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
        >
          <Plus size={18} /> Create First Voucher
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
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
          backdrop-filter: blur(10px);
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

      <div className="mb-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <button className="p-3 rounded-xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group">
              <ArrowLeft
                size={20}
                className="text-gray-600 group-hover:text-purple-600 transition-colors"
              />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-black bg-clip-text">
                Journal Voucher Management
              </h1>
              <p className="text-gray-600 mt-2 font-medium flex items-center gap-2">
                <Clock size={16} className="text-purple-500" />
                {stats.totalVouchers} total vouchers · Last updated:{" "}
                {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-3 px-6 py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
            >
              <Plus size={20} strokeWidth={2.5} /> New Voucher
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-3.5 rounded-xl bg-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 hover:scale-105 group"
              title="Refresh data"
            >
              <RefreshCw
                size={20}
                className={`text-gray-600 group-hover:text-purple-600 transition-colors ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
            </button>
            <button
              className="p-3.5 rounded-xl bg-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 group"
              title="Export data"
              onClick={async () => {
                try {
                  const response = await axiosInstance.get(
                    "/vouchers/export/data",
                    {
                      params: { voucherType: "journal", format: "excel" },
                    }
                  );
                  const blob = new Blob(
                    [JSON.stringify(response.data.data.exportData)],
                    {
                      type: "application/vnd.ms-excel",
                    }
                  );
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.setAttribute("download", "vouchers.xlsx");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  showToastMessage("Export successful", "success");
                } catch (error) {
                  showToastMessage("Export failed", "error");
                }
              }}
            >
              <Download
                size={20}
                className="text-gray-600 group-hover:text-purple-600 transition-colors"
              />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Vouchers"
            count={stats.totalVouchers}
            icon={<Receipt size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText="All journal entries"
            trend="+12%"
          />
          <StatCard
            title="Total Amount"
            count={formatCurrency(stats.totalAmount, "text-purple-700")}
            icon={<DollarSign size={24} />}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
            borderColor="border-purple-200"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            subText="Sum of all vouchers"
            trend="+8%"
          />
          <StatCard
            title="Approved"
            count={stats.approvedCount}
            icon={<CheckCircle size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText="Approved vouchers"
          />
          <StatCard
            title="Pending"
            count={stats.pendingCount}
            icon={<Clock size={24} />}
            bgColor="bg-yellow-50"
            textColor="text-yellow-700"
            borderColor="border-yellow-200"
            iconBg="bg-yellow-100"
            iconColor="text-yellow-600"
            subText="Awaiting approval"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 size={24} className="text-purple-600" />
                Journal Vouchers
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                View and manage all journal entries
              </p>
            </div>
          </div>
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Search by voucher ID, reason, or account..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all duration-200 hover:border-gray-300 text-gray-900 placeholder-gray-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
        {filteredVouchers.length === 0 ? (
          <EmptyState type="vouchers" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <tr>
                    {[
                      { key: "voucherNo", label: "Voucher ID" },
                      { key: "date", label: "Date" },
                      { key: "debitAccountName", label: "Debit Account" },
                      { key: "creditAccountName", label: "Credit Account" },
                      { key: "totalAmount", label: "Amount" },
                      { key: "narration", label: "Reason" },
                      { key: "approvalStatus", label: "Status" },
                      { key: "actions", label: "Actions" },
                    ].map((col) => (
                      <th
                        key={col.key}
                        className={`px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors ${
                          col.key === "actions" ? "cursor-default" : ""
                        }`}
                        onClick={
                          col.key !== "actions"
                            ? () => handleSort(col.key)
                            : undefined
                        }
                      >
                        <div className="flex items-center space-x-1">
                          <span>{col.label}</span>
                          {sortConfig.key === col.key &&
                            col.key !== "actions" && (
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
                  {filteredVouchers.map((v) => (
                    <tr
                      key={v._id}
                      className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <button
                          onClick={() => handleViewVoucher(v)}
                          className="text-blue-600 hover:underline"
                        >
                          {v.voucherNo}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(v.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {v.debitAccountName}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {v.creditAccountName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatCurrency(v.totalAmount)}
                      </td>
                      <td
                        className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate"
                        title={v.narration}
                      >
                        {v.narration}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClassForStatus(
                            v.approvalStatus
                          )}`}
                        >
                          {v.approvalStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => handleViewVoucher(v)}
                            className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 transition-colors"
                            title="View details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                            title="Download voucher"
                            onClick={async () => {
                              try {
                                const response = await axiosInstance.get(
                                  `/vouchers/${v._id}/export`,
                                  {
                                    responseType: "blob",
                                  }
                                );
                                const url = window.URL.createObjectURL(
                                  new Blob([response.data])
                                );
                                const link = document.createElement("a");
                                link.href = url;
                                link.setAttribute(
                                  "download",
                                  `Journal_${v.voucherNo}.pdf`
                                );
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                showToastMessage(
                                  "Voucher downloaded successfully",
                                  "success"
                                );
                              } catch (error) {
                                showToastMessage(
                                  "Failed to download voucher",
                                  "error"
                                );
                              }
                            }}
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 flex justify-between items-center border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Showing {(pagination.current - 1) * pagination.limit + 1} to{" "}
                {Math.min(
                  pagination.current * pagination.limit,
                  pagination.total
                )}{" "}
                of {pagination.total} vouchers
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.current - 1)}
                  disabled={pagination.current === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100"
                >
                  Previous
                </button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-4 py-2 border rounded-lg ${
                        pagination.current === page
                          ? "bg-purple-600 text-white"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}
                <button
                  onClick={() => handlePageChange(pagination.current + 1)}
                  disabled={pagination.current === pagination.pages}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-100"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 modal-backdrop flex items-center justify-center p-4 z-50">
          <div
            ref={modalRef}
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transform scale-95 opacity-0 transition-all duration-300"
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Receipt size={28} />
                  </div>
                  Create Journal Voucher
                </h3>
                <p className="text-purple-100 text-sm mt-1">
                  Record a new journal entry with debit and credit accounts
                </p>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-white hover:bg-white/20 rounded-xl transition-all duration-200 hover:rotate-90"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border-l-4 border-purple-500 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <Sparkles size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">
                      Smart Journal Entry
                    </h4>
                    <p className="text-sm text-gray-600">
                      Select accounts from your chart of accounts and enter the
                      transaction details. The system ensures balanced entries
                      automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectDropdown
                  label="Debit Account"
                  icon={DollarSign}
                  value={formData.debitAccount}
                  onChange={(value) =>
                    handleSelectChange(value, "debitAccount")
                  }
                  options={accountOptions}
                  error={errors.debitAccount}
                  hint="Account to be debited"
                />

                <SelectDropdown
                  label="Credit Account"
                  icon={DollarSign}
                  value={formData.creditAccount}
                  onChange={(value) =>
                    handleSelectChange(value, "creditAccount")
                  }
                  options={accountOptions}
                  error={errors.creditAccount}
                  hint="Account to be credited"
                />

                <FormInput
                  label="Amount"
                  icon={DollarSign}
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  hint="Transaction amount in AED"
                  error={errors.amount}
                />

                <FormInput
                  label="Date"
                  icon={Calendar}
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  hint="Transaction date"
                  error={errors.date}
                />

                <div className="md:col-span-2">
                  <FormInput
                    label="Reason / Description"
                    icon={FileText}
                    name="narration"
                    value={formData.narration}
                    onChange={handleChange}
                    required
                    isTextarea={true}
                    rows="4"
                    placeholder="Enter the purpose of this journal entry (e.g., Depreciation adjustment, Accrued expenses, etc.)"
                    hint="Provide a clear description of the transaction"
                    error={errors.narration}
                  />
                </div>
              </div>

              {/* {formData.debitAccount &&
                formData.creditAccount &&
                formData.amount && (
                  <div className="mt-6 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200">
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <CheckCircle size={18} className="text-emerald-600" />
                      Entry Preview
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 font-medium mb-1">
                          Debit Account
                        </p>
                        <p className="text-gray-900 font-bold">
                          {transactors.find(
                            (acc) => acc._id === formData.debitAccount
                          )?.accountName || "Unknown"}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Current Balance:{" "}
                          {formatCurrency(
                            transactors.find(
                              (acc) => acc._id === formData.debitAccount
                            )?.currentBalance || 0
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600 font-medium mb-1">
                          Credit Account
                        </p>
                        <p className="text-gray-900 font-bold">
                          {transactors.find(
                            (acc) => acc._id === formData.creditAccount
                          )?.accountName || "Unknown"}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Current Balance:{" "}
                          {formatCurrency(
                            transactors.find(
                              (acc) => acc._id === formData.creditAccount
                            )?.currentBalance || 0
                          )}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-600 font-medium mb-1">Amount</p>
                        <p className="text-2xl font-bold text-emerald-600">
                          {formatCurrency(formData.amount, "text-emerald-600")}
                        </p>
                      </div>
                    </div>
                  </div>
                )} */}
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white sticky bottom-0">
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
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-semibold disabled:opacity-50 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 min-w-[180px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />{" "}
                    Creating...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" /> Create Voucher
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

export default JournalVoucherManagement;