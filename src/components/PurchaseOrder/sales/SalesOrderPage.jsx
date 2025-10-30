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
import axiosInstance from "../../../axios/axios";
import SOForm from "./SOForm";
import TableView from "./TableView";
import GridView from "./GridView";
import SaleInvoiceView from "./InvoiceView";

const SalesOrderManagement = () => {
  const [activeView, setActiveView] = useState("dashboard");
  const [viewMode, setViewMode] = useState("table");
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
  const [salesOrders, setSalesOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [createdSO, setCreatedSO] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    transactionNo: "",
    partyId: "",
    partyName: "",
    date: new Date().toISOString().slice(0, 10),
    deliveryDate: "",
    status: "DRAFT",
    priority: "Medium",
    terms: "",
    notes: "",
    items: [
      {
        _id: "",
        itemId: "",
        description: "",
        itemName: "",
        qty: "",
        rate: "0.00",
        salesPrice: "0.00",
        vatPercent: "5",
        vatAmount: "0.00",
        lineTotal: "0.00",
        package: "1",
        category: "",
        unitOfMeasure: "",
        unitOfMeasureDetails: {},
        stockDetails: {},
      },
    ],
  });

  // Fetch data on mount
  useEffect(() => {
    fetchCustomers();
    fetchStockItems();
    fetchTransactions();
  }, []);

  // Refetch on filter change
  useEffect(() => {
    fetchTransactions();
  }, [searchTerm, statusFilter, customerFilter, dateFilter]);

  // Generate SO number on create
  useEffect(() => {
    if (activeView === "create") {
      generateTransactionNumber();
    }
  }, [activeView]);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/customers/customers");
      setCustomers(response.data.data || []);
    } catch (error) {
      addNotification(
        "Failed to fetch customers: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStockItems = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/stock/stock");
      const stocks = response.data.data?.stocks || response.data.data || [];
      setStockItems(
        stocks.map((item) => ({
          _id: item._id,
          itemId: item.itemId,
          itemName: item.itemName,
          sku: item.sku,
          category: item.category,
          unitOfMeasure: item.unitOfMeasure,
          unitOfMeasureDetails: item.unitOfMeasureDetails || {},
          currentStock: item.currentStock,
          purchasePrice: item.purchasePrice,
          salesPrice: item.salesPrice,
          reorderLevel: item.reorderLevel,
          status: item.status,
          taxPercent: item.taxPercent || 5,
        }))
      );
    } catch (error) {
      addNotification(
        "Failed to fetch stock items: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get("/transactions/transactions", {
        params: {
          type: "sales_order",
          search: searchTerm,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          partyId: customerFilter !== "ALL" ? customerFilter : undefined,
          dateFilter: dateFilter !== "ALL" ? dateFilter : undefined,
        },
      });

      const transactions = response.data?.data || [];
      setSalesOrders(
        transactions.map((t) => ({
          id: t._id,
          transactionNo: t.transactionNo,
          customerId: t.partyId,
          customerName: t.party?.customerName || t.partyName,
          date: t.date,
          deliveryDate: t.deliveryDate,
          status: t.status,
          totalAmount: parseFloat(t.totalAmount).toFixed(2),
          items: t.items,
          terms: t.terms || "",
          notes: t.notes || "",
          createdBy: t.createdBy,
          createdAt: t.createdAt,
          invoiceGenerated: t.invoiceGenerated,
          priority: t.priority || "Medium",
        }))
      );
    } catch (error) {
      addNotification(
        "Failed to fetch transactions: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const generateTransactionNumber = () => {
    const sequence = String(Math.floor(Math.random() * 999) + 1).padStart(
      3,
      "0"
    );
    setFormData((prev) => ({ ...prev, transactionNo: `SO${sequence}` }));
  };

  const addNotification = (message, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
      5000
    );
  };

  const handleSOSuccess = (newSO) => {
    setCreatedSO(newSO);
    setSelectedSO(newSO);
    setActiveView("invoice");
    addNotification(
      "Sales Order saved successfully! Showing invoice...",
      "success"
    );
    setTimeout(resetForm, 0);
  };

  const getStockItemById = useCallback(
    (itemId) => stockItems.find((s) => s._id === itemId),
    [stockItems]
  );

  // EDIT SO – FULLY WORKING
  const editSO = (so) => {
    const formItems = so.items.map((it) => {
      const stock = getStockItemById(it.itemId) || {};

      return {
        _id: it._id || "",
        itemId: it.itemId,
        description: it.description,
        itemName: stock.itemName || it.description,
        qty: it.qty.toString(),
        rate: it.rate  ,
        salesPrice: (stock.salesPrice || 0).toString(),
        purchasePrice:(stock.purchasePrice || 0).toString(),
        vatPercent: (it.vatPercent || 5).toString(),
        vatAmount: (it.vatAmount || 0).toString(),
        lineTotal: (it.lineTotal || 0).toString(),
        package: (it.package || 1).toString(),
        category: stock.category || "",
        unitOfMeasure: stock.unitOfMeasure || "",
        unitOfMeasureDetails: stock.unitOfMeasureDetails || {},
        stockDetails: it.stockDetails || {},
      };
    });

    setFormData({
      transactionNo: so.transactionNo,
      partyId: so.customerId,
      partyName: so.customerName,
      date: new Date(so.date).toISOString().slice(0, 10),
      deliveryDate: so.deliveryDate
        ? new Date(so.deliveryDate).toISOString().slice(0, 10)
        : "",
      status: so.status,
      priority: so.priority || "Medium",
      terms: so.terms || "",
      notes: so.notes || "",
      items: formItems,
    });

    setSelectedSO(so);
    setActiveView("edit");
  };

  // CALCULATE TOTALS – MATCHES BACKEND
  const calculateTotals = (items) => {
    let subtotal = 0;
    let tax = 0;

    const validItems = items.filter(
      (i) => i.itemId && parseFloat(i.qty) > 0 && parseFloat(i.rate) > 0
    );

    validItems.forEach((i) => {
      const qty = parseFloat(i.qty) || 0;
      const price = parseFloat(i.rate) || 0;
      const vatPct = parseFloat(i.vatPercent) || 0;

      const lineSub = qty * price;
      const lineVat = lineSub * (vatPct / 100);
      const lineTot = lineSub + lineVat;

      subtotal += lineSub;
      tax += lineVat;

      i.lineTotal = lineTot.toFixed(2);
      i.vatAmount = lineVat.toFixed(2);
    });

    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: (subtotal + tax).toFixed(2),
      validItems,
    };
  };

  // STATISTICS
  const getStatistics = useMemo(
    () => () => {
      const total = salesOrders.length;
      const draft = salesOrders.filter((so) => so.status === "DRAFT").length;
      const confirmed = salesOrders.filter(
        (so) => so.status === "APPROVED"
      ).length;
      const invoiced = salesOrders.filter(
        (so) => so.status === "INVOICED"
      ).length;

      const totalValue = salesOrders.reduce(
        (sum, so) => sum + parseFloat(so.totalAmount),
        0
      );
      const invoicedValue = salesOrders
        .filter((so) => so.status === "INVOICED")
        .reduce((sum, so) => sum + parseFloat(so.totalAmount), 0);

      const thisMonth = new Date().getMonth();
      const thisYear = new Date().getFullYear();
      const thisMonthSOs = salesOrders.filter((so) => {
        const soDate = new Date(so.date);
        return (
          soDate.getMonth() === thisMonth && soDate.getFullYear() === thisYear
        );
      }).length;

      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
      const lastMonthSOs = salesOrders.filter((so) => {
        const soDate = new Date(so.date);
        return (
          soDate.getMonth() === lastMonth &&
          soDate.getFullYear() === lastMonthYear
        );
      }).length;

      const growthRate =
        lastMonthSOs === 0
          ? 0
          : ((thisMonthSOs - lastMonthSOs) / lastMonthSOs) * 100;

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
    [salesOrders]
  );

  const statistics = getStatistics();

  // FILTERING & SORTING
  const filteredAndSortedSOs = useMemo(
    () => () => {
      let filtered = salesOrders.filter((so) => {
        const matchesSearch =
          so.transactionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          so.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          so.createdBy?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus =
          statusFilter === "ALL" || so.status === statusFilter;
        const matchesCustomer =
          customerFilter === "ALL" || so.customerId === customerFilter;

        let matchesDate = true;
        if (dateFilter !== "ALL") {
          const soDate = new Date(so.date);
          const today = new Date();
          switch (dateFilter) {
            case "TODAY":
              matchesDate = soDate.toDateString() === today.toDateString();
              break;
            case "WEEK":
              const weekAgo = new Date(
                today.getTime() - 7 * 24 * 60 * 60 * 1000
              );
              matchesDate = soDate >= weekAgo;
              break;
            case "MONTH":
              const monthAgo = new Date(
                today.getFullYear(),
                today.getMonth() - 1,
                today.getDate()
              );
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
            aVal = a.customerName;
            bVal = b.customerName;
            break;
          case "status":
            aVal = a.status;
            bVal = b.status;
            break;
          default:
            aVal = a.transactionNo;
            bVal = b.transactionNo;
        }
        return sortOrder === "asc"
          ? aVal < bVal
            ? -1
            : 1
          : aVal > bVal
          ? -1
          : 1;
      });

      return filtered;
    },
    [
      salesOrders,
      searchTerm,
      statusFilter,
      customerFilter,
      dateFilter,
      sortBy,
      sortOrder,
    ]
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
      case "APPROVED":
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
      case "APPROVED":
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

  // BULK ACTIONS – FIXED
  const handleBulkAction = async (action) => {
    if (selectedSOs.length === 0) {
      addNotification(
        "Please select orders to perform bulk actions",
        "warning"
      );
      return;
    }

    try {
      if (action === "confirm") {
        for (const soId of selectedSOs) {
          await axiosInstance.patch(
            `/transactions/transactions/${soId}/process`,
            { action: "approve" }
          );
        }
        addNotification(
          `${selectedSOs.length} orders approved successfully`,
          "success"
        );
      } else if (action === "delete") {
        if (window.confirm(`Delete ${selectedSOs.length} selected orders?`)) {
          for (const soId of selectedSOs) {
            await axiosInstance.patch(
              `/transactions/transactions/${soId}/process`,
              { action: "reject" }
            );
          }
          addNotification(`${selectedSOs.length} orders deleted`, "success");
        }
      } else if (action === "export") {
        const csv = [
          "TransactionNo,Customer,Date,DeliveryDate,Status,TotalAmount,Priority",
          ...selectedSOs.map((soId) => {
            const so = salesOrders.find((s) => s.id === soId);
            return `${so.transactionNo},${so.customerName},${so.date},${so.deliveryDate},${so.status},${so.totalAmount},${so.priority}`;
          }),
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "selected_sales_orders.csv";
        link.click();
        addNotification("Orders exported successfully", "success");
      }
      setSelectedSOs([]);
      fetchTransactions();
    } catch (error) {
      addNotification(
        "Bulk action failed: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    }
  };

  const resetForm = useCallback(() => {
    setFormData({
      transactionNo: "",
      partyId: "",
      partyName: "",
      date: new Date().toISOString().slice(0, 10),
      deliveryDate: "",
      status: "DRAFT",
      priority: "Medium",
      terms: "",
      notes: "",
      items: [
        {
          _id: "",
          itemId: "",
          description: "",
          itemName: "",
          qty: "",
          rate: "0.00",
          salesPrice: "0.00",
          vatPercent: "5",
          vatAmount: "0.00",
          lineTotal: "0.00",
          package: "1",
          category: "",
          unitOfMeasure: "",
          unitOfMeasureDetails: {},
          stockDetails: {},
        },
      ],
    });
    setFormErrors({});
  }, []);

  const confirmSO = async (id) => {
    try {
      await axiosInstance.patch(`/transactions/transactions/${id}/process`, {
        action: "approve",
      });
      addNotification("Sales Order approved successfully", "success");
      fetchTransactions();
    } catch (error) {
      addNotification(
        "Failed to approve: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    }
  };

  const deleteSO = async (id) => {
    if (window.confirm("Delete this sales order?")) {
      try {
        await axiosInstance.patch(`/transactions/transactions/${id}/process`, {
          action: "reject",
        });
        addNotification("Sales Order deleted", "success");
        fetchTransactions();
      } catch (error) {
        addNotification(
          "Failed to delete: " +
            (error.response?.data?.message || error.message),
          "error"
        );
      }
    }
  };

  // COMPONENTS
  const NotificationList = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`px-4 py-3 rounded-lg shadow-lg max-w-sm backdrop-blur-sm ${
            n.type === "success"
              ? "bg-emerald-500/90 text-white"
              : n.type === "warning"
              ? "bg-amber-500/90 text-white"
              : n.type === "error"
              ? "bg-rose-500/90 text-white"
              : "bg-blue-500/90 text-white"
          } animate-slide-in border border-white/20`}
        >
          <div className="flex items-center space-x-2">
            {n.type === "success" && <CheckCircle className="w-4 h-4" />}
            {n.type === "warning" && <AlertCircle className="w-4 h-4" />}
            {n.type === "error" && <AlertCircle className="w-4 h-4" />}
            <span className="text-sm font-medium">{n.message}</span>
          </div>
        </div>
      ))}
    </div>
  );

  const Dashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Orders</p>
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
              <p className="text-sm font-medium text-slate-600">Approved</p>
              <p className="text-3xl font-bold text-blue-600">
                {statistics.confirmed}
              </p>
              <p className="text-sm text-slate-500 mt-2">Ready for dispatch</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-white" />
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
                Invoiced: AED {statistics.invoicedValue.toLocaleString()}
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
                {statistics.thisMonthSOs}
              </p>
              <p className="text-sm text-slate-500 mt-2">New orders created</p>
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
            Recent Sales Orders
          </h3>
          <div className="space-y-3">
            {salesOrders.slice(0, 5).map((so) => (
              <div
                key={so.id}
                className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${getPriorityColor(
                      so.priority
                    )}`}
                  ></div>
                  <div>
                    <p className="font-medium text-slate-900">
                      {so.transactionNo}
                    </p>
                    <p className="text-sm text-slate-600">{so.customerName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      so.status
                    )}`}
                  >
                    {getStatusIcon(so.status)}
                    <span className="ml-1">{so.status}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    AED {parseFloat(so.totalAmount).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setActiveView("list")}
            className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            View All Orders
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
                <span className="text-xs font-medium text-blue-600">
                  {statistics.confirmed}
                </span>
              </div>
              <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-500 ease-out"
                  style={{
                    width: `${
                      (statistics.confirmed / statistics.total) * 100 || 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Invoiced</span>
                <span className="text-xs font-medium text-purple-600">
                  {statistics.invoiced}
                </span>
              </div>
              <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-500 ease-out"
                  style={{
                    width: `${
                      (statistics.invoiced / statistics.total) * 100 || 0
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
          </div>
        </div>
      </div>
    </div>
  );

  const Pagination = () => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredSOs.length);

    return (
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-slate-600">
            Showing {startItem} to {endItem} of {filteredSOs.length} orders
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
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Previous
          </button>
          <div className="flex space-x-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNum =
                totalPages <= 5
                  ? i + 1
                  : currentPage <= 3
                  ? i + 1
                  : currentPage >= totalPages - 2
                  ? totalPages - 4 + i
                  : currentPage - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-2 text-sm rounded-lg ${
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
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    );
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
                  Sales Order Management
                </h1>
                <p className="text-slate-600 mt-1">
                  Manage your sales orders efficiently
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
                <span>Create New SO</span>
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
                    placeholder="Search by SO number, customer, or user..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-80 pl-10 pr-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="APPROVED">Approved</option>
                  <option value="INVOICED">Invoiced</option>
                </select>
                <select
                  value={customerFilter}
                  onChange={(e) => {
                    setCustomerFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ALL">All Customers</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.customerName}
                    </option>
                  ))}
                </select>
                <select
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  className={`p-3 rounded-xl ${
                    activeView === "dashboard"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-3 rounded-xl ${
                    viewMode === "table"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-3 rounded-xl ${
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
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleBulkAction("delete")}
                      className="flex items-center space-x-2 px-4 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                    <button
                      onClick={() => handleBulkAction("export")}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export</span>
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
                setSalesOrders={setSalesOrders}
                resetForm={resetForm}
                calculateTotals={calculateTotals}
                onSOSuccess={handleSOSuccess}
                activeView={activeView}
                formErrors={formErrors}
                setFormErrors={setFormErrors}
              />
            )}
            {activeView === "invoice" && (
              <SaleInvoiceView
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

export default SalesOrderManagement;
