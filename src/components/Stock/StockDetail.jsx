import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Package,
  ArrowLeft,
  Barcode,
  Tag,
  DollarSign,
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
import DirhamIcon from "../../assets/dirham.svg";
import BarcodeGenerator from "react-barcode";

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

  // Currency formatting
  const formatCurrency = useCallback((amount, colorClass = "text-gray-800") => {
    const numAmount = Number(amount) || 0;
    const absAmount = Math.abs(numAmount).toFixed(2);
    const isNegative = numAmount < 0;
    const colorMap = {
      "text-gray-800": "none",
      "text-red-500":
        "invert(36%) sepia(95%) saturate(1492%) hue-rotate(332deg) brightness(95%) contrast(91%)",
      "text-amber-500":
        "invert(66%) sepia(99%) saturate(1468%) hue-rotate(4deg) brightness(103%) contrast(88%)",
      "text-green-500":
        "invert(35%) sepia(74%) saturate(1056%) hue-rotate(123deg) brightness(94%) contrast(87%)",
    };
    const filter = colorMap[colorClass] || "none";

    return (
      <span className={`inline-flex items-center ${colorClass} font-medium`}>
        {isNegative && "-"}
        <img
          src={DirhamIcon}
          alt="AED"
          className="w-4 h-4 mr-1.5"
          style={{ filter }}
        />
        {absAmount}
      </span>
    );
  }, []);

  // Stock status
  const getStockStatus = useCallback((currentStock, reorderLevel) => {
    if (currentStock <= reorderLevel) {
      return { color: "text-red-500", icon: AlertTriangle, label: "Low Stock" };
    } else if (currentStock <= reorderLevel * 2) {
      return {
        color: "text-amber-500",
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
      return { color: "text-amber-500 bg-amber-50", label: "Expiring Soon" };
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex items-center space-x-3 text-gray-600">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-lg font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !stockItem) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
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
            className="w-full px-6 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-all duration-300 flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Stock Management
          </button>
        </div>
      </div>
    );
  }

  const stockStatus = getStockStatus(
    stockItem.currentStock,
    stockItem.reorderLevel
  );
  const expiryStatus = getExpiryStatus(stockItem.expiryDate);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2.5 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 hover:bg-gray-50"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {stockItem.itemName}
              </h1>
              <p className="text-sm text-gray-500 mt-1">SKU: {stockItem.sku}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Basic Information */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
            <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center">
              <Package size={20} className="mr-2 text-indigo-500" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
            </div>
            {stockItem.barcodeQrCode && (
              <div className="mt-6">
                <p className="text-sm font-medium text-gray-600 flex items-center">
                  <Barcode size={16} className="mr-2 text-gray-500" />
                  Barcode/QR Code
                </p>
                <div className="mt-2 bg-gray-50 p-3 rounded-lg">
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
            {/* Stock Information */}
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
                      ? new Date(stockItem.expiryDate).toLocaleDateString()
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

            {/* Pricing Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 transition-all duration-300 hover:shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-5 flex items-center">
                {/* <DollarSign size={20} className="mr-2 text-green-500" /> */}
                Pricing Information
              </h3>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-gray-600 flex items-center">
                    {/* <DollarSign size={16} className="mr-2 text-gray-500" /> */}
                    Purchase Price
                  </p>
                  <p className="text-gray-800 mt-1">
                    {formatCurrency(stockItem.purchasePrice)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 flex items-center">
                    {/* <DollarSign size={16} className="mr-2 text-gray-500" /> */}
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
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
                            {new Date(log.date).toLocaleDateString()}
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
                              ? new Date(item.expiryDate).toLocaleDateString()
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
          {(stockStatus.label === "Low Stock" ||
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
                      {new Date(stockItem.expiryDate).toLocaleDateString()}.
                      Review or dispose of the stock.
                    </p>
                  </div>
                )}
                {expiryStatus.label === "Expiring Soon" && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                    <p className="text-sm font-medium text-amber-600 flex items-center">
                      <AlertCircle size={16} className="mr-2" />
                      Expiring Soon
                    </p>
                    <p className="text-sm text-amber-500 mt-1">
                      This item will expire on{" "}
                      {new Date(stockItem.expiryDate).toLocaleDateString()}.
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
