import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Package,
  ArrowLeft,
  Barcode,
  Tag,
  Banknote,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Box,
  Layers,
  CheckCircle,
  XCircle,
  AlertCircle,
  Truck,
  Globe,
  Star,
  FileText,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import BarcodeGenerator from "react-barcode";

import { formatDate, formatCurrencyAED} from "../../utils/format";
import { isService } from "../../lib/itemTypes";

// A service's income / expense account as the item detail returns it (populated), else the company default.
const accountText = (account, fallback) => (account?.accountName ? `${account.accountCode ? `${account.accountCode} ` : ""}${account.accountName}` : fallback);

const StockDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [stockItem, setStockItem] = useState(null);
  const [purchaseLogs, setPurchaseLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchaseLogsLoading, setIsPurchaseLogsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [purchaseLogsError, setPurchaseLogsError] = useState(null);

  // Fetch stock item details
  const fetchStockItem = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get(`/stock/stock/${id}`);
      setStockItem(response.data.data.stock);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to fetch stock item details."
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Fetch purchase logs
  const fetchPurchaseLogs = useCallback(async () => {
    setIsPurchaseLogsLoading(true);
    try {
      const response = await axiosInstance.get(
        `/stock/stock/${id}/purchase-logs`
      );
      console.log(response);
      setPurchaseLogs(response.data.data?.purchaseLogs); // Adjust based on your API response structure
    } catch (err) {
      setPurchaseLogsError(
        err.response?.data?.message || "Failed to fetch purchase logs."
      );
    } finally {
      setIsPurchaseLogsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStockItem();
    fetchPurchaseLogs();
  }, [fetchStockItem, fetchPurchaseLogs]);

  // Money is written the same way across the product: in the organisation's currency, as text ("AED 1,234.50" by default), never an icon.
  const formatCurrency = useCallback(
    (amount, colorClass = "") => (
      <span className={`whitespace-nowrap tabular-nums ${colorClass}`}>
        {formatCurrencyAED(Number(amount) || 0)}
      </span>
    ),
    []
  );

  // Stock status
  const getStockStatus = useCallback((currentStock, reorderLevel) => {
    if (currentStock <= reorderLevel) {
      return { color: "text-red-500", icon: AlertTriangle, label: "Low Stock" };
    } else if (currentStock <= reorderLevel * 2) {
      return {
        color: "text-status-warning",
        icon: TrendingDown,
        label: "Medium Stock",
      };
    }
    return { color: "text-green-500", icon: TrendingUp, label: "Good Stock" };
  }, []);

  // Expiry status
  const getExpiryStatus = useCallback((expiryDate) => {
    if (!expiryDate) return { color: "text-gray-500", label: "N/A" };
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { color: "text-red-500 bg-red-50", label: "Expired" };
    } else if (diffDays <= 30) {
      return { color: "text-status-warning bg-status-warning-soft", label: "Expiring Soon" };
    }
    return { color: "text-green-500", label: "Valid" };
  }, []);

  // Status badge
  const getStatusBadge = useCallback((status) => {
    const badges = {
      Active: "bg-green-100 text-green-700 border border-green-200",
      Inactive: "bg-gray-100 text-gray-700 border border-gray-200",
    };
    return badges[status] || "bg-gray-100 text-gray-700 border border-gray-200";
  }, []);

  // Status icon
  const getStatusIcon = useCallback((status) => {
    const icons = {
      Active: <CheckCircle size={14} className="text-green-500" />,
      Inactive: <XCircle size={14} className="text-gray-500" />,
    };
    return icons[status] || <AlertCircle size={14} className="text-gray-500" />;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh] bg-background">
        <div className="flex items-center space-x-3 text-gray-600">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !stockItem) {
    return (
      <div className="flex items-center justify-center min-h-[60dvh] bg-background">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-gray-100">
          <div className="flex justify-center mb-4">
            <AlertCircle size={40} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 text-center mb-3">
            Error
          </h3>
          <p className="text-gray-600 text-center mb-6">
            {error || "Stock item not found."}
          </p>
          <button
            onClick={() => navigate("/stock-management")}
            className="erp-btn-primary"
          >
            <ArrowLeft size={16} />
            Back to Stock Management
          </button>
        </div>
      </div>
    );
  }

  // A service has no quantity, reorder level, batch or expiry: no stock card, and no "low stock" alert (0 <= 0).
  const service = isService(stockItem);
  const stockStatus = getStockStatus(
    stockItem.currentStock,
    stockItem.reorderLevel
  );
  const expiryStatus = service ? { color: "text-gray-500", label: "N/A" } : getExpiryStatus(stockItem.expiryDate);

  return (
    <div className="bg-background py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 hover:bg-background"
              aria-label="Go back"
            >
              <ArrowLeft size={16} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {stockItem.itemName}
                {service && <span className="ms-3 inline-block rounded-full border border-indigo-200 bg-indigo-50 px-3 py-0.5 align-middle text-sm font-medium text-indigo-700">Service</span>}
              </h1>
              <p className="text-sm text-gray-500 mt-1">SKU: {stockItem.sku}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
          {/* Basic Information */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center">
              <Package size={20} className="mr-2 text-indigo-500" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <div>
                <p className="text-sm font-medium text-gray-600 flex items-center">
                  <Tag size={16} className="mr-2 text-gray-500" />
                  Category
                </p>
                <p className="text-gray-800 mt-1">
                  {stockItem.category?.name || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 flex items-center">
                  <Barcode size={16} className="mr-2 text-gray-500" />
                  SKU
                </p>
                <p className="text-gray-800 mt-1">{stockItem.sku || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 flex items-center">
                  <Truck size={16} className="mr-2 text-gray-500" />
                  Vendor
                </p>
                <p className="text-gray-800 mt-1">
                  {stockItem.vendorId?.vendorName || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 flex items-center">
                  <Box size={16} className="mr-2 text-gray-500" />
                  Unit of Measure
                </p>
                <p className="text-gray-800 mt-1">
                  {stockItem.unitOfMeasure?.unitName || "N/A"}
                </p>
              </div>
              {!service && (
                <>
                  <div>
                    <p className="text-sm font-medium text-gray-600 flex items-center">
                      <Globe size={16} className="mr-2 text-gray-500" />
                      Origin
                    </p>
                    <p className="text-gray-800 mt-1">
                      {stockItem.origin || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 flex items-center">
                      <Star size={16} className="mr-2 text-gray-500" />
                      Brand
                    </p>
                    <p className="text-gray-800 mt-1">{stockItem.brand || "N/A"}</p>
                  </div>
                </>
              )}
            </div>
            {!service && stockItem.barcodeQrCode && (
              <div className="mt-6">
                <p className="text-sm font-medium text-gray-600 flex items-center">
                  <Barcode size={16} className="mr-2 text-gray-500" />
                  Barcode/QR Code
                </p>
                <div className="mt-2 bg-background p-3 rounded-lg">
                  <BarcodeGenerator
                    value={stockItem.barcodeQrCode || stockItem.sku}
                    format="CODE128"
                    width={2}
                    height={50}
                    fontSize={12}
                    background="transparent"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stock & Pricing Information */}
          <div className="space-y-6">
            {/* A service: no stock, but the accounts its sales and purchases are recorded in */}
            {service && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center">
                  <Layers size={20} className="mr-2 text-purple-500" />
                  Service
                </h3>
                <div className="space-y-5">
                  <p className="text-sm text-gray-600">Not stocked: invoicing it moves no stock and has no cost of goods.</p>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Income account</p>
                    <p className="text-gray-800 mt-1">{accountText(stockItem.incomeAccountId, "Company default (Sales revenue)")}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Expense account</p>
                    <p className="text-gray-800 mt-1">{accountText(stockItem.expenseAccountId, "Company default (Services purchased)")}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Stock Information */}
            {!service && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center">
                <Layers size={20} className="mr-2 text-purple-500" />
                Stock Information
              </h3>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-gray-600 flex items-center">
                    <stockStatus.icon
                      size={16}
                      className={`${stockStatus.color} mr-2`}
                    />
                    Stock Status
                  </p>
                  <p
                    className={`text-gray-800 mt-1 font-medium ${stockStatus.color}`}
                  >
                    {stockItem.currentStock} ({stockStatus.label})
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Reorder Level: {stockItem.reorderLevel}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 flex items-center">
                    <Calendar size={16} className="mr-2 text-gray-500" />
                    Expiry Date
                  </p>
                  <p className={`text-gray-800 mt-1 ${expiryStatus.color}`}>
                    {stockItem.expiryDate
                      ? formatDate(stockItem.expiryDate)
                      : "N/A"}
                    {expiryStatus.label !== "N/A" && ` (${expiryStatus.label})`}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 flex items-center">
                    <Tag size={16} className="mr-2 text-gray-500" />
                    Batch Number
                  </p>
                  <p className="text-gray-800 mt-1">
                    {stockItem.batchNumber || "N/A"}
                  </p>
                </div>
              </div>
            </div>
            )}

            {/* Pricing Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center">
                {/* <Banknote size={20} className="mr-2 text-green-500" /> */}
                Pricing Information
              </h3>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-gray-600 flex items-center">
                    {/* <Banknote size={16} className="mr-2 text-gray-500" /> */}
                    Purchase Price
                  </p>
                  <p className="text-gray-800 mt-1">
                    {formatCurrency(stockItem.purchasePrice)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 flex items-center">
                    {/* <Banknote size={16} className="mr-2 text-gray-500" /> */}
                    Sales Price
                  </p>
                  <p className="text-gray-800 mt-1">
                    {formatCurrency(stockItem.salesPrice)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 flex items-center">
                    {getStatusIcon(stockItem.status)}
                    Status
                  </p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-1 ${getStatusBadge(
                      stockItem.status
                    )}`}
                  >
                    {stockItem.status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase Logs */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center">
              <FileText size={20} className="mr-2 text-blue-500" />
              Purchase Logs
            </h3>
            {isPurchaseLogsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="flex items-center space-x-3 text-gray-600">
                  <div className="w-6 h-6 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-md font-medium">
                    Loading purchase logs...
                  </span>
                </div>
              </div>
            ) : purchaseLogsError ? (
              <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-sm font-medium text-red-600 flex items-center">
                  <AlertCircle size={16} className="mr-2" />
                  Error
                </p>
                <p className="text-sm text-red-500 mt-1">{purchaseLogsError}</p>
              </div>
            ) : purchaseLogs.length === 0 ? (
              <p className="text-gray-600 text-sm">
                No purchase logs found for this item.
              </p>
            ) : (
              <div className="erp-scroll table-pin-first overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-background">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaction No
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vendor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate
                      </th>
                     
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        VAT %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Expiry Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {purchaseLogs.map((log) => {
                      // Find the item in the log's items array that matches the current stock item
                      const item = log.items.find(
                        (i) => i.itemId.toString() === id
                      );
                      if (!item) return null; // Skip if no matching item
                      return (
                        <tr key={log._id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                            {log.transactionNo}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                            {formatDate(log.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                            {log.party || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                            {item.qty}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                            {formatCurrency(item.rate / item.qty)}
                          </td>
                          
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                            {item.vatPercent}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                            {item.expiryDate
                              ? formatDate(item.expiryDate)
                              : "N/A"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Alerts */}
          {!service && (stockStatus.label === "Low Stock" ||
            expiryStatus.label === "Expired" ||
            expiryStatus.label === "Expiring Soon") && (
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center">
                <AlertCircle size={20} className="mr-2 text-red-500" />
                Alerts
              </h3>
              <div className="space-y-4">
                {stockStatus.label === "Low Stock" && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-sm font-medium text-red-600 flex items-center">
                      <AlertTriangle size={16} className="mr-2" />
                      Low Stock Alert
                    </p>
                    <p className="text-sm text-red-500 mt-1">
                      Current stock ({stockItem.currentStock}) is at or below
                      the reorder level ({stockItem.reorderLevel}). Consider
                      restocking soon.
                    </p>
                  </div>
                )}
                {expiryStatus.label === "Expired" && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-sm font-medium text-red-600 flex items-center">
                      <AlertCircle size={16} className="mr-2" />
                      Expired Item
                    </p>
                    <p className="text-sm text-red-500 mt-1">
                      This item expired on{" "}
                      {formatDate(stockItem.expiryDate)}.
                      Review or dispose of the stock.
                    </p>
                  </div>
                )}
                {expiryStatus.label === "Expiring Soon" && (
                  <div className="p-4 bg-status-warning-soft border border-status-warning/25 rounded-lg">
                    <p className="text-sm font-medium text-status-warning flex items-center">
                      <AlertCircle size={16} className="mr-2" />
                      Expiring Soon
                    </p>
                    <p className="text-sm text-foreground mt-1">
                      This item will expire on{" "}
                      {formatDate(stockItem.expiryDate)}.
                      Plan accordingly.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockDetail;
