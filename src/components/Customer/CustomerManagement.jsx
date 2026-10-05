import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  CreditCard,
  Users,
  TrendingUp,
  Clock,
  AlertTriangle,
  UserPlus,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import DirhamIcon from "../../assets/dirham.svg";
import { toastClasses } from "../../lib/status";
import StatCard from "../ui/stat-card";

import PartyModal from "../parties/PartyModal";
import ExpiryPill from "../parties/ExpiryPill";
// Utility to apply color filter based on class
const getColorFilter = (colorClass) => {
  switch (colorClass) {
    case "text-emerald-700":
      return "invert(34%) sepia(94%) saturate(1352%) hue-rotate(145deg) brightness(94%) contrast(101%)";
    case "text-blue-700":
      return "invert(35%) sepia(99%) saturate(1352%) hue-rotate(200deg) brightness(94%) contrast(101%)";
    case "text-indigo-700":
      return "invert(38%) sepia(99%) saturate(1352%) hue-rotate(230deg) brightness(94%) contrast(101%)";
    default:
      return "none";
  }
};

// Session management utilities
const SessionManager = {
  storage: {},

  get: (key) => {
    try {
      return this.storage[`customer_session_${key}`] || null;
    } catch {
      return null;
    }
  },

  set: (key, value) => {
    try {
      this.storage[`customer_session_${key}`] = value;
    } catch (error) {
      console.warn("Session storage failed:", error);
    }
  },

  remove: (key) => {
    try {
      delete this.storage[`customer_session_${key}`];
    } catch (error) {
      console.warn("Session removal failed:", error);
    }
  },

  clear: () => {
    Object.keys(this.storage).forEach((key) => {
      if (key.startsWith("customer_session_")) {
        delete this.storage[key];
      }
    });
  },
};

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [partyModal, setPartyModal] = useState(null); // { customer } to edit one, {} for a new customer
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPaymentTerms, setFilterPaymentTerms] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    customerId: null,
    customerName: "",
    isDeleting: false,
  });

  // New UX enhancement states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Refs for enhanced UX
  const searchInputRef = useRef(null);

  // Updated formatCurrency function using DirhamIcon
  const formatCurrency = useCallback(
    (amount, colorClass = "text-gray-900", text) => {
      const numAmount = Number(amount) || 0;
      const absAmount = Math.abs(numAmount).toFixed(2);
      const isNegative = numAmount < 0;

      return (
        <span className={`inline-flex items-center ${colorClass} `}>
          {isNegative && "-"}
          <img
            src={DirhamIcon}
            alt="AED"
            className={`${text ? "w-6.5 h-7.5" : "w-4.5 h-4.5"}  mr-1 `}
            style={{ filter: getColorFilter(colorClass) }}
          />
          {absAmount}
        </span>
      );
    },
    []
  );

  // Load session data on component mount
  useEffect(() => {
    const savedFilters = SessionManager.get("filters");
    const savedSearchTerm = SessionManager.get("searchTerm");

    if (savedFilters) {
      setFilterStatus(savedFilters.status || "");
      setFilterPaymentTerms(savedFilters.paymentTerms || "");
    }

    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
  }, []);

  // Save search and filter preferences
  useEffect(() => {
    SessionManager.set("searchTerm", searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    SessionManager.set("filters", {
      status: filterStatus,
      paymentTerms: filterPaymentTerms,
    });
  }, [filterStatus, filterPaymentTerms]);

  const fetchCustomers = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const response = await axiosInstance.get("/customers/customers");
      setCustomers(response.data.data || []);

      if (showRefreshIndicator) {
        showToastMessage("Data refreshed successfully!", "success");
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      showToastMessage(
        error.response?.data?.message || "Failed to fetch customers.",
        "error"
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  }, []);

  // The add / edit form is the shared party form (components/parties); the page only opens it and
  // reloads the list when it saves.
  const handleEdit = useCallback((customer) => setPartyModal({ customer }), []);
  const openAddModal = useCallback(() => setPartyModal({}), []);
  const closePartyModal = useCallback(() => setPartyModal(null), []);
  const handlePartySaved = useCallback(
    async (_saved, message) => {
      setPartyModal(null);
      await fetchCustomers();
      showToastMessage(message, "success");
    },
    [fetchCustomers, showToastMessage]
  );

  const showDeleteConfirmation = useCallback((customer) => {
    setDeleteConfirmation({
      visible: true,
      customerId: customer._id,
      customerName: customer.customerName,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      customerId: null,
      customerName: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));

    try {
      await axiosInstance.delete(`/customers/${deleteConfirmation.customerId}`);
      setCustomers((prev) =>
        prev.filter(
          (customer) => customer._id !== deleteConfirmation.customerId
        )
      );
      showToastMessage("Customer deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchCustomers();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete customer.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [
    deleteConfirmation.customerId,
    fetchCustomers,
    showToastMessage,
    hideDeleteConfirmation,
  ]);

  const handleRefresh = useCallback(() => {
    fetchCustomers(true);
  }, [fetchCustomers]);

  const handleSort = useCallback((key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction:
        prevConfig.key === key && prevConfig.direction === "asc"
          ? "desc"
          : "asc",
    }));
  }, []);

  const getStatusBadge = useCallback((status) => {
    const badges = {
      Active: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      Inactive: "bg-slate-100 text-slate-800 border border-slate-200",
    };
    return (
      badges[status] || "bg-slate-100 text-slate-800 border border-slate-200"
    );
  }, []);

  const getStatusIcon = useCallback((status) => {
    const icons = {
      Active: <CheckCircle size={14} className="text-emerald-600" />,
      Inactive: <XCircle size={14} className="text-slate-600" />,
    };
    return (
      icons[status] || <AlertCircle size={14} className="text-slate-600" />
    );
  }, []);

  // Enhanced statistics calculations
  const customerStats = useMemo(() => {
    const activeCustomers = customers.filter(
      (c) => c.status === "Active"
    ).length;
    const inactiveCustomers = customers.filter(
      (c) => c.status === "Inactive"
    ).length;
    const totalRevenue = customers.reduce(
      (sum, c) => sum + (c.totalSpent || 0),
      0
    );
    const totalOrders = customers.reduce(
      (sum, c) => sum + (c.totalOrders || 0),
      0
    );
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      activeCustomers,
      inactiveCustomers,
      totalRevenue,
      avgOrderValue,
      totalCustomers: customers.length,
    };
  }, [customers]);

  const sortedAndFilteredCustomers = useMemo(() => {
    let filtered = customers.filter(
      (customer) =>
        (customer.customerName
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
          customer.contactPerson
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.customerId
            .toLowerCase()
            .includes(searchTerm.toLowerCase())) &&
        (filterStatus ? customer.status === filterStatus : true) &&
        (filterPaymentTerms
          ? customer.paymentTerms === filterPaymentTerms
          : true)
    );

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [customers, searchTerm, filterStatus, filterPaymentTerms, sortConfig]);

  // Enhanced Empty State Component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <UserPlus size={40} className="text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No customers found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm || filterStatus || filterPaymentTerms
          ? "No customers match your current filters. Try adjusting your search criteria."
          : "Start building your customer base by adding your first customer."}
      </p>
      <button
        onClick={openAddModal}
        className="erp-btn-primary"
      >
        <Plus size={20} />
        Add First Customer
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="text-purple-600 animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50">
            <ArrowLeft size={16} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-black bg-clip-text">
              Customer Management
            </h1>
            <p className="text-gray-600 mt-1">
              {customerStats.totalCustomers} total customers •{" "}
              {sortedAndFilteredCustomers.length} displayed
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="grid h-9 w-9 place-items-center rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw
              size={16}
              className={`text-gray-600 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`grid h-9 w-9 place-items-center rounded-lg border transition-colors ${
              showFilters
                ? "border-brand bg-brand-soft text-brand-on-soft"
                : "border-input bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Toggle filters"
          >
            <Filter size={16} />
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
              <CheckCircle size={16} />
            ) : (
              <XCircle size={16} />
            )}
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Enhanced Statistics Cards */}
      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[
            {
              title: "Active Customers",
              count: customerStats.activeCustomers,
              icon: <Users size={24} />,
              subText: "Show only active",
              onClick: () => setFilterStatus("Active"),
            },
            {
              title: "Inactive Customers",
              count: customerStats.inactiveCustomers,
              icon: <Clock size={24} />,
              subText: "Show only inactive",
              onClick: () => setFilterStatus("Inactive"),
            },
            // {
            //   title: "Total Revenue",
            //   count: formatCurrency(
            //     customerStats.totalRevenue,
            //     "text-blue-700",
            //     "w-6.5 h-7.5"
            //   ),
            //   icon: <TrendingUp size={24} />,
            //   bgColor: "bg-blue-50",
            //   textColor: "text-blue-700",
            //   borderColor: "border-blue-200",
            //   iconBg: "bg-blue-100",
            //   iconColor: "text-blue-600",
            //   textSize: "text-4xl",
            // },
            // {
            //   title: "Avg Order Value",
            //   count: formatCurrency(
            //     customerStats.avgOrderValue,
            //     "text-indigo-700",
            //     "w-6.5 h-7.5"
            //   ),
            //   icon: <CreditCard size={24} />,
            //   bgColor: "bg-indigo-50",
            //   textColor: "text-indigo-700",
            //   borderColor: "border-indigo-200",
            //   iconBg: "bg-indigo-100",
            //   iconColor: "text-indigo-600",
            // },
          ].map((card, index) => (
            <StatCard
              key={index}
              title={card.title}
              count={card.count}
              icon={card.icon}
              subText={card.subText}
              tone={["teal", "plum", "olive", "rose"][index % 4]}
              onClick={card.onClick}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Customer Directory
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage all your customer information
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="erp-btn-primary"
            >
              <Plus size={18} />
              Add Customer
            </button>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search customers by ID, name, email, or contact person..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
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

            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>

                <select
                  value={filterPaymentTerms}
                  onChange={(e) => setFilterPaymentTerms(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">All Payment Terms</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="Prepaid">Prepaid</option>
                </select>

                <button
                  onClick={() => {
                    setFilterStatus("");
                    setFilterPaymentTerms("");
                    setSearchTerm("");
                  }}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table/Content */}
        {sortedAndFilteredCustomers.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "customerId", label: "Customer ID" },
                    { key: "trnNumber", label: "TRN" }, // <- ADDED
                    { key: "customerName", label: "Customer Name" },
                    { key: "contactPerson", label: "Contact Person" },
                    { key: "salesPerson", label: "Sales Person" }, // <- ADDED
                    { key: "email", label: "Email" },
                    { key: "phone", label: "Phone" },
                    { key: "creditLimit", label: "Credit Limit" },
                    { key: "paymentTerms", label: "Payment Terms" },
                    { key: "status", label: "Status" },
                    { key: null, label: "Actions" },
                  ].map((column) => (
                    <th
                      key={column.key || "actions"}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={
                        column.key ? () => handleSort(column.key) : undefined
                      }
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {column.key && sortConfig.key === column.key && (
                          <span className="text-purple-600">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAndFilteredCustomers.map((customer) => (
                  <tr
                    key={customer._id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {customer.customerId}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
  {customer.trnNumber ? (
    <span className="font-medium text-gray-900">{customer.trnNumber}</span>
  ) : (
    <span className="text-sm text-gray-400">—</span> // placeholder for missing TRN
  )}
</td>

                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                          <Users size={16} className="text-purple-600" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {customer.customerName}
                          </div>
                          <ExpiryPill documents={customer.documents} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {customer.contactPerson}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
  {customer.salesPerson ? (
    <span className="font-medium text-gray-900">{customer.salesPerson}</span>
  ) : (
    <span className="text-sm text-gray-400">—</span>
  )}
</td>

                    <td className="px-6 py-4 text-sm text-gray-600">
                      <a
                        href={`mailto:${customer.email}`}
                        className="text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        {customer.email}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <a
                        href={`tel:${customer.phone}`}
                        className="text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        {customer.phone}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {formatCurrency(customer.creditLimit)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {customer.paymentTerms}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(customer.status)}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            customer.status
                          )}`}
                        >
                          {customer.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          title="Edit customer"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(customer)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Delete customer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Enhanced Delete Confirmation Modal */}
      {deleteConfirmation.visible && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>

              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Customer
              </h3>

              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                "{deleteConfirmation.customerName}"?
              </p>
              <p className="text-sm text-gray-500 text-center mb-8">
                This action cannot be undone and will permanently remove the
                customer from your database.
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

      {/* Add / edit: the shared party form */}
      {partyModal && (
        <PartyModal
          kind="customer"
          record={partyModal.customer}
          onClose={closePartyModal}
          onSaved={handlePartySaved}
        />
      )}
    </div>
  );
};

export default CustomerManagement;
