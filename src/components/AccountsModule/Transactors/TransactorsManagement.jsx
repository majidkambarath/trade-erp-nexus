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
  Edit,
  Trash2,
} from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../../axios/axios";

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
  if (Array.isArray(d?.vendors)) return d.vendors;
  if (Array.isArray(d?.customers)) return d.customers;
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
    Active:
      "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border border-emerald-300",
    Inactive:
      "bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 border border-gray-300",
    Compliant:
      "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800 border border-blue-300",
    "Non-compliant":
      "bg-gradient-to-r from-red-100 to-red-200 text-red-800 border border-red-300",
    Pending:
      "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300",
    Expired:
      "bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border border-orange-300",
  };
  return map[status] || "bg-gray-100 text-gray-800";
};

const TransactorsManagement = () => {
  const [transactors, setTransactors] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedTransactor, setSelectedTransactor] = useState(null);
  const [formData, setFormData] = useState({
    accountName: "",
    openingBalance: "0.00",
    currentBalance: "0.00",
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
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const modalRef = useRef(null);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  }, []);

  const fetchTransactors = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/account-v2/Transactor");
      const data = takeArray(res);
      setTransactors(
        data.map((t) => ({
          _id: t._id,
          id: t.accountCode,
          name: t.accountName,
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
    }
  }, [showToastMessage]);

  const fetchVendors = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/vendors/vendors");
      const data = takeArray(response);
      setVendors(
        data.map((v) => ({
          id: v.vendorId,
          name: v.vendorName,
          type: "Vendor",
          openingBalance: v.openingBalance || 0,
          currentBalance: v.cashBalance || 0,
          accountType: "Liability",
          status: v.status || "Pending",
          isTransactor: false,
        }))
      );
    } catch (err) {
      showToastMessage("Failed to fetch vendors.", "error");
      setVendors([]);
    }
  }, [showToastMessage]);

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/customers/customers");
      const data = takeArray(response);
      setCustomers(
        data.map((c) => ({
          id: c.customerId,
          name: c.customerName,
          type: "Customer",
          openingBalance: c.openingBalance || 0,
          currentBalance: c.cashBalance || 0,
          accountType: "Asset",
          status: c.status || "Active",
          isTransactor: false,
        }))
      );
    } catch (err) {
      showToastMessage("Failed to fetch customers.", "error");
      setCustomers([]);
    }
  }, [showToastMessage]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchTransactors(), fetchVendors(), fetchCustomers()]);
      setIsLoading(false);
    };
    load();
  }, [fetchTransactors, fetchVendors, fetchCustomers]);

  const openAddModal = useCallback(() => {
    setModalMode("add");
    setFormData({
      accountName: "",
      openingBalance: "0.00",
      currentBalance: "0.00",
      accountType: "",
      status: "Active",
    });
    setShowModal(true);
    setTimeout(() => {
      if (modalRef.current) {
        modalRef.current.classList.add("scale-100", "opacity-100");
      }
    }, 10);
  }, []);

  const openEditModal = useCallback((transactor) => {
    setModalMode("edit");
    setSelectedTransactor(transactor);
    setFormData({
      accountName: transactor.name,
      openingBalance: transactor.openingBalance.toFixed(2),
      currentBalance: transactor.currentBalance.toFixed(2),
      accountType: transactor.accountType,
      status: transactor.status,
    });
    setShowModal(true);
    setTimeout(() => {
      if (modalRef.current) {
        modalRef.current.classList.add("scale-100", "opacity-100");
      }
    }, 10);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setModalMode("add");
    setSelectedTransactor(null);
    setFormData({
      accountName: "",
      openingBalance: "0.00",
      currentBalance: "0.00",
      accountType: "",
      status: "Active",
    });
    setErrors({});
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const validateForm = useCallback(() => {
    const e = {};
    if (!formData.accountName) e.accountName = "Name is required";
    if (!formData.accountType) e.accountType = "Account type is required";
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
      const payload = {
        accountName: formData.accountName,
        openingBalance: Number(formData.openingBalance),
        currentBalance: Number(formData.currentBalance),
        accountType: formData.accountType,
        status: formData.status,
      };

      if (modalMode === "edit" && selectedTransactor) {
        await axiosInstance.put(
          `/account-v2/Transactor/${selectedTransactor._id}`,
          payload
        );
        showToastMessage("Transactor updated!", "success");
      } else {
        await axiosInstance.post("/account-v2/Transactor", payload);
        showToastMessage("Transactor created!", "success");
      }
      closeModal();
      await fetchTransactors();
    } catch (er) {
      showToastMessage(
        er.response?.data?.message ||
          `Failed to ${modalMode === "edit" ? "update" : "create"} transactor`,
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
    modalMode,
    selectedTransactor,
    fetchTransactors,
  ]);

  const handleDelete = useCallback(
    async (transactorId) => {
      if (!window.confirm("Are you sure you want to delete this transactor?"))
        return;
      setIsSubmitting(true);
      try {
        await axiosInstance.delete(`/account-v2/Transactor/${transactorId}`);
        showToastMessage("Transactor deleted!", "success");
        await fetchTransactors();
      } catch (er) {
        showToastMessage(
          er.response?.data?.message || "Failed to delete transactor",
          "error"
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [showToastMessage, fetchTransactors]
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    Promise.all([fetchTransactors(), fetchVendors(), fetchCustomers()]).finally(
      () => {
        setIsRefreshing(false);
        showToastMessage("Data refreshed", "success");
      }
    );
  }, [fetchTransactors, fetchVendors, fetchCustomers, showToastMessage]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const combinedList = useMemo(() => {
    return [...transactors, ...vendors, ...customers];
  }, [transactors, vendors, customers]);

  const filteredList = useMemo(() => {
    let list = combinedList;
    if (selectedType) {
      list = list.filter((t) => t.type === selectedType.value);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (t) =>
          t.name?.toLowerCase().includes(term) ||
          t.id?.toLowerCase().includes(term)
      );
    }
    if (sortConfig.key) {
      list = [...list].sort((a, b) => {
        const aVal =
          sortConfig.key === "openingBalance" ||
          sortConfig.key === "currentBalance"
            ? Number(a[sortConfig.key])
            : a[sortConfig.key]?.toString().toLowerCase();
        const bVal =
          sortConfig.key === "openingBalance" ||
          sortConfig.key === "currentBalance"
            ? Number(b[sortConfig.key])
            : b[sortConfig.key]?.toString().toLowerCase();
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return list;
  }, [combinedList, selectedType, searchTerm, sortConfig]);

  const stats = useMemo(() => {
    const total = filteredList.length;
    const active = filteredList.filter(
      (t) =>
        t.status === "Active" ||
        t.status === "Compliant" ||
        t.status === "Pending"
    ).length;
    const totalBalance = filteredList.reduce(
      (sum, t) => sum + Number(t.currentBalance),
      0
    );
    return { total, active, totalBalance };
  }, [filteredList]);

  const typeOptions = [
    { value: "", label: "All Types" },
    { value: "Transactor", label: "Transactor" },
    { value: "Vendor", label: "Vendor" },
    { value: "Customer", label: "Customer" },
    ...[...new Set(transactors.map((t) => t.type))]
      .filter((type) => type !== "Transactor")
      .map((type) => ({
        value: type,
        label: type.charAt(0).toUpperCase() + type.slice(1),
      })),
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="text-purple-600 animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg font-medium">Loading data...</p>
        </div>
      </div>
    );
  }

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Users size={40} className="text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No records found
      </h3>
      <p className="text-gray-600 text-center max-w-md">
        {searchTerm
          ? "No results match your search."
          : "Try adjusting filters or add a new transactor."}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
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

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Accounts
            </h1>
            <p className="text-gray-600 mt-1 font-medium">
              {stats.total} total accounts
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
            title="Filters"
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

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
            subText="All accounts"
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
            subText="Active or compliant"
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
            count={new Set(combinedList.map((t) => t.type)).size}
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

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Accounts Ledger
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage transactors, vendors, and customers
              </p>
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
        {filteredList.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "id", label: "ID" },
                    { key: "name", label: "Name" },
                    { key: "type", label: "Type" },
                    { key: "openingBalance", label: "Opening Balance" },
                    { key: "currentBalance", label: "Current Balance" },
                    { key: "accountType", label: "Account Type" },
                    { key: "status", label: "Status" },
                    { key: "actions", label: "Actions" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={
                        col.key !== "actions" ? () => handleSort(col.key) : null
                      }
                      className={`px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${
                        col.key !== "actions"
                          ? "cursor-pointer hover:bg-gray-100"
                          : ""
                      } transition-colors`}
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
                {filteredList.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {item.id}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {item.name}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.type === "Transactor"
                            ? "bg-gray-100 text-gray-800"
                            : item.type === "Customer"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(item.openingBalance)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(item.currentBalance)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {item.accountType}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClassForStatus(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {item.isTransactor ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-all duration-200 hover:scale-110"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item._id)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-full transition-all duration-200 hover:scale-110"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">
                          No actions
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 modal-backdrop flex items-center justify-center p-4 z-50">
          <div
            ref={modalRef}
            className="bg-white rounded-3xl shadow-2xl w-1/2 overflow-hidden transform scale-95 opacity-0 transition-all duration-300"
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Users size={28} />
                  {modalMode === "edit"
                    ? "Edit Transactor"
                    : "Add New Transactor"}
                </h3>
                <p className="text-purple-100 text-sm mt-1">
                  {modalMode === "edit"
                    ? "Update transactor details"
                    : "Create a new transactor account"}
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-2 text-white hover:bg-white/20 rounded-xl transition-all duration-200 hover:rotate-90"
              >
                <X size={24} />
              </button>
            </div>
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
                <FormInput
                  label="Name"
                  icon={User}
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  required
                  placeholder="e.g. ABC Corp"
                  error={errors.accountName}
                  hint="Enter the name of the transactor"
                />
                <FormInput
                  label="Opening Balance"
                  icon={DollarSign}
                  name="openingBalance"
                  type="number"
                  step="0.01"
                  value={formData.openingBalance}
                  onChange={handleChange}
                  placeholder="0.00"
                  hint="Initial balance (optional)"
                />
                <FormInput
                  label="Current Balance"
                  icon={DollarSign}
                  name="currentBalance"
                  type="number"
                  step="0.01"
                  value={formData.currentBalance}
                  onChange={handleChange}
                  placeholder="0.00"
                  hint="Current balance (optional)"
                />
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
                    <FileText
                      size={16}
                      className="inline mr-2 text-purple-500"
                    />{" "}
                    Account Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="accountType"
                    value={formData.accountType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all duration-200 border-gray-300 hover:border-gray-400"
                  >
                    <option value="">Select account type</option>
                    {["asset", "liability", "equity", "income", "expense"].map(
                      (type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      )
                    )}
                  </select>
                  {errors.accountType && (
                    <p className="mt-1 text-sm text-red-600 flex items-center animate-shake">
                      <AlertCircle size={12} className="mr-1" />{" "}
                      {errors.accountType}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 flex items-center">
                    <Sparkles size={10} className="mr-1" /> Classify the account
                    type
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
                    <AlertCircle
                      size={16}
                      className="inline mr-2 text-purple-500"
                    />{" "}
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="isActive"
                    value={formData.isActive ? "Active" : "Inactive"}
                    onChange={(e) =>
                      handleChange({
                        target: {
                          name: "isActive",
                          value: e.target.value === "Active",
                        },
                      })
                    }
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
                    <Loader2 size={18} className="mr-2 animate-spin" />{" "}
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" />{" "}
                    {modalMode === "edit"
                      ? "Update Transactor"
                      : "Save Transactor"}
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
