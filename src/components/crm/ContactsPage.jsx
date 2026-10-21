// Contacts: the people, not the companies.
//
// Before this a contact was a line inside the customer form, so "what did I discuss with Rajesh" had no screen to ask
// it on. A person now has their own page with their own history. The record is shared with the party's own contact
// list under one id (see the server's services/crm/contactService.js), so editing here and editing on the customer
// form are the same edit - there is no second address book to keep in step.
//
// This is the first CRM screen on the list platform (ListPage + useListView), because it is a MASTER list, the same
// kind of screen as Customers and Vendors: it earns saved views and sorting. The Leads list is still hand-built.
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Download, Plus, Upload } from "lucide-react";
import { PageHeader, Panel, PageSpinner, ErrorNote, EmptyState, DataTable, useAsync, useToasts, Field, TextInput, Textarea, Select, SearchSelect } from "../accounting/kit.jsx";
import ListPage from "../lists/ListPage";
import { FilterSelect } from "../lists/FilterBar.jsx";
import { useListView } from "../../lib/useListView";
import Can from "../shell/Can.jsx";
import { useRecordRoute } from "../../lib/useRecordRoute";
import { formatDate, downloadCSV } from "../../utils/format";
import { api } from "../../lib/accountingApi";
import { crm } from "../../lib/crmApi";
import * as rules from "../../lib/crm";
import { ActivityTimeline, CrmDialog, KindIcon, LogActivityDialog, Tag, useOwners } from "./crmShared.jsx";
import ImportDialog from "./ImportDialog.jsx";
import { useOrganisation } from "../shell/OrganisationContext.jsx";

const Fact = ({ label, children }) => (
  <div className="flex justify-between gap-4 border-b border-border/60 py-2 last:border-0">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="text-right text-sm font-medium text-foreground">{children || "-"}</dd>
  </div>
);

const PartyTag = ({ row }) =>
  row.partyKind === "customer" ? (
    <Tag tone="info">Customer</Tag>
  ) : row.partyKind === "vendor" ? (
    <Tag tone="default">Supplier</Tag>
  ) : (
    <Tag tone="warning">Nobody yet</Tag>
  );

