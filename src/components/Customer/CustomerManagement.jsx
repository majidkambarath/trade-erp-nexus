import React, { useCallback, useEffect, useMemo } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Clock,
  UserPlus,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import { formatCurrencyAED } from "../../utils/format";
import { useListView } from "../../lib/useListView";
import { sortRows } from "../../lib/listView";
import { CUSTOMER_STATUSES, CUSTOMER_TERMS } from "../../lib/partyForms";
import StatCard from "../ui/stat-card";

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
// emptied at sign-out. The add / edit form is the shared party form (components/parties) and keeps no draft of
// its own, so there is none to remember here.

// A customer may have no email (the field is optional) and the search reads it: an absent one reads as nothing, never throws.
const lower = (value) => String(value ?? "").toLowerCase();

const STATUS_TONE = { Active: "success", Inactive: "neutral" };
const STATUS_ICON = { Active: CheckCircle, Inactive: XCircle };

const CustomerManagement = () => {
  const list = useListView("customers", { filters: { status: "", paymentTerms: "" } });
  const { notify, toastNode } = useToasts();
  const showToastMessage = useCallback((message, type = "success") => notify(message, type), [notify]);

  const [partyModal, setPartyModal] = React.useState(null); // { customer } to edit one, {} for a new customer
  const [deleteConfirmation, setDeleteConfirmation] = React.useState({ visible: false, customerId: null, customerName: "", isDeleting: false });

  const { data, loading, error, reload } = useAsync(() => axiosInstance.get("/customers/customers").then((res) => res.data.data || []), []);
  const customers = useMemo(() => data || [], [data]);

  useEffect(() => {
    if (error) showToastMessage(error.response?.data?.message || "Failed to fetch customers.", "error");
  }, [error, showToastMessage]);

  // Money is written the same way across the product: in the organisation's currency, as text ("AED 1,234.50" by default), never an icon.
  const formatCurrency = useCallback((amount) => <span className="whitespace-nowrap tabular-nums">{formatCurrencyAED(Number(amount) || 0)}</span>, []);

  // The add / edit form is the shared party form (components/parties); the page only opens it and
  // reloads the list when it saves.
  const handleEdit = useCallback((customer) => setPartyModal({ customer }), []);
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

  const showDeleteConfirmation = useCallback((customer) => {
    setDeleteConfirmation({ visible: true, customerId: customer._id, customerName: customer.customerName, isDeleting: false });
  }, []);
  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({ visible: false, customerId: null, customerName: "", isDeleting: false });
  }, []);
  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(`/customers/${deleteConfirmation.customerId}`);
      showToastMessage("Customer deleted successfully!", "success");
      hideDeleteConfirmation();
      await reload();
    } catch (err) {
      showToastMessage(err.response?.data?.message || "Failed to delete customer.", "error");
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteConfirmation.customerId, reload, showToastMessage, hideDeleteConfirmation]);

  const handleRefresh = useCallback(() => {
    reload();
    showToastMessage("Data refreshed successfully!", "success");
  }, [reload, showToastMessage]);

  const customerStats = useMemo(
    () => ({
      activeCustomers: customers.filter((c) => c.status === "Active").length,
      inactiveCustomers: customers.filter((c) => c.status === "Inactive").length,
    }),
    [customers]
  );

  // what the empty state's wording and action follow - a search or a choice, never the sort (sorting an
  // empty-of-filters list can never itself be why nothing shows)
  const filtered = Boolean(list.search || list.filters.status || list.filters.paymentTerms);

  const filteredCustomers = useMemo(() => {
    const needle = list.search.toLowerCase();
    return customers.filter(
      (customer) =>
        (lower(customer.customerName).includes(needle) ||
          lower(customer.contactPerson).includes(needle) ||
          lower(customer.email).includes(needle) ||
          lower(customer.customerId).includes(needle)) &&
        (list.filters.status ? customer.status === list.filters.status : true) &&
        (list.filters.paymentTerms ? customer.paymentTerms === list.filters.paymentTerms : true)
    );
  }, [customers, list.search, list.filters.status, list.filters.paymentTerms]);
  const rows = useMemo(() => sortRows(filteredCustomers, list.sort), [filteredCustomers, list.sort]);

  // The usual terms, then any other a customer carries (the form turns "credit days: 15" into "Net 15", up to 365), then
  // the one chosen: so every customer can be reached from the choice and a restored choice is always one of the entries.
  const paymentTermOptions = useMemo(() => {
    const others = customers.map((c) => c.paymentTerms).filter(Boolean);
    return [...new Set([...CUSTOMER_TERMS, ...others, list.filters.paymentTerms].filter(Boolean))];
  }, [customers, list.filters.paymentTerms]);

  const emptyNode = (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 grid h-20 w-20 place-items-center rounded-full bg-muted">
        <UserPlus size={36} className="text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">
        {filtered ? "No customers match the search or filters" : "No customers yet"}
      </h3>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {filtered ? "Clear the search and filters to see every customer." : "Start building your customer base by adding your first customer."}
      </p>
      {filtered ? (
        <button type="button" onClick={list.clearFilters} className="inline-flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-accent">
          Clear search and filters
        </button>
      ) : (
        <Can permission="sales.create">
          <Button onClick={openAddModal}>
            <Plus size={20} aria-hidden="true" />
            Add First Customer
          </Button>
        </Can>
      )}
    </div>
  );

  return (
    <>
      <ListPage
        title="Customer Management"
        description={`${customers.length} total customers • ${rows.length} displayed`}
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
            <Can permission="sales.create">
              <Button data-shortcut="new" onClick={openAddModal}>
                Add Customer
              </Button>
            </Can>
          </>
        }
        beforeFilters={
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <StatCard title="Active Customers" count={customerStats.activeCustomers} icon={<Users size={24} />} subText="Show only active" tone="teal" onClick={() => list.setFilter("status", "Active")} />
            <StatCard title="Inactive Customers" count={customerStats.inactiveCustomers} icon={<Clock size={24} />} subText="Show only inactive" tone="plum" onClick={() => list.setFilter("status", "Inactive")} />
          </div>
        }
        list={list}
        noun="customers"
        searchLabel="Search customers"
        placeholder="Name, ID, email or contact…"
        filterChildren={
          <>
            <FilterSelect label="Status" value={list.filters.status} onChange={(v) => list.setFilter("status", v)} allLabel="All statuses" options={CUSTOMER_STATUSES.map((s) => [s, s])} />
            <FilterSelect label="Payment terms" value={list.filters.paymentTerms} onChange={(v) => list.setFilter("paymentTerms", v)} allLabel="All terms" options={paymentTermOptions.map((t) => [t, t])} />
          </>
        }
        caption="Customers"
        rows={rows}
        rowKey={(customer) => customer._id}
        columns={[
          { key: "customerId", header: "Customer ID", sortable: true, card: "meta", cell: (c) => <span className="font-medium text-gray-900">{c.customerId}</span> },
          { key: "trnNumber", header: taxIdWord(), sortable: true, card: "hidden", cell: (c) => (c.trnNumber ? <span className="font-medium text-gray-900">{c.trnNumber}</span> : <span className="text-sm text-gray-400">&mdash;</span>) },
          {
            key: "customerName", header: "Customer Name", sortable: true, card: "primary",
            cell: (c) => (
              <div className="flex items-center">
                <div className="flex-shrink-0 h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                  <Users size={16} className="text-purple-600" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.customerName}</div>
                  <ExpiryPill documents={c.documents} />
                </div>
              </div>
            ),
          },
          { key: "contactPerson", header: "Contact Person", sortable: true, card: "title", cell: (c) => c.contactPerson },
          { key: "salesPerson", header: "Sales Person", sortable: true, card: "hidden", cell: (c) => (c.salesPerson ? <span className="font-medium text-gray-900">{c.salesPerson}</span> : <span className="text-sm text-gray-400">&mdash;</span>) },
          { key: "email", header: "Email", sortable: true, cell: (c) => <a href={`mailto:${c.email}`} className="text-purple-600 hover:text-purple-800 transition-colors">{c.email}</a> },
          { key: "phone", header: "Phone", sortable: true, cell: (c) => <a href={`tel:${c.phone}`} className="text-purple-600 hover:text-purple-800 transition-colors">{c.phone}</a> },
          { key: "creditLimit", header: "Credit Limit", sortable: true, card: "amount", cell: (c) => <span className="font-medium text-gray-900">{formatCurrency(c.creditLimit)}</span> },
          { key: "paymentTerms", header: "Payment Terms", sortable: true, card: "meta", cell: (c) => c.paymentTerms },
          {
            key: "status", header: "Status", card: "badge",
            cell: (c) => {
              const Icon = STATUS_ICON[c.status] || AlertCircle;
              return (
                <div className="flex items-center space-x-2">
                  <Icon size={14} aria-hidden="true" />
                  <Pill tone={STATUS_TONE[c.status] || "neutral"}>{c.status}</Pill>
                </div>
              );
            },
          },
          {
            key: "actions", header: "Actions", card: "actions",
            cell: (c) => (
              <div className="flex items-center space-x-3">
                <Can permission="sales.edit">
                  <button onClick={() => handleEdit(c)} className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200" title="Edit customer">
                    <Edit size={16} />
                  </button>
                </Can>
                <Can permission="sales.delete">
                  <button onClick={() => showDeleteConfirmation(c)} className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200" title="Delete customer">
                    <Trash2 size={16} />
                  </button>
                </Can>
              </div>
            ),
          },
        ]}
        loading={loading}
        loadingLabel="Loading customers"
        error={error}
        onRetry={reload}
        empty={emptyNode}
      />

      {/* Add / edit: the shared party form */}
      {partyModal && (
        <PartyModal
          kind="customer"
          record={partyModal.customer}
          onClose={closePartyModal}
          onSaved={handlePartySaved}
        />
      )}

      {deleteConfirmation.visible && (
        <ConfirmDialog
          title="Delete Customer"
          text={`Are you sure you want to delete "${deleteConfirmation.customerName}"? This action cannot be undone and will permanently remove the customer from your database.`}
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

export default CustomerManagement;
