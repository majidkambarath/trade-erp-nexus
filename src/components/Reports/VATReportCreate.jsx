import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Filter,
  Eye,
  Trash2,
  CheckSquare,
  Send,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Search,
} from "lucide-react";
import axiosInstance from "../../axios/axios";
import Select from "react-select";

const Toast = ({ show, message, type }) =>
  show && (
    <div
      className={`fixed top-4 right-4 p-4 rounded-xl shadow-2xl text-white z-50 animate-slide-in ${
        type === "success"
          ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
 : "bg-gradient-to-r from-red-500 to-red-600"
      }`}
    >
      <div className="flex items-center space-x-3">
        {type === "success" ? (
          <CheckCircle size={20} className="animate-bounce" />
        ) : (
          <XCircle size={20} className="animate-pulse" />
        )}
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );

const formatCurrency = (amount, color = "text-gray-900") => {
  const num = Number(amount) || 0;
  const abs = Math.abs(num).toFixed(2);
  const neg = num < 0;
  return (
    <span className={`inline-flex items-center font-semibold ${color}`}>
      {neg && <span className="text-red-600">-</span>}
      <span className="text-xs mr-1 opacity-70">AED</span>
      {abs.toLocaleString()}
    </span>
  );
};

const badgeStatus = (status) => {
  const map = {
    DRAFT: "bg-yellow-100 text-yellow-800 border-yellow-300",
    FINALIZED: "bg-blue-100 text-blue-800 border-blue-300",
    SUBMITTED: "bg-emerald-100 text-emerald-800 border-emerald-300",
  };
  return `px-3 py-1 rounded-full text-xs font-semibold border ${map[status] || "bg-gray-100 text-gray-800"}`;
};

