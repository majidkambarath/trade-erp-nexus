import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  Plus,
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
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import { decimalRound, downloadCSV, formatDate as formatDay, formatDateTime, formatTime, formatCurrencyAED, CURRENCY } from "../../utils/format";
import { DEFAULT_PAGE_SIZE, pageFigures } from "../../lib/pagination";
import { pageSession } from "../../lib/pageSession";
import ListPager from "../lists/ListPager";
import FilterBar, { FilterSelect } from "../lists/FilterBar";
import { PeriodNote, PeriodSelect } from "../lists/PeriodFilter";
import { usePeriodFilter } from "../lists/usePeriodFilter";
import { toastClasses } from "../../lib/status";
import StatCard from "../ui/stat-card";

import { DateInput } from "../accounting/kit";
import { DataTable } from "../accounting/DataTable";

// What this screen keeps while the person visits another page and comes back (lib/pageSession.js): the search, the two choices,
// the period, and a half-filled movement form. Held in memory for the tab; emptied at sign-out.
const session = pageSession("inventory-movements");

// The server compares `date <= endDate` on the instant, so a bare day would stop at that day's midnight and drop the day's own
// movements: the end of a range is the end of that day.
const endOfDay = (day) => (day ? `${day}T23:59:59.999Z` : "");

// A movement's `totalValue` is the cost that moved and is stored positive both ways; what it is worth to the books has the
// direction of the quantity (server: services/stock/inventoryMovementService.js).
const signedValue = (m) => Math.sign(Number(m.quantity) || 0) * Math.abs(Number(m.totalValue) || 0);
const signText = (n) => (n > 0 ? "+" : n < 0 ? "−" : "");
// The server sends the person's NAME. An account that no longer exists has none, and its raw id is never shown in its place.
const whoText = (m) => m.createdByName || "Unknown user";

