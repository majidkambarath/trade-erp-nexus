import React, { useCallback, useEffect, useMemo } from "react";
import {
  Edit,
  Trash2,
  User,
  Search,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import { useListView } from "../../lib/useListView";
import { sortRows } from "../../lib/listView";

import PartyModal from "../parties/PartyModal";
import ExpiryPill from "../parties/ExpiryPill";
import { Button } from "../ui/button";
import ListPage from "../lists/ListPage";
import { FilterSelect } from "../lists/FilterBar";
import { ConfirmDialog, Pill, useAsync, useToasts } from "../accounting/kit";
import Can from "../shell/Can";
import { taxIdWord } from "../../lib/taxTerms";

// What this screen keeps while the person visits another page and comes back (lib/pageSession.js): the search,
// the two choices and the column it is sorted by - all via useListView, below. Held in memory for the tab;
// emptied at sign-out. The add / edit form is the shared party form (components/parties) and keeps no draft
// here, as before.
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

const STATUS_TONE = { Compliant: "success", "Non-compliant": "danger", Pending: "warning", Expired: "neutral" };
const STATUS_ICON = { Compliant: CheckCircle, "Non-compliant": XCircle, Pending: Clock, Expired: AlertCircle };

const VendorManagement = () => {
  // search/filters/sort for this list - lib/useListView.js. Every row is fetched at once (vendors are not a
  // list that grows into the thousands), so filtering and sorting both run in the browser, synchronously -
  // no debounce, no server round trip, no staleness guard to worry about.
  const list = useListView("vendor-management", { filters: { status: "", paymentTerms: "" } });
  const { notify, toastNode } = useToasts();
  const showToastMessage = useCallback((message, type = "success") => notify(message, type), [notify]);

  const [partyModal, setPartyModal] = React.useState(null); // { vendor } to edit one, {} for a new vendor
  const [deleteConfirmation, setDeleteConfirmation] = React.useState({ visible: false, itemName: "", id: null, isDeleting: false });

  const { data, loading, error, reload } = useAsync(() => axiosInstance.get("/vendors/vendors").then((res) => res.data.data || []), []);
  const vendors = useMemo(() => data || [], [data]);

  useEffect(() => {
    if (error) showToastMessage(error.response?.data?.message || "Failed to fetch vendors.", "error");
  }, [error, showToastMessage]);

  // what the empty state's wording follows - a search or a choice, never the sort (sorting an empty-of-filters
  // list can never itself be why nothing shows)
  const filtered = Boolean(list.search || list.filters.status || list.filters.paymentTerms);

  const filteredVendors = useMemo(() => {
    const needle = list.search.toLowerCase();
    return vendors.filter(
      (vendor) =>
        (hasText(vendor.vendorName, needle) ||
          hasText(vendor.contactPerson, needle) ||
          hasText(vendor.email, needle) ||
          hasText(vendor.vendorId, needle) ||
          hasText(vendor.trnNO, needle)) &&
        (list.filters.status ? vendor.status === list.filters.status : true) &&
        (list.filters.paymentTerms ? vendor.paymentTerms === list.filters.paymentTerms : true)
    );
  }, [vendors, list.search, list.filters.status, list.filters.paymentTerms]);
  const rows = useMemo(() => sortRows(filteredVendors, list.sort), [filteredVendors, list.sort]);

  // The add / edit form is the shared party form (components/parties); the page only opens it and
  // reloads the list when it saves.
  const handleEdit = useCallback((vendor) => setPartyModal({ vendor }), []);
  const openAddModal = useCallback(() => setPartyModal({}), []);
  const closePartyModal = useCallback(() => setPartyModal(null), []);
  const handlePartySaved = useCallback(
    async (_saved, message) => {
      setPartyModal(null);
      await reload();
      showToastMessage(message, "success");
    },
    [reload, showToastMessage]
  );

  const handleDelete = useCallback((id, vendorName) => {
    setDeleteConfirmation({ visible: true, itemName: vendorName, id, isDeleting: false });
  }, []);
  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({ visible: false, itemName: "", id: null, isDeleting: false });
  }, []);
  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(`/vendors/vendors/${deleteConfirmation.id}`);
      await reload();
      showToastMessage("Vendor deleted successfully!", "success");
      hideDeleteConfirmation();
    } catch (err) {
      showToastMessage(err.response?.data?.message || "Failed to delete vendor.", "error");
    } finally {
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteConfirmation.id, reload, showToastMessage, hideDeleteConfirmation]);

  const handleRefresh = useCallback(() => {
    reload();
    showToastMessage("Data refreshed successfully!", "success");
  }, [reload, showToastMessage]);

  const emptyNode = (
    <div className="text-center py-12">
      <div className="mb-4 text-muted-foreground">
        {filtered ? <Search size={48} className="mx-auto" aria-hidden="true" /> : <User size={48} className="mx-auto" aria-hidden="true" />}
      </div>
      <p className="text-foreground">{filtered ? "No vendors match the search or filters" : "No vendors yet"}</p>
      <p className="text-sm text-muted-foreground">
        {filtered ? "Clear the search and filters to see every vendor." : "Get started by adding your first vendor."}
      </p>
      {filtered && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={list.clearFilters} className="inline-flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-accent">
            Clear search and filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <ListPage
        title="Vendor Management"
        description={`${vendors.length} total vendors • ${rows.length} displayed`}
        actions={
          <>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="grid h-10 w-10 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <Can permission="purchase.create">
              <Button data-shortcut="new" onClick={openAddModal}>
                Add Vendor
              </Button>
            </Can>
          </>
        }
        list={list}
        noun="vendors"
        searchLabel="Search vendors"
        placeholder="Search name, ID, email or TRN…"
        filterChildren={
          <>
            <FilterSelect label="Status" value={list.filters.status} onChange={(v) => list.setFilter("status", v)} allLabel="All statuses" options={STATUS_OPTIONS} />
            <FilterSelect label="Payment terms" value={list.filters.paymentTerms} onChange={(v) => list.setFilter("paymentTerms", v)} allLabel="All payment terms" options={PAYMENT_TERMS_OPTIONS} className="sm:w-52" />
          </>
        }
        caption="Vendors"
        rows={rows}
        rowKey={(vendor) => vendor._id}
        columns={[
          { key: "vendorId", header: "Vendor ID", sortable: true, card: "meta", cell: (v) => <span className="font-medium text-gray-900">{v.vendorId}</span> },
          {
            key: "vendorName", header: "Vendor Name", sortable: true, card: "primary",
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
          { key: "contactPerson", header: "Contact Person", sortable: true, card: "title", cell: (v) => v.contactPerson },
          { key: "email", header: "Email", sortable: true, cell: (v) => <a href={`mailto:${v.email}`} className="text-blue-600 hover:text-blue-800 transition-colors">{v.email}</a> },
          { key: "phone", header: "Phone Number", sortable: true, cell: (v) => <a href={`tel:${v.phone}`} className="text-blue-600 hover:text-blue-800 transition-colors">{v.phone}</a> },
          { key: "address", header: "Billing Address", sortable: true, card: "hidden", cell: (v) => <div className="max-w-xs truncate" title={v.address}>{v.address}</div> },
          { key: "trnNO", header: taxIdWord(), sortable: true, cell: (v) => v.trnNO || "-" },
          {
            key: "status", header: "Status", card: "badge",
            cell: (v) => {
              const Icon = STATUS_ICON[v.status] || AlertCircle;
              return (
                <div className="flex items-center space-x-2">
                  <Icon size={14} aria-hidden="true" />
                  <Pill tone={STATUS_TONE[v.status] || "neutral"}>{v.status}</Pill>
                </div>
              );
            },
          },
          {
            key: "actions", header: "Actions", card: "actions",
            cell: (v) => (
              <div className="flex items-center space-x-3">
                <Can permission="purchase.edit">
                  <button onClick={() => handleEdit(v)} className="grid h-10 w-10 place-items-center rounded text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-800 lg:h-8 lg:w-8" title="Edit vendor">
                    <Edit size={16} />
                  </button>
                </Can>
                <Can permission="purchase.delete">
                  <button onClick={() => handleDelete(v._id, v.vendorName)} className="grid h-10 w-10 place-items-center rounded text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 lg:h-8 lg:w-8" title="Delete vendor">
                    <Trash2 size={16} />
                  </button>
                </Can>
              </div>
            ),
          },
        ]}
        loading={loading}
        loadingLabel="Loading vendors"
        error={error}
        onRetry={reload}
        empty={emptyNode}
      />

      {/* Add / edit: the shared party form */}
      {partyModal && (
        <PartyModal
          kind="vendor"
          record={partyModal.vendor}
          onClose={closePartyModal}
          onSaved={handlePartySaved}
        />
      )}

      {deleteConfirmation.visible && (
        <ConfirmDialog
          title="Delete Vendor"
          text={`Are you sure you want to delete "${deleteConfirmation.itemName}"? This action cannot be undone and will permanently remove the vendor from your records.`}
          confirmLabel="Delete"
          danger
          busy={deleteConfirmation.isDeleting}
          onClose={hideDeleteConfirmation}
          onConfirm={confirmDelete}
        />
      )}

      {toastNode}
    </>
  );
};

export default VendorManagement;
