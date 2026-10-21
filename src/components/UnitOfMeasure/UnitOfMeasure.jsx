import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Ruler,
  ArrowUpDown,
  Package,
  Calculator,
  CheckCircle,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import StatCard from "../ui/stat-card";
import { Button } from "../ui/button";
import { ConfirmDialog, DataTable, Field, Modal, PageHeader, Panel, Pill, Select, TextInput, useToasts } from "../accounting/kit";
import Can from "../shell/Can";

// Units of measure (Kilogram, Box, Litre...) and the conversion ratios between them. Both lists filter in
// the browser (CLAUDE.md "Lists of masters need no period" - and there is no page of these worth paging,
// so a plain client-side search is the right amount of machinery, not a gap to close).
const UnitMeasureConversion = () => {
  const [activeTab, setActiveTab] = useState("units");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("unit"); // 'unit' or 'conversion'
  const [searchTerm, setSearchTerm] = useState("");
  const [editId, setEditId] = useState(null);

  const [units, setUnits] = useState([]);
  const [conversions, setConversions] = useState([]);

  const [unitForm, setUnitForm] = useState({
    unitName: "",
    shortCode: "",
    type: "Base",
    category: "",
    status: "Active",
  });

  const [conversionForm, setConversionForm] = useState({
    fromUOM: "",
    toUOM: "",
    conversionRatio: "",
    category: "",
    status: "Active",
  });

  const [errors, setErrors] = useState({});
  const { notify, toastNode } = useToasts();

  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    itemId: null,
    itemName: "",
    isDeleting: false,
    type: "",
  });

  const categories = ["Weight", "Volume", "Quantity", "Packaging", "Length", "Area"];
  const unitTypes = ["Base", "Derived"];

  const fetchUnits = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/uom/units");
      setUnits(Array.isArray(response.data.data) ? response.data.data : []);
    } catch {
      notify("Failed to fetch units", "error");
      setUnits([]);
    }
  }, [notify]);

  const fetchConversions = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/uom/conversions");
      setConversions(Array.isArray(response.data.data) ? response.data.data : []);
    } catch {
      notify("Failed to fetch conversions", "error");
      setConversions([]);
    }
  }, [notify]);

  useEffect(() => {
    fetchUnits();
    fetchConversions();
  }, [fetchUnits, fetchConversions]);

  const filteredUnits = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return units.filter(
      (unit) =>
        unit.unitName?.toLowerCase().includes(q) ||
        unit.shortCode?.toLowerCase().includes(q) ||
        unit.category?.toLowerCase().includes(q)
    );
  }, [units, searchTerm]);

  const filteredConversions = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return conversions.filter(
      (conversion) =>
        conversion.fromUOM?.unitName?.toLowerCase().includes(q) ||
        conversion.toUOM?.unitName?.toLowerCase().includes(q) ||
        conversion.category?.toLowerCase().includes(q)
    );
  }, [conversions, searchTerm]);

  const totalUnits = units.length;
  const activeUnits = units.filter((u) => u.status === "Active").length;
  const totalConversions = conversions.length;
  const activeConversions = conversions.filter((c) => c.status === "Active").length;

  const handleUnitChange = (e) => {
    const { name, value } = e.target;
    setUnitForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleConversionChange = (e) => {
    const { name, value } = e.target;
    setConversionForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateUnitForm = () => {
    const newErrors = {};
    if (!unitForm.unitName.trim()) newErrors.unitName = "Unit name is required";
    if (!unitForm.shortCode.trim()) newErrors.shortCode = "Short code is required";
    if (!unitForm.category.trim()) newErrors.category = "Category is required";
    return newErrors;
  };

  const validateConversionForm = () => {
    const newErrors = {};
    if (!conversionForm.fromUOM.trim()) newErrors.fromUOM = "From UOM is required";
    if (!conversionForm.toUOM.trim()) newErrors.toUOM = "To UOM is required";
    if (!conversionForm.conversionRatio || conversionForm.conversionRatio <= 0) {
      newErrors.conversionRatio = "Valid conversion ratio is required";
    }
    if (conversionForm.fromUOM === conversionForm.toUOM) {
      newErrors.toUOM = "From and To UOMs cannot be the same";
    }
    return newErrors;
  };

  const handleSubmit = async () => {
    try {
      if (modalType === "unit") {
        const newErrors = validateUnitForm();
        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          return;
        }

        if (editId) {
          await axiosInstance.put(`/uom/units/${editId}`, unitForm);
          notify("Unit updated successfully!", "success");
        } else {
          await axiosInstance.post("/uom/units", unitForm);
          notify("Unit created successfully!", "success");
        }
      } else {
        const newErrors = validateConversionForm();
        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          return;
        }

        const payload = { ...conversionForm, conversionRatio: Number(conversionForm.conversionRatio) };

        if (editId) {
          await axiosInstance.put(`/uom/conversions/${editId}`, payload);
          notify("Conversion updated successfully!", "success");
        } else {
          await axiosInstance.post("/uom/conversions", payload);
          notify("Conversion created successfully!", "success");
        }
      }
      resetForm();
      fetchUnits();
      fetchConversions();
    } catch (error) {
      notify(error.response?.data?.message || `Failed to ${editId ? "update" : "create"} ${modalType}`, "error");
    }
  };

  const handleEdit = (item, type) => {
    setEditId(item._id);
    setModalType(type);
    if (type === "unit") {
      setUnitForm({
        unitName: item.unitName,
        shortCode: item.shortCode,
        type: item.type,
        category: item.category,
        status: item.status,
      });
    } else {
      setConversionForm({
        fromUOM: item.fromUOM._id,
        toUOM: item.toUOM._id,
        conversionRatio: item.conversionRatio.toString(),
        category: item.category,
        status: item.status,
      });
    }
    setShowModal(true);
  };

  const showDeleteConfirmation = (id, name, type) => {
    setDeleteConfirmation({
      visible: true,
      itemId: id,
      itemName: type === "unit" ? name : `${name} Conversion`,
      isDeleting: false,
      type,
    });
  };

  const hideDeleteConfirmation = () => {
    setDeleteConfirmation({ visible: false, itemId: null, itemName: "", isDeleting: false, type: "" });
  };

  const confirmDelete = async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      const { itemId, type } = deleteConfirmation;
      if (type === "unit") {
        await axiosInstance.delete(`/uom/units/${itemId}`);
        notify("Unit deleted successfully!", "success");
      } else {
        await axiosInstance.delete(`/uom/conversions/${itemId}`);
        notify("Conversion deleted successfully!", "success");
      }
      hideDeleteConfirmation();
      fetchUnits();
      fetchConversions();
    } catch (error) {
      notify(error.response?.data?.message || `Failed to delete ${deleteConfirmation.type}`, "error");
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const resetForm = () => {
    setEditId(null);
    setUnitForm({ unitName: "", shortCode: "", type: "Base", category: "", status: "Active" });
    setConversionForm({ fromUOM: "", toUOM: "", conversionRatio: "", category: "", status: "Active" });
    setErrors({});
    setShowModal(false);
  };

  const openModal = (type) => {
    resetForm();
    setModalType(type);
    setShowModal(true);
  };

  const noun = activeTab === "units" ? "Unit" : "Conversion";

  return (
    <div className="mx-auto max-w-[1400px] p-4 sm:p-6 lg:p-8">
      <PageHeader title="Unit of Measure & Conversion" description="Manage units and conversion ratios across modules" />

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4 mb-8">
        <StatCard title="Units" count={totalUnits} subText={`${activeUnits} active`} icon={<Ruler size={20} />} tone="teal" />
        <StatCard title="Conversions" count={totalConversions} subText={`${activeConversions} active`} icon={<ArrowUpDown size={20} />} tone="plum" />
        <StatCard title="Categories" count={categories.length} subText="Available types" icon={<Package size={20} />} tone="olive" />
        <StatCard title="Auto Convert" count="ON" subText="Enabled" icon={<Calculator size={20} />} tone="rose" />
      </div>

      <Panel bodyClassName="p-0">
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("units")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 ${
              activeTab === "units" ? "border-b-2 border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <Ruler size={18} className="inline mr-2" aria-hidden="true" />
            Unit Setup
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("conversions")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 ${
              activeTab === "conversions" ? "border-b-2 border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <ArrowUpDown size={18} className="inline mr-2" aria-hidden="true" />
            Conversion Logic
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
            <div>
              <h2 className="text-xl font-semibold text-foreground">{activeTab === "units" ? "Unit Setup" : "Conversion Logic"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeTab === "units"
                  ? "Define units of measure used in inventory and sales/purchase processes"
                  : "Define conversion ratios between units and support automatic conversions"}
              </p>
            </div>
            <Can permission="inventory.create">
              <Button onClick={() => openModal(activeTab === "units" ? "unit" : "conversion")}>
                <Plus size={18} aria-hidden="true" />
                Add {noun}
              </Button>
            </Can>
          </div>

          <div className="relative mb-6">
            <Search size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <TextInput
              type="search"
              aria-label={`Search ${activeTab}`}
              className="ps-11"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {activeTab === "units" ? (
            filteredUnits.length === 0 ? (
              <div className="text-center py-12 rounded-xl border border-border bg-secondary/40">
                <Ruler size={40} className="mx-auto text-muted-foreground mb-4" aria-hidden="true" />
                <p className="text-foreground text-lg font-medium">No units added yet.</p>
                <p className="text-muted-foreground mt-2">Click the button below to add your first unit.</p>
                <Can permission="inventory.create">
                  <Button className="mt-4" onClick={() => openModal("unit")}>
                    <Plus size={18} aria-hidden="true" />
                    Add Unit
                  </Button>
                </Can>
              </div>
            ) : (
              <DataTable
                caption="Units"
                rows={filteredUnits}
                columns={[
                  { key: "unitName", header: "Unit Name", card: "primary", cell: (u) => <span className="text-sm font-medium text-foreground">{u.unitName}</span> },
                  { key: "shortCode", header: "Short Code", card: "title", cell: (u) => <span className="text-sm text-muted-foreground font-mono">{u.shortCode}</span> },
                  { key: "type", header: "Type", card: "badge", cell: (u) => <Pill tone={u.type === "Base" ? "info" : "neutral"}>{u.type}</Pill> },
                  { key: "category", header: "Category", card: "meta", cell: (u) => u.category },
                  { key: "status", header: "Status", card: "meta", cell: (u) => <Pill tone={u.status === "Active" ? "success" : "neutral"}>{u.status}</Pill> },
                  {
                    key: "actions", header: "Actions", card: "actions",
                    cell: (u) => (
                      <div className="flex items-center space-x-1">
                        <Can permission="inventory.edit">
                          <button type="button" onClick={() => handleEdit(u, "unit")} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label={`Edit ${u.unitName}`}>
                            <Edit size={16} />
                          </button>
                        </Can>
                        <Can permission="inventory.delete">
                          <button type="button" onClick={() => showDeleteConfirmation(u._id, u.unitName, "unit")} className="rounded-lg p-2 text-status-danger transition-colors hover:bg-status-danger-soft" aria-label={`Delete ${u.unitName}`}>
                            <Trash2 size={16} />
                          </button>
                        </Can>
                      </div>
                    ),
                  },
                ]}
              />
            )
          ) : filteredConversions.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-border bg-secondary/40">
              <ArrowUpDown size={40} className="mx-auto text-muted-foreground mb-4" aria-hidden="true" />
              <p className="text-foreground text-lg font-medium">No conversions added yet.</p>
              <p className="text-muted-foreground mt-2">Click the button below to add your first conversion.</p>
              <Can permission="inventory.create">
                <Button className="mt-4" onClick={() => openModal("conversion")}>
                  <Plus size={18} aria-hidden="true" />
                  Add Conversion
                </Button>
              </Can>
            </div>
          ) : (
            <DataTable
              caption="Conversions"
              rows={filteredConversions}
              columns={[
                { key: "from", header: "From UOM", card: "primary", cell: (c) => <span className="text-sm font-medium text-foreground">{c.fromUOM.unitName}</span> },
                { key: "to", header: "To UOM", card: "title", cell: (c) => <span className="text-sm font-medium text-foreground">{c.toUOM.unitName}</span> },
                { key: "ratio", header: "Conversion Ratio", card: "amount", cell: (c) => <span className="text-sm text-muted-foreground font-mono">1 : {c.conversionRatio}</span> },
                { key: "category", header: "Category", card: "meta", cell: (c) => c.category },
                { key: "status", header: "Status", card: "badge", cell: (c) => <Pill tone={c.status === "Active" ? "success" : "neutral"}>{c.status}</Pill> },
                {
                  key: "actions", header: "Actions", card: "actions",
                  cell: (c) => (
                    <div className="flex items-center space-x-1">
                      <Can permission="inventory.edit">
                        <button type="button" onClick={() => handleEdit(c, "conversion")} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Edit conversion">
                          <Edit size={16} />
                        </button>
                      </Can>
                      <Can permission="inventory.delete">
                        <button type="button" onClick={() => showDeleteConfirmation(c._id, `${c.fromUOM.unitName} to ${c.toUOM.unitName}`, "conversion")} className="rounded-lg p-2 text-status-danger transition-colors hover:bg-status-danger-soft" aria-label="Delete conversion">
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
      </Panel>

      {showModal && (
        <Modal
          size="lg"
          title={editId ? `Edit ${noun}` : `Add New ${noun}`}
          description={modalType === "unit" ? "Define unit properties and characteristics" : "Set up conversion ratios between units"}
          onClose={resetForm}
          footer={
            <>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleSubmit}>
                <CheckCircle size={18} aria-hidden="true" />
                {editId ? "Update" : "Create"} {noun}
              </Button>
            </>
          }
        >
          {modalType === "unit" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Unit Name" required error={errors.unitName} className="sm:col-span-2">
                <TextInput data-autofocus name="unitName" value={unitForm.unitName} onChange={handleUnitChange} placeholder="Enter unit name (e.g., Kilogram)" />
              </Field>
              <Field label="Short Code" required error={errors.shortCode}>
                <TextInput name="shortCode" value={unitForm.shortCode} onChange={handleUnitChange} placeholder="e.g., kg" className="font-mono" />
              </Field>
              <Field label="Type">
                <Select name="type" value={unitForm.type} onChange={handleUnitChange}>
                  {unitTypes.map((type) => (
                    <option key={type} value={type}>{type} Unit</option>
                  ))}
                </Select>
              </Field>
              <Field label="Category" required error={errors.category}>
                <Select name="category" value={unitForm.category} onChange={handleUnitChange}>
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select name="status" value={unitForm.status} onChange={handleUnitChange}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From UOM" required error={errors.fromUOM}>
                <Select data-autofocus name="fromUOM" value={conversionForm.fromUOM} onChange={handleConversionChange}>
                  <option value="">Select From UOM</option>
                  {units.map((unit) => (
                    <option key={unit._id} value={unit._id}>{unit.unitName} ({unit.shortCode})</option>
                  ))}
                </Select>
              </Field>
              <Field label="To UOM" required error={errors.toUOM}>
                <Select name="toUOM" value={conversionForm.toUOM} onChange={handleConversionChange}>
                  <option value="">Select To UOM</option>
                  {units.map((unit) => (
                    <option key={unit._id} value={unit._id}>{unit.unitName} ({unit.shortCode})</option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Conversion Ratio"
                required
                error={errors.conversionRatio}
                hint={`1 ${units.find((unit) => unit._id === conversionForm.fromUOM)?.unitName || "From UOM"} = ${conversionForm.conversionRatio || "X"} ${units.find((unit) => unit._id === conversionForm.toUOM)?.unitName || "To UOM"}`}
              >
                <TextInput type="number" name="conversionRatio" value={conversionForm.conversionRatio} onChange={handleConversionChange} placeholder="e.g., 1000" min="0" step="0.001" />
              </Field>
              <Field label="Category">
                <Select name="category" value={conversionForm.category} onChange={handleConversionChange}>
                  <option value="">Auto-detect Category</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status" className="sm:col-span-2">
                <Select name="status" value={conversionForm.status} onChange={handleConversionChange}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </Select>
              </Field>
            </div>
          )}
        </Modal>
      )}

      {deleteConfirmation.visible && (
        <ConfirmDialog
          title={`Delete ${deleteConfirmation.type === "unit" ? "Unit" : "Conversion"}`}
          text={`Are you sure you want to delete "${deleteConfirmation.itemName}"? This action cannot be undone and will permanently remove the ${deleteConfirmation.type} from your system.`}
          confirmLabel="Delete"
          danger
          busy={deleteConfirmation.isDeleting}
          onClose={hideDeleteConfirmation}
          onConfirm={confirmDelete}
        />
      )}

      {toastNode}
    </div>
  );
};

export default UnitMeasureConversion;
