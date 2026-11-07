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
import { ConfirmDialog, DateInput, ErrorNote, Field, Modal, Pill, Spinner, TextInput, useAsync, useToasts } from "../accounting/kit";
import { employees, contracts, employeeDocuments, payroll, assets as assetsApi, employeePortal, checklists, appraisals } from "../../lib/hrApi";
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

function ContractRow({ row, onRemove }) {
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
      <div className="flex items-center gap-2">
        {s.current && <Pill tone="success">Current</Pill>}
        {/* A contract is pay HISTORY, so this is for correcting a row entered wrongly, not for ending one
            (that is a new row with its own effectiveFrom). Same permission the server asks of the route. */}
        <Can permission="hr.confidential">
          <Button variant="ghost" size="sm" onClick={() => onRemove(row)} aria-label="Remove this contract row">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Can>
      </div>
    </div>
  );
}

function PortalAccessForm({ staffId, current, onClose, onSaved }) {
  const [phone, setPhone] = useState(current?.phone || "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      await employeePortal.set(staffId, { phone, password });
      onSaved(current?.hasAccount ? "Portal access reset. Give them the new password directly - it is not shown again." : "Portal access set up. Give them the password directly - it is not shown again.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title={current?.hasAccount ? "Reset portal access" : "Set up portal access"}
      description="They sign in with this phone number and password at /portal. They will be asked to choose their own password the first time."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy || !phone || !password}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Phone number" required><TextInput value={phone} onChange={(e) => setPhone(e?.target ? e.target.value : e)} placeholder="+971501234567" /></Field>
        <Field label="Temporary password" required hint="At least 8 characters - tell them this directly, it is never shown again"><TextInput value={password} onChange={(e) => setPassword(e?.target ? e.target.value : e)} /></Field>
      </div>
    </Modal>
  );
}

function PortalAccessPanel({ staffId }) {
  const { notify, toastNode } = useToasts();
  const status = useAsync(() => employeePortal.status(staffId), [staffId]);
  const [editing, setEditing] = useState(false);

  async function disable() {
    try {
      await employeePortal.disable(staffId);
      notify("Portal access disabled.");
      status.reload();
    } catch (err) {
      notify(err.message || "Could not disable portal access.", "error");
    }
  }

  if (status.loading) return null;
  const s = status.data;

  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Self-service portal</h2>
          {s?.hasAccount ? (
            <p className="text-xs text-muted-foreground">
              {s.phone} · <Pill tone={s.status === "active" ? "success" : "neutral"}>{s.status === "active" ? "Active" : "Disabled"}</Pill>
              {s.mustChangePassword && <span> · has not chosen their own password yet</span>}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No portal access set up - they cannot sign in to check their own attendance, leave or payslips.</p>
          )}
        </div>
        <Can permission="hr.manage">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>{s?.hasAccount ? "Reset" : "Set up"}</Button>
            {s?.hasAccount && s.status === "active" && <Button variant="ghost" size="sm" onClick={disable}>Disable</Button>}
          </div>
        </Can>
      </div>
      {editing && (
        <PortalAccessForm
          staffId={staffId}
          current={s}
          onClose={() => setEditing(false)}
          onSaved={(message) => { setEditing(false); notify(message); status.reload(); }}
        />
      )}
      {toastNode}
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

function AssetForm({ staffId, onClose, onSaved }) {
  const [form, setForm] = useState({ assetName: "", assetTag: "", issuedDate: new Date().toISOString().slice(0, 10), condition: "" });
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const saved = await assetsApi.issue({ ...form, staffId });
      onSaved(saved, "Asset issued.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="sm"
      onClose={onClose}
      title="Issue an asset"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <Field label="Asset" required><TextInput value={form.assetName} onChange={setField("assetName")} placeholder="Dell Laptop" /></Field>
        <Field label="Tag / serial" hint="Optional"><TextInput value={form.assetTag} onChange={setField("assetTag")} /></Field>
        <Field label="Issued on" required><DateInput value={form.issuedDate} onChange={setField("issuedDate")} /></Field>
        <Field label="Condition" hint="Optional"><TextInput value={form.condition} onChange={setField("condition")} placeholder="New" /></Field>
      </div>
    </Modal>
  );
}

function AppraisalForm({ staffId, onClose, onSaved }) {
  const [form, setForm] = useState({ periodLabel: "", reviewDate: new Date().toISOString().slice(0, 10), rating: "", strengths: "", improvements: "", goals: "" });
  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      const saved = await appraisals.create(staffId, form);
      onSaved(saved, "Appraisal saved.");
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title="New appraisal"
      description="A plain record - no score, no fixed scale. Write what actually matters for this review."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Period" required hint="e.g. 2026 annual review"><TextInput value={form.periodLabel} onChange={setField("periodLabel")} /></Field>
          <Field label="Review date" required><DateInput value={form.reviewDate} onChange={setField("reviewDate")} /></Field>
        </div>
        <Field label="Rating" hint="Free text - e.g. Exceeds expectations"><TextInput value={form.rating} onChange={setField("rating")} /></Field>
        <Field label="Strengths"><TextInput value={form.strengths} onChange={setField("strengths")} /></Field>
        <Field label="Areas to improve"><TextInput value={form.improvements} onChange={setField("improvements")} /></Field>
        <Field label="Goals for next period"><TextInput value={form.goals} onChange={setField("goals")} /></Field>
      </div>
    </Modal>
  );
}

