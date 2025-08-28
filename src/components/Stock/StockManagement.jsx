import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Barcode,
  Tag,
  DollarSign,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Box,
  Layers,
  Filter,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  Clock,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import axiosInstance from "../../axios/axios";

// Session management utilities (using memory storage for Claude environment)
const SessionManager = {
  storage: {},
  
  get: (key) => {
    try {
      return this.storage[`stock_session_${key}`] || null;
    } catch {
      return null;
    }
  },
  
  set: (key, value) => {
    try {
      this.storage[`stock_session_${key}`] = value;
    } catch (error) {
      console.warn('Session storage failed:', error);
    }
  },
  
  remove: (key) => {
    try {
      delete this.storage[`stock_session_${key}`];
    } catch (error) {
      console.warn('Session removal failed:', error);
    }
  },
  
  clear: () => {
    Object.keys(this.storage).forEach(key => {
      if (key.startsWith('stock_session_')) {
        delete this.storage[key];
      }
    });
  }
};

const StockManagement = () => {
  const [stockItems, setStockItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editItemId, setEditItemId] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const [formData, setFormData] = useState({
    sku: "",
    itemName: "",
    category: "",
    unitOfMeasure: "",
    barcodeQrCode: "",
    reorderLevel: "",
    batchNumber: "",
    expiryDate: "",
    purchasePrice: "",
    salesPrice: "",
    currentStock: "",
    status: "Active",
  });

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

  // New UX enhancement states
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs for enhanced UX
  const formRef = useRef(null);
  const autoSaveInterval = useRef(null);
  const searchInputRef = useRef(null);

  const categories = [
    "Electronics",
    "Clothing", 
    "Books",
    "Food",
    "Medicine",
    "Tools",
  ];
  const unitsOfMeasure = ["Piece", "Kg", "Liter", "Meter", "Box", "Carton"];

  // Load session data on component mount
  useEffect(() => {
    const savedFormData = SessionManager.get('formData');
    const savedFilters = SessionManager.get('filters');
    const savedSearchTerm = SessionManager.get('searchTerm');

    if (savedFormData && Object.values(savedFormData).some(val => val)) {
      setFormData(savedFormData);
      setIsDraftSaved(true);
      setLastSaveTime(SessionManager.get('lastSaveTime'));
    }
    
    if (savedFilters) {
      setFilterCategory(savedFilters.category || "");
      setFilterStatus(savedFilters.status || "");
      setShowLowStock(savedFilters.showLowStock || false);
    }
    
    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
  }, []);

  // Auto-save form data to session
  useEffect(() => {
    if (showModal && Object.values(formData).some(val => val)) {
      autoSaveInterval.current = setTimeout(() => {
        SessionManager.set('formData', formData);
        SessionManager.set('lastSaveTime', new Date().toISOString());
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
    SessionManager.set('searchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    SessionManager.set('filters', { 
      category: filterCategory, 
      status: filterStatus, 
      showLowStock: showLowStock 
    });
  }, [filterCategory, filterStatus, showLowStock]);

  const fetchStockItems = useCallback(async (showRefreshIndicator = false) => {
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
  }, []);

  useEffect(() => {
    fetchStockItems();
  }, [fetchStockItems]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(() => setShowToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    setIsDraftSaved(false);
  }, [errors]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.itemName.trim()) newErrors.itemName = "Item name is required";
    if (!formData.sku.trim()) newErrors.sku = "SKU is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.unitOfMeasure)
      newErrors.unitOfMeasure = "Unit of measure is required";
    if (
      formData.reorderLevel &&
      (isNaN(formData.reorderLevel) || Number(formData.reorderLevel) < 0)
    ) {
      newErrors.reorderLevel = "Reorder level must be a valid positive number";
    }
    if (
      formData.purchasePrice &&
      (isNaN(formData.purchasePrice) || Number(formData.purchasePrice) < 0)
    ) {
      newErrors.purchasePrice = "Purchase price must be a valid positive number";
    }
    if (
      formData.salesPrice &&
      (isNaN(formData.salesPrice) || Number(formData.salesPrice) < 0)
    ) {
      newErrors.salesPrice = "Sales price must be a valid positive number";
    }
    if (
      formData.currentStock &&
      (isNaN(formData.currentStock) || Number(formData.currentStock) < 0)
    ) {
      newErrors.currentStock = "Current stock must be a valid positive number";
    }
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
        sku: formData.sku,
        itemName: formData.itemName,
        category: formData.category,
        unitOfMeasure: formData.unitOfMeasure,
        barcodeQrCode: formData.barcodeQrCode,
        reorderLevel: Number(formData.reorderLevel) || 0,
        batchNumber: formData.batchNumber,
        expiryDate: formData.expiryDate,
        purchasePrice: Number(formData.purchasePrice) || 0,
        salesPrice: Number(formData.salesPrice) || 0,
        currentStock: Number(formData.currentStock) || 0,
        status: formData.status,
      };

      if (editItemId) {
        await axiosInstance.put(`/stock/stock/${editItemId}`, payload);
        showToastMessage("Stock item updated successfully!", "success");
      } else {
        await axiosInstance.post("/stock/stock", payload);
        showToastMessage("Stock item created successfully!", "success");
      }
      
      await fetchStockItems();
      resetForm();
      
      // Clear session data after successful submission
      SessionManager.remove('formData');
      SessionManager.remove('lastSaveTime');
      
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
    setFormData({
      sku: item.sku,
      itemName: item.itemName,
      category: item.category,
      unitOfMeasure: item.unitOfMeasure,
      barcodeQrCode: item.barcodeQrCode || "",
      reorderLevel: item.reorderLevel.toString(),
      batchNumber: item.batchNumber || "",
      expiryDate: item.expiryDate
        ? new Date(item.expiryDate).toISOString().split("T")[0]
        : "",
      purchasePrice: item.purchasePrice.toString(),
      salesPrice: item.salesPrice.toString(),
      currentStock: item.currentStock.toString(),
      status: item.status,
    });
    setShowModal(true);
    setIsDraftSaved(false);
    
    // Clear any existing draft when editing
    SessionManager.remove('formData');
    SessionManager.remove('lastSaveTime');
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
  }, [deleteConfirmation.itemId, fetchStockItems, showToastMessage, hideDeleteConfirmation]);

  const resetForm = useCallback(() => {
    setEditItemId(null);
    setFormData({
      sku: "",
      itemName: "",
      category: "",
      unitOfMeasure: "",
      barcodeQrCode: "",
      reorderLevel: "",
      batchNumber: "",
      expiryDate: "",
      purchasePrice: "",
      salesPrice: "",
      currentStock: "",
      status: "Active",
    });
    setErrors({});
    setShowModal(false);
    setIsDraftSaved(false);
    setLastSaveTime(null);
    
    // Clear session draft
    SessionManager.remove('formData');
    SessionManager.remove('lastSaveTime');
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
        const firstInput = formRef.current.querySelector('input[name="sku"]');
        if (firstInput) firstInput.focus();
      }
    }, 10);
  }, [resetForm]);

  const handleRefresh = useCallback(() => {
    fetchStockItems(true);
  }, [fetchStockItems]);

  const handleSort = useCallback((key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const csv = [
        "ItemID,SKU,ItemName,Category,UnitOfMeasure,CurrentStock,ReorderLevel,PurchasePrice,SalesPrice,Status,BatchNumber,ExpiryDate,CreatedAt",
        ...sortedAndFilteredItems.map(
          (item) =>
            `${item.itemId || item._id},${item.sku},"${item.itemName}",${item.category},${item.unitOfMeasure},${item.currentStock},${item.reorderLevel},${item.purchasePrice},${item.salesPrice},${item.status},${item.batchNumber || ""},${item.expiryDate || ""},${item.createdAt || new Date().toISOString()}`
        ),
      ].join("\n");
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'stock_export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      showToastMessage("Stock data exported successfully!", "success");
    } catch (error) {
      showToastMessage("Failed to export stock data.", "error");
    }
  }, []);

  const getStatusBadge = useCallback((status) => {
    const badges = {
      Active: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      Inactive: "bg-slate-100 text-slate-800 border border-slate-200",
    };
    return badges[status] || "bg-slate-100 text-slate-800 border border-slate-200";
  }, []);

  const getStatusIcon = useCallback((status) => {
    const icons = {
      Active: <CheckCircle size={14} className="text-emerald-600" />,
      Inactive: <XCircle size={14} className="text-slate-600" />,
    };
    return icons[status] || <AlertCircle size={14} className="text-slate-600" />;
  }, []);

  const getStockStatus = useCallback((currentStock, reorderLevel) => {
    if (currentStock <= reorderLevel) {
      return { color: "text-red-600", icon: AlertTriangle, label: "Low Stock" };
    } else if (currentStock <= reorderLevel * 2) {
      return {
        color: "text-yellow-600",
        icon: TrendingDown,
        label: "Medium Stock",
      };
    }
    return { color: "text-green-600", icon: TrendingUp, label: "Good Stock" };
  }, []);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }, []);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return '';
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    return time.toLocaleTimeString();
  }, []);

  // Enhanced statistics calculations
  const stockStats = useMemo(() => {
    const totalItems = stockItems.length;
    const activeItems = stockItems.filter((item) => item.status === "Active").length;
    const lowStockItems = stockItems.filter(
      (item) => item.currentStock <= item.reorderLevel
    ).length;
    const totalValue = stockItems.reduce(
      (sum, item) => sum + (item.currentStock * item.purchasePrice || 0),
      0
    );
    
    return {
      totalItems,
      activeItems,
      lowStockItems,
      totalValue
    };
  }, [stockItems]);

  const sortedAndFilteredItems = useMemo(() => {
    let filtered = stockItems.filter((item) => {
      const matchesSearch =
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.itemId && item.itemId.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory
        ? item.category === filterCategory
        : true;
      const matchesStatus = filterStatus ? item.status === filterStatus : true;
      const matchesLowStock = showLowStock
        ? item.currentStock <= item.reorderLevel
        : true;

      return matchesSearch && matchesCategory && matchesStatus && matchesLowStock;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [stockItems, searchTerm, filterCategory, filterStatus, showLowStock, sortConfig]);

  // Enhanced Empty State Component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Package size={40} className="text-indigo-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No stock items found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm || filterCategory || filterStatus || showLowStock
          ? "No items match your current filters. Try adjusting your search criteria."
          : "Start building your inventory by adding your first stock item."}
      </p>
      <button
        onClick={openAddModal}
        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
      >
        <Plus size={20} />
        Add First Item
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading stock items...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 sm:p-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black bg-clip-text">
              Stock Management
            </h1>
            <p className="text-gray-600 mt-1">
              {stockStats.totalItems} total items • {sortedAndFilteredItems.length} displayed
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            onClick={handleExport}
            className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200"
            title="Export to CSV"
          >
            <Download size={16} className="text-gray-600" />
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw size={16} className={`text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
              showFilters ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-600'
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
              title: "Total Items",
              count: stockStats.totalItems,
              icon: <Box size={24} />,
              bgColor: "bg-indigo-50",
              textColor: "text-indigo-700",
              borderColor: "border-indigo-200",
              iconBg: "bg-indigo-100",
              iconColor: "text-indigo-600"
            },
            {
              title: "Active Items",
              count: stockStats.activeItems,
              icon: <CheckCircle size={24} />,
              bgColor: "bg-emerald-50",
              textColor: "text-emerald-700",
              borderColor: "border-emerald-200",
              iconBg: "bg-emerald-100",
              iconColor: "text-emerald-600"
            },
            {
              title: "Low Stock Alert",
              count: stockStats.lowStockItems,
              icon: <AlertTriangle size={24} />,
              bgColor: "bg-red-50",
              textColor: "text-red-700",
              borderColor: "border-red-200",
              iconBg: "bg-red-100",
              iconColor: "text-red-600"
            },
            {
              title: "Total Value",
              count: formatCurrency(stockStats.totalValue),
              icon: <DollarSign size={24} />,
              bgColor: "bg-purple-50",
              textColor: "text-purple-700",
              borderColor: "border-purple-200",
              iconBg: "bg-purple-100",
              iconColor: "text-purple-600"
            }
          ].map((card, index) => (
            <div
              key={index}
              className={`${card.bgColor} ${card.borderColor} rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-105`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${card.iconBg} rounded-xl`}>
                  <div className={card.iconColor}>
                    {card.icon}
                  </div>
                </div>
                <button
                  className={`text-xs ${card.textColor} hover:opacity-80 transition-opacity font-medium`}
                  onClick={() => {
                    if (card.title.includes('Active')) setFilterStatus('Active');
                    else if (card.title.includes('Low Stock')) setShowLowStock(true);
                  }}
                >
                  {card.title.includes('Value') ? 'View Details →' : 'View All →'}
                </button>
              </div>
              <h3 className={`text-sm font-medium ${card.textColor} mb-2`}>
                {card.title}
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {card.count}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {card.title.includes('Total Items') ? 'In inventory' :
                 card.title.includes('Active') ? 'Currently available' :
                 card.title.includes('Low Stock') ? 'Need restocking' :
                 'Current valuation'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Inventory Items
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage your stock items and inventory
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} />
              Add Stock Item
            </button>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by item name, SKU, or item ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                
                <button
                  onClick={() => setShowLowStock(!showLowStock)}
                  className={`px-4 py-2 rounded-lg border transition-all duration-200 ${
                    showLowStock
                      ? "bg-red-100 border-red-300 text-red-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Low Stock Only
                </button>
                
                <button
                  onClick={() => {
                    setFilterCategory("");
                    setFilterStatus("");
                    setShowLowStock(false);
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

        {/* Table/Content */}
        {sortedAndFilteredItems.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: 'itemName', label: 'Item Info' },
                    { key: 'category', label: 'Category' },
                    { key: 'currentStock', label: 'Stock Level' },
                    { key: 'purchasePrice', label: 'Pricing' },
                    { key: 'status', label: 'Status' },
                    { key: null, label: 'Actions' }
                  ].map((column) => (
                    <th
                      key={column.key || 'actions'}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={column.key ? () => handleSort(column.key) : undefined}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {column.key && sortConfig.key === column.key && (
                          <span className="text-indigo-600">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAndFilteredItems.map((item) => {
                  const stockStatus = getStockStatus(
                    item.currentStock,
                    item.reorderLevel
                  );
                  const StockIcon = stockStatus.icon;

                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <Package size={20} className="text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {item.itemName}
                            </p>
                            <p className="text-xs text-gray-500">
                              SKU: {item.sku}
                            </p>
                            <p className="text-xs text-gray-500">
                              ID: {item.itemId || item._id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.category}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.unitOfMeasure}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <StockIcon size={16} className={stockStatus.color} />
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {item.currentStock}
                            </p>
                            <p className={`text-xs ${stockStatus.color}`}>
                              Reorder: {item.reorderLevel}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Sale: {formatCurrency(item.salesPrice)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Cost: {formatCurrency(item.purchasePrice)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(item.status)}
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                              item.status
                            )}`}
                          >
                            {item.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all duration-200"
                            title="Edit item"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => showDeleteConfirmation(item)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                            title="Delete item"
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

      {/* Enhanced Delete Confirmation Modal */}
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
                Delete Stock Item
              </h3>
              
              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                "{deleteConfirmation.itemName}"?
              </p>
              <p className="text-sm text-gray-500 text-center mb-8">
                This action cannot be undone and will permanently remove the item from your inventory.
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

      {/* Enhanced Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editItemId ? "Edit Stock Item" : "Add New Stock Item"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {editItemId
                      ? "Update item information"
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

            {/* Modal Body */}
            <div className="p-6" ref={formRef}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Package size={20} className="mr-2 text-indigo-600" />
                    Basic Information
                  </h4>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Barcode size={16} className="inline mr-2" />
                    SKU *
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    placeholder="Enter SKU code"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.sku
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Tag size={16} className="inline mr-2" />
                    Category *
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.category
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.category}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit of Measure *
                  </label>
                  <select
                    name="unitOfMeasure"
                    value={formData.unitOfMeasure}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.unitOfMeasure
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Unit</option>
                    {unitsOfMeasure.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  {errors.unitOfMeasure && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.unitOfMeasure}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Barcode/QR Code
                  </label>
                  <input
                    type="text"
                    name="barcodeQrCode"
                    value={formData.barcodeQrCode}
                    onChange={handleChange}
                    placeholder="Enter barcode or QR code"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
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
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.currentStock
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
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
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div className="lg:col-span-3 mt-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <DollarSign size={20} className="mr-2 text-green-600" />
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

              {/* Modal Footer */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                  {isDraftSaved ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle size={14} className="mr-1" />
                      Changes saved automatically
                    </span>
                  ) : formData.itemName || formData.sku || formData.category ? (
                    <span className="flex items-center text-amber-600">
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
    </div>
  );
};

export default StockManagement;