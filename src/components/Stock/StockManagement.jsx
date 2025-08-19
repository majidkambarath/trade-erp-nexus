import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Barcode,
  Tag,
  DollarSign,
  Calendar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Box,
  Layers,
  Filter,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
} from "lucide-react";
import axiosInstance from "../../axios/axios";

const StockManagement = () => {
  const [stockItems, setStockItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editItemId, setEditItemId] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showLowStock, setShowLowStock] = useState(false);

  const [formData, setFormData] = useState({
    sku: "",
    itemName: "",
    category: "",
    unitOfMeasure: "",
    barcodeQrCode: "",
    reorderLevel: "",
    batchNumber: "",
    expiryDate: "",
    purchasePrice: "",
    salesPrice: "",
    currentStock: "",
    status: "Active",
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    itemId: null,
    itemName: "",
    isDeleting: false,
  });

  const categories = [
    "Electronics",
    "Clothing",
    "Books",
    "Food",
    "Medicine",
    "Tools",
  ];
  const unitsOfMeasure = ["Piece", "Kg", "Liter", "Meter", "Box", "Carton"];

  useEffect(() => {
    fetchStockItems();
  }, []);

  const fetchStockItems = async () => {
    try {
      const response = await axiosInstance.get("/stock");
      setStockItems(response.data.data || []);
    } catch (error) {
      setShowToast({
        visible: true,
        message:
          error.response?.data?.message || "Failed to fetch stock items.",
        type: "error",
      });
      setTimeout(
        () => setShowToast((prev) => ({ ...prev, visible: false })),
        3000
      );
    }
  };

  // Calculate statistics
  const totalItems = stockItems.length;
  const activeItems = stockItems.filter(
    (item) => item.status === "Active"
  ).length;
  const lowStockItems = stockItems.filter(
    (item) => item.currentStock <= item.reorderLevel
  ).length;
  const totalValue = stockItems.reduce(
    (sum, item) => sum + item.currentStock * item.purchasePrice,
    0
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.itemName.trim()) newErrors.itemName = "Item name is required";
    if (!formData.sku.trim()) newErrors.sku = "SKU is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.unitOfMeasure)
      newErrors.unitOfMeasure = "Unit of measure is required";
    if (
      formData.reorderLevel &&
      (isNaN(formData.reorderLevel) || formData.reorderLevel < 0)
    ) {
      newErrors.reorderLevel = "Reorder level must be a valid positive number";
    }
    if (
      formData.purchasePrice &&
      (isNaN(formData.purchasePrice) || formData.purchasePrice < 0)
    ) {
      newErrors.purchasePrice =
        "Purchase price must be a valid positive number";
    }
    if (
      formData.salesPrice &&
      (isNaN(formData.salesPrice) || formData.salesPrice < 0)
    ) {
      newErrors.salesPrice = "Sales price must be a valid positive number";
    }
    if (
      formData.currentStock &&
      (isNaN(formData.currentStock) || formData.currentStock < 0)
    ) {
      newErrors.currentStock = "Current stock must be a valid positive number";
    }
    return newErrors;
  };

  const handleSubmit = async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        sku: formData.sku,
        itemName: formData.itemName,
        category: formData.category,
        unitOfMeasure: formData.unitOfMeasure,
        barcodeQrCode: formData.barcodeQrCode,
        reorderLevel: Number(formData.reorderLevel) || 0,
        batchNumber: formData.batchNumber,
        expiryDate: formData.expiryDate,
        purchasePrice: Number(formData.purchasePrice) || 0,
        salesPrice: Number(formData.salesPrice) || 0,
        currentStock: Number(formData.currentStock) || 0,
        status: formData.status,
      };

      if (editItemId) {
        await axiosInstance.put(`/stock/${editItemId}`, payload);
        setShowToast({
          visible: true,
          message: "Stock item updated successfully!",
          type: "success",
        });
      } else {
        const response = await axiosInstance.post("/stock", payload);
        // Assuming the backend returns the new item with an ID
        setStockItems((prev) => [
          ...prev,
          { id: response.data.data.id, ...payload },
        ]);
        setShowToast({
          visible: true,
          message: "Stock item created successfully!",
          type: "success",
        });
      }
      fetchStockItems(); // Refresh the list
      resetForm();
    } catch (error) {
      setShowToast({
        visible: true,
        message: error.response?.data?.message || "Failed to save stock item.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(
        () => setShowToast((prev) => ({ ...prev, visible: false })),
        3000
      );
    }
  };

  const handleEdit = (item) => {
    setEditItemId(item._id);
    setFormData({
      sku: item.sku,
      itemName: item.itemName,
      category: item.category,
      unitOfMeasure: item.unitOfMeasure,
      barcodeQrCode: item.barcodeQrCode,
      reorderLevel: item.reorderLevel.toString(),
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      purchasePrice: item.purchasePrice.toString(),
      salesPrice: item.salesPrice.toString(),
      currentStock: item.currentStock.toString(),
      status: item.status,
    });
    setShowModal(true);
  };

  // Show delete confirmation
  const showDeleteConfirmation = (id, itemName) => {
    setDeleteConfirmation({
      visible: true,
      itemId: id,
      itemName: itemName,
      isDeleting: false,
    });
  };

  // Hide delete confirmation
  const hideDeleteConfirmation = () => {
    setDeleteConfirmation({
      visible: false,
      itemId: null,
      itemName: "",
      isDeleting: false,
    });
  };

  // Confirm delete action
  const confirmDelete = async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));

    try {
      await axiosInstance.delete(`/stock/${deleteConfirmation.itemId}`);
      setStockItems((prev) =>
        prev.filter((item) => item._id !== deleteConfirmation.itemId)
      );
      setShowToast({
        visible: true,
        message: "Stock item deleted successfully!",
        type: "success",
      });
      hideDeleteConfirmation();
    } catch (error) {
      setShowToast({
        visible: true,
        message:
          error.response?.data?.message || "Failed to delete stock item.",
        type: "error",
      });
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    } finally {
      setTimeout(
        () => setShowToast((prev) => ({ ...prev, visible: false })),
        3000
      );
    }
  };

  const resetForm = () => {
    setEditItemId(null);
    setFormData({
      sku: "",
      itemName: "",
      category: "",
      unitOfMeasure: "",
      barcodeQrCode: "",
      reorderLevel: "",
      batchNumber: "",
      expiryDate: "",
      purchasePrice: "",
      salesPrice: "",
      currentStock: "",
      status: "Active",
    });
    setErrors({});
    setShowModal(false);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const getStatusBadge = (status) =>
    ({
      Active: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      Inactive: "bg-gray-100 text-gray-800 border border-gray-200",
    }[status] || "bg-gray-100 text-gray-800 border border-gray-200");

  const getStockStatus = (currentStock, reorderLevel) => {
    if (currentStock <= reorderLevel) {
      return { color: "text-red-600", icon: AlertTriangle, label: "Low Stock" };
    } else if (currentStock <= reorderLevel * 2) {
      return {
        color: "text-yellow-600",
        icon: TrendingDown,
        label: "Medium Stock",
      };
    }
    return { color: "text-green-600", icon: TrendingUp, label: "Good Stock" };
  };

  const filteredItems = stockItems.filter((item) => {
    const matchesSearch =
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.itemId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory
      ? item.category === filterCategory
      : true;
    const matchesStatus = filterStatus ? item.status === filterStatus : true;
    const matchesLowStock = showLowStock
      ? item.currentStock <= item.reorderLevel
      : true;

    return matchesSearch && matchesCategory && matchesStatus && matchesLowStock;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Stock Management
          </h1>
          <p className="text-gray-600 mt-2">
            Create and manage your inventory items
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="p-3 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <Download size={20} className="text-gray-600" />
          </button>
          <button className="p-3 bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <RefreshCw size={20} className="text-gray-600" />
          </button>
        </div>
      </div>

      
      {/* Toast Notification */}
      {showToast.visible && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg text-white z-50 transform transition-all duration-300 ${
            showToast.type === "success" ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.visible && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
            <div className="p-6">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>
              
              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Stock Item
              </h3>
              
              {/* Message */}
              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                "{deleteConfirmation.itemName}"?
              </p>
              <p className="text-sm text-gray-500 text-center mb-8">
                This action cannot be undone and will permanently remove the item from your inventory.
              </p>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={hideDeleteConfirmation}
                  disabled={deleteConfirmation.isDeleting}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteConfirmation.isDeleting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  {deleteConfirmation.isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} className="mr-2" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-indigo-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600">Total Items</p>
              <p className="text-3xl font-bold text-gray-900">{totalItems}</p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-full">
              <Box size={24} className="text-indigo-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-emerald-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-600">
                Active Items
              </p>
              <p className="text-3xl font-bold text-gray-900">{activeItems}</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-full">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-red-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">
                Low Stock Alert
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {lowStockItems}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle size={24} className="text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-purple-500 hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Value</p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCurrency(totalValue)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <DollarSign size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Header with Search and Filters */}
        <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Inventory Items
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage your stock items and inventory
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Plus size={18} />
              Add New Item
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search by item name, SKU, or item ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>

              <button
                onClick={() => setShowLowStock(!showLowStock)}
                className={`px-4 py-3 rounded-xl border transition-all duration-200 ${
                  showLowStock
                    ? "bg-red-100 border-red-300 text-red-700"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Filter size={16} className="inline mr-2" />
                Low Stock
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Item Info
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Stock Level
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Pricing
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => {
                const stockStatus = getStockStatus(
                  item.currentStock,
                  item.reorderLevel
                );
                const StockIcon = stockStatus.icon;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Package size={20} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {item.itemName}
                          </p>
                          <p className="text-xs text-gray-500">
                            SKU: {item.sku}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID: {item.itemId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {item.category}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.unitOfMeasure}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <StockIcon size={16} className={stockStatus.color} />
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {item.currentStock}
                          </p>
                          <p className={`text-xs ${stockStatus.color}`}>
                            Reorder: {item.reorderLevel}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Sale: {formatCurrency(item.salesPrice)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Cost: {formatCurrency(item.purchasePrice)}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all duration-200"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(item._id, item.itemName)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {editItemId ? "Edit Stock Item" : "Add New Stock Item"}
                </h3>
                <p className="text-gray-600 text-sm mt-1">
                  {editItemId
                    ? "Update item information"
                    : "Create a new inventory item"}
                </p>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Basic Information */}
                <div className="lg:col-span-3">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Package size={20} className="mr-2 text-indigo-600" />
                    Basic Information
                  </h4>
                </div>

                {/* <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Item ID
                  </label>
                  <input
                    type="text"
                    name="itemId"
                    value={formData.itemId || ""}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div> */}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    SKU *
                  </label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.sku
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter SKU code"
                  />
                  {errors.sku && (
                    <p className="mt-1 text-sm text-red-600">{errors.sku}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    name="itemName"
                    value={formData.itemName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.itemName
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter item name"
                  />
                  {errors.itemName && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.itemName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.category
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  {errors.category && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.category}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit of Measure *
                  </label>
                  <select
                    name="unitOfMeasure"
                    value={formData.unitOfMeasure}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.unitOfMeasure
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Unit</option>
                    {unitsOfMeasure.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                  {errors.unitOfMeasure && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.unitOfMeasure}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Barcode size={16} className="inline mr-2" />
                    Barcode/QR Code
                  </label>
                  <input
                    type="text"
                    name="barcodeQrCode"
                    value={formData.barcodeQrCode}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter barcode or QR code"
                  />
                </div>

                {/* Stock Information */}
                <div className="lg:col-span-3 mt-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Layers size={20} className="mr-2 text-purple-600" />
                    Stock Information
                  </h4>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Current Stock
                  </label>
                  <input
                    type="number"
                    name="currentStock"
                    value={formData.currentStock}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.currentStock
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter current stock"
                    min="0"
                  />
                  {errors.currentStock && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.currentStock}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Reorder Level
                  </label>
                  <input
                    type="number"
                    name="reorderLevel"
                    value={formData.reorderLevel}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.reorderLevel
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter reorder level"
                    min="0"
                  />
                  {errors.reorderLevel && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.reorderLevel}
                    </p>
                  )}
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter batch number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-2" />
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                {/* Pricing Information */}
                <div className="lg:col-span-3 mt-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <DollarSign size={20} className="mr-2 text-green-600" />
                    Pricing Information
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Purchase Price
                  </label>
                  <input
                    type="number"
                    name="purchasePrice"
                    value={formData.purchasePrice}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.purchasePrice
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter purchase price"
                    min="0"
                    step="0.01"
                  />
                  {errors.purchasePrice && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.purchasePrice}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sales Price
                  </label>
                  <input
                    type="number"
                    name="salesPrice"
                    value={formData.salesPrice}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.salesPrice
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter sales price"
                    min="0"
                    step="0.01"
                  />
                  {errors.salesPrice && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.salesPrice}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={resetForm}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </div>
                  ) : editItemId ? (
                    "Update Item"
                  ) : (
                    "Create Item"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManagement;
