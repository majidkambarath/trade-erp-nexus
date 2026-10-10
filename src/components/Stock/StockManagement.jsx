import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Barcode,
  Tag,
  Banknote,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Box,
  Layers,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  Clock,
  ArrowLeft,
  AlertCircle,
  Truck,
  Globe, // Added for Origin
  Star, // Added for Brand
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import BarcodeGenerator from "react-barcode";
import { toInputDate, formatDate, formatTime, formatCurrencyAED, downloadCSV } from "../../utils/format";
import { toastClasses } from "../../lib/status";
import { pageSession } from "../../lib/pageSession";
import StatCard from "../ui/stat-card";

import { DateInput, Field, SearchSelect } from "../accounting/kit";
import { DataTable } from "../accounting/DataTable";
import FilterBar, { FilterSelect } from "../lists/FilterBar";
import Can from "../shell/Can";
import { useOrganisation } from "../shell/OrganisationContext";
import { ItemTypeToggle, ServiceAccountFields } from "./ItemTypeFields";
import {
  buildItemPayload, emptyItemForm, isService, itemFormFromStock, itemStats, matchesType, stockLevelText, switchItemType, validateItemForm,
} from "../../lib/itemTypes";

// What this screen keeps while the person visits another page and comes back (lib/pageSession.js): the search, the filters, the
// sort, and a half-filled NEW item. Held in memory for the tab; emptied at sign-out. Keys: searchTerm, filters, sort, formData,
// lastSaveTime, autoSku.
const session = pageSession("stock-items");

// Has the person typed anything? The item type is always set, and the status opens on "Active", so neither counts: a form that
// still holds only what it opened with is not a draft.
const hasContent = (form) => {
  const blank = emptyItemForm(form.itemType);
  return Object.entries(form).some(([key, value]) => key !== "itemType" && value && value !== blank[key]);
};

// A typed-into list is 40px tall (kit.jsx), the plain controls beside it 44px on touch and 40px from `lg`: this brings the two to one
// height in the filter row, so a phone does not draw a row of controls of two sizes. The list's own styles are not in a cascade
// layer, which beats any utility, hence the `!`. (`\_` is Tailwind's escape for a literal underscore in an arbitrary variant; String.raw
// keeps the backslash.)
const TOUCH_HEIGHT = String.raw`[&_.search-select\_\_control]:min-h-11! lg:[&_.search-select\_\_control]:min-h-10!`;

