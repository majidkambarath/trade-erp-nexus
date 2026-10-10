import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import SOForm from "./SOForm";
import TableView from "./TableView";
import GridView from "./GridView";
import SaleInvoiceView from "./InvoiceView";
import { decimalRound, downloadCSV, formatDateGB, formatNumber, toInputDate, todayInput, CURRENCY } from "../../../utils/format";
import { usePeriodFilter } from "../../lists/usePeriodFilter";
import { PeriodNote, PeriodSelect } from "../../lists/PeriodFilter";
import ListPager from "../../lists/ListPager";
import ListEmpty from "../../lists/ListEmpty";
import { fetchAllTransactions } from "../../../lib/transactionList";
import { DEFAULT_LIST_PERIOD, compareCount, inPeriod, previousPeriod } from "../../../lib/listPeriod";
import { DEFAULT_PAGE_SIZE, pageSlice } from "../../../lib/pagination";
import { priorityDotClass, statusClasses, toastClasses } from "../../../lib/status";
import { useCompanyProfile } from "../shared/useCompanyProfile";
import { buildSalesDocument } from "../shared/invoiceDocuments";
import { downloadSheetsPdf, sheetMarkup, sheetsPdfFile } from "../shared/documentPdf";
import SendDialog from "../../send/SendDialog";
import { summaryOfSend } from "../../send/shared";
import { readAccent } from "../shared/invoiceModel";

import { useDeleteConfirm } from "../shared/useDeleteConfirm";
import DocumentAuditTrail from "../../audit/AuditTrail";
import { WIDE, useMediaQuery } from "../../accounting/DataTable";
import Can from "../../shell/Can";
import { useOrganisation } from "../../shell/OrganisationContext";
import { isPostedDocument, planBulkDelete, postedDeleteText, skippedPostedText } from "../../../lib/permissions";
import { orgCurrency } from "../../../utils/orgLocale";
// Other screens link here with ?search=<number> (a quotation that became this order, a delivery note
// that is on it): the list opens already narrowed to that document.
const linkedSearch = () => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("search") || "");

