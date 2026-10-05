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
  User,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import { toastClasses } from "../../lib/status";

import PartyModal from "../parties/PartyModal";
import ExpiryPill from "../parties/ExpiryPill";
// Session management utilities (using memory storage for Claude environment)
const SessionManager = {
  storage: {},

  get: (key) => {
    try {
      return this.storage[`vendor_session_${key}`] || null;
    } catch {
      return null;
    }
  },

  set: (key, value) => {
    try {
      this.storage[`vendor_session_${key}`] = value;
    } catch (error) {
      console.warn("Session storage failed:", error);
    }
  },

  remove: (key) => {
    try {
      delete this.storage[`vendor_session_${key}`];
    } catch (error) {
      console.warn("Session removal failed:", error);
    }
  },

  clear: () => {
    Object.keys(this.storage).forEach((key) => {
      if (key.startsWith("vendor_session_")) {
        delete this.storage[key];
      }
    });
  },
};

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [partyModal, setPartyModal] = useState(null); // { vendor } to edit one, {} for a new vendor
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
    itemName: "",
    id: null,
    isDeleting: false,
  });

  // New UX enhancement states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState("table"); // table, card
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Refs for enhanced UX
  const searchInputRef = useRef(null);

  // Load session data on component mount
  useEffect(() => {
    const savedFilters = SessionManager.get("filters");
    const savedSearchTerm = SessionManager.get("searchTerm");
    const savedViewMode = SessionManager.get("viewMode");

    if (savedFilters) {
      setFilterStatus(savedFilters.status || "");
      setFilterPaymentTerms(savedFilters.paymentTerms || "");
    }

    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }

    if (savedViewMode) {
      setViewMode(savedViewMode);
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

  useEffect(() => {
    SessionManager.set("viewMode", viewMode);
  }, [viewMode]);

  const fetchVendors = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const res = await axiosInstance.get("/vendors/vendors");
      setVendors(res.data.data || []);

      if (showRefreshIndicator) {
        showToastMessage("Data refreshed successfully!", "success");
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
      showToastMessage(
        error.response?.data?.message || "Failed to fetch vendors.",
        "error"
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  }, []);

  // The add / edit form is the shared party form (components/parties); the page only opens it and
  // reloads the list when it saves.
  const handleEdit = useCallback((vendor) => setPartyModal({ vendor }), []);
  const openAddModal = useCallback(() => setPartyModal({}), []);
  const closePartyModal = useCallback(() => setPartyModal(null), []);
  const handlePartySaved = useCallback(
    async (_saved, message) => {
      setPartyModal(null);
      await fetchVendors();
      showToastMessage(message, "success");
    },
    [fetchVendors, showToastMessage]
  );

  const handleDelete = useCallback((id, vendorName) => {
    setDeleteConfirmation({
      visible: true,
      itemName: vendorName,
      id,
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(`/vendors/vendors/${deleteConfirmation.id}`);
      await fetchVendors();
      showToastMessage("Vendor deleted successfully!", "success");
      hideDeleteConfirmation();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete vendor.",
        "error"
      );
    }
  }, [deleteConfirmation.id, fetchVendors, showToastMessage]);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      itemName: "",
      id: null,
      isDeleting: false,
    });
  }, []);

  const handleRefresh = useCallback(() => {
    fetchVendors(true);
  }, [fetchVendors]);

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
      Compliant: "bg-green-100 text-green-800 border border-green-200",
      "Non-compliant": "bg-red-100 text-red-800 border border-red-200",
      Pending: "bg-status-warning-soft text-status-warning border border-status-warning/25",
      Expired: "bg-gray-100 text-gray-800 border border-gray-200",
    };
    return badges[status] || "bg-gray-100 text-gray-800 border border-gray-200";
  }, []);

  const getStatusIcon = useCallback((status) => {
    const icons = {
      Compliant: <CheckCircle size={14} className="text-green-600" />,
      "Non-compliant": <XCircle size={14} className="text-red-600" />,
      Pending: <Clock size={14} className="text-status-warning" />,
      Expired: <AlertCircle size={14} className="text-gray-600" />,
    };
    return icons[status] || <AlertCircle size={14} className="text-gray-600" />;
  }, []);

  const sortedAndFilteredVendors = useMemo(() => {
    let filtered = vendors.filter(
      (vendor) =>
        (vendor.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vendor.contactPerson
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          vendor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vendor.vendorId.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (vendor.trnNO &&
            vendor.trnNO.toLowerCase().includes(searchTerm.toLowerCase()))) &&
        (filterStatus ? vendor.status === filterStatus : true) &&
        (filterPaymentTerms ? vendor.paymentTerms === filterPaymentTerms : true)
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
  }, [vendors, searchTerm, filterStatus, filterPaymentTerms, sortConfig]);

  const vendorStats = useMemo(
    () => ({
      compliantVendors: vendors.filter((v) => v.status === "Compliant").length,
      nonCompliantVendors: vendors.filter((v) => v.status === "Non-compliant")
        .length,
      pendingVendors: vendors.filter((v) => v.status === "Pending").length,
      expiredVendors: vendors.filter((v) => v.status === "Expired").length,
      totalVendors: vendors.length,
    }),
    [vendors]
  );

  if (isLoading) {
    return (
      <div className="min-h-[60vh] bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="text-blue-600 animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg">Loading vendors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
            <ArrowLeft size={16} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Vendor Management
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {vendorStats.totalVendors} total vendors •{" "}
              {sortedAndFilteredVendors.length} displayed
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
            className={`p-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
              showFilters
                ? "bg-blue-100 text-blue-600"
                : "bg-white text-gray-600"
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.visible && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Vendor
              </h3>
              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                "{deleteConfirmation.itemName}"?
              </p>
              <p className="text-sm text-gray-500 text-center mb-8">
                This action cannot be undone and will permanently remove the
                vendor from your records.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={hideDeleteConfirmation}
                  disabled={deleteConfirmation.isDeleting}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-background transition-all duration-200 font-medium disabled:opacity-50"
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

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">All Vendors</h2>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 w-full sm:w-auto transform hover:scale-105 active:scale-95"
            >
              <Plus size={16} />
              Add Vendor
            </button>
          </div>

          {/* Search and Filters */}
          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by Vendor ID, Name, Email, Contact Person, or TRN NO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-background rounded-lg">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
                >
                  <option value="">All Statuses</option>
                  <option value="Compliant">Compliant</option>
                  <option value="Non-compliant">Non-compliant</option>
                  <option value="Pending">Pending</option>
                  <option value="Expired">Expired</option>
                </select>

                <select
                  value={filterPaymentTerms}
                  onChange={(e) => setFilterPaymentTerms(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
                >
                  <option value="">All Payment Terms</option>
                  <option value="30 days">30 days</option>
                  <option value="Net 30">Net 30</option>
                  <option value="45 days">45 days</option>
                  <option value="Net 60">Net 60</option>
                  <option value="60 days">60 days</option>
                  <option value="COD">Cash On Delivery</option>
                </select>

                <button
                  onClick={() => {
                    setFilterStatus("");
                    setFilterPaymentTerms("");
                    setSearchTerm("");
                  }}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-background transition-colors duration-200 w-full sm:w-auto"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {sortedAndFilteredVendors.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Search size={48} className="mx-auto" />
              </div>
              <p className="text-gray-600 text-lg mb-2">No vendors found</p>
              <p className="text-gray-500">
                {searchTerm || filterStatus || filterPaymentTerms
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first vendor"}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[640px]">
              <thead className="bg-background">
                <tr>
                  {[
                    { key: "vendorId", label: "Vendor ID" },
                    { key: "vendorName", label: "Vendor Name" },
                    { key: "contactPerson", label: "Contact Person" },
                    { key: "email", label: "Email" },
                    { key: "phone", label: "Phone Number" },
                    { key: "address", label: "Billing Address" },
                    { key: "trnNO", label: "TRN NO" },
                    { key: "status", label: "Status" },
                    { key: null, label: "Actions" },
                  ].map((column) => (
                    <th
                      key={column.key || "actions"}
                      className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={
                        column.key ? () => handleSort(column.key) : undefined
                      }
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {column.key && sortConfig.key === column.key && (
                          <span className="text-blue-600">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAndFilteredVendors.map((vendor) => (
                  <tr
                    key={vendor._id}
                    className="hover:bg-background transition-colors duration-150"
                  >
                    <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">
                      {vendor.vendorId}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">{vendor.vendorName}</div>
                          <ExpiryPill documents={vendor.documents} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      {vendor.contactPerson}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      <a
                        href={`mailto:${vendor.email}`}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {vendor.email}
                      </a>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      <a
                        href={`tel:${vendor.phone}`}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {vendor.phone}
                      </a>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={vendor.address}>
                        {vendor.address}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      {vendor.trnNO || "-"}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(vendor.status)}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            vendor.status
                          )}`}
                        >
                          {vendor.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleEdit(vendor)}
                          className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded hover:bg-blue-50"
                          title="Edit vendor"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(vendor._id, vendor.vendorName)
                          }
                          className="text-red-600 hover:text-red-800 transition-colors p-1 rounded hover:bg-red-50"
                          title="Delete vendor"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / edit: the shared party form */}
      {partyModal && (
        <PartyModal
          kind="vendor"
          record={partyModal.vendor}
          onClose={closePartyModal}
          onSaved={handlePartySaved}
        />
      )}
    </div>
  );
};

export default VendorManagement;