// The distinct names a filter can offer, in order, plus the one currently chosen (a choice kept from before, or whose items were
// all deleted since, must still be visible on the control: it is still filtering).
const namesFor = (names, chosen) =>
  [...new Set([...names, chosen].filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((name) => ({ value: name, label: name }));

// FormSelect Component (unchanged)
const FormSelect = ({
  label,
  // eslint-disable-next-line no-unused-vars -- used as a JSX element (<Icon />), which core no-unused-vars cannot see
  icon: Icon,
  error,
  options,
  onAddNew,
  data,
  ...props
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
            {options.find((opt) => opt.value === props.value)?.label ||
              `Select ${label.toLowerCase()}`}
          </span>
          {data && (
            <div className="flex items-center space-x-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddNew();
                }}
                className="erp-btn-primary"
                title={`Add new ${label.toLowerCase()}`}
              >
                <Plus size={14} /> <span className="text-xs">New</span>
              </button>
            </div>
          )}
        </div>
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            <div className="p-2">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder={`Search ${label.toLowerCase()}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 text-sm"
                />
              </div>
            </div>
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-2 text-sm text-gray-500">
                No {label.toLowerCase()} found
              </p>
            ) : (
              filteredOptions.map(({ value, label }) => (
                <div
                  key={value}
                  className="px-4 py-2 text-sm text-gray-900 hover:bg-purple-50 cursor-pointer transition-all duration-200"
                  onClick={() => {
                    props.onChange({ target: { name: props.name, value } });
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                >
                  {label}
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

const StockManagement = () => {
  const { can } = useOrganisation();
  const [stockItems, setStockItems] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItemId, setEditItemId] = useState(null);

  // The search, the choices and the sort come back as the person left them (lazy initialisers: the first render already has them,
  // so nothing flashes unfiltered). A half-filled new item comes back too, but only a NEW one (see the save effect below).
  const [kept] = useState(() => session.get("filters", {}) || {});
  const [searchTerm, setSearchTerm] = useState(() => session.get("searchTerm", "") || "");
  const [filterCategory, setFilterCategory] = useState(kept.category || "");
  const [filterVendor, setFilterVendor] = useState(kept.vendor || "");
  const [filterStatus, setFilterStatus] = useState(kept.status || "");
  const [filterType, setFilterType] = useState(kept.type || ""); // "", "goods" or "service"
  const [showLowStock, setShowLowStock] = useState(Boolean(kept.showLowStock));
  const [sortConfig, setSortConfig] = useState(() => session.get("sort") || { key: null, direction: "asc" });
  const [draft] = useState(() => {
    const saved = session.get("formData");
    return saved && hasContent(saved) ? { ...emptyItemForm(), ...saved } : null;
  });
  const [isAutoSKU, setIsAutoSKU] = useState(() => (draft ? session.get("autoSku", true) !== false : true));
  const [barcodeData, setBarcodeData] = useState(() => draft?.sku || null);

  // The form (lib/itemTypes.js): goods or a service, and the fields each has
  const [formData, setFormData] = useState(() => draft || emptyItemForm());
  const service = isService(formData);

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    itemId: null,
    itemName: "",
    isDeleting: false,
  });

  const [isDraftSaved, setIsDraftSaved] = useState(() => Boolean(draft));
  const [lastSaveTime, setLastSaveTime] = useState(() => (draft ? session.get("lastSaveTime") : null));
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
    status: "Active",
  });
  const [categoryErrors, setCategoryErrors] = useState({});
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);

  const formRef = useRef(null);
  const autoSaveInterval = useRef(null);
  const barcodeRef = useRef(null);
  const navigate = useNavigate();

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/categories/categories");
      setCategories(response.data.data?.categories || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      showToastMessage(
        error.response?.data?.message || "Failed to fetch categories.",
        "error"
      );
    }
  }, [showToastMessage]);

  const fetchVendors = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/vendors/vendors");
      setVendors(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
      showToastMessage(
        error.response?.data?.message || "Failed to fetch vendors.",
        "error"
      );
    }
  }, [showToastMessage]);

  const fetchUnits = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/uom/units");
      setUnits(Array.isArray(response.data.data) ? response.data.data : []);
    } catch {
      showToastMessage("Failed to fetch units", "error");
      setUnits([]);
    }
  }, [showToastMessage]);

  useEffect(() => {
    if (showModal) {
      fetchCategories();
      fetchVendors();
      fetchUnits();
    }
  }, [showModal, fetchCategories, fetchVendors, fetchUnits]);

  useEffect(() => {
    if (isAutoSKU && formData.category && !editItemId) {
      const selectedCategory = categories.find(
        (cat) => cat._id === formData.category
      );
      if (selectedCategory) {
        const prefix = selectedCategory.name
          .substring(0, 2)
          .toUpperCase()
          .replace(/[^A-Z]/g, "");
        const lastItem = stockItems
          .filter((item) => item.category?._id === formData.category)
          .sort((a, b) => b.sku.localeCompare(a.sku))[0];
        let nextNumber = 1;
        if (lastItem && lastItem.sku) {
          const number = parseInt(lastItem.sku.replace(prefix, ""));
          if (!isNaN(number)) nextNumber = number + 1;
        }
        const newSKU = `${prefix}${nextNumber.toString().padStart(4, "0")}`;
        setFormData((prev) => ({ ...prev, sku: newSKU }));
        setBarcodeData(newSKU);
      }
    }
  }, [formData.category, isAutoSKU, categories, stockItems, editItemId]);

  // A new item is kept two seconds after the person stops typing. An item being EDITED is not: it is read from the server again
  // when they come back, and kept as a draft it would return as a form for a NEW item carrying another item's SKU.
  useEffect(() => {
    if (showModal && !editItemId && hasContent(formData)) {
      autoSaveInterval.current = setTimeout(() => {
        const at = new Date().toISOString();
        session.set("formData", formData);
        session.set("lastSaveTime", at);
        session.set("autoSku", isAutoSKU);
        setIsDraftSaved(true);
        setLastSaveTime(at);
      }, 2000);
    }

    return () => {
      if (autoSaveInterval.current) {
        clearTimeout(autoSaveInterval.current);
      }
    };
  }, [formData, showModal, editItemId, isAutoSKU]);

  useEffect(() => {
    session.set("searchTerm", searchTerm);
    session.set("filters", {
      category: filterCategory,
      vendor: filterVendor,
      status: filterStatus,
      type: filterType,
      showLowStock: showLowStock,
    });
    session.set("sort", sortConfig);
  }, [searchTerm, filterCategory, filterVendor, filterStatus, filterType, showLowStock, sortConfig]);

  const fetchStockItems = useCallback(
    async (showRefreshIndicator = false) => {
      try {
        if (showRefreshIndicator) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        const response = await axiosInstance.get("/stock/stock");
        setStockItems(response.data.data?.stocks || []);

        if (showRefreshIndicator) {
          showToastMessage("Data refreshed successfully!", "success");
        }
      } catch (error) {
        console.error("Failed to fetch stock items:", error);
        showToastMessage(
          error.response?.data?.message || "Failed to fetch stock items.",
          "error"
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showToastMessage]
  );

  useEffect(() => {
    fetchStockItems();
  }, [fetchStockItems]);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (name === "sku") setBarcodeData(value);
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
      setIsDraftSaved(false);
    },
    [errors]
  );

  // Goods or service: the choice decides which fields the form asks for. Going to a service drops what only goods have.
  const handleTypeChange = useCallback((type) => {
    setFormData((prev) => switchItemType(prev, type));
    setErrors({});
    setIsDraftSaved(false);
  }, []);

  const handleAccountChange = useCallback((name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    setIsDraftSaved(false);
  }, []);

  // Origin and brand are asked of goods only; a service has no stock fields (lib/itemTypes.js validateItemForm)
  const validateForm = useCallback(() => validateItemForm(formData), [formData]);

  const handleSubmit = useCallback(async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // goods send what they always did; a service sends no stock fields at all (the server refuses them)
      const payload = buildItemPayload(formData);

      if (editItemId) {
        await axiosInstance.put(`/stock/stock/${editItemId}`, payload);
        showToastMessage("Stock item updated successfully!", "success");
      } else {
        await axiosInstance.post("/stock/stock", payload);
        showToastMessage("Stock item created successfully!", "success");
      }

      await fetchStockItems();
      resetForm();
      session.remove("formData");
      session.remove("lastSaveTime");
      session.remove("autoSku");
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to save stock item.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [editItemId, formData, fetchStockItems, validateForm, showToastMessage]);

  const handleEdit = useCallback((item) => {
    setEditItemId(item._id);
    setFormData(itemFormFromStock(item, { toInputDate }));
    setBarcodeData(isService(item) ? null : item.sku);
    setIsAutoSKU(false);
    setShowModal(true);
    setIsDraftSaved(false);
    session.remove("formData");
    session.remove("lastSaveTime");
    session.remove("autoSku");
  }, []);

  const showDeleteConfirmation = useCallback((item) => {
    setDeleteConfirmation({
      visible: true,
      itemId: item._id,
      itemName: item.itemName,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      itemId: null,
      itemName: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));

    try {
      await axiosInstance.delete(`/stock/stock/${deleteConfirmation.itemId}`);
      setStockItems((prev) =>
        prev.filter((item) => item._id !== deleteConfirmation.itemId)
      );
      showToastMessage("Stock item deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchStockItems();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete stock item.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [
    deleteConfirmation.itemId,
    fetchStockItems,
    showToastMessage,
    hideDeleteConfirmation,
  ]);

  const resetForm = useCallback(() => {
    setEditItemId(null);
    setFormData(emptyItemForm());
    setErrors({});
    setShowModal(false);
    setIsDraftSaved(false);
    setLastSaveTime(null);
    setBarcodeData(null);
    setIsAutoSKU(true);
    session.remove("formData");
    session.remove("lastSaveTime");
    session.remove("autoSku");
  }, []);

  const openAddModal = useCallback(() => {
    // a half-filled new item kept from before opens as it was left; anything else (including an item that was being edited) starts blank
    if (editItemId || !hasContent(formData)) resetForm();
    setShowModal(true);
    setTimeout(() => {
      const modal = document.querySelector(".modal-container");
      if (modal) {
        modal.classList.add("scale-100");
      }
      if (formRef.current) {
        const firstInput = formRef.current.querySelector('input[name="sku"]');
        if (firstInput) firstInput.focus();
      }
    }, 10);
  }, [resetForm, editItemId, formData]);

  const handleRefresh = useCallback(() => {
    fetchStockItems(true);
  }, [fetchStockItems]);

  const handleSort = useCallback((key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction:
        prevConfig.key === key && prevConfig.direction === "asc"
          ? "desc"
          : "asc",
    }));
  }, []);

  const handleNavigateToCategory = useCallback(
    (categoryId = "") => {
      navigate(
        `/category-management${
          categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : ""
        }`
      );
    },
    [navigate]
  );

  const handleNavigateToDetail = useCallback(
    (itemId) => {
      navigate(`/stock-detail/${itemId}`);
    },
    [navigate]
  );

  const sortedAndFilteredItems = useMemo(() => {
    let filtered = stockItems.filter((item) => {
      const matchesSearch =
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.itemId &&
          item.itemId.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory
        ? item.category?.name === filterCategory
        : true;
      const matchesVendor = filterVendor
        ? item.vendorId?.vendorName === filterVendor
        : true;
      const matchesStatus = filterStatus ? item.status === filterStatus : true;
      // a service has no stock to run low on
      const matchesLowStock = showLowStock
        ? !isService(item) && item.currentStock <= item.reorderLevel
        : true;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesVendor &&
        matchesStatus &&
        matchesType(item, filterType) &&
        matchesLowStock
      );
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === "category") {
          aValue = a.category?.name || "";
          bValue = b.category?.name || "";
        } else if (sortConfig.key === "vendor") {
          aValue = a.vendorId?.vendorName || "";
          bValue = b.vendorId?.vendorName || "";
        }

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
  }, [
    stockItems,
    searchTerm,
    filterCategory,
    filterVendor,
    filterStatus,
    filterType,
    showLowStock,
    sortConfig,
  ]);

  // The filter choices come from the items themselves, so they are there as soon as the list is (the category and vendor lists
  // used to be fetched only once the item form had been opened, which left both filters empty), and never offer a name that
  // would show nothing.
  const categoryOptions = useMemo(
    () => namesFor(stockItems.map((item) => item.category?.name), filterCategory),
    [stockItems, filterCategory]
  );
  const vendorOptions = useMemo(
    () => namesFor(stockItems.map((item) => item.vendorId?.vendorName), filterVendor),
    [stockItems, filterVendor]
  );
  const filtersOn = Boolean(searchTerm || filterCategory || filterVendor || filterStatus || filterType || showLowStock);
  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setFilterCategory("");
    setFilterVendor("");
    setFilterStatus("");
    setFilterType("");
    setShowLowStock(false);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      // through downloadCSV (utils/format.js): quotes and commas inside a name stay in their cell, and a cell that would run as a
      // spreadsheet formula (an item called "=HYPERLINK(...)") is neutralised
      downloadCSV(
        "stock_export.csv",
        [
          "ItemID", "SKU", "ItemName", "Category", "CategoryId", "VendorName", "VendorId", "UnitOfMeasure", "Origin", "Brand",
          "CurrentStock", "ReorderLevel", "PurchasePrice", "SalesPrice", "Status", "BatchNumber", "ExpiryDate", "CreatedAt", "ItemType",
        ],
        sortedAndFilteredItems.map((item) => [
          item.itemId || item._id,
          item.sku,
          item.itemName,
          item.category?.name || "",
          item.category?._id || "",
          item.vendorId?.vendorName || "",
          item.vendorId?._id || "",
          item.unitOfMeasure,
          item.origin || "",
          item.brand || "",
          item.currentStock,
          item.reorderLevel,
          item.purchasePrice,
          item.salesPrice,
          item.status,
          item.batchNumber || "",
          item.expiryDate || "",
          item.createdAt || new Date().toISOString(),
          item.itemType || "goods",
        ])
      );

      showToastMessage("Stock data exported successfully!", "success");
    } catch {
      showToastMessage("Failed to export stock data.", "error");
    }
  }, [sortedAndFilteredItems, showToastMessage]);

  const getStatusBadge = useCallback((status) => {
    const badges = {
      Active: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      Inactive: "bg-slate-100 text-slate-800 border border-slate-200",
    };
    return (
      badges[status] || "bg-slate-100 text-slate-800 border border-slate-200"
    );
  }, []);

  const getStatusIcon = useCallback((status) => {
    const icons = {
      Active: <CheckCircle size={14} className="text-emerald-600" />,
      Inactive: <XCircle size={14} className="text-slate-600" />,
    };
    return (
      icons[status] || <AlertCircle size={14} className="text-slate-600" />
    );
  }, []);

  const getStockStatus = useCallback((currentStock, reorderLevel) => {
    if (currentStock <= reorderLevel) {
      return { color: "text-red-600", icon: AlertTriangle, label: "Low Stock" };
    } else if (currentStock <= reorderLevel * 2) {
      return {
        color: "text-status-warning",
        icon: TrendingDown,
        label: "Medium Stock",
      };
    }
    return { color: "text-green-600", icon: TrendingUp, label: "Good Stock" };
  }, []);

  const getExpiryStatus = useCallback((expiryDate) => {
    if (!expiryDate) return { color: "text-gray-600", label: "N/A" };
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { color: "text-red-600 bg-red-100", label: "Expired" };
    } else if (diffDays <= 30) {
      return { color: "text-status-warning bg-status-warning-soft", label: "Expiring Soon" };
    }
    return { color: "text-green-600", label: "Valid" };
  }, []);

  // Money is written the same way across the product: in the organisation's currency, as text ("AED 1,234.50" by default), never an icon.
  const formatCurrency = useCallback(
    (amount, colorClass = "") => (
      <span className={`whitespace-nowrap tabular-nums ${colorClass}`}>
        {formatCurrencyAED(Number(amount) || 0)}
      </span>
    ),
    []
  );

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return "";
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    return formatTime(time);
  }, []);

  // low stock and stock value are about goods; services are counted apart (lib/itemTypes.js)
  const stockStats = useMemo(() => itemStats(stockItems), [stockItems]);

  const handleCategoryChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setCategoryFormData((prev) => ({ ...prev, [name]: value }));
      if (categoryErrors[name])
        setCategoryErrors((prev) => ({ ...prev, [name]: "" }));
    },
    [categoryErrors]
  );

  const validateCategoryForm = useCallback(() => {
    const newErrors = {};
    if (!categoryFormData.name.trim())
      newErrors.name = "Category name is required";
    return newErrors;
  }, [categoryFormData]);

  const handleCreateCategory = useCallback(async () => {
    const newErrors = validateCategoryForm();
    if (Object.keys(newErrors).length > 0) {
      setCategoryErrors(newErrors);
      return;
    }

    setIsCategorySubmitting(true);
    try {
      const payload = {
        name: categoryFormData.name,
        description: categoryFormData.name,
        status: categoryFormData.status,
      };

      const response = await axiosInstance.post(
        "/categories/categories",
        payload
      );
      const newCategory = response.data.data;

      await fetchCategories();
      setFormData((prev) => ({ ...prev, category: newCategory._id }));
      showToastMessage("Category created successfully!", "success");
      setShowCategoryModal(false);
      setCategoryFormData({
        name: "",
        description: "",
        status: "Active",
      });
      setCategoryErrors({});
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to create category.",
        "error"
      );
    } finally {
      setIsCategorySubmitting(false);
    }
  }, [
    categoryFormData,
    validateCategoryForm,
    fetchCategories,
    showToastMessage,
  ]);

//   const handleDownloadBarcode = useCallback(() => {
//   if (barcodeRef.current && barcodeRef.current.canvas) {
//     const canvas = barcodeRef.current.canvas;
//     canvas.toBlob((blob) => {
//       if (blob) {
//         const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // e.g., 2025-10-25T18-39
//         saveAs(blob, `${formData.sku || "barcode"}_${timestamp}_barcode.png`);
//         showToastMessage("Barcode downloaded successfully!", "success");
//       } else {
//         showToastMessage("Failed to generate barcode image.", "error");
//       }
//     }, "image/png");
//   } else {
//     showToastMessage("Barcode not available for download.", "error");
//   }
// }, [formData.sku, showToastMessage]);

  // Three honest states: the first load still running, nothing matches what was asked for, and nothing there at all.
  const EmptyState = () => {
    if (isLoading && stockItems.length === 0) {
      return (
        <div className="flex items-center justify-center gap-3 px-6 py-16 text-muted-foreground" role="status">
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          Loading stock items…
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-muted">
          <Package size={28} className="text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="mb-1 text-lg font-semibold text-foreground">
          {filtersOn ? "No stock items match the search or filters" : "No stock items yet"}
        </h3>
        <p className="mb-6 max-w-md text-sm text-muted-foreground">
          {filtersOn
            ? "Clear the search and filters to see every item."
            : "Start building your inventory by adding your first stock item."}
        </p>
        {filtersOn ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-accent"
          >
            Clear search and filters
          </button>
        ) : (
          <Can permission="inventory.create">
            <button type="button" onClick={openAddModal} className="erp-btn-primary">
              <Plus size={20} />
              Add First Item
            </button>
          </Can>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="grid h-10 w-10 shrink-0 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Back"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Stock Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {stockStats.totalItems} total items
              {stockStats.serviceItems > 0 && ` (${stockStats.serviceItems} ${stockStats.serviceItems === 1 ? "service" : "services"})`} •{" "}
              {sortedAndFilteredItems.length} displayed
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            type="button"
            onClick={() => handleNavigateToCategory()}
            className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Manage Categories"
            aria-label="Manage categories"
          >
            <Tag size={16} />
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Export to CSV"
            aria-label="Export to CSV"
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {showToast.visible && (
        <div
          className={`fixed end-4 bottom-4 z-[70] ${toastClasses(showToast.type)}`}
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

      <div className="mb-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {[
            {
              title: "Total Items",
              count: stockStats.totalItems,
              icon: <Box size={24} />,
            },
            {
              title: "Active Items",
              count: stockStats.activeItems,
              icon: <CheckCircle size={24} />,
            },
            {
              title: "Low Stock Alert",
              count: stockStats.lowStockItems,
              icon: <AlertTriangle size={24} />,
            },
            {
              title: "Total Value",
              count: formatCurrency(stockStats.totalValue),
              icon: <Banknote size={24} />,
            },
          ].map((card, index) => (
            <StatCard
              key={index}
              title={card.title}
              count={card.count}
              icon={card.icon}
              subText={card.subText}
              tone={["teal", "plum", "olive", "rose"][index % 4]}
              onClick={card.onClick}
            />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-4 sm:p-6">
          <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Inventory Items
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your stock items and inventory
              </p>
            </div>
            <Can permission="inventory.create">
              <button
                type="button"
                onClick={openAddModal}
                className="erp-btn-primary"
              >
                <Plus size={18} />
                Add Stock Item
              </button>
            </Can>
          </div>

          {/* Filters: always showing, the same row every list of the product has (components/lists/FilterBar.jsx). Category and
              vendor can be long lists, so they are typed into; the rest are a handful of fixed choices. */}
          <FilterBar
            search={searchTerm}
            onSearch={setSearchTerm}
            searchLabel="Search items"
            placeholder="Search name, SKU or ID…"
            active={filtersOn}
            onClear={clearFilters}
          >
            <Field label="Category" className="w-full sm:w-44">
              <SearchSelect
                value={filterCategory}
                onChange={setFilterCategory}
                options={categoryOptions}
                placeholder="All categories"
                noOptionsText="No categories"
                className={TOUCH_HEIGHT}
                clearable
              />
            </Field>
            <Field label="Vendor" className="w-full sm:w-44">
              <SearchSelect
                value={filterVendor}
                onChange={setFilterVendor}
                options={vendorOptions}
                placeholder="All vendors"
                noOptionsText="No vendors"
                className={TOUCH_HEIGHT}
                clearable
              />
            </Field>
            <FilterSelect
              label="Status"
              value={filterStatus}
              onChange={setFilterStatus}
              allLabel="All statuses"
              options={[["Active", "Active"], ["Inactive", "Inactive"]]}
            />
            <FilterSelect
              label="Item type"
              value={filterType}
              onChange={setFilterType}
              allLabel="Goods and services"
              options={[["goods", "Goods only"], ["service", "Services only"]]}
              className="sm:w-52"
            />
            <FilterSelect
              label="Stock level"
              value={showLowStock ? "low" : ""}
              onChange={(v) => setShowLowStock(v === "low")}
              allLabel="All stock levels"
              options={[["low", "Low stock only"]]}
            />
          </FilterBar>
        </div>

        {sortedAndFilteredItems.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              caption="Stock items"
              rows={sortedAndFilteredItems}
              rowKey={(item) => item._id}
              onRowClick={(item) => handleNavigateToDetail(item._id)}
              // a low or expiring item is flagged on its own cells; the row tint the table
              // used does not survive as a card, so the stock and expiry cells carry it
              columns={[
                ...[
                  {
                    key: "itemName", label: "Item Info", card: "primary",
                    cell: (item) => (
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Package size={20} className="text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.itemName.toUpperCase()}
                            {isService(item) && <span className="ms-2 inline-block rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 align-middle text-xs font-medium text-indigo-700">Service</span>}
                          </p>
                          <p className="text-xs font-normal text-gray-500">SKU: {item.sku}</p>
                          <p className="text-xs font-normal text-gray-500">ID: {item.itemId || item._id}</p>
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "category", label: "Category", card: "title",
                    // spans, not <div>/<p>: on a phone this cell sits inside the card's own <p>, and a block inside a paragraph is invalid
                    cell: (item) => (
                      <span className="block">
                        <span
                          className="block text-sm font-medium text-indigo-600 cursor-pointer hover:underline"
                          onClick={(e) => { e.stopPropagation(); handleNavigateToCategory(item.category?._id); }}
                        >
                          {item.category?.name?.toUpperCase() || "N/A"}
                        </span>
                        <span className="block text-xs text-gray-500">{item.unitOfMeasure}</span>
                      </span>
                    ),
                  },
                  { key: "vendor", label: "Vendor", card: "meta", cell: (item) => item.vendorId?.vendorName || "N/A" },
                  {
                    key: "currentStock", label: "Stock Level", card: "amount",
                    cell: (item) => {
                      // a service has no quantity, reorder level or stock status: a dash, not "0 / Low stock"
                      if (isService(item)) {
                        return (
                          <div className="text-end">
                            <p className="text-sm font-bold text-gray-400">{stockLevelText(item)}</p>
                            <p className="text-xs font-normal text-gray-500">Not stocked</p>
                          </div>
                        );
                      }
                      const stockStatus = getStockStatus(item.currentStock, item.reorderLevel);
                      const StockIcon = stockStatus.icon;
                      return (
                        <div className="flex items-center justify-end space-x-2">
                          <StockIcon size={16} className={stockStatus.color} />
                          <div className="text-end">
                            <p className="text-sm font-bold text-gray-900">{item.currentStock}</p>
                            <p className={`text-xs font-normal ${stockStatus.color}`}>Reorder: {item.reorderLevel}</p>
                          </div>
                        </div>
                      );
                    },
                  },
                  {
                    key: "purchasePrice", label: "Pricing", card: "meta",
                    cell: (item) => (
                      <div>
                        <p className="text-sm font-medium text-gray-900">Sale: {formatCurrency(item.salesPrice)}</p>
                        <p className="text-xs text-gray-500">Cost: {formatCurrency(item.purchasePrice)}</p>
                      </div>
                    ),
                  },
                  {
                    key: "expiryDate", label: "Expiry Date", card: "meta",
                    cell: (item) => {
                      if (isService(item)) return <span className="text-sm text-gray-400">—</span>;
                      const expiryStatus = getExpiryStatus(item.expiryDate);
                      return (
                        <span className="flex items-center space-x-2">
                          <Calendar size={16} className={expiryStatus.color} />
                          <span className={`text-sm ${expiryStatus.color} px-2 py-1 rounded`}>
                            {item.expiryDate ? formatDate(item.expiryDate) : "N/A"}
                            {expiryStatus.label !== "N/A" && ` (${expiryStatus.label})`}
                          </span>
                        </span>
                      );
                    },
                  },
                ].map((c) => ({
                  ...c,
                  header: (
                    <button type="button" onClick={() => handleSort(c.key)} className="flex items-center space-x-1 hover:text-foreground">
                      <span>{c.label}</span>
                      {sortConfig.key === c.key && <span className="text-indigo-600">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  ),
                })),
                {
                  key: "status", header: "Status", card: "badge",
                  cell: (item) => (
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(item.status)}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(item.status)}`}>{item.status}</span>
                    </div>
                  ),
                },
                {
                  key: "actions", header: "Actions", card: "actions",
                  cell: (item) => (
                    <div className="flex items-center space-x-3" onClick={(e) => e.stopPropagation()}>
                      <Can permission="inventory.edit">
                        <button onClick={() => handleEdit(item)} className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all duration-200" title="Edit item">
                          <Edit size={16} />
                        </button>
                      </Can>
                      <Can permission="inventory.delete">
                        <button onClick={() => showDeleteConfirmation(item)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200" title="Delete item">
                          <Trash2 size={16} />
                        </button>
                      </Can>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>

      {deleteConfirmation.visible && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Stock Item
              </h3>

              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                "{deleteConfirmation.itemName}"?
              </p>
              <p className="text-sm text-gray-500 text-center mb-8">
                This action cannot be undone and will permanently remove the
                item from your inventory.
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

      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90dvh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editItemId ? (service ? "Edit Service" : "Edit Stock Item") : service ? "Add New Service" : "Add New Stock Item"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {editItemId
                      ? "Update item information"
                      : service
                      ? "Create a service you can invoice (no stock)"
                      : "Create a new inventory item"}
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

            <div className="p-6" ref={formRef}>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
                <div className="lg:col-span-3">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">Item type</h4>
                  <ItemTypeToggle value={formData.itemType} onChange={handleTypeChange} />
                  {editItemId && (
                    <p className="mt-2 text-xs text-gray-500">
                      The type can be changed only while no stock movement or document refers to the item.
                    </p>
                  )}
                </div>

                <div className="lg:col-span-3">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Package size={20} className="mr-2 text-indigo-600" />
                    Basic Information
                  </h4>
                </div>

                <div>
                  <FormSelect
                    label="Category"
                    icon={Tag}
                    error={errors.category}
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    options={categories.map((cat) => ({
                      value: cat._id,
                      label: cat.name,
                    }))}
                    data={true}
                    onAddNew={() => setShowCategoryModal(true)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Barcode size={16} className="inline mr-2" />
                    SKU *
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      name="sku"
                      value={formData.sku}
                      onChange={handleChange}
                      placeholder="Enter SKU code"
                      disabled={isAutoSKU && !editItemId}
                      className={`flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                        errors.sku
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      } ${isAutoSKU && !editItemId ? "bg-gray-100" : ""}`}
                    />
                    <button
                      onClick={() => setIsAutoSKU(!isAutoSKU)}
                      className={`px-4 py-2 rounded-lg ${
                        isAutoSKU
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-200 text-gray-700"
                      } hover:bg-indigo-700 hover:text-white transition-all duration-200`}
                    >
                      {isAutoSKU ? "Auto" : "Manual"}
                    </button>
                  </div>
                  {errors.sku && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.sku}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Package size={16} className="inline mr-2" />
                    Item Name *
                  </label>
                  <input
                    type="text"
                    name="itemName"
                    value={formData.itemName}
                    onChange={handleChange}
                    placeholder="Enter item name"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.itemName
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.itemName && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.itemName}
                    </p>
                  )}
                </div>

                <div>
                  <FormSelect
                    label="Vendor"
                    icon={Truck}
                    error={errors.vendorId}
                    name="vendorId"
                    value={formData.vendorId}
                    onChange={handleChange}
                    options={vendors.map((vendor) => ({
                      value: vendor._id,
                      label: vendor.vendorName,
                    }))}
                  />
                </div>

                <div>
                  <FormSelect
                    label={service ? "Unit (hour, job, month...)" : "Unit of Measure"}
                    icon={Box}
                    error={errors.unitOfMeasure}
                    name="unitOfMeasure"
                    value={formData.unitOfMeasure}
                    onChange={handleChange}
                    options={units.map((unit) => ({
                      value: unit._id,
                      label: unit.unitName,
                    }))}
                  />
                </div>

                {/* origin, brand, barcode and the stock fields belong to goods; a service has none of them */}
                {!service && (
                <>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Globe size={16} className="inline mr-2" />
                    Origin *
                  </label>
                  <input
                    type="text"
                    name="origin"
                    value={formData.origin}
                    onChange={handleChange}
                    placeholder="Enter country of origin"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.origin
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.origin && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.origin}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Star size={16} className="inline mr-2" />
                    Brand *
                  </label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    placeholder="Enter brand name"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.brand
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.brand && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.brand}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Barcode
                  </label>

                  {barcodeData && (
                    <div className="mt-2 flex items-center space-x-2">
                      <BarcodeGenerator
                        value={barcodeData}
                        format="CODE128"
                        ref={barcodeRef}
                        width={2}
                        height={50}
                        fontSize={12}
                      />
                     
                    </div>
                  )}
                </div>

                <div className="lg:col-span-3 mt-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Layers size={20} className="mr-2 text-purple-600" />
                    Stock Information
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    name="currentStock"
                    value={formData.currentStock}
                    onChange={handleChange}
                    placeholder="Enter current stock"
                    min="0"
                    // changing the quantity of an item that exists is a stock adjustment, which has its own permission
                    disabled={Boolean(editItemId) && !can("inventory.adjust")}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 ${
                      errors.currentStock
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {Boolean(editItemId) && !can("inventory.adjust") && (
                    <p className="mt-1 text-xs text-gray-500">Changing the quantity on hand is a stock adjustment. Your role cannot make one.</p>
                  )}
                  {errors.currentStock && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.currentStock}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    name="reorderLevel"
                    value={formData.reorderLevel}
                    onChange={handleChange}
                    placeholder="Enter reorder level"
                    min="0"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.reorderLevel
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.reorderLevel && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.reorderLevel}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Batch Number
                  </label>
                  <input
                    type="text"
                    name="batchNumber"
                    value={formData.batchNumber}
                    onChange={handleChange}
                    placeholder="Enter batch number"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-2" />
                    Expiry Date
                  </label>
                  <DateInput
                    name="expiryDate"
                    aria-label="Expiry date"
                    value={formData.expiryDate}
                    onChange={handleChange}
                  />
                </div>
                </>
                )}

                {service && (
                  <div className="lg:col-span-3 mt-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
                      <Banknote size={20} className="mr-2 text-indigo-600" />
                      Accounts
                    </h4>
                    <p className="mb-4 text-sm text-gray-500">
                      A service has no quantity on hand, reorder level, batches or expiry, and invoicing it moves no stock. Both accounts are optional.
                    </p>
                    <ServiceAccountFields
                      incomeAccountId={formData.incomeAccountId}
                      expenseAccountId={formData.expenseAccountId}
                      onChange={handleAccountChange}
                    />
                  </div>
                )}

                <div className="lg:col-span-3 mt-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Banknote size={20} className="mr-2 text-green-600" />
                    Pricing Information
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Purchase Price
                  </label>
                  <input
                    type="number"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    placeholder="Enter purchase price"
                    min="0"
                    step="0.01"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.purchasePrice
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.purchasePrice && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.purchasePrice}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sales Price
                  </label>
                  <input
                    type="number"
                    name="salesPrice"
                    value={formData.salesPrice}
                    onChange={handleChange}
                    placeholder="Enter sales price"
                    min="0"
                    step="0.01"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.salesPrice
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.salesPrice && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.salesPrice}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                  {isDraftSaved ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle size={14} className="mr-1" />
                      Changes saved automatically
                    </span>
                  ) : formData.itemName ||
                    formData.sku ||
                    formData.category ||
                    formData.vendorId ||
                    formData.origin || // New field
                    formData.brand ? ( // New field
                    <span className="flex items-center text-status-warning">
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
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Saving...
                      </>
                    ) : editItemId ? (
                      <>
                        <Save size={16} className="mr-2" />
                        Update Item
                      </>
                    ) : (
                      <>
                        <Plus size={16} className="mr-2" />
                        Add Item
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <h3 className="text-xl font-bold text-gray-900">
                Add New Category
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
              >
                <X size={22} />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={categoryFormData.name}
                    onChange={handleCategoryChange}
                    placeholder="Enter category name"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      categoryErrors.name
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {categoryErrors.name && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {categoryErrors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={categoryFormData.status}
                    onChange={handleCategoryChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  disabled={isCategorySubmitting}
                  className="px-6 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={isCategorySubmitting}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl flex items-center"
                >
                  {isCategorySubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={16} className="mr-2" />
                      Create Category
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

export default StockManagement;
