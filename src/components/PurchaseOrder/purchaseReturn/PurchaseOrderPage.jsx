import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
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
import axiosInstance from "../../../axios/axios"; // Import the configured Axios instance
import POForm from "./POForm";
import TableView from "./TableView";
import GridView from "./GridView";
import InvoiceView from "./InvoiceView";
import { decimalRound, downloadCSV, formatDateGB, formatNumber, toInputDate, todayInput, CURRENCY } from "../../../utils/format";
import { purchaseReturnTotals } from "../../OrderEntry/lineMath";
import { priorityDotClass, statusClasses, toastClasses } from "../../../lib/status";

import { useDeleteConfirm } from "../shared/useDeleteConfirm";
import DocumentAuditTrail from "../../audit/AuditTrail";
import { WIDE, useMediaQuery } from "../../accounting/DataTable";
import Can from "../../shell/Can";
import { useOrganisation } from "../../shell/OrganisationContext";
import { isPostedDocument, planBulkDelete, postedDeleteText, skippedPostedText } from "../../../lib/permissions";
import { usePeriodFilter } from "../../lists/usePeriodFilter";
import { PeriodNote, PeriodSelect } from "../../lists/PeriodFilter";
import ListPager from "../../lists/ListPager";
import ListEmpty from "../../lists/ListEmpty";
import { fetchAllTransactions } from "../../../lib/transactionList";
import { DEFAULT_LIST_PERIOD, compareCount, inPeriod, previousPeriod } from "../../../lib/listPeriod";
import { DEFAULT_PAGE_SIZE, pageSlice } from "../../../lib/pagination";
const PurchaseReturnOrderManagement = () => {
  const { canAny } = useOrganisation();
  const { stateOf, me } = useApproval();
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
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  // The list opens on this calendar month. Only a change of period asks the server again: search, status and party are
  // applied here, to the whole period, and the pages are cut here.
  const periodFilter = usePeriodFilter({ initial: DEFAULT_LIST_PERIOD });
  const { period } = periodFilter;
  const previous = previousPeriod(period, periodFilter.today);
  const [listInfo, setListInfo] = useState({ total: 0, truncated: false, previousTotal: null });
  const listRequest = useRef(0);
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
  }, []);

  // Read the list for the period shown, on mount and whenever the period changes
  useEffect(() => {
    fetchTransactions();
  }, [period.key]);

  // A new search, filter or period starts at the first page and drops a selection made on other rows: a bulk action must
  // act on what is seen
  useEffect(() => {
    setSelectedPOs([]);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, vendorFilter, period.key]);

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
          itemType: item.itemType,
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
    const ask = ++listRequest.current;
    setIsLoading(true);
    try {
      const { rows: fetched, total, truncated, previousTotal } = await fetchAllTransactions(axiosInstance, {
        type: "purchase_return",
        period,
        serverDates: false,
        compare: previous,
      });
      if (ask !== listRequest.current) return; // a newer read is on its way
      setListInfo({ total, truncated, previousTotal });
      setPurchaseOrders(
        fetched.map((transaction) => ({
          id: transaction._id,
          transactionNo: transaction.transactionNo,
          vendorId: transaction.partyId?._id || transaction.partyId, // Ensure vendorId is a string
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
          // who has approved it so far: a first of two shows as "Awaiting second approval"
          approvals: Array.isArray(transaction.approvals) ? transaction.approvals : [],
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
      if (ask === listRequest.current) setIsLoading(false);
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

  // The documents of the period, exactly (returns are read without a date filter: see lib/transactionList.js).
  // Everything below (the cards, the list, the pages) is these rows.
  const periodRows = useMemo(() => purchaseOrders.filter((row) => inPeriod(toInputDate(row.date), period)), [purchaseOrders, period]);

  // STATISTICS - of the period shown, against the period before it
  const statistics = useMemo(() => {
    const total = periodRows.length;
    const pending = periodRows.filter((po) => po.status === "PENDING").length;
    const approved = periodRows.filter((po) => po.status === "APPROVED").length;
    const draft = periodRows.filter((po) => po.status === "DRAFT").length;
    const rejected = periodRows.filter((po) => po.status === "REJECTED").length;
    const totalValue = periodRows.reduce((sum, po) => sum + parseFloat(po.totalAmount), 0);
    const approvedValue = periodRows.filter((po) => po.status === "APPROVED").reduce((sum, po) => sum + parseFloat(po.totalAmount), 0);
    return {
      total, pending, approved, draft, rejected, totalValue, approvedValue,
      compare: compareCount(total, previous ? purchaseOrders.filter((r) => inPeriod(toInputDate(r.date), previous)).length : null, previous?.name),
    };
  }, [periodRows, purchaseOrders, previous]);

  // FILTERING & SORTING (search, status and party are applied here, to the whole period)
  const filtersOn = Boolean(searchTerm.trim()) || statusFilter !== "ALL" || vendorFilter !== "ALL";
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setVendorFilter("ALL");
    setCurrentPage(1);
  };
  const filteredAndSortedPOs = useMemo(
    () => () => {
      const needle = searchTerm.trim().toLowerCase();
      const has = (v) => String(v ?? "").toLowerCase().includes(needle);
      let filtered = periodRows.filter((row) => {
        const matchesSearch =
          !needle ||
          has(row.transactionNo) ||
          has(row.displayTransactionNo) ||
          has(row.vendorName) ||
          has(row.createdBy) ||
          has(row.notes) ||
          (row.items || []).some((i) => has(i.description) || has(i.itemName));

        const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;
        const matchesParty = vendorFilter === "ALL" || row.vendorId === vendorFilter;

        return matchesSearch && matchesStatus && matchesParty;
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
    [periodRows, searchTerm, statusFilter, vendorFilter, sortBy, sortOrder]
  );

  const filteredPOs = filteredAndSortedPOs();
  // the page shown is always one that exists: a filter that leaves fewer rows, or a deleted last row, never leaves an empty page
  const pageView = pageSlice(filteredPOs, currentPage, itemsPerPage);
  const paginatedPOs = pageView.rows;
  useEffect(() => {
    if (currentPage !== pageView.page) setCurrentPage(pageView.page);
  }, [currentPage, pageView.page]);

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
        // Each return is judged on its own (its amount, who prepared it, who has approved it): say how each came out.
        const outcome = summariseApprovals(await approveMany(selectedPOs, { docs: purchaseOrders, stateOf, me }));
        addNotification(outcome.text, outcome.tone);
        fetchTransactions();
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
          title: `Delete ${plan.deletable.length} purchase returns?`,
          text: ["Each return is removed. An approved return is reversed in stock and in the ledger first. The deletion is written to the activity log.", plan.posted ? postedDeleteText(plan.posted) : "", left].filter(Boolean).join(" "),
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
          subText={statistics.compare.subText || period.label}
          trend={statistics.compare.trend || undefined}
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
          title="Approved"
          count={statistics.approved}
          tone="rose"
          icon={<BarChart3 />}
          subText="Sent back to vendors"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card shadow-card lg:col-span-2">
          <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">Recent purchase returns</h3>
            <span className="text-xs text-muted-foreground">{periodRows.length} {period.all ? "in total" : `· ${period.label}`}</span>
          </header>
          <div className="px-5">
            {periodRows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {period.all ? "No purchase returns yet. Create one to see it here." : `No purchase returns in ${period.label.toLowerCase()}. Widen the period above to see earlier ones.`}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {periodRows.slice(0, 5).map((row) => (
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
          {periodRows.length > 0 && (
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
      const response = await processTransaction(id, "approve");
      // Above the organisation's second-approver amount this only records the first approval: say so, not "approved"
      if (wasFirstApproval(response)) addNotification(FIRST_APPROVAL_MESSAGE, "info");
      else addNotification("Purchase Return Order approved successfully", "success");
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

  // Is anything in the selection waiting for approval that this person may approve? (their own work, or one over their limit, is not offered)
  const canBulkApprove = selectedPOs.some((id) => {
    const po = purchaseOrders.find((d) => d.id === id);
    return po && stateOf(po).canApprove;
  });

  // Does the selection hold anything this person may delete? (an approved one needs purchase.deletePosted)
  const canBulkDelete = planBulkDelete(selectedPOs, purchaseOrders, canAny("purchase.deletePosted")).deletable.length > 0;

  // Delete PO
  const deletePO = (id) => {
    // An approved return is reversed in stock and in the ledger: that is purchase.deletePosted, not plain Delete.
    const posted = isPostedDocument(purchaseOrders.find((d) => d.id === id));
    if (posted && !canAny("purchase.deletePosted")) {
      addNotification(skippedPostedText(1), "warning");
      return;
    }
    askDelete({
      title: "Delete this purchase return?",
      text: posted ? "This return is approved: deleting it REVERSES its stock and ledger postings, then removes it. The deletion is written to the activity log." : "The return is removed. An approved return is reversed in stock and in the ledger first. The deletion is written to the activity log.",
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
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
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
                  <span>New purchase return</span>
                </button>
              </Can>
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
                    placeholder="Search by number, vendor or item..."
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

                <PeriodSelect filter={periodFilter} />
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
                    {canBulkApprove && <Can permission="purchase.approve">
                      <button
                        onClick={() => handleBulkAction("approve")}
                        className="flex items-center space-x-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>Approve Selected</span>
                      </button>
                    </Can>}
                    {canBulkDelete && (
                      <Can permission="purchase.delete">
                        <button
                          onClick={() => handleBulkAction("delete")}
                          className="flex items-center space-x-2 px-4 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete Selected</span>
                        </button>
                      </Can>
                    )}
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
            <PeriodNote filter={periodFilter} count={periodRows.length} extra={filtersOn ? `${filteredPOs.length} match the search and filters` : undefined} noun="returns" one="return" limited={listInfo.truncated} className="mt-3" />
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
            {activeView === "list" && filteredPOs.length === 0 && (
              <ListEmpty
                filter={periodFilter}
                noun="purchase returns"
                inPeriod={periodRows.length}
                filtered={filtersOn}
                onClearFilters={clearFilters}
                createText="Create the first one with New purchase return."
              />
            )}
            {activeView === "list" && filteredPOs.length > 0 && (
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
                <ListPager
                  figures={pageView}
                  onPage={setCurrentPage}
                  onPageSize={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
                  noun="returns"
                  one="return"
                  className="mt-4"
                />
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