import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  User,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import { toastClasses } from "../../lib/status";
import { pageSession } from "../../lib/pageSession";

import PartyModal from "../parties/PartyModal";
import ExpiryPill from "../parties/ExpiryPill";
import { DataTable } from "../accounting/DataTable";
import FilterBar, { FilterSelect } from "../lists/FilterBar";
import Can from "../shell/Can";

// What this screen keeps while the person visits another page and comes back (lib/pageSession.js): the search, the two choices
// and the column the list is sorted by. Held in memory for the tab; emptied at sign-out. The add / edit form is the shared party
// form (components/parties) and keeps no draft here, as before.
const session = pageSession("vendor-management");

const STATUS_OPTIONS = ["Compliant", "Non-compliant", "Pending", "Expired"].map((s) => [s, s]);
const PAYMENT_TERMS_OPTIONS = [
  ["30 days", "30 days"],
  ["Net 30", "Net 30"],
  ["45 days", "45 days"],
  ["Net 60", "Net 60"],
  ["60 days", "60 days"],
  ["COD", "Cash On Delivery"],
];

// A vendor saved without an email (it is optional on the form) has none to search; reading it must not stop the page.
const hasText = (value, needle) => String(value ?? "").toLowerCase().includes(needle);

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [partyModal, setPartyModal] = useState(null); // { vendor } to edit one, {} for a new vendor
  // the search and the two choices come back as the person left them (lazy initialisers: the first render already has them)
  const [kept] = useState(() => session.get("filters", {}) || {});
  const [searchTerm, setSearchTerm] = useState(() => session.get("searchTerm", "") || "");
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [filterStatus, setFilterStatus] = useState(kept.status || "");
  const [filterPaymentTerms, setFilterPaymentTerms] = useState(kept.paymentTerms || "");
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    itemName: "",
    id: null,
    isDeleting: false,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortConfig, setSortConfig] = useState(
    () => session.get("sort", null) || { key: null, direction: "asc" }
  );

  // Save the search, the choices and the sort in one place.
  useEffect(() => {
    session.set("searchTerm", searchTerm);
    session.set("filters", { status: filterStatus, paymentTerms: filterPaymentTerms });
    session.set("sort", sortConfig);
  }, [searchTerm, filterStatus, filterPaymentTerms, sortConfig]);

  const filtersOn = Boolean(searchTerm || filterStatus || filterPaymentTerms);
  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("");
    setFilterPaymentTerms("");
  };

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
    const needle = searchTerm.toLowerCase();
    let filtered = vendors.filter(
      (vendor) =>
        (hasText(vendor.vendorName, needle) ||
          hasText(vendor.contactPerson, needle) ||
          hasText(vendor.email, needle) ||
          hasText(vendor.vendorId, needle) ||
          hasText(vendor.trnNO, needle)) &&
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
      <div className="min-h-[60dvh] bg-background flex items-center justify-center">
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Vendor Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {vendorStats.totalVendors} total vendors •{" "}
            {sortedAndFilteredVendors.length} displayed
          </p>
        </div>

        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            title="Refresh data"
            aria-label="Refresh data"
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
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
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {/* Header */}
        <div className="border-b border-border p-4 sm:p-6">
          <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h2 className="text-xl font-semibold text-foreground">All Vendors</h2>
            <Can permission="purchase.create">
              <button
                type="button"
                onClick={openAddModal}
                className="erp-btn-primary w-full sm:w-auto"
              >
                <Plus size={18} />
                Add Vendor
              </button>
            </Can>
          </div>

          {/* Filters: always showing, the same row every list of the product has (components/lists/FilterBar.jsx) */}
          <FilterBar
            search={searchTerm}
            onSearch={setSearchTerm}
            searchLabel="Search vendors"
            placeholder="Search name, ID, email or TRN…"
            active={filtersOn}
            onClear={clearFilters}
          >
            <FilterSelect
              label="Status"
              value={filterStatus}
              onChange={setFilterStatus}
              allLabel="All statuses"
              options={STATUS_OPTIONS}
            />
            <FilterSelect
              label="Payment terms"
              value={filterPaymentTerms}
              onChange={setFilterPaymentTerms}
              allLabel="All payment terms"
              options={PAYMENT_TERMS_OPTIONS}
              className="sm:w-52"
            />
          </FilterBar>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {sortedAndFilteredVendors.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4 text-muted-foreground">
                {filtersOn ? (
                  <Search size={48} className="mx-auto" aria-hidden="true" />
                ) : (
                  <User size={48} className="mx-auto" aria-hidden="true" />
                )}
              </div>
              <p className="text-foreground">
                {filtersOn ? "No vendors match the search or filters" : "No vendors yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {filtersOn
                  ? "Clear the search and filters to see every vendor."
                  : "Get started by adding your first vendor."}
              </p>
              {filtersOn && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    Clear search and filters
                  </button>
                </div>
              )}
            </div>
          ) : (
            <DataTable
              caption="Vendors"
              rows={sortedAndFilteredVendors}
              rowKey={(vendor) => vendor._id}
              columns={[
                // Sorting lives in the column header, which only the table shape shows; on a
                // card the order is whatever the page's own sort control set.
                ...[
                  { key: "vendorId", label: "Vendor ID", card: "meta", cell: (v) => <span className="font-medium text-gray-900">{v.vendorId}</span> },
                  {
                    key: "vendorName", label: "Vendor Name", card: "primary",
                    cell: (v) => (
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User size={16} className="text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{v.vendorName}</div>
                          <ExpiryPill documents={v.documents} />
                        </div>
                      </div>
                    ),
                  },
                  { key: "contactPerson", label: "Contact Person", card: "title", cell: (v) => v.contactPerson },
                  { key: "email", label: "Email", cell: (v) => <a href={`mailto:${v.email}`} className="text-blue-600 hover:text-blue-800 transition-colors">{v.email}</a> },
                  { key: "phone", label: "Phone Number", cell: (v) => <a href={`tel:${v.phone}`} className="text-blue-600 hover:text-blue-800 transition-colors">{v.phone}</a> },
                  { key: "address", label: "Billing Address", card: "hidden", cell: (v) => <div className="max-w-xs truncate" title={v.address}>{v.address}</div> },
                  { key: "trnNO", label: "TRN NO", cell: (v) => v.trnNO || "-" },
                ].map((c) => ({
                  ...c,
                  header: (
                    <button type="button" onClick={() => handleSort(c.key)} className="flex items-center space-x-1 hover:text-foreground">
                      <span>{c.label}</span>
                      {sortConfig.key === c.key && <span className="text-blue-600">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  ),
                })),
                {
                  key: "status", header: "Status", card: "badge",
                  cell: (v) => (
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(v.status)}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(v.status)}`}>{v.status}</span>
                    </div>
                  ),
                },
                {
                  key: "actions", header: "Actions", card: "actions",
                  cell: (v) => (
                    <div className="flex items-center space-x-3">
                      <Can permission="purchase.edit">
                        <button onClick={() => handleEdit(v)} className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded hover:bg-blue-50" title="Edit vendor">
                          <Edit size={16} />
                        </button>
                      </Can>
                      <Can permission="purchase.delete">
                        <button onClick={() => handleDelete(v._id, v.vendorName)} className="text-red-600 hover:text-red-800 transition-colors p-1 rounded hover:bg-red-50" title="Delete vendor">
                          <Trash2 size={16} />
                        </button>
                      </Can>
                    </div>
                  ),
                },
              ]}
            />
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