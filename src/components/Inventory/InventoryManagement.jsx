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
import StatCard from "../ui/stat-card";
import { Button } from "../ui/button";

import { DateInput, Field, Modal, Pill, Select, SearchSelect, Spinner, TextInput, Textarea, useToasts } from "../accounting/kit";
import { DataTable } from "../accounting/DataTable";

// The event-type badge used to be 8 literal Tailwind colours (bg-green-100 text-green-800...), none of them
// dark-mode aware. The direction (in/out) is already shown by the row's own coloured arrow, so the badge's
// job is only to label WHICH kind of event it was - mapped onto the product's one contrast-tested tone system
// rather than inventing a second palette.
const EVENT_TONE = {
  INITIAL_STOCK: "info",
  STOCK_ADJUSTMENT: "neutral",
  PURCHASE_RECEIVE: "success",
  SALES_DISPATCH: "info",
  PURCHASE_RETURN: "warning",
  SALES_RETURN: "warning",
  DAMAGED_STOCK: "danger",
  TRANSFER_IN: "success",
  TRANSFER_OUT: "neutral",
  PRODUCTION_ISSUE: "neutral",
  PRODUCTION_RECEIPT: "success",
};

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

// A labelled block in the Movement Details modal - that modal only shows a record, it never edits one, so
// these are plain labelled blocks rather than kit.Field (which is for a form control with a label).
const DetailField = ({ label, children, className }) => (
  <div className={className}>
    <p className="mb-1 text-sm font-semibold text-muted-foreground">{label}</p>
    {children}
  </div>
);

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
  const { notify, toastNode } = useToasts();
  const [isDraftSaved, setIsDraftSaved] = useState(() => Boolean(session.get("formData")));
  const [lastSaveTime, setLastSaveTime] = useState(() => session.get("lastSaveTime"));

  // a search is sent once the person pauses, not on every key
  const [askedSearch, setAskedSearch] = useState(searchTerm);
  useEffect(() => {
    const t = setTimeout(() => setAskedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

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
    // written by a production (Inventory > Production), never typed in here
    { value: "PRODUCTION_ISSUE", label: "Used in Production", color: "orange", system: true },
    { value: "PRODUCTION_RECEIPT", label: "Made in Production", color: "teal", system: true },
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

  const showToastMessage = useCallback((message, type = "success") => notify(message, type), [notify]);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
      setIsDraftSaved(false);
    },
    [errors]
  );
  // SearchSelect (the stock item picker: this list can run long, house rule in CLAUDE.md) hands back the
  // chosen value directly rather than an event - reuses handleChange's own logic through the same shape.
  const handleStockChange = useCallback((value) => handleChange({ target: { name: "stockId", value } }), [handleChange]);

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

  const getMovementIcon = useCallback((quantity) => {
    return quantity > 0 ? ArrowUpCircle : ArrowDownCircle;
  }, []);

  const getMovementColor = useCallback((quantity) => {
    return quantity > 0 ? "text-status-success" : "text-status-danger";
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
            <Button data-shortcut="new" onClick={() => setShowModal(true)}>
              <Plus size={18} aria-hidden="true" />
              Record Movement
            </Button>
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
        {isLoading && <Spinner label="Loading movements" />}

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
                    <Pill tone={EVENT_TONE[m.eventType] || "neutral"}>
                      {eventTypes.find((t) => t.value === m.eventType)?.label || m.eventType}
                    </Pill>
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
        <Modal
          size="lg"
          title="Record Movement"
          description="Create a new inventory movement"
          onClose={resetForm}
          footer={
            <>
              <div className="me-auto flex items-center text-sm text-muted-foreground">
                {isDraftSaved ? (
                  <span className="flex items-center text-status-success">
                    <CheckCircle2 size={14} className="mr-1" aria-hidden="true" />
                    Changes saved automatically
                  </span>
                ) : formData.stockId || formData.quantity || formData.referenceNumber ? (
                  <span className="flex items-center text-status-warning">
                    <Clock size={14} className="mr-1" aria-hidden="true" />
                    Unsaved changes
                  </span>
                ) : null}
              </div>
              <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                {isSubmitting ? "Recording..." : "Record Movement"}
              </Button>
            </>
          }
        >
          {isDraftSaved && lastSaveTime && (
            <p className="mb-4 flex items-center text-sm text-status-success">
              <CheckCircle2 size={12} className="mr-1" aria-hidden="true" />
              Draft saved {formatLastSaveTime(lastSaveTime)}
            </p>
          )}
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Stock Item" required error={errors.stockId}>
                <SearchSelect autoFocus value={formData.stockId} onChange={handleStockChange} placeholder="Select stock item" options={stockItems.map((item) => ({ value: item._id, label: `${item.itemName} (${item.sku})` }))} />
              </Field>
              <Field label="Quantity" required error={errors.quantity} hint="Positive to add stock, negative to remove it">
                <TextInput type="number" name="quantity" value={formData.quantity} onChange={handleChange} placeholder="Enter quantity" />
              </Field>
              <Field label="Event Type" required>
                <Select name="eventType" value={formData.eventType} onChange={handleChange}>
                  {eventTypes.filter((type) => !type.system).map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Reference Number" required error={errors.referenceNumber}>
                <TextInput name="referenceNumber" value={formData.referenceNumber} onChange={handleChange} placeholder="e.g., PO-2024-001" />
              </Field>
              <Field label={`Unit Cost (${CURRENCY})`} error={errors.unitCost}>
                <TextInput type="number" name="unitCost" value={formData.unitCost} onChange={handleChange} placeholder="0.00" step="0.01" min="0" />
              </Field>
              <Field label="Location">
                <TextInput name="location" value={formData.location} onChange={handleChange} placeholder="MAIN" />
              </Field>
              <Field label="Batch Number">
                <TextInput name="batchNumber" value={formData.batchNumber} onChange={handleChange} placeholder="Optional batch number" />
              </Field>
              <Field label="Expiry Date">
                <DateInput name="expiryDate" value={formData.expiryDate} onChange={handleChange} />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea name="notes" value={formData.notes} onChange={handleChange} placeholder="Additional notes or comments..." rows={3} />
            </Field>
          </div>
        </Modal>
      )}

      {/* Movement Details Modal */}
      {showDetailsModal && selectedMovement && (
        <Modal
          size="lg"
          title="Movement Details"
          onClose={() => setShowDetailsModal(false)}
          footer={<Button variant="outline" onClick={() => setShowDetailsModal(false)}>Close</Button>}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <DetailField label="Item Information">
                <div className="flex items-center space-x-3 rounded-lg bg-secondary p-3">
                  <Package size={20} className="text-muted-foreground" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-foreground">{selectedMovement.itemName || selectedMovement.stockId}</p>
                    <p className="text-sm text-muted-foreground">ID: {selectedMovement.stockId}</p>
                  </div>
                </div>
              </DetailField>

              <DetailField label="Movement Details">
                <div className="rounded-lg bg-secondary p-3">
                  <div className="mb-2 flex items-center space-x-2">
                    {selectedMovement.quantity > 0 ? <ArrowUpCircle size={20} className="text-status-success" aria-hidden="true" /> : <ArrowDownCircle size={20} className="text-status-danger" aria-hidden="true" />}
                    <span className={`text-lg font-bold ${selectedMovement.quantity > 0 ? "text-status-success" : "text-status-danger"}`}>
                      {selectedMovement.quantity > 0 ? "+" : ""}{selectedMovement.quantity}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">Stock changed from {selectedMovement.previousStock} to {selectedMovement.newStock}</p>
                </div>
              </DetailField>

              <DetailField label="Event Type">
                <Pill tone={EVENT_TONE[selectedMovement.eventType] || "neutral"}>
                  {eventTypes.find((t) => t.value === selectedMovement.eventType)?.label || selectedMovement.eventType}
                </Pill>
              </DetailField>

              <DetailField label="Reference Number">
                <div className="flex items-center space-x-2 rounded-lg bg-secondary p-3">
                  <FileText size={16} className="text-muted-foreground" aria-hidden="true" />
                  <span className="font-mono text-sm text-foreground">{selectedMovement.referenceNumber}</span>
                </div>
              </DetailField>
            </div>

            <div className="space-y-4">
              <DetailField label="Financial Information">
                <div className="space-y-2 rounded-lg bg-secondary p-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Unit Cost:</span>
                    <span className="font-semibold text-foreground">{formatCurrency(selectedMovement.unitCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Value:</span>
                    <span className={`font-bold ${signedValue(selectedMovement) < 0 ? "text-status-danger" : "text-status-success"}`}>
                      {signText(signedValue(selectedMovement))}
                      {formatCurrency(Math.abs(signedValue(selectedMovement)))}
                    </span>
                  </div>
                </div>
              </DetailField>

              <DetailField label="Location">
                <div className="flex items-center space-x-2 rounded-lg bg-secondary p-3">
                  <MapPin size={16} className="text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm text-foreground">{selectedMovement.location}</span>
                </div>
              </DetailField>

              <DetailField label="Recorded By">
                <div className="flex items-center space-x-2 rounded-lg bg-secondary p-3">
                  <User size={16} className="text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm text-foreground">{whoText(selectedMovement)}</span>
                </div>
              </DetailField>

              <DetailField label="Date">
                <div className="flex items-center space-x-2 rounded-lg bg-secondary p-3">
                  <Calendar size={16} className="text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm text-foreground">{formatDate(selectedMovement.date)}</span>
                </div>
                {selectedMovement.createdAt && <p className="mt-1 text-xs text-muted-foreground">Recorded {formatRecorded(selectedMovement.createdAt)}</p>}
              </DetailField>
            </div>
          </div>

          {selectedMovement.notes && (
            <DetailField label="Notes" className="mt-6">
              <div className="rounded-lg bg-secondary p-3">
                <p className="text-sm text-foreground">{selectedMovement.notes}</p>
              </div>
            </DetailField>
          )}
        </Modal>
      )}

      {toastNode}
    </div>
  );
};

export default InventoryManagement;