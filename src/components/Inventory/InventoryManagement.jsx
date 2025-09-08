import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  Calendar,
  User,
  FileText,
  Eye,
  BarChart3,
  MapPin,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import DirhamIcon from "../../assets/dirham.svg";
import axiosInstance from "../../axios/axios";

// Session management utilities
const SessionManager = {
  storage: {},

  get: (key) => {
    try {
      return this.storage[`inventory_session_${key}`] || null;
    } catch {
      return null;
    }
  },

  set: (key, value) => {
    try {
      this.storage[`inventory_session_${key}`] = value;
    } catch (error) {
      console.warn("Session storage failed:", error);
    }
  },

  remove: (key) => {
    try {
      delete this.storage[`inventory_session_${key}`];
    } catch (error) {
      console.warn("Session removal failed:", error);
    }
  },

  clear: () => {
    Object.keys(this.storage).forEach((key) => {
      if (key.startsWith("inventory_session_")) {
        delete this.storage[key];
      }
    });
  },
};

// Utility function to map text color classes to SVG filters
const getColorFilter = (colorClass) => {
  const colorMap = {
    "text-gray-900": "none",
    "text-red-600": "invert(36%) sepia(95%) saturate(1492%) hue-rotate(332deg) brightness(95%) contrast(91%)",
    "text-yellow-600": "invert(66%) sepia(99%) saturate(1468%) hue-rotate(4deg) brightness(103%) contrast(88%)",
    "text-green-600": "invert(35%) sepia(74%) saturate(1056%) hue-rotate(123deg) brightness(94%) contrast(87%)",
  };
  return colorMap[colorClass] || "none";
};

