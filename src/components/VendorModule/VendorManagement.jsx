import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
} from "lucide-react";
import axiosInstance from "../../axios/axios";

const VendorManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editVendorId, setEditVendorId] = useState(null);
  const [formData, setFormData] = useState({
    vendorName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    paymentTerms: "",
    status: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPaymentTerms, setFilterPaymentTerms] = useState("");

  const compliantVendors = vendors.filter(
    (v) => v.status === "Compliant"
  ).length;
  const nonCompliantVendors = vendors.filter(
    (v) => v.status === "Non-compliant"
  ).length;
  const pendingVendors = vendors.filter((v) => v.status === "Pending").length;
  const expiredVendors = vendors.filter((v) => v.status === "Expired").length;

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const res = await axiosInstance.get("/vendors");
      setVendors(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
      setShowToast({
        visible: true,
        message: error.response?.data?.message || "Failed to fetch vendors.",
        type: "error",
      });
      setTimeout(
        () => setShowToast((prev) => ({ ...prev, visible: false })),
        3000
      );
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.vendorName.trim())
      newErrors.vendorName = "Vendor name is required";
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = "Contact person is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Invalid email format";
    return newErrors;
  };

  const handleSubmit = async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = { ...formData, status: formData.status || "Pending" };
      delete payload.vendorId;

      if (editVendorId) {
        await axiosInstance.put(`/vendors/${editVendorId}`, payload);
        setShowToast({
          visible: true,
          message: "Vendor updated successfully!",
          type: "success",
        });
      } else {
        await axiosInstance.post("/vendors", payload);
        setShowToast({
          visible: true,
          message: "Vendor created successfully!",
          type: "success",
        });
      }
      await fetchVendors();
      resetForm();
    } catch (error) {
      setShowToast({
        visible: true,
        message: error.response?.data?.message || "Failed to save vendor.",
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

  const handleEdit = (vendor) => {
    setEditVendorId(vendor._id);
    setFormData({
      vendorName: vendor.vendorName,
      contactPerson: vendor.contactPerson,
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      paymentTerms: vendor.paymentTerms,
      status: vendor.status,
      vendorId: vendor.vendorId,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      await axiosInstance.delete(`/vendors/${id}`);
      await fetchVendors();
      setShowToast({
        visible: true,
        message: "Vendor deleted successfully!",
        type: "success",
      });
    } catch (error) {
      setShowToast({
        visible: true,
        message: error.response?.data?.message || "Failed to delete vendor.",
        type: "error",
      });
    } finally {
      setTimeout(
        () => setShowToast((prev) => ({ ...prev, visible: false })),
        3000
      );
    }
  };

  const resetForm = () => {
    setEditVendorId(null);
    setFormData({
      vendorName: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      paymentTerms: "",
      status: "",
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
      Compliant: "bg-green-100 text-green-800 border border-green-200",
      "Non-compliant": "bg-red-100 text-red-800 border border-red-200",
      Pending: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      Expired: "bg-gray-100 text-gray-800 border border-gray-200",
    }[status] || "bg-gray-100 text-gray-800 border border-gray-200");

  const filteredVendors = vendors.filter(
    (vendor) =>
      (vendor.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.vendorId.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterStatus ? vendor.status === filterStatus : true) &&
      (filterPaymentTerms ? vendor.paymentTerms === filterPaymentTerms : true)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Vendor Management
          </h1>
        </div>
      </div>

      {showToast.visible && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white z-50 w-11/12 sm:w-auto max-w-md ${
            showToast.type === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {showToast.message}
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Compliant Vendors",
              count: compliantVendors,
              color: "blue-600",
            },
            {
              title: "Non-compliant Vendors",
              count: nonCompliantVendors,
              color: "red-600",
            },
            {
              title: "Pending Vendors",
              count: pendingVendors,
              color: "yellow-600",
            },
            {
              title: "Expired Vendors",
              count: expiredVendors,
              color: "gray-600",
            },
          ].map((card, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className={`text-sm font-medium text-${card.color}`}>
                  {card.title}
                </h3>
                <button
                  className={`text-xs text-${
                    card.color
                  } hover:text-${card.color.replace("600", "800")}`}
                >
                  View Vendors →
                </button>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {card.count}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">All Vendors</h2>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 w-full sm:w-auto"
            >
              <Plus size={16} />
              Add Vendor
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search by Vendor ID, Name, Email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
            >
              <option value="">All Statuses</option>
              <option value="Compliant">Compliant</option>
              <option value="Non-compliant">Non-compliant</option>
              <option value="Pending">Pending</option>
              <option value="Expired">Expired</option>
            </select>
            <select
              value={filterPaymentTerms}
              onChange={(e) => setFilterPaymentTerms(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-auto"
            >
              <option value="">All Payment Terms</option>
              <option value="30 days">30 days</option>
              <option value="Net 30">Net 30</option>
              <option value="45 days">45 days</option>
              <option value="Net 60">Net 60</option>
              <option value="60 days">60 days</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor ID
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor Name
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact Person
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Billing Address
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVendors.map((vendor) => (
                <tr key={vendor._id} className="hover:bg-gray-50">
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                    {vendor.vendorId}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                    {vendor.vendorName}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                    {vendor.contactPerson}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                    {vendor.email}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                    {vendor.phone}
                  </td>
                  <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                    {vendor.address}
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                        vendor.status
                      )}`}
                    >
                      {vendor.status}
                    </span>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleEdit(vendor)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(vendor._id)}
                        className="text-red-600 hover:text-red-800"
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

      {showModal && (
        <div className="fixed inset-0 bg-white/50 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editVendorId ? "Edit Vendor" : "Add New Vendor"}
              </h3>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {editVendorId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vendor ID
                    </label>
                    <input
                      type="text"
                      name="vendorId"
                      value={formData.vendorId}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User size={16} className="inline mr-1" /> Vendor Name *
                  </label>
                  <input
                    type="text"
                    name="vendorName"
                    value={formData.vendorName}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.vendorName ? "border-red-300" : "border-gray-300"
                    }`}
                  />
                  {errors.vendorName && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.vendorName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User size={16} className="inline mr-1" /> Contact Person *
                  </label>
                  <input
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.contactPerson
                        ? "border-red-300"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.contactPerson && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.contactPerson}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail size={16} className="inline mr-1" /> Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.email ? "border-red-300" : "border-gray-300"
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone size={16} className="inline mr-1" /> Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin size={16} className="inline mr-1" /> Billing Address
                    *
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.address ? "border-red-300" : "border-gray-300"
                    }`}
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.address}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <CreditCard size={16} className="inline mr-1" /> Payment
                    Terms
                  </label>
                  <input
                    type="text"
                    name="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Status</option>
                    <option value="Compliant">Compliant</option>
                    <option value="Non-compliant">Non-compliant</option>
                    <option value="Pending">Pending</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-4 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                      Saving...
                    </>
                  ) : editVendorId ? (
                    "Update Vendor"
                  ) : (
                    "Add Vendor"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorManagement;
