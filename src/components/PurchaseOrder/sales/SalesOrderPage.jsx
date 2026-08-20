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
    transactionNoMode: "AUTO",
    partyId: "",
    partyName: "",
    date: new Date().toISOString().slice(0, 10),
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
      // DEBUG: Log raw backend rows for LPO/DOC/Discount audit
      //console.log("[FETCH SO LIST] rows:", transactions.map(t => ({ id: t._id, lpono: t.lpono ?? t.refNo, docno: t.docno ?? t.docNo, discount: t.discount })));
      console.log("Transaction Fetch from backend "+transactions);
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
  } catch (e) {
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
      createdAt: t.createdAt,
      invoiceGenerated: t.invoiceGenerated,
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
      refNo: so.refNo || "",
      docNo: so.docNo || "",
      discount: (so.discount ?? 0).toString(),
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
        return "bg-secondary text-muted-foreground border-border";
      case "APPROVED":
        return "bg-foreground text-background border-foreground";
      case "INVOICED":
        return "bg-secondary text-muted-foreground border-border";
      default:
        return "bg-secondary text-muted-foreground border-border";
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
        return "bg-foreground";
      case "Medium":
        return "bg-[var(--highlight)]";
      case "Low":
        return "bg-muted-foreground";
      default:
        return "bg-muted-foreground";
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
    const tx = so?.displayTransactionNo || so?.transactionNo || "";
    return `${tx},${so.customerName},${so.date},${so.deliveryDate},${so.status},${so.totalAmount},${so.priority}`;
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

  // Generate invoice PDF for a given SO and copy type from the list views
  const downloadInvoiceCopy = async (so, copyType) => {
    try {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm';
      container.style.height = '297mm';
      container.id = 'print-root';
      document.body.appendChild(container);

      const root = document.createElement('div');
      root.id = 'invoice-content';
      container.appendChild(root);

      // Render minimal invoice HTML using current InvoiceView approach is heavy; instead snapshot current page content area
      // We mimic InvoiceView by navigating data into a temporary node
      const el = document.createElement('div');
      el.innerHTML = document.querySelector('#invoice-content')?.outerHTML || '';

      // Fallback: if no invoice-content in DOM, inform user
      if (!el.innerHTML) {
        // Dynamically import html2canvas/jsPDF and build from a lightweight template using SO data
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');

        const temp = document.createElement('div');
        temp.style.width = '210mm';
        temp.style.padding = '10mm';
        temp.style.background = '#fff';
        temp.style.fontFamily = 'Arial,Helvetica,sans-serif';
        temp.id = 'invoice-content';
        temp.innerHTML = `<div id="copy-label" style="text-align:right;font-weight:bold;margin-bottom:9px">${copyType}</div>
          <div style="text-align:center;font-weight:800;margin-bottom:8px">${so.displayTransactionNo || so.transactionNo}</div>`;
        container.innerHTML = '';
        container.appendChild(temp);

        const canvas = await html2canvas(temp, { scale: 3, useCORS: true, backgroundColor: '#fff' });
        const img = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfW = 210, pdfH = 297;
        const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height);
        const w = canvas.width * ratio, h = canvas.height * ratio;
        pdf.addImage(img, 'PNG', (pdfW - w) / 2, (pdfH - h) / 2, w, h);
        const fname = `${so.status === 'APPROVED' ? 'INV' : 'SO'}_${(so.displayTransactionNo || so.transactionNo)}_${copyType.replace(/\s+/g, '_')}.pdf`;
        pdf.save(fname);
        document.body.removeChild(container);
        return;
      }

      // If an invoice-content exists in DOM, use it directly
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const copyLabel = document.getElementById('copy-label');
      if (copyLabel) copyLabel.innerText = copyType;
      await new Promise(r => setTimeout(r, 80));
      const node = document.getElementById('invoice-content');
      const canvas = await html2canvas(node, { scale: 3, useCORS: true, backgroundColor: '#fff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfW = 210, pdfH = 297;
      const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height);
      const w = canvas.width * ratio, h = canvas.height * ratio;
      pdf.addImage(img, 'PNG', (pdfW - w) / 2, (pdfH - h) / 2, w, h);
      const fname = `${so.status === 'APPROVED' ? 'INV' : 'SO'}_${(so.displayTransactionNo || so.transactionNo)}_${copyType.replace(/\s+/g, '_')}.pdf`;
      pdf.save(fname);
      if (copyLabel) copyLabel.innerText = 'Customer Copy';
      document.body.removeChild(container);
    } catch (e) {
      addNotification('Failed to generate PDF', 'error');
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
        <div className="bg-card rounded-[1.35rem] p-6 border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Orders</p>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                {statistics.total}
              </p>
              <div className="flex items-center mt-2">
                {statistics.growthRate >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-foreground mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-muted-foreground mr-1" />
                )}
                <span className="text-sm font-medium text-muted-foreground">
                  {Math.abs(statistics.growthRate).toFixed(1)}% from last month
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-foreground" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-[1.35rem] p-6 border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Approved</p>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                {statistics.confirmed}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Ready for dispatch</p>
            </div>
            <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-foreground" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-[1.35rem] p-6 border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Value</p>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                AED {statistics.totalValue.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Invoiced: AED {statistics.invoicedValue.toLocaleString()}
              </p>
            </div>
            <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-foreground" />
            </div>
          </div>
        </div>
        <div className="bg-card rounded-[1.35rem] p-6 border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">This Month</p>
              <p className="text-3xl font-extrabold tracking-tight text-foreground">
                {statistics.thisMonthSOs}
              </p>
              <p className="text-sm text-muted-foreground mt-2">New orders created</p>
            </div>
            <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-foreground" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-[1.75rem] p-6 border border-border shadow-[var(--shadow-card)]">
          <h3 className="text-lg font-extrabold text-foreground mb-4">
            Recent Sales Orders
          </h3>
          <div className="space-y-3">
            {salesOrders.slice(0, 5).map((so) => (
              <div
                key={so.id}
                className="flex items-center justify-between py-3 px-4 bg-secondary rounded-full hover:bg-muted transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${getPriorityColor(
                      so.priority
                    )}`}
                  ></div>
                  <div>
                    <p className="font-semibold text-foreground">
                     {so.displayTransactionNo || so.transactionNo}
                    </p>

                    <p className="text-sm text-muted-foreground">{so.customerName}</p>
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
                  <p className="text-sm text-muted-foreground mt-1">
                    AED {parseFloat(so.totalAmount).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setActiveView("list")}
            className="w-full mt-4 py-2 text-foreground hover:opacity-80 font-semibold text-sm"
          >
            View All Orders →
          </button>
        </div>

        <div className="bg-card rounded-[1.75rem] p-6 border border-border shadow-[var(--shadow-card)]">
          <h3 className="text-lg font-extrabold text-foreground mb-4">
            Status Overview
          </h3>
          <div className="space-y-4">
            {[
              { label: "Approved", value: statistics.confirmed },
              { label: "Invoiced", value: statistics.invoiced },
              { label: "Draft", value: statistics.draft },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-xs font-medium text-foreground">
                    {row.value}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground transition-all duration-500 ease-out"
                    style={{
                      width: `${
                        (row.value / statistics.total) * 100 || 0
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const Pagination = () => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredSOs.length);

    return (
      <div className="flex items-center justify-between bg-card rounded-[1.35rem] px-6 py-4 border border-border shadow-[var(--shadow-card)]">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">
            Showing {startItem} to {endItem} of {filteredSOs.length} orders
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-1 border border-border rounded-full text-sm bg-background text-foreground"
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
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className={`px-3 py-2 text-sm rounded-full transition-colors ${
                    currentPage === pageNum
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary"
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
            className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <NotificationList />
      <div className="relative bg-card border-b border-border">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <ShoppingCart className="w-8 h-8 text-foreground" />
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                  Sales Order Management
                </h1>
                <p className="text-muted-foreground mt-1">
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
                className="erp-btn-primary"
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
                className="p-3 bg-secondary rounded-full hover:bg-muted transition-colors"
              >
                <RefreshCw className="w-5 h-5 text-foreground" />
              </button>
              <button className="p-3 bg-secondary rounded-full hover:bg-muted transition-colors">
                <Settings className="w-5 h-5 text-foreground" />
              </button>
            </div>
          </div>
        </div>

        {(activeView === "dashboard" || activeView === "list") && (
          <div className="px-8 py-4 bg-secondary/60 border-t border-border">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by SO number, customer, or user..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-80 pl-10 pr-4 py-3 bg-background rounded-full border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-transparent"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-background rounded-full border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-transparent"
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
                  className="px-4 py-3 bg-background rounded-full border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-transparent"
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
                  className="px-4 py-3 bg-background rounded-full border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-transparent"
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
                  className={`p-3 rounded-full transition-colors ${
                    activeView === "dashboard"
                      ? "bg-foreground text-background"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setViewMode("table");
                    setActiveView("list");
                  }}
                  className={`p-3 rounded-full transition-colors ${
                    viewMode === "table" && activeView === "list"
                      ? "bg-foreground text-background"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <List className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setViewMode("grid");
                    setActiveView("list");
                  }}
                  className={`p-3 rounded-full transition-colors ${
                    viewMode === "grid" && activeView === "list"
                      ? "bg-foreground text-background"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Grid className="w-5 h-5" />
                </button>
                {selectedSOs.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleBulkAction("confirm")}
                      className="flex items-center space-x-2 px-4 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleBulkAction("delete")}
                      className="flex items-center space-x-2 px-4 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                    <button
                      onClick={() => handleBulkAction("export")}
                      className="flex items-center space-x-2 px-4 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
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
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-foreground"></div>
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
                    onDownloadInternal={(so) => downloadInvoiceCopy(so, 'Internal Copy')}
                    onDownloadCustomer={(so) => downloadInvoiceCopy(so, 'Customer Copy')}
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
