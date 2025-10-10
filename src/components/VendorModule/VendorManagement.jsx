import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  AlertTriangle,
  Loader2,
  RefreshCw,
  Save,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Filter,
  Download
} from "lucide-react";
import axiosInstance from "../../axios/axios";

// Session management utilities (using memory storage for Claude environment)
const SessionManager = {
  storage: {},
  
  get: (key) => {
    try {
      return this.storage[`vendor_session_${key}`] || null;
    } catch {
      return null;
    }
  },
  
  set: (key, value) => {
    try {
      this.storage[`vendor_session_${key}`] = value;
    } catch (error) {
      console.warn('Session storage failed:', error);
    }
  },
  
  remove: (key) => {
    try {
      delete this.storage[`vendor_session_${key}`];
    } catch (error) {
      console.warn('Session removal failed:', error);
    }
  },
  
  clear: () => {
    Object.keys(this.storage).forEach(key => {
      if (key.startsWith('vendor_session_')) {
        delete this.storage[key];
      }
    });
  }
};

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
    itemName: "",
    id: null,
    isDeleting: false,
  });
  
  // New UX enhancement states
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // table, card
  const [selectedVendors, setSelectedVendors] = useState([]);
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
    const savedViewMode = SessionManager.get('viewMode');

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
    
    if (savedViewMode) {
      setViewMode(savedViewMode);
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
      }, 2000); // Auto-save after 2 seconds of inactivity
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

  useEffect(() => {
    SessionManager.set('viewMode', viewMode);
  }, [viewMode]);

  const fetchVendors = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      const res = await axiosInstance.get("/vendors/vendors");
      setVendors(res.data.data || []);
      
      if (showRefreshIndicator) {
        showToastMessage("Data refreshed successfully!", "success");
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
      showToastMessage(
        error.response?.data?.message || "Failed to fetch vendors.",
        "error"
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(() => setShowToast(prev => ({ ...prev, visible: false })), 3000);
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: "" } : prev));
    setIsDraftSaved(false);
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};
    if (!formData.vendorName.trim())
      newErrors.vendorName = "Vendor name is required";
    if (!formData.contactPerson.trim())
      newErrors.contactPerson = "Contact person is required";
    if (!formData.address.trim()) newErrors.address = "Address is required";
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = "Invalid email format";
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
      const payload = { ...formData, status: formData.status || "Compliant" };
      delete payload.vendorId;

      if (editVendorId) {
        await axiosInstance.put(`/vendors/vendors/${editVendorId}`, payload);
        showToastMessage("Vendor updated successfully!", "success");
      } else {
        await axiosInstance.post("/vendors/vendors", payload);
        showToastMessage("Vendor created successfully!", "success");
      }
      
      await fetchVendors();
      resetForm();
      
      // Clear session data after successful submission
      SessionManager.remove('formData');
      SessionManager.remove('lastSaveTime');
      
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to save vendor.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [editVendorId, formData, fetchVendors, validateForm, showToastMessage]);

  const handleEdit = useCallback((vendor) => {
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
    setIsDraftSaved(false);
    
    // Clear any existing draft when editing
    SessionManager.remove('formData');
    SessionManager.remove('lastSaveTime');
  }, []);

  const handleDelete = useCallback((id, vendorName) => {
    setDeleteConfirmation({
      visible: true,
      itemName: vendorName,
      id,
      isDeleting: false,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    setDeleteConfirmation((prev) => ({ ...prev, isDeleting: true }));
    try {
      await axiosInstance.delete(`/vendors/vendors/${deleteConfirmation.id}`);
      await fetchVendors();
      showToastMessage("Vendor deleted successfully!", "success");
      hideDeleteConfirmation();
    } catch (error) {
      showToastMessage(
        error.response?.data?.message || "Failed to delete vendor.",
        "error"
      );
    }
  }, [deleteConfirmation.id, fetchVendors, showToastMessage]);

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({
      visible: false,
      itemName: "",
      id: null,
      isDeleting: false,
    });
  }, []);

  const resetForm = useCallback(() => {
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
        const firstInput = formRef.current.querySelector('input[name="vendorName"]');
        if (firstInput) firstInput.focus();
      }
    }, 10);
  }, [resetForm]);

  const handleRefresh = useCallback(() => {
    fetchVendors(true);
  }, [fetchVendors]);

  const handleSort = useCallback((key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const getStatusBadge = useCallback((status) => {
    const badges = {
      Compliant: "bg-green-100 text-green-800 border border-green-200",
      "Non-compliant": "bg-red-100 text-red-800 border border-red-200",
      Pending: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      Expired: "bg-gray-100 text-gray-800 border border-gray-200",
    };
    return badges[status] || "bg-gray-100 text-gray-800 border border-gray-200";
  }, []);

  const getStatusIcon = useCallback((status) => {
    const icons = {
      Compliant: <CheckCircle size={14} className="text-green-600" />,
      "Non-compliant": <XCircle size={14} className="text-red-600" />,
      Pending: <Clock size={14} className="text-yellow-600" />,
      Expired: <AlertCircle size={14} className="text-gray-600" />,
    };
    return icons[status] || <AlertCircle size={14} className="text-gray-600" />;
  }, []);

  const sortedAndFilteredVendors = useMemo(() => {
    let filtered = vendors.filter(
      (vendor) =>
        (vendor.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vendor.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vendor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vendor.vendorId.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (filterStatus ? vendor.status === filterStatus : true) &&
        (filterPaymentTerms ? vendor.paymentTerms === filterPaymentTerms : true)
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
  }, [vendors, searchTerm, filterStatus, filterPaymentTerms, sortConfig]);

  const vendorStats = useMemo(
    () => ({
      compliantVendors: vendors.filter((v) => v.status === "Compliant").length,
      nonCompliantVendors: vendors.filter((v) => v.status === "Non-compliant").length,
      pendingVendors: vendors.filter((v) => v.status === "Pending").length,
      expiredVendors: vendors.filter((v) => v.status === "Expired").length,
      totalVendors: vendors.length,
    }),
    [vendors]
  );

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading vendors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 sm:mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Vendor Management
            </h1>
            <p className="text-gray-600 text-sm mt-1">
              {vendorStats.totalVendors} total vendors • {sortedAndFilteredVendors.length} displayed
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
              showFilters ? 'bg-blue-100 text-blue-600' : 'bg-white text-gray-600'
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.visible && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-300 scale-100">
            <div className="p-6">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle size={32} className="text-red-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Delete Vendor
              </h3>
              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                "{deleteConfirmation.itemName}"?
              </p>
              <p className="text-sm text-gray-500 text-center mb-8">
                This action cannot be undone and will permanently remove the
                vendor from your records.
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

      {/* Statistics Cards */}
      {/* <div className="mb-6 sm:mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: "Compliant Vendors",
              count: vendorStats.compliantVendors,
              color: "emerald",
              icon: <CheckCircle size={20} />,
              bgColor: "bg-emerald-50",
              textColor: "text-emerald-700",
              borderColor: "border-emerald-200"
            },
            {
              title: "Non-compliant Vendors",
              count: vendorStats.nonCompliantVendors,
              color: "red",
              icon: <XCircle size={20} />,
              bgColor: "bg-red-50",
              textColor: "text-red-700",
              borderColor: "border-red-200"
            },
            {
              title: "Pending Vendors",
              count: vendorStats.pendingVendors,
              color: "yellow",
              icon: <Clock size={20} />,
              bgColor: "bg-yellow-50",
              textColor: "text-yellow-700",
              borderColor: "border-yellow-200"
            },
            {
              title: "Expired Vendors",
              count: vendorStats.expiredVendors,
              color: "gray",
              icon: <AlertCircle size={20} />,
              bgColor: "bg-gray-50",
              textColor: "text-gray-700",
              borderColor: "border-gray-200"
            },
          ].map((card, index) => (
            <div
              key={index}
              className={`${card.bgColor} ${card.borderColor} rounded-xl p-4 sm:p-6 border transition-all duration-200 hover:shadow-sm cursor-pointer`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg bg-white ${card.textColor}`}>
                  {card.icon}
                </div>
                <button
                  className={`text-xs ${card.textColor} hover:opacity-80 transition-opacity`}
                  onClick={() => setFilterStatus(card.title.includes('Compliant') ? 'Compliant' : 
                                                card.title.includes('Non-compliant') ? 'Non-compliant' :
                                                card.title.includes('Pending') ? 'Pending' : 'Expired')}
                >
                  View All →
                </button>
              </div>
              <h3 className={`text-sm font-medium ${card.textColor} mb-1`}>
                {card.title}
              </h3>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                {card.count}
              </p>
            </div>
          ))}
        </div>
      </div> */}

      {/* Main Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">All Vendors</h2>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 w-full sm:w-auto transform hover:scale-105 active:scale-95"
            >
              <Plus size={16} />
              Add Vendor
            </button>
          </div>
          
          {/* Search and Filters */}
          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by Vendor ID, Name, Email, or Contact Person..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
                
                <button
                  onClick={() => {
                    setFilterStatus("");
                    setFilterPaymentTerms("");
                    setSearchTerm("");
                  }}
                  className="px-4 py-2 text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200 w-full sm:w-auto"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          {sortedAndFilteredVendors.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Search size={48} className="mx-auto" />
              </div>
              <p className="text-gray-600 text-lg mb-2">No vendors found</p>
              <p className="text-gray-500">
                {searchTerm || filterStatus || filterPaymentTerms
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first vendor"}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { key: 'vendorId', label: 'Vendor ID' },
                    { key: 'vendorName', label: 'Vendor Name' },
                    { key: 'contactPerson', label: 'Contact Person' },
                    { key: 'email', label: 'Email' },
                    { key: 'phone', label: 'Phone Number' },
                    { key: 'address', label: 'Billing Address' },
                    { key: 'status', label: 'Status' },
                    { key: null, label: 'Actions' }
                  ].map((column) => (
                    <th
                      key={column.key || 'actions'}
                      className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={column.key ? () => handleSort(column.key) : undefined}
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {column.key && sortConfig.key === column.key && (
                          <span className="text-blue-600">
                            {sortConfig.direction === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAndFilteredVendors.map((vendor) => (
                  <tr 
                    key={vendor._id} 
                    className="hover:bg-gray-50 transition-colors duration-150"
                  >
                    <td className="px-4 sm:px-6 py-4 text-sm font-medium text-gray-900">
                      {vendor.vendorId}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <User size={16} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="font-medium">{vendor.vendorName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      {vendor.contactPerson}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      <a 
                        href={`mailto:${vendor.email}`}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {vendor.email}
                      </a>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      <a 
                        href={`tel:${vendor.phone}`}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {vendor.phone}
                      </a>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate" title={vendor.address}>
                        {vendor.address}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(vendor.status)}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            vendor.status
                          )}`}
                        >
                          {vendor.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleEdit(vendor)}
                          className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded hover:bg-blue-50"
                          title="Edit vendor"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(vendor._id, vendor.vendorName)}
                          className="text-red-600 hover:text-red-800 transition-colors p-1 rounded hover:bg-red-50"
                          title="Delete vendor"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Enhanced Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-white/50 w-full flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">
                  {editVendorId ? "Edit Vendor" : "Add New Vendor"}
                </h3>
                {isDraftSaved && lastSaveTime && (
                  <p className="text-sm text-green-600 flex items-center mt-1">
                    <Save size={12} className="mr-1" />
                    Draft saved {formatLastSaveTime(lastSaveTime)}
                  </p>
                )}
              </div>
              <button
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 sm:p-6" ref={formRef}>
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
                    placeholder="Enter vendor name"
                    className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.vendorName ? "border-red-300 bg-red-50" : "border-gray-300"
                    }`}
                  />
                  {errors.vendorName && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
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
                    placeholder="Enter contact person name"
                    className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.contactPerson ? "border-red-300 bg-red-50" : "border-gray-300"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail size={16} className="inline mr-1" /> Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="vendor@example.com"
                    className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
                      errors.email ? "border-red-300 bg-red-50" : "border-gray-300"
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone size={16} className="inline mr-1" /> Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+1-555-0123"
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin size={16} className="inline mr-1" /> Billing Address *
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter complete billing address"
                    className={`w-full px-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none ${
                      errors.address ? "border-red-300 bg-red-50" : "border-gray-300"
                    }`}
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.address}
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <CreditCard size={16} className="inline mr-1" /> Payment Terms
                  </label>
                  <select
                    name="paymentTerms"
                    value={formData.paymentTerms}
                    onChange={handleChange}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Select payment terms</option>
                    <option value="30 days">30 days</option>
                    <option value="Net 30">Net 30</option>
                    <option value="45 days">45 days</option>
                    <option value="Net 60">Net 60</option>
                    <option value="60 days">60 days</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="">Select status</option>
                    <option value="Compliant">Compliant</option>
                    <option value="Non-compliant">Non-compliant</option>
                    <option value="Pending">Pending</option>
                    <option value="Expired">Expired</option>
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
                  ) : formData.vendorName || formData.contactPerson || formData.email ? (
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
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Saving...
                      </>
                    ) : editVendorId ? (
                      <>
                        <Save size={16} className="mr-2" />
                        Update Vendor
                      </>
                    ) : (
                      <>
                        <Plus size={16} className="mr-2" />
                        Add Vendor
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

export default VendorManagement;