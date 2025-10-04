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
  Users,
  Banknote,
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
  if (Array.isArray(d?.transactions)) return d.transactions;
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
    Settled: "bg-gradient-to-r from-emerald-100 to-emerald-200 text-emerald-800 border border-emerald-300",
    Pending: "bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border border-yellow-300",
  };
  return badges[status] || "bg-gray-100 text-gray-800";
};

// Custom AccountSelect Component (modeled after VendorSelect)
const AccountSelect = ({ accounts, value, onChange, onAccountSelect }) => {
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAccountName, setSelectedAccountName] = useState("");

  useEffect(() => {
    if (value) {
      const account = accounts.find((a) => a._id === value);
      setSelectedAccountName(account ? account.accountName || account.name : "");
      // Optional: Trigger auto-fill callback (e.g., fetch recent balance)
      if (onAccountSelect && account) {
        onAccountSelect(account, { balance: account.currentBalance || "0.00" }); // Example auto-fill
      }
    } else {
      setSelectedAccountName("");
      setError(null);
      if (onAccountSelect) onAccountSelect(null, {});
    }
  }, [value, accounts, onAccountSelect]);

  const fetchAccounts = async () => {
    setIsLoadingAccounts(true);
    setError(null);
    try {
      // If needed, refetch accounts here (but assuming they're passed as prop)
      // const response = await axiosInstance.get("/accounts/accounts");
      // ... process response
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
      setError("Failed to load accounts. Please try again.");
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const accountOptions = accounts.map((account) => ({
    value: account._id,
    label: account.accountName || account.name || "Unknown Account",
  }));

  const handleAccountChange = (selectedOption) => {
    onChange({
      target: { name: "accountId", value: selectedOption ? selectedOption.value : "" },
    });
  };

  const customStyles = {
    control: (provided, state) => ({
      ...provided,
      borderRadius: "0.75rem",
      padding: "0.5rem",
      borderColor: state.isFocused ? "#a855f7" : "#d1d5db",
      boxShadow: state.isFocused ? "0 0 0 3px rgba(168, 85, 247, 0.1)" : "none",
      "&:hover": {
        borderColor: "#9ca3af",
      },
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "#a855f7"
        : state.isFocused
        ? "#f3e8ff"
        : "white",
      color: state.isSelected ? "white" : "#1f2937",
      padding: "0.75rem 1rem",
      cursor: "pointer",
      "&:active": {
        backgroundColor: "#9333ea",
      },
    }),
  };

  return (
    <div className="group">
      <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
        <Users size={16} className="inline mr-2 text-purple-500" />
        Select Account <span className="text-red-500">*</span>
      </label>

      {error ? (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-red-300 rounded-xl bg-red-50">
          <AlertCircle size={32} className="text-red-400 mb-2" />
          <p className="text-sm text-red-600 font-medium mb-1">{error}</p>
          <button
            className="text-xs text-blue-600 hover:underline"
            onClick={fetchAccounts}
          >
            Retry
          </button>
        </div>
      ) : isLoadingAccounts ? (
        <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50">
          <Loader2 size={24} className="text-purple-600 animate-spin mr-2" />
          <span className="text-gray-600 font-medium">Loading accounts...</span>
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gradient-to-br from-yellow-50 to-orange-50">
          <Users size={32} className="text-orange-400 mb-2" />
          <p className="text-sm text-gray-600 font-medium mb-1">No accounts found</p>
          <p className="text-xs text-gray-500 text-center">No accounts available</p>
        </div>
      ) : (
        <>
          <Select
            value={accountOptions.find((option) => option.value === value)}
            onChange={handleAccountChange}
            options={accountOptions}
            isSearchable
            placeholder="Search and select account (e.g., Bank, Vendor)..."
            styles={customStyles}
            classNamePrefix="react-select"
            isDisabled={!accounts.length}
          />
          <p className="mt-1 text-xs text-gray-500 flex items-center">
            <CheckCircle size={10} className="mr-1" />
            {accounts.length ? "Choose the account for this transaction" : "No accounts available"}
          </p>
        </>
      )}
    </div>
  );
};

const TransactionsManagement = () => {
  const [accounts, setAccounts] = useState([]); // e.g., Banks, Cash, Vendors, Customers
  const [transactions, setTransactions] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    accountId: "",
    accountName: "", // Added for display
    transactionId: "",
    date: new Date().toISOString().split("T")[0],
    amount: "",
    type: "Debit",
    description: "",
    balance: "",
    status: "Pending",
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
  const formRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
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

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/accounts/accounts"); // Adjust endpoint as needed
      setAccounts(takeArray(response));
    } catch (err) {
      showToastMessage("Failed to fetch accounts.", "error");
      setAccounts([]);
    }
  }, [showToastMessage]);

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedAccount) params.append("accountId", selectedAccount.value);
      const response = await axiosInstance.get(`/transactions/transactions?${params.toString()}`);
      setTransactions(takeArray(response));
    } catch (err) {
      showToastMessage("Failed to fetch transactions.", "error");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToastMessage, selectedAccount]);

  const handleAccountSelect = useCallback((account, autoFillData = {}) => {
    setFormData((prev) => ({
      ...prev,
      accountName: account?.accountName || account?.name || "",
      description: autoFillData.description || prev.description, // Example auto-fill
      balance: autoFillData.balance || prev.balance,
      ...autoFillData,
    }));
  }, []);

  const handleAccountChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        transactionId: "",
        description: "",
        amount: "",
        balance: "",
        status: "Pending",
      }));
      setErrors({});
      if (name === "accountId") {
        // AccountSelect handles the rest via onAccountSelect
      }
    },
    [handleAccountSelect]
  );

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === "amount") {
        const numAmount = Number(value) || 0;
        const currentBalance = Number(prev.balance) || 0;
        const newBalance = prev.type === "Credit" 
          ? currentBalance + numAmount 
          : currentBalance - numAmount;
        return {
          ...newData,
          balance: newBalance.toFixed(2),
          status: newBalance >= 0 ? "Settled" : "Pending",
        };
      }
      if (name === "type") {
        const numAmount = Number(prev.amount) || 0;
        const currentBalance = Number(prev.balance) || 0;
        const newBalance = value === "Credit" 
          ? currentBalance + numAmount 
          : currentBalance - numAmount;
        return {
          ...newData,
          balance: newBalance.toFixed(2),
          status: newBalance >= 0 ? "Settled" : "Pending",
        };
      }
      return newData;
    });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const validateForm = useCallback(() => {
    const e = {};
    if (!formData.accountId) e.accountId = "Please select an account";
    if (!formData.amount || Number(formData.amount) <= 0) e.amount = "Please enter a valid amount";
    if (!formData.description) e.description = "Please enter a description";
    return e;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData({
      accountId: "",
      accountName: "",
      transactionId: "",
      date: new Date().toISOString().split("T")[0],
      amount: "",
      type: "Debit",
      description: "",
      balance: "",
      status: "Pending",
    });
    setErrors({});
    setShowModal(false);
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
      const payload = {
        accountId: formData.accountId,
        date: formData.date,
        amount: Number(formData.amount),
        type: formData.type,
        description: formData.description,
        balance: Number(formData.balance),
        status: formData.status,
      };
      console.log(payload);
      // await axiosInstance.post("/transactions/transactions", payload);
      // showToastMessage("Transaction created successfully!", "success");
      // fetchTransactions();
      // resetForm();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to create transaction.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, fetchTransactions, resetForm, showToastMessage, validateForm]);

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
    fetchTransactions().finally(() => {
      setIsRefreshing(false);
      showToastMessage("Data refreshed successfully", "success");
    });
  }, [fetchTransactions, showToastMessage]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const filteredTransactions = useMemo(() => {
    let filtered = asArray(transactions).filter((trans) => {
      if (selectedAccount && trans.accountId !== selectedAccount.value) return false;
      const term = searchTerm.toLowerCase();
      return trans.transactionId?.toLowerCase().includes(term) || 
             trans.description?.toLowerCase().includes(term);
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const av = sortConfig.key === "date" 
          ? new Date(a.date).getTime() 
          : sortConfig.key === "accountName" 
          ? a[sortConfig.key].toLowerCase() 
          : a[sortConfig.key];
        const bv = sortConfig.key === "date" 
          ? new Date(b.date).getTime() 
          : sortConfig.key === "accountName" 
          ? b[sortConfig.key].toLowerCase() 
          : b[sortConfig.key];
        return av < bv
          ? sortConfig.direction === "asc" ? -1 : 1
          : av > bv
          ? sortConfig.direction === "asc" ? 1 : -1
          : 0;
      });
    }

    // Enrich with account names
    return filtered.map((trans) => ({
      ...trans,
      accountName: accounts.find((acc) => acc._id === trans.accountId)?.accountName || "Unknown",
    }));
  }, [transactions, selectedAccount, searchTerm, sortConfig, accounts]);

  const stats = useMemo(() => {
    const totalTransactions = filteredTransactions.length;
    const totalDebits = filteredTransactions.reduce((sum, trans) => 
      trans.type === "Debit" ? sum + (Number(trans.amount) || 0) : sum, 0
    );
    const totalCredits = filteredTransactions.reduce((sum, trans) => 
      trans.type === "Credit" ? sum + (Number(trans.amount) || 0) : sum, 0
    );
    const netBalance = totalCredits - totalDebits;
    return {
      totalTransactions,
      totalDebits,
      totalCredits,
      netBalance,
    };
  }, [filteredTransactions]);

  const accountOptions = useMemo(
    () => [
      { value: "", label: "All Accounts" },
      ...accounts.map((acc) => ({ value: acc._id, label: acc.accountName || acc.name })),
    ],
    [accounts]
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
            Loading transactions...
          </p>
        </div>
      </div>
    );
  }

  const EmptyState = ({ type }) => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Banknote size={40} className="text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No {type} found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm
          ? `No ${type} match your search.`
          : `No ${type} available for the selected account.`}
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
              Transactions
            </h1>
            <p className="text-gray-600 mt-1 font-medium">
              {stats.totalTransactions} total transactions
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            onClick={openAddModal}
            className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
          >
            <Plus size={18} /> Add Transaction
          </button>
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
            title="Total Transactions"
            count={stats.totalTransactions}
            icon={<Receipt size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText="All records"
          />
          <StatCard
            title="Total Debits"
            count={formatCurrency(stats.totalDebits, "text-purple-700")}
            icon={<TrendingUp size={24} />}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
            borderColor="border-purple-200"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            subText="Debit outflows"
          />
          <StatCard
            title="Total Credits"
            count={formatCurrency(stats.totalCredits, "text-blue-700")}
            icon={<DollarSign size={24} />}
            bgColor="bg-blue-50"
            textColor="text-blue-700"
            borderColor="border-blue-200"
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            subText="Credit inflows"
          />
          <StatCard
            title="Net Balance"
            count={formatCurrency(stats.netBalance, "text-red-700")}
            icon={<DollarSign size={24} />}
            bgColor="bg-red-50"
            textColor="text-red-700"
            borderColor="border-red-200"
            iconBg="bg-red-100"
            iconColor="text-red-600"
            subText="Overall balance"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Transaction Ledger
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                View all debit and credit transactions with account details
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
                placeholder="Search by transaction ID or description..."
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
                    <Users size={16} className="inline mr-2" /> Account
                  </label>
                  <Select
                    value={selectedAccount}
                    onChange={(selectedOption) => {
                      setSelectedAccount(selectedOption);
                      fetchTransactions(); // Refetch on filter change
                    }}
                    options={accountOptions}
                    isSearchable={true}
                    placeholder="Search and select account..."
                    classNamePrefix="react-select"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        {filteredTransactions.length === 0 ? (
          <EmptyState type="transactions" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "transactionId", label: "Transaction ID" },
                    { key: "date", label: "Date" },
                    { key: "accountName", label: "Account" },
                    { key: "amount", label: "Amount" },
                    { key: "type", label: "Type" },
                    { key: "description", label: "Description" },
                    { key: "balance", label: "Balance" },
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
                {filteredTransactions.map((trans) => (
                  <tr
                    key={trans._id || trans.transactionId}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      {trans.transactionId}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(trans.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {trans.accountName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(trans.amount, trans.type === "Credit" ? "text-blue-600" : "text-red-600")}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          trans.type === "Credit"
                            ? "bg-gradient-to-r from-blue-100 to-blue-200 text-blue-800"
                            : "bg-gradient-to-r from-red-100 to-red-200 text-red-800"
                        }`}
                      >
                        {trans.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {trans.description}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {formatCurrency(trans.balance)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClassForStatus(
                          trans.status
                        )}`}
                      >
                        {trans.status}
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
        <div className="fixed inset-0 bg-black/30 modal-backdrop flex items-center justify-center p-4 z-50">
          <div
            ref={modalRef}
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden transform scale-95 opacity-0 transition-all duration-300"
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Banknote size={28} />
                  Add New Transaction
                </h3>
                <p className="text-purple-100 text-sm mt-1">
                  Record a debit or credit transaction with automatic balance updates
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
                      Smart Balance Tracking
                    </h4>
                    <p className="text-sm text-gray-600">
                      Select account and type to automatically calculate balance and status
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <AccountSelect
                    accounts={accounts}
                    value={formData.accountId}
                    onChange={handleAccountChange}
                    onAccountSelect={handleAccountSelect}
                  />
                </div>

                <FormInput
                  label="Transaction ID"
                  icon={Receipt}
                  type="text"
                  name="transactionId"
                  value={formData.transactionId}
                  onChange={handleChange}
                  placeholder="Auto-generated or manual"
                  hint="Unique identifier"
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
                />

                <FormInput
                  label="Amount"
                  icon={DollarSign}
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  hint="Enter positive amount"
                />

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <DollarSign size={16} className="inline mr-2 text-purple-500" /> Type
                  </label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all duration-200"
                    required
                  >
                    <option value="Debit">Debit</option>
                    <option value="Credit">Credit</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500 flex items-center">
                    <Sparkles size={10} className="mr-1" /> Debit decreases balance, Credit increases
                  </p>
                </div>

                <FormInput
                  label="Description"
                  icon={FileText}
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  placeholder="e.g., Payment for Invoice #12345"
                  hint="Brief note or reference"
                />

                <FormInput
                  label="Balance"
                  icon={DollarSign}
                  type="number"
                  name="balance"
                  value={formData.balance}
                  readOnly
                  hint="Auto-calculated"
                />

                <div className="md:col-span-2">
                  <FormInput
                    label="Status"
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
                    <p className="text-xs text-gray-600 mb-1">Account</p>
                    <p className="font-semibold text-gray-900">{formData.accountName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Amount</p>
                    <p className={`font-semibold ${formData.type === "Credit" ? "text-blue-600" : "text-red-600"}`}>
                      {formatCurrency(formData.amount || 0, formData.type === "Credit" ? "text-blue-600" : "text-red-600")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Type</p>
                    <p className={`font-semibold ${formData.type === "Credit" ? "text-blue-600" : "text-red-600"}`}>
                      {formData.type}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">New Balance</p>
                    <p className="font-semibold text-purple-600">
                      {formatCurrency(formData.balance || 0, "text-purple-600")}
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
                    <Save size={18} className="mr-2" /> Save Transaction
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

export default TransactionsManagement;