const InventoryManagement = () => {
  const [movements, setMovements] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false); // Added showFilters state
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEventType, setFilterEventType] = useState("");
  const [filterMovementType, setFilterMovementType] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    totalMovements: 0,
    stockIn: 0,
    stockOut: 0,
    totalValue: 0,
    recentMovements: 0,
  });
  const [formData, setFormData] = useState({
    stockId: "",
    quantity: "",
    eventType: "STOCK_ADJUSTMENT",
    referenceNumber: "",
    unitCost: "",
    notes: "",
    batchNumber: "",
    expiryDate: "",
    location: "MAIN",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);

  const formRef = useRef(null);
  const autoSaveInterval = useRef(null);
  const itemsPerPage = 10;

  const eventTypes = [
    { value: "INITIAL_STOCK", label: "Initial Stock", color: "indigo" },
    { value: "STOCK_ADJUSTMENT", label: "Stock Adjustment", color: "purple" },
    { value: "PURCHASE_RECEIVE", label: "Purchase Receive", color: "green" },
    { value: "SALES_DISPATCH", label: "Sales Dispatch", color: "red" },
    { value: "PURCHASE_RETURN", label: "Purchase Return", color: "orange" },
    { value: "SALES_RETURN", label: "Sales Return", color: "teal" },
    { value: "DAMAGED_STOCK", label: "Damaged Stock", color: "red" },
    { value: "TRANSFER_IN", label: "Transfer In", color: "blue" },
    { value: "TRANSFER_OUT", label: "Transfer Out", color: "gray" },
  ];

  useEffect(() => {
    const savedFormData = SessionManager.get("formData");
    const savedFilters = SessionManager.get("filters");
    const savedSearchTerm = SessionManager.get("searchTerm");
    const savedShowFilters = SessionManager.get("showFilters");

    if (savedFormData && Object.values(savedFormData).some((val) => val)) {
      setFormData(savedFormData);
      setIsDraftSaved(true);
      setLastSaveTime(SessionManager.get("lastSaveTime"));
    }

    if (savedFilters) {
      setFilterEventType(savedFilters.eventType || "");
      setFilterMovementType(savedFilters.movementType || "");
      setDateRange(savedFilters.dateRange || { start: "", end: "" });
    }

    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }

    if (savedShowFilters !== null) {
      setShowFilters(savedShowFilters);
    }
  }, []);

  useEffect(() => {
    if (showModal && Object.values(formData).some((val) => val)) {
      autoSaveInterval.current = setTimeout(() => {
        SessionManager.set("formData", formData);
        SessionManager.set("lastSaveTime", new Date().toISOString());
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

  useEffect(() => {
    SessionManager.set("searchTerm", searchTerm);
    SessionManager.set("filters", {
      eventType: filterEventType,
      movementType: filterMovementType,
      dateRange,
    });
    SessionManager.set("showFilters", showFilters);
  }, [searchTerm, filterEventType, filterMovementType, dateRange, showFilters]);

  const fetchStockItems = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/stock/stock");
      setStockItems(response.data.data?.stocks || []);
    } catch (error) {
      console.error("Error fetching stock items:", error);
      showToastMessage("Failed to fetch stock items", "error");
    }
  }, []);

  const fetchMovements = useCallback(async (showRefreshIndicator = false) => {
    setIsLoading(showRefreshIndicator ? false : true);
    try {
      const params = {
        page,
        limit: itemsPerPage,
        search: searchTerm,
        eventType: filterEventType,
        movementType: filterMovementType,
        startDate: dateRange.start,
        endDate: dateRange.end,
      };
      const response = await axiosInstance.get("/inventory/inventory", { params });
      setMovements(response.data.data?.movements || []);
      setTotalPages(response.data.totalPages || 1);
      if (showRefreshIndicator) {
        showToastMessage("Data refreshed successfully!", "success");
      }
    } catch (error) {
      console.error("Error fetching movements:", error);
      showToastMessage(
        error.response?.data?.message || "Failed to fetch inventory movements",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, filterEventType, filterMovementType, dateRange]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/inventory/inventory/stats", {
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end,
        },
      });
      setStats(response.data.data?.stats || {
        totalMovements: 0,
        stockIn: 0,
        stockOut: 0,
        totalValue: 0,
        recentMovements: 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      showToastMessage("Failed to fetch statistics", "error");
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStockItems();
    fetchMovements();
    fetchStats();
  }, [fetchStockItems, fetchMovements, fetchStats]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  }, []);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
      setIsDraftSaved(false);
    },
    [errors]
  );

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.stockId) newErrors.stockId = "Stock item is required";
    if (!formData.quantity || isNaN(formData.quantity) || Number(formData.quantity) === 0) {
      newErrors.quantity = "Valid non-zero quantity is required";
    }
    if (!formData.referenceNumber)
      newErrors.referenceNumber = "Reference number is required";
    if (formData.unitCost && (isNaN(formData.unitCost) || Number(formData.unitCost) < 0)) {
      newErrors.unitCost = "Unit cost must be a valid non-negative number";
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
        ...formData,
        quantity: Number(formData.quantity),
        unitCost: Number(formData.unitCost) || 0,
      };
      await axiosInstance.post("/inventory/inventory", payload);
      showToastMessage("Inventory movement recorded successfully!", "success");
      resetForm();
      fetchMovements();
      fetchStats();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to record inventory movement",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, fetchMovements, fetchStats, showToastMessage]);

  const resetForm = useCallback(() => {
    setFormData({
      stockId: "",
      quantity: "",
      eventType: "STOCK_ADJUSTMENT",
      referenceNumber: "",
      unitCost: "",
      notes: "",
      batchNumber: "",
      expiryDate: "",
      location: "MAIN",
    });
    setErrors({});
    setShowModal(false);
    setIsDraftSaved(false);
    setLastSaveTime(null);
    SessionManager.remove("formData");
    SessionManager.remove("lastSaveTime");
  }, []);

  const formatCurrency = useCallback((amount, colorClass = "text-gray-900") => {
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
  }, []);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return "";
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    return time.toLocaleTimeString();
  }, []);

  const showMovementDetails = useCallback((movement) => {
    setSelectedMovement(movement);
    setShowDetailsModal(true);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const csv = [
        "MovementID,StockID,ItemName,Quantity,EventType,ReferenceNumber,UnitCost,TotalValue,Location,Date,CreatedBy",
        ...movements.map(
          (m) =>
            `${m._id},${m.stockId},"${m.itemName || m.stockId}",${m.quantity},${
              m.eventType
            },${m.referenceNumber},${m.unitCost},${m.totalValue},${
              m.location
            },${m.date},${m.createdBy || "Unknown"}`
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "inventory_movements_export.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToastMessage("Inventory movements exported successfully!", "success");
    } catch (error) {
      showToastMessage("Failed to export data", "error");
    }
  }, [movements, showToastMessage]);

  const handleRefresh = useCallback(() => {
    fetchMovements(true);
    fetchStats();
    fetchStockItems();
  }, [fetchMovements, fetchStats, fetchStockItems]);

  const getEventTypeBadge = useCallback((eventType) => {
    const type = eventTypes.find((t) => t.value === eventType);
    if (!type) return "bg-gray-100 text-gray-800 border-gray-200";

    const colors = {
      blue: "bg-blue-100 text-blue-800 border-blue-200",
      purple: "bg-purple-100 text-purple-800 border-purple-200",
      green: "bg-green-100 text-green-800 border-green-200",
      red: "bg-red-100 text-red-800 border-red-200",
      orange: "bg-orange-100 text-orange-800 border-orange-200",
      teal: "bg-teal-100 text-teal-800 border-teal-200",
      indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
      gray: "bg-gray-100 text-gray-800 border-gray-200",
    };

    return colors[type.color] || colors.gray;
  }, []);

  const getMovementIcon = useCallback((quantity) => {
    return quantity > 0 ? ArrowUpCircle : ArrowDownCircle;
  }, []);

  const getMovementColor = useCallback((quantity) => {
    return quantity > 0 ? "text-green-600" : "text-red-600";
  }, []);

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black bg-clip-text">
              Inventory Movements
            </h1>
            <p className="text-gray-600 mt-1">
              {stats.totalMovements} total movements • {movements.length} displayed
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
            disabled={isLoading}
            className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw
              size={16}
              className={`text-gray-600 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
              showFilters
                ? "bg-indigo-100 text-indigo-600"
                : "bg-white text-gray-600"
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
              <CheckCircle2 size={16} />
            ) : (
              <XCircle size={16} />
            )}
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {[
          {
            title: "Total Movements",
            count: stats.totalMovements,
            icon: <Activity size={24} />,
            bgColor: "bg-indigo-50",
            textColor: "text-indigo-700",
            borderColor: "border-indigo-200",
            iconBg: "bg-indigo-100",
            iconColor: "text-indigo-600",
          },
          {
            title: "Stock In",
            count: stats.stockIn,
            icon: <ArrowUpCircle size={24} />,
            bgColor: "bg-green-50",
            textColor: "text-green-700",
            borderColor: "border-green-200",
            iconBg: "bg-green-100",
            iconColor: "text-green-600",
          },
          {
            title: "Stock Out",
            count: stats.stockOut,
            icon: <ArrowDownCircle size={24} />,
            bgColor: "bg-red-50",
            textColor: "text-red-700",
            borderColor: "border-red-200",
            iconBg: "bg-red-100",
            iconColor: "text-red-600",
          },
          {
            title: "Total Value",
            count: formatCurrency(stats.totalValue),
            icon: <BarChart3 size={24} />,
            bgColor: "bg-purple-50",
            textColor: "text-purple-700",
            borderColor: "border-purple-200",
            iconBg: "bg-purple-100",
            iconColor: "text-purple-600",
          },
          {
            title: "Recent (24h)",
            count: stats.recentMovements,
            icon: <Clock size={24} />,
            bgColor: "bg-orange-50",
            textColor: "text-orange-700",
            borderColor: "border-orange-200",
            iconBg: "bg-orange-100",
            iconColor: "text-orange-600",
          },
        ].map((card, index) => (
          <div
            key={index}
            className={`${card.bgColor} ${card.borderColor} rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-105`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 ${card.iconBg} rounded-xl`}>
                <div className={card.iconColor}>{card.icon}</div>
              </div>
              <button
                className={`text-xs ${card.textColor} hover:opacity-80 transition-opacity font-medium`}
                onClick={() => {
                  if (card.title.includes("Stock In"))
                    setFilterMovementType("IN");
                  else if (card.title.includes("Stock Out"))
                    setFilterMovementType("OUT");
                }}
              >
                View All →
              </button>
            </div>
            <h3 className={`text-sm font-medium ${card.textColor} mb-2`}>
              {card.title}
            </h3>
            <p className="text-3xl font-bold text-gray-900">{card.count}</p>
            <p className="text-xs text-gray-500 mt-1">
              {card.title.includes("Total Movements")
                ? "All transactions"
                : card.title.includes("Stock In")
                ? "Incoming stock"
                : card.title.includes("Stock Out")
                ? "Outgoing stock"
                : card.title.includes("Total Value")
                ? "Financial impact"
                : "Last 24 hours"}
            </p>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Movement History
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Track all inventory movements and changes
              </p>
            </div>
            <button
              onClick={() => {
                setShowModal(true);
                setTimeout(() => {
                  if (formRef.current) {
                    const firstInput = formRef.current.querySelector('select[name="stockId"]');
                    if (firstInput) firstInput.focus();
                  }
                }, 10);
              }}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} />
              Record Movement
            </button>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="flex flex-col lg:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search by item name, stock ID, or reference number..."
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
              <div className="flex flex-wrap gap-3">
                <select
                  value={filterEventType}
                  onChange={(e) => setFilterEventType(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All Event Types</option>
                  {eventTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterMovementType}
                  onChange={(e) => setFilterMovementType(e.target.value)}
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All Movements</option>
                  <option value="IN">Stock In</option>
                  <option value="OUT">Stock Out</option>
                </select>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, start: e.target.value }))
                  }
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, end: e.target.value }))
                  }
                  className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  onClick={() => {
                    setFilterEventType("");
                    setFilterMovementType("");
                    setDateRange({ start: "", end: "" });
                    setSearchTerm("");
                  }}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
            <span className="ml-3 text-gray-600">Loading movements...</span>
          </div>
        )}

        {/* Movements Table */}
        {!isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Item Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Movement
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Event Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date & User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {movements.map((movement) => {
                  const MovementIcon = getMovementIcon(movement.quantity);
                  const movementColor = getMovementColor(movement.quantity);

                  return (
                    <tr
                      key={movement._id}
                      className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <Package size={16} className="text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {movement.itemName || movement.stockId}
                            </p>
                            <p className="text-sm text-gray-500">
                              ID: {movement.stockId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <MovementIcon size={20} className={movementColor} />
                          <div>
                            <p className={`font-bold ${movementColor}`}>
                              {movement.quantity > 0 ? "+" : ""}
                              {movement.quantity}
                            </p>
                            <p className="text-xs text-gray-500">
                              Stock: {movement.previousStock} → {movement.newStock}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getEventTypeBadge(
                            movement.eventType
                          )}`}
                        >
                          {eventTypes.find(
                            (t) => t.value === movement.eventType
                          )?.label || movement.eventType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <FileText size={16} className="text-gray-400" />
                          <span className="font-mono text-sm text-gray-900">
                            {movement.referenceNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {formatDate(movement.date)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <User size={14} className="text-gray-400" />
                            <span className="text-sm text-gray-600">
                              {movement.createdBy || "Unknown"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-right">
                          <p
                            className={`font-bold ${getMovementColor(
                              movement.totalValue
                            )}`}
                          >
                            {movement.totalValue >= 0 ? "+" : ""}
                            {formatCurrency(movement.totalValue, getMovementColor(movement.totalValue))}
                          </p>
                          <p className="text-xs text-gray-500">
                             {formatCurrency(movement.unitCost)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => showMovementDetails(movement)}
                            className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors duration-200"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {movements.length === 0 && (
              <div className="text-center py-12">
                <Activity size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No inventory movements found</p>
                <p className="text-gray-400 text-sm">
                  Try adjusting your search criteria or add a new movement
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && movements.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>Showing</span>
                <span className="font-semibold">
                  {(page - 1) * itemsPerPage + 1}-
                  {Math.min(page * itemsPerPage, movements.length)}
                </span>
                <span>of</span>
                <span className="font-semibold">{movements.length}</span>
                <span>movements</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNumber = i + 1;
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setPage(pageNumber)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                          page === pageNumber
                            ? "bg-indigo-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Movement Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  Record Movement
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    Create a new inventory movement
                  </p>
                  {isDraftSaved && lastSaveTime && (
                    <p className="text-sm text-green-600 flex items-center">
                      <CheckCircle2 size={12} className="mr-1" />
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

            <div className="p-6 space-y-6" ref={formRef}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Stock Item *
                  </label>
                  <select
                    name="stockId"
                    value={formData.stockId}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.stockId
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Stock Item</option>
                    {stockItems.map((item) => (
                      <option key={item._id} value={item._id}>
                        {item.itemName} ({item.sku})
                      </option>
                    ))}
                  </select>
                  {errors.stockId && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.stockId}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleChange}
                    placeholder="Enter quantity (positive or negative)"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.quantity
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.quantity && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.quantity}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Event Type *
                  </label>
                  <select
                    name="eventType"
                    value={formData.eventType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  >
                    {eventTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reference Number *
                  </label>
                  <input
                    type="text"
                    name="referenceNumber"
                    value={formData.referenceNumber}
                    onChange={handleChange}
                    placeholder="e.g., PO-2024-001"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.referenceNumber
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.referenceNumber && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.referenceNumber}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit Cost (AED)
                  </label>
                  <input
                    type="number"
                    name="unitCost"
                    value={formData.unitCost}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.unitCost
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.unitCost && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.unitCost}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="MAIN"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
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
                    placeholder="Optional batch number"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
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
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  placeholder="Additional notes or comments..."
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 resize-none"
                />
              </div>

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                  {isDraftSaved ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle2 size={14} className="mr-1" />
                      Changes saved automatically
                    </span>
                  ) : formData.stockId || formData.quantity || formData.referenceNumber ? (
                    <span className="flex items-center text-amber-600">
                      <Clock size={14} className="mr-1" />
                      Unsaved changes
                    </span>
                  ) : null}
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={resetForm}
                    disabled={isSubmitting}
                    className="px-6 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="mr-2 animate-spin" />
                        Recording...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} className="mr-2" />
                        Record Movement
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Movement Details Modal */}
      {showDetailsModal && selectedMovement && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
              <h3 className="text-xl font-bold text-gray-900">
                Movement Details
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Item Information
                    </label>
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Package size={20} className="text-indigo-600" />
                      <div>
                        <p className="font-semibold text-gray-900">
                          {selectedMovement.itemName || selectedMovement.stockId}
                        </p>
                        <p className="text-sm text-gray-500">
                          ID: {selectedMovement.stockId}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Movement Details
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        {selectedMovement.quantity > 0 ? (
                          <ArrowUpCircle size={20} className="text-green-600" />
                        ) : (
                          <ArrowDownCircle size={20} className="text-red-600" />
                        )}
                        <span
                          className={`font-bold text-lg ${
                            selectedMovement.quantity > 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {selectedMovement.quantity > 0 ? "+" : ""}
                          {selectedMovement.quantity}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Stock changed from {selectedMovement.previousStock} to{" "}
                        {selectedMovement.newStock}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Event Type
                    </label>
                    <span
                      className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${getEventTypeBadge(
                        selectedMovement.eventType
                      )}`}
                    >
                      {eventTypes.find(
                        (t) => t.value === selectedMovement.eventType
                      )?.label || selectedMovement.eventType}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Reference Number
                    </label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <FileText size={16} className="text-gray-400" />
                      <span className="font-mono text-sm">
                        {selectedMovement.referenceNumber}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Financial Information
                    </label>
                    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">
                          Unit Cost:
                        </span>
                        <span className="font-semibold">
                          {formatCurrency(selectedMovement.unitCost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">
                          Total Value:
                        </span>
                        <span
                          className={`font-bold ${getMovementColor(
                            selectedMovement.totalValue
                          )}`}
                        >
                          {selectedMovement.totalValue >= 0 ? "+" : ""}
                          {formatCurrency(
                            selectedMovement.totalValue,
                            getMovementColor(selectedMovement.totalValue)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Location
                    </label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <MapPin size={16} className="text-gray-400" />
                      <span className="text-sm">
                        {selectedMovement.location}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Created By
                    </label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <User size={16} className="text-gray-400" />
                      <span className="text-sm">
                        {selectedMovement.createdBy || "Unknown"}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Date & Time
                    </label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <Calendar size={16} className="text-gray-400" />
                      <span className="text-sm">
                        {formatDate(selectedMovement.date)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedMovement.notes && (
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-600 mb-2">
                    Notes
                  </label>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">
                      {selectedMovement.notes}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-2 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryManagement;