import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  User,
  Phone,
  FileText,
  Calendar,
  Upload,
  Users,
  UserCheck,
  UserX,
  Briefcase,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  Clock,
  File,
  Eye,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import { toInputDate, formatDate, formatTime } from "../../utils/format";
import StatCard from "../ui/stat-card";
import { pageSession } from "../../lib/pageSession";
import { useListView } from "../../lib/useListView";
import { sortRows } from "../../lib/listView";
import FilterBar, { FilterSelect } from "../lists/FilterBar";
import { Button } from "../ui/button";

import { ConfirmDialog, DateInput, Field, Modal, PhoneInput, Pill, Select, TextInput, useAsync, useToasts } from "../accounting/kit";
import { DataTable } from "../accounting/DataTable";
import { useOrganisation } from "../shell/OrganisationContext";

// What this screen keeps while the person visits another page and comes back (lib/pageSession.js): the search, the two choices,
// the sort, and a half-filled add-staff form. Held in this tab's memory only; emptied at sign-out.
const session = pageSession("staff");

const STATUS_TONE = { Active: "success", Inactive: "neutral" };

// What a draft of the add-staff form keeps: the text the person typed. Not the files (a file cannot be shown again without being
// chosen again), and not the defaults a blank form starts with (the status "Active"): a form nobody has typed in is not a draft.
// It lives in memory only (pageSession above), never in the browser's storage: it holds a person's ID number.
const BLANK_FORM = { name: "", designation: "", contactNo: "", idNo: "", joiningDate: "", idProof: null, addressProof: null, status: "Active" };
const DRAFT_FIELDS = ["name", "designation", "contactNo", "idNo", "joiningDate"];
const hasDraftContent = (form) => DRAFT_FIELDS.some((k) => String(form?.[k] ?? "").trim() !== "");
const draftOf = (form) => ({ ...Object.fromEntries(DRAFT_FIELDS.map((k) => [k, String(form?.[k] ?? "")])), status: form?.status || "Active" });

const designations = [
  "Manager",
  "Accountant",
  "Sales Executive",
  "HR Manager",
  "IT Support",
  "Marketing Specialist",
];

// A document picker: choose, preview, remove. The original screen offered a "Replace X" label once a file
// was chosen, but the label pointed at a hidden <input> that was no longer rendered in that state - clicking
// it silently did nothing, so replacing a chosen file needed Delete first regardless of what the button said.
// Remove-then-choose-again (this component's only path) is the same convention
// components/parties/PartyRows.jsx already uses for a party's KYC documents - the input is nested INSIDE its
// label rather than linked by id, so there is no id to go stale when the input stops being rendered.
const FileField = ({ label, preview, onPick, onRemove }) => (
  <div className="flex flex-col gap-1.5">
    <span className="text-sm font-medium text-foreground">{label}</span>
    {preview ? (
      <div className="flex items-center justify-between rounded-xl border border-input bg-background p-3">
        <div className="flex items-center space-x-3">
          {preview.type === "existing" || preview.type?.startsWith("image/") ? (
            <img src={preview.url} alt={`${label} preview`} className="h-12 w-12 rounded-md object-cover" />
          ) : (
            <File size={24} className="text-muted-foreground" aria-hidden="true" />
          )}
          <span className="max-w-[150px] truncate text-sm text-foreground">{preview.name}</span>
        </div>
        <div className="flex space-x-2">
          {preview.url && (
            <a href={preview.url} target="_blank" rel="noopener noreferrer" className="grid h-10 w-10 place-items-center rounded-lg text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 md:h-8 md:w-8" title="View file" aria-label={`View file: ${preview.name}`}>
              <Eye size={16} aria-hidden="true" />
            </a>
          )}
          <button type="button" onClick={onRemove} className="grid h-10 w-10 place-items-center rounded-lg text-status-danger hover:bg-status-danger-soft md:h-8 md:w-8" title="Delete file" aria-label={`Delete file: ${preview.name}`}>
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    ) : (
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input bg-background px-4 py-3 text-center text-sm text-muted-foreground hover:bg-accent">
        {`Upload ${label}`}
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" onChange={(e) => onPick(e.target.files[0])} />
      </label>
    )}
  </div>
);

const StaffManagement = () => {
  // search/filters/sort for this list - lib/useListView.js, the same hook CategoryManagement/VendorManagement/
  // CustomerManagement already use.
  const list = useListView("staff", { filters: { status: "", designation: "" } });
  const [showModal, setShowModal] = useState(false);
  const [editStaffId, setEditStaffId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    designation: "",
    contactNo: "",
    idNo: "",
    joiningDate: "",
    idProof: null,
    addressProof: null,
    status: "Active",
  });

  const [filePreviews, setFilePreviews] = useState({
    idProof: null,
    addressProof: null,
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notify, toastNode } = useToasts();
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    staffId: null,
    staffName: "",
    isDeleting: false,
  });
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);

  const autoSaveInterval = useRef(null);
  const navigate = useNavigate();
  // The employee files are their own permission (staff.view to read, staff.manage to add, change or delete), apart from
  // the people who sign in. The server refuses the rest; this only decides what to offer.
  const { canAny } = useOrganisation();
  const canManage = canAny("staff.manage");
  const showToastMessage = useCallback((message, type = "success") => notify(message, type), [notify]);

  const { data, loading: isLoading, error, reload: fetchStaff } = useAsync(() => axiosInstance.get("/staff/staff").then((res) => res.data.data?.staff || []), []);
  const staff = useMemo(() => data || [], [data]);

  useEffect(() => {
    if (error) showToastMessage(error.response?.data?.message || "Failed to fetch staff.", "error");
  }, [error, showToastMessage]);

  useEffect(() => {
    // Only a NEW staff member is drafted: an edit starts from a saved record, and must never become the draft of an add.
    if (showModal && !editStaffId && hasDraftContent(formData)) {
      autoSaveInterval.current = setTimeout(() => {
        session.set("formData", draftOf(formData));
        session.set("lastSaveTime", new Date().toISOString());
        setIsDraftSaved(true);
        setLastSaveTime(new Date().toISOString());
      }, 2000);
    }

    return () => {
      if (autoSaveInterval.current) {
        clearTimeout(autoSaveInterval.current);
      }
    };
  }, [formData, showModal, editStaffId]);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: name === "contactNo" || name === "idNo" ? value.trim() : value,
      }));
      if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
      setIsDraftSaved(false);
    },
    [errors]
  );

  const handleFileUpload = useCallback((fieldName, file) => {
    if (file) {
      const previewUrl = file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;
      setFormData((prev) => ({ ...prev, [fieldName]: file }));
      setFilePreviews((prev) => ({
        ...prev,
        [fieldName]: { url: previewUrl, name: file.name, type: file.type },
      }));
      setIsDraftSaved(false);
    }
  }, []);

  const handleFileDelete = useCallback((fieldName) => {
    setFormData((prev) => ({ ...prev, [fieldName]: null }));
    setFilePreviews((prev) => ({
      ...prev,
      [fieldName]: null,
    }));
    setIsDraftSaved(false);
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = "Full name is required";
    if (!formData.designation.trim())
      newErrors.designation = "Designation is required";
    if (!formData.contactNo.trim())
      newErrors.contactNo = "Contact number is required";
    if (!formData.idNo.trim())
      newErrors.idNo = "ID/Passport number is required";
    if (!formData.joiningDate)
      newErrors.joiningDate = "Joining date is required";
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
      const formDataToSend = new FormData();
      formDataToSend.append("name", formData.name);
      formDataToSend.append("designation", formData.designation);
      formDataToSend.append("contactNo", formData.contactNo.trim());
      formDataToSend.append("idNo", formData.idNo.trim());
      formDataToSend.append("joiningDate", formData.joiningDate);
      formDataToSend.append("status", formData.status);
      if (formData.idProof) formDataToSend.append("idProof", formData.idProof);
      if (formData.addressProof)
        formDataToSend.append("addressProof", formData.addressProof);

      if (editStaffId) {
        await axiosInstance.put(`/staff/staff/${editStaffId}`, formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        showToastMessage("Staff member updated successfully!", "success");
      } else {
        await axiosInstance.post("/staff/staff", formDataToSend, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        showToastMessage("Staff member added successfully!", "success");
      }

      await fetchStaff();
      resetForm();

      session.remove("formData");
      session.remove("lastSaveTime");
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to save staff member.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [editStaffId, formData, fetchStaff, validateForm, showToastMessage]);

  const handleEdit = useCallback((staffMember) => {
    setEditStaffId(staffMember._id);
    setFormData({
      name: staffMember.name,
      designation: staffMember.designation,
      contactNo: staffMember.contactNo?.trim() || "",
      idNo: staffMember.idNo?.trim() || "",
      joiningDate: staffMember.joiningDate
        ? toInputDate(staffMember.joiningDate)
        : "",
      idProof: null,
      addressProof: null,
      status: staffMember.status,
    });
    setFilePreviews({
      idProof: staffMember.idProof
        ? {
            url: staffMember.idProofUrl,
            name: staffMember.idProof,
            type: "existing",
          }
        : null,
      addressProof: staffMember.addressProof
        ? {
            url: staffMember.addressProofUrl,
            name: staffMember.addressProof,
            type: "existing",
          }
        : null,
    });
    setShowModal(true);
    setIsDraftSaved(false);

    session.remove("formData");
    session.remove("lastSaveTime");
  }, []);

  const showDeleteConfirmation = useCallback((staffMember) => {
    setDeleteConfirmation({
      visible: true,
      staffId: staffMember._id,
      staffName: staffMember.name,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      staffId: null,
      staffName: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));

    try {
      await axiosInstance.delete(`/staff/staff/${deleteConfirmation.staffId}`);
      showToastMessage("Staff member deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchStaff();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete staff member.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [
    deleteConfirmation.staffId,
    fetchStaff,
    showToastMessage,
    hideDeleteConfirmation,
  ]);

  const resetForm = useCallback(() => {
    setEditStaffId(null);
    setFormData({
      name: "",
      designation: "",
      contactNo: "",
      idNo: "",
      joiningDate: "",
      idProof: null,
      addressProof: null,
      status: "Active",
    });
    setFilePreviews({
      idProof: null,
      addressProof: null,
    });
    setErrors({});
    setShowModal(false);
    setIsDraftSaved(false);
    setLastSaveTime(null);

    session.remove("formData");
    session.remove("lastSaveTime");
  }, []);

  const openAddModal = useCallback(() => {
    // A draft kept from before - the person left the page part-way through adding someone - is picked up again. Closing the
    // form, or starting to edit someone, discards it, so anything else starts blank.
    const draft = session.get("formData");
    if (hasDraftContent(draft)) {
      setEditStaffId(null);
      setFormData({ ...BLANK_FORM, ...draft, idProof: null, addressProof: null });
      setFilePreviews({ idProof: null, addressProof: null });
      setErrors({});
      setIsDraftSaved(true);
      setLastSaveTime(session.get("lastSaveTime"));
    } else {
      resetForm();
    }
    setShowModal(true);
  }, [resetForm]);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return "";
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    return formatTime(time);
  }, []);

  const staffStats = useMemo(() => {
    const totalStaff = staff.length;
    const activeStaff = staff.filter((s) => s.status === "Active").length;
    const inactiveStaff = staff.filter((s) => s.status === "Inactive").length;
    const activeRate =
      totalStaff > 0 ? Math.round((activeStaff / totalStaff) * 100) : 0;

    return { totalStaff, activeStaff, inactiveStaff, activeRate };
  }, [staff]);

  const filteredStaff = useMemo(() => {
    const needle = list.search.toLowerCase();
    return staff.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(needle) ||
        member.designation.toLowerCase().includes(needle) ||
        member.idNo.toLowerCase().includes(needle);
      const matchesStatus = list.filters.status ? member.status === list.filters.status : true;
      const matchesDesignation = list.filters.designation ? member.designation === list.filters.designation : true;
      return matchesSearch && matchesStatus && matchesDesignation;
    });
  }, [staff, list.search, list.filters.status, list.filters.designation]);
  const sortedAndFilteredStaff = useMemo(() => sortRows(filteredStaff, list.sort), [filteredStaff, list.sort]);

  // the designations to choose from: the ones the add form offers, plus any a record already carries (an older record may name
  // one that is not on the list, and a filter that cannot reach it would hide it), plus the one the person has chosen
  const designationOptions = useMemo(
    () =>
      [...new Set([...designations, ...staff.map((s) => s.designation), list.filters.designation].filter(Boolean))].map(
        (d) => [d, d]
      ),
    [staff, list.filters.designation]
  );

  // what the empty state's wording and action follow - a search or a choice, never the sort
  const filtered = Boolean(list.search || list.filters.status || list.filters.designation);

  const emptyNode = (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <Users size={36} className="text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">
        {filtered ? "No staff match the search or filters" : "No staff members found"}
      </h3>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {filtered
          ? "Clear the search and filters to see everyone."
          : canManage
            ? "Start building your team by adding your first staff member."
            : "No staff records have been added yet."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {filtered && (
          <button type="button" onClick={list.clearFilters} className="inline-flex h-10 items-center rounded-full border border-input bg-card px-4 text-sm font-medium text-foreground hover:bg-accent">
            Clear search and filters
          </button>
        )}
        {!filtered && canManage && (
          <Button onClick={openAddModal}>
            <Plus size={20} aria-hidden="true" />
            Add First Staff Member
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            type="button"
            aria-label="Go back"
            className="grid h-10 w-10 shrink-0 place-items-center lg:h-9 lg:w-9 rounded-lg border border-input bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Staff Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {staffStats.totalStaff} total staff •{" "}
              {sortedAndFilteredStaff.length} displayed
            </p>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
          {[
            {
              title: "Total Staff",
              count: staffStats.totalStaff,
              icon: <Users size={24} />,
            },
            {
              title: "Active Staff",
              count: staffStats.activeStaff,
              icon: <UserCheck size={24} />,
            },
            {
              title: "Inactive Staff",
              count: staffStats.inactiveStaff,
              icon: <UserX size={24} />,
            },
            {
              title: "Active Rate",
              count: `${staffStats.activeRate}%`,
              icon: <Briefcase size={24} />,
            },
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

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-4 sm:p-6">
          <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Staff Directory
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your team members and their professional details
              </p>
            </div>
            {canManage && (
              <Button data-shortcut="new" onClick={openAddModal}>
                <Plus size={18} aria-hidden="true" />
                Add Staff Member
              </Button>
            )}
          </div>

          {/* Filters: always showing, the same row every list of the product has (components/lists/FilterBar.jsx) */}
          <FilterBar
            search={list.search}
            onSearch={list.setSearch}
            searchLabel="Search staff"
            placeholder="Search name, designation or ID"
            active={list.active}
            onClear={list.clearFilters}
          >
            <FilterSelect
              label="Status"
              value={list.filters.status}
              onChange={(v) => list.setFilter("status", v)}
              allLabel="All statuses"
              options={[["Active", "Active"], ["Inactive", "Inactive"]]}
            />
            <FilterSelect
              label="Designation"
              value={list.filters.designation}
              onChange={(v) => list.setFilter("designation", v)}
              allLabel="All designations"
              options={designationOptions}
            />
          </FilterBar>
        </div>

        <div className="overflow-x-auto">
          <DataTable
            caption="Staff"
            rows={sortedAndFilteredStaff}
            rowKey={(member) => member._id}
            loading={isLoading}
            loadingLabel="Loading staff members"
            empty={emptyNode}
            sort={list.sort}
            onSort={list.toggleSort}
            columns={[
              {
                key: "name", header: "Staff Info", sortable: true, card: "primary",
                cell: (m) => (
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-100 rounded-lg">
                      <User size={20} className="text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                      <p className="text-xs font-normal text-muted-foreground">ID: {m._id}</p>
                    </div>
                  </div>
                ),
              },
              { key: "designation", header: "Designation", sortable: true, card: "title", cell: (m) => <p className="text-sm font-medium text-indigo-600">{m.designation}</p> },
              { key: "contactNo", header: "Contact No", sortable: true, card: "meta", cell: (m) => m.contactNo },
              { key: "idNo", header: "ID Number", sortable: true, cell: (m) => <p className="text-sm font-mono font-bold text-muted-foreground">{m.idNo}</p> },
              { key: "joiningDate", header: "Joining Date", sortable: true, card: "meta", cell: (m) => formatDate(m.joiningDate) },
              {
                key: "status", header: "Status", card: "badge",
                cell: (m) => <Pill tone={STATUS_TONE[m.status] || "neutral"}>{m.status}</Pill>,
              },
              ...(canManage ? [{
                key: "actions", header: "Actions", card: "actions",
                cell: (m) => (
                  <div className="flex items-center space-x-3">
                    <button onClick={() => handleEdit(m)} className="grid h-10 w-10 place-items-center rounded-lg text-indigo-600 transition-all duration-200 hover:bg-indigo-50 hover:text-indigo-800 lg:h-8 lg:w-8" title="Edit staff">
                      <Edit size={16} />
                    </button>
                    <button onClick={() => showDeleteConfirmation(m)} className="grid h-10 w-10 place-items-center rounded-lg text-red-600 transition-all duration-200 hover:bg-red-50 hover:text-red-800 lg:h-8 lg:w-8" title="Delete staff">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ),
              }] : []),
            ]}
          />
        </div>
      </div>

      {deleteConfirmation.visible && (
        <ConfirmDialog
          title="Delete Staff Member"
          text={`Are you sure you want to delete "${deleteConfirmation.staffName}"? This action cannot be undone and will permanently remove the staff member from your records.`}
          confirmLabel="Delete"
          danger
          busy={deleteConfirmation.isDeleting}
          onClose={hideDeleteConfirmation}
          onConfirm={confirmDelete}
        />
      )}

      {showModal && (
        <Modal
          size="xl"
          title={editStaffId ? "Edit Staff Member" : "Add New Staff Member"}
          description={editStaffId ? "Update staff member information" : "Create a new staff member profile"}
          onClose={resetForm}
          footer={
            <>
              <div className="me-auto flex items-center text-sm text-muted-foreground">
                {isDraftSaved ? (
                  <span className="flex items-center text-status-success">
                    <CheckCircle size={14} className="mr-1" aria-hidden="true" />
                    Changes saved automatically
                  </span>
                ) : formData.name || formData.designation || formData.contactNo || formData.idNo || formData.joiningDate || formData.idProof || formData.addressProof ? (
                  <span className="flex items-center text-status-warning">
                    <Clock size={14} className="mr-1" aria-hidden="true" />
                    Unsaved changes
                  </span>
                ) : null}
              </div>
              <Button variant="outline" onClick={resetForm} disabled={isSubmitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : editStaffId ? <Save className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                {isSubmitting ? "Saving..." : editStaffId ? "Update Staff" : "Add Staff"}
              </Button>
            </>
          }
        >
          {isDraftSaved && lastSaveTime && (
            <p className="mb-4 flex items-center text-sm text-status-success">
              <Save size={12} className="mr-1" aria-hidden="true" />
              Draft saved {formatLastSaveTime(lastSaveTime)}
            </p>
          )}
          <div className="grid gap-6">
            <div>
              <h3 className="mb-4 flex items-center text-base font-semibold text-foreground">
                <User size={20} className="mr-2 text-indigo-600" aria-hidden="true" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Field label="Full Name" required error={errors.name}>
                  <TextInput data-autofocus name="name" value={formData.name} onChange={handleChange} placeholder="Enter full name" />
                </Field>
                <Field label="Designation" required error={errors.designation}>
                  <Select name="designation" value={formData.designation} onChange={handleChange}>
                    <option value="">Select Designation</option>
                    {designations.map((des) => <option key={des} value={des}>{des}</option>)}
                  </Select>
                </Field>
                <Field label="Contact Number" required error={errors.contactNo}>
                  <PhoneInput name="contactNo" value={formData.contactNo} onChange={handleChange} />
                </Field>
              </div>
            </div>

            <div>
              <h3 className="mb-4 flex items-center text-base font-semibold text-foreground">
                <FileText size={20} className="mr-2 text-purple-600" aria-hidden="true" />
                Identification Information
              </h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Field label="ID/Passport Number" required error={errors.idNo}>
                  <TextInput name="idNo" value={formData.idNo} onChange={handleChange} placeholder="Enter ID or Passport number" />
                </Field>
                <Field label="Joining Date" required error={errors.joiningDate}>
                  <DateInput name="joiningDate" value={formData.joiningDate} onChange={handleChange} />
                </Field>
                <Field label="Status">
                  <Select name="status" value={formData.status} onChange={handleChange}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </Select>
                </Field>
              </div>
            </div>

            <div>
              <h3 className="mb-4 flex items-center text-base font-semibold text-foreground">
                <Upload size={20} className="mr-2 text-green-600" aria-hidden="true" />
                Documents
              </h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <FileField
                  label="ID Proof Document"
                  preview={filePreviews.idProof}
                  onPick={(file) => handleFileUpload("idProof", file)}
                  onRemove={() => handleFileDelete("idProof")}
                />
                <FileField
                  label="Address Proof Document"
                  preview={filePreviews.addressProof}
                  onPick={(file) => handleFileUpload("addressProof", file)}
                  onRemove={() => handleFileDelete("addressProof")}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
    {toastNode}
    </>
  );
};

export default StaffManagement;