// W6: one column per checklist (onboarding/exit). A list type with no items yet offers "Start checklist"
// (ChecklistService.start seeds the standard items); once started, a person may add their own on top and
// mark items done - one-way, like the server enforces (NOT_OPEN on a second attempt).
function ChecklistColumn({ title, listType, items, loading, error, onRetry, onStart, onAddItem, onMarkDone, onRemove, canManage }) {
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(false);

  async function addNow() {
    const subject = newItem.trim();
    if (!subject) return;
    setBusy(true);
    try {
      await onAddItem(subject);
      setNewItem("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {canManage && !loading && items.length === 0 && (
          <Button variant="outline" size="sm" onClick={onStart}>Start checklist</Button>
        )}
      </div>
      {loading && <Spinner />}
      {error && <ErrorNote error={error} onRetry={onRetry} />}
      {!loading && !error && (
        items.length ? (
          <div className="grid gap-2">
            {items.map((item) => (
              <div key={item._id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-sm">
                <div className="min-w-0">
                  <p className={item.status === "DONE" ? "truncate text-muted-foreground line-through" : "truncate text-foreground"}>{item.subject}</p>
                  {item.status === "DONE" && item.completedAt && (
                    <p className="text-xs text-muted-foreground">Done {formatDate(item.completedAt)}</p>
                  )}
                </div>
                {canManage && item.status === "OPEN" && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => onMarkDone(item._id)}>Done</Button>
                    <Button variant="ghost" size="sm" onClick={() => onRemove(item._id)}><Trash2 className="h-4 w-4" aria-hidden="true" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No {listType} checklist started yet.</p>
        )
      )}
      {canManage && items.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <TextInput value={newItem} onChange={(e) => setNewItem(e?.target ? e.target.value : e)} placeholder="Add an item" />
          <Button variant="outline" size="sm" onClick={addNow} disabled={busy || !newItem.trim()}>Add</Button>
        </div>
      )}
    </div>
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
  const assetList = useAsync(() => assetsApi.forStaff(id), [id]);
  const checklist = useAsync(() => checklists.forStaff(id), [id]);
  const appraisalList = useAsync(() => appraisals.forStaff(id), [id]);
  const [editing, setEditing] = useState(false);
  const [addingContract, setAddingContract] = useState(false);
  const [addingDocument, setAddingDocument] = useState(false);
  const [issuingAsset, setIssuingAsset] = useState(false);
  const [addingAppraisal, setAddingAppraisal] = useState(false);
  const [removingContract, setRemovingContract] = useState(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const canManageChecklists = canAny("hr.manage");

  async function removeDocument(docId) {
    try {
      await employeeDocuments.remove(docId);
      notify("Document removed.");
      documents.reload();
    } catch (err) {
      notify(err.message || "Could not remove that document.", "error");
    }
  }

  async function returnAsset(assetId) {
    try {
      await assetsApi.markReturned(assetId, {});
      notify("Marked returned.");
      assetList.reload();
    } catch (err) {
      notify(err.message || "Could not mark that returned.", "error");
    }
  }

  async function startChecklist(listType) {
    try {
      await checklists.start({ staffId: id, listType });
      notify(`${listType === "onboarding" ? "Onboarding" : "Exit"} checklist started.`);
      checklist.reload();
    } catch (err) {
      notify(err.message || "Could not start that checklist.", "error");
    }
  }

  async function addChecklistItem(listType, subject) {
    try {
      await checklists.addItem({ staffId: id, listType, subject });
      checklist.reload();
    } catch (err) {
      notify(err.message || "Could not add that item.", "error");
    }
  }

  async function markChecklistItemDone(itemId) {
    try {
      await checklists.markDone(itemId);
      checklist.reload();
    } catch (err) {
      notify(err.message || "Could not mark that done.", "error");
    }
  }

  async function removeContract() {
    setRemovingBusy(true);
    try {
      await contracts.remove(removingContract._id);
      notify("Contract row removed.");
      setRemovingContract(null);
      history.reload();
    } catch (err) {
      notify(err.message || "Could not remove that contract.", "error");
    } finally {
      setRemovingBusy(false);
    }
  }

  async function removeChecklistItem(itemId) {
    try {
      await checklists.remove(itemId);
      checklist.reload();
    } catch (err) {
      notify(err.message || "Could not remove that item.", "error");
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
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="appraisals">Appraisals</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-border p-4 sm:grid-cols-3">
            <Fact label="Designation">{e.designation}</Fact>
            <Fact label="Department">{e.department}</Fact>
            <Fact label="Reports to">{e.managerName}</Fact>
            <Fact label="Nationality">{e.nationality}</Fact>
            <Fact icon={Phone} label="Contact">{e.contactNo}</Fact>
            <Fact icon={Mail} label="Email">{e.email}</Fact>
            <Fact label="ID / passport">{e.idNo}</Fact>
            <Fact label="Joined">{e.joiningDate ? formatDate(e.joiningDate) : null}</Fact>
            <Fact label="Left">{e.exitDate ? formatDate(e.exitDate) : null}</Fact>
          </div>
          <PortalAccessPanel staffId={id} />
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
                {history.data.map((row) => <ContractRow key={row._id} row={row} onRemove={setRemovingContract} />)}
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

        <TabsContent value="assets">
          <div className="flex items-center justify-between gap-3 pb-3">
            <p className="text-sm text-muted-foreground">What has been issued to this person, and when it came back.</p>
            <Can permission="hr.manage">
              <Button variant="outline" onClick={() => setIssuingAsset(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> Issue an asset</Button>
            </Can>
          </div>
          {assetList.loading && <Spinner />}
          {assetList.error && <ErrorNote error={assetList.error} onRetry={assetList.reload} />}
          {!assetList.loading && !assetList.error && (
            (assetList.data || []).length ? (
              <div className="grid gap-2">
                {assetList.data.map((a) => (
                  <div key={a._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{a.assetName}{a.assetTag ? ` · ${a.assetTag}` : ""}</p>
                      <p className="text-xs text-muted-foreground">Issued {formatDate(a.issuedDate)}{a.returnedDate ? ` · returned ${formatDate(a.returnedDate)}` : ""}</p>
                    </div>
                    {a.returnedDate ? (
                      <Pill tone="neutral">Returned</Pill>
                    ) : (
                      <Can permission="hr.manage">
                        <Button variant="outline" size="sm" onClick={() => returnAsset(a._id)}>Mark returned</Button>
                      </Can>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Nothing issued to this person yet.</p>
            )
          )}
        </TabsContent>

        <TabsContent value="checklists">
          <div className="grid gap-4 sm:grid-cols-2">
            <ChecklistColumn
              title="Onboarding"
              listType="onboarding"
              items={(checklist.data || []).filter((r) => r.listType === "onboarding")}
              loading={checklist.loading}
              error={checklist.error}
              onRetry={checklist.reload}
              onStart={() => startChecklist("onboarding")}
              onAddItem={(subject) => addChecklistItem("onboarding", subject)}
              onMarkDone={markChecklistItemDone}
              onRemove={removeChecklistItem}
              canManage={canManageChecklists}
            />
            <ChecklistColumn
              title="Exit"
              listType="exit"
              items={(checklist.data || []).filter((r) => r.listType === "exit")}
              loading={checklist.loading}
              error={checklist.error}
              onRetry={checklist.reload}
              onStart={() => startChecklist("exit")}
              onAddItem={(subject) => addChecklistItem("exit", subject)}
              onMarkDone={markChecklistItemDone}
              onRemove={removeChecklistItem}
              canManage={canManageChecklists}
            />
          </div>
        </TabsContent>

        <TabsContent value="appraisals">
          <div className="flex items-center justify-between gap-3 pb-3">
            <p className="text-sm text-muted-foreground">A plain periodic review - no score, no fixed scale.</p>
            <Can permission="hr.manage">
              <Button variant="outline" onClick={() => setAddingAppraisal(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" /> New appraisal</Button>
            </Can>
          </div>
          {appraisalList.loading && <Spinner />}
          {appraisalList.error && <ErrorNote error={appraisalList.error} onRetry={appraisalList.reload} />}
          {!appraisalList.loading && !appraisalList.error && (
            (appraisalList.data || []).length ? (
              <div className="grid gap-3">
                {appraisalList.data.map((a) => (
                  <div key={a._id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">{a.periodLabel}</p>
                      <span className="text-xs text-muted-foreground">{formatDate(a.reviewDate)}</span>
                    </div>
                    {a.rating && <p className="mt-1 text-foreground">{a.rating}</p>}
                    {a.strengths && <p className="mt-1 text-xs text-muted-foreground">Strengths: {a.strengths}</p>}
                    {a.improvements && <p className="mt-1 text-xs text-muted-foreground">To improve: {a.improvements}</p>}
                    {a.goals && <p className="mt-1 text-xs text-muted-foreground">Goals: {a.goals}</p>}
                    {a.payAtReview && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pay at review: {CURRENCY} {formatNumber(a.payAtReview.basicPay)}/month
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No appraisal recorded yet.</p>
            )
          )}
        </TabsContent>
      </Tabs>

      {issuingAsset && (
        <AssetForm
          staffId={id}
          onClose={() => setIssuingAsset(false)}
          onSaved={(_, message) => { setIssuingAsset(false); notify(message); assetList.reload(); }}
        />
      )}
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
      {removingContract && (
        <ConfirmDialog
          danger
          title="Remove this contract row?"
          text={`The rate in force from ${formatDate(removingContract.effectiveFrom)} will no longer exist. Work already costed at it keeps the figure it was costed with, but anything recosted afterwards will read a different rate - so remove a row only if it was entered by mistake. To end a rate, add a new one instead.`}
          confirmLabel="Remove"
          busy={removingBusy}
          onConfirm={removeContract}
          onClose={() => setRemovingContract(null)}
        />
      )}
      {addingAppraisal && (
        <AppraisalForm
          staffId={id}
          onClose={() => setAddingAppraisal(false)}
          onSaved={(_, message) => { setAddingAppraisal(false); notify(message); appraisalList.reload(); }}
        />
      )}
      {toastNode}
    </div>
  );
}
