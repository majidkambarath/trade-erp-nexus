// src/pages/debit-accounts/DebitAccountsManagement.jsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../../axios/axios";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Eye,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Select from "react-select";
import { formatNumber } from "../../../utils/format";
import { toastClasses } from "../../../lib/status";
import StatCard from "../../ui/stat-card";

// Reusable Components (same as before)
const Toast = ({ show, message, type }) =>
  show && (
    <div
      className={`fixed end-4 top-16 z-50 ${toastClasses(type)}`}
    >
      <div className="flex items-center space-x-3">
        {type === "success" ? "Success" : "Error"} {message}
      </div>
    </div>
  );

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
}) => {
  const pageNumbers = useMemo(() => {
    const pages = [];
    const max = 5;
    let start = Math.max(1, currentPage - Math.floor(max / 2));
    let end = Math.min(totalPages, start + max - 1);
    if (end - start + 1 < max) start = Math.max(1, end - max + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const options = [
    { value: 10, label: "10 per page" },
    { value: 25, label: "25 per page" },
    { value: 50, label: "50 per page" },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center space-x-2 mb-4 sm:mb-0">
        <span className="text-sm text-gray-600">Items per page:</span>
        <Select
          value={options.find((o) => o.value === itemsPerPage)}
          onChange={(opt) => onItemsPerPageChange(opt.value)}
          options={options}
          className="w-32"
          classNamePrefix="react-select"
        />
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        {pageNumbers.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
              currentPage === p
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
const DebitAccountsManagement = () => {
  const navigate = useNavigate();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Fetch vendors from backend
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        setLoading(true);
        const res = await axios.get("/ledger/debit-accounts");
        setVendors(res.data.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load vendors");
      } finally {
        setLoading(false);
      }
    };
    fetchVendors();
  }, []);

  const filteredVendors = useMemo(() => {
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.partyId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [vendors, searchTerm]);

  const paginated = filteredVendors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);

  const stats = useMemo(() => {
    return {
      totalVendors: vendors.length,
      totalPayable: vendors.reduce((s, v) => s + v.totalPayable, 0),
      totalPaid: vendors.reduce((s, v) => s + v.totalPaid, 0),
      totalBalance: vendors.reduce((s, v) => s + v.balance, 0),
    };
  }, [vendors]);

  if (loading)
    return <div className="text-center py-20 text-2xl">Loading vendors...</div>;
  if (error)
    return (
      <div className="text-center py-20 text-red-600 text-xl">{error}</div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      <Toast show={!!error} message={error} type="error" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
              Debit Accounts
            </h1>
            <p className="text-gray-600 mt-1 font-medium">
              {vendors.length} total vendors
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Vendors"
          count={stats.totalV}
          icon={<Users size={24} />}
          bgColor="bg-emerald-50"
          textColor="text-emerald-700"
          borderColor="border-emerald-200"
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          subText="Active suppliers"
        />
        <StatCard
          title="Total Payable"
          count={`AED ${formatNumber(stats.totalPayable)}`}
          icon={<TrendingUp size={24} />}
          bgColor="bg-purple-50"
          textColor="text-purple-700"
          borderColor="border-purple-200"
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          subText="All invoices"
        />
        <StatCard
          title="Total Paid"
          count={`AED ${formatNumber(stats.totalPaid)}`}
          icon={<DollarSign size={24} />}
          bgColor="bg-blue-50"
          textColor="text-blue-700"
          borderColor="border-blue-200"
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          subText="Cleared amount"
        />
        <StatCard
          title="Outstanding"
          count={`AED ${formatNumber(stats.totalBalance)}`}
          icon={<AlertCircle size={24} />}
          bgColor="bg-red-50"
          textColor="text-red-700"
          borderColor="border-red-200"
          iconBg="bg-red-100"
          iconColor="text-red-600"
          subText="Due balance"
        />
      </div>

      {/* Search */}
      <div className="max-w-md mb-6">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search by vendor name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">
            Vendor Debit Summary
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Click any vendor to view transaction history
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                {[
                  "Vendor ID",
                  "Vendor Name",
                  "No of Invoices",
                  "Total Payable",
                  "Total Paid",
                  "Balance",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginated.map((v) => (
                <tr
                  key={v._id}
                  onClick={() => navigate(`/debit-accounts/vendor/${v._id}`)}
                  className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 cursor-pointer transition-all"
                >
                  <td className="px-6 py-4 font-mono text-sm text-purple-700 font-bold">
                    {v.partyId}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {v.name}
                  </td>
                  <td className="px-6 py-4 text-center">{v.totalInvoices}</td>
                  <td className="px-6 py-4">
                    AED {formatNumber(v.totalPayable)}
                  </td>
                  <td className="px-6 py-4 text-emerald-600">
                    AED {formatNumber(v.totalPaid)}
                  </td>
                  <td className="px-6 py-4 text-red-600 font-bold">
                    AED {v.balance.toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/debit-accounts/vendor/${v._id}`);
                      }}
                      className="text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1"
                    >
                      <Eye size={16} /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      </div>
    </div>
  );
};

export default DebitAccountsManagement;
