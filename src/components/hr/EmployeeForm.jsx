// Add or edit an employee (HRMS > People). The same form both ways: `employee` present means edit. Pay is
// NOT here - a contract is its own history, entered from the employee's own page (EmployeeView.jsx), and
// mixing it into this form would make a raise look like editing the employee record instead of the auditable
// event it has to be (trade ERP node/utils/hr.js rule 2: the rate is stamped, never recomputed).
import React, { useState } from "react";
import { Button } from "../ui/button";
import { employees, departments as departmentsApi } from "../../lib/hrApi";
import { validateEmployeeForm, employeeFormData } from "../../lib/hr";
import { ErrorNote, DateInput, Field, Modal, Select, SearchSelect, TextInput, useAsync } from "../accounting/kit";

const STATUS_OPTIONS = [{ value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }];

export default function EmployeeForm({ employee, onClose, onSaved }) {
  const editing = Boolean(employee?._id);
  const departmentList = useAsync(() => departmentsApi.list(), []);
  const colleagues = useAsync(() => employees.list({ status: "Active", limit: 500 }), []);
  const [form, setForm] = useState({
    name: employee?.name || "",
    designation: employee?.designation || "",
    department: employee?.department || "",
    departmentId: employee?.departmentId || "",
    managerId: employee?.managerId || "",
    email: employee?.email || "",
    contactNo: employee?.contactNo || "",
    idNo: employee?.idNo || "",
    nationality: employee?.nationality || "",
    joiningDate: employee?.joiningDate ? String(employee.joiningDate).slice(0, 10) : "",
    exitDate: employee?.exitDate ? String(employee.exitDate).slice(0, 10) : "",
    status: employee?.status || "Active",
    idProof: null,
    addressProof: null,
  });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setField = (k) => (e) => set(k)(e?.target ? e.target.value : e);

  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  async function submit() {
    const found = validateEmployeeForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFailure(null);
    try {
      const fd = employeeFormData(form);
      const saved = editing ? await employees.update(employee._id, fd) : await employees.create(fd);
      onSaved(saved, `${saved.name} saved.`);
    } catch (err) {
      setFailure(err);
      setBusy(false);
    }
  }

  return (
    <Modal
      size="md"
      onClose={onClose}
      title={editing ? `Edit ${employee.name}` : "New employee"}
      description="The employee file. A cost rate is entered from their own page, once they are saved here."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button data-shortcut="save" onClick={submit} disabled={busy}>{busy ? "Saving…" : "Save"}</Button></>}
    >
      <div className="grid gap-4">
        {failure && <ErrorNote error={failure} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name" required error={errors.name}>
            <TextInput value={form.name} onChange={setField("name")} />
          </Field>
          <Field label="Designation" required error={errors.designation}>
            <TextInput value={form.designation} onChange={setField("designation")} placeholder="e.g. Fabricator" />
          </Field>
          <Field label="Department" hint="Optional, free text - or pick one below to also link the master">
            <TextInput value={form.department} onChange={setField("department")} />
          </Field>
          <Field label="Structured department" hint="Optional - fills the field above too">
            <SearchSelect
              value={form.departmentId}
              onChange={(v) => setForm((f) => ({ ...f, departmentId: v }))}
              options={(departmentList.data || []).map((d) => ({ value: d._id, label: d.name }))}
              placeholder="None"
              clearable
            />
          </Field>
          <Field label="Reports to" hint="Optional">
            <SearchSelect
              value={form.managerId}
              onChange={(v) => setForm((f) => ({ ...f, managerId: v }))}
              options={(colleagues.data || []).filter((c) => c._id !== employee?._id).map((c) => ({ value: c._id, label: c.name }))}
              placeholder="Nobody"
              clearable
            />
          </Field>
          <Field label="Nationality" hint="Optional - used for the Emiratisation tracker">
            <TextInput value={form.nationality} onChange={(e) => set("nationality")(e.target.value.toUpperCase().slice(0, 2))} placeholder="e.g. IN, AE" maxLength={2} />
          </Field>
          <Field label="Contact number" required error={errors.contactNo}>
            <TextInput value={form.contactNo} onChange={setField("contactNo")} placeholder="+971501234567" />
          </Field>
          <Field label="Email" hint="Optional">
            <TextInput type="email" value={form.email} onChange={setField("email")} />
          </Field>
          <Field label="ID / passport number" required error={errors.idNo}>
            <TextInput value={form.idNo} onChange={setField("idNo")} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={setField("status")}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Joining date" required error={errors.joiningDate}>
            <DateInput value={form.joiningDate} onChange={setField("joiningDate")} />
          </Field>
          <Field label="Exit date" hint="Only once they have left">
            <DateInput value={form.exitDate} onChange={setField("exitDate")} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="ID / passport proof" hint={employee?.idProofUrl ? "A file is already on record; choosing a new one replaces it" : "Optional"}>
            <input type="file" accept="image/*,.pdf" onChange={(e) => set("idProof")(e.target.files?.[0] || null)} className="text-sm" />
          </Field>
          <Field label="Address proof" hint={employee?.addressProofUrl ? "A file is already on record; choosing a new one replaces it" : "Optional"}>
            <input type="file" accept="image/*,.pdf" onChange={(e) => set("addressProof")(e.target.files?.[0] || null)} className="text-sm" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
