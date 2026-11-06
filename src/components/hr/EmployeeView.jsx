// An employee's own page (HRMS > People > a row). Profile is the directory record; Contract & cost rate is
// the pay HISTORY labour costing reads from (trade ERP node/services/hr/contractService.js) - a raise is
// always a NEW row, never an edit of the current one, so what this page shows for a past day never moves.
//
// Pay figures are hidden unless the server actually sent them: ContractService.list strips every money field
// for a reader without hr.confidential, and `row.hourlyCost === undefined` (not 0, not null) is how this page
// tells "hidden from you" apart from "nothing recorded" - the same distinction trade ERP node's utils/hr.js
// insists on for a missing cost rate.
import React, { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { DateInput, ErrorNote, Field, Modal, Pill, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import { employees, contracts, employeeDocuments, payroll } from "../../lib/hrApi";
import { contractSummary } from "../../lib/hr";
import { formatDate, CURRENCY, formatNumber } from "../../utils/format";
import Can from "../shell/Can.jsx";
import { useOrganisation } from "../shell/OrganisationContext";
import EmployeeForm from "./EmployeeForm";
import ContractForm from "./ContractForm";

function Fact({ icon, label, children }) {
  const Icon = icon;
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-foreground">{children || <span className="text-muted-foreground">Not provided</span>}</dd>
    </div>
  );
}

function ContractRow({ row }) {
  const s = contractSummary(row);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {formatDate(s.from)} {s.to ? `– ${formatDate(s.to)}` : ""}
        </p>
        {s.hasPay ? (
          <p className="text-xs text-muted-foreground">
            {CURRENCY} {formatNumber(s.hourlyCost)}/hour{s.monthlyCost ? ` · ${CURRENCY} ${formatNumber(s.monthlyCost)}/month` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Pay hidden - you do not hold the permission to see it</p>
        )}
      </div>
      {s.current && <Pill tone="success">Current</Pill>}
    </div>
  );
}

function DocumentForm({ staffId, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", number: "", expiryDate: "", notes: "" });
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const saved = await employeeDocuments.create({ ...form, staffId });
      onSaved(saved, "Document saved.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="New document"
      description="A labour card, a visa, a passport - whatever this organisation tracks the expiry of."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Name" required><TextInput value={form.name} onChange={setField("name")} placeholder="Labour card" /></Field>
        <Field label="Number" hint="Optional"><TextInput value={form.number} onChange={setField("number")} /></Field>
        <Field label="Expiry day" hint="Optional"><DateInput value={form.expiryDate} onChange={setField("expiryDate")} /></Field>
        <Field label="Notes" hint="Optional"><TextInput value={form.notes} onChange={setField("notes")} /></Field>
      </div>
    </Modal>
  );
}

export default function EmployeeView() {
  const { id } = useParams();
  const { notify, toastNode } = useToasts();
  const { canAny } = useOrganisation();
  // The server REFUSES payslipsForStaff outright without hr.confidential (it is pay data, like a
  // contract's own figures) - skip the call entirely rather than showing a 403 in the tab for every
  // ordinary HR reader who can see this page but not what anyone is paid.
  const seesPay = canAny("hr.confidential");
  const employee = useAsync(() => employees.get(id), [id]);
  const history = useAsync(() => contracts.list(id), [id]);
  const documents = useAsync(() => employeeDocuments.forStaff(id), [id]);
  const payslips = useAsync(() => (seesPay ? payroll.payslipsForStaff(id) : Promise.resolve([])), [id, seesPay]);
  const [editing, setEditing] = useState(false);
  const [addingContract, setAddingContract] = useState(false);
  const [addingDocument, setAddingDocument] = useState(false);

  async function removeDocument(docId) {
    try {
      await employeeDocuments.remove(docId);
      notify("Document removed.");
      documents.reload();
    } catch (err) {
      notify(err.message || "Could not remove that document.", "error");
    }
  }

  if (employee.loading) return <div className="p-6"><Spinner /></div>;
  if (employee.error) return <div className="p-6"><ErrorNote error={employee.error} onRetry={employee.reload} /></div>;
  const e = employee.data;
  if (!e) return null;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/hr/people" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> People
        </Link>
        <Can permission="hr.manage">
          <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
        </Can>
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-foreground">{e.name}</h1>
        <Pill tone={e.status === "Inactive" ? "neutral" : "success"}>{e.status === "Inactive" ? "Inactive" : "Active"}</Pill>
        <span className="font-mono text-xs text-muted-foreground">{e.staffId}</span>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="contract">Contract &amp; cost rate</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-border p-4 sm:grid-cols-3">
            <Fact label="Designation">{e.designation}</Fact>
            <Fact label="Department">{e.department}</Fact>
            <Fact label="Nationality">{e.nationality}</Fact>
            <Fact icon={Phone} label="Contact">{e.contactNo}</Fact>
            <Fact icon={Mail} label="Email">{e.email}</Fact>
            <Fact label="ID / passport">{e.idNo}</Fact>
            <Fact label="Joined">{e.joiningDate ? formatDate(e.joiningDate) : null}</Fact>
            <Fact label="Left">{e.exitDate ? formatDate(e.exitDate) : null}</Fact>
          </div>
        </TabsContent>

        <TabsContent value="contract">
          <div className="flex items-center justify-between gap-3 pb-3">
            <p className="text-sm text-muted-foreground">
              What an hour of this person's work costs, and when each rate took effect. A new rate is always a
              new row - it never changes what work already costed before it.
            </p>
            <Can permission="hr.confidential">
              <Button variant="outline" onClick={() => setAddingContract(true)}>
                <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New contract
              </Button>
            </Can>
          </div>
          {history.loading && <Spinner />}
          {history.error && <ErrorNote error={history.error} onRetry={history.reload} />}
          {!history.loading && !history.error && (
            (history.data || []).length ? (
              <div className="grid gap-2">
                {history.data.map((row) => <ContractRow key={row._id} row={row} />)}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No contract on file yet, so this person's work cannot be costed until one is added.
              </p>
            )
          )}
        </TabsContent>

        <TabsContent value="documents">
          <div className="flex items-center justify-between gap-3 pb-3">
            <p className="text-sm text-muted-foreground">A labour card, a visa, a passport - an expired one blocks assigning this person new work.</p>
            <Can permission="hr.manage">
              <Button variant="outline" onClick={() => setAddingDocument(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New document</Button>
            </Can>
          </div>
          {documents.loading && <Spinner />}
          {documents.error && <ErrorNote error={documents.error} onRetry={documents.reload} />}
          {!documents.loading && !documents.error && (
            (documents.data || []).length ? (
              <div className="grid gap-2">
                {documents.data.map((d) => (
                  <div key={d._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{d.name}{d.number ? ` · ${d.number}` : ""}</p>
                      <p className="text-xs text-muted-foreground">{d.expiryDate ? `Expires ${formatDate(d.expiryDate)}` : "No expiry set"}</p>
                    </div>
                    <Can permission="hr.manage">
                      <Button variant="ghost" size="sm" onClick={() => removeDocument(d._id)}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                    </Can>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No documents on file.</p>
            )
          )}
        </TabsContent>

        <TabsContent value="payslips">
          {!seesPay ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Payslips are hidden - you do not hold the permission to see pay.</p>
          ) : (
            <>
              {payslips.loading && <Spinner />}
              {payslips.error && <ErrorNote error={payslips.error} onRetry={payslips.reload} />}
              {!payslips.loading && !payslips.error && (
                (payslips.data || []).length ? (
                  <div className="grid gap-2">
                    {payslips.data.map((p) => (
                      <div key={p._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                        <p className="font-medium text-foreground">{p.period}</p>
                        <span className="text-foreground">{CURRENCY} {formatNumber(p.netPay)} net</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No payroll run has paid this person yet.</p>
                )
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {addingDocument && (
        <DocumentForm
          staffId={id}
          onClose={() => setAddingDocument(false)}
          onSaved={(_, message) => { setAddingDocument(false); notify(message); documents.reload(); }}
        />
      )}
      {editing && (
        <EmployeeForm
          employee={e}
          onClose={() => setEditing(false)}
          onSaved={(_, message) => { setEditing(false); notify(message); employee.reload(); }}
        />
      )}
      {addingContract && (
        <ContractForm
          staffId={id}
          onClose={() => setAddingContract(false)}
          onSaved={(_, message) => { setAddingContract(false); notify(message); history.reload(); }}
        />
      )}
      {toastNode}
    </div>
  );
}
