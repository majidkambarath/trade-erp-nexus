import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
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
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  Clock,
  AlertCircle,
  File,
  Eye,
} from "lucide-react";
import axiosInstance from "../../axios/axios";

// Session management utilities
const SessionManager = {
  storage: {},

  get: (key) => {
    try {
      return this.storage[`staff_session_${key}`] || null;
    } catch {
      return null;
    }
  },

  set: (key, value) => {
    try {
      this.storage[`staff_session_${key}`] = value;
    } catch (error) {
      console.warn("Session storage failed:", error);
    }
  },

  remove: (key) => {
    try {
      delete this.storage[`staff_session_${key}`];
    } catch (error) {
      console.warn("Session removal failed:", error);
    }
  },

  clear: () => {
    Object.keys(this.storage).forEach((key) => {
      if (key.startsWith("staff_session_")) {
        delete this.storage[key];
      }
    });
  },
};

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editStaffId, setEditStaffId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

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
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    visible: false,
    staffId: null,
    staffName: "",
    isDeleting: false,
  });
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState(null);

  const formRef = useRef(null);
  const searchInputRef = useRef(null);
  const autoSaveInterval = useRef(null);
  const navigate = useNavigate();

  const designations = [
    "Manager",
    "Accountant",
    "Sales Executive",
    "HR Manager",
    "IT Support",
    "Marketing Specialist",
  ];

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  }, []);

  const fetchStaff = useCallback(
    async (showRefreshIndicator = false) => {
      try {
        if (showRefreshIndicator) {
          setIsLoading(true);
        } else {
          setIsLoading(true);
        }
        const response = await axiosInstance.get("/staff/staff");
        setStaff(response.data.data?.staff || []);
        if (showRefreshIndicator) {
          showToastMessage("Staff data refreshed successfully!", "success");
        }
      } catch (error) {
        console.error("Failed to fetch staff:", error);
        showToastMessage(
          error.response?.data?.message || "Failed to fetch staff.",
          "error"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [showToastMessage]
  );

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    const savedFormData = SessionManager.get("formData");
    const savedFilters = SessionManager.get("filters");
    const savedSearchTerm = SessionManager.get("searchTerm");

    if (savedFormData && Object.values(savedFormData).some((val) => val)) {
      setFormData({
        ...savedFormData,
        contactNo: savedFormData.contactNo?.trim() || "",
        idNo: savedFormData.idNo?.trim() || "",
      });
      setIsDraftSaved(true);
      setLastSaveTime(SessionManager.get("lastSaveTime"));
    }

    if (savedFilters) {
      setFilterStatus(savedFilters.status || "");
      setFilterDesignation(savedFilters.designation || "");
    }

    if (savedSearchTerm) {
      setSearchTerm(savedSearchTerm);
    }
  }, []);

  useEffect(() => {
    if (showModal && Object.values(formData).some((val) => val)) {
      autoSaveInterval.current = setTimeout(() => {
        SessionManager.set("formData", {
          ...formData,
          contactNo: formData.contactNo.trim(),
          idNo: formData.idNo.trim(),
        });
        SessionManager.set("lastSaveTime", new Date().toISOString());
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

  useEffect(() => {
    SessionManager.set("searchTerm", searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    SessionManager.set("filters", {
      status: filterStatus,
      designation: filterDesignation,
    });
  }, [filterStatus, filterDesignation]);

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

      SessionManager.remove("formData");
      SessionManager.remove("lastSaveTime");
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
        ? new Date(staffMember.joiningDate).toISOString().split("T")[0]
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

    SessionManager.remove("formData");
    SessionManager.remove("lastSaveTime");
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
      setStaff((prev) =>
        prev.filter((s) => s._id !== deleteConfirmation.staffId)
      );
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

    SessionManager.remove("formData");
    SessionManager.remove("lastSaveTime");
  }, []);

  const openAddModal = useCallback(() => {
    resetForm();
    setShowModal(true);
    setTimeout(() => {
      const modal = document.querySelector(".modal-container");
      if (modal) {
        modal.classList.add("scale-100");
      }

      if (formRef.current) {
        const firstInput = formRef.current.querySelector('input[name="name"]');
        if (firstInput) firstInput.focus();
      }
    }, 10);
  }, [resetForm]);

  const handleSort = useCallback((key) => {
    setSortConfig((prevConfig) => ({
      key,
      direction:
        prevConfig.key === key && prevConfig.direction === "asc"
          ? "desc"
          : "asc",
    }));
  }, []);

  const getStatusBadge = useCallback((status) => {
    const badges = {
      Active: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      Inactive: "bg-slate-100 text-slate-800 border border-slate-200",
    };
    return (
      badges[status] || "bg-slate-100 text-slate-800 border border-slate-200"
    );
  }, []);

  const getStatusIcon = useCallback((status) => {
    const icons = {
      Active: <CheckCircle size={14} className="text-emerald-600" />,
      Inactive: <XCircle size={14} className="text-slate-600" />,
    };
    return (
      icons[status] || <AlertCircle size={14} className="text-slate-600" />
    );
  }, []);

  const formatLastSaveTime = useCallback((timeString) => {
    if (!timeString) return "";
    const time = new Date(timeString);
    const now = new Date();
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    return time.toLocaleTimeString();
  }, []);

  const staffStats = useMemo(() => {
    const totalStaff = staff.length;
    const activeStaff = staff.filter((s) => s.status === "Active").length;
    const inactiveStaff = staff.filter((s) => s.status === "Inactive").length;
    const activeRate =
      totalStaff > 0 ? Math.round((activeStaff / totalStaff) * 100) : 0;

    return { totalStaff, activeStaff, inactiveStaff, activeRate };
  }, [staff]);

  const sortedAndFilteredStaff = useMemo(() => {
    let filtered = staff.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.idNo.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus
        ? member.status === filterStatus
        : true;
      const matchesDesignation = filterDesignation
        ? member.designation === filterDesignation
        : true;

      return matchesSearch && matchesStatus && matchesDesignation;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [staff, searchTerm, filterStatus, filterDesignation, sortConfig]);

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Users size={40} className="text-indigo-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No staff members found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm || filterStatus || filterDesignation
          ? "No staff match your current filters. Try adjusting your search criteria."
          : "Start building your team by adding your first staff member."}
      </p>
      <button
        onClick={openAddModal}
        className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
      >
        <Plus size={20} />
        Add First Staff Member
      </button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="text-indigo-600 animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg">Loading staff members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black bg-clip-text">
              Staff Management
            </h1>
            <p className="text-gray-600 mt-1">
              {staffStats.totalStaff} total staff •{" "}
              {sortedAndFilteredStaff.length} displayed
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
            {showToast.type === "success" ? (
              <CheckCircle size={16} />
            ) : (
              <XCircle size={16} />
            )}
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: "Total Staff",
              count: staffStats.totalStaff,
              icon: <Users size={24} />,
              bgColor: "bg-indigo-50",
              textColor: "text-indigo-700",
              borderColor: "border-indigo-200",
              iconBg: "bg-indigo-100",
              iconColor: "text-indigo-600",
            },
            {
              title: "Active Staff",
              count: staffStats.activeStaff,
              icon: <UserCheck size={24} />,
              bgColor: "bg-emerald-50",
              textColor: "text-emerald-700",
              borderColor: "border-emerald-200",
              iconBg: "bg-emerald-100",
              iconColor: "text-emerald-600",
            },
            {
              title: "Inactive Staff",
              count: staffStats.inactiveStaff,
              icon: <UserX size={24} />,
              bgColor: "bg-red-50",
              textColor: "text-red-700",
              borderColor: "border-red-200",
              iconBg: "bg-red-100",
              iconColor: "text-red-600",
            },
            {
              title: "Active Rate",
              count: `${staffStats.activeRate}%`,
              icon: <Briefcase size={24} />,
              bgColor: "bg-purple-50",
              textColor: "text-purple-700",
              borderColor: "border-purple-200",
              iconBg: "bg-purple-100",
              iconColor: "text-purple-600",
            },
          ].map((card, index) => (
            <div
              key={index}
              className={`${card.bgColor} ${card.borderColor} rounded-2xl p-6 border transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-105`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 ${card.iconBg} rounded-xl`}>
                  <div className={card.iconColor}>{card.icon}</div>
                </div>
                <button
                  className={`text-xs ${card.textColor} hover:opacity-80 transition-opacity font-medium`}
                  onClick={() => {
                    if (card.title.includes("Active"))
                      setFilterStatus("Active");
                    else if (card.title.includes("Inactive"))
                      setFilterStatus("Inactive");
                  }}
                >
                  View All →
                </button>
              </div>
              <h3 className={`text-sm font-medium ${card.textColor} mb-2`}>
                {card.title}
              </h3>
              <p className="text-3xl font-bold text-gray-900">{card.count}</p>
              <p className="text-xs text-gray-500 mt-1">
                {card.title.includes("Total Staff")
                  ? "All team members"
                  : card.title.includes("Active")
                  ? "Currently working"
                  : card.title.includes("Inactive")
                  ? "Not currently active"
                  : "Staff engagement"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Staff Directory
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Manage your team members and their professional details
              </p>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-3 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus size={18} />
              Add Staff Member
            </button>
          </div>

          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by name, designation, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
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
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
                <select
                  value={filterDesignation}
                  onChange={(e) => setFilterDesignation(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">All Designations</option>
                  {designations.map((des) => (
                    <option key={des} value={des}>
                      {des}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    setFilterStatus("");
                    setFilterDesignation("");
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

        {sortedAndFilteredStaff.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "name", label: "Staff Info" },
                    { key: "designation", label: "Designation" },
                    { key: "contactNo", label: "Contact No" },
                    { key: "idNo", label: "ID Number" },
                    { key: "joiningDate", label: "Joining Date" },
                    { key: "status", label: "Status" },
                    { key: null, label: "Actions" },
                  ].map((column) => (
                    <th
                      key={column.key || "actions"}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={
                        column.key ? () => handleSort(column.key) : undefined
                      }
                    >
                      <div className="flex items-center space-x-1">
                        <span>{column.label}</span>
                        {column.key && sortConfig.key === column.key && (
                          <span className="text-indigo-600">
                            {sortConfig.direction === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAndFilteredStaff.map((member) => (
                  <tr
                    key={member._id}
                    className="hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all duration-200"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <User size={20} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {member.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            ID: {member._id}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-indigo-600">
                        {member.designation}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">
                        {member.contactNo}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-mono font-bold text-gray-600">
                        {member.idNo}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600">
                        {new Date(member.joiningDate).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(member.status)}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            member.status
                          )}`}
                        >
                          {member.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleEdit(member)}
                          className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all duration-200"
                          title="Edit staff"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => showDeleteConfirmation(member)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                          title="Delete staff"
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
                Delete Staff Member
              </h3>
              <p className="text-gray-600 text-center mb-2">
                Are you sure you want to delete
              </p>
              <p className="text-gray-900 font-semibold text-center mb-6">
                "{deleteConfirmation.staffName}"?
              </p>
              <p className="text-sm text-gray-500 text-center mb-8">
                This action cannot be undone and will permanently remove the
                staff member from your records.
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

      {showModal && (
        <div className="fixed inset-0 bg-white/50 flex items-center justify-center p-4 z-50 modal-container transform scale-95 transition-transform duration-300">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50 sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {editStaffId ? "Edit Staff Member" : "Add New Staff Member"}
                </h3>
                <div className="flex items-center mt-1 space-x-4">
                  <p className="text-gray-600 text-sm">
                    {editStaffId
                      ? "Update staff member information"
                      : "Create a new staff member profile"}
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

            <div className="p-6" ref={formRef}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <User size={20} className="mr-2 text-indigo-600" />
                    Personal Information
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <User size={16} className="inline mr-2" />
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.name
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Briefcase size={16} className="inline mr-2" />
                    Designation *
                  </label>
                  <select
                    name="designation"
                    value={formData.designation}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.designation
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  >
                    <option value="">Select Designation</option>
                    {designations.map((des) => (
                      <option key={des} value={des}>
                        {des}
                      </option>
                    ))}
                  </select>
                  {errors.designation && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.designation}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Phone size={16} className="inline mr-2" />
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    name="contactNo"
                    value={formData.contactNo}
                    onChange={handleChange}
                    placeholder="Enter contact number"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.contactNo
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.contactNo && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.contactNo}
                    </p>
                  )}
                </div>

                <div className="lg:col-span-3">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText size={20} className="mr-2 text-purple-600" />
                    Identification Information
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FileText size={16} className="inline mr-2" />
                    ID/Passport Number *
                  </label>
                  <input
                    type="text"
                    name="idNo"
                    value={formData.idNo}
                    onChange={handleChange}
                    placeholder="Enter ID or Passport number"
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.idNo
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.idNo && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.idNo}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Calendar size={16} className="inline mr-2" />
                    Joining Date *
                  </label>
                  <input
                    type="date"
                    name="joiningDate"
                    value={formData.joiningDate}
                    onChange={handleChange}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 ${
                      errors.joiningDate
                        ? "border-red-300 bg-red-50"
                        : "border-gray-300"
                    }`}
                  />
                  {errors.joiningDate && (
                    <p className="mt-1 text-sm text-red-600 flex items-center">
                      <AlertCircle size={12} className="mr-1" />
                      {errors.joiningDate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div className="lg:col-span-3">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Upload size={20} className="mr-2 text-green-600" />
                    Documents
                  </h4>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Upload size={16} className="inline mr-2" />
                    ID Proof Document
                  </label>
                  <div className="flex flex-col space-y-3">
                    {filePreviews.idProof ? (
                      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50">
                        <div className="flex items-center space-x-3">
                          {filePreviews.idProof.type.startsWith("image/") ||
                          filePreviews.idProof.type === "existing" ? (
                            <img
                              src={filePreviews.idProof.url}
                              alt="ID Proof Preview"
                              className="w-12 h-12 object-cover rounded-md"
                            />
                          ) : (
                            <File size={24} className="text-gray-500" />
                          )}
                          <span className="text-sm text-gray-600 truncate max-w-[150px]">
                            {filePreviews.idProof.name}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          {filePreviews.idProof.type !== "existing" && (
                            <a
                              href={filePreviews.idProof.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg"
                              title="View file"
                            >
                              <Eye size={16} />
                            </a>
                          )}
                          <button
                            onClick={() => handleFileDelete("idProof")}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                            title="Delete file"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          handleFileUpload("idProof", e.target.files[0])
                        }
                        className="hidden"
                        id="idProofUpload"
                      />
                    )}
                    <label
                      htmlFor="idProofUpload"
                      className="px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-all duration-200 text-center text-sm text-gray-600"
                    >
                      {filePreviews.idProof
                        ? "Replace ID Proof"
                        : "Upload ID Proof"}
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Upload size={16} className="inline mr-2" />
                    Address Proof Document
                  </label>
                  <div className="flex flex-col space-y-3">
                    {filePreviews.addressProof ? (
                      <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50">
                        <div className="flex items-center space-x-3">
                          {filePreviews.addressProof.type.startsWith(
                            "image/"
                          ) || filePreviews.addressProof.type === "existing" ? (
                            <img
                              src={filePreviews.addressProof.url}
                              alt="Address Proof Preview"
                              className="w-12 h-12 object-cover rounded-md"
                            />
                          ) : (
                            <File size={24} className="text-gray-500" />
                          )}
                          <span className="text-sm text-gray-600 truncate max-w-[150px]">
                            {filePreviews.addressProof.name}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          {filePreviews.addressProof.type !== "existing" && (
                            <a
                              href={filePreviews.addressProof.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg"
                              title="View file"
                            >
                              <Eye size={16} />
                            </a>
                          )}
                          <button
                            onClick={() => handleFileDelete("addressProof")}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                            title="Delete file"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          handleFileUpload("addressProof", e.target.files[0])
                        }
                        className="hidden"
                        id="addressProofUpload"
                      />
                    )}
                    <label
                      htmlFor="addressProofUpload"
                      className="px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer transition-all duration-200 text-center text-sm text-gray-600"
                    >
                      {filePreviews.addressProof
                        ? "Replace Address Proof"
                        : "Upload Address Proof"}
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center text-sm text-gray-500">
                  {isDraftSaved ? (
                    <span className="flex items-center text-green-600">
                      <CheckCircle size={14} className="mr-1" />
                      Changes saved automatically
                    </span>
                  ) : formData.name ||
                    formData.designation ||
                    formData.contactNo ||
                    formData.idNo ||
                    formData.joiningDate ||
                    formData.idProof ||
                    formData.addressProof ? (
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
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl flex items-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin mr-2" />
                        Saving...
                      </>
                    ) : editStaffId ? (
                      <>
                        <Save size={16} className="mr-2" />
                        Update Staff
                      </>
                    ) : (
                      <>
                        <Plus size={16} className="mr-2" />
                        Add Staff
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

export default StaffManagement;