const InventoryManagement = () => {
  const [movements, setMovements] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState(null);
  // the search and the two choices come back as the person left them; the period opens on this calendar month, like every list
  const [kept] = useState(() => session.get("filters", {}));
  const [searchTerm, setSearchTerm] = useState(() => session.get("searchTerm", "") || "");
  const [filterEventType, setFilterEventType] = useState(kept.eventType || "");
  const [filterMovementType, setFilterMovementType] = useState(kept.movementType || "");
  const periodFilter = usePeriodFilter({ restore: kept.period });
  const { period } = periodFilter;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalRows, setTotalRows] = useState(0);
  const [stats, setStats] = useState({
    totalMovements: 0,
    stockIn: 0,
    stockOut: 0,
    valueIn: 0,
    valueOut: 0,
    totalValue: 0,
    recentMovements: 0,
  });
  const [formData, setFormData] = useState(() => {
    const draft = session.get("formData");
    return draft && Object.values(draft).some((val) => val)
      ? draft
      : {
          stockId: "",
          quantity: "",
          eventType: "STOCK_ADJUSTMENT",
          referenceNumber: "",
          unitCost: "",
          notes: "",
          batchNumber: "",
          expiryDate: "",
          location: "MAIN",
        };
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [isDraftSaved, setIsDraftSaved] = useState(() => Boolean(session.get("formData")));
  const [lastSaveTime, setLastSaveTime] = useState(() => session.get("lastSaveTime"));

  // a search is sent once the person pauses, not on every key
  const [askedSearch, setAskedSearch] = useState(searchTerm);
  useEffect(() => {
    const t = setTimeout(() => setAskedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const formRef = useRef(null);
  const autoSaveInterval = useRef(null);

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
    if (showModal && Object.values(formData).some((val) => val)) {
      autoSaveInterval.current = setTimeout(() => {
        session.set("formData", formData);
        session.set("lastSaveTime", new Date().toISOString());
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
    session.set("searchTerm", searchTerm);
    session.set("filters", {
      eventType: filterEventType,
      movementType: filterMovementType,
      period: { preset: periodFilter.preset, from: periodFilter.from, to: periodFilter.to },
    });
  }, [searchTerm, filterEventType, filterMovementType, periodFilter.preset, periodFilter.from, periodFilter.to]);

  const fetchStockItems = useCallback(async () => {
    try {
      // a movement changes a quantity on hand, so only goods are offered (a service has none)
      const response = await axiosInstance.get("/stock/stock", { params: { itemType: "goods" } });
      setStockItems(response.data.data?.stocks || []);
    } catch (error) {
      console.error("Error fetching stock items:", error);
      showToastMessage("Failed to fetch stock items", "error");
    }
  }, []);

  const movementRequest = useRef(0);
  const fetchMovements = useCallback(async (showRefreshIndicator = false) => {
    const ask = ++movementRequest.current;
    setIsLoading(showRefreshIndicator ? false : true);
    try {
      const params = {
        page,
        limit: pageSize,
        search: askedSearch || undefined,
        eventType: filterEventType || undefined,
        movementType: filterMovementType || undefined,
        startDate: period.from || undefined,
        endDate: endOfDay(period.to) || undefined,
      };
      const response = await axiosInstance.get("/inventory/inventory", { params });
      if (ask !== movementRequest.current) return;
      setMovements(response.data.data?.movements || []);
      setTotalRows(Number(response.data.total) || 0);
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
      if (ask === movementRequest.current) setIsLoading(false);
    }
  }, [page, pageSize, askedSearch, filterEventType, filterMovementType, period.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStats = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/inventory/inventory/stats", {
        params: {
          startDate: period.from || undefined,
          endDate: endOfDay(period.to) || undefined,
        },
      });
      setStats(response.data.data?.stats || {
        totalMovements: 0,
        stockIn: 0,
        stockOut: 0,
        valueIn: 0,
        valueOut: 0,
        totalValue: 0,
        recentMovements: 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      showToastMessage("Failed to fetch statistics", "error");
    }
  }, [period.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // each is asked for on its own: a new search must not fetch the item list again, nor the cards when only the page changed
  useEffect(() => { fetchStockItems(); }, [fetchStockItems]);
  useEffect(() => { fetchMovements(); }, [fetchMovements]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // a new search, filter, range or page size starts at the first page, and a page that no longer exists falls back to the last
  const pageInfo = pageFigures({ page, size: pageSize, total: totalRows });
  useEffect(() => {
    setPage(1);
  }, [askedSearch, filterEventType, filterMovementType, period.key, pageSize]);
  useEffect(() => {
    if (!isLoading && page > pageInfo.pages) setPage(pageInfo.pages);
  }, [isLoading, page, pageInfo.pages]);
  const filtersOn = Boolean(searchTerm || filterEventType || filterMovementType);
  const clearFilters = () => {
    setSearchTerm("");
    setFilterEventType("");
    setFilterMovementType("");
  };

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
    session.remove("formData");
    session.remove("lastSaveTime");
  }, []);

  // Money is written the same way across the product: in the organisation's currency, as text ("AED 1,234.50" by default), never an icon.
  const formatCurrency = useCallback(
    (amount, colorClass = "") => (
      <span className={`whitespace-nowrap tabular-nums ${colorClass}`}>
        {formatCurrencyAED(Number(amount) || 0)}
      </span>
    ),
    []
  );

  // A movement's date is a DAY (a document's date is stored at midnight, which would read "04:00" in Dubai and mean nothing).
  // When it was recorded is a moment, and the details say so separately.
  const formatDate = useCallback((dateString) => (dateString ? formatDay(dateString) || "N/A" : "N/A"), []);
  const formatRecorded = useCallback((stamp) => (stamp ? formatDateTime(stamp) || "N/A" : "N/A"), []);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return "";
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    return formatTime(time);
  }, []);

  const showMovementDetails = useCallback((movement) => {
    setSelectedMovement(movement);
    setShowDetailsModal(true);
  }, []);

  const handleExport = useCallback(async () => {
    try {
      downloadCSV(
        "inventory_movements_export.csv",
        [
          "MovementID",
          "StockID",
          "ItemName",
          "Quantity",
          "EventType",
          "ReferenceNumber",
          "UnitCost",
          "Value",
          "Location",
          "Date",
          "RecordedBy",
        ],
        movements.map((m) => [
          m._id,
          m.stockId,
          m.itemName || m.stockId,
          m.quantity,
          m.eventType,
          m.referenceNumber,
          decimalRound(m.unitCost),
          decimalRound(signedValue(m)),
          m.location,
          formatDay(m.date),
          whoText(m),
        ])
      );

      showToastMessage("Inventory movements exported successfully!", "success");
    } catch {
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Movements</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every change to stock on hand, newest first.</p>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            type="button"
            onClick={handleExport}
            className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Export to CSV"
            aria-label="Export to CSV"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast.visible && (
        <div
          className={`fixed end-4 bottom-4 z-[70] ${toastClasses(showToast.type)}`}
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
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-5 mb-8">
        {[
          {
            title: "Total Movements",
            count: stats.totalMovements,
            icon: <Activity size={24} />,
          },
          {
            title: "Stock In",
            count: stats.stockIn,
            icon: <ArrowUpCircle size={24} />,
          },
          {
            title: "Stock Out",
            count: stats.stockOut,
            icon: <ArrowDownCircle size={24} />,
          },
          {
            // what came in less what went out, at cost: the two halves are said under it so the figure can be checked
            title: "Net Value",
            count: formatCurrency(stats.totalValue),
            subText: `In ${formatCurrencyAED(Number(stats.valueIn) || 0)} · Out ${formatCurrencyAED(Number(stats.valueOut) || 0)}`,
            fit: true,
            icon: <BarChart3 size={24} />,
          },
          {
            title: "Recent (24h)",
            count: stats.recentMovements,
            icon: <Clock size={24} />,
          },
        ].map((card, index) => (
          <StatCard
              key={index}
              title={card.title}
              count={card.count}
              icon={card.icon}
              subText={card.subText}
              fit={card.fit}
              tone={["teal", "plum", "olive", "rose"][index % 4]}
              onClick={card.onClick}
            />
          ))}
      </div>

      {/* Main Content */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-4 sm:p-6">
          <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Movement History</h2>
              <p className="mt-1 text-sm text-muted-foreground">Track all inventory movements and changes</p>
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
              className="erp-btn-primary"
            >
              <Plus size={18} />
              Record Movement
            </button>
          </div>

          {/* Filters: always showing, the same row every list of the product has (components/lists/FilterBar.jsx) */}
          <FilterBar
            search={searchTerm}
            onSearch={setSearchTerm}
            searchLabel="Search movements"
            placeholder="Search item or reference…"
            active={filtersOn}
            onClear={clearFilters}
          >
            <FilterSelect
              label="Event type"
              value={filterEventType}
              onChange={setFilterEventType}
              allLabel="All event types"
              options={eventTypes.map((t) => [t.value, t.label])}
            />
            <FilterSelect
              label="Direction"
              value={filterMovementType}
              onChange={setFilterMovementType}
              allLabel="In and out"
              options={[["IN", "Stock in"], ["OUT", "Stock out"]]}
              className="sm:w-40"
            />
            <PeriodSelect filter={periodFilter} labelled />
          </FilterBar>
          <PeriodNote
            filter={periodFilter}
            count={totalRows}
            noun="movements"
            one="movement"
            extra={filtersOn ? "filtered" : undefined}
            className="mt-3"
          />
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
            <DataTable
              caption="Stock movements"
              rows={movements}
              rowKey={(movement) => movement._id}
              columns={[
                {
                  key: "item", header: "Item Details", card: "primary",
                  cell: (m) => (
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Package size={16} className="text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate font-semibold text-foreground">{m.itemName || m.stockId}</span>
                        <span className="block text-sm font-normal text-muted-foreground">ID: {m.stockId}</span>
                      </div>
                    </div>
                  ),
                },
                {
                  key: "movement", header: "Movement", card: "title",
                  cell: (m) => {
                    const MovementIcon = getMovementIcon(m.quantity);
                    const movementColor = getMovementColor(m.quantity);
                    return (
                      <div className="flex items-center space-x-2">
                        <MovementIcon size={20} className={movementColor} />
                        <div>
                          <span className={`block font-bold ${movementColor}`}>{m.quantity > 0 ? "+" : ""}{m.quantity}</span>
                          <span className="block text-xs text-muted-foreground">Stock: {m.previousStock} &rarr; {m.newStock}</span>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: "eventType", header: "Event Type", card: "badge",
                  cell: (m) => (
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getEventTypeBadge(m.eventType)}`}>
                      {eventTypes.find((t) => t.value === m.eventType)?.label || m.eventType}
                    </span>
                  ),
                },
                {
                  key: "reference", header: "Reference", card: "meta",
                  cell: (m) => (
                    <div className="flex items-center space-x-2">
                      <FileText size={16} className="text-gray-400" />
                      <span className="font-mono text-sm text-gray-900">{m.referenceNumber}</span>
                    </div>
                  ),
                },
                {
                  key: "date", header: "Date & User", card: "meta",
                  cell: (m) => (
                    <div className="flex flex-col gap-y-1">
                      <span className="flex items-center gap-2">
                        <Calendar size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="whitespace-nowrap text-sm text-foreground">{formatDate(m.date)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <User size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="text-sm text-muted-foreground">{whoText(m)}</span>
                      </span>
                    </div>
                  ),
                },
                {
                  // worth what the books say: negative when stock went out (the stored cost is positive both ways)
                  key: "value", header: "Value", align: "end", card: "amount",
                  cell: (m) => {
                    const worth = signedValue(m);
                    const tone = worth < 0 ? "text-status-danger" : "text-status-success";
                    return (
                      <div className="text-right">
                        <span className={`block font-semibold ${tone}`}>
                          {signText(worth)}
                          {formatCurrency(Math.abs(worth), tone)}
                        </span>
                        <span className="block text-xs font-normal text-muted-foreground">{formatCurrency(m.unitCost)} each</span>
                      </div>
                    );
                  },
                },
                {
                  key: "actions", header: "Actions", align: "center", card: "actions",
                  cell: (m) => (
                    <div className="flex items-center justify-center space-x-2">
                      <button type="button" onClick={() => showMovementDetails(m)} className="grid h-11 w-11 place-items-center rounded-lg text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground lg:h-9 lg:w-9" title="View Details" aria-label={`View details of ${m.referenceNumber}`}>
                        <Eye size={16} />
                      </button>
                    </div>
                  ),
                },
              ]}
            />

            {movements.length === 0 && (
              <div className="text-center py-12">
                <Activity size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-foreground">
                  {filtersOn ? "No movements match the search or filters" : period.all ? "No inventory movements yet" : `No inventory movements in ${period.label.toLowerCase()}`}
                </p>
                <p className="text-muted-foreground text-sm">
                  {filtersOn
                    ? "Clear the search and filters, or widen the period."
                    : period.all
                      ? "Record a movement to start the history."
                      : "Widen the period to see earlier ones, or record a new movement."}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {filtersOn && (
                    <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-accent">
                      Clear search and filters
                    </button>
                  )}
                  {!period.all && (
                    <button type="button" onClick={() => periodFilter.choose("all")} className="inline-flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-accent">
                      Show all time
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && movements.length > 0 && (
          <ListPager
            figures={pageInfo}
            onPage={setPage}
            onPageSize={setPageSize}
            noun="movements"
            one="movement"
            className="rounded-none border-0 border-t shadow-none"
          />
        )}
      </div>

      {/* Add Movement Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto">
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
                    {`Unit Cost (${CURRENCY})`}
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
                  <DateInput
                    name="expiryDate"
                    aria-label="Expiry date"
                    value={formData.expiryDate}
                    onChange={handleChange}
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
                    <span className="flex items-center text-status-warning">
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
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto">
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
                          className={`font-bold ${signedValue(selectedMovement) < 0 ? "text-status-danger" : "text-status-success"}`}
                        >
                          {signText(signedValue(selectedMovement))}
                          {formatCurrency(Math.abs(signedValue(selectedMovement)))}
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
                      Recorded By
                    </label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <User size={16} className="text-gray-400" />
                      <span className="text-sm">{whoText(selectedMovement)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">
                      Date
                    </label>
                    <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                      <Calendar size={16} className="text-gray-400" />
                      <span className="text-sm">{formatDate(selectedMovement.date)}</span>
                    </div>
                    {selectedMovement.createdAt && (
                      <p className="mt-1 text-xs text-gray-500">Recorded {formatRecorded(selectedMovement.createdAt)}</p>
                    )}
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