/** The form. A person needs a name; everything else is what you happen to know. */
function ContactForm({ contact, onClose, onSaved, notify }) {
  const [form, setForm] = useState(() => ({ ...rules.emptyContact(), ...(contact || {}) }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [parties, setParties] = useState([]);
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event?.target ? event.target.value : event }));

  // The companies a person can be attached to. Loaded on demand, like every other long picker here.
  React.useEffect(() => {
    let alive = true;
    const path = form.partyKind === "vendor" ? "/vendors/vendors" : "/customers/customers";
    if (!form.partyKind) return undefined;
    api
      .get(path, { params: { limit: 300 } })
      .then((rows) => {
        if (!alive) return;
        const list = Array.isArray(rows) ? rows : rows?.rows || [];
        setParties(list.map((p) => ({ value: String(p._id), label: p.customerName || p.vendorName || p.name || "" })));
      })
      .catch(() => alive && setParties([]));
    return () => {
      alive = false;
    };
  }, [form.partyKind]);

  const save = async () => {
    const found = rules.validateContact(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setProblem(null);
    try {
      const body = rules.contactBody(form);
      if (contact?._id) await crm.updateContact(contact._id, body);
      else await crm.createContact(body);
      notify?.(contact?._id ? "Saved" : `${body.name} was added`);
      onSaved?.();
    } catch (error) {
      setProblem(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CrmDialog
      title={contact?._id ? "Edit the person" : "Add a person"}
      description="Who you actually speak to. A person can belong to a customer or a supplier, or to nobody yet."
      confirmLabel="Save"
      busy={busy}
      problem={problem}
      onClose={onClose}
      onConfirm={save}
    >
      <Field label="Name" required error={errors.name}>
        <TextInput value={form.name} onChange={set("name")} data-autofocus />
      </Field>
      <Field label="Job title">
        <TextInput value={form.designation} onChange={set("designation")} placeholder="Purchase Manager" />
      </Field>
      <Field label="Phone">
        <TextInput value={form.phone} onChange={set("phone")} />
      </Field>
      <Field label="Email" error={errors.email}>
        <TextInput value={form.email} onChange={set("email")} />
      </Field>
      <Field label="Works for">
        <Select value={form.partyKind} onChange={(e) => setForm((f) => ({ ...f, partyKind: e.target.value, partyId: "" }))}>
          <option value="">Nobody yet</option>
          <option value="customer">A customer</option>
          <option value="vendor">A supplier</option>
        </Select>
      </Field>
      {form.partyKind ? (
        <Field label={form.partyKind === "vendor" ? "Supplier" : "Customer"}>
          <SearchSelect value={form.partyId} onChange={set("partyId")} options={parties} placeholder="Choose one" clearable />
        </Field>
      ) : null}
      <Field label="Notes" className="sm:col-span-2">
        <Textarea rows={3} value={form.notes} onChange={set("notes")} placeholder="Prefers a call before noon" />
      </Field>
    </CrmDialog>
  );
}

/** One person's page: who they are, who they work for, and everything that has been said to them. */
function ContactView({ id, notify, onBack, onChanged }) {
  const { can } = useOrganisation();
  // The company's own page is a Sales / Accounts page. An organisation that bought the CRM alone, or a role that holds
  // neither, is shown the company's name: a link to a screen they will be told they cannot open helps nobody.
  const partyOpens = can("sales.view") || can("accounts.view");
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState(null);
  const owners = useOwners();
  const { data, loading, error } = useAsync(() => crm.contact(id), [id, reload]);
  const again = () => {
    setReload((n) => n + 1);
    onChanged?.();
  };

  if (loading && !data) return <PageSpinner label="Reading the person" />;
  if (error) return <ErrorNote error={error} onRetry={again} />;
  if (!data) return null;

  const remove = async () => {
    try {
      await crm.removeContact(id);
      notify?.(`${data.name} was removed`);
      onBack?.();
      onChanged?.();
    } catch (problem) {
      notify?.(problem.message, "error");
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All contacts
      </button>
      <PageHeader
        title={data.name}
        description={[data.designation, data.party?.name].filter(Boolean).join(" · ") || "Not attached to a company yet"}
        actions={
          <>
            <Can permission="crm.create">
              <button type="button" onClick={() => setDialog("log")} className="h-10 rounded-lg border border-input px-3 text-sm hover:bg-accent">
                Log a follow-up
              </button>
            </Can>
            <Can permission="crm.edit">
              <button type="button" data-shortcut="new" onClick={() => setDialog("edit")} className="h-10 rounded-lg border border-input px-3 text-sm hover:bg-accent">
                Edit
              </button>
            </Can>
            <Can permission="crm.delete">
              <button type="button" onClick={remove} className="h-10 rounded-lg border border-input px-3 text-sm text-status-danger hover:bg-accent">
                Remove
              </button>
            </Can>
          </>
        }
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="The person" className="lg:col-span-1">
          <dl>
            <Fact label="Job title">{data.designation}</Fact>
            <Fact label="Phone">{data.phone}</Fact>
            <Fact label="Email">{data.email}</Fact>
            <Fact label="Works for">
              {data.party ? (
                partyOpens ? (
                  <Link
                    to={data.party.kind === "vendor" ? `/debit-accounts/vendor/${data.party.id}` : `/credit-accounts/customer/${data.party.id}?tab=crm`}
                    className="hover:underline"
                  >
                    {data.party.name}
                  </Link>
                ) : (
                  data.party.name
                )
              ) : (
                <PartyTag row={data} />
              )}
            </Fact>
            <Fact label="Main contact">{data.isPrimary ? "Yes" : "No"}</Fact>
            <Fact label="Added">{formatDate(data.createdAt)}</Fact>
          </dl>
          {data.notes ? <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{data.notes}</p> : null}
        </Panel>

        <Panel title="What has been said" className="lg:col-span-2" bodyClassName="p-0 sm:px-4">
          <ActivityTimeline rows={data.timeline} empty="Nothing has been logged against this person yet." />
        </Panel>
      </div>

      {dialog === "edit" && (
        <ContactForm
          contact={{ ...data, partyKind: data.partyKind || "", partyId: data.partyId || "" }}
          notify={notify}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            again();
          }}
        />
      )}
      {dialog === "log" && (
        <LogActivityDialog
          regarding={{ kind: "contact", id, name: data.name }}
          owners={owners}
          notify={notify}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            again();
          }}
        />
      )}
    </div>
  );
}

