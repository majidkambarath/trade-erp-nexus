import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Barcode,
  Tag,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Box,
  CheckCircle,
  XCircle,
  AlertCircle,
  Truck,
  Globe,
  Star,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import BarcodeGenerator from "react-barcode";

import { formatDate, formatCurrencyAED } from "../../utils/format";
import { isService } from "../../lib/itemTypes";
import { taxWord } from "../../lib/taxTerms";
import { Button } from "../ui/button";
import { ErrorNote, Panel, Pill, Spinner } from "../accounting/kit";

// A service's income / expense account as the item detail returns it (populated), else the company default.
const accountText = (account, fallback) => (account?.accountName ? `${account.accountCode ? `${account.accountCode} ` : ""}${account.accountName}` : fallback);

const formatCurrency = (amount) => <span className="whitespace-nowrap tabular-nums">{formatCurrencyAED(Number(amount) || 0)}</span>;

const stockStatusOf = (currentStock, reorderLevel) => {
  if (currentStock <= reorderLevel) return { tone: "text-status-danger", icon: AlertTriangle, label: "Low Stock" };
  if (currentStock <= reorderLevel * 2) return { tone: "text-status-warning", icon: TrendingDown, label: "Medium Stock" };
  return { tone: "text-status-success", icon: TrendingUp, label: "Good Stock" };
};

const expiryStatusOf = (expiryDate) => {
  if (!expiryDate) return { tone: "text-muted-foreground", label: "N/A" };
  const diffDays = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { tone: "text-status-danger", label: "Expired" };
  if (diffDays <= 30) return { tone: "text-status-warning", label: "Expiring Soon" };
  return { tone: "text-status-success", label: "Valid" };
};

// A plain label/value pair for a read-only field - this screen shows a record, it never edits one, so
// these are not kit.Field (which is for a form control with a label).
const Info = ({ icon: Icon, label, children }) => (
  <div>
    <p className="flex items-center text-sm font-medium text-muted-foreground">
      {Icon && <Icon size={16} className="mr-2 text-muted-foreground" aria-hidden="true" />}
      {label}
    </p>
    <p className="mt-1 text-foreground">{children ?? "N/A"}</p>
  </div>
);

const StockDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stockItem, setStockItem] = useState(null);
  const [purchaseLogs, setPurchaseLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchaseLogsLoading, setIsPurchaseLogsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchaseLogsError, setPurchaseLogsError] = useState(null);

  const fetchStockItem = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get(`/stock/stock/${id}`);
      setStockItem(response.data.data.stock);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch stock item details.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchPurchaseLogs = useCallback(async () => {
    setIsPurchaseLogsLoading(true);
    try {
      const response = await axiosInstance.get(`/stock/stock/${id}/purchase-logs`);
      setPurchaseLogs(response.data.data?.purchaseLogs || []);
    } catch (err) {
      setPurchaseLogsError(err.response?.data?.message || "Failed to fetch purchase logs.");
    } finally {
      setIsPurchaseLogsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStockItem();
    fetchPurchaseLogs();
  }, [fetchStockItem, fetchPurchaseLogs]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <Spinner label="Loading stock item" />
      </div>
    );
  }

  if (error || !stockItem) {
    return (
      <div className="mx-auto max-w-md p-4 sm:p-6 lg:p-8">
        <ErrorNote error={{ message: error || "Stock item not found." }} />
        <Button className="mt-4" onClick={() => navigate("/stock-management")}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Stock Management
        </Button>
      </div>
    );
  }

  // A service has no quantity, reorder level, batch or expiry: no stock card, and no "low stock" alert (0 <= 0).
  const service = isService(stockItem);
  const stockStatus = stockStatusOf(stockItem.currentStock, stockItem.reorderLevel);
  const expiryStatus = service ? { tone: "text-muted-foreground", label: "N/A" } : expiryStatusOf(stockItem.expiryDate);
  const showAlerts = !service && (stockStatus.label === "Low Stock" || expiryStatus.label === "Expired" || expiryStatus.label === "Expiring Soon");

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="grid h-10 w-10 place-items-center rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {stockItem.itemName}
            {service && <Pill tone="info" className="ms-3 align-middle">Service</Pill>}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">SKU: {stockItem.sku}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <Panel className="lg:col-span-2" title="Basic Information">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <Info icon={Tag} label="Category">{stockItem.category?.name}</Info>
            <Info icon={Barcode} label="SKU">{stockItem.sku}</Info>
            <Info icon={Truck} label="Vendor">{stockItem.vendorId?.vendorName}</Info>
            <Info icon={Box} label="Unit of Measure">{stockItem.unitOfMeasure?.unitName}</Info>
            {!service && (
              <>
                <Info icon={Globe} label="Origin">{stockItem.origin}</Info>
                <Info icon={Star} label="Brand">{stockItem.brand}</Info>
              </>
            )}
          </div>
          {!service && stockItem.barcodeQrCode && (
            <div className="mt-6">
              <p className="flex items-center text-sm font-medium text-muted-foreground">
                <Barcode size={16} className="mr-2 text-muted-foreground" aria-hidden="true" />
                Barcode/QR Code
              </p>
              <div className="mt-2 rounded-lg bg-background p-3">
                <BarcodeGenerator value={stockItem.barcodeQrCode || stockItem.sku} format="CODE128" width={2} height={50} fontSize={12} background="transparent" />
              </div>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          {service ? (
            <Panel title="Service">
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">Not stocked: invoicing it moves no stock and has no cost of goods.</p>
                <Info label="Income account">{accountText(stockItem.incomeAccountId, "Company default (Sales revenue)")}</Info>
                <Info label="Expense account">{accountText(stockItem.expenseAccountId, "Company default (Services purchased)")}</Info>
              </div>
            </Panel>
          ) : (
            <Panel title="Stock Information">
              <div className="space-y-5">
                <div>
                  <p className="flex items-center text-sm font-medium text-muted-foreground">
                    <stockStatus.icon size={16} className={`mr-2 ${stockStatus.tone}`} aria-hidden="true" />
                    Stock Status
                  </p>
                  <p className={`mt-1 font-medium ${stockStatus.tone}`}>{stockItem.currentStock} ({stockStatus.label})</p>
                  <p className="mt-1 text-xs text-muted-foreground">Reorder Level: {stockItem.reorderLevel}</p>
                </div>
                <div>
                  <p className="flex items-center text-sm font-medium text-muted-foreground">
                    <Calendar size={16} className="mr-2 text-muted-foreground" aria-hidden="true" />
                    Expiry Date
                  </p>
                  <p className={`mt-1 ${expiryStatus.tone}`}>
                    {stockItem.expiryDate ? formatDate(stockItem.expiryDate) : "N/A"}
                    {expiryStatus.label !== "N/A" && ` (${expiryStatus.label})`}
                  </p>
                </div>
                <Info icon={Tag} label="Batch Number">{stockItem.batchNumber}</Info>
              </div>
            </Panel>
          )}

          <Panel title="Pricing Information">
            <div className="space-y-5">
              <Info label="Purchase Price">{formatCurrency(stockItem.purchasePrice)}</Info>
              <Info label="Sales Price">{formatCurrency(stockItem.salesPrice)}</Info>
              <div>
                <p className="flex items-center text-sm font-medium text-muted-foreground">
                  {stockItem.status === "Active" ? <CheckCircle size={14} className="mr-2 text-status-success" aria-hidden="true" /> : <XCircle size={14} className="mr-2 text-muted-foreground" aria-hidden="true" />}
                  Status
                </p>
                <Pill tone={stockItem.status === "Active" ? "success" : "neutral"} className="mt-1">{stockItem.status}</Pill>
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="lg:col-span-3" title="Purchase Logs">
          {isPurchaseLogsLoading ? (
            <Spinner label="Loading purchase logs" />
          ) : purchaseLogsError ? (
            <ErrorNote error={{ message: purchaseLogsError }} />
          ) : purchaseLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No purchase logs found for this item.</p>
          ) : (
            <div className="erp-scroll table-pin-first overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-background">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Transaction No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{taxWord()} %</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Expiry Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {purchaseLogs.map((log) => {
                    const item = log.items.find((i) => i.itemId.toString() === id);
                    if (!item) return null;
                    return (
                      <tr key={log._id}>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">{log.transactionNo}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">{formatDate(log.date)}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">{log.party || "N/A"}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">{item.qty}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">{formatCurrency(item.rate / item.qty)}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">{item.vatPercent}%</td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">{item.expiryDate ? formatDate(item.expiryDate) : "N/A"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {showAlerts && (
          <Panel className="lg:col-span-2" title="Alerts">
            <div className="space-y-4">
              {stockStatus.label === "Low Stock" && (
                <div className="rounded-lg border border-status-danger/25 bg-status-danger-soft p-4">
                  <p className="flex items-center text-sm font-medium text-status-danger">
                    <AlertTriangle size={16} className="mr-2" aria-hidden="true" />
                    Low Stock Alert
                  </p>
                  <p className="mt-1 text-sm text-status-danger">
                    Current stock ({stockItem.currentStock}) is at or below the reorder level ({stockItem.reorderLevel}). Consider restocking soon.
                  </p>
                </div>
              )}
              {expiryStatus.label === "Expired" && (
                <div className="rounded-lg border border-status-danger/25 bg-status-danger-soft p-4">
                  <p className="flex items-center text-sm font-medium text-status-danger">
                    <AlertCircle size={16} className="mr-2" aria-hidden="true" />
                    Expired Item
                  </p>
                  <p className="mt-1 text-sm text-status-danger">This item expired on {formatDate(stockItem.expiryDate)}. Review or dispose of the stock.</p>
                </div>
              )}
              {expiryStatus.label === "Expiring Soon" && (
                <div className="rounded-lg border border-status-warning/25 bg-status-warning-soft p-4">
                  <p className="flex items-center text-sm font-medium text-status-warning">
                    <AlertCircle size={16} className="mr-2" aria-hidden="true" />
                    Expiring Soon
                  </p>
                  <p className="mt-1 text-sm text-foreground">This item will expire on {formatDate(stockItem.expiryDate)}. Plan accordingly.</p>
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
};

export default StockDetail;
