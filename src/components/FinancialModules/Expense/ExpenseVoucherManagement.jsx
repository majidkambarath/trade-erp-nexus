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
  LinkIcon,
  Loader2,
  Upload,
  Eye,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import axiosInstance from "../../../axios/axios"; // Ensure this path is correct
import DirhamIcon from "../../../assets/dirham.svg";

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

const FormSelect = ({
  label,
  icon: Icon,
  error,
  options,
  onAddNew,
  data,
  hierarchical = false,
  ...props
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const dropdownRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!hierarchical) {
      return options.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = [];

    // Filter main categories
    options.forEach((mainCategory) => {
      const matchingMain = mainCategory.label.toLowerCase().includes(searchLower);
      const matchingSub = mainCategory.subCategories?.some(sub =>
        sub.label.toLowerCase().includes(searchLower)
      );

      if (matchingMain || matchingSub) {
        filtered.push({
          ...mainCategory,
          subCategories: mainCategory.subCategories?.filter(sub =>
            sub.label.toLowerCase().includes(searchLower)
          ) || []
        });
      }
    });

    return filtered;
  }, [options, searchTerm, hierarchical]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleCategoryExpansion = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const findSelectedLabel = useCallback((value) => {
    if (!hierarchical) {
      return options.find((opt) => opt.value === value)?.label || "Select an expense type";
    }

    // Search in sub-categories first
    for (const mainCat of options) {
      const subCat = mainCat.subCategories?.find(sub => sub.value === value);
      if (subCat) return subCat.label;
    }

    // Then check main categories
    return options.find((opt) => opt.value === value)?.label || "Select an expense type";
  }, [options, hierarchical]);

  const handleCategorySelect = (value, isSubCategory = false, mainCategoryId = null) => {
    props.onChange({
      target: {
        name: props.name,
        value,
        mainCategoryId
      }
    });
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        <Icon size={16} className="inline mr-2" /> {label} *
      </label>
      <div className="relative">
        <div
          className={`w-full px-4 py-3 border rounded-xl focus-within:ring-2 focus-within:ring-purple-500 focus-within:border-transparent transition-all duration-200 ${
            error ? "border-red-300 bg-red-50" : "border-gray-300"
          } bg-white cursor-pointer flex items-center justify-between`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-sm text-gray-900">
            {findSelectedLabel(props.value)}
          </span>
          {data && (
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNew();
                }}
                className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-sm hover:shadow-md"
                title="Add new expense type"
              >
                <Plus size={14} /> <span className="text-xs">New</span>
              </button>
            </div>
          )}
        </div>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-y-auto">
            {/* Search Input */}
            <div className="p-2">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search expense types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-sm"
                />
              </div>
            </div>

            {/* Categories List */}
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-2 text-sm text-gray-500">
                No expense types found
              </p>
            ) : (
              filteredOptions.map((category) => (
                <div key={category.value} className="border-b border-gray-100 last:border-b-0">
                  {/* Main Category */}
                  <div
                    className="px-4 py-3 text-sm text-gray-900 hover:bg-purple-50 cursor-pointer transition-all duration-200 flex items-center justify-between"
                    onClick={() => handleCategorySelect(category.value, false, category.value)}
                  >
                    <span className="font-medium">{category.label}</span>
                    {category.subCategories && category.subCategories.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCategoryExpansion(category.value);
                        }}
                        className="p-1 rounded hover:bg-gray-100 transition-colors"
                      >
                        {expandedCategories[category.value] ? (
                          <ChevronDown size={16} />
                        ) : (
                          <ChevronRight size={16} />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Sub Categories */}
                  {category.subCategories && category.subCategories.length > 0 && expandedCategories[category.value] && (
                    <div className="pl-8 bg-gray-50">
                      {category.subCategories.map((subCategory) => (
                        <div
                          key={subCategory.value}
                          className="px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 cursor-pointer transition-all duration-200"
                          onClick={() => handleCategorySelect(subCategory.value, true, category.value)}
                        >
                          <span className="ml-2">└ {subCategory.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center">
          <AlertCircle size={12} className="mr-1" /> {error}
        </p>
      )}
    </div>
  );
};

const FormFileUpload = ({ label, icon: Icon, error, ...props }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      <Icon size={16} className="inline mr-2" /> {label}
    </label>
    <input
      type="file"
      accept="application/pdf,image/jpeg,image/png"
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

const FormTextArea = ({ label, icon: Icon, error, ...props }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      <Icon size={16} className="inline mr-2" /> {label}
    </label>
    <textarea
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
  key: (k) => `expense_voucher_${k}`,
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
      if (k.startsWith("expense_voucher_")) delete SessionManager.storage[k];
    });
  },
};

const asArray = (x) => (Array.isArray(x) ? x : []);
const takeArray = (resp) => {
  if (!resp) return [];
  const d = resp.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data?.expenseTypes)) return d.data.expenseTypes;
  if (Array.isArray(d?.expenseTypes)) return d.expenseTypes;
  if (Array.isArray(d?.data)) return d.data;
  return [];
};
const by = (value) => (value || "").toString().toLowerCase();
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

const ExpenseVoucherManagement = () => {
  const [vouchers, setVouchers] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [transactors, setTransactors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(
    SessionManager.get("searchTerm") || ""
  );
  const [editVoucherId, setEditVoucherId] = useState(null);
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    isSubCategory: false,
    parentCategory: ""
  });
  const [categoryErrors, setCategoryErrors] = useState({});
  const [formData, setFormData] = useState({
    expenseCategory: "",
    mainExpenseCategory: "",
    transactor: "",
    amount: "",
    description: "",
    attachReceipt: null,
    date: new Date().toISOString().split("T")[0],
    submittedBy: "Logged-in User",
    approvalStatus: "Pending",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    voucherId: null,
    voucherNo: "",
    isDeleting: false,
  });
  const [categoryDeleteConfirmation, setCategoryDeleteConfirmation] = useState({
    visible: false,
    categoryId: null,
    categoryName: "",
    isDeleting: false,
    associatedVouchers: [],
    errorMessage: "",
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const formRef = useRef(null);
  const categoryFormRef = useRef(null);

  useEffect(() => {
    const savedFormData = SessionManager.get("formData");
    if (savedFormData && typeof savedFormData === "object") {
      setFormData((prev) => ({ ...prev, ...savedFormData }));
    }
    fetchVouchers();
    fetchExpenseCategories();
    fetchTransactors();
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
  }, [searchTerm]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      2800
    );
  }, []);

  const fetchExpenseCategories = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/expense/categories");
      const categories = takeArray(response).map((category) => ({
        value: category._id,
        label: category.name,
        subCategories: category.subCategories?.map(sub => ({
          value: sub._id,
          label: sub.name,
          parentId: category._id
        })) || [],
        isMainCategory: true
      }));
      setExpenseCategories(categories);
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to fetch expense categories.",
        "error"
      );
      setExpenseCategories([]);
    }
  }, [showToastMessage]);

  const fetchVouchers = useCallback(
    async (showRefreshIndicator = false) => {
      try {
        showRefreshIndicator ? setIsRefreshing(true) : setIsLoading(true);
        const response = await axiosInstance.get("/vouchers/vouchers", {
          params: { voucherType: "expense" },
        });
        const vouchersData = takeArray(response).filter(
          (info) => info.status !== "cancelled"
        );
        setVouchers(vouchersData);
        if (showRefreshIndicator) showToastMessage("Data refreshed", "success");
      } catch (err) {
        showToastMessage(
          err.response?.data?.message || "Failed to fetch expense vouchers.",
          "error"
        );
        setVouchers([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showToastMessage]
  );

  const fetchTransactors = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axiosInstance.get("/account-v2/Transactor");
      const transactorData = res.data.data.map((t) => ({
        value: t._id,
        label: `${t.accountName} (${t.accountCode})`,
        accountType: t.accountType,
      }));
      setTransactors(transactorData);
      if (!formData.transactor && transactorData.length > 0) {
        const expenseTransactor = transactorData.find(
          (t) => t.accountType === "expense"
        );
        setFormData((prev) => ({
          ...prev,
          transactor: expenseTransactor
            ? expenseTransactor.value
            : transactorData[0].value,
        }));
      }
    } catch (err) {
      showToastMessage("Failed to fetch transactors.", "error");
      setTransactors([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToastMessage]);

  const fetchAssociatedVouchers = useCallback(async (categoryId) => {
    try {
      const response = await axiosInstance.get("/vouchers/vouchers", {
        params: { expenseCategory: categoryId },
      });
      return takeArray(response);
    } catch (err) {
      console.error("Failed to fetch associated vouchers:", err);
      return [];
    }
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value, files } = e.target;

    // Handle hierarchical category selection
    if (name === "expenseCategory" && "mainCategoryId" in e.target) {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        mainExpenseCategory: e.target.mainCategoryId
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: files ? files[0] : value,
      }));
    }

    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const handleCategoryChange = useCallback((e) => {
    const { name, value } = e.target;
    setCategoryForm((prev) => ({ ...prev, [name]: value }));
    setCategoryErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const validateForm = useCallback(() => {
    const e = {};
    if (!formData.mainExpenseCategory) e.mainExpenseCategory = "Main category is required";
    if (!formData.expenseCategory) e.expenseCategory = "Expense category is required";
    if (!formData.transactor) e.transactor = "Transactor is required";
    if (!formData.amount || Number(formData.amount) <= 0)
      e.amount = "Amount must be greater than 0";
    if (!formData.date) e.date = "Date is required";
    return e;
  }, [formData]);

  const validateCategoryForm = useCallback(() => {
    const e = {};
    if (!categoryForm.name.trim()) e.name = "Category name is required";
    if (categoryForm.isSubCategory && !categoryForm.parentCategory) {
      e.parentCategory = "Parent category is required for sub-categories";
    }
    return e;
  }, [categoryForm]);

  const resetForm = useCallback(() => {
    setEditVoucherId(null);
    setFormData({
      expenseCategory: "",
      mainExpenseCategory: "",
      transactor: transactors[0]?.value || "",
      amount: "",
      description: "",
      attachReceipt: null,
      date: new Date().toISOString().split("T")[0],
      submittedBy: "Logged-in User",
      approvalStatus: "Pending",
    });
    setErrors({});
    setShowModal(false);
    SessionManager.remove("formData");
    SessionManager.remove("lastSaveTime");
  }, [transactors]);

  const resetCategoryForm = useCallback(() => {
    setEditCategoryId(null);
    setCategoryForm({ name: "", isSubCategory: false, parentCategory: "" });
    setCategoryErrors({});
    setShowCategoryModal(false);
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
        mainExpenseCategoryId: formData.mainExpenseCategory,
        expenseCategoryId: formData.expenseCategory ,
        transactorId: formData.transactor,
        voucherType: "expense",
        totalAmount: Number(formData.amount),
        description: formData.description,
        date: formData.date,
        submittedBy: formData.submittedBy,
        approvalStatus: formData.approvalStatus,
      };

      if (formData.attachReceipt) {
        const formDataToSend = new FormData();
        Object.keys(payload).forEach((key) =>
          formDataToSend.append(key, payload[key])
        );
        formDataToSend.append("attachedProof", formData.attachReceipt);
        if (editVoucherId) {
          await axiosInstance.put(
            `/vouchers/vouchers/${editVoucherId}`,
            formDataToSend,
            {
              headers: { "Content-Type": "multipart/form-data" },
            }
          );
          showToastMessage("Expense voucher updated successfully!", "success");
        } else {
          await axiosInstance.post("/vouchers/vouchers", formDataToSend, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          showToastMessage("Expense voucher created successfully!", "success");
        }
      } else {
        if (editVoucherId) {
          await axiosInstance.put(
            `/vouchers/vouchers/${editVoucherId}`,
            payload
          );
          showToastMessage("Expense voucher updated successfully!", "success");
        } else {
          await axiosInstance.post("/vouchers/vouchers", payload);
          showToastMessage("Expense voucher created successfully!", "success");
        }
      }
      await fetchVouchers();
      resetForm();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to save expense voucher.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    editVoucherId,
    formData,
    fetchVouchers,
    resetForm,
    showToastMessage,
    validateForm,
  ]);

  const handleCategorySubmit = useCallback(async () => {
    const e = validateCategoryForm();
    if (Object.keys(e).length) {
      setCategoryErrors(e);
      return;
    }
    setIsCategorySubmitting(true);
    try {
      const payload = {
        name: categoryForm.name,
        parentCategoryId: categoryForm.isSubCategory ? categoryForm.parentCategory : null
      };
      let newCategoryId;
      if (editCategoryId) {
        await axiosInstance.put(
          `/expense/categories/${editCategoryId}`,
          payload
        );
        showToastMessage("Expense category updated successfully!", "success");
      } else {
        const response = await axiosInstance.post(
          "/expense/categories",
          payload
        );
        newCategoryId = response.data.data.category._id;
        showToastMessage("Expense category created successfully!", "success");
      }
      await fetchExpenseCategories();
      if (!editCategoryId && !categoryForm.isSubCategory) {
        setFormData((prev) => ({
          ...prev,
          mainExpenseCategory: newCategoryId
        }));
      }
      resetCategoryForm();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || "Failed to save expense category.";
      showToastMessage(errorMessage, "error");
      setCategoryErrors((prev) => ({
        ...prev,
        name: errorMessage.includes("already exists")
          ? "Category name already exists"
          : errorMessage,
      }));
    } finally {
      setIsCategorySubmitting(false);
    }
  }, [
    editCategoryId,
    categoryForm,
    fetchExpenseCategories,
    resetCategoryForm,
    showToastMessage,
    validateCategoryForm,
  ]);

  const handleEdit = useCallback(
    (voucher) => {
      setEditVoucherId(voucher._id);
      setFormData({
        expenseCategory: voucher.expenseCategory?._id || voucher.expenseCategory || "",
        mainExpenseCategory: voucher.mainExpenseCategory?._id || voucher.mainExpenseCategory || "",
        transactor: voucher.transactor?._id || voucher.transactor || transactors[0]?.value || "",
        amount: String(voucher.totalAmount || 0),
        description: voucher.description || "",
        attachReceipt: null,
        date: voucher.date
          ? new Date(voucher.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        submittedBy: voucher.submittedBy || "Logged-in User",
        approvalStatus: voucher.approvalStatus || "Pending",
      });
      setShowModal(true);
      SessionManager.remove("formData");
      SessionManager.remove("lastSaveTime");
    },
    [transactors]
  );

  const handleEditCategory = useCallback((category) => {
    setEditCategoryId(category.value);
    setCategoryForm({
      name: category.label,
      isSubCategory: !!category.parentId,
      parentCategory: category.parentId || ""
    });
    setShowCategoryModal(true);
  }, []);

  const showDeleteConfirmation = useCallback((voucher) => {
    setDeleteConfirmation({
      visible: true,
      voucherId: voucher._id,
      voucherNo: voucher.voucherNo,
      isDeleting: false,
    });
  }, []);

  const showCategoryDeleteConfirmation = useCallback((category) => {
    setCategoryDeleteConfirmation({
      visible: true,
      categoryId: category.value,
      categoryName: category.label,
      isDeleting: false,
      associatedVouchers: [],
      errorMessage: "",
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      voucherId: null,
      voucherNo: "",
      isDeleting: false,
    });
  }, []);

  const hideCategoryDeleteConfirmation = useCallback(() => {
    setCategoryDeleteConfirmation({
      visible: false,
      categoryId: null,
      categoryName: "",
      isDeleting: false,
      associatedVouchers: [],
      errorMessage: "",
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(
        `/vouchers/vouchers/${deleteConfirmation.voucherId}`
      );
      setVouchers((prev) =>
        asArray(prev).filter((p) => p._id !== deleteConfirmation.voucherId)
      );
      showToastMessage("Expense voucher deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchVouchers();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to delete expense voucher.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [
    deleteConfirmation.voucherId,
    fetchVouchers,
    hideDeleteConfirmation,
    showToastMessage,
  ]);

  const confirmCategoryDelete = useCallback(async () => {
    setCategoryDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(
        `/expense/categories/${categoryDeleteConfirmation.categoryId}`
      );
      setExpenseCategories((prev) =>
        prev.filter(
          (category) => category.value !== categoryDeleteConfirmation.categoryId
        )
      );
      setFormData((prev) => ({
        ...prev,
        expenseCategory: "",
        mainExpenseCategory: expenseCategories[0]?.value || "",
      }));
      showToastMessage("Expense category deleted successfully!", "success");
      hideCategoryDeleteConfirmation();
      await fetchExpenseCategories();
    } catch (err) {
      const errorMessage =
        err.response?.data?.message || "Failed to delete expense category.";
      if (errorMessage.includes("associated expense vouchers")) {
        const associatedVouchers = await fetchAssociatedVouchers(
          categoryDeleteConfirmation.categoryId
        );
        setCategoryDeleteConfirmation((prev) => ({
          ...prev,
          isDeleting: false,
          associatedVouchers,
          errorMessage: `Cannot delete "${prev.categoryName}" because it is used by ${associatedVouchers.length} expense voucher(s).`,
        }));
      } else {
        showToastMessage(errorMessage, "error");
        setCategoryDeleteConfirmation((prev) => ({
          ...prev,
          isDeleting: false,
          errorMessage,
        }));
      }
    }
  }, [
    categoryDeleteConfirmation.categoryId,
    categoryDeleteConfirmation.categoryName,
    fetchAssociatedVouchers,
    fetchExpenseCategories,
    hideCategoryDeleteConfirmation,
    showToastMessage,
    expenseCategories,
  ]);

  const openAddModal = useCallback(() => {
    resetForm();
    setShowModal(true);
    setTimeout(() => {
      const modal = document.querySelector(".modal-container");
      if (modal) modal.classList.add("scale-100");
      if (formRef.current)
        formRef.current.querySelector('div[role="combobox"]')?.focus();
    }, 10);
  }, [resetForm]);

  const openCategoryModal = useCallback((isSub = false, parentId = "") => {
    resetCategoryForm();
    if (isSub && parentId) {
      setCategoryForm(prev => ({ ...prev, isSubCategory: true, parentCategory: parentId }));
    }
    setShowCategoryModal(true);
    setTimeout(() => {
      const modal = document.querySelector(".category-modal-container");
      if (modal) modal.classList.add("scale-100");
      if (categoryFormRef.current)
        categoryFormRef.current.querySelector('input[name="name"]')?.focus();
    }, 10);
  }, [resetCategoryForm]);

  const handleRefresh = useCallback(() => {
    fetchVouchers(true);
    fetchExpenseCategories();
    fetchTransactors();
  }, [fetchVouchers, fetchExpenseCategories, fetchTransactors]);

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

  const handleViewVoucher = useCallback((voucher) => {
    setSelectedVoucher(voucher);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedVoucher(null);
  }, []);

  const handleDownloadPDF = useCallback(async () => {
    try {
      setIsGeneratingPDF(true);
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const input = document.getElementById("expense-content");
      if (!input) {
        showToastMessage("Expense content not found!", "error");
        return;
      }
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: input.scrollWidth,
        height: input.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById("expense-content");
          if (clonedElement) {
            clonedElement.style.display = "block";
            clonedElement.style.visibility = "visible";
          }
        },
      });
      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(
        pdfWidth / (imgWidth * 0.264583),
        pdfHeight / (imgHeight * 0.264583)
      );
      const imgX = (pdfWidth - imgWidth * 0.264583 * ratio) / 2;
      const imgY = 0;
      pdf.addImage(
        imgData,
        "PNG",
        imgX,
        imgY,
        imgWidth * 0.264583 * ratio,
        imgHeight * 0.264583 * ratio,
        undefined,
        "FAST"
      );
      const filename = `Expense_${selectedVoucher.voucherNo}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      showToastMessage(
        "Failed to generate PDF. Please try again or use the Print option.",
        "error"
      );
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [selectedVoucher, showToastMessage]);

  const handlePrintPDF = useCallback(() => {
    const printWindow = window.open("", "_blank");
    const expenseContent = document.getElementById("expense-content");
    if (!expenseContent || !printWindow) {
      showToastMessage("Unable to open print dialog", "error");
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Expense_${selectedVoucher.voucherNo}</title>
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
            .dirham-icon { width: 10px; height: 10px; vertical-align: middle; margin-right: 2px; }
          </style>
        </head>
        <body>
          ${expenseContent.innerHTML.replace(
            /<img[^>]*src="${DirhamIcon}"[^>]*>/g,
            `<img src="${DirhamIcon}" class="dirham-icon" alt="AED">`
          )}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }, [selectedVoucher, showToastMessage]);

  const safeVouchers = useMemo(() => asArray(vouchers), [vouchers]);
  const voucherStats = useMemo(() => {
    const totalVouchers = safeVouchers.length;
    const totalAmount = safeVouchers.reduce(
      (sum, p) => sum + (Number(p.totalAmount) || 0),
      0
    );
    const todayVouchers = safeVouchers.filter(
      (p) => new Date(p.date).toDateString() === new Date().toDateString()
    ).length;
    const avgAmount = totalVouchers ? totalAmount / totalVouchers : 0;
    return { totalVouchers, totalAmount, todayVouchers, avgAmount };
  }, [safeVouchers]);

  const sortedAndFilteredVouchers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let filtered = safeVouchers.filter((p) => {
      const description = p.description?.toLowerCase() || "";
      const categoryName = p.expenseCategoryName?.toLowerCase() || "";
      const mainCategoryName = p.mainExpenseCategoryName?.toLowerCase() || "";
      return description.includes(term) ||
             categoryName.includes(term) ||
             mainCategoryName.includes(term);
    });
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const av =
          sortConfig.key === "totalAmount"
            ? Number(a.totalAmount)
            : sortConfig.key === "date"
            ? new Date(a.date).getTime()
            : by(a[sortConfig.key]);
        const bv =
          sortConfig.key === "totalAmount"
            ? Number(b.totalAmount)
            : sortConfig.key === "date"
            ? new Date(b.date).getTime()
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
  }, [safeVouchers, searchTerm, sortConfig]);

  const findCategoryDetails = useCallback((categoryId, mainCategoryId = null) => {
    if (!categoryId) return null;
    if (!mainCategoryId || categoryId === mainCategoryId) {
      const mainCategory = expenseCategories.find(cat => cat.value === categoryId);
      return mainCategory ? { name: mainCategory.label, type: 'main' } : null;
    } else {
      const mainCategory = expenseCategories.find(cat => cat.value === mainCategoryId);
      if (mainCategory) {
        const subCat = mainCategory.subCategories?.find(sub => sub.value === categoryId);
        if (subCat) return { name: subCat.label, type: 'sub', parent: mainCategory.label };
      }
      return null;
    }
  }, [expenseCategories]);

  if (selectedVoucher) {
    const categoryDetails = findCategoryDetails(
      selectedVoucher.expenseCategory?._id || selectedVoucher.expenseCategory,
      selectedVoucher.mainExpenseCategory?._id || selectedVoucher.mainExpenseCategory
    );
    const totals = { total: Number(selectedVoucher.totalAmount || 0) };
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
                <span>
                  {isGeneratingPDF ? "Generating..." : "Download PDF"}
                </span>
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
            id="expense-content"
            className="bg-white shadow-lg"
            style={{
              width: "210mm",
              minHeight: "297mm",
              margin: "0 auto",
              padding: "20mm",
              fontSize: "12px",
              lineHeight: "1.4",
              fontFamily: "Arial, sans-serif",
              color: "#000",
            }}
          >
            <div
              style={{
                textAlign: "center",
                marginBottom: "20px",
                borderBottom: "2px solid #8B5CF6",
                paddingBottom: "15px",
              }}
            >
              <h1
                style={{
                  fontSize: "14px",
                  fontWeight: "bold",
                  margin: "0 0 5px 0",
                  direction: "rtl",
                }}
              >
                نجم لتجارة المواد الغذائية ذ.م.م ش.ش.و
              </h1>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  margin: "0 0 15px 0",
                  color: "#0f766e",
                }}
              >
                NH FOODSTUFF TRADING LLC S.O.C.
              </h2>
              <div
                style={{
                  backgroundColor: "#c8a2c8",
                  color: "white",
                  padding: "8px",
                  margin: "0 -20mm 20px -20mm",
                }}
              >
                <h3
                  style={{ fontSize: "16px", fontWeight: "bold", margin: "0" }}
                >
                  EXPENSE VOUCHER
                </h3>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
                fontSize: "10px",
              }}
            >
              <div>
                <p style={{ margin: "2px 0" }}>Dubai, UAE</p>
                <p style={{ margin: "2px 0" }}>VAT Reg. No: 10503303</p>
                <p style={{ margin: "2px 0" }}>Email: finance@nhfo.com</p>
                <p style={{ margin: "2px 0" }}>Phone: +971 58 724 2111</p>
                <p style={{ margin: "2px 0" }}>Web: www.nhfo.com</p>
              </div>
              <div style={{ textAlign: "center" }}>
                <img
                  src="https://res.cloudinary.com/dmkdrwpfp/image/upload/v1755452581/erp_Uploads/NH%20foods_1755452579855.jpg"
                  alt="NH Foods Logo"
                  style={{
                    width: "80px",
                    height: "80px",
                    objectFit: "contain",
                  }}
                />
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: "2px 0" }}>
                  Date:{" "}
                  {new Date(selectedVoucher.date).toLocaleDateString("en-GB")}
                </p>
                <p style={{ margin: "2px 0" }}>
                  Voucher No: {selectedVoucher.voucherNo}
                </p>
              </div>
            </div>
            <div
              style={{
                backgroundColor: "#e6d7e6",
                padding: "10px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: "bold",
                      marginBottom: "5px",
                    }}
                  >
                    Expense Details:
                  </div>
                  <div style={{ fontSize: "10px" }}>
                    <p style={{ margin: "2px 0" }}>
                      <strong>Main Category:</strong>{" "}
                      {categoryDetails?.type === 'sub' ? categoryDetails.parent : categoryDetails?.name || "N/A"}
                    </p>
                    <p style={{ margin: "2px 0" }}>
                      <strong>Expense Category:</strong>{" "}
                      {categoryDetails?.name || "N/A"}
                    </p>
                    <p style={{ margin: "2px 0" }}>
                      <strong>Transactor:</strong>{" "}
                      {transactors.find(
                        (t) => t.value === selectedVoucher.transactor?._id
                      )?.label ||
                        selectedVoucher.transactor?.accountName ||
                        selectedVoucher.transactor}
                    </p>
                    <p style={{ margin: "2px 0" }}>
                      <strong>Submitted By:</strong>{" "}
                      {selectedVoucher.submittedBy}
                    </p>
                    <p style={{ margin: "2px 0" }}>
                      <strong>Approval Status:</strong>{" "}
                      {selectedVoucher.approvalStatus}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "20px",
                fontSize: "10px",
              }}
            ></table>
            <div
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                marginBottom: "10px",
              }}
            >
              Accounting Entries:
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginBottom: "20px",
                fontSize: "10px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#e6d7e6" }}>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    Account Name
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    Account Code
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    Debit
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody>
                {selectedVoucher.entries &&
                selectedVoucher.entries.length > 0 ? (
                  selectedVoucher.entries.map((entry, index) => (
                    <tr key={index}>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "6px",
                          textAlign: "center",
                        }}
                      >
                        {entry.accountName || "-"}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "6px",
                          textAlign: "center",
                        }}
                      >
                        {entry.accountCode || "-"}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "6px",
                          textAlign: "center",
                        }}
                      >
                        {formatCurrency(entry.debitAmount, "text-black")}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "6px",
                          textAlign: "center",
                        }}
                      >
                        {formatCurrency(entry.creditAmount, "text-black")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      No entries available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {selectedVoucher.attachReceipt && (
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontSize: "10px", fontWeight: "bold" }}>
                  Attached Receipt:
                </p>
                <a
                  href={selectedVoucher.attachReceipt}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "10px" }}
                >
                  View Receipt
                </a>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <div style={{ width: "45%" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "bold",
                    marginBottom: "10px",
                  }}
                >
                  Prepared by:
                </div>
                <div style={{ fontSize: "10px", lineHeight: "1.5" }}>
                  <p style={{ margin: "2px 0" }}>
                    Name: {selectedVoucher.submittedBy}
                  </p>
                  <p style={{ margin: "2px 0" }}>
                    Date: {new Date().toLocaleDateString("en-GB")}
                  </p>
                </div>
              </div>
              <div style={{ width: "40%" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "10px",
                  }}
                >
                  <tr>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "8px",
                        textAlign: "right",
                        fontWeight: "bold",
                      }}
                    >
                      Total
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "8px",
                        textAlign: "center",
                      }}
                    >
                      {formatCurrency(totals.total, "text-black")}
                    </td>
                  </tr>
                </table>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                marginBottom: "20px",
              }}
            >
              <div style={{ fontSize: "10px", lineHeight: "1.5" }}>
                <p style={{ margin: "2px 0" }}>
                  <strong>Approved by:</strong> [Approver Name]
                </p>
                <p style={{ margin: "2px 0" }}>
                  <strong>Date:</strong>{" "}
                  {new Date().toLocaleDateString("en-GB")}
                </p>
              </div>
              <div
                style={{
                  border: "2px solid #000",
                  padding: "10px 20px",
                  backgroundColor: "#f9f9f9",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "15px" }}
                >
                  <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                    GRAND TOTAL
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                    {formatCurrency(totals.total, "text-black")}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ marginTop: "30px" }}>
              <div style={{ textAlign: "center", marginBottom: "30px" }}>
                <p style={{ fontSize: "11px", margin: "0" }}>
                  Expense recorded in good order.
                </p>
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
          <p className="text-gray-600 text-lg">Loading expense vouchers...</p>
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
        No expense vouchers found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm
          ? "No expense vouchers match your current filters. Try adjusting your search criteria."
          : "Start recording expenses by creating your first expense voucher."}
      </p>
      <button
        onClick={openAddModal}
        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
      >
        <Plus size={20} /> Create First Expense
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
            <h1 className="text-3xl font-bold text-black">Expense Voucher</h1>
            <p className="text-gray-600 mt-1">
              {voucherStats.totalVouchers} total expenses •{" "}
              {sortedAndFilteredVouchers.length} displayed
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
            title="Total Expenses"
            count={voucherStats.totalVouchers}
            icon={<Receipt size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText="All time records"
          />
          <StatCard
            title="Today's Expenses"
            count={voucherStats.todayVouchers}
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
              voucherStats.totalAmount,
              "text-purple-700",
              true
            )}
            icon={<TrendingUp size={24} />}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
            borderColor="border-purple-200"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            subText="All expense amounts"
          />
          <StatCard
            title="Avg Expense Value"
            count={formatCurrency(
              voucherStats.avgAmount,
              "text-indigo-700",
              true
            )}
            icon={<Banknote size={24} />}
            bgColor="bg-indigo-50"
            textColor="text-indigo-700"
            borderColor="border-indigo-200"
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
            subText="Per expense average"
          />
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Expense Vouchers
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage expense vouchers and records
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} /> Add Expense
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
                placeholder="Search by description, category..."
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
        {sortedAndFilteredVouchers.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "mainExpenseCategory", label: "Main Category" },
                    { key: "expenseCategory", label: "Category" },
                    { key: "transactor", label: "Transactor" },
                    { key: "date", label: "Date" },
                    { key: "totalAmount", label: "Total Amount" },
                    { key: "entries", label: "Debit" },
                    { key: "entries", label: "Credit" },
                    { key: "description", label: "Description" },
                    { key: "submittedBy", label: "Submitted By" },
                    { key: "approvalStatus", label: "Approval Status" },
                    { key: null, label: "Actions" },
                  ].map((col) => (
                    <th
                      key={col.key ? `${col.key}-${col.label}` : "actions"}
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
                {sortedAndFilteredVouchers.map((p) => {
                  const debitTotal = p.entries?.reduce(
                    (sum, entry) => sum + (Number(entry.debitAmount) || 0),
                    0
                  );
                  const creditTotal = p.entries?.reduce(
                    (sum, entry) => sum + (Number(entry.creditAmount) || 0),
                    0
                  );

                  // Find category details for display
                  const categoryDetails = findCategoryDetails(
                    p.expenseCategory?._id || p.expenseCategory,
                    p.mainExpenseCategory?._id || p.mainExpenseCategory
                  );

                  return (
                    <tr
                      key={p._id}
                      className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        <button
                          onClick={() => handleViewVoucher(p)}
                          className="text-blue-600 hover:underline"
                        >
                          {categoryDetails?.type === 'sub' ? categoryDetails.parent : categoryDetails?.name || p.mainExpenseCategoryName || "-"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {categoryDetails?.name || p.expenseCategoryName || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {p.transactorName || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(p.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {formatCurrency(p.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {formatCurrency(debitTotal)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {formatCurrency(creditTotal)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {p.description || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {p.submittedBy || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {p.approvalStatus || "-"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleEdit(p)}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                            title="Edit expense"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => showDeleteConfirmation(p)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                            title="Delete expense"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Main Modal for Expense Voucher */}
      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editVoucherId
                    ? "Edit Expense Voucher"
                    : "Add Expense Voucher"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {editVoucherId
                      ? "Update expense voucher information"
                      : "Create a new expense voucher"}
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
                <FormSelect
                  label="Expense Category"
                  icon={Building}
                  name="expenseCategory"
                  value={formData.expenseCategory}
                  onChange={handleChange}
                  hierarchical={true}
                  error={errors.expenseCategory}
                  options={expenseCategories}
                  data={true}
                  onAddNew={() => openCategoryModal(!!formData.mainExpenseCategory, formData.mainExpenseCategory)}
                />
                <FormSelect
                  label="Transactor"
                  icon={CreditCard}
                  name="transactor"
                  value={formData.transactor}
                  onChange={handleChange}
                  error={errors.transactor}
                  options={transactors.filter(
                    (t) => t.accountType === "expense"
                  )}
                  data={false}
                />
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
                  <FormTextArea
                    label="Description"
                    icon={FileText}
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Enter details or justification for the expense..."
                  />
                </div>
                <FormFileUpload
                  label="Attach Receipt"
                  icon={Upload}
                  name="attachReceipt"
                  onChange={handleChange}
                />
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
                <FormInput
                  label="Submitted By"
                  icon={User}
                  name="submittedBy"
                  value={formData.submittedBy}
                  onChange={handleChange}
                  disabled
                />
                <FormInput
                  label="Approval Status"
                  icon={CheckCircle}
                  name="approvalStatus"
                  value={formData.approvalStatus}
                  onChange={handleChange}
                  disabled={!editVoucherId || formData.submittedBy !== "Admin"}
                />
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
                      {editVoucherId ? "Update Expense" : "Save Expense"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 category-modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editCategoryId ? "Edit Expense Category" : "Add Expense Category"}
                </h3>
                <p className="text-gray-600 text-sm mt-1">
                  {editCategoryId
                    ? "Update expense category information"
                    : "Create a new expense category"}
                </p>
              </div>
              <button
                onClick={resetCategoryForm}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
              >
                <X size={22} />
              </button>
            </div>
            <div className="p-6" ref={categoryFormRef}>
              {/* Category Type Toggle */}
              <div className="mb-6">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoryForm.isSubCategory}
                    onChange={(e) => {
                      setCategoryForm(prev => ({
                        ...prev,
                        isSubCategory: e.target.checked,
                        parentCategory: e.target.checked ? prev.parentCategory : ""
                      }));
                    }}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Create Sub-Category
                  </span>
                </label>
                {categoryForm.isSubCategory && (
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Sub-categories must be nested under a main category
                  </p>
                )}
              </div>
              {/* Category Name Input */}
              <FormInput
                label={categoryForm.isSubCategory ? "Sub-Category Name" : "Main Category Name"}
                icon={Building}
                name="name"
                value={categoryForm.name}
                onChange={handleCategoryChange}
                error={categoryErrors.name}
                required
                placeholder={`Enter ${categoryForm.isSubCategory ? 'sub-' : 'main '}category name`}
              />
              {/* Parent Category Selector for Sub-Categories */}
              {categoryForm.isSubCategory && (
                <FormSelect
                  label="Parent Category"
                  icon={Building}
                  name="parentCategory"
                  value={categoryForm.parentCategory}
                  onChange={handleCategoryChange}
                  error={categoryErrors.parentCategory}
                  hierarchical={false}
                  options={expenseCategories.filter(cat => cat.isMainCategory)}
                  placeholder="Select parent category"
                />
              )}
              {/* Existing Categories List */}
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Existing Categories
                </h4>
                <div className="bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto">
                  {expenseCategories.length === 0 ? (
                    <p className="text-gray-600 text-sm">
                      No categories available. Add one above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {expenseCategories.map((mainCategory) => (
                        <div key={mainCategory.value} className="mb-4">
                          {/* Main Category */}
                          <div className="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm hover:bg-gray-100 transition-all duration-200 mb-2">
                            <span className="text-sm font-medium text-gray-900">
                              📁 {mainCategory.label}
                            </span>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleEditCategory(mainCategory)}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                title="Edit main category"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => showCategoryDeleteConfirmation(mainCategory)}
                                className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                                title="Delete main category"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Sub Categories */}
                          {mainCategory.subCategories && mainCategory.subCategories.length > 0 && (
                            <div className="ml-6 space-y-1">
                              {mainCategory.subCategories.map((subCategory) => (
                                <div
                                  key={subCategory.value}
                                  className="flex justify-between items-center p-2 bg-blue-50 rounded-lg shadow-sm hover:bg-blue-100 transition-all duration-200"
                                >
                                  <span className="text-sm text-gray-700">
                                    └─ {subCategory.label}
                                  </span>
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => handleEditCategory(subCategory)}
                                      className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                      title="Edit sub-category"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      onClick={() => showCategoryDeleteConfirmation(subCategory)}
                                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                                      title="Delete sub-category"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Sub-Category Button */}
                          <button
                            onClick={() => openCategoryModal(true, mainCategory.value)}
                            className="ml-6 text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                          >
                            <Plus size={12} />
                            <span>Add Sub-Category</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-8">
                <button
                  onClick={resetCategoryForm}
                  disabled={isCategorySubmitting}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCategorySubmit}
                  disabled={isCategorySubmitting}
                  className="px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  {isCategorySubmitting ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />{" "}
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="mr-2" />{" "}
                      {editCategoryId ? "Update Category" : "Save Category"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modals */}
      {categoryDeleteConfirmation.visible && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Expense Category
              </h3>
              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-4">
                "{categoryDeleteConfirmation.categoryName}"?
              </p>
              {categoryDeleteConfirmation.errorMessage && (
                <div className="mb-4">
                  <p className="text-sm text-red-600 text-center mb-2">
                    {categoryDeleteConfirmation.errorMessage}
                  </p>
                  {categoryDeleteConfirmation.associatedVouchers.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                      <p className="text-sm font-semibold text-gray-700 mb-2">
                        Associated Vouchers:
                      </p>
                      <ul className="space-y-1">
                        {categoryDeleteConfirmation.associatedVouchers.map(
                          (voucher) => (
                            <li
                              key={voucher._id}
                              className="text-sm text-gray-600"
                            >
                              <button
                                onClick={() => {
                                  hideCategoryDeleteConfirmation();
                                  handleViewVoucher(voucher);
                                }}
                                className="text-blue-600 hover:underline"
                              >
                                Voucher #{voucher.voucherNo} -{" "}
                                {voucher.description || "No description"}
                              </button>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm text-gray-500 text-center mb-6">
                This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={hideCategoryDeleteConfirmation}
                  disabled={categoryDeleteConfirmation.isDeleting}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCategoryDelete}
                  disabled={
                    categoryDeleteConfirmation.isDeleting ||
                    categoryDeleteConfirmation.associatedVouchers.length > 0
                  }
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  {categoryDeleteConfirmation.isDeleting ? (
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
                Delete Expense Voucher
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
    </div>
  );
};

export default ExpenseVoucherManagement;