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
} from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../../axios/axios";
import DirhamIcon from "../../../assets/dirham.svg";
import ContraVoucherView from "./ContraVoucherView";

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

const SessionManager = {
  storage: {},
  key: (k) => `contra_voucher_${k}`,
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
      if (k.startsWith("contra_voucher_")) delete SessionManager.storage[k];
    });
  },
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

  // Map entries to include fromAccount and toAccount
  return vouchers.map((voucher) => {
    const entries = Array.isArray(voucher.entries) ? voucher.entries : [];
    const fromEntry = entries.find((e) => e.creditAmount > 0); // Credit entry is "from" account
    const toEntry = entries.find((e) => e.debitAmount > 0); // Debit entry is "to" account

    return {
      ...voucher,
      fromAccount: fromEntry
        ? {
            accountCode: fromEntry.accountCode,
            accountName: fromEntry.accountName,
            accountId: fromEntry.accountId,
          }
        : null,
      toAccount: toEntry
        ? {
            accountCode: toEntry.accountCode,
            accountName: toEntry.accountName,
            accountId: toEntry.accountId,
          }
        : null,
    };
  });
};

const displayAccount = (account, transactors) => {
  if (typeof account === "object" && account)
    return account.accountName || "Unknown";
  const trans = transactors.find((t) => t.accountCode === account);
  if (trans) return trans.accountName;
  const a = (account || "").toString().toLowerCase();
  return a === "cash" ? "Cash" : a === "bank" ? "Bank" : account || "Unknown";
};

const badgeClassForAccount = (account, transactors) => {
  const a = displayAccount(account, transactors).toLowerCase();
  const badges = {
    cash: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    "cash in hand": "bg-emerald-100 text-emerald-800 border border-emerald-200",
    bank: "bg-blue-100 text-blue-800 border border-blue-200",
    "petty cash": "bg-emerald-100 text-emerald-800 border border-emerald-200",
  };
  return badges[a] || "bg-slate-100 text-slate-800 border border-slate-200";
};

const iconForAccount = (account, transactors) => {
  let a;
  if (typeof account === "string") {
    const trans = transactors.find((t) => t.accountCode === account);
    a = trans ? trans.accountName.toLowerCase() : account.toLowerCase();
  } else if (typeof account === "object") {
    a = account.accountName.toLowerCase();
  } else {
    a = "";
  }
  if (a.includes("cash"))
    return <DollarSign size={14} className="text-emerald-600" />;
  if (a.includes("bank"))
    return <Building size={14} className="text-blue-600" />;
  return <DollarSign size={14} className="text-slate-600" />;
};

const formatCurrency = (
  amount,
  colorClass = "text-gray-900",
  isSummaryCard = false
) => {
  const numAmount = Number(amount) || 0;
  const absAmount = Math.abs(numAmount).toFixed(2);
  const isNegative = numAmount < 0;
  const iconSizeClass = isSummaryCard ? "w-6 h-6" : "w-4 h-4";
  return (
    <span className={`inline-flex items-center ${colorClass}`}>
      {isNegative && "-"}
      <img src={DirhamIcon} alt="AED" className={`${iconSizeClass} mr-1`} />
      {absAmount}
    </span>
  );
};

const ContraVoucherManagement = () => {
  const [contras, setContras] = useState([]);
  const [transactors, setTransactors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(
    SessionManager.get("searchTerm") || ""
  );
  const [editContraId, setEditContraId] = useState(null);
  const [formData, setFormData] = useState({
    voucherNo: "",
    date: new Date().toISOString().split("T")[0],
    fromAccount: null,
    toAccount: null,
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedContra, setSelectedContra] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    contraId: null,
    voucherNo: "",
    isDeleting: false,
  });

  const formRef = useRef(null);

  useEffect(() => {
    fetchContras();
    fetchTransactors();
  }, []);

  useEffect(() => {
    if (transactors.length > 0) {
      const savedFormData = SessionManager.get("formData");
      if (savedFormData && typeof savedFormData === "object") {
        setFormData((prev) => ({
          ...prev,
          ...savedFormData,
          fromAccount:
            transactors.find((t) => t._id === savedFormData.fromAccount) ||
            prev.fromAccount,
          toAccount:
            transactors.find((t) => t._id === savedFormData.toAccount) ||
            prev.toAccount,
        }));
      }
    }
  }, [transactors]);

  useEffect(() => {
    let timer;
    if (showModal) {
      timer = setTimeout(() => {
        SessionManager.set("formData", {
          ...formData,
          fromAccount: formData.fromAccount?._id,
          toAccount: formData.toAccount?._id,
        });
        SessionManager.set("lastSaveTime", new Date().toISOString());
      }, 800);
    }
    return () => clearTimeout(timer);
  }, [formData, showModal]);

  useEffect(() => {
    SessionManager.set("searchTerm", searchTerm);
  }, [searchTerm]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      2800
    );
  }, []);

  const fetchContras = useCallback(
    async (showRefreshIndicator = false) => {
      try {
        showRefreshIndicator ? setIsRefreshing(true) : setIsLoading(true);
        const response = await axiosInstance.get("/vouchers/vouchers", {
          params: { voucherType: "contra" },
        });
        console.log(response.data)
        setContras(takeArray(response));
        if (showRefreshIndicator) showToastMessage("Data refreshed", "success");
      } catch (err) {
        showToastMessage(
          err.response?.data?.message || "Failed to fetch contra vouchers.",
          "error"
        );
        setContras([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showToastMessage]
  );

  const fetchTransactors = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/account-v2/Transactor");
      const data = takeArray(res);
      setTransactors(
        data.map((t) => ({
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
    }
  }, [showToastMessage]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const validateForm = useCallback(() => {
    const e = {};
    if (!formData.date) e.date = "Date is required";
    if (!formData.fromAccount) e.fromAccount = "From account is required";
    if (!formData.toAccount) e.toAccount = "To account is required";
    if (
      formData.fromAccount &&
      formData.toAccount &&
      formData.fromAccount._id === formData.toAccount._id
    )
      e.toAccount = "From and To accounts must be different";
    if (!formData.amount || Number(formData.amount) <= 0)
      e.amount = "Amount must be greater than 0";
    return e;
  }, [formData]);

  const resetForm = useCallback(() => {
    setEditContraId(null);
    setFormData({
      voucherNo: "",
      date: new Date().toISOString().split("T")[0],
      fromAccount: null,
      toAccount: null,
      amount: "",
      narration: "",
    });
    setErrors({});
    setShowModal(false);
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
        fromAccount: formData.fromAccount.accountCode,
        toAccount: formData.toAccount.accountCode,
        totalAmount: Number(formData.amount),
        narration: formData.narration,
        voucherType: "contra",
      };

      if (editContraId) {
        await axiosInstance.put(`/vouchers/vouchers/${editContraId}`, payload);
        showToastMessage("Contra voucher updated successfully!", "success");
      } else {
        await axiosInstance.post("/vouchers/vouchers", payload);
        showToastMessage("Contra voucher created successfully!", "success");
      }
      await fetchContras();
      resetForm();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to save contra voucher.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    editContraId,
    formData,
    fetchContras,
    resetForm,
    showToastMessage,
    validateForm,
  ]);

  const handleEdit = useCallback(
    (contra) => {
      setEditContraId(contra._id);
      setFormData({
        voucherNo: contra.voucherNo || "",
        date: contra.date
          ? new Date(contra.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        fromAccount:
          transactors.find(
            (t) => t.accountCode === contra.fromAccount?.accountCode
          ) || null,
        toAccount:
          transactors.find(
            (t) => t.accountCode === contra.toAccount?.accountCode
          ) || null,
        amount: String(contra.totalAmount || contra.amount || 0),
        narration: contra.narration || contra.remarks || "",
      });
      setShowModal(true);
      SessionManager.remove("formData");
      SessionManager.remove("lastSaveTime");
    },
    [transactors]
  );

  const showDeleteConfirmation = useCallback((contra) => {
    setDeleteConfirmation({
      visible: true,
      contraId: contra._id,
      voucherNo: contra.voucherNo,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      contraId: null,
      voucherNo: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(
        `/vouchers/vouchers/${deleteConfirmation.contraId}`
      );
      setContras((prev) =>
        asArray(prev).filter((p) => p._id !== deleteConfirmation.contraId)
      );
      showToastMessage("Contra voucher deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchContras();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to delete contra voucher.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [
    deleteConfirmation.contraId,
    fetchContras,
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
        formRef.current.querySelector('select[name="fromAccount"]')?.focus();
    }, 10);
  }, [resetForm]);

  const handleRefresh = useCallback(() => fetchContras(true), [fetchContras]);

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

  const handleViewContra = useCallback((contra) => {
    setSelectedContra(contra);
  }, []);

  const safeContras = useMemo(() => asArray(contras), [contras]);

  const contraStats = useMemo(() => {
    const totalContras = safeContras.length;
    const totalAmount = safeContras.reduce(
      (sum, p) => sum + (Number(p.totalAmount ?? p.amount) || 0),
      0
    );
    const todayContras = safeContras.filter(
      (p) => new Date(p.date).toDateString() === new Date().toDateString()
    ).length;
    const avgAmount = totalContras ? totalAmount / totalContras : 0;
    return { totalContras, totalAmount, todayContras, avgAmount };
  }, [safeContras]);

  const sortedAndFilteredContras = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let filtered = safeContras.filter((p) => {
      const voucherNo = p.voucherNo?.toLowerCase() || "";
      const narration = p.narration?.toLowerCase() || "";
      return voucherNo.includes(term) || narration.includes(term);
    });
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const av =
          sortConfig.key === "amount"
            ? Number(a.totalAmount ?? a.amount)
            : sortConfig.key === "date"
            ? new Date(a.date).getTime()
            : a[sortConfig.key];
        const bv =
          sortConfig.key === "amount"
            ? Number(b.totalAmount ?? b.amount)
            : sortConfig.key === "date"
            ? new Date(b.date).getTime()
            : b[sortConfig.key];
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
  }, [safeContras, searchTerm, sortConfig]);

  if (selectedContra) {
    return (
      <ContraVoucherView
        selectedContra={selectedContra}
        transactors={transactors}
        setSelectedContra={setSelectedContra}
        showToastMessage={showToastMessage}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle
            size={48}
            className="text-purple-600 animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg">Loading contra vouchers...</p>
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
        No contra vouchers found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm
          ? "No contra vouchers match your current filters. Try adjusting your search criteria."
          : "Start recording transfers by creating your first contra voucher."}
      </p>
      <button
        onClick={openAddModal}
        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
      >
        <Plus size={20} /> Create First Contra
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
            <h1 className="text-3xl font-bold text-black">Contra Voucher</h1>
            <p className="text-gray-600 mt-1">
              {contraStats.totalContras} total transfers •{" "}
              {sortedAndFilteredContras.length} displayed
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
            title="Total Transfers"
            count={contraStats.totalContras}
            icon={<Receipt size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText="All time records"
          />
          <StatCard
            title="Today's Transfers"
            count={contraStats.todayContras}
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
            count={formatCurrency(
              contraStats.totalAmount,
              "text-purple-700",
              true
            )}
            icon={<TrendingUp size={24} />}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
            borderColor="border-purple-200"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            subText="All transferred amounts"
          />
          <StatCard
            title="Avg Transfer Value"
            count={formatCurrency(
              contraStats.avgAmount,
              "text-indigo-700",
              true
            )}
            icon={<Banknote size={24} />}
            bgColor="bg-indigo-50"
            textColor="text-indigo-700"
            borderColor="border-indigo-200"
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
            subText="Per transfer average"
          />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Contra Vouchers
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage contra vouchers and transfers
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} /> Add Contra
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
                placeholder="Search by voucher number or narration..."
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
          </div>
        </div>
        {sortedAndFilteredContras.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "voucherNo", label: "Voucher No" },
                    { key: "date", label: "Date" },
                    { key: "fromAccount", label: "From Account" },
                    { key: "toAccount", label: "To Account" },
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
                {sortedAndFilteredContras.map((p) => (
                  <tr
                    key={p._id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <button
                        onClick={() => handleViewContra(p)}
                        className="text-blue-600 hover:underline"
                      >
                        {p.voucherNo}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(p.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {iconForAccount(p.fromAccount, transactors)}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${badgeClassForAccount(
                            p.fromAccount,
                            transactors
                          )}`}
                        >
                          {displayAccount(p.fromAccount, transactors)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {iconForAccount(p.toAccount, transactors)}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${badgeClassForAccount(
                            p.toAccount,
                            transactors
                          )}`}
                        >
                          {displayAccount(p.toAccount, transactors)}
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
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          title="Edit contra"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(p)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Delete contra"
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
                Delete Contra Voucher
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
                      <AlertCircle size={16} className="mr-2 animate-spin" />{" "}
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
                  {editContraId ? "Edit Contra Voucher" : "Add Contra Voucher"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {editContraId
                      ? "Update contra voucher information"
                      : "Create a new contra voucher"}
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
                {editContraId && (
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
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Building size={16} className="inline mr-2" /> From Account
                    *
                  </label>
                  <Select
                    options={transactors}
                    getOptionLabel={(option) => option.accountName}
                    getOptionValue={(option) => option._id}
                    value={formData.fromAccount}
                    onChange={(selected) => {
                      setFormData((prev) => ({
                        ...prev,
                        fromAccount: selected,
                      }));
                      setErrors((prev) => ({
                        ...prev,
                        fromAccount: "",
                        toAccount:
                          formData.toAccount &&
                          formData.toAccount._id === selected?._id
                            ? "From and To accounts must be different"
                            : prev.toAccount,
                      }));
                    }}
                    placeholder="Search and select from account..."
                    isSearchable
                  />
                  {errors.fromAccount && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />{" "}
                      {errors.fromAccount}
                    </p>
                  )}
                  {formData.fromAccount && (
                    <p className="mt-2 text-sm text-gray-600">
                      Current Balance:{" "}
                      {formatCurrency(formData.fromAccount.currentBalance)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Building size={16} className="inline mr-2" /> To Account *
                  </label>
                  <Select
                    options={transactors.filter(
                      (t) => t._id !== formData.fromAccount?._id
                    )}
                    getOptionLabel={(option) => option.accountName}
                    getOptionValue={(option) => option._id}
                    value={formData.toAccount}
                    onChange={(selected) => {
                      setFormData((prev) => ({ ...prev, toAccount: selected }));
                      setErrors((prev) => ({
                        ...prev,
                        toAccount:
                          formData.fromAccount &&
                          formData.fromAccount._id === selected?._id
                            ? "From and To accounts must be different"
                            : "",
                      }));
                    }}
                    placeholder="Search and select to account..."
                    isSearchable
                  />
                  {errors.toAccount && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />{" "}
                      {errors.toAccount}
                    </p>
                  )}
                  {formData.toAccount && (
                    <p className="mt-2 text-sm text-gray-600">
                      Current Balance:{" "}
                      {formatCurrency(formData.toAccount.currentBalance)}
                    </p>
                  )}
                </div>
                <FormInput
                  label="Amount"
                  icon={DollarSign}
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  error={errors.amount}
                  required
                />
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FileText size={16} className="inline mr-2" /> Notes
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
                      <AlertCircle size={16} className="mr-2 animate-spin" />{" "}
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />{" "}
                      {editContraId ? "Update Contra" : "Save Contra"}
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

export default ContraVoucherManagement;
