import React, { useCallback, useMemo, useState, useEffect } from "react";
import { approveMany, processTransaction } from "../../../lib/processTransaction";
import { FIRST_APPROVAL_MESSAGE, summariseApprovals, wasFirstApproval } from "../../../lib/approvals";
import { useApproval } from "../../shell/Approval";
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
import axiosInstance from "../../../axios/axios";
import POForm from "./POForm";
import TableView from "./TableView";
import GridView from "./GridView";
import InvoiceView from "./InvoiceView";
import { decimalRound, downloadCSV, formatDateGB, formatNumber, toInputDate, todayInput, CURRENCY } from "../../../utils/format";
import { priorityDotClass, statusClasses, toastClasses } from "../../../lib/status";

import { useDeleteConfirm } from "../shared/useDeleteConfirm";
import DocumentAuditTrail from "../../audit/AuditTrail";
import { WIDE, useMediaQuery } from "../../accounting/DataTable";
import Can from "../../shell/Can";
import { useOrganisation } from "../../shell/OrganisationContext";
import { isPostedDocument, planBulkDelete, postedDeleteText, skippedPostedText } from "../../../lib/permissions";
const PurchaseOrderManagement = () => {
  const { canAny } = useOrganisation();
  const { stateOf, me } = useApproval();
  const [activeView, setActiveView] = useState("dashboard");
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
  const [createdPO, setCreatedPO] = useState(null);

  const [formData, setFormData] = useState({
    transactionNo: "",
    partyId: "",
    vendorReference: "",
    date: todayInput(),
    deliveryDate: "",
    status: "DRAFT",
    items: [
      {
        itemId: "",
        description: "",
        qty: "",
        rate: "0.00",
        taxPercent: "5",
        purchasePrice: 0,
        currentPurchasePrice: 0,
        category: "",
        brand: "",
        origin: "",
        total: "0.00",
        vatAmount: "0.00",
        grandTotal: "0.00",
        vatPercent: "5",
      },
    ],
    terms: "",
    notes: "",
    priority: "Medium",
  });

  useEffect(() => {
    fetchVendors();
    fetchStockItems();
    fetchTransactions();
  }, []);

  // Refresh list when filters change
  useEffect(() => {
    fetchTransactions();
  }, [searchTerm, statusFilter, vendorFilter, dateFilter]);

  const fetchVendors = async () => {
    setIsLoading(true);
    try {
      const { data } = await axiosInstance.get("/vendors/vendors");
      setVendors(data.data || []);
    } catch (e) {
      addNotification(
        `Vendors load error: ${e.response?.data?.message || e.message}`,
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStockItems = async () => {
    setIsLoading(true);
    try {
      const { data } = await axiosInstance.get("/stock/stock");
      const stocks = data.data?.stocks || data.data || [];
      setStockItems(
        stocks.map((i) => ({
          _id: i._id,
          itemId: i.itemId,
          itemName: i.itemName,
          sku: i.sku,
          category: i.category,
          unitOfMeasure: i.unitOfMeasure,
          currentStock: i.currentStock,
          purchasePrice: i.purchasePrice,
          salesPrice: i.salesPrice,
          reorderLevel: i.reorderLevel,
          status: i.status,
          brand: i.brand,
          origin: i.origin,
          expiryDate: i.expiryDate,
        }))
      );
    } catch (e) {
      addNotification(
        `Stock load error: ${e.response?.data?.message || e.message}`,
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setIsLoading(true);
    try {
      const { data } = await axiosInstance.get("/transactions/transactions", {
        params: {
          type: "purchase_order",
          search: searchTerm,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          partyId: vendorFilter !== "ALL" ? vendorFilter : undefined,
          dateFilter: dateFilter !== "ALL" ? dateFilter : undefined,
        },
      });

      console.log("Raw transactions:", data); // Debug

      const enrichedPOs = data.data.map((t) => {
        // FIX: Enrich vendor name using vendors array (reliable fallback)
        const vendorObj = vendors.find((v) => v._id === t.partyId);
        const vendorName = vendorObj?.vendorName || t.partyName || "Unknown Vendor";

        // Enrich each item with stock details (FIX: Preserve itemCode, fallback sku)
        const enrichedItems = (t.items || []).map((item) => {
          const stock = item.stockDetails || stockItems.find(s => String(s._id) === String(item.itemId)) || {};
          const normalizedItemCode = item.itemCode || stock.itemId || stock.itemCode || item.sku || item.itemId || "-";

          return {
            // Preserve backend fields
            itemId: item.itemId,
            itemCode: normalizedItemCode,
            description: item.description || "",
            qty: item.qty || 0,
            rate: item.rate || 0,
            lineTotal: item.lineTotal || 0,
            vatAmount: item.vatAmount || 0,
            vatPercent: item.vatPercent || 5,

            // Enriched from stock or backend
            itemName: stock.itemName || "Unknown Item",
            sku: stock.sku || item.sku || item.itemId || normalizedItemCode,
            barcodeQrCode: stock.barcodeQrCode || "-",
            category: stock.category || "-",
            brand: stock.brand || "-",
            origin: stock.origin || "-",
            unitOfMeasure: stock.unitOfMeasureDetails?.unitName || stock.unitOfMeasure || "Unit",
            currentStock: stock.currentStock || 0,
            purchasePrice: stock.purchasePrice || 0,
            salesPrice: stock.salesPrice || 0,
            reorderLevel: stock.reorderLevel || 0,
            expiryDate: stock.expiryDate || null,
            batchNumber: stock.batchNumber || "-",
          };
        });

        return {
          id: t._id,
          transactionNo: t.transactionNo,
          vendorId: t.partyId,
          vendorName,  // FIX: Use enriched vendorName
          vendorReference: t.vendorReference || "",
          refNo: t.vendorReference || t.refNo || "",
          date: t.date ? toInputDate(t.date) : "",
          deliveryDate: t.deliveryDate
            ? toInputDate(t.deliveryDate)
            : "",
          status: t.status,
          totalAmount: Number(t.totalAmount || 0).toFixed(2),
          outstandingAmount: Number(t.outstandingAmount || 0).toFixed(2),
          paidAmount: Number(t.paidAmount || 0).toFixed(2),
          items: enrichedItems,
          terms: t.terms || "",
          notes: t.notes || "",
          createdBy: t.createdBy || "System",
          // who has approved it so far: a first of two shows as "Awaiting second approval"
          approvals: Array.isArray(t.approvals) ? t.approvals : [],
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          grnGenerated: t.grnGenerated || false,
          invoiceGenerated: t.invoiceGenerated || false,
          priority: t.priority || "Medium",
          creditNoteIssued: t.creditNoteIssued || false,
          quoteRef: t.quoteRef || null,
          linkedRef: t.linkedRef || null,
        };
      });

      console.log("DEBUG: Enriched POs sample:", enrichedPOs[0]?.items?.[0]);  // TEMP: Check first item's code fields
      setPurchaseOrders(enrichedPOs);
    } catch (e) {
      addNotification(
        `Transactions load error: ${e.response?.data?.message || e.message}`,
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
      "Purchase Order saved successfully! Showing invoice...",
      "success"
    );
    setTimeout(resetForm, 0);
  };

  // Statistics calculations
  const getStatistics = useMemo(
    () => () => {
      const total = purchaseOrders.length;
      const pending = purchaseOrders.filter(
        (po) => po.status === "PENDING"
      ).length;
      const paid = purchaseOrders.filter((po) => po.status === "paid").length;
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
        paid,
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
            case "WEEK": {
              const weekAgo = new Date(
                today.getTime() - 7 * 24 * 60 * 60 * 1000
              );
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
    [
      purchaseOrders,
      searchTerm,
      statusFilter,
      vendorFilter,
      dateFilter,
      sortBy,
      sortOrder,
      vendors,  // ADD: Depend on vendors for enrichment
    ]
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
      addNotification(
        "Please select orders to perform bulk actions",
        "warning"
      );
      return;
    }

    try {
      if (action === "approve") {
        // Each order is judged on its own (its amount, who prepared it, who has approved it): say how each came out.
        const outcome = summariseApprovals(await approveMany(selectedPOs, { docs: purchaseOrders, stateOf, me }));
        addNotification(outcome.text, outcome.tone);
        fetchTransactions();
        fetchStockItems();
      } else if (action === "delete") {
        // An approved document is deleted only by someone who holds purchase.deletePosted (the server decides the same way by the
        // stored status): the others are left out of the request and told so.
        const plan = planBulkDelete(selectedPOs, purchaseOrders, canAny("purchase.deletePosted"));
        const left = plan.skipped.length ? skippedPostedText(plan.skipped.length) : "";
        if (plan.deletable.length === 0) {
          addNotification(left, "warning");
          return;
        }
        askDelete({
          title: `Delete ${plan.deletable.length} purchase orders?`,
          text: ["Each order is removed. An approved order is reversed in stock and in the ledger first. The deletion is written to the activity log.", plan.posted ? postedDeleteText(plan.posted) : "", left].filter(Boolean).join(" "),
          onConfirm: async () => {
            try {
              for (const poId of plan.deletable) {
                await axiosInstance.delete(`/transactions/transactions/${poId}`);
              }
              addNotification([`${plan.deletable.length} orders deleted`, left].filter(Boolean).join(". "), left ? "warning" : "success");
            } catch (error) {
              addNotification("Failed to delete: " + (error.response?.data?.message || error.message), "error");
            }
            fetchTransactions();
          },
        });
      } else if (action === "export") {
        addNotification(`Exporting ${selectedPOs.length} orders...`, "info");
        downloadCSV(
          "selected_purchase_orders.csv",
          ["TransactionNo", "Vendor", "Date", "DeliveryDate", "Status", "TotalAmount", "Priority"],
          selectedPOs
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
            ])
        );
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
    <div className="fixed end-4 bottom-4 z-[70] space-y-2">
      {notifications.map((notification, i) => (
        <div
          key={i}
          className={`max-w-sm ${toastClasses(notification.type)}`}
        >
          <div className="flex flex-wrap items-center gap-2">
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
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        <StatCard
          title="Total Orders"
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
          count={`${CURRENCY} ${formatNumber(statistics.totalValue)}`}
          tone="olive"
          icon={<Banknote />}
          subText={`Approved ${CURRENCY} ${formatNumber(statistics.approvedValue)}`}
        />
        <StatCard
          title="This Month"
          count={statistics.thisMonthPOs}
          tone="rose"
          icon={<BarChart3 />}
          subText="New purchase orders created"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card shadow-card lg:col-span-2">
          <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">Recent purchase orders</h3>
            <span className="text-xs text-muted-foreground">{purchaseOrders.length} in total</span>
          </header>
          <div className="px-5">
            {purchaseOrders.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No purchase orders yet. Create one to see it here.
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
                        {CURRENCY} {formatNumber(row.totalAmount)}
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
                View all purchase orders →
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
              { label: "Pending", value: statistics.pending },
              { label: "Approved", value: statistics.approved },
              { label: "Rejected", value: statistics.rejected },
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
                Nothing to show until the first purchase order is created.
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
          <span className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {filteredPOs.length} orders
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 border border-input rounded-lg text-sm bg-card text-foreground"
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
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
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
                      ? "border-foreground bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary"
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
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
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
      vendorReference: "",
      date: todayInput(),
      deliveryDate: "",
      status: "DRAFT",
      items: [
        {
          itemId: "",
          description: "",
          qty: "",
          rate: "0.00",
          taxPercent: "5",
          purchasePrice: 0,
          currentPurchasePrice: 0,
          category: "",
          brand: "",
          origin: "",
          total: "0.00",
          vatAmount: "0.00",
          grandTotal: "0.00",
          vatPercent: "5",
        },
      ],
      terms: "",
      notes: "",
      priority: "Medium",
    });
  }, []);

  const calculateTotals = (items) => {
    let subtotal = 0,
      tax = 0;
    items
      .filter((i) => i.itemId && i.qty && i.currentPurchasePrice)
      .forEach((i) => {
        const qty = Number(i.qty) || 0;
        const price = Number(i.currentPurchasePrice) || 0;
        const vat = Number(i.vatPercent) || 0;
        const line = qty * price;
        const lineTax = line * (vat / 100);
        subtotal += line;
        tax += lineTax;
      });
    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: (subtotal + tax).toFixed(2),
    };
  };

  const editPO = async (po) => {
    try {
      // The full saved document, not the trimmed list copy: nothing on it may be lost on save.
      setFormData(await loadFormForEdit(VARIANTS.purchase, po.id));
      setSelectedPO(po);
      setActiveView("edit");
    } catch (err) {
      addNotification(
        "Could not open the purchase order: " + (err.response?.data?.message || err.message),
        "error"
      );
    }
  };

  // Approve PO
  const approvePO = async (id) => {
    try {
      const response = await processTransaction(id, "approve");
      // Above the organisation's second-approver amount this only records the first approval: say so, not "approved"
      if (wasFirstApproval(response)) addNotification(FIRST_APPROVAL_MESSAGE, "info");
      else addNotification("Purchase Order approved successfully", "success");
      fetchTransactions();
      fetchStockItems();
    } catch (error) {
      console.error("Approve PO Error:", error);
      addNotification(
        "Failed to approve purchase order: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    }
  };

  // Reject PO
  const rejectPO = async (id) => {
    try {
      await processTransaction(id, "reject");
      addNotification("Purchase Order rejected successfully", "success");
      fetchTransactions();
    } catch (error) {
      console.error("Reject PO Error:", error);
      addNotification(
        "Failed to reject purchase order: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    }
  };

  const [askDelete, deleteDialog] = useDeleteConfirm();

  // Is anything in the selection waiting for approval that this person may approve? (their own work, or one over their limit, is not offered)
  const canBulkApprove = selectedPOs.some((id) => {
    const po = purchaseOrders.find((d) => d.id === id);
    return po && stateOf(po).canApprove;
  });

  // Does the selection hold anything this person may delete? (an approved one needs purchase.deletePosted)
  const canBulkDelete = planBulkDelete(selectedPOs, purchaseOrders, canAny("purchase.deletePosted")).deletable.length > 0;

  // Delete PO
  const deletePO = (id) => {
    // An approved order is reversed in stock and in the ledger: that is purchase.deletePosted, not plain Delete.
    const posted = isPostedDocument(purchaseOrders.find((d) => d.id === id));
    if (posted && !canAny("purchase.deletePosted")) {
      addNotification(skippedPostedText(1), "warning");
      return;
    }
    askDelete({
      title: "Delete this purchase order?",
      text: posted ? "This order is approved: deleting it REVERSES its stock and ledger postings, then removes it. The deletion is written to the activity log." : "The order is removed. An approved order is reversed in stock and in the ledger first. The deletion is written to the activity log.",
      onConfirm: async () => {
        try {
          await axiosInstance.delete(`/transactions/transactions/${id}`);
          addNotification("Purchase Order deleted successfully", "success");
          fetchTransactions();
        } catch (error) {
          console.error("Delete PO Error:", error);
          addNotification("Failed to delete purchase order: " + (error.response?.data?.message || error.message), "error");
        }
      },
    });
  };

  return (
    <div className="bg-background font-sans">
      {deleteDialog}
      <NotificationList />
      <div className="relative bg-card border-b border-border">
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid w-full grid-cols-2 gap-2 [&>*]:min-w-0 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-4">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Purchase orders
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Orders to your vendors, from draft to goods received.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 [&>button:first-child]:flex-1 sm:[&>button:first-child]:flex-none">
              <Can permission="purchase.create">
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
                  <span>New purchase order</span>
                </button>
              </Can>
              <button
                onClick={() => {
                  fetchVendors();
                  fetchStockItems();
                  fetchTransactions();
                }}
                className="grid h-10 w-10 place-items-center rounded-lg border border-input bg-card text-foreground transition-colors hover:bg-accent"
              >
                <RefreshCw className="w-5 h-5 text-foreground" />
              </button>
              <button className="grid h-10 w-10 place-items-center rounded-lg border border-input bg-card text-foreground transition-colors hover:bg-accent">
                <Settings className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        </div>

        {(activeView === "dashboard" || activeView === "list") && (
          <div className="px-4 py-3 sm:px-6 sm:py-4 lg:px-8 bg-secondary/60 border-t border-border">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="grid w-full grid-cols-2 gap-2 [&>*]:min-w-0 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-4">
                <div className="relative col-span-2 sm:col-span-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by PO number, vendor, or user..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full sm:w-80 pl-10 pr-4 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
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
                  className="px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
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
                  className="px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
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
                    viewMode === "table" && activeView === "list"
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
                    viewMode === "grid" && activeView === "list"
                      ? "border-foreground bg-foreground text-background"
                      : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                {selectedPOs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {canBulkApprove && <Can permission="purchase.approve">
                      <button
                        onClick={() => handleBulkAction("approve")}
                        className="flex items-center space-x-2 px-4 py-2 bg-card text-foreground rounded-lg hover:bg-accent transition-colors border border-input"
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>Approve Selected</span>
                      </button>
                    </Can>}
                    {canBulkDelete && (
                      <Can permission="purchase.delete">
                        <button
                          onClick={() => handleBulkAction("delete")}
                          className="flex items-center space-x-2 px-4 py-2 bg-card text-foreground rounded-lg hover:bg-accent transition-colors border border-input"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Selected</span>
                        </button>
                      </Can>
                    )}
                    <button
                      onClick={() => handleBulkAction("export")}
                      className="flex items-center space-x-2 px-4 py-2 bg-card text-foreground rounded-lg hover:bg-accent transition-colors border border-input"
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
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-foreground"></div>
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

export default PurchaseOrderManagement;