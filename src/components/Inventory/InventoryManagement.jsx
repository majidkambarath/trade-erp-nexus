import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  Calendar,
  User,
  FileText,
  Eye,
  BarChart3,
  History,
  MapPin,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit3,
  RotateCcw,
  X,
} from "lucide-react";

import axios from "../../axios/axios";
const InventoryManagement = () => {
  const [movements, setMovements] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
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

  const eventTypes = [
    { value: "INITIAL_STOCK", label: "Initial Stock", color: "blue" },
    { value: "STOCK_ADJUSTMENT", label: "Stock Adjustment", color: "purple" },
    { value: "PURCHASE_RECEIVE", label: "Purchase Receive", color: "green" },
    { value: "SALES_DISPATCH", label: "Sales Dispatch", color: "red" },
    { value: "PURCHASE_RETURN", label: "Purchase Return", color: "orange" },
    { value: "SALES_RETURN", label: "Sales Return", color: "teal" },
    { value: "DAMAGED_STOCK", label: "Damaged Stock", color: "red" },
    { value: "TRANSFER_IN", label: "Transfer In", color: "indigo" },
    { value: "TRANSFER_OUT", label: "Transfer Out", color: "gray" },
  ];

  const itemsPerPage = 10;

  // Fetch stock items
  const fetchStockItems = useCallback(async () => {
    try {
      const response = await axios.get("/stock/stock");
      setStockItems(response.data.data.stocks);
    } catch (error) {
      console.error("Error fetching stock items:", error);
      setShowToast({
        visible: true,
        message: "Failed to fetch stock items",
        type: "error",
      });
    }
  }, []);

  // Fetch inventory movements
  const fetchMovements = useCallback(async () => {
    setIsLoading(true);
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
      const response = await axios.get("/inventory/inventory", { params });
      setMovements(response.data.data.movements);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("Error fetching movements:", error);
      setShowToast({
        visible: true,
        message: "Failed to fetch inventory movements",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, filterEventType, filterMovementType, dateRange]);

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get("/inventory/inventory/stats", {
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end,
        },
      });
      setStats(response.data.data.stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      setShowToast({
        visible: true,
        message: "Failed to fetch statistics",
        type: "error",
      });
    }
  }, [dateRange]);

  useEffect(() => {
    fetchStockItems();
    fetchMovements();
    fetchStats();
  }, [fetchStockItems, fetchMovements, fetchStats]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.stockId) newErrors.stockId = "Stock item is required";
    if (!formData.quantity) newErrors.quantity = "Quantity is required";
    if (!formData.referenceNumber)
      newErrors.referenceNumber = "Reference number is required";
    if (formData.unitCost && isNaN(formData.unitCost)) {
      newErrors.unitCost = "Unit cost must be a valid number";
    }
    return newErrors;
  };

  const handleSubmit = async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await axios.post("/inventory/inventory", formData);
      setShowToast({
        visible: true,
        message: "Inventory movement recorded successfully!",
        type: "success",
      });
      resetForm();
      fetchMovements();
      fetchStats();
    } catch (error) {
      setShowToast({
        visible: true,
        message:
          error.response?.data?.message ||
          "Failed to record inventory movement",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(
        () => setShowToast((prev) => ({ ...prev, visible: false })),
        3000
      );
    }
  };

  const resetForm = () => {
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
  };

  const getEventTypeBadge = (eventType) => {
    const type = eventTypes.find((t) => t.value === eventType);
    if (!type) return "bg-gray-100 text-gray-800";

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
  };

  const getMovementIcon = (quantity) => {
    return quantity > 0 ? ArrowUpCircle : ArrowDownCircle;
  };

  const getMovementColor = (quantity) => {
    return quantity > 0 ? "text-green-600" : "text-red-600";
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const showMovementDetails = (movement) => {
    setSelectedMovement(movement);
    setShowDetailsModal(true);
  };

  const handleExport = async () => {
    try {
      const response = await axios.get("/stock/stock/export");
      // Implement export logic (e.g., download as CSV)
      setShowToast({
        visible: true,
        message: "Export successful!",
        type: "success",
      });
    } catch (error) {
      setShowToast({
        visible: true,
        message: "Failed to export data",
        type: "error",
      });
    }
  };

  const handleRefresh = () => {
    fetchMovements();
    fetchStats();
    fetchStockItems();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Inventory Movements
          </h1>
          <p className="text-gray-600 mt-2">
            Track and manage all inventory movements and transactions
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExport}
            className="p-3 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
            title="Export Report"
          >
            <Download size={20} className="text-gray-600" />
          </button>
          <button
            onClick={handleRefresh}
            className="p-3 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
            title="Refresh Data"
          >
            <RefreshCw size={20} className="text-gray-600" />
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
              <CheckCircle2 size={20} />
            ) : (
              <XCircle size={20} />
            )}
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-blue-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">
                Total Movements
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.totalMovements}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Activity size={24} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-green-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Stock In</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.stockIn}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <ArrowUpCircle size={24} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-red-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Stock Out</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.stockOut}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <ArrowDownCircle size={24} className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-purple-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Value</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats.totalValue)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <BarChart3 size={24} className="text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-orange-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">
                Recent (24h)
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.recentMovements}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <Clock size={24} className="text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200">
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
              onClick={() => setShowModal(true)}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Plus size={18} />
              Record Movement
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
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
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={filterEventType}
                onChange={(e) => setFilterEventType(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) =>
                  setDateRange((prev) => ({ ...prev, end: e.target.value }))
                }
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600">Loading movements...</span>
          </div>
        )}

        {/* Movements Table */}
        {!isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
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
                      className="hover:bg-gray-50 transition-colors duration-200"
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
                              Stock: {movement.previousStock} →{" "}
                              {movement.newStock}
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
                              {movement.createdBy}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-right">
                          <p
                            className={`font-bold ${
                              movement.totalValue >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {movement.totalValue >= 0 ? "+" : ""}
                            {formatCurrency(movement.totalValue)}
                          </p>
                          <p className="text-xs text-gray-500">
                            @ {formatCurrency(movement.unitCost)} each
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => showMovementDetails(movement)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors duration-200"
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
                            ? "bg-blue-600 text-white"
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
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">
                  Record Movement
                </h3>
                <button
                  onClick={resetForm}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Stock Item *
                  </label>
                  <select
                    name="stockId"
                    value={formData.stockId}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.stockId
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Stock Item</option>
                    {stockItems.map((item) => (
                      <option key={item.itemId} value={item.itemId}>
                        {item.itemName} ({item.itemId})
                      </option>
                    ))}
                  </select>
                  {errors.stockId && (
                    <p className="text-red-500 text-sm mt-1">
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
                    placeholder="Enter quantity"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.quantity
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.quantity && (
                    <p className="text-red-500 text-sm mt-1">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.referenceNumber
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.referenceNumber && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.referenceNumber}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit Cost
                  </label>
                  <input
                    type="number"
                    name="unitCost"
                    value={formData.unitCost}
                    onChange={handleChange}
                    placeholder="0.00"
                    step="0.01"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.unitCost
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.unitCost && (
                    <p className="text-red-500 text-sm mt-1">
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                />
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center"
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
      )}

      {/* Movement Details Modal */}
      {showDetailsModal && selectedMovement && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">
                  Movement Details
                </h3>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
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
                          {selectedMovement.itemName ||
                            selectedMovement.stockId}
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
                          className={`font-bold ${
                            selectedMovement.totalValue >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {selectedMovement.totalValue >= 0 ? "+" : ""}
                          {formatCurrency(selectedMovement.totalValue)}
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
                        {selectedMovement.createdBy}
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
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all duration-200"
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
