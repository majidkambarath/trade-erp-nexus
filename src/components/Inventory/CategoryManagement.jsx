import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Tag,
  Edit3,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import axiosInstance from "../../axios/axios";

// Session management utilities
const SessionManager = {
  storage: {},

  get: (key) => {
    try {
      return this.storage[`category_session_${key}`] || null;
    } catch {
      return null;
    }
  },

  set: (key, value) => {
    try {
      this.storage[`category_session_${key}`] = value;
    } catch (error) {
      console.warn("Session storage failed:", error);
    }
  },

  remove: (key) => {
    try {
      delete this.storage[`category_session_${key}`];
    } catch (error) {
      console.warn("Session removal failed:", error);
    }
  },

  clear: () => {
    Object.keys(this.storage).forEach((key) => {
      if (key.startsWith("category_session_")) {
        delete this.storage[key];
      }
    });
  },
};

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editCategoryId, setEditCategoryId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    totalCategories: 0,
    activeCategories: 0,
    inactiveCategories: 0,
  });
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "ACTIVE",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    categoryId: null,
    categoryName: "",
    isDeleting: false,
  });

  const formRef = useRef(null);
  const autoSaveInterval = useRef(null);
  const itemsPerPage = 10;

  useEffect(() => {
    const savedFormData = SessionManager.get("formData");
    const savedSearchTerm = SessionManager.get("searchTerm");

    if (savedFormData && Object.values(savedFormData).some((val) => val)) {
      setFormData(savedFormData);
      setIsDraftSaved(true);
      setLastSaveTime(SessionManager.get("lastSaveTime"));
    }

    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
  }, []);

  useEffect(() => {
    if (showModal && Object.values(formData).some((val) => val)) {
      autoSaveInterval.current = setTimeout(() => {
        SessionManager.set("formData", formData);
        SessionManager.set("lastSaveTime", new Date().toISOString());
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
    SessionManager.set("searchTerm", searchTerm);
  }, [searchTerm]);

  const fetchCategories = useCallback(
    async (showRefreshIndicator = false) => {
      setIsLoading(showRefreshIndicator ? false : true);
      try {
        const params = {
          page,
          limit: itemsPerPage,
          search: searchTerm,
        };
        const response = await axiosInstance.get("/categories/categories", { params });
        setCategories(response.data.data?.categories || []);
        setTotalPages(response.data.totalPages || 1);
        if (showRefreshIndicator) {
          showToastMessage("Data refreshed successfully!", "success");
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
        showToastMessage(
          error.response?.data?.message || "Failed to fetch categories",
          "error"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [page, searchTerm]
  );

  const fetchStats = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/categories/categories/stats");
      setStats(
        response.data.data?.stats || {
          totalCategories: 0,
          activeCategories: 0,
          inactiveCategories: 0,
        }
      );
    } catch (error) {
      console.error("Error fetching stats:", error);
      showToastMessage("Failed to fetch statistics", "error");
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchStats();
  }, [fetchCategories, fetchStats]);

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
    if (!formData.name) newErrors.name = "Category name is required";
    if (formData.description.length > 500)
      newErrors.description = "Description cannot exceed 500 characters";
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
      if (isEditMode) {
        await axiosInstance.put(`/categories/categories/${editCategoryId}`, formData);
        showToastMessage("Category updated successfully!", "success");
      } else {
        await axiosInstance.post("/categories/categories", formData);
        showToastMessage("Category created successfully!", "success");
      }
      resetForm();
      fetchCategories();
      fetchStats();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || `Failed to ${isEditMode ? "update" : "create"} category`,
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, isEditMode, editCategoryId, fetchCategories, fetchStats, showToastMessage]);

  const resetForm = useCallback(() => {
    setFormData({
      name: "",
      description: "",
      status: "ACTIVE",
    });
    setErrors({});
    setShowModal(false);
    setIsEditMode(false);
    setEditCategoryId(null);
    setIsDraftSaved(false);
    setLastSaveTime(null);
    SessionManager.remove("formData");
    SessionManager.remove("lastSaveTime");
  }, []);

  const handleEdit = useCallback((category) => {
    setFormData({
      name: category.name,
      description: category.description || "",
      status: category.status,
    });
    setEditCategoryId(category._id);
    setIsEditMode(true);
    setShowModal(true);
    setTimeout(() => {
      if (formRef.current) {
        const firstInput = formRef.current.querySelector('input[name="name"]');
        if (firstInput) firstInput.focus();
      }
    }, 10);
  }, []);

  const showDeleteConfirmation = useCallback((categoryId, categoryName) => {
    setDeleteConfirmation({
      visible: true,
      categoryId,
      categoryName,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      categoryId: null,
      categoryName: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(`/categories/categories/${deleteConfirmation.categoryId}`);
      showToastMessage("Category deleted successfully!", "success");
      fetchCategories();
      fetchStats();
      hideDeleteConfirmation();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete category",
        "error"
      );
    } finally {
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteConfirmation.categoryId, fetchCategories, fetchStats, showToastMessage, hideDeleteConfirmation]);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return "";
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    return time.toLocaleTimeString();
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const csv = [
        "CategoryID,Name,Description,Status,CreatedAt",
        ...categories.map(
          (c) =>
            `${c._id},"${c.name.replace(/"/g, '""')}","${(c.description || "").replace(/"/g, '""')}",${c.status},${c.createdAt}`
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "categories_export.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToastMessage("Categories exported successfully!", "success");
    } catch (error) {
      showToastMessage("Failed to export data", "error");
    }
  }, [categories, showToastMessage]);

  const handleRefresh = useCallback(() => {
    fetchCategories(true);
    fetchStats();
  }, [fetchCategories, fetchStats]);

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black bg-clip-text">
              Category Management
            </h1>
            <p className="text-gray-600 mt-1">
              {stats.totalCategories} total categories • {categories.length} displayed
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            onClick={handleExport}
            className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200"
            title="Export to CSV"
          >
            <Download size={16} className="text-gray-600" />
          </button>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw
              size={16}
              className={`text-gray-600 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
              showFilters
                ? "bg-indigo-100 text-indigo-600"
                : "bg-white text-gray-600"
            }`}
            title="Toggle filters"
          >
            <Filter size={16} />
          </button>
        </div>
      </div>

      {showToast.visible && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg text-white z-50 transform transition-all duration-300 ${
            showToast.type === "success" ? "bg-emerald-500" : "bg-red-500"
          }`}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[
          {
            title: "Total Categories",
            count: stats.totalCategories,
            icon: <Tag size={24} />,
            bgColor: "bg-indigo-50",
            textColor: "text-indigo-700",
            borderColor: "border-indigo-200",
            iconBg: "bg-indigo-100",
            iconColor: "text-indigo-600",
          },
          {
            title: "Active Categories",
            count: stats.activeCategories,
            icon: <CheckCircle2 size={24} />,
            bgColor: "bg-green-50",
            textColor: "text-green-700",
            borderColor: "border-green-200",
            iconBg: "bg-green-100",
            iconColor: "text-green-600",
          },
          {
            title: "Inactive Categories",
            count: stats.inactiveCategories,
            icon: <XCircle size={24} />,
            bgColor: "bg-red-50",
            textColor: "text-red-700",
            borderColor: "border-red-200",
            iconBg: "bg-red-100",
            iconColor: "text-red-600",
          },
        ].map((card, index) => (
          <div
            key={index}
            className={`${card.bgColor} ${card.borderColor} rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-105`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 ${card.iconBg} rounded-xl`}>
                <div className={card.iconColor}>{card.icon}</div>
              </div>
              <button
                className={`text-xs ${card.textColor} hover:opacity-80 transition-opacity font-medium`}
                onClick={() => {
                  if (card.title.includes("Active"))
                    setSearchTerm("status:ACTIVE");
                  else if (card.title.includes("Inactive"))
                    setSearchTerm("status:INACTIVE");
                }}
              >
                View All →
              </button>
            </div>
            <h3 className={`text-sm font-medium ${card.textColor} mb-2`}>
              {card.title}
            </h3>
            <p className="text-3xl font-bold text-gray-900">{card.count}</p>
            <p className="text-xs text-gray-500 mt-1">
              {card.title.includes("Total Categories")
                ? "All categories"
                : card.title.includes("Active")
                ? "Active categories"
                : "Inactive categories"}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Category List
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage all inventory categories
              </p>
            </div>
            <button
              onClick={() => {
                setShowModal(true);
                setIsEditMode(false);
                setEditCategoryId(null);
                setTimeout(() => {
                  if (formRef.current) {
                    const firstInput = formRef.current.querySelector('input[name="name"]');
                    if (firstInput) firstInput.focus();
                  }
                }, 10);
              }}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} />
              Add Category
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-col lg:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search by category name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setSearchTerm("")}
                className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
            <span className="ml-3 text-gray-600">Loading categories...</span>
          </div>
        )}

        {!isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Category Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {categories.map((category) => (
                  <tr
                    key={category._id}
                    className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Tag size={16} className="text-indigo-600" />
                        </div>
                        <p className="font-semibold text-gray-900">
                          {category.name}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">
                        {category.description || "No description"}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${
                          category.status === "ACTIVE"
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-red-100 text-red-800 border-red-200"
                        }`}
                      >
                        {category.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors duration-200"
                          title="Edit Category"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(category._id, category.name)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors duration-200"
                          title="Delete Category"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {categories.length === 0 && (
              <div className="text-center py-12">
                <Tag size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No categories found</p>
                <p className="text-gray-400 text-sm">
                  Try adjusting your search criteria or add a new category
                </p>
              </div>
            )}
          </div>
        )}

        {!isLoading && categories.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>Showing</span>
                <span className="font-semibold">
                  {(page - 1) * itemsPerPage + 1}-
                  {Math.min(page * itemsPerPage, stats.totalCategories)}
                </span>
                <span>of</span>
                <span className="font-semibold">{stats.totalCategories}</span>
                <span>categories</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNumber = i + 1;
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setPage(pageNumber)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                          page === pageNumber
                            ? "bg-indigo-600 text-white"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {isEditMode ? "Edit Category" : "Add Category"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {isEditMode ? "Update an existing inventory category" : "Create a new inventory category"}
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
                    Category Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter category name"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.name
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.name}
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
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Optional description..."
                  rows="4"
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 resize-none ${
                    errors.description
                      ? "border-red-300 bg-red-50"
                      : "border-gray-300"
                    }`}
                />
                {errors.description && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <AlertCircle size={12} className="mr-1" />
                    {errors.description}
                  </p>
                )}
              </div>

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                  {isDraftSaved ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle2 size={14} className="mr-1" />
                      Changes saved automatically
                    </span>
                  ) : formData.name || formData.description ? (
                    <span className="flex items-center text-amber-600">
                      <AlertCircle size={14} className="mr-1" />
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
                        {isEditMode ? "Updating..." : "Creating..."}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} className="mr-2" />
                        {isEditMode ? "Update Category" : "Create Category"}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmation.visible && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Category
              </h3>

              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                "{deleteConfirmation.categoryName}"?
              </p>
              <p className="text-sm text-gray-500 text-center mb-8">
                This action cannot be undone and will permanently remove the
                category from your inventory.
              </p>

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
                      <Loader2 size={16} className="mr-2 animate-spin" />
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
    </div>
  );
};

export default CategoryManagement;