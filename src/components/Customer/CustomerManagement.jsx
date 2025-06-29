import React, { useState } from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  X,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Hash,
  Building,
  Users,
  TrendingUp,
  Clock,
} from "lucide-react";

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([
    {
      id: 1,
      customerId: "CUST20250629-001",
      customerName: "Acme Corporation",
      contactPerson: "Alice Johnson",
      email: "alice@acmecorp.com",
      phone: "+1234567890",
      billingAddress: "123 Business Ave, Corporate City, NY 10001",
      shippingAddress: "123 Business Ave, Corporate City, NY 10001",
      creditLimit: 50000,
      paymentTerms: "Net 30",
      status: "Active",
      joinDate: "Jan 15, 2024",
      totalOrders: 24,
      totalSpent: 125000,
      lastOrder: "Jun 20, 2025",
    },
    {
      id: 2,
      customerId: "CUST20250629-002",
      customerName: "Tech Innovations Ltd",
      contactPerson: "Bob Smith",
      email: "bob@techinnovations.com",
      phone: "+9876543210",
      billingAddress: "456 Innovation St, Tech Valley, CA 94000",
      shippingAddress: "789 Delivery Rd, Tech Valley, CA 94000",
      creditLimit: 75000,
      paymentTerms: "Net 45",
      status: "Active",
      joinDate: "Mar 10, 2024",
      totalOrders: 18,
      totalSpent: 89500,
      lastOrder: "Jun 25, 2025",
    },
    {
      id: 3,
      customerId: "CUST20250629-003",
      customerName: "Green Solutions Inc",
      contactPerson: "Carol Green",
      email: "carol@greensolutions.com",
      phone: "+5555555555",
      billingAddress: "321 Eco Blvd, Green City, OR 97000",
      shippingAddress: "321 Eco Blvd, Green City, OR 97000",
      creditLimit: 30000,
      paymentTerms: "Net 30",
      status: "Inactive",
      joinDate: "Feb 5, 2024",
      totalOrders: 12,
      totalSpent: 42000,
      lastOrder: "May 10, 2025",
    },
    {
      id: 4,
      customerId: "CUST20250629-004",
      customerName: "Metro Manufacturing",
      contactPerson: "David Wilson",
      email: "david@metromanufacturing.com",
      phone: "+1112223333",
      billingAddress: "654 Industrial Way, Metro City, TX 75000",
      shippingAddress: "987 Warehouse Dr, Metro City, TX 75000",
      creditLimit: 100000,
      paymentTerms: "Net 60",
      status: "Active",
      joinDate: "Dec 20, 2023",
      totalOrders: 36,
      totalSpent: 210000,
      lastOrder: "Jun 28, 2025",
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editCustomerId, setEditCustomerId] = useState(null);
  const [formData, setFormData] = useState({
    customerId: `CUST${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-${String(
      Math.floor(Math.random() * 1000) + 1
    ).padStart(3, "0")}`,
    customerName: "",
    contactPerson: "",
    email: "",
    phone: "",
    billingAddress: "",
    shippingAddress: "",
    creditLimit: "",
    paymentTerms: "",
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
  const [filterPaymentTerms, setFilterPaymentTerms] = useState("");

  const activeCustomers = customers.filter((c) => c.status === "Active").length;
  const inactiveCustomers = customers.filter(
    (c) => c.status === "Inactive"
  ).length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const avgOrderValue =
    totalRevenue / customers.reduce((sum, c) => sum + c.totalOrders, 0) || 0;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.customerName.trim())
      newErrors.customerName = "Customer name is required";
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = "Contact person is required";
    if (!formData.billingAddress.trim())
      newErrors.billingAddress = "Billing address is required";
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Invalid email format";
    if (
      formData.creditLimit &&
      (isNaN(formData.creditLimit) || formData.creditLimit < 0)
    ) {
      newErrors.creditLimit = "Credit limit must be a valid positive number";
    }
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
      const newCustomer = {
        ...formData,
        id: editCustomerId || Date.now(),
        creditLimit: Number(formData.creditLimit) || 0,
        joinDate: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        totalOrders: 0,
        totalSpent: 0,
        lastOrder: "N/A",
      };

      if (editCustomerId) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === editCustomerId
              ? {
                  ...c,
                  ...formData,
                  creditLimit: Number(formData.creditLimit) || 0,
                }
              : c
          )
        );
        setShowToast({
          visible: true,
          message: "Customer updated successfully!",
          type: "success",
        });
      } else {
        setCustomers((prev) => [...prev, newCustomer]);
        setShowToast({
          visible: true,
          message: "Customer created successfully!",
          type: "success",
        });
      }
      resetForm();
    } catch (error) {
      setShowToast({
        visible: true,
        message: "Failed to save customer.",
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

  const handleEdit = (customer) => {
    setEditCustomerId(customer.id);
    setFormData({
      customerId: customer.customerId,
      customerName: customer.customerName,
      contactPerson: customer.contactPerson,
      email: customer.email,
      phone: customer.phone,
      billingAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
      creditLimit: customer.creditLimit.toString(),
      paymentTerms: customer.paymentTerms,
      status: customer.status,
    });
    setShowModal(true);
  };

  const handleDelete = (id) => {
    setCustomers((prev) => prev.filter((customer) => customer.id !== id));
    setShowToast({
      visible: true,
      message: "Customer deleted successfully!",
      type: "success",
    });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  };

  const resetForm = () => {
    setEditCustomerId(null);
    setFormData({
      customerId: `CUST${new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "")}-${String(
        Math.floor(Math.random() * 1000) + 1
      ).padStart(3, "0")}`,
      customerName: "",
      contactPerson: "",
      email: "",
      phone: "",
      billingAddress: "",
      shippingAddress: "",
      creditLimit: "",
      paymentTerms: "",
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
      Active: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      Inactive: "bg-slate-100 text-slate-800 border border-slate-200",
    }[status] || "bg-slate-100 text-slate-800 border border-slate-200");

  const filteredCustomers = customers.filter(
    (customer) =>
      (customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.contactPerson
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.customerId.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterStatus ? customer.status === filterStatus : true) &&
      (filterPaymentTerms ? customer.paymentTerms === filterPaymentTerms : true)
  );

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black bg-clip-text">
              Customer Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your customer relationships and data
            </p>
          </div>
        </div>
      </div>

      {showToast.visible && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg text-white z-50 transform transition-all duration-300 ${
            showToast.type === "success" ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-purple-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-100 rounded-xl">
                <Users size={24} className="text-emerald-600" />
              </div>
              <button className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
                View All →
              </button>
            </div>
            <h3 className="text-sm font-medium text-emerald-600 mb-2">
              Active Customers
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {activeCustomers}
            </p>
            <p className="text-xs text-gray-500 mt-1">Currently engaged</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-slate-100 rounded-xl">
                <Clock size={24} className="text-slate-600" />
              </div>
              <button className="text-xs text-slate-600 hover:text-slate-800 font-medium">
                View All →
              </button>
            </div>
            <h3 className="text-sm font-medium text-slate-600 mb-2">
              Inactive Customers
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {inactiveCustomers}
            </p>
            <p className="text-xs text-gray-500 mt-1">Need re-engagement</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <TrendingUp size={24} className="text-blue-600" />
              </div>
              <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                View Details →
              </button>
            </div>
            <h3 className="text-sm font-medium text-blue-600 mb-2">
              Total Revenue
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-gray-500 mt-1">All-time earnings</p>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-indigo-100 hover:shadow-xl transition-all duration-300 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <CreditCard size={24} className="text-indigo-600" />
              </div>
              <button className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                Analyze →
              </button>
            </div>
            <h3 className="text-sm font-medium text-indigo-600 mb-2">
              Avg Order Value
            </h3>
            <p className="text-3xl font-bold text-gray-900">
              {formatCurrency(avgOrderValue)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Per transaction</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Customer Directory
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage all your customer information
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} />
              Add Customer
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search customers by ID, name, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <select
              value={filterPaymentTerms}
              onChange={(e) => setFilterPaymentTerms(e.target.value)}
              className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All Payment Terms</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 45">Net 45</option>
              <option value="Net 60">Net 60</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Customer ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Contact Person
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Credit Limit
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Payment Terms
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
              {filteredCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                >
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {customer.customerId}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    {customer.customerName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.contactPerson}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.phone}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    {formatCurrency(customer.creditLimit)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.paymentTerms}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                        customer.status
                      )}`}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
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
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editCustomerId ? "Edit Customer" : "Add New Customer"}
                </h3>
                <p className="text-gray-600 text-sm mt-1">
                  {editCustomerId
                    ? "Update customer information"
                    : "Create a new customer profile"}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Hash size={16} className="inline mr-2" /> Customer ID
                  </label>
                  <input
                    type="text"
                    name="customerId"
                    value={formData.customerId}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Building size={16} className="inline mr-2" /> Customer Name
                    *
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.customerName
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter customer name"
                  />
                  {errors.customerName && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.customerName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <User size={16} className="inline mr-2" /> Contact Person *
                  </label>
                  <input
                    type="text"
                    name="contactPerson"
                    value={formData.contactPerson}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.contactPerson
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter contact person name"
                  />
                  {errors.contactPerson && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.contactPerson}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Mail size={16} className="inline mr-2" /> Email Address
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.email
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter email address"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Phone size={16} className="inline mr-2" /> Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                    placeholder="Enter phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <CreditCard size={16} className="inline mr-2" /> Credit
                    Limit
                  </label>
                  <input
                    type="number"
                    name="creditLimit"
                    value={formData.creditLimit}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.creditLimit
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter credit limit"
                    min="0"
                  />
                  {errors.creditLimit && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.creditLimit}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <MapPin size={16} className="inline mr-2" /> Billing Address
                    *
                  </label>
                  <textarea
                    name="billingAddress"
                    value={formData.billingAddress}
                    onChange={handleChange}
                    rows={3}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none ${
                      errors.billingAddress
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                    placeholder="Enter billing address"
                  />
                  {errors.billingAddress && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.billingAddress}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <MapPin size={16} className="inline mr-2" /> Shipping
                    Address
                  </label>
                  <textarea
                    name="shippingAddress"
                    value={formData.shippingAddress}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
                    placeholder="Enter shipping address (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Payment Terms
                  </label>
                  <select
                    name="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Select Payment Terms</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Cash on Delivery">Cash on Delivery</option>
                    <option value="Prepaid">Prepaid</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-8 py-3  bg-blue-600 text-white rounded-xl  hover:to-blue-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                      Saving...
                    </>
                  ) : editCustomerId ? (
                    "Update Customer"
                  ) : (
                    "Add Customer"
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

export default CustomerManagement;
