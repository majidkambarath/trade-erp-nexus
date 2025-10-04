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
  Users,
  Banknote,
} from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../../axios/axios";

/* ------------------------------------------------------------------ */
/* Re-usable UI helpers (copied from your existing code)               */
/* ------------------------------------------------------------------ */
const FormInput = ({
  label,
  icon: Icon,
  error,
  readOnly,
  hint,
  ...props
}) => (
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
      <button
        className={`text-xs ${textColor} hover:opacity-80 transition-opacity font-semibold`}
      >
        View Details →
      </button>
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

const asArray = (x) => (Array.isArray(x) ? x : []);
const takeArray = (resp) => {
  if (!resp) return [];
  const d = resp.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data.data ?? d.data;
  if (Array.isArray(d?.transactors)) return d.transactors;
  return [];
};

const formatCurrency = (amount, colorClass = "text-gray-900") => {
  const num = Number(amount) || 0;
  const abs = Math.abs(num).toFixed(2);
  const neg = num < 0;
  return (
    <span className={`inline-flex items-center font-semibold ${colorClass}`}>
      {neg && <span className="text-red-600">-</span>}
      <span className="text-xs mr-1 opacity-70">AED</span>
      {abs.toLocaleString()}
    </span>
  );
};

const badgeClassForStatus = (status) => {
  const map = {
    Active: "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border border-emerald-300",
    Inactive:
      "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border border-gray-300",
  };
  return map[status] || "bg-gray-100 text-gray-800";
};

/* ------------------------------------------------------------------ */
/* Custom select for Transactor Type (mirrors VendorSelect style)    */
/* ------------------------------------------------------------------ */
const TransactorTypeSelect = ({ value, onChange }) => {
  const options = [
    { value: "Customer", label: "Customer" },
    { value: "Vendor", label: "Vendor" },
    { value: "Bank", label: "Bank" },
    { value: "Cash", label: "Cash" },
    { value: "Misc", label: "Misc" },
  ];

  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      borderRadius: "0.75rem",
      padding: "0.5rem",
      borderColor: state.isFocused ? "#a855f7" : "#d1d5db",
      boxShadow: state.isFocused
        ? "0 0 0 3px rgba(168, 85, 247, 0.1)"
        : "none",
      "&:hover": { borderColor: "#9ca3af" },
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "#a855f7"
        : state.isFocused
        ? "#f3e8ff"
        : "white",
      color: state.isSelected ? "white" : "#1f2937",
    }),
  };

  return (
    <div className="group">
      <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
        <Users size={16} className="inline mr-2 text-purple-500" />
        Type <span className="text-red-500">*</span>
      </label>
      <Select
        value={options.find((o) => o.value === value)}
        onChange={(opt) =>
          onChange({ target: { name: "type", value: opt?.value || "" } })
        }
        options={options}
        isSearchable={false}
        styles={customStyles}
        classNamePrefix="react-select"
      />
      <p className="mt-1 text-xs text-gray-500 flex items-center">
        <Sparkles size={10} className="mr-1" /> Choose the transactor category
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Main Page Component                                                */
/* ------------------------------------------------------------------ */
const TransactorsManagement = () => {
  /* ---------- state ---------- */
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [misc, setMisc] = useState([]);

  const [transactors, setTransactors] = useState([]); // merged view
  const [selectedType, setSelectedType] = useState(null); // filter
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    outstandingBalance: "0.00",
    accountType: "",
    status: "Active",
  });
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
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "asc",
  });

  const modalRef = useRef(null);

  /* ---------- toast ---------- */
  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  }, []);

  /* ---------- data fetch ---------- */
  const fetchVendors = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/vendors/vendors");
      setVendors(takeArray(res));
    } catch (err) {
      showToastMessage("Failed to fetch vendors.", "error");
    }
  }, [showToastMessage]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/customers/customers");
      setCustomers(takeArray(res));
    } catch (err) {
      showToastMessage("Failed to fetch customers.", "error");
    }
  }, [showToastMessage]);

  const fetchBanks = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/accounts/banks");
      setBanks(takeArray(res));
    } catch (err) {
      showToastMessage("Failed to fetch banks.", "error");
    }
  }, [showToastMessage]);

  const fetchCash = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/accounts/cash");
      setCashAccounts(takeArray(res));
    } catch (err) {
      showToastMessage("Failed to fetch cash accounts.", "error");
    }
  }, [showToastMessage]);

  const fetchMisc = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/accounts/misc");
      setMisc(takeArray(res));
    } catch (err) {
      showToastMessage("Failed to fetch misc accounts.", "error");
    }
  }, [showToastMessage]);

  /* ---------- initial load ---------- */
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchVendors(),
        fetchCustomers(),
        fetchBanks(),
        fetchCash(),
        fetchMisc(),
      ]);
      setIsLoading(false);
    };
    load();
  }, [
    fetchVendors,
    fetchCustomers,
    fetchBanks,
    fetchCash,
    fetchMisc,
  ]);

  /* ---------- merge into unified list ---------- */
  useEffect(() => {
    const merged = [
      ...vendors.map((v) => ({
        id: v.vendorId || v._id,
        name: v.vendorName,
        type: "Vendor",
        outstandingBalance: v.outstandingBalance || 0,
        accountType: v.accountType || "Payable",
        status: v.status || "Active",
      })),
      ...customers.map((c) => ({
        id: c.customerId || c._id,
        name: c.customerName,
        type: "Customer",
        outstandingBalance: c.outstandingBalance || 0,
        accountType: c.accountType || "Receivable",
        status: c.status || "Active",
      })),
      ...banks.map((b) => ({
        id: b.bankId || b._id,
        name: b.bankName || b.name,
        type: "Bank",
        outstandingBalance: b.balance || 0,
        accountType: b.accountType || "Asset",
        status: b.status || "Active",
      })),
      ...cashAccounts.map((c) => ({
        id: c.cashId || c._id,
        name: c.cashName || c.name,
        type: "Cash",
        outstandingBalance: c.balance || 0,
        accountType: c.accountType || "Asset",
        status: c.status || "Active",
      })),
      ...misc.map((m) => ({
        id: m.miscId || m._id,
        name: m.miscName || m.name,
        type: "Misc",
        outstandingBalance: m.balance || 0,
        accountType: m.accountType || "Asset",
        status: m.status || "Active",
      })),
    ];
    setTransactors(merged);
  }, [vendors, customers, banks, cashAccounts, misc]);

  /* ---------- modal open/close ---------- */
  const openAddModal = useCallback(() => {
    setShowModal(true);
    setTimeout(() => {
      if (modalRef.current) {
        modalRef.current.classList.add("scale-100", "opacity-100");
      }
    }, 10);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setFormData({
      name: "",
      type: "",
      outstandingBalance: "0.00",
      accountType: "",
      status: "Active",
    });
    setErrors({});
  }, []);

  /* ---------- form handlers ---------- */
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const validateForm = useCallback(() => {
    const e = {};
    if (!formData.name) e.name = "Name is required";
    if (!formData.type) e.type = "Type is required";
    return e;
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    const err = validateForm();
    if (Object.keys(err).length) {
      setErrors(err);
      showToastMessage("Please fix the errors", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      let endpoint = "";
      let payload = {};
      switch (formData.type) {
        case "Vendor":
          endpoint = "/vendors/vendors";
          payload = {
            vendorName: formData.name,
            outstandingBalance: Number(formData.outstandingBalance),
            accountType: formData.accountType || "Payable",
            status: formData.status,
          };
          break;
        case "Customer":
          endpoint = "/customers/customers";
          payload = {
            customerName: formData.name,
            outstandingBalance: Number(formData.outstandingBalance),
            accountType: formData.accountType || "Receivable",
            status: formData.status,
          };
          break;
        case "Bank":
          endpoint = "/accounts/banks";
          payload = {
            bankName: formData.name,
            balance: Number(formData.outstandingBalance),
            accountType: formData.accountType || "Asset",
            status: formData.status,
          };
          break;
        case "Cash":
          endpoint = "/accounts/cash";
          payload = {
            cashName: formData.name,
            balance: Number(formData.outstandingBalance),
            accountType: formData.accountType || "Asset",
            status: formData.status,
          };
          break;
        case "Misc":
          endpoint = "/accounts/misc";
          payload = {
            miscName: formData.name,
            balance: Number(formData.outstandingBalance),
            accountType: formData.accountType || "Asset",
            status: formData.status,
          };
          break;
        default:
          throw new Error("Invalid type");
      }

      await axiosInstance.post(endpoint, payload);
      showToastMessage("Transactor created!", "success");
      closeModal();
      // refresh appropriate list based on type
      if (formData.type === "Vendor") fetchVendors();
      else if (formData.type === "Customer") fetchCustomers();
      else if (formData.type === "Bank") fetchBanks();
      else if (formData.type === "Cash") fetchCash();
      else fetchMisc();
    } catch (er) {
      showToastMessage(
        er.response?.data?.message || "Failed to create transactor",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formData,
    validateForm,
    showToastMessage,
    closeModal,
    fetchVendors,
    fetchCustomers,
    fetchBanks,
    fetchCash,
    fetchMisc,
  ]);

  /* ---------- refresh all ---------- */
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.all([
      fetchVendors(),
      fetchCustomers(),
      fetchBanks(),
      fetchCash(),
      fetchMisc(),
    ]).finally(() => {
      setIsRefreshing(false);
      showToastMessage("Data refreshed", "success");
    });
  }, [
    fetchVendors,
    fetchCustomers,
    fetchBanks,
    fetchCash,
    fetchMisc,
    showToastMessage,
  ]);

  /* ---------- sorting ---------- */
  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  /* ---------- filtered / sorted list ---------- */
  const filteredTransactors = useMemo(() => {
    let list = transactors;

    // filter by type
    if (selectedType) {
      list = list.filter((t) => t.type === selectedType.value);
    }

    // search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (t) =>
          t.name?.toLowerCase().includes(term) ||
          t.id?.toLowerCase().includes(term)
      );
    }

    // sort
    if (sortConfig.key) {
      list = [...list].sort((a, b) => {
        const aVal =
          sortConfig.key === "outstandingBalance"
            ? Number(a[sortConfig.key])
            : a[sortConfig.key]?.toString().toLowerCase();
        const bVal =
          sortConfig.key === "outstandingBalance"
            ? Number(b[sortConfig.key])
            : b[sortConfig.key]?.toString().toLowerCase();

        if (aVal < bVal)
          return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal)
          return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [
    transactors,
    selectedType,
    searchTerm,
    sortConfig,
  ]);

  /* ---------- stats ---------- */
  const stats = useMemo(() => {
    const total = filteredTransactors.length;
    const active = filteredTransactors.filter((t) => t.status === "Active")
      .length;
    const totalBalance = filteredTransactors.reduce(
      (sum, t) => sum + Number(t.outstandingBalance),
      0
    );
    return { total, active, totalBalance };
  }, [filteredTransactors]);

  /* ---------- type filter options ---------- */
  const typeOptions = [
    { value: "", label: "All Types" },
    { value: "Customer", label: "Customer" },
    { value: "Vendor", label: "Vendor" },
    { value: "Bank", label: "Bank" },
    { value: "Cash", label: "Cash" },
    { value: "Misc", label: "Misc" },
  ];

  /* ---------- loading UI ---------- */
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="text-purple-600 animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg font-medium">
            Loading transactors...
          </p>
        </div>
      </div>
    );
  }

  /* ---------- empty state ---------- */
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Users size={40} className="text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No transactors found
      </h3>
      <p className="text-gray-600 text-center max-w-md">
        {searchTerm
          ? "No results match your search."
          : "Try adjusting filters or add a new transactor."}
      </p>
    </div>
  );

  /* ------------------------------------------------------------------ */
  /* Render                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      {/* Inline animations (same as other pages) */}
      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity:0; } to { transform: translateX(0); opacity:1; } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        .animate-slide-in { animation: slide-in .3s ease-out; }
        .animate-shake { animation: shake .3s ease-in-out; }
        .modal-backdrop { backdrop-filter: blur(8px); animation: fadeIn .2s ease-out; }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
      `}</style>

      <Toast
        show={showToast.visible}
        message={showToast.message}
        type={showToast.type}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Transactors
            </h1>
            <p className="text-gray-600 mt-1 font-medium">
              {stats.total} total transactors
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            onClick={openAddModal}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
          >
            <Plus size={18} /> Add Transactor
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 hover:scale-105"
            title="Refresh"
          >
            <RefreshCw
              size={18}
              className={`text-gray-600 ${
                isRefreshing ? "animate-spin" : ""
              }`}
            />
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 ${
              showFilters
                ? "bg-purple-100 text-purple-600 ring-2 ring-purple-300"
                : "bg-white text-gray-600"
            }`}
            title="Filters"
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total"
            count={stats.total}
            icon={<Users size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText="All transactors"
          />
          <StatCard
            title="Active"
            count={stats.active}
            icon={<CheckCircle size={24} />}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
            borderColor="border-purple-200"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            subText="Currently active"
          />
          <StatCard
            title="Outstanding"
            count={formatCurrency(stats.totalBalance, "text-blue-700")}
            icon={<DollarSign size={24} />}
            bgColor="bg-blue-50"
            textColor="text-blue-700"
            borderColor="border-blue-200"
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            subText="Total balance"
          />
          <StatCard
            title="Types"
            count={new Set(transactors.map((t) => t.type)).size}
            icon={<Package size={24} />}
            bgColor="bg-red-50"
            textColor="text-red-700"
            borderColor="border-red-200"
            iconBg="bg-red-100"
            iconColor="text-red-600"
            subText="Distinct categories"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Transactor Ledger
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage customers, vendors, banks, cash & misc accounts
              </p>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all hover:border-gray-300"
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
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                <div className="w-full">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Filter size={16} className="inline mr-2" /> Type
                  </label>
                  <Select
                    value={selectedType}
                    onChange={setSelectedType}
                    options={typeOptions}
                    isSearchable
                    placeholder="All types"
                    classNamePrefix="react-select"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table body */}
        {filteredTransactors.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[ 
                    { key: "id", label: "Transactor ID" },
                    { key: "name", label: "Name" },
                    { key: "type", label: "Type" },
                    { key: "outstandingBalance", label: "Outstanding Balance" },
                    { key: "accountType", label: "Account Type" },
                    { key: "status", label: "Status" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
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
                {filteredTransactors.map((tr) => (
                  <tr
                    key={tr.id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {tr.id}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {tr.name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          tr.type === "Customer"
                            ? "bg-blue-100 text-blue-800"
                            : tr.type === "Vendor"
                            ? "bg-purple-100 text-purple-800"
                            : tr.type === "Bank"
                            ? "bg-emerald-100 text-emerald-800"
                            : tr.type === "Cash"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {tr.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(tr.outstandingBalance)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tr.accountType}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClassForStatus(
                          tr.status
                        )}`}
                      >
                        {tr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    
      {showModal && (
        <div className="fixed  inset-0 bg-black/30 modal-backdrop flex items-center justify-center p-4 z-50">
          <div
            ref={modalRef}
            className="bg-white rounded-3xl shadow-2xl w-1/2 overflow-hidden transform scale-95 opacity-0 transition-all duration-300"
          >
            {/* header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Users size={28} />
                  Add New Transactor
                </h3>
                <p className="text-purple-100 text-sm mt-1">
                  Create a customer, vendor, bank, cash or misc account
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-white hover:bg-white/20 rounded-xl transition-all duration-200 hover:rotate-90"
              >
                <X size={24} />
              </button>
            </div>

            {/* body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-l-4 border-purple-500">
                <div className="flex items-start gap-3">
                  <Sparkles size={20} className="text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Quick Setup
                    </h4>
                    <p className="text-sm text-gray-600">
                      Fill the basic fields – the rest can be edited later.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {/* Type */}
                <TransactorTypeSelect
                  value={formData.type}
                  onChange={handleChange}
                />

                {/* Name */}
                <FormInput
                  label="Name"
                  icon={User}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. ABC Corp"
                  error={errors.name}
                  hint="Enter the name of the transactor"
                />

                {/* Outstanding Balance */}
                <FormInput
                  label="Outstanding Balance"
                  icon={DollarSign}
                  name="outstandingBalance"
                  type="number"
                  step="0.01"
                  value={formData.outstandingBalance}
                  onChange={handleChange}
                  placeholder="0.00"
                  hint="Initial balance (optional)"
                />

                {/* Account Type */}
                <FormInput
                  label="Account Type"
                  icon={FileText}
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleChange}
                  placeholder="e.g. Receivable, Payable, Asset"
                  hint="Classify the account type"
                />

                {/* Status */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
                    <AlertCircle size={16} className="inline mr-2 text-purple-500" />
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all duration-200 border-gray-300 hover:border-gray-400"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 flex items-center">
                    <Sparkles size={10} className="mr-1" /> Set initial status
                  </p>
                </div>
              </div>
            </div>

            {/* footer */}
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closeModal}
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
                    <Save size={18} className="mr-2" /> Save Transactor
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

export default TransactorsManagement;