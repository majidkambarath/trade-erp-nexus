import React, { useCallback, useMemo, useState, useEffect } from "react";
import {
  ShoppingCart,
  Building,
  User,
  Calendar,
  Hash,
  Package,
  DollarSign,
  Plus,
  Trash2,
  Eye,
  Edit3,
  CheckCircle,
  ArrowLeft,
  Truck,
  AlertCircle,
  Search,
  Filter,
  FileText,
  X,
  Save,
  Send,
  Clock,
  CheckSquare,
  XCircle,
  Receipt,
  Download,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Grid,
  List,
  Settings,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Archive,
} from "lucide-react";
import axiosInstance from "../../../axios/axios"; // Import the configured Axios instance
import POForm from "./POForm";
import TableView from "./TableView";
import GridView from "./GridView";
import InvoiceView from "./InvoiceView";

const PurchaseReturnOrderManagement = () => {
  const [activeView, setActiveView] = useState("dashboard"); // dashboard, list, create, edit, invoice
  const [viewMode, setViewMode] = useState("table"); // table, grid
  const [selectedPO, setSelectedPO] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [notifications, setNotifications] = useState([]);
  const [selectedPOs, setSelectedPOs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [createdPO, setCreatedPO] = useState(null); // Track newly created PO

  // Form state for creating/editing PO
  const [formData, setFormData] = useState({
    transactionNo: "",
    partyId: "",
    date: new Date().toISOString().slice(0, 10),
    deliveryDate: "",
    status: "DRAFT",
    items: [
      {
        itemId: "",
        description: "",
        qty: "",
        rate: "",
        taxPercent: "5",
      },
    ],
    terms: "",
    notes: "",
    priority: "Medium",
  });

  // Fetch vendors, stock items, and transactions on component mount
  useEffect(() => {
    fetchVendors();
    fetchStockItems();
    fetchTransactions();
  }, []);

  // Refetch transactions when filters change
  useEffect(() => {
    fetchTransactions();
  }, [searchTerm, statusFilter, vendorFilter, dateFilter]);

  // Fetch vendors from backend
  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/vendors/vendors");
      console.log("Vendors Response:", response.data); // Debug
      setVendors(response.data.data || []);
    } catch (error) {
      console.error("Fetch Vendors Error:", error);
      addNotification(
        "Failed to fetch vendors: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch stock items from backend
  const fetchStockItems = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/stock/stock");
      console.log("Stock Items Response:", response.data); // Debug
      const stocks = response.data.data?.stocks || response.data.data || [];
      setStockItems(
        stocks.map((item) => ({
          _id: item._id,
          itemId: item.itemId,
          itemName: item.itemName,
          sku: item.sku,
          category: item.category,
          unitOfMeasure: item.unitOfMeasure,
          currentStock: item.currentStock,
          purchasePrice: item.purchasePrice,
          salesPrice: item.salesPrice,
          reorderLevel: item.reorderLevel,
          status: item.status,
        }))
      );
    } catch (error) {
      console.error("Fetch Stock Items Error:", error);
      addNotification(
        "Failed to fetch stock items: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch transactions from backend
  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/transactions/transactions", {
        params: {
          type: "purchase_return",
          search: searchTerm,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          partyId: vendorFilter !== "ALL" ? vendorFilter : undefined,
          dateFilter: dateFilter !== "ALL" ? dateFilter : undefined,
        },
      });
      console.log("Transactions Response:", response.data); // Debug
      setPurchaseOrders(
        response.data.data.map((transaction) => ({
          id: transaction._id,
          transactionNo: transaction.transactionNo,
          vendorId: transaction.partyId,
          vendorName: transaction.partyName,
          date: transaction.date,
          deliveryDate: transaction.deliveryDate,
          status: transaction.status,
          approvalStatus: transaction.status,
          totalAmount: transaction.totalAmount.toFixed(2),
          items: transaction.items,
          terms: transaction.terms,
          notes: transaction.notes,
          createdBy: transaction.createdBy,
          createdAt: transaction.createdAt,
          grnGenerated: transaction.grnGenerated,
          invoiceGenerated: transaction.invoiceGenerated,
          priority: transaction.priority,
        }))
      );
    } catch (error) {
      console.error("Fetch Transactions Error:", error);
      addNotification(
        "Failed to fetch transactions: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Generate transaction number on create view
  useEffect(() => {
    if (activeView === "create") {
      generateTransactionNumber();
    }
  }, [activeView]);

  const generateTransactionNumber = () => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const sequence = String(Math.floor(Math.random() * 999) + 1).padStart(
      3,
      "0"
    );
    setFormData((prev) => ({
      ...prev,
      transactionNo: `PR-${dateStr}-${sequence}`,
    }));
  };

  const addNotification = (message, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // Handle successful PO save - redirect to invoice without resetting selectedPO prematurely
  const handlePOSuccess = (newPO) => {
    setCreatedPO(newPO);
    setSelectedPO(newPO);
    setActiveView("invoice");
    addNotification(
      "Purchase Return Order saved successfully! Showing invoice...",
      "success"
    );
    // Reset form after navigation to avoid conflicting with invoice view
    setTimeout(resetForm, 0); // Delay to ensure state updates are processed
  };

  // Statistics calculations
  const getStatistics = useMemo(
    () => () => {
      const total = purchaseOrders.length;
      const pending = purchaseOrders.filter(
        (po) => po.status === "PENDING"
      ).length;
      const approved = purchaseOrders.filter(
        (po) => po.status === "APPROVED"
      ).length;
      const draft = purchaseOrders.filter((po) => po.status === "DRAFT").length;
      const rejected = purchaseOrders.filter(
        (po) => po.status === "REJECTED"
      ).length;

      const totalValue = purchaseOrders.reduce(
        (sum, po) => sum + parseFloat(po.totalAmount),
        0
      );
      const approvedValue = purchaseOrders
        .filter((po) => po.status === "APPROVED")
        .reduce((sum, po) => sum + parseFloat(po.totalAmount), 0);

      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();
      const thisMonthPOs = purchaseOrders.filter((po) => {
        const poDate = new Date(po.date);
        return (
          poDate.getMonth() === thisMonth && poDate.getFullYear() === thisYear
        );
      }).length;

      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
      const lastMonthPOs = purchaseOrders.filter((po) => {
        const poDate = new Date(po.date);
        return (
          poDate.getMonth() === lastMonth &&
          poDate.getFullYear() === lastMonthYear
        );
      }).length;

      const growthRate =
        lastMonthPOs === 0
          ? 0
          : ((thisMonthPOs - lastMonthPOs) / lastMonthPOs) * 100;

      return {
        total,
        pending,
        approved,
        draft,
        rejected,
        totalValue,
        approvedValue,
        thisMonthPOs,
        growthRate,
      };
    },
    [purchaseOrders]
  );

  const statistics = getStatistics();

  // Filtering and sorting logic
  const filteredAndSortedPOs = useMemo(
    () => () => {
      let filtered = purchaseOrders.filter((po) => {
        const matchesSearch =
          po.transactionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          po.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          po.createdBy.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus =
          statusFilter === "ALL" || po.status === statusFilter;
        const matchesVendor =
          vendorFilter === "ALL" || po.vendorId === vendorFilter;

        let matchesDate = true;
        if (dateFilter !== "ALL") {
          const poDate = new Date(po.date);
          const today = new Date();

          switch (dateFilter) {
            case "TODAY":
              matchesDate = poDate.toDateString() === today.toDateString();
              break;
            case "WEEK":
              const weekAgo = new Date(
                today.getTime() - 7 * 24 * 60 * 60 * 1000
              );
              matchesDate = poDate >= weekAgo;
              break;
            case "MONTH":
              const monthAgo = new Date(
                today.getFullYear(),
                today.getMonth() - 1,
                today.getDate()
              );
              matchesDate = poDate >= monthAgo;
              break;
          }
        }

        return matchesSearch && matchesStatus && matchesVendor && matchesDate;
      });

      filtered.sort((a, b) => {
        let aVal, bVal;

        switch (sortBy) {
          case "date":
            aVal = new Date(a.date);
            bVal = new Date(b.date);
            break;
          case "amount":
            aVal = parseFloat(a.totalAmount);
            bVal = parseFloat(b.totalAmount);
            break;
          case "vendor":
            aVal = a.vendorName;
            bVal = b.vendorName;
            break;
          case "status":
            aVal = a.status;
            bVal = b.status;
            break;
          default:
            aVal = a.transactionNo;
            bVal = b.transactionNo;
        }

        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });

      return filtered;
    },
    [
      purchaseOrders,
      searchTerm,
      statusFilter,
      vendorFilter,
      dateFilter,
      sortBy,
      sortOrder,
    ]
  );

  const filteredPOs = filteredAndSortedPOs();
  const totalPages = Math.ceil(filteredPOs.length / itemsPerPage);
  const paginatedPOs = filteredPOs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "PENDING":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "REJECTED":
        return "bg-rose-100 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "DRAFT":
        return <Edit3 className="w-3 h-3" />;
      case "PENDING":
        return <Clock className="w-3 h-3" />;
      case "APPROVED":
        return <CheckCircle className="w-3 h-3" />;
      case "REJECTED":
        return <XCircle className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-500";
      case "Medium":
        return "bg-yellow-500";
      case "Low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const handleBulkAction = async (action) => {
    if (selectedPOs.length === 0) {
      addNotification(
        "Please select orders to perform bulk actions",
        "warning"
      );
      return;
    }

    try {
      if (action === "approve") {
        for (const poId of selectedPOs) {
          await axiosInstance.patch(
            `/transactions/transactions/${poId}/process`,
            {
              action: "approve",
            }
          );
        }
        addNotification(
          `${selectedPOs.length} orders approved successfully`,
          "success"
        );
        fetchTransactions();
      } else if (action === "delete") {
        if (window.confirm(`Delete ${selectedPOs.length} selected orders?`)) {
          for (const poId of selectedPOs) {
            await axiosInstance.delete(`/transactions/transactions/${poId}`);
          }
          addNotification(`${selectedPOs.length} orders deleted`, "success");
          fetchTransactions();
        }
      } else if (action === "export") {
        addNotification(`Exporting ${selectedPOs.length} orders...`, "info");
        const csv = [
          "TransactionNo,Vendor,Date,DeliveryDate,Status,TotalAmount,Priority",
          ...selectedPOs.map((poId) => {
            const po = purchaseOrders.find((p) => p.id === poId);
            return `${po.transactionNo},${po.vendorName},${po.date},${po.deliveryDate},${po.status},${po.totalAmount},${po.priority}`;
          }),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "selected_purchase_return_orders.csv";
        link.click();
        addNotification("Orders exported successfully", "success");
      }
      setSelectedPOs([]);
    } catch (error) {
      console.error("Bulk Action Error:", error);
      addNotification(
        "Bulk action failed: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    }
  };

  // Notifications Component
  const NotificationList = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`px-4 py-3 rounded-lg shadow-lg max-w-sm backdrop-blur-sm ${
            notification.type === "success"
              ? "bg-emerald-500/90 text-white"
              : notification.type === "warning"
              ? "bg-amber-500/90 text-white"
              : notification.type === "error"
              ? "bg-rose-500/90 text-white"
              : "bg-blue-500/90 text-white"
          } animate-slide-in border border-white/20`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === "success" && (
              <CheckCircle className="w-4 h-4" />
            )}
            {notification.type === "warning" && (
              <AlertCircle className="w-4 h-4" />
            )}
            {notification.type === "error" && (
              <AlertCircle className="w-4 h-4" />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      ))}
    </div>
  );

  // Dashboard Component
  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">
                Total Return Orders
              </p>
              <p className="text-3xl font-bold text-slate-900">
                {statistics.total}
              </p>
              <div className="flex items-center mt-2">
                {statistics.growthRate >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-500 mr-1" />
                )}
                <span
                  className={`text-sm font-medium ${
                    statistics.growthRate >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {Math.abs(statistics.growthRate).toFixed(1)}% from last month
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">
                Pending Approval
              </p>
              <p className="text-3xl font-bold text-amber-600">
                {statistics.pending}
              </p>
              <p className="text-sm text-slate-500 mt-2">Requires attention</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Value</p>
              <p className="text-3xl font-bold text-emerald-600">
                AED {statistics.totalValue.toLocaleString()}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Approved: AED {statistics.approvedValue.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">This Month</p>
              <p className="text-3xl font-bold text-indigo-600">
                {statistics.thisMonthPOs}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                New return orders created
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Recent Purchase Return Orders
          </h3>
          <div className="space-y-3">
            {purchaseOrders.slice(0, 5).map((po) => (
              <div
                key={po.id}
                className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${getPriorityColor(
                      po.priority
                    )}`}
                  ></div>
                  <div>
                    <p className="font-medium text-slate-900">
                      {po.transactionNo}
                    </p>
                    <p className="text-sm text-slate-600">{po.vendorName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      po.status
                    )}`}
                  >
                    {getStatusIcon(po.status)}
                    <span className="ml-1">{po.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    AED {parseFloat(po.totalAmount).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setActiveView("list")}
            className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            View All Orders →
          </button>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Status Overview
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Approved</span>
                <span className="text-xs font-medium text-emerald-600">
                  {statistics.approved}
                </span>
              </div>
              <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                  style={{
                    width: `${
                      (statistics.approved / statistics.total) * 100 || 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Pending</span>
                <span className="text-xs font-medium text-amber-600">
                  {statistics.pending}
                </span>
              </div>
              <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500 ease-out"
                  style={{
                    width: `${
                      (statistics.pending / statistics.total) * 100 || 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Draft</span>
                <span className="text-xs font-medium text-slate-600">
                  {statistics.draft}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-400 transition-all duration-500 ease-out"
                  style={{
                    width: `${
                      (statistics.draft / statistics.total) * 100 || 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Rejected</span>
                <span className="text-xs font-medium text-rose-600">
                  {statistics.rejected}
                </span>
              </div>
              <div className="h-2 bg-rose-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-500 ease-out"
                  style={{
                    width: `${
                      (statistics.rejected / statistics.total) * 100 || 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Pagination Component
  const Pagination = () => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredPOs.length);

    return (
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-slate-600">
            Showing {startItem} to {endItem} of {filteredPOs.length} orders
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex space-x-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(prev + 1, totalPages))
            }
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const resetForm = useCallback(() => {
    setFormData({
      transactionNo: "",
      partyId: "",
      date: new Date().toISOString().slice(0, 10),
      deliveryDate: "",
      status: "DRAFT",
      items: [
        {
          itemId: "",
          description: "",
          qty: "",
          rate: "",
          taxPercent: "5",
        },
      ],
      terms: "",
      notes: "",
      priority: "Medium",
    });
    setFormErrors({});
    // Removed setSelectedPO(null) to prevent clearing during navigation to invoice
  }, []);

  // Calculate totals for items
  const calculateTotals = (items) => {
    let subtotal = 0;
    let tax = 0;

    items.forEach((item) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const taxPercent = parseFloat(item.taxPercent) || 0;

      const lineSubtotal = qty * rate;
      const lineTax = lineSubtotal * (taxPercent / 100);

      subtotal += lineSubtotal;
      tax += lineTax;
    });

    const total = (subtotal + tax).toFixed(2);
    subtotal = subtotal.toFixed(2);
    tax = tax.toFixed(2);

    return { subtotal, tax, total };
  };

  // Edit PO
  const editPO = (po) => {
    setFormData({
      transactionNo: po.transactionNo,
      partyId: po.vendorId,
      date: new Date(po.date).toISOString().slice(0, 10),
      deliveryDate: po.deliveryDate
        ? new Date(po.deliveryDate).toISOString().slice(0, 10)
        : "",
      status: po.status,
      items: po.items.map((item) => ({
        itemId: item.itemId,
        description: item.description,
        qty: item.qty.toString(),
        rate: item.rate.toString(),
        taxPercent: item.taxPercent.toString(),
      })),
      terms: po.terms || "",
      notes: po.notes || "",
      priority: po.priority || "Medium",
    });
    setSelectedPO(po);
    setActiveView("edit");
  };

  // Approve PO
  const approvePO = async (id) => {
    try {
      await axiosInstance.patch(`/transactions/transactions/${id}/process`, {
        action: "approve",
      });
      addNotification("Purchase Return Order approved successfully", "success");
      fetchTransactions();
    } catch (error) {
      console.error("Approve PO Error:", error);
      addNotification(
        "Failed to approve purchase return order: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    }
  };

  // Reject PO
  const rejectPO = async (id) => {
    try {
      await axiosInstance.patch(`/transactions/transactions/${id}/process`, {
        action: "reject",
      });
      addNotification("Purchase Return Order rejected successfully", "success");
      fetchTransactions();
    } catch (error) {
      console.error("Reject PO Error:", error);
      addNotification(
        "Failed to reject purchase return order: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    }
  };

  // Delete PO
  const deletePO = async (id) => {
    if (
      window.confirm(
        "Are you sure you want to delete this purchase return order?"
      )
    ) {
      try {
        await axiosInstance.delete(`/transactions/transactions/${id}`);
        addNotification(
          "Purchase Return Order deleted successfully",
          "success"
        );
        fetchTransactions();
      } catch (error) {
        console.error("Delete PO Error:", error);
        addNotification(
          "Failed to delete purchase return order: " +
            (error.response?.data?.message || error.message),
          "error"
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NotificationList />
      <div className="relative bg-white/80 backdrop-blur-xl shadow-xl border-b border-gray-200/50">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  Purchase Return Order Management
                </h1>
                <p className="text-slate-600 mt-1">
                  Manage your purchase return orders efficiently
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  resetForm();
                  setSelectedPO(null); // Clear selectedPO when starting new create
                  setActiveView("create");
                  generateTransactionNumber();
                }}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                <span>Create New PR</span>
              </button>
              <button
                onClick={() => {
                  fetchVendors();
                  fetchStockItems();
                  fetchTransactions();
                }}
                className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-slate-600" />
              </button>
              <button className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
                <Settings className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>
        </div>

        {(activeView === "dashboard" || activeView === "list") && (
          <div className="px-8 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-t border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by PR number, vendor, or user..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-80 pl-10 pr-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>

                <select
                  value={vendorFilter}
                  onChange={(e) => {
                    setVendorFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ALL">All Vendors</option>
                  {vendors.map((vendor) => (
                    <option key={vendor._id} value={vendor._id}>
                      {vendor.vendorName}
                    </option>
                  ))}
                </select>

                <select
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ALL">All Dates</option>
                  <option value="TODAY">Today</option>
                  <option value="WEEK">This Week</option>
                  <option value="MONTH">This Month</option>
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setActiveView("dashboard")}
                  className={`p-3 rounded-xl transition-colors ${
                    activeView === "dashboard"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-3 rounded-xl transition-colors ${
                    viewMode === "table"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-3 rounded-xl transition-colors ${
                    viewMode === "grid"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                {selectedPOs.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleBulkAction("approve")}
                      className="flex items-center space-x-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Approve Selected</span>
                    </button>
                    <button
                      onClick={() => handleBulkAction("delete")}
                      className="flex items-center space-x-2 px-4 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Selected</span>
                    </button>
                    <button
                      onClick={() => handleBulkAction("export")}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Selected</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {activeView === "dashboard" && <Dashboard />}
            {activeView === "list" && (
              <>
                {viewMode === "table" ? (
                  <TableView
                    paginatedPOs={paginatedPOs}
                    selectedPOs={selectedPOs}
                    setSelectedPOs={setSelectedPOs}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                    getStatusIcon={getStatusIcon}
                    handleSort={handleSort}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    setSelectedPO={setSelectedPO}
                    setActiveView={setActiveView}
                    editPO={editPO}
                    approvePO={approvePO}
                    deletePO={deletePO}
                  />
                ) : (
                  <GridView
                    paginatedPOs={paginatedPOs}
                    selectedPOs={selectedPOs}
                    setSelectedPOs={setSelectedPOs}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                    getStatusIcon={getStatusIcon}
                    setSelectedPO={setSelectedPO}
                    setActiveView={setActiveView}
                    editPO={editPO}
                    approvePO={approvePO}
                    rejectPO={rejectPO}
                    deletePO={deletePO}
                  />
                )}
                {filteredPOs.length > 0 && <Pagination />}
              </>
            )}
            {(activeView === "create" || activeView === "edit") && (
              <POForm
                formData={formData}
                setFormData={setFormData}
                vendors={vendors}
                stockItems={stockItems}
                addNotification={addNotification}
                selectedPO={selectedPO}
                setSelectedPO={setSelectedPO}
                setActiveView={setActiveView}
                setPurchaseOrders={setPurchaseOrders}
                resetForm={resetForm}
                calculateTotals={calculateTotals}
                onPOSuccess={handlePOSuccess}
                activeView={activeView}
              />
            )}
            {activeView === "invoice" && (
              <InvoiceView
                selectedPO={selectedPO}
                vendors={vendors}
                calculateTotals={calculateTotals}
                setActiveView={setActiveView}
                createdPO={createdPO}
                setSelectedPO={setSelectedPO}
                setCreatedPO={setCreatedPO}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PurchaseReturnOrderManagement;
