import React, { useCallback, useMemo, useState, useEffect } from "react";
import { processTransaction } from "../../../lib/processTransaction";
import { VARIANTS } from "../../OrderEntry/variants";
import { StatCard } from "../../ui/stat-card";
import { loadFormForEdit } from "../../OrderEntry/editForm";
import {
  ShoppingCart,
  Building,
  User,
  Calendar,
  Hash,
  Package,
  Banknote,
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
import { decimalRound, downloadCSV, formatDateGB, formatNumber, todayInput } from "../../../utils/format";
import { purchaseReturnTotals } from "../../OrderEntry/lineMath";
import { priorityDotClass, statusClasses, toastClasses } from "../../../lib/status";

import { useDeleteConfirm } from "../shared/useDeleteConfirm";
import DocumentAuditTrail from "../../audit/AuditTrail";
import { WIDE, useMediaQuery } from "../../accounting/DataTable";
const PurchaseReturnOrderManagement = () => {
  const [activeView, setActiveView] = useState("dashboard"); // dashboard, list, create, edit, invoice
  // The table is the right list for a pointer and the cards for a thumb, so the default
  // follows the screen. Choosing a view by hand still wins, and holds until a reload.
  const wide = useMediaQuery(WIDE);
  const [viewMode, setViewMode] = useState(() => (wide ? "table" : "grid"));
  const [selectedPO, setSelectedPO] = useState(null);
  // The document whose audit trail is open, or null.
  const [auditPO, setAuditPO] = useState(null);
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
  const [, setFormErrors] = useState({});
  const [createdPO, setCreatedPO] = useState(null); // Track newly created PO

  // Form state for creating/editing PO
  const [formData, setFormData] = useState({
    transactionNo: "",
    partyId: "",
    date: todayInput(),
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
          vendorId: transaction.partyId._id || transaction.partyId, // Ensure vendorId is a string
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
    // The number is assigned by the server's numbering series when the document is saved.
    setFormData((prev) => ({ ...prev, transactionNo: "" }));
  };

  const addNotification = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // Handle successful PO save
  const handlePOSuccess = (newPO) => {
    setCreatedPO(newPO);
    setSelectedPO(newPO);
    setActiveView("invoice");
    addNotification(
      "Purchase Return Order saved successfully! Showing invoice...",
      "success"
    );
    setTimeout(resetForm, 0); // Delay to ensure state updates
  };

  // Statistics calculations
  const getStatistics = useMemo(
    () => () => {
      const total = purchaseOrders.length;
      const pending = purchaseOrders.filter((po) => po.status === "PENDING").length;
      const approved = purchaseOrders.filter((po) => po.status === "APPROVED").length;
      const draft = purchaseOrders.filter((po) => po.status === "DRAFT").length;
      const rejected = purchaseOrders.filter((po) => po.status === "REJECTED").length;

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
        return poDate.getMonth() === thisMonth && poDate.getFullYear() === thisYear;
      }).length;

      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
      const lastMonthPOs = purchaseOrders.filter((po) => {
        const poDate = new Date(po.date);
        return poDate.getMonth() === lastMonth && poDate.getFullYear() === lastMonthYear;
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

        const matchesStatus = statusFilter === "ALL" || po.status === statusFilter;
        const matchesVendor = vendorFilter === "ALL" || po.vendorId === vendorFilter;

        let matchesDate = true;
        if (dateFilter !== "ALL") {
          const poDate = new Date(po.date);
          const today = new Date();

          switch (dateFilter) {
            case "TODAY":
              matchesDate = poDate.toDateString() === today.toDateString();
              break;
            case "WEEK": {
              const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
              matchesDate = poDate >= weekAgo;
              break;
            }
            case "MONTH": {
              const monthAgo = new Date(
                today.getFullYear(),
                today.getMonth() - 1,
                today.getDate()
              );
              matchesDate = poDate >= monthAgo;
              break;
            }
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
    [purchaseOrders, searchTerm, statusFilter, vendorFilter, dateFilter, sortBy, sortOrder]
  );

  const filteredPOs = filteredAndSortedPOs();
  const totalPages = Math.ceil(filteredPOs.length / itemsPerPage);
  const paginatedPOs = filteredPOs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusColor = (status) => statusClasses(status);

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

  const getPriorityColor = (priority) => priorityDotClass(priority);

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
      addNotification("Please select orders to perform bulk actions", "warning");
      return;
    }

    try {
      if (action === "approve") {
        for (const poId of selectedPOs) {
          await processTransaction(poId, "approve");
        }
        addNotification(`${selectedPOs.length} orders approved successfully`, "success");
        fetchTransactions();
      } else if (action === "delete") {
        askDelete({
          title: `Delete ${selectedPOs.length} purchase returns?`,
          text: "Each return is removed. An approved return is reversed in stock and in the ledger first. The deletion is written to the activity log.",
          onConfirm: async () => {
            try {
              for (const poId of selectedPOs) {
                await axiosInstance.delete(`/transactions/transactions/${poId}`);
              }
              addNotification(`${selectedPOs.length} orders deleted`, "success");
            } catch (error) {
              addNotification("Failed to delete: " + (error.response?.data?.message || error.message), "error");
            }
            fetchTransactions();
          },
        });
      } else if (action === "export") {
        addNotification(`Exporting ${selectedPOs.length} orders...`, "info");
        const csvHeaders = ["TransactionNo", "Vendor", "Date", "DeliveryDate", "Status", "TotalAmount", "Priority"];
        const csvRows = selectedPOs
          .map((poId) => purchaseOrders.find((p) => p.id === poId))
          .filter(Boolean)
          .map((po) => [
            po.displayTransactionNo || po.transactionNo || "",
            po.vendorName || "Unknown",
            formatDateGB(po.date),
            formatDateGB(po.deliveryDate),
            po.status,
            decimalRound(po.totalAmount),
            po.priority,
          ]);
        downloadCSV("selected_purchase_return_orders.csv", csvHeaders, csvRows);
        addNotification("Orders exported successfully", "success");
      }
      setSelectedPOs([]);
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
    <div className="fixed end-4 bottom-4 z-[70] space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`max-w-sm ${toastClasses(notification.type)}`}
        >
          <div className="flex flex-wrap items-center gap-2">
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
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <StatCard
          title="Total Returns"
          count={statistics.total}
          tone="teal"
          icon={<ShoppingCart />}
          subText="Against last month"
          trend={`${statistics.growthRate >= 0 ? "+" : "−"}${Math.abs(statistics.growthRate).toFixed(1)}%`}
        />
        <StatCard
          title="Pending"
          count={statistics.pending}
          tone="plum"
          icon={<Clock />}
          subText="Waiting for approval"
        />
        <StatCard
          title="Total Value"
          count={`AED ${formatNumber(statistics.totalValue)}`}
          tone="olive"
          icon={<Banknote />}
          subText={`Approved AED ${formatNumber(statistics.approvedValue)}`}
        />
        <StatCard
          title="This Month"
          count={statistics.thisMonthPOs}
          tone="rose"
          icon={<BarChart3 />}
          subText="New purchase returns created"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card shadow-card lg:col-span-2">
          <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">Recent purchase returns</h3>
            <span className="text-xs text-muted-foreground">{purchaseOrders.length} in total</span>
          </header>
          <div className="px-5">
            {purchaseOrders.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No purchase returns yet. Create one to see it here.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {purchaseOrders.slice(0, 5).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${getPriorityColor(row.priority)}`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {row.displayTransactionNo || row.transactionNo}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{row.vendorName}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        AED {formatNumber(row.totalAmount)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusColor(
                          row.status
                        )}`}
                      >
                        {getStatusIcon(row.status)}
                        <span className="ms-1">{row.status}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {purchaseOrders.length > 0 && (
            <footer className="border-t border-border px-5 py-3">
              <button
                type="button"
                onClick={() => setActiveView("list")}
                className="text-sm font-medium text-foreground hover:opacity-80"
              >
                View all purchase returns →
              </button>
            </footer>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-card">
          <header className="border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">Status overview</h3>
          </header>
          <div className="space-y-4 px-5 py-4">
            {[
              { label: "Draft", value: statistics.draft },
              { label: "Approved", value: statistics.approved },
            ].map((row) => {
              const value = Number(row.value) || 0;
              const share = statistics.total ? (value / statistics.total) * 100 : 0;
              return (
                <div key={row.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="text-sm text-foreground">{row.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {value} · {share.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {statistics.total === 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                Nothing to show until the first purchase return is created.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  const Pagination = () => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredPOs.length);

    return (
      <div className="flex items-center justify-between bg-card rounded-xl px-6 py-4 border border-border shadow-card">
        <div className="grid w-full grid-cols-2 gap-2 [&>*]:min-w-0 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-4">
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

        <div className="flex flex-wrap items-center gap-2">
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
      date: todayInput(),
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
  }, []);

  // Calculate totals for items
  // Purchase-return rows carry qty, currentPurchasePrice and vatPercent (see POForm's addItem).
  // This used to sum item.rate and item.taxPercent, which those rows never have, so every
  // purchase return saved totalAmount 0. It now uses the same helper as the form, so the
  // posted total always agrees with the line totals the user sees.
  const calculateTotals = (items) => purchaseReturnTotals(items);

  // Edit PO
  const editPO = async (po) => {
    try {
      // The full saved document, not the trimmed list copy: nothing on it may be lost on save.
      setFormData(await loadFormForEdit(VARIANTS.purchaseReturn, po.id));
      setSelectedPO(po);
      setActiveView("edit");
    } catch (err) {
      addNotification(
        "Could not open the purchase return: " + (err.response?.data?.message || err.message),
        "error"
      );
    }
  };

  // Approve PO
  const approvePO = async (id) => {
    try {
      await processTransaction(id, "approve");
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
      await processTransaction(id, "reject");
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

  const [askDelete, deleteDialog] = useDeleteConfirm();

  // Delete PO
  const deletePO = (id) => {
    askDelete({
      title: "Delete this purchase return?",
      text: "The return is removed. An approved return is reversed in stock and in the ledger first. The deletion is written to the activity log.",
      onConfirm: async () => {
        try {
          await axiosInstance.delete(`/transactions/transactions/${id}`);
          addNotification("Purchase Return Order deleted successfully", "success");
          fetchTransactions();
        } catch (error) {
          console.error("Delete PO Error:", error);
          addNotification("Failed to delete purchase return order: " + (error.response?.data?.message || error.message), "error");
        }
      },
    });
  };

  return (
    <div className="">
      {deleteDialog}
      <NotificationList />
      <div className="relative bg-card border-b border-border">
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid w-full grid-cols-2 gap-2 [&>*]:min-w-0 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-4">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Purchase returns
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Goods sent back to your vendors, against an approved purchase.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 [&>button:first-child]:flex-1 sm:[&>button:first-child]:flex-none">
              <button
                onClick={() => {
                  resetForm();
                  setSelectedPO(null);
                  setActiveView("create");
                  generateTransactionNumber();
                }}
                className="erp-btn-primary"
              >
                <Plus className="w-5 h-5" />
                <span>New purchase return</span>
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
          <div className="px-4 py-3 sm:px-6 sm:py-4 lg:px-8 bg-secondary/60 border-t border-border">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="grid w-full grid-cols-2 gap-2 [&>*]:min-w-0 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-4">
                <div className="relative col-span-2 sm:col-span-1">
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

              <div className="flex items-center gap-2 sm:gap-3 [&>button:first-child]:flex-1 sm:[&>button:first-child]:flex-none">
                <button
                  onClick={() => setActiveView("dashboard")}
                  aria-label="Overview"
                  title="Overview"
                  className={`grid h-10 w-10 place-items-center rounded-lg border transition-colors ${
                    activeView === "dashboard"
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setViewMode("table");
                    setActiveView("list");
                  }}
                  // hidden with the table itself: a dense row of eight columns is not a phone view
                  hidden={!wide}
                  aria-label="Table view"
                  title="Table view"
                  className={`grid h-10 w-10 place-items-center rounded-lg border transition-colors ${
                    activeView === "list" && viewMode === "table"
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setViewMode("grid");
                    setActiveView("list");
                  }}
                  aria-label="Card view"
                  title="Card view"
                  className={`grid h-10 w-10 place-items-center rounded-lg border transition-colors ${
                    activeView === "list" && viewMode === "grid"
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                {selectedPOs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
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

      <div className="p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            {activeView === "dashboard" && <Dashboard />}
            {activeView === "list" && (
              <>
                {wide && viewMode === "table" ? (
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
                    onShowAudit={setAuditPO}
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
                    onShowAudit={setAuditPO}
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
      {auditPO && (
        <DocumentAuditTrail
          id={auditPO.id}
          documentNo={auditPO.transactionNo}
          onClose={() => setAuditPO(null)}
        />
      )}
    </div>
  );
};

export default PurchaseReturnOrderManagement;