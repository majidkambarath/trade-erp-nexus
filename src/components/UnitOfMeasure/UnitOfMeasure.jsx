import React, { useState } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Ruler,
  ArrowUpDown,
  Package,
  Calculator,
  CheckCircle,
  AlertCircle,
  Scale,
  BarChart3,
  Settings,
  Save,
  RefreshCw,
} from "lucide-react";

const UnitMeasureConversion = () => {
  const [activeTab, setActiveTab] = useState("units");
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("unit"); // 'unit' or 'conversion'
  const [searchTerm, setSearchTerm] = useState("");
  const [editId, setEditId] = useState(null);

  // Units data
  const [units, setUnits] = useState([
    {
      id: 1,
      unitName: "Kilogram",
      shortCode: "kg",
      type: "Base",
      category: "Weight",
      status: "Active",
    },
    {
      id: 2,
      unitName: "Gram",
      shortCode: "g",
      type: "Derived",
      category: "Weight",
      status: "Active",
    },
    {
      id: 3,
      unitName: "Piece",
      shortCode: "pcs",
      type: "Base",
      category: "Quantity",
      status: "Active",
    },
    {
      id: 4,
      unitName: "Carton",
      shortCode: "ctn",
      type: "Derived",
      category: "Packaging",
      status: "Active",
    },
    {
      id: 5,
      unitName: "Liter",
      shortCode: "l",
      type: "Base",
      category: "Volume",
      status: "Active",
    },
  ]);

  // Conversions data
  const [conversions, setConversions] = useState([
    {
      id: 1,
      fromUOM: "Carton",
      toUOM: "Piece",
      conversionRatio: 12,
      category: "Packaging",
      status: "Active",
    },
    {
      id: 2,
      fromUOM: "Kilogram",
      toUOM: "Gram",
      conversionRatio: 1000,
      category: "Weight",
      status: "Active",
    },
    {
      id: 3,
      fromUOM: "Liter",
      toUOM: "Milliliter",
      conversionRatio: 1000,
      category: "Volume",
      status: "Active",
    },
  ]);

  // Form data
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
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const categories = [
    "Weight",
    "Volume",
    "Quantity",
    "Packaging",
    "Length",
    "Area",
  ];
  const unitTypes = ["Base", "Derived"];

  // Statistics
  const totalUnits = units.length;
  const activeUnits = units.filter((u) => u.status === "Active").length;
  const totalConversions = conversions.length;
  const activeConversions = conversions.filter(
    (c) => c.status === "Active"
  ).length;

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
    if (!unitForm.shortCode.trim())
      newErrors.shortCode = "Short code is required";
    if (!unitForm.category.trim()) newErrors.category = "Category is required";
    return newErrors;
  };

  const validateConversionForm = () => {
    const newErrors = {};
    if (!conversionForm.fromUOM.trim())
      newErrors.fromUOM = "From UOM is required";
    if (!conversionForm.toUOM.trim()) newErrors.toUOM = "To UOM is required";
    if (
      !conversionForm.conversionRatio ||
      conversionForm.conversionRatio <= 0
    ) {
      newErrors.conversionRatio = "Valid conversion ratio is required";
    }
    if (conversionForm.fromUOM === conversionForm.toUOM) {
      newErrors.toUOM = "From and To UOMs cannot be the same";
    }
    return newErrors;
  };

  const handleSubmit = () => {
    if (modalType === "unit") {
      const newErrors = validateUnitForm();
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      if (editId) {
        setUnits((prev) =>
          prev.map((unit) =>
            unit.id === editId ? { ...unit, ...unitForm } : unit
          )
        );
        showToastMessage("Unit updated successfully!", "success");
      } else {
        const newUnit = {
          ...unitForm,
          id: Date.now(),
        };
        setUnits((prev) => [...prev, newUnit]);
        showToastMessage("Unit created successfully!", "success");
      }
    } else {
      const newErrors = validateConversionForm();
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      if (editId) {
        setConversions((prev) =>
          prev.map((conversion) =>
            conversion.id === editId
              ? {
                  ...conversion,
                  ...conversionForm,
                  conversionRatio: Number(conversionForm.conversionRatio),
                }
              : conversion
          )
        );
        showToastMessage("Conversion updated successfully!", "success");
      } else {
        const newConversion = {
          ...conversionForm,
          id: Date.now(),
          conversionRatio: Number(conversionForm.conversionRatio),
        };
        setConversions((prev) => [...prev, newConversion]);
        showToastMessage("Conversion created successfully!", "success");
      }
    }
    resetForm();
  };

  const handleEdit = (item, type) => {
    setEditId(item.id);
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
        fromUOM: item.fromUOM,
        toUOM: item.toUOM,
        conversionRatio: item.conversionRatio.toString(),
        category: item.category,
        status: item.status,
      });
    }
    setShowModal(true);
  };

  const handleDelete = (id, type) => {
    if (type === "unit") {
      setUnits((prev) => prev.filter((unit) => unit.id !== id));
      showToastMessage("Unit deleted successfully!", "success");
    } else {
      setConversions((prev) =>
        prev.filter((conversion) => conversion.id !== id)
      );
      showToastMessage("Conversion deleted successfully!", "success");
    }
  };

  const resetForm = () => {
    setEditId(null);
    setUnitForm({
      unitName: "",
      shortCode: "",
      type: "Base",
      category: "",
      status: "Active",
    });
    setConversionForm({
      fromUOM: "",
      toUOM: "",
      conversionRatio: "",
      category: "",
      status: "Active",
    });
    setErrors({});
    setShowModal(false);
  };

  const openModal = (type) => {
    resetForm();
    setModalType(type);
    setShowModal(true);
  };

  const showToastMessage = (message, type) => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  };

  const getStatusBadge = (status) =>
    ({
      Active: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      Inactive: "bg-slate-100 text-slate-800 border border-slate-200",
    }[status] || "bg-slate-100 text-slate-800 border border-slate-200");

  const getTypeBadge = (type) =>
    ({
      Base: "bg-blue-100 text-blue-800 border border-blue-200",
      Derived: "bg-purple-100 text-purple-800 border border-purple-200",
    }[type] || "bg-slate-100 text-slate-800 border border-slate-200");

  const filteredUnits = units.filter(
    (unit) =>
      unit.unitName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.shortCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      unit.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredConversions = conversions.filter(
    (conversion) =>
      conversion.fromUOM.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conversion.toUOM.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conversion.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Unit of Measure & Conversion
            </h1>
            <p className="text-gray-600 mt-1">
              Manage units and conversion ratios across modules
            </p>
          </div>
        </div>
      </div>

      {/* Toast */}
      {showToast.visible && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg text-white z-50 transform transition-all duration-300 ${
            showToast.type === "success" ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          <div className="flex items-center space-x-2">
            {showToast.type === "success" ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Ruler size={24} className="text-blue-600" />
            </div>
            <div className="text-xs text-blue-600 font-medium">Total</div>
          </div>
          <h3 className="text-sm font-medium text-blue-600 mb-2">Units</h3>
          <p className="text-3xl font-bold text-gray-900">{totalUnits}</p>
          <p className="text-xs text-gray-500 mt-1">{activeUnits} active</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <ArrowUpDown size={24} className="text-purple-600" />
            </div>
            <div className="text-xs text-purple-600 font-medium">Total</div>
          </div>
          <h3 className="text-sm font-medium text-purple-600 mb-2">
            Conversions
          </h3>
          <p className="text-3xl font-bold text-gray-900">{totalConversions}</p>
          <p className="text-xs text-gray-500 mt-1">
            {activeConversions} active
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-emerald-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Package size={24} className="text-emerald-600" />
            </div>
            <div className="text-xs text-emerald-600 font-medium">
              Categories
            </div>
          </div>
          <h3 className="text-sm font-medium text-emerald-600 mb-2">
            Categories
          </h3>
          <p className="text-3xl font-bold text-gray-900">
            {categories.length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Available types</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-orange-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Calculator size={24} className="text-orange-600" />
            </div>
            <div className="text-xs text-orange-600 font-medium">System</div>
          </div>
          <h3 className="text-sm font-medium text-orange-600 mb-2">
            Auto Convert
          </h3>
          <p className="text-3xl font-bold text-gray-900">ON</p>
          <p className="text-xs text-gray-500 mt-1">Enabled</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("units")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 ${
              activeTab === "units"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <Ruler size={18} className="inline mr-2" />
            Unit Setup
          </button>
          <button
            onClick={() => setActiveTab("conversions")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 ${
              activeTab === "conversions"
                ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <ArrowUpDown size={18} className="inline mr-2" />
            Conversion Logic
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {activeTab === "units" ? "Unit Setup" : "Conversion Logic"}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {activeTab === "units"
                  ? "Define units of measure used in inventory and sales/purchase processes"
                  : "Define conversion ratios between units and support automatic conversions"}
              </p>
            </div>
            <button
              onClick={() =>
                openModal(activeTab === "units" ? "unit" : "conversion")
              }
              className={`flex items-center gap-3 px-6 py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 ${
                activeTab === "units"
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  : "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
              }`}
            >
              <Plus size={18} />
              Add {activeTab === "units" ? "Unit" : "Conversion"}
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search
              size={18}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* Content */}
          {activeTab === "units" ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Unit Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Short Code
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUnits.map((unit) => (
                    <tr
                      key={unit.id}
                      className="hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {unit.unitName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                        {unit.shortCode}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeBadge(
                            unit.type
                          )}`}
                        >
                          {unit.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {unit.category}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            unit.status
                          )}`}
                        >
                          {unit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleEdit(unit, "unit")}
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(unit.id, "unit")}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-50 to-indigo-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      From UOM
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      To UOM
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Conversion Ratio
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredConversions.map((conversion) => (
                    <tr
                      key={conversion.id}
                      className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 transition-all duration-200"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {conversion.fromUOM}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {conversion.toUOM}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                        1 : {conversion.conversionRatio}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {conversion.category}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            conversion.status
                          )}`}
                        >
                          {conversion.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleEdit(conversion, "conversion")}
                            className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-all duration-200"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(conversion.id, "conversion")
                            }
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div
              className={`flex justify-between items-center p-6 border-b border-gray-200 ${
                modalType === "unit"
                  ? "bg-gradient-to-r from-blue-50 to-indigo-50"
                  : "bg-gradient-to-r from-purple-50 to-indigo-50"
              }`}
            >
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editId
                    ? `Edit ${modalType === "unit" ? "Unit" : "Conversion"}`
                    : `Add New ${modalType === "unit" ? "Unit" : "Conversion"}`}
                </h3>
                <p className="text-gray-600 text-sm mt-1">
                  {modalType === "unit"
                    ? "Define unit properties and characteristics"
                    : "Set up conversion ratios between units"}
                </p>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-6">
              {modalType === "unit" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Ruler size={16} className="inline mr-2" />
                      Unit Name *
                    </label>
                    <input
                      type="text"
                      name="unitName"
                      value={unitForm.unitName}
                      onChange={handleUnitChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        errors.unitName
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                      placeholder="Enter unit name (e.g., Kilogram)"
                    />
                    {errors.unitName && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.unitName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Short Code *
                    </label>
                    <input
                      type="text"
                      name="shortCode"
                      value={unitForm.shortCode}
                      onChange={handleUnitChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 font-mono ${
                        errors.shortCode
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                      placeholder="e.g., kg"
                    />
                    {errors.shortCode && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.shortCode}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Type
                    </label>
                    <select
                      name="type"
                      value={unitForm.type}
                      onChange={handleUnitChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      {unitTypes.map((type) => (
                        <option key={type} value={type}>
                          {type} Unit
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      name="category"
                      value={unitForm.category}
                      onChange={handleUnitChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                        errors.category
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="">Select Category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                    {errors.category && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.category}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={unitForm.status}
                      onChange={handleUnitChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <ArrowUpDown size={16} className="inline mr-2" />
                      From UOM *
                    </label>
                    <select
                      name="fromUOM"
                      value={conversionForm.fromUOM}
                      onChange={handleConversionChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                        errors.fromUOM
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="">Select From UOM</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.unitName}>
                          {unit.unitName} ({unit.shortCode})
                        </option>
                      ))}
                    </select>
                    {errors.fromUOM && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.fromUOM}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      To UOM *
                    </label>
                    <select
                      name="toUOM"
                      value={conversionForm.toUOM}
                      onChange={handleConversionChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                        errors.toUOM
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                    >
                      <option value="">Select To UOM</option>
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.unitName}>
                          {unit.unitName} ({unit.shortCode})
                        </option>
                      ))}
                    </select>
                    {errors.toUOM && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.toUOM}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      <Calculator size={16} className="inline mr-2" />
                      Conversion Ratio *
                    </label>
                    <input
                      type="number"
                      name="conversionRatio"
                      value={conversionForm.conversionRatio}
                      onChange={handleConversionChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                        errors.conversionRatio
                          ? "border-red-300 bg-red-50"
                          : "border-gray-300"
                      }`}
                      placeholder="e.g., 1000"
                      min="0"
                      step="0.001"
                    />
                    {errors.conversionRatio && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.conversionRatio}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      1 {conversionForm.fromUOM || "From UOM"} ={" "}
                      {conversionForm.conversionRatio || "X"}{" "}
                      {conversionForm.toUOM || "To UOM"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      name="category"
                      value={conversionForm.category}
                      onChange={handleConversionChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="">Auto-detect Category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={conversionForm.status}
                      onChange={handleConversionChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={resetForm}
                  className="px-6 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className={`flex items-center gap-2 px-6 py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl font-medium ${
                    modalType === "unit"
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                      : "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
                  }`}
                >
                  <Save size={18} />
                  {editId ? "Update" : "Create"}{" "}
                  {modalType === "unit" ? "Unit" : "Conversion"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnitMeasureConversion;
