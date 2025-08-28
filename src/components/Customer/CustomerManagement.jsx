import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  AlertTriangle,
  UserPlus,
  Loader2,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  DollarSign
} from "lucide-react";
import axiosInstance from "../../axios/axios";

// Session management utilities (using memory storage for Claude environment)
const SessionManager = {
  storage: {},
  
  get: (key) => {
    try {
      return this.storage[`customer_session_${key}`] || null;
    } catch {
      return null;
    }
  },
  
  set: (key, value) => {
    try {
      this.storage[`customer_session_${key}`] = value;
    } catch (error) {
      console.warn('Session storage failed:', error);
    }
  },
  
  remove: (key) => {
    try {
      delete this.storage[`customer_session_${key}`];
    } catch (error) {
      console.warn('Session removal failed:', error);
    }
  },
  
  clear: () => {
    Object.keys(this.storage).forEach(key => {
      if (key.startsWith('customer_session_')) {
        delete this.storage[key];
      }
    });
  }
};

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editCustomerId, setEditCustomerId] = useState(null);
  const [formData, setFormData] = useState({
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
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPaymentTerms, setFilterPaymentTerms] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    customerId: null,
    customerName: "",
    isDeleting: false,
  });
  
  // New UX enhancement states
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Refs for enhanced UX
  const formRef = useRef(null);
  const autoSaveInterval = useRef(null);
  const searchInputRef = useRef(null);

  // Load session data on component mount
  useEffect(() => {
    const savedFormData = SessionManager.get('formData');
    const savedFilters = SessionManager.get('filters');
    const savedSearchTerm = SessionManager.get('searchTerm');

    if (savedFormData && Object.values(savedFormData).some(val => val)) {
      setFormData(savedFormData);
      setIsDraftSaved(true);
      setLastSaveTime(SessionManager.get('lastSaveTime'));
    }
    
    if (savedFilters) {
      setFilterStatus(savedFilters.status || "");
      setFilterPaymentTerms(savedFilters.paymentTerms || "");
    }
    
    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
  }, []);

  // Auto-save form data to session
  useEffect(() => {
    if (showModal && Object.values(formData).some(val => val)) {
      autoSaveInterval.current = setTimeout(() => {
        SessionManager.set('formData', formData);
        SessionManager.set('lastSaveTime', new Date().toISOString());
        setIsDraftSaved(true);
        setLastSaveTime(new Date().toISOString());
      }, 2000);
    }

    return () => {
      if (autoSaveInterval.current) {
        clearTimeout(autoSaveInterval.current);
      }
    };
  }, [formData, showModal]);

  // Save search and filter preferences
  useEffect(() => {
    SessionManager.set('searchTerm', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    SessionManager.set('filters', { status: filterStatus, paymentTerms: filterPaymentTerms });
  }, [filterStatus, filterPaymentTerms]);

  const fetchCustomers = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      const response = await axiosInstance.get("/customers/customers");
      console.log(response.data);
      setCustomers(response.data.data || []);
      
      if (showRefreshIndicator) {
        showToastMessage("Data refreshed successfully!", "success");
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      showToastMessage(
        error.response?.data?.message || "Failed to fetch customers.",
        "error"
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(() => setShowToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    setIsDraftSaved(false);
  }, [errors]);

  const validateForm = useCallback(() => {
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
  }, [formData]);

  const handleSubmit = useCallback(async () => {
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerName: formData.customerName,
        contactPerson: formData.contactPerson,
        email: formData.email,
        phone: formData.phone,
        billingAddress: formData.billingAddress,
        shippingAddress: formData.shippingAddress,
        creditLimit: Number(formData.creditLimit) || 0,
        paymentTerms: formData.paymentTerms,
        status: formData.status,
      };

      if (editCustomerId) {
        await axiosInstance.put(`/customers/${editCustomerId}`, payload);
        showToastMessage("Customer updated successfully!", "success");
      } else {
        const response = await axiosInstance.post("/customers", payload);
        setCustomers((prev) => [
          ...prev,
          { id: response.data.data.id, ...payload },
        ]);
        showToastMessage("Customer created successfully!", "success");
      }
      
      await fetchCustomers();
      resetForm();
      
      // Clear session data after successful submission
      SessionManager.remove('formData');
      SessionManager.remove('lastSaveTime');
      
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to save customer.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [editCustomerId, formData, fetchCustomers, validateForm, showToastMessage]);

  const handleEdit = useCallback((customer) => {
    setEditCustomerId(customer._id);
    setFormData({
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
    setIsDraftSaved(false);
    
    // Clear any existing draft when editing
    SessionManager.remove('formData');
    SessionManager.remove('lastSaveTime');
  }, []);

  const showDeleteConfirmation = useCallback((customer) => {
    setDeleteConfirmation({
      visible: true,
      customerId: customer._id,
      customerName: customer.customerName,
      isDeleting: false,
    });
  }, []);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      customerId: null,
      customerName: "",
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    
    try {
      await axiosInstance.delete(`/customers/${deleteConfirmation.customerId}`);
      setCustomers((prev) => 
        prev.filter((customer) => customer._id !== deleteConfirmation.customerId)
      );
      showToastMessage("Customer deleted successfully!", "success");
      hideDeleteConfirmation();
      await fetchCustomers();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete customer.",
        "error"
      );
      setDeleteConfirmation((prev) => ({ ...prev, isDeleting: false }));
    }
  }, [deleteConfirmation.customerId, fetchCustomers, showToastMessage, hideDeleteConfirmation]);

  const resetForm = useCallback(() => {
    setEditCustomerId(null);
    setFormData({
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
    setIsDraftSaved(false);
    setLastSaveTime(null);
    
    // Clear session draft
    SessionManager.remove('formData');
    SessionManager.remove('lastSaveTime');
  }, []);

  const openAddModal = useCallback(() => {
    resetForm();
    setShowModal(true);
    setTimeout(() => {
      const modal = document.querySelector(".modal-container");
      if (modal) {
        modal.classList.add("scale-100");
      }
      
      // Focus first input
      if (formRef.current) {
        const firstInput = formRef.current.querySelector('input[name="customerName"]');
        if (firstInput) firstInput.focus();
      }
    }, 10);
  }, [resetForm]);

  const handleRefresh = useCallback(() => {
    fetchCustomers(true);
  }, [fetchCustomers]);

  const handleSort = useCallback((key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const getStatusBadge = useCallback((status) => {
    const badges = {
      Active: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      Inactive: "bg-slate-100 text-slate-800 border border-slate-200",
    };
    return badges[status] || "bg-slate-100 text-slate-800 border border-slate-200";
  }, []);

  const getStatusIcon = useCallback((status) => {
    const icons = {
      Active: <CheckCircle size={14} className="text-emerald-600" />,
      Inactive: <XCircle size={14} className="text-slate-600" />,
    };
    return icons[status] || <AlertCircle size={14} className="text-slate-600" />;
  }, []);

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }, []);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return '';
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    return time.toLocaleTimeString();
  }, []);

  // Enhanced statistics calculations
  const customerStats = useMemo(() => {
    const activeCustomers = customers.filter((c) => c.status === "Active").length;
    const inactiveCustomers = customers.filter((c) => c.status === "Inactive").length;
    const totalRevenue = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
    const totalOrders = customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    return {
      activeCustomers,
      inactiveCustomers,
      totalRevenue,
      avgOrderValue,
      totalCustomers: customers.length
    };
  }, [customers]);

  const sortedAndFilteredCustomers = useMemo(() => {
    let filtered = customers.filter(
      (customer) =>
        (customer.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          customer.customerId.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterStatus ? customer.status === filterStatus : true) &&
        (filterPaymentTerms ? customer.paymentTerms === filterPaymentTerms : true)
    );

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [customers, searchTerm, filterStatus, filterPaymentTerms, sortConfig]);

  // Enhanced Empty State Component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <UserPlus size={40} className="text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No customers found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm || filterStatus || filterPaymentTerms
          ? "No customers match your current filters. Try adjusting your search criteria."
          : "Start building your customer base by adding your first customer."}
      </p>
      <button
        onClick={openAddModal}
        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
      >
        <Plus size={20} />
        Add First Customer
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      {/* Enhanced Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black bg-clip-text">
              Customer Management
            </h1>
            <p className="text-gray-600 mt-1">
              {customerStats.totalCustomers} total customers • {sortedAndFilteredCustomers.length} displayed
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw size={16} className={`text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 ${
              showFilters ? 'bg-purple-100 text-purple-600' : 'bg-white text-gray-600'
            }`}
            title="Toggle filters"
          >
            <Filter size={16} />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast.visible && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg text-white z-50 transform transition-all duration-300 ${
            showToast.type === "success" ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          <div className="flex items-center space-x-2">
            {showToast.type === "success" ? (
              <CheckCircle size={16} />
            ) : (
              <XCircle size={16} />
            )}
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Enhanced Statistics Cards */}
      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: "Active Customers",
              count: customerStats.activeCustomers,
              icon: <Users size={24} />,
              bgColor: "bg-emerald-50",
              textColor: "text-emerald-700",
              borderColor: "border-emerald-200",
              iconBg: "bg-emerald-100",
              iconColor: "text-emerald-600"
            },
            {
              title: "Inactive Customers",
              count: customerStats.inactiveCustomers,
              icon: <Clock size={24} />,
              bgColor: "bg-slate-50",
              textColor: "text-slate-700",
              borderColor: "border-slate-200",
              iconBg: "bg-slate-100",
              iconColor: "text-slate-600"
            },
            {
              title: "Total Revenue",
              count: formatCurrency(customerStats.totalRevenue),
              icon: <TrendingUp size={24} />,
              bgColor: "bg-blue-50",
              textColor: "text-blue-700",
              borderColor: "border-blue-200",
              iconBg: "bg-blue-100",
              iconColor: "text-blue-600"
            },
            {
              title: "Avg Order Value",
              count: formatCurrency(customerStats.avgOrderValue),
              icon: <DollarSign size={24} />,
              bgColor: "bg-indigo-50",
              textColor: "text-indigo-700",
              borderColor: "border-indigo-200",
              iconBg: "bg-indigo-100",
              iconColor: "text-indigo-600"
            }
          ].map((card, index) => (
            <div
              key={index}
              className={`${card.bgColor} ${card.borderColor} rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-105`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${card.iconBg} rounded-xl`}>
                  <div className={card.iconColor}>
                    {card.icon}
                  </div>
                </div>
                <button
                  className={`text-xs ${card.textColor} hover:opacity-80 transition-opacity font-medium`}
                  onClick={() => {
                    if (card.title.includes('Active')) setFilterStatus('Active');
                    else if (card.title.includes('Inactive')) setFilterStatus('Inactive');
                  }}
                >
                  {card.title.includes('Revenue') || card.title.includes('Avg') ? 'View Details →' : 'View All →'}
                </button>
              </div>
              <h3 className={`text-sm font-medium ${card.textColor} mb-2`}>
                {card.title}
              </h3>
              <p className="text-3xl font-bold text-gray-900">
                {card.count}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {card.title.includes('Active') ? 'Currently engaged' :
                 card.title.includes('Inactive') ? 'Need re-engagement' :
                 card.title.includes('Revenue') ? 'All-time earnings' :
                 'Per transaction'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        {/* Header */}
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
              className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} />
              Add Customer
            </button>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search customers by ID, name, email, or contact person..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                
                <select
                  value={filterPaymentTerms}
                  onChange={(e) => setFilterPaymentTerms(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">All Payment Terms</option>
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Net 60">Net 60</option>
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="Prepaid">Prepaid</option>
                </select>
                
                <button
                  onClick={() => {
                    setFilterStatus("");
                    setFilterPaymentTerms("");
                    setSearchTerm("");
                  }}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table/Content */}
        {sortedAndFilteredCustomers.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: 'customerId', label: 'Customer ID' },
                    { key: 'customerName', label: 'Customer Name' },
                    { key: 'contactPerson', label: 'Contact Person' },
                    { key: 'email', label: 'Email' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'creditLimit', label: 'Credit Limit' },
                    { key: 'paymentTerms', label: 'Payment Terms' },
                    { key: 'status', label: 'Status' },
                    { key: null, label: 'Actions' }
                  ].map((column) => (
                    <th
                      key={column.key || 'actions'}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={column.key ? () => handleSort(column.key) : undefined}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {column.key && sortConfig.key === column.key && (
                          <span className="text-purple-600">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAndFilteredCustomers.map((customer) => (
                  <tr
                    key={customer._id}
                    className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {customer.customerId}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                          <Users size={16} className="text-purple-600" />
                        </div>
                        <div>
                          <div className="font-medium">{customer.customerName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {customer.contactPerson}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <a 
                        href={`mailto:${customer.email}`}
                        className="text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        {customer.email}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <a 
                        href={`tel:${customer.phone}`}
                        className="text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        {customer.phone}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {formatCurrency(customer.creditLimit)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {customer.paymentTerms}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(customer.status)}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            customer.status
                          )}`}
                        >
                          {customer.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                          title="Edit customer"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(customer)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Delete customer"
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

      {/* Enhanced Delete Confirmation Modal */}
      {deleteConfirmation.visible && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Customer
              </h3>
              
              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                "{deleteConfirmation.customerName}"?
              </p>
              <p className="text-sm text-gray-500 text-center mb-8">
                This action cannot be undone and will permanently remove the customer from your database.
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={hideDeleteConfirmation}
                  disabled={deleteConfirmation.isDeleting}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteConfirmation.isDeleting}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 font-medium disabled:opacity-50 flex items-center justify-center"
                >
                  {deleteConfirmation.isDeleting ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} className="mr-2" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editCustomerId ? "Edit Customer" : "Add New Customer"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {editCustomerId
                      ? "Update customer information"
                      : "Create a new customer profile"}
                  </p>
                  {isDraftSaved && lastSaveTime && (
                    <p className="text-sm text-green-600 flex items-center">
                      <Save size={12} className="mr-1" />
                      Draft saved {formatLastSaveTime(lastSaveTime)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all duration-200"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6" ref={formRef}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Building size={16} className="inline mr-2" /> Customer Name *
                  </label>
                  <input
                    type="text"
                    name="customerName"
                    value={formData.customerName}
                    onChange={handleChange}
                    placeholder="Enter customer name"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.customerName
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.customerName && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
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
                    placeholder="Enter contact person name"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.contactPerson
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.contactPerson && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
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
                    placeholder="customer@example.com"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.email
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.email}
                    </p>
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
                    placeholder="+1-555-0123"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <CreditCard size={16} className="inline mr-2" /> Credit Limit
                  </label>
                  <input
                    type="number"
                    name="creditLimit"
                    value={formData.creditLimit}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
                      errors.creditLimit
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.creditLimit && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.creditLimit}
                    </p>
                  )}
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <MapPin size={16} className="inline mr-2" /> Billing Address *
                  </label>
                  <textarea
                    name="billingAddress"
                    value={formData.billingAddress}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter complete billing address"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none ${
                      errors.billingAddress
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.billingAddress && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.billingAddress}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <MapPin size={16} className="inline mr-2" /> Shipping Address
                  </label>
                  <textarea
                    name="shippingAddress"
                    value={formData.shippingAddress}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter shipping address (optional)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none"
                  />
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

              {/* Modal Footer */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                  {isDraftSaved ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle size={14} className="mr-1" />
                      Changes saved automatically
                    </span>
                  ) : formData.customerName || formData.contactPerson || formData.email ? (
                    <span className="flex items-center text-amber-600">
                      <Clock size={14} className="mr-1" />
                      Unsaved changes
                    </span>
                  ) : null}
                </div>
                
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={isSubmitting}
                    className="px-6 py-3 text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Saving...
                      </>
                    ) : editCustomerId ? (
                      <>
                        <Save size={16} className="mr-2" />
                        Update Customer
                      </>
                    ) : (
                      <>
                        <Plus size={16} className="mr-2" />
                        Add Customer
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;