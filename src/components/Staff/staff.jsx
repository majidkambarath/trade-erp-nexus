import React, { useState } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  User,
  Phone,
  MapPin,
  FileText,
  Calendar,
  Upload,
  Users,
  UserCheck,
  UserX,
  Briefcase,
} from "lucide-react";

const StaffManagement = () => {
  const [staff, setStaff] = useState([
    {
      id: 1,
      name: "John Smith",
      designation: "Manager",
      contactNo: "+1234567890",
      idNo: "EMP001",
      joiningDate: "2024-01-15",
      idProof: "driver_license.pdf",
      addressProof: "utility_bill.pdf",
      status: "Active",
    },
    {
      id: 2,
      name: "Sarah Johnson",
      designation: "Accountant",
      contactNo: "+9876543210",
      idNo: "EMP002",
      joiningDate: "2024-02-20",
      idProof: "passport.pdf",
      addressProof: "bank_statement.pdf",
      status: "Active",
    },
    {
      id: 3,
      name: "Mike Davis",
      designation: "Sales Executive",
      contactNo: "+5555555555",
      idNo: "EMP003",
      joiningDate: "2024-03-10",
      idProof: "national_id.pdf",
      addressProof: "lease_agreement.pdf",
      status: "Inactive",
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editStaffId, setEditStaffId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    designation: "",
    contactNo: "",
    idNo: "",
    joiningDate: "",
    idProof: "",
    addressProof: "",
    status: "Active",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("");

  const activeStaff = staff.filter((s) => s.status === "Active").length;
  const inactiveStaff = staff.filter((s) => s.status === "Inactive").length;
  const totalStaff = staff.length;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileUpload = (fieldName, file) => {
    if (file) {
      setFormData((prev) => ({ ...prev, [fieldName]: file.name }));
    }
  };

  const validateForm = () => {
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
  };

  const handleSubmit = () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const newStaff = {
        ...formData,
        id: editStaffId || Date.now(),
      };

      if (editStaffId) {
        setStaff((prev) =>
          prev.map((s) => (s.id === editStaffId ? { ...s, ...formData } : s))
        );
        setShowToast({
          visible: true,
          message: "Staff member updated successfully!",
          type: "success",
        });
      } else {
        setStaff((prev) => [...prev, newStaff]);
        setShowToast({
          visible: true,
          message: "Staff member added successfully!",
          type: "success",
        });
      }
      resetForm();
    } catch (error) {
      setShowToast({
        visible: true,
        message: "Failed to save staff member.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
      setTimeout(
        () => setShowToast((prev) => ({ ...prev, visible: false })),
        3000
      );
    }
  };

  const handleEdit = (staffMember) => {
    setEditStaffId(staffMember.id);
    setFormData({
      name: staffMember.name,
      designation: staffMember.designation,
      contactNo: staffMember.contactNo,
      idNo: staffMember.idNo,
      joiningDate: staffMember.joiningDate,
      idProof: staffMember.idProof,
      addressProof: staffMember.addressProof,
      status: staffMember.status,
    });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    setStaff((prev) => prev.filter((s) => s.id !== id));
    setShowToast({
      visible: true,
      message: "Staff member deleted successfully!",
      type: "success",
    });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  };

  const resetForm = () => {
    setEditStaffId(null);
    setFormData({
      name: "",
      designation: "",
      contactNo: "",
      idNo: "",
      joiningDate: "",
      idProof: "",
      addressProof: "",
      status: "Active",
    });
    setErrors({});
    setShowModal(false);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const getStatusBadge = (status) =>
    ({
      Active: "bg-green-100 text-green-800 border border-green-200",
      Inactive: "bg-red-100 text-red-800 border border-red-200",
    }[status] || "bg-gray-100 text-gray-800 border border-gray-200");

  const filteredStaff = staff.filter(
    (member) =>
      (member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.idNo.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterStatus ? member.status === filterStatus : true) &&
      (filterDesignation ? member.designation === filterDesignation : true)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-100 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border border-gray-100">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">
              Staff Management
            </h1>
            <p className="text-gray-600 mt-2 font-medium">
              Manage your team members and their professional details
            </p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast.visible && (
        <div
          className={`fixed top-6 right-6 p-4 rounded-2xl shadow-2xl text-white z-50 transform transition-all duration-300 border ${
            showToast.type === "success"
              ? "bg-gradient-to-r from-green-500 to-emerald-600 border-green-300"
              : "bg-gradient-to-r from-red-500 to-pink-600 border-red-300"
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
            <span className="font-semibold">{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-white to-blue-50 rounded-3xl p-6 shadow-xl border border-blue-100 hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg">
                <Users size={24} className="text-white" />
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                TOTAL
              </span>
            </div>
            <h3 className="text-sm font-bold text-blue-700 mb-2">
              Total Staff
            </h3>
            <p className="text-3xl font-black text-gray-900">{totalStaff}</p>
            <p className="text-xs text-gray-600 mt-2 font-medium">
              All team members
            </p>
          </div>

          <div className="bg-gradient-to-br from-white to-green-50 rounded-3xl p-6 shadow-xl border border-green-100 hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-lg">
                <UserCheck size={24} className="text-white" />
              </div>
              <span className="text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                ACTIVE
              </span>
            </div>
            <h3 className="text-sm font-bold text-green-700 mb-2">
              Active Staff
            </h3>
            <p className="text-3xl font-black text-gray-900">{activeStaff}</p>
            <p className="text-xs text-gray-600 mt-2 font-medium">
              Currently working
            </p>
          </div>

          <div className="bg-gradient-to-br from-white to-red-50 rounded-3xl p-6 shadow-xl border border-red-100 hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-4 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl shadow-lg">
                <UserX size={24} className="text-white" />
              </div>
              <span className="text-xs font-bold text-red-600 bg-red-100 px-3 py-1 rounded-full">
                INACTIVE
              </span>
            </div>
            <h3 className="text-sm font-bold text-red-700 mb-2">
              Inactive Staff
            </h3>
            <p className="text-3xl font-black text-gray-900">{inactiveStaff}</p>
            <p className="text-xs text-gray-600 mt-2 font-medium">
              Not currently active
            </p>
          </div>

          <div className="bg-gradient-to-br from-white to-purple-50 rounded-3xl p-6 shadow-xl border border-purple-100 hover:shadow-2xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg">
                <Briefcase size={24} className="text-white" />
              </div>
              <span className="text-xs font-bold text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                RATE
              </span>
            </div>
            <h3 className="text-sm font-bold text-purple-700 mb-2">
              Active Rate
            </h3>
            <p className="text-3xl font-black text-gray-900">
              {totalStaff > 0
                ? Math.round((activeStaff / totalStaff) * 100)
                : 0}
              %
            </p>
            <p className="text-xs text-gray-600 mt-2 font-medium">
              Staff engagement
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100">
        <div className="p-8 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Staff Directory
              </h2>
              <p className="text-gray-600 text-sm mt-2 font-medium">
                Manage all your team members and their information
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl hover:from-cyan-600 hover:to-blue-700 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 font-semibold"
            >
              <Plus size={20} />
              Add Staff Member
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 mt-8">
            <div className="relative flex-1">
              <Search
                size={20}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search staff by name, designation, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 shadow-sm font-medium"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-6 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent shadow-sm font-medium"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select
              value={filterDesignation}
              onChange={(e) => setFilterDesignation(e.target.value)}
              className="px-6 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent shadow-sm font-medium"
            >
              <option value="">All Designations</option>
              <option value="Manager">Manager</option>
              <option value="Accountant">Accountant</option>
              <option value="Sales Executive">Sales Executive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
              <tr>
                <th className="px-8 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Staff Name
                </th>
                <th className="px-8 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Designation
                </th>
                <th className="px-8 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Contact No
                </th>
                <th className="px-8 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  ID Number
                </th>
                <th className="px-8 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Joining Date
                </th>
                <th className="px-8 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-8 py-6 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredStaff.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50 transition-all duration-200"
                >
                  <td className="px-8 py-6 text-sm font-bold text-gray-900">
                    {member.name}
                  </td>
                  <td className="px-8 py-6 text-sm text-gray-700 font-medium">
                    {member.designation}
                  </td>
                  <td className="px-8 py-6 text-sm text-gray-600 font-medium">
                    {member.contactNo}
                  </td>
                  <td className="px-8 py-6 text-sm text-gray-600 font-mono font-bold">
                    {member.idNo}
                  </td>
                  <td className="px-8 py-6 text-sm text-gray-600 font-medium">
                    {new Date(member.joiningDate).toLocaleDateString()}
                  </td>
                  <td className="px-8 py-6">
                    <span
                      className={`px-4 py-2 rounded-full text-xs font-bold ${getStatusBadge(
                        member.status
                      )}`}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleEdit(member)}
                        className="p-3 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(member.id)}
                        className="p-3 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
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
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-100">
            <div className="flex justify-between items-center p-8 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 rounded-t-3xl">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {editStaffId ? "Edit Staff Member" : "Add New Staff Member"}
                </h3>
                <p className="text-gray-600 text-sm mt-2 font-medium">
                  {editStaffId
                    ? "Update staff member information"
                    : "Create a new staff member profile"}
                </p>
              </div>
              <button
                onClick={resetForm}
                className="p-3 text-gray-400 hover:text-gray-600 hover:bg-white rounded-2xl transition-all duration-200 shadow-sm"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    <User size={16} className="inline mr-2" /> Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 shadow-sm font-medium ${
                      errors.name
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter full name"
                  />
                  {errors.name && (
                    <p className="mt-2 text-sm text-red-600 font-medium">
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    <Briefcase size={16} className="inline mr-2" /> Designation
                    *
                  </label>
                  <select
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    className={`w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 shadow-sm font-medium ${
                      errors.designation
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Designation</option>
                    <option value="Manager">Manager</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Sales Executive">Sales Executive</option>
                    <option value="HR Manager">HR Manager</option>
                    <option value="IT Support">IT Support</option>
                    <option value="Marketing Specialist">
                      Marketing Specialist
                    </option>
                  </select>
                  {errors.designation && (
                    <p className="mt-2 text-sm text-red-600 font-medium">
                      {errors.designation}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    <Phone size={16} className="inline mr-2" /> Contact Number *
                  </label>
                  <input
                    type="tel"
                    name="contactNo"
                    value={formData.contactNo}
                    onChange={handleChange}
                    className={`w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 shadow-sm font-medium ${
                      errors.contactNo
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter contact number"
                  />
                  {errors.contactNo && (
                    <p className="mt-2 text-sm text-red-600 font-medium">
                      {errors.contactNo}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    <FileText size={16} className="inline mr-2" /> ID/Passport
                    Number *
                  </label>
                  <input
                    type="text"
                    name="idNo"
                    value={formData.idNo}
                    onChange={handleChange}
                    className={`w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 shadow-sm font-medium ${
                      errors.idNo
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter ID or Passport number"
                  />
                  {errors.idNo && (
                    <p className="mt-2 text-sm text-red-600 font-medium">
                      {errors.idNo}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    <Calendar size={16} className="inline mr-2" /> Joining Date
                    *
                  </label>
                  <input
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate}
                    onChange={handleChange}
                    className={`w-full px-4 py-4 border rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 shadow-sm font-medium ${
                      errors.joiningDate
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.joiningDate && (
                    <p className="mt-2 text-sm text-red-600 font-medium">
                      {errors.joiningDate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 shadow-sm font-medium"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    <Upload size={16} className="inline mr-2" /> ID Proof
                    Document
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        handleFileUpload("idProof", e.target.files[0])
                      }
                      className="hidden"
                      id="idProofUpload"
                    />
                    <label
                      htmlFor="idProofUpload"
                      className="flex-1 px-4 py-4 border border-gray-300 rounded-2xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-all duration-200 shadow-sm font-medium text-center"
                    >
                      {formData.idProof || "Choose file..."}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">
                    <Upload size={16} className="inline mr-2" /> Address Proof
                    Document
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        handleFileUpload("addressProof", e.target.files[0])
                      }
                      className="hidden"
                      id="addressProofUpload"
                    />
                    <label
                      htmlFor="addressProofUpload"
                      className="flex-1 px-4 py-4 border border-gray-300 rounded-2xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-all duration-200 shadow-sm font-medium text-center"
                    >
                      {formData.addressProof || "Choose file..."}
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8 pt-8 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-8 py-4 text-gray-600 bg-gray-100 rounded-2xl hover:bg-gray-200 transition-all duration-200 font-bold shadow-sm hover:shadow-md"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-10 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl hover:from-cyan-600 hover:to-blue-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-all duration-200 font-bold shadow-xl hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? "Saving..."
                    : editStaffId
                    ? "Update Staff"
                    : "Add Staff"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