const VATReportsManagement = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalPages: 1,
    total: 0,
  });
  const [filters, setFilters] = useState({
    status: "",
    generatedBy: "",
    periodStart: "",
    periodEnd: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "generatedAt", direction: "desc" });
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "", type: "success" });

  // Toast
  const showToast = useCallback((msg, type = "success") => {
    setToast({ visible: true, message: msg, type });
    setTimeout(() => setToast((p) => ({ ...p, visible: false })), 3000);
  }, []);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", pagination.page);
      params.append("limit", pagination.limit);
      if (filters.status) params.append("status", filters.status);
      if (filters.generatedBy) params.append("generatedBy", filters.generatedBy);
      if (filters.periodStart) params.append("periodStart", filters.periodStart);
      if (filters.periodEnd) params.append("periodEnd", filters.periodEnd);
      if (searchTerm) params.append("search", searchTerm);
      params.append("sort", `${sortConfig.direction === "desc" ? "-" : ""}${sortConfig.key}`);

      const res = await axiosInstance.get(`/reports/vat?${params.toString()}`);
      setReports(res.data.data);
      setPagination((p) => ({
        ...p,
        total: res.data.pagination.total,
        totalPages: res.data.pagination.pages,
      }));
    } catch (err) {
      showToast("Failed to load VAT reports", "error");
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, searchTerm, sortConfig, showToast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // View single report
  const viewReport = async (id) => {
    try {
      const res = await axiosInstance.get(`/reports/vat/${id}`);
      setSelectedReport(res.data.data);
      setShowModal(true);
    } catch (err) {
      showToast("Failed to load report details", "error");
    }
  };

  // Finalize
  const finalizeReport = async (id) => {
    setIsActionLoading(true);
    try {
      await axiosInstance.post(`/reports/vat/${id}/finalize`);
      showToast("Report finalized successfully!", "success");
      fetchReports();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to finalize", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Submit
  const submitReport = async (id) => {
    setIsActionLoading(true);
    try {
      await axiosInstance.post(`/reports/vat/${id}/submit`);
      showToast("Report submitted successfully!", "success");
      fetchReports();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to submit", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  // Delete
  const deleteReport = async (id) => {
    if (!window.confirm("Delete this DRAFT report?")) return;
    setIsActionLoading(true);
    try {
      await axiosInstance.delete(`/reports/vat/${id}`);
      showToast("Draft deleted", "success");
      fetchReports();
    } catch (err) {
      showToast(err.response?.data?.message || "Failed to delete", "error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const statusOptions = [
    { value: "", label: "All Status" },
    { value: "DRAFT", label: "Draft" },
    { value: "FINALIZED", label: "Finalized" },
    { value: "SUBMITTED", label: "Submitted" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium">Loading VAT reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }
        .animate-slide-in { animation: slide-in .3s ease-out; }
        .animate-shake { animation: shake .3s ease-in-out; }
        .modal-backdrop { backdrop-filter: blur(8px); animation: fadeIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <Toast show={toast.visible} message={toast.message} type={toast.type} />

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            VAT Reports
          </h1>
          <p className="text-gray-600 mt-1">{pagination.total} reports</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchReports}
            disabled={isLoading}
            className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all hover:scale-105"
          >
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-105 ${
              showFilters ? "bg-purple-100 text-purple-600 ring-2 ring-purple-300" : "bg-white text-gray-600"
            }`}
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mb-6 p-4 bg-white rounded-xl shadow-md border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <Select
                options={statusOptions}
                value={statusOptions.find((o) => o.value === filters.status)}
                onChange={(opt) => setFilters((f) => ({ ...f, status: opt.value }))}
                classNamePrefix="react-select"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Generated By</label>
              <input
                type="text"
                value={filters.generatedBy}
                onChange={(e) => setFilters((f) => ({ ...f, generatedBy: e.target.value }))}
                placeholder="Search name..."
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Period From</label>
              <input
                type="date"
                value={filters.periodStart}
                onChange={(e) => setFilters((f) => ({ ...f, periodStart: e.target.value }))}
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Period To</label>
              <input
                type="date"
                value={filters.periodEnd}
                onChange={(e) => setFilters((f) => ({ ...f, periodEnd: e.target.value }))}
                className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6 relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by period or generated by..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                {[
                  { key: "periodStart", label: "Period" },
                  { key: "generatedBy", label: "Generated By" },
                  { key: "status", label: "Status" },
                  { key: "totalVATOutput", label: "Output VAT" },
                  { key: "totalVATInput", label: "Input VAT" },
                  { key: "netVATPayable", label: "Net Payable" },
                  { key: "generatedAt", label: "Generated On" },
                  { key: "actions", label: "Actions" },
                ].map((col) => (
                  <th
                    key={col.key}
                    className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => col.key !== "actions" && handleSort(col.key)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{col.label}</span>
                      {sortConfig.key === col.key && (
                        <span className="text-purple-600 font-bold">
                          {sortConfig.direction === "asc" ? "Up" : "Down"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No VAT reports found
                  </td>
                </tr>
              ) : (
                reports.map((r) => (
                  <tr key={r._id} className="hover:bg-purple-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">
                      {new Date(r.periodStart).toLocaleDateString()} -{" "}
                      {new Date(r.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">{r.generatedBy}</td>
                    <td className="px-6 py-4">
                      <span className={badgeStatus(r.status)}>{r.status}</span>
                    </td>
                    <td className="px-6 py-4">{formatCurrency(r.totalVATOutput, "text-emerald-700")}</td>
                    <td className="px-6 py-4">{formatCurrency(r.totalVATInput, "text-amber-700")}</td>
                    <td className="px-6 py-4">{formatCurrency(r.netVATPayable, "text-purple-700")}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(r.generatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewReport(r._id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        {r.status === "DRAFT" && (
                          <>
                            <button
                              onClick={() => finalizeReport(r._id)}
                              disabled={isActionLoading}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Finalize"
                            >
                              <CheckSquare size={16} />
                            </button>
                            <button
                              onClick={() => deleteReport(r._id)}
                              disabled={isActionLoading}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        {r.status === "FINALIZED" && (
                          <button
                            onClick={() => submitReport(r._id)}
                            disabled={isActionLoading}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Submit"
                          >
                            <Send size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-6 flex items-center justify-between border-t border-gray-200">
          <div className="text-sm text-gray-600">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page === 1}
              className="p-2 rounded-xl bg-white border disabled:opacity-50 hover:bg-gray-100"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page === pagination.totalPages}
              className="p-2 rounded-xl bg-white border disabled:opacity-50 hover:bg-gray-100"
            >
              <ChevronRight size={18} />
            </button>
            <select
              value={pagination.limit}
              onChange={(e) => setPagination((p) => ({ ...p, limit: +e.target.value, page: 1 }))}
              className="px-2 py-1 border rounded-xl focus:ring-2 focus:ring-purple-500"
            >
              {[10, 25, 50].map((l) => (
                <option key={l} value={l}>
                  {l} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Modal: View Report */}
      {showModal && selectedReport && (
        <div className="fixed inset-0 bg-black/30 modal-backdrop flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-2">
                  <FileText size={28} /> VAT Report Details
                </h3>
                <p className="text-purple-100">
                  {new Date(selectedReport.periodStart).toLocaleDateString()} -{" "}
                  {new Date(selectedReport.periodEnd).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <p className="text-sm text-emerald-700 font-medium">Output VAT</p>
                  <p className="text-2xl font-bold text-emerald-900">
                    {formatCurrency(selectedReport.totalVATOutput)}
                  </p>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <p className="text-sm text-amber-700 font-medium">Input VAT</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {formatCurrency(selectedReport.totalVATInput)}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                  <p className="text-sm text-purple-700 font-medium">Net Payable</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {formatCurrency(selectedReport.netVATPayable)}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left">Item</th>
                      <th className="px-4 py-3 text-left">Party</th>
                      <th className="px-4 py-3 text-left">Qty</th>
                      <th className="px-4 py-3 text-left">VAT %</th>
                      <th className="px-4 py-3 text-left">VAT Amount</th>
                      <th className="px-4 py-3 text-left">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedReport.items?.map((it, i) => (
                      <tr key={i} className="hover:bg-purple-50">
                        <td className="px-4 py-3">{it.itemCode || it.description}</td>
                        <td className="px-4 py-3">{it.partyName}</td>
                        <td className="px-4 py-3">{it.qty}</td>
                        <td className="px-4 py-3">{it.vatRate}%</td>
                        <td className="px-4 py-3 font-semibold text-purple-700">
                          {formatCurrency(it.vatAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              it.partyType === "Customer"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {it.partyType === "Customer" ? "Output" : "Input"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VATReportsManagement;