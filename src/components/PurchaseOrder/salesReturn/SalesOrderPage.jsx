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
import SOForm from "./SOForm";
import TableView from "./TableView";
import GridView from "./GridView";
import InvoiceView from "./InvoiceView";

const SalesReturnOrderManagement = () => {
  const [activeView, setActiveView] = useState("dashboard"); // dashboard, list, create, edit, invoice
  const [viewMode, setViewMode] = useState("table"); // table, grid
  const [selectedSO, setSelectedSO] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [notifications, setNotifications] = useState([]);
  const [selectedSOs, setSelectedSOs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [salesReturnOrders, setSalesReturnOrders] = useState([]);
  console.log(salesReturnOrders)
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [createdSO, setCreatedSO] = useState(null); // Track newly created return order

  // Form state for creating/editing sales return order
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
        qty: "", // Negative for returns
        rate: "",
        taxPercent: "5",
      },
    ],
    terms: "",
    notes: "",
    priority: "Medium",
    reason: "", // Added for return reason
  });

  // Fetch customers, stock items, and transactions on component mount
  useEffect(() => {
    fetchCustomers();
    fetchStockItems();
    fetchTransactions();
  }, []);

  // Refetch transactions when filters change
  useEffect(() => {
    fetchTransactions();
  }, [searchTerm, statusFilter, customerFilter, dateFilter]);

  // Fetch customers from backend
  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/customers/customers");
      console.log("Customers Response:", response.data); // Debug
      setCustomers(response.data.data || []);
    } catch (error) {
      console.error("Fetch Customers Error:", error);
      addNotification(
        "Failed to fetch customers: " +
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
          type: "sales_return",
          search: searchTerm,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          partyId: customerFilter !== "ALL" ? customerFilter : undefined,
          dateFilter: dateFilter !== "ALL" ? dateFilter : undefined,
        },
      });
      console.log("Transactions Response:", response.data); // Debug
      setSalesReturnOrders(
        response.data?.data.map((transaction) => {
          // Find the customer to get the customerName
          const customer = customers.find(
            (c) => c._id === (transaction.partyId._id || transaction.partyId)
          );
          return {
            id: transaction._id,
            transactionNo: transaction.transactionNo,
            customerId: transaction.partyId._id || transaction.partyId,
            customerName: transaction.partyName || "Unknown Customer",
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
            invoiceGenerated: transaction.invoiceGenerated,
            priority: transaction.priority,
            reason: transaction.reason || "",
          };
        })
      );
    } catch (error) {
      console.error("Fetch Transactions Error:", error);
      addNotification(
        "Failed to fetch sales return orders: " +
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
    const sequence = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    setFormData((prev) => ({
      ...prev,
      transactionNo: `SR-${dateStr}-${sequence}`,
    }));
  };

  const addNotification = (message, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // Handle successful sales return order save
  const handleSOSuccess = (newSO) => {
    setCreatedSO(newSO);
    setSelectedSO(newSO);
    setActiveView("invoice");
    addNotification(
      "Sales Return Order saved successfully! Showing invoice...",
      "success"
    );
    // Reset form after navigation
    setTimeout(resetForm, 0);
  };

  // Statistics calculations
  const getStatistics = useMemo(
    () => () => {
      const total = salesReturnOrders.length;
      const draft = salesReturnOrders.filter((so) => so.status === "DRAFT").length;
      const confirmed = salesReturnOrders.filter((so) => so.status === "APPROVED").length;
      const invoiced = salesReturnOrders.filter((so) => so.status === "INVOICED").length;

      const totalValue = salesReturnOrders.reduce(
        (sum, so) => sum + parseFloat(so.totalAmount),
        0
      );
      const invoicedValue = salesReturnOrders
        .filter((so) => so.status === "INVOICED")
        .reduce((sum, so) => sum + parseFloat(so.totalAmount), 0);

      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();
      const thisMonthSOs = salesReturnOrders.filter((so) => {
        const soDate = new Date(so.date);
        return soDate.getMonth() === thisMonth && soDate.getFullYear() === thisYear;
      }).length;

      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
      const lastMonthSOs = salesReturnOrders.filter((so) => {
        const soDate = new Date(so.date);
        return soDate.getMonth() === lastMonth && soDate.getFullYear() === lastMonthYear;
      }).length;

      const growthRate =
        lastMonthSOs === 0 ? 0 : ((thisMonthSOs - lastMonthSOs) / lastMonthSOs) * 100;

      return {
        total,
        draft,
        confirmed,
        invoiced,
        totalValue,
        invoicedValue,
        thisMonthSOs,
        growthRate,
      };
    },
    [salesReturnOrders]
  );

  const statistics = getStatistics();

  // Filtering and sorting logic
  const filteredAndSortedSOs = useMemo(
    () => () => {
      let filtered = salesReturnOrders.filter((so) => {
        const matchesSearch =
          so.transactionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (so.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
          so.createdBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
          so.reason.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === "ALL" || so.status === statusFilter;
        const matchesCustomer = customerFilter === "ALL" || so.customerId === customerFilter;

        let matchesDate = true;
        if (dateFilter !== "ALL") {
          const soDate = new Date(so.date);
          const today = new Date();

          switch (dateFilter) {
            case "TODAY":
              matchesDate = soDate.toDateString() === today.toDateString();
              break;
            case "WEEK":
              const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
              matchesDate = soDate >= weekAgo;
              break;
            case "MONTH":
              const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
              matchesDate = soDate >= monthAgo;
              break;
          }
        }

        return matchesSearch && matchesStatus && matchesCustomer && matchesDate;
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
          case "customer":
            aVal = a.customerName || "";
            bVal = b.customerName || "";
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
    [salesReturnOrders, searchTerm, statusFilter, customerFilter, dateFilter, sortBy, sortOrder]
  );

  const filteredSOs = filteredAndSortedSOs();
  const totalPages = Math.ceil(filteredSOs.length / itemsPerPage);
  const paginatedSOs = filteredSOs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status) => {
    switch (status) {
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "CONFIRMED":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "INVOICED":
        return "bg-purple-100 text-purple-700 border-purple-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "DRAFT":
        return <Edit3 className="w-3 h-3" />;
      case "CONFIRMED":
        return <CheckSquare className="w-3 h-3" />;
      case "INVOICED":
        return <Receipt className="w-3 h-3" />;
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
    if (selectedSOs.length === 0) {
      addNotification("Please select return orders to perform bulk actions", "warning");
      return;
    }

    try {
      if (action === "confirm") {
        for (const soId of selectedSOs) {
          await axiosInstance.patch(`/transactions/transactions/${soId}/process`, {
            action: "approve",
          });
        }
        addNotification(
          `${selectedSOs.length} return orders confirmed successfully`,
          "success"
        );
        fetchTransactions();
      } else if (action === "delete") {
        if (window.confirm(`Delete ${selectedSOs.length} selected return orders?`)) {
          for (const soId of selectedSOs) {
              await axiosInstance.patch(`/transactions/transactions/${soId}/process`, {
            action: "reject",
          });
          }
          addNotification(`${selectedSOs.length} return orders deleted`, "success");
          fetchTransactions();
        }
      } else if (action === "export") {
        addNotification(`Exporting ${selectedSOs.length} return orders...`, "info");
        const csv = [
          "TransactionNo,Customer,Date,DeliveryDate,Status,TotalAmount,Priority,Reason",
          ...selectedSOs.map((soId) => {
            const so = salesReturnOrders.find((s) => s.id === soId);
            return `${so.transactionNo},${so.customerName || "Unknown"},${so.date},${so.deliveryDate},${so.status},${so.totalAmount},${so.priority},${so.reason}`;
          }),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "selected_sales_return_orders.csv";
        link.click();
        addNotification("Return orders exported successfully", "success");
      }
      setSelectedSOs([]);
    } catch (error) {
      console.error("Bulk Action Error:", error);
      addNotification(
        "Bulk action failed: " + (error.response?.data?.message || error.message),
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
            {notification.type === "success" && <CheckCircle className="w-4 h-4" />}
            {notification.type === "warning" && <AlertCircle className="w-4 h-4" />}
            {notification.type === "error" && <AlertCircle className="w-4 h-4" />}
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
              <p className="text-sm font-medium text-slate-600">Total Return Orders</p>
              <p className="text-3xl font-bold text-slate-900">{statistics.total}</p>
              <div className="flex items-center mt-2">
                {statistics.growthRate >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-500 mr-1" />
                )}
                <span
                  className={`text-sm font-medium ${
                    statistics.growthRate >= 0 ? "text-emerald-600" : "text-rose-600"
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
              <p className="text-sm font-medium text-slate-600">Confirmed</p>
              <p className="text-3xl font-bold text-blue-600">{statistics.confirmed}</p>
              <p className="text-sm text-slate-500 mt-2">Ready for processing</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Refund Value</p>
              <p className="text-3xl font-bold text-emerald-600">
                AED {Math.abs(statistics.totalValue).toLocaleString()}
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Invoiced: AED {Math.abs(statistics.invoicedValue).toLocaleString()}
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
              <p className="text-3xl font-bold text-indigo-600">{statistics.thisMonthSOs}</p>
              <p className="text-sm text-slate-500 mt-2">New return orders created</p>
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
            Recent Sales Return Orders
          </h3>
          <div className="space-y-3">
            {salesReturnOrders.slice(0, 5).map((so) => (
              <div
                key={so.id}
                className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${getPriorityColor(so.priority)}`}
                  ></div>
                  <div>
                    <p className="font-medium text-slate-900">{so.transactionNo}</p>
                    <p className="text-sm text-slate-600">{so.customerName || "Unknown"}</p>
                    <p className="text-xs text-slate-500">{so.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      so.status
                    )}`}
                  >
                    {getStatusIcon(so.status)}
                    <span className="ml-1">{so.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    AED {Math.abs(parseFloat(so.totalAmount)).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setActiveView("list")}
            className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            View All Return Orders →
          </button>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Status Overview</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Confirmed</span>
                <span className="text-xs font-medium text-blue-600">{statistics.confirmed}</span>
              </div>
              <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500 ease-out"
                  style={{
                    width: `${(statistics.confirmed / statistics.total) * 100 || 0}%`,
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Invoiced</span>
                <span className="text-xs font-medium text-purple-600">{statistics.invoiced}</span>
              </div>
              <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-500 ease-out"
                  style={{
                    width: `${(statistics.invoiced / statistics.total) * 100 || 0}%`,
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Draft</span>
                <span className="text-xs font-medium text-slate-600">{statistics.draft}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-400 transition-all duration-500 ease-out"
                  style={{
                    width: `${(statistics.draft / statistics.total) * 100 || 0}%`,
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
    const endItem = Math.min(currentPage * itemsPerPage, filteredSOs.length);

    return (
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-slate-600">
            Showing {startItem} to {endItem} of {filteredSOs.length} return orders
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
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
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
      reason: "",
    });
    setFormErrors({});
  }, []);

  // Calculate totals for items (handles negative quantities for returns)
  const calculateTotals = (items) => {
    let subtotal = 0;
    let tax = 0;

    items.forEach((item) => {
      const qty = parseFloat(item.qty) || 0;
      const rate = parseFloat(item.rate) || 0;
      const taxPercent = parseFloat(item.taxPercent) || 0;

      const lineSubtotal =  rate;
      const lineTax = lineSubtotal * (taxPercent / 100);

      subtotal += lineSubtotal;
      tax += lineTax;
    });

    const total = (subtotal + tax).toFixed(2);
    subtotal = subtotal.toFixed(2);
    tax = tax.toFixed(2);

    return { subtotal, tax, total };
  };

  // Edit sales return order
  const editSO = (so) => {
    setFormData({
      transactionNo: so.transactionNo,
      partyId: so.customerId,
      date: new Date(so.date).toISOString().slice(0, 10),
      deliveryDate: so.deliveryDate
        ? new Date(so.deliveryDate).toISOString().slice(0, 10)
        : "",
      status: so.status,
      items: so.items.map((item) => ({
        itemId: item.itemId,
        description: item.description,
        qty: item.qty.toString(),
        rate: item.rate.toString(),
        taxPercent: item.taxPercent.toString(),
      })),
      terms: so.terms || "",
      notes: so.notes || "",
      priority: so.priority || "Medium",
      reason: so.reason || "",
    });
    setSelectedSO(so);
    setActiveView("edit");
  };

  // Confirm sales return order
  const confirmSO = async (id) => {
    try {
      await axiosInstance.patch(`/transactions/transactions/${id}/process`, {
        action: "confirm",
      });
      addNotification("Sales Return Order confirmed successfully", "success");
      fetchTransactions();
    } catch (error) {
      console.error("Confirm SO Error:", error);
      addNotification(
        "Failed to confirm sales return order: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    }
  };

  // Delete sales return order
  const deleteSO = async (id) => {
    if (window.confirm("Are you sure you want to delete this sales return order?")) {
      try {
        await axiosInstance.delete(`/transactions/transactions/${id}`);
        addNotification("Sales Return Order deleted successfully", "success");
        fetchTransactions();
      } catch (error) {
        console.error("Delete SO Error:", error);
        addNotification(
          "Failed to delete sales return order: " +
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
                  Sales Return Order Management
                </h1>
                <p className="text-slate-600 mt-1">
                  Manage your sales return orders efficiently
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  resetForm();
                  setSelectedSO(null);
                  setActiveView("create");
                  generateTransactionNumber();
                }}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
              >
                <Plus className="w-5 h-5" />
                <span>Create New Return Order</span>
              </button>
              <button
                onClick={() => {
                  fetchCustomers();
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
                    placeholder="Search by SR number, customer, user, or reason..."
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
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="INVOICED">Invoiced</option>
                </select>

                <select
                  value={customerFilter}
                  onChange={(e) => {
                    setCustomerFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="ALL">All Customers</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.customerName}
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
                {selectedSOs.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleBulkAction("confirm")}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Confirm Selected</span>
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
                    paginatedSOs={paginatedSOs}
                    selectedSOs={selectedSOs}
                    setSelectedSOs={setSelectedSOs}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                    getStatusIcon={getStatusIcon}
                    handleSort={handleSort}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    setSelectedSO={setSelectedSO}
                    setActiveView={setActiveView}
                    editSO={editSO}
                    confirmSO={confirmSO}
                    deleteSO={deleteSO}
                  />
                ) : (
                  <GridView
                    paginatedSOs={paginatedSOs}
                    selectedSOs={selectedSOs}
                    setSelectedSOs={setSelectedSOs}
                    getPriorityColor={getPriorityColor}
                    getStatusColor={getStatusColor}
                    getStatusIcon={getStatusIcon}
                    setSelectedSO={setSelectedSO}
                    setActiveView={setActiveView}
                    editSO={editSO}
                    confirmSO={confirmSO}
                    deleteSO={deleteSO}
                  />
                )}
                {filteredSOs.length > 0 && <Pagination />}
              </>
            )}
            {(activeView === "create" || activeView === "edit") && (
              <SOForm
                formData={formData}
                setFormData={setFormData}
                customers={customers}
                stockItems={stockItems}
                addNotification={addNotification}
                selectedSO={selectedSO}
                setSelectedSO={setSelectedSO}
                setActiveView={setActiveView}
                setSalesReturnOrders={setSalesReturnOrders}
                resetForm={resetForm}
                calculateTotals={calculateTotals}
                onSOSuccess={handleSOSuccess}
                activeView={activeView}
                formErrors={formErrors}
                setFormErrors={setFormErrors}
              />
            )}
            {activeView === "invoice" && (
              <InvoiceView
                selectedSO={selectedSO}
                customers={customers}
                calculateTotals={calculateTotals}
                setActiveView={setActiveView}
                createdSO={createdSO}
                setSelectedSO={setSelectedSO}
                setCreatedSO={setCreatedSO}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SalesReturnOrderManagement;