export default function ContactsPage() {
  const { notify, toastNode } = useToasts();
  const record = useRecordRoute({ param: "contact" });
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [reload, setReload] = useState(0);
  const again = () => setReload((n) => n + 1);

  const list = useListView("crm-contacts", { filters: { linked: "" } });
  const query = useMemo(() => ({ search: list.search, linked: list.filters.linked, limit: 300 }), [list.key]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading, error, reload: retry } = useAsync(() => crm.contacts(query), [query, reload]);
  const rows = data || [];

  if (record.recordId) {
    return (
      <>
        <ContactView id={record.recordId} notify={notify} onBack={() => record.close()} onChanged={again} />
        {toastNode}
      </>
    );
  }

  return (
    <>
      <ListPage
        title="Contacts"
        description="The people behind the companies. The same record the customer form shows."
        actions={
          <>
            <button
              type="button"
              onClick={() => {
                const csv = rules.contactsCsv(rows);
                downloadCSV(`crm-contacts-${new Date().toISOString().slice(0, 10)}.csv`, csv.headers, csv.rows);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-input px-3 text-sm hover:bg-accent"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Export
            </button>
            <Can permission="crm.create">
              <button type="button" onClick={() => setImporting(true)} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-input px-3 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" aria-hidden="true" /> Import
              </button>
            </Can>
            <Can permission="crm.create">
              <button
                type="button"
                data-shortcut="new"
                onClick={() => setAdding(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> New contact
              </button>
            </Can>
          </>
        }
        list={list}
        noun="contacts"
        searchLabel="Search contacts"
        placeholder="Search a name, a number or an email…"
        filterChildren={
          <FilterSelect
            label="Works for"
            value={list.filters.linked}
            onChange={(v) => list.setFilter("linked", v)}
            allLabel="Everyone"
            options={[
              ["customer", "Customers"],
              ["vendor", "Suppliers"],
              ["none", "Nobody yet"],
            ].map(([value, label]) => ({ value, label }))}
          />
        }
        caption="Contacts"
        rows={rows}
        rowKey={(r) => r._id}
        onRowClick={(r) => record.open(r._id)}
        loading={loading}
        loadingLabel="Reading the contacts"
        error={error}
        onRetry={retry}
        emptyTitle="No contacts yet"
        emptyText="Add the person you actually speak to, or qualify an enquiry and they appear here by themselves."
        columns={[
          {
            key: "name",
            header: "Name",
            sortable: true,
            card: "primary",
            // A real link, not only a clickable row: it can be opened in a new tab and copied.
            cell: (r) => (
              <Link to={`/crm/contacts?contact=${r._id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-foreground hover:underline">
                {r.name}
              </Link>
            ),
          },
          { key: "designation", header: "Job title", sortable: true, card: "title", cell: (r) => r.designation || "" },
          { key: "linked", header: "Works for", card: "badge", cell: (r) => <PartyTag row={r} /> },
          { key: "phone", header: "Phone", card: "meta", cell: (r) => r.phone || "" },
          { key: "email", header: "Email", card: "meta", cell: (r) => r.email || "" },
          { key: "primary", header: "Main", card: "hidden", cell: (r) => (r.isPrimary ? "Yes" : "") },
        ]}
      />
      {importing && (
        <ImportDialog
          kind="contact"
          notify={notify}
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            again();
          }}
        />
      )}
      {adding && (
        <ContactForm
          notify={notify}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            again();
          }}
        />
      )}
      {toastNode}
    </>
  );
}