const SalesOrderManagement = () => {
  const { canAny } = useOrganisation();
  const { stateOf, me } = useApproval();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState(() => (linkedSearch() ? "list" : "dashboard"));
  // The table is the right list for a pointer and the cards for a thumb, so the default
  // follows the screen. Choosing a view by hand still wins, and holds until a reload.
  const wide = useMediaQuery(WIDE);
  const [viewMode, setViewMode] = useState(() => (wide ? "table" : "grid"));
  const [selectedSO, setSelectedSO] = useState(null);
  // The document whose audit trail is open, or null.
  const [auditSO, setAuditSO] = useState(null);
  const [sendSO, setSendSO] = useState(null); // the order being sent to its customer
  const [searchTerm, setSearchTerm] = useState(linkedSearch);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [customerFilter, setCustomerFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  // The list opens on this calendar month; a link that names a document (?search=) opens on all time, because that document
  // may be from any month. Only a change of period asks the server again: the rest is filtered, sorted and paged here.
  const periodFilter = usePeriodFilter({ initial: linkedSearch() ? "all" : DEFAULT_LIST_PERIOD });
  const { period } = periodFilter;
  const previous = previousPeriod(period, periodFilter.today);
  const [listInfo, setListInfo] = useState({ total: 0, truncated: false, previousTotal: null });
  const listRequest = useRef(0);
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
    transactionNoMode: "AUTO",
    partyId: "",
    partyName: "",
    date: todayInput(),
    deliveryDate: "",
    status: "DRAFT",
    priority: "Medium",
    terms: "",
    notes: "",
    refNo: "",
    docNo: "",
    discount: "0.00",
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
  }, []);

  // Read the list for the period shown, on mount and whenever the period changes
  useEffect(() => {
    fetchTransactions();
  }, [period.key]);

  // A new search, filter or period starts at the first page and drops a selection made on other rows: a bulk action must act
  // on what is seen
  useEffect(() => {
    setSelectedSOs([]);
    setCurrentPage(1);
  }, [searchTerm, statusFilter, customerFilter, period.key]);

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
          itemType: item.itemType,
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
    const ask = ++listRequest.current;
    setIsLoading(true);
    try {
      // every page of the period (the server returns 20 unless asked, and 200 at most), not the newest twenty
      const { rows: transactions, total, truncated, previousTotal } = await fetchAllTransactions(axiosInstance, {
        type: "sales_order",
        period,
        serverDates: true,
        compare: previous,
      });
      if (ask !== listRequest.current) return; // a newer read is on its way
      setListInfo({ total, truncated, previousTotal });
      // helper to format invoice number for APPROVED orders:
// remove leading SO (case-insensitive), keep digits, pad to 4 chars (e.g. SO277 -> 0277)
const formatDisplayTransactionNo = (t) => {
  try {
    if (t.status === "APPROVED" && t.transactionNo) {
      // remove non-digits (and optional SO prefix)
      const digits = String(t.transactionNo).replace(/^SO/i, "").replace(/\D/g, "");
      if (!digits) return t.transactionNo;
      return digits.padStart(4, "0"); // 277 -> 0277
    }
    return t.transactionNo;
  } catch {
    return t.transactionNo;
  }
};

      setSalesOrders(
  transactions.map((t) => {
    const displayTransactionNo = formatDisplayTransactionNo(t);
    return {
      id: t._id,
      transactionNo: t.transactionNo,
      displayTransactionNo,
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
      // who has approved it so far: a first of two shows as "Awaiting second approval"
      approvals: Array.isArray(t.approvals) ? t.approvals : [],
      createdAt: t.createdAt,
      invoiceGenerated: t.invoiceGenerated,
      // an opening balance invoice has no goods; an order the customer will not take the rest of takes no more deliveries
      isOpening: Boolean(t.isOpening),
      closedShort: t.closedShort?.at ? t.closedShort : null,
      // how it last went to the customer (services/messaging), so the list can say so without a join
      lastSend: t.lastSend || null,
      priority: t.priority || "Medium",
      // Map backend fields for LPO, Doc No, and Discount to UI fields
      refNo: t.lpono ?? t.refNo ?? "",
      docNo: t.docno ?? t.docNo ?? "",
      discount: typeof t.discount === "number" ? t.discount : 0,
    };
  })
);
    } catch (error) {
      addNotification(
        "Failed to fetch transactions: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    } finally {
      if (ask === listRequest.current) setIsLoading(false);
    }
  };

  const generateTransactionNumber = () => {
    // The number is assigned by the server's numbering series when the document is saved.
    setFormData((prev) => ({ ...prev, transactionNo: "" }));
  };

  const addNotification = (message, type = "info") => {
    const id = Date.now() + Math.random();
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

  // EDIT SO – FULLY WORKING
  const editSO = async (so) => {
    try {
      // The full saved document, not the trimmed list copy: nothing on it may be lost on save.
      setFormData(await loadFormForEdit(VARIANTS.sales, so.id));
      setSelectedSO(so);
      setActiveView("edit");
    } catch (err) {
      addNotification(
        "Could not open the sales order: " + (err.response?.data?.message || err.message),
        "error"
      );
    }
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

  // The documents of the period, exactly: the server is asked for a day either side, and this is the test that counts.
  // Everything below (the cards, the list, the pages) is these rows.
  const periodRows = useMemo(
    () => salesOrders.filter((so) => inPeriod(toInputDate(so.date), period)),
    [salesOrders, period]
  );

  // STATISTICS - of the period shown, against the period before it
  const statistics = useMemo(() => {
    const total = periodRows.length;
    const draft = periodRows.filter((so) => so.status === "DRAFT").length;
    const confirmed = periodRows.filter((so) => so.status === "APPROVED").length;
    const invoiced = periodRows.filter((so) => so.status === "INVOICED").length;
    const totalValue = periodRows.reduce((sum, so) => sum + parseFloat(so.totalAmount), 0);
    const invoicedValue = periodRows
      .filter((so) => so.status === "INVOICED")
      .reduce((sum, so) => sum + parseFloat(so.totalAmount), 0);
    return {
      total,
      draft,
      confirmed,
      invoiced,
      totalValue,
      invoicedValue,
      compare: compareCount(total, listInfo.previousTotal, previous?.name),
    };
  }, [periodRows, listInfo.previousTotal, previous?.name]);

  // FILTERING & SORTING (search, status and customer are applied here, to the whole period)
  const filtersOn = Boolean(searchTerm.trim()) || statusFilter !== "ALL" || customerFilter !== "ALL";
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setCustomerFilter("ALL");
    setCurrentPage(1);
  };
  const filteredAndSortedSOs = useMemo(
    () => () => {
      const needle = searchTerm.trim().toLowerCase();
      const has = (v) => String(v ?? "").toLowerCase().includes(needle);
      let filtered = periodRows.filter((so) => {
        const matchesSearch =
          !needle ||
          has(so.transactionNo) ||
          has(so.displayTransactionNo) ||
          has(so.customerName) ||
          has(so.createdBy) ||
          has(so.refNo) ||
          has(so.docNo) ||
          has(so.notes) ||
          (so.items || []).some((i) => has(i.description) || has(i.itemName));

        const matchesStatus =
          statusFilter === "ALL" || so.status === statusFilter;
        const matchesCustomer =
          customerFilter === "ALL" || so.customerId === customerFilter;

        return matchesSearch && matchesStatus && matchesCustomer;
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
      periodRows,
      searchTerm,
      statusFilter,
      customerFilter,
      sortBy,
      sortOrder,
    ]
  );

  const filteredSOs = filteredAndSortedSOs();
  // the page shown is always one that exists: a filter that leaves fewer rows, or a deleted last row, never leaves an empty page
  const pageView = pageSlice(filteredSOs, currentPage, itemsPerPage);
  const paginatedSOs = pageView.rows;
  useEffect(() => {
    if (currentPage !== pageView.page) setCurrentPage(pageView.page);
  }, [currentPage, pageView.page]);

  const getStatusColor = (status) => statusClasses(status);

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
        // Each order is judged on its own (its amount, who prepared it, who has approved it), so the answer says how many were
        // approved, how many wait for a second person and how many were refused - and why.
        const outcome = summariseApprovals(await approveMany(selectedSOs, { docs: salesOrders, stateOf, me }));
        addNotification(outcome.text, outcome.tone);
      } else if (action === "delete") {
        // An approved document is deleted only by someone who holds sales.deletePosted (the server decides the same way by the
        // stored status): the others are left out of the request and told so.
        const plan = planBulkDelete(selectedSOs, salesOrders, canAny("sales.deletePosted"));
        const left = plan.skipped.length ? skippedPostedText(plan.skipped.length) : "";
        if (plan.deletable.length === 0) {
          addNotification(left, "warning");
          return;
        }
        askDelete({
          title: `Delete ${plan.deletable.length} sales orders?`,
          text: ["Each order is removed. An approved order is reversed in stock and in the ledger first. The deletion is written to the activity log.", plan.posted ? postedDeleteText(plan.posted) : "", left].filter(Boolean).join(" "),
          onConfirm: async () => {
            try {
              for (const soId of plan.deletable) {
                await axiosInstance.delete(`/transactions/transactions/${soId}`);
              }
              addNotification([`${plan.deletable.length} orders deleted`, left].filter(Boolean).join(". "), left ? "warning" : "success");
            } catch (error) {
              addNotification("Failed to delete: " + (error.response?.data?.message || error.message), "error");
            }
            fetchTransactions();
          },
        });
      } else if (action === "export") {
        downloadCSV(
          "selected_sales_orders.csv",
          ["TransactionNo", "Customer", "Date", "DeliveryDate", "Status", "TotalAmount", "Priority"],
          selectedSOs
            .map((soId) => salesOrders.find((s) => s.id === soId))
            .filter(Boolean)
            .map((so) => [
              so.displayTransactionNo || so.transactionNo || "",
              so.customerName || "Unknown",
              formatDateGB(so.date),
              formatDateGB(so.deliveryDate),
              so.status,
              decimalRound(so.totalAmount),
              so.priority,
            ])
        );
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
      date: todayInput(),
      deliveryDate: "",
      status: "DRAFT",
      priority: "Medium",
      terms: "",
      notes: "",
      refNo: "",
      docNo: "",
      discount: "0.00",
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
      // Soft stock validation: warn for items exceeding stock but do not block approval
      const so = salesOrders.find((s) => s.id === id);
      if (so && Array.isArray(so.items)) {
        so.items.forEach((it) => {
          const stock = stockItems.find((s) => String(s._id) === String(it.itemId));
          const qty = parseFloat(it.qty) || 0;
          if (stock && typeof stock.currentStock === 'number' && qty > stock.currentStock) {
            addNotification(`Insufficient stock for ${stock.itemName} (available ${stock.currentStock})`, 'warning');
          }
        });
      }

      const response = await processTransaction(id, "approve");
      // Above the organisation's second-approver amount this only records the first approval: say so, not "approved"
      if (wasFirstApproval(response)) addNotification(FIRST_APPROVAL_MESSAGE, "info");
      else addNotification("Sales Order approved successfully", "success");
      fetchTransactions();
    } catch (error) {
      addNotification(
        "Failed to approve: " +
          (error.response?.data?.message || error.message),
        "error"
      );
    }
  };

  // The list's Download actions print the same document as the invoice screen.
  const companyProfile = useCompanyProfile();
  const downloadInvoiceCopy = async (so, copyType) => {
    try {
      const customer = customers.find((c) => c._id === so.customerId) || {};
      const doc = buildSalesDocument(so, customer, companyProfile, orgCurrency());
      await downloadSheetsPdf([sheetMarkup(doc.sheet, { copy: copyType, accent: readAccent() })], doc.fileName);
    } catch (error) {
      console.error(error);
      addNotification(`Failed to generate PDF: ${error.message || "unknown error"}`, 'error');
    }
  };

  // The Send dialog for a row of the list: the same customer copy the Download draws, handed over as a file.
  const sendFor = (so) => {
    const customer = customers.find((c) => c._id === so.customerId) || {};
    const doc = buildSalesDocument(so, customer, companyProfile, orgCurrency());
    return {
      doc: {
        kind: "tax_invoice", sourceType: "Transaction", id: so.id, number: doc.sheet.number.value, title: doc.sheet.title,
        companyName: companyProfile.companyName, lastSend: so.lastSend,
        party: { email: customer.email, phone: customer.phone, contacts: customer.contacts },
      },
      attachment: { label: "Customer copy", build: () => sheetsPdfFile([sheetMarkup(doc.sheet, { copy: "Customer copy", accent: readAccent() })], doc.fileName) },
    };
  };

  const [askDelete, deleteDialog] = useDeleteConfirm();

  // Is anything in the selection a draft this person may approve? (their own work, or one over their limit, is not offered)
  const canBulkApprove = selectedSOs.some((id) => {
    const so = salesOrders.find((d) => d.id === id);
    return so?.status === "DRAFT" && stateOf(so).canApprove;
  });

  // Does the selection hold anything this person may delete? (an approved one needs sales.deletePosted)
  const canBulkDelete = planBulkDelete(selectedSOs, salesOrders, canAny("sales.deletePosted")).deletable.length > 0;

  const deleteSO = (id) => {
    // An approved order is reversed in stock and in the ledger: that is sales.deletePosted, not plain Delete.
    const posted = isPostedDocument(salesOrders.find((d) => d.id === id));
    if (posted && !canAny("sales.deletePosted")) {
      addNotification(skippedPostedText(1), "warning");
      return;
    }
    askDelete({
      title: "Delete this sales order?",
      text: posted ? "This order is approved: deleting it REVERSES its stock and ledger postings, then removes it. The deletion is written to the activity log." : "The order is removed. An approved order is reversed in stock and in the ledger first. The deletion is written to the activity log.",
      onConfirm: async () => {
        try {
          await axiosInstance.delete(`/transactions/transactions/${id}`);
          addNotification("Sales Order deleted", "success");
          fetchTransactions();
        } catch (error) {
          addNotification("Failed to delete: " + (error.response?.data?.message || error.message), "error");
        }
      },
    });
  };

  // COMPONENTS
  const NotificationList = () => (
    <div className="fixed end-4 bottom-4 z-[70] space-y-2">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`max-w-sm ${toastClasses(n.type)}`}
        >
          <div className="flex flex-wrap items-center gap-2">
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
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {/* the four cards are the period shown above (This month unless widened), never "the newest twenty" */}
        <StatCard
          title="Total Orders"
          count={statistics.total}
          tone="teal"
          icon={<ShoppingCart />}
          subText={statistics.compare.subText || period.label}
          trend={statistics.compare.trend || undefined}
        />
        <StatCard
          title="Approved"
          count={statistics.confirmed}
          tone="plum"
          icon={<CheckSquare />}
          subText="Ready for dispatch"
        />
        <StatCard
          title="Total Value"
          count={`${CURRENCY} ${formatNumber(statistics.totalValue)}`}
          tone="olive"
          icon={<Banknote />}
          subText={`Invoiced ${CURRENCY} ${formatNumber(statistics.invoicedValue)}`}
        />
        <StatCard
          title="Drafts"
          count={statistics.draft}
          tone="rose"
          icon={<BarChart3 />}
          subText="Waiting for approval"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-border bg-card shadow-card lg:col-span-2">
          <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <h3 className="text-sm font-semibold text-foreground">Recent sales orders</h3>
            <span className="text-xs text-muted-foreground">
              {periodRows.length} {period.all ? "in total" : `· ${period.label}`}
            </span>
          </header>
          <div className="px-5">
            {periodRows.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {period.all ? "No sales orders yet. Create one to see it here." : `No sales orders in ${period.label.toLowerCase()}. Widen the period above to see earlier ones.`}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {periodRows.slice(0, 5).map((so) => (
                  <li key={so.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${getPriorityColor(so.priority)}`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {so.displayTransactionNo || so.transactionNo}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{so.customerName}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums text-foreground">
                        {CURRENCY} {formatNumber(so.totalAmount)}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusColor(
                          so.status
                        )}`}
                      >
                        {getStatusIcon(so.status)}
                        <span className="ms-1">{so.status}</span>
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
                View all orders →
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
              { label: "Approved", value: statistics.confirmed },
              { label: "Invoiced", value: statistics.invoiced },
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
                Nothing to show until the first order is created.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="bg-background font-sans">
      {deleteDialog}
      <NotificationList />
      <div className="relative bg-card border-b border-border">
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Sales orders
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Orders and tax invoices to your customers, from draft to approved.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 [&>button:first-child]:flex-1 sm:[&>button:first-child]:flex-none">
              <Can permission="sales.create">
                <button
                  onClick={() => {
                    resetForm();
                    setSelectedSO(null);
                    setActiveView("create");
                    generateTransactionNumber();
                  }}
                  className="erp-btn-primary"
                >
                  <Plus className="w-5 h-5" />
                  <span>New sales order</span>
                </button>
              </Can>
              <button
                onClick={() => {
                  fetchCustomers();
                  fetchStockItems();
                  fetchTransactions();
                }}
                aria-label="Refresh"
                title="Refresh"
                className="grid h-10 w-10 place-items-center rounded-lg border border-input bg-card text-foreground transition-colors hover:bg-accent"
              >
                <RefreshCw className="w-5 h-5 text-foreground" />
              </button>
              <button
                type="button"
                aria-label="Settings"
                title="Settings"
                className="grid h-10 w-10 place-items-center rounded-lg border border-input bg-card text-foreground transition-colors hover:bg-accent"
              >
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
                    placeholder="Search by number, customer, reference or item..."
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
                  <option value="APPROVED">Approved</option>
                  <option value="INVOICED">Invoiced</option>
                </select>
                <select
                  value={customerFilter}
                  onChange={(e) => {
                    setCustomerFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2.5 rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                >
                  <option value="ALL">All Customers</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.customerName}
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
                {selectedSOs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    {canBulkApprove && <Can permission="sales.approve">
                      <button
                        onClick={() => handleBulkAction("confirm")}
                        className="flex items-center space-x-2 px-4 py-2 bg-card text-foreground rounded-lg hover:bg-accent transition-colors border border-input"
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                    </Can>}
                    {canBulkDelete && (
                      <Can permission="sales.delete">
                        <button
                          onClick={() => handleBulkAction("delete")}
                          className="flex items-center space-x-2 px-4 py-2 bg-card text-foreground rounded-lg hover:bg-accent transition-colors border border-input"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </Can>
                    )}
                    <button
                      onClick={() => handleBulkAction("export")}
                      className="flex items-center space-x-2 px-4 py-2 bg-card text-foreground rounded-lg hover:bg-accent transition-colors border border-input"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            <PeriodNote filter={periodFilter} count={periodRows.length} extra={filtersOn ? `${filteredSOs.length} match the search and filters` : undefined} noun="orders" one="order" limited={listInfo.truncated} className="mt-3" />
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
            {activeView === "list" && filteredSOs.length === 0 && (
              <ListEmpty
                filter={periodFilter}
                noun="sales orders"
                inPeriod={periodRows.length}
                filtered={filtersOn}
                onClearFilters={clearFilters}
                createText="Create the first one with New sales order."
              />
            )}
            {activeView === "list" && filteredSOs.length > 0 && (
              <>
                {wide && viewMode === "table" ? (
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
                    onDownloadInternal={(so) => downloadInvoiceCopy(so, 'Internal Copy')}
                    onDownloadCustomer={(so) => downloadInvoiceCopy(so, 'Customer Copy')}
                    onShowAudit={setAuditSO}
                    onSendDocument={setSendSO}
                    onDeliveryNote={(so) => navigate(`/delivery-notes?order=${so.id}`)}
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
                    onDownloadInternal={(so) => downloadInvoiceCopy(so, 'Internal Copy')}
                    onDownloadCustomer={(so) => downloadInvoiceCopy(so, 'Customer Copy')}
                    onShowAudit={setAuditSO}
                    onSendDocument={setSendSO}
                  />
                )}
                <ListPager
                  figures={pageView}
                  onPage={setCurrentPage}
                  onPageSize={(n) => { setItemsPerPage(n); setCurrentPage(1); }}
                  noun="orders"
                  one="order"
                  className="mt-4"
                />
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
      {sendSO && (() => {
        const { doc, attachment } = sendFor(sendSO);
        return (
          <SendDialog
            doc={doc} attachment={attachment} notify={addNotification} onClose={() => setSendSO(null)}
            onSent={(r) => setSalesOrders((rows) => rows.map((x) => (x.id === sendSO.id ? { ...x, lastSend: summaryOfSend(r.send) } : x)))}
          />
        );
      })()}
      {auditSO && (
        <DocumentAuditTrail
          id={auditSO.id}
          documentNo={auditSO.displayTransactionNo || auditSO.transactionNo}
          onClose={() => setAuditSO(null)}
        />
      )}
    </div>
  );
};

export default SalesOrderManagement;
