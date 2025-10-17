import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  ArrowLeft,
  Plus,
  Search,
  X,
  User,
  TrendingUp,
  Calendar,
  DollarSign,
  RefreshCw,
  Save,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Receipt,
  Loader2,
  Package,
  Sparkles,
  CreditCard,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Select from "react-select";
import axiosInstance from "../../../axios/axios";
import VendorSelect from "./VendorSelect";
import InvoiceView from "../Layouts/InvoiceView";

const FormInput = ({ label, icon: Icon, error, readOnly, hint, ...props }) => (
  <div className="group relative">
    <label className="block text-sm font-semibold text-gray-700 mb-2 transition-colors group-focus-within:text-purple-600">
      <Icon size={16} className="inline mr-2 text-purple-500" /> {label}{" "}
      {props.required && <span className="text-red-500">*</span>}
    </label>
    <input
      {...props}
      readOnly={readOnly}
      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all duration-200 ${
        error
          ? "border-red-300 bg-red-50 focus:ring-red-500"
          : readOnly
          ? "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-600 cursor-not-allowed"
          : "border-gray-300 hover:border-gray-400"
      }`}
    />
    {hint && !error && (
      <p className="mt-1 text-xs text-gray-500 flex items-center">
        <Sparkles size={10} className="mr-1" /> {hint}
      </p>
    )}
    {error && (
      <p className="mt-1 text-sm text-red-600 flex items-center animate-shake">
        <AlertCircle size={12} className="mr-1" /> {error}
      </p>
    )}
  </div>
);

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

const StatCard = ({
  title,
  count,
  icon,
  bgColor,
  textColor,
  borderColor,
  iconBg,
  iconColor,
  subText,
}) => (
  <div
    className={`${bgColor} ${borderColor} rounded-2xl p-6 border-2 transition-all duration-300 hover:shadow-xl cursor-pointer hover:scale-105 hover:-translate-y-1`}
  >
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 ${iconBg} rounded-xl shadow-md`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <button
        className={`text-xs ${textColor} hover:opacity-80 transition-opacity font-semibold`}
      >
        View Details →
      </button>
    </div>
    <h3
      className={`text-sm font-semibold ${textColor} mb-2 uppercase tracking-wide`}
    >
      {title}
    </h3>
    <p className="text-3xl font-bold text-gray-900 mb-1">{count}</p>
    <p className="text-xs text-gray-600 font-medium">{subText}</p>
  </div>
);

const badgeClassForStatus = (status) => {
  const badges = {
    approved:
      "bg-gradient-to-r from-green-400 to-teal-500 text-white border border-green-300 shadow-md",
    pending:
      "bg-gradient-to-r from-yellow-400 to-orange-500 text-white border border-yellow-300 shadow-md",
    rejected:
      "bg-gradient-to-r from-red-400 to-pink-500 text-white border border-red-300 shadow-md",
    settled:
      "bg-gradient-to-r from-blue-400 to-indigo-500 text-white border border-blue-300 shadow-md",
    Unpaid:
      "bg-gradient-to-r from-red-400 to-red-600 text-white border border-red-300 shadow-md",
    Paid: "bg-gradient-to-r from-emerald-400 to-emerald-600 text-white border border-emerald-300 shadow-md",
    "Partially Paid":
      "bg-gradient-to-r from-yellow-400 to-amber-500 text-white border border-yellow-300 shadow-md",
  };
  return (
    badges[status] ||
    "bg-gradient-to-r from-gray-400 to-gray-600 text-white border border-gray-300 shadow-md"
  );
};

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
}) => {
  const pageNumbers = useMemo(() => {
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  const itemsPerPageOptions = [
    { value: 10, label: "10 per page" },
    { value: 25, label: "25 per page" },
    { value: 50, label: "50 per page" },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-gray-50 border-t border-gray-200">
      <div className="flex items-center space-x-2 mb-4 sm:mb-0">
        <span className="text-sm text-gray-600">Items per page:</span>
        <Select
          value={itemsPerPageOptions.find(
            (option) => option.value === itemsPerPage
          )}
          onChange={(option) => onItemsPerPageChange(option.value)}
          options={itemsPerPageOptions}
          className="w-32"
          classNamePrefix="react-select"
        />
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          <ChevronLeft size={16} />
        </button>
        {pageNumbers.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium transition-all duration-200 ${
              currentPage === page
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

const asArray = (x) => (Array.isArray(x) ? x : []);

const takeArray = (resp) => {
  if (!resp) return [];
  const d = resp.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data.data ?? d.data;
  if (Array.isArray(d?.vouchers)) return d.vouchers;
  if (Array.isArray(d?.data?.data)) return d.data.data;
  return [];
};

const formatCurrency = (amount, colorClass = "text-gray-900") => {
  const numAmount = Number(amount) || 0;
  const absAmount = Math.abs(numAmount).toFixed(2);
  const isNegative = numAmount < 0;
  return (
    <span className={`inline-flex items-center font-semibold ${colorClass}`}>
      {isNegative && <span className="text-red-600">-</span>}
      <span className="text-xs mr-1 opacity-70">AED</span>
      {absAmount.toLocaleString()}
    </span>
  );
};

const PurchaseAccountsManagement = () => {
  const [vendors, setVendors] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({ startDate: "", endDate: "" });
  const [showModal, setShowModal] = useState(false);
  const [activeView, setActiveView] = useState("list");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [formData, setFormData] = useState({
    vendorId: "",
    invoiceNumber: "",
    date: new Date().toISOString().split("T")[0],
    purchaseAmount: "",
    taxAmount: "",
    total: "",
    returnAmount: "",
    paidAmount: "",
    balanceAmount: "",
    status: "Unpaid",
  });
  const [availableVouchers, setAvailableVouchers] = useState([]);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [activeTab, setActiveTab] = useState("invoices");
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  console.log(selectedInvoices);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const modalRef = useRef(null);

  const showToastMessage = useCallback((message, type = "success") => {
    setShowToast({ visible: true, message, type });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  }, []);

  const fetchData = useCallback(
    async (
      endpoint,
      setter,
      errorMessage,
      isPaginated = false,
      params = {}
    ) => {
      try {
        const response = await axiosInstance.get(endpoint, { params });
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.data?.data ||
            response.data?.data ||
            response.data?.vouchers ||
            [];
        setter(data);
        if (isPaginated) {
          const total = response.data?.pagination?.totalItems || data.length;
          setTotalItems(total);
        }
      } catch (err) {
        showToastMessage(errorMessage, "error");
        setter([]);
        if (isPaginated) setTotalItems(0);
      }
    },
    [showToastMessage]
  );

  const fetchVendors = useCallback(() => {
    fetchData("/vendors/vendors", setVendors, "Failed to fetch vendors.");
  }, [fetchData]);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      voucherType: "purchase",
      page: currentPage,
      limit: itemsPerPage,
    });
    if (selectedVendor) params.append("partyId", selectedVendor.value);
    if (dateFilter.startDate) params.append("startDate", dateFilter.startDate);
    if (dateFilter.endDate) params.append("endDate", dateFilter.endDate);
    if (searchTerm) params.append("search", searchTerm);
    await fetchData(
      `/vouchers/vouchers`,
      setInvoices,
      "Failed to fetch invoices.",
      true,
      params
    );
    setIsLoading(false);
  }, [
    selectedVendor,
    dateFilter,
    searchTerm,
    currentPage,
    itemsPerPage,
    fetchData,
  ]);

  const fetchVouchers = useCallback(async () => {
    const params = new URLSearchParams({
      voucherType: "payment",
      page: currentPage,
      limit: itemsPerPage,
    });
    if (selectedVendor) params.append("partyId", selectedVendor.value);
    if (dateFilter.startDate) params.append("startDate", dateFilter.startDate);
    if (dateFilter.endDate) params.append("endDate", dateFilter.endDate);
    if (searchTerm) params.append("search", searchTerm);
    await fetchData(
      `/vouchers/vouchers`,
      setVouchers,
      "Failed to fetch payment vouchers.",
      true,
      params
    );
  }, [
    selectedVendor,
    dateFilter,
    searchTerm,
    currentPage,
    itemsPerPage,
    fetchData,
  ]);

  const fetchAvailableVouchers = useCallback(
    async (vendorId = null) => {
      const params = new URLSearchParams({ voucherType: "payment" });
      if (vendorId) params.append("partyId", vendorId);
      await fetchData(
        `/vouchers/vouchers`,
        (data) => {
          setAvailableVouchers(
            data.filter((v) => v._id && v.voucherNo && v.totalAmount)
          );
        },
        "Failed to fetch available vouchers."
      );
    },
    [fetchData]
  );

  useEffect(() => {
    Promise.all([fetchVendors(), fetchInvoices(), fetchVouchers()]).then(() =>
      setIsLoading(false)
    );
  }, [fetchVendors, fetchInvoices, fetchVouchers]);

  useEffect(() => {
    fetchInvoices();
    fetchVouchers();
  }, [currentPage, itemsPerPage, fetchInvoices, fetchVouchers]);

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
      modalRef.current?.classList.add("scale-100", "opacity-100");
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showModal]);

  const handleVendorChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({
        ...prev,
        [name]: value,
        invoiceNumber: "",
        date: new Date().toISOString().split("T")[0],
        purchaseAmount: "",
        taxAmount: "",
        total: "",
        returnAmount: "",
        paidAmount: "",
        balanceAmount: "",
        status: "Unpaid",
      }));
      setErrors({});
      setSelectedInvoices([]);
      if (name === "vendorId") fetchAvailableVouchers(value);
    },
    [fetchAvailableVouchers]
  );

  const handleInvoiceSelect = useCallback((selectedInvoicesData) => {
    setSelectedInvoices(selectedInvoicesData);
    const totals = selectedInvoicesData.reduce(
      (acc, inv) => {
        const total = Number(inv.totalAmount) || 0;
        const tax = Number(inv.taxAmount) || 0;
        const paid = Number(inv.amount) || 0; // Use the paid amount from the invoice
        return {
          purchaseAmount: acc.purchaseAmount + (total - tax),
          taxAmount: acc.taxAmount + tax,
          total: acc.total + total,
          paidAmount: acc.paidAmount + paid,
        };
      },
      { purchaseAmount: 0, taxAmount: 0, total: 0, paidAmount: 0 }
    );
    const balanceAmount = totals.total - totals.paidAmount; // Initial balance
    const status = selectedInvoicesData.every(
      (inv) => (Number(inv.amount) || 0) >= Number(inv.totalAmount)
    )
      ? "Paid"
      : selectedInvoicesData.every((inv) => (Number(inv.amount) || 0) === 0)
      ? "Unpaid"
      : "Partially Paid";
    setFormData((prev) => ({
      ...prev,
      invoiceNumber: selectedInvoicesData
        .map((inv) => inv.voucherNo || inv.transactionNo)
        .join(", "),
      date:
        selectedInvoicesData[0]?.date?.split("T")[0] ||
        new Date().toISOString().split("T")[0],
      purchaseAmount: totals.purchaseAmount.toFixed(2),
      taxAmount: totals.taxAmount.toFixed(2),
      total: totals.total.toFixed(2),
      paidAmount: totals.paidAmount.toFixed(2),
      balanceAmount: balanceAmount.toFixed(2),
      status,
    }));
  }, []);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === "date" && new Date(value) > new Date()) {
      setErrors((prev) => ({ ...prev, date: "Future dates are not allowed" }));
      return;
    }
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      if (name === "returnAmount") {
        const total =
          Number(prev.purchaseAmount) + Number(prev.taxAmount) - Number(value);
        const balanceAmount = total - Number(prev.paidAmount);
        const status =
          balanceAmount <= 0
            ? "Paid"
            : balanceAmount === total
            ? "Unpaid"
            : "Partially Paid";
        return {
          ...newData,
          total: total.toFixed(2),
          balanceAmount: balanceAmount.toFixed(2),
          status,
        };
      }
      return newData;
    });
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const validateForm = useCallback(() => {
    const errors = {};
    if (!formData.vendorId) errors.vendorId = "Please select a vendor";
    if (!formData.invoiceNumber)
      errors.invoiceNumber = "Please select at least one invoice";
    if (!formData.date) errors.date = "Please select a date";
    if (new Date(formData.date) > new Date())
      errors.date = "Future dates are not allowed";
    return errors;
  }, [formData]);

  const resetForm = useCallback(() => {
    setFormData({
      vendorId: "",
      invoiceNumber: "",
      date: new Date().toISOString().split("T")[0],
      purchaseAmount: "",
      taxAmount: "",
      total: "",
      returnAmount: "",
      paidAmount: "",
      balanceAmount: "",
      status: "Unpaid",
    });
    setErrors({});
    setShowModal(false);
    setAvailableVouchers([]);
    setSelectedInvoices([]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const errors = validateForm();
    if (Object.keys(errors).length) {
      setErrors(errors);
      showToastMessage("Please fill all required fields", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      const selectedInvoiceIds = selectedInvoices.map((invoice) => invoice._id);
      const voucherIds = vouchers
        .filter((voucher) =>
          voucher.linkedInvoices?.some((link) =>
            selectedInvoiceIds.includes(link.invoiceId?._id || link.invoiceId)
          )
        )
        .map((voucher) => voucher._id);

      const invoiceBalances = selectedInvoices.map((inv) => {
        const total = Number(inv.totalAmount) || 0;
        const linkedPayments = vouchers.reduce((acc, voucher) => {
          const link = voucher.linkedInvoices?.find(
            (l) => (l.invoiceId?._id || l.invoiceId) === inv._id
          );
          return acc + (Number(link?.amount) || 0);
        }, 0);
        const returnAmount = Number(formData.returnAmount) || 0;
        const balance = total - linkedPayments - returnAmount;
        return {
          invoiceId: inv._id,
          transactionNo: inv.voucherNo || inv.transactionNo,
          balanceAmount: balance.toFixed(2),
        };
      });

      const payload = {
        partyId: formData.vendorId,
        partyType: "Vendor",
        voucherType: "purchase",
        invoiceIds: selectedInvoiceIds,
        voucherIds,
        transactionNo: formData.invoiceNumber,
        date: formData.date,
        totalAmount: Number(formData.total),
        returnAmount: Number(formData.returnAmount) || 0,
        paidAmount: Number(formData.paidAmount) || 0,
        balanceAmount: Number(formData.balanceAmount) || 0,
        status: formData.status,
        invoiceBalances,
      };
      await axiosInstance.post("/account/account-vouchers", payload);
      showToastMessage("Purchase invoice created successfully!", "success");
      fetchInvoices();
      resetForm();
    } catch (err) {
      showToastMessage(
        err.response?.data?.message || "Failed to create purchase invoice.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    formData,
    selectedInvoices,
    vouchers,
    fetchInvoices,
    resetForm,
    showToastMessage,
    validateForm,
  ]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setCurrentPage(1);
    Promise.all([fetchInvoices(), fetchVouchers()]).finally(() => {
      setIsRefreshing(false);
      showToastMessage("Data refreshed successfully", "success");
    });
  }, [fetchInvoices, fetchVouchers, showToastMessage]);

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const handleViewInvoice = useCallback((invoice) => {
    setSelectedInvoice(invoice);
    setActiveView("view");
  }, []);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handleItemsPerPageChange = useCallback((newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  }, []);

  const filteredInvoices = useMemo(() => {
    const filtered = asArray(invoices)
      .filter((inv) => {
        if (selectedVendor && inv.partyId !== selectedVendor.value)
          return false;
        const term = searchTerm.toLowerCase();
        return (inv.voucherNo || inv.transactionNo)
          ?.toLowerCase()
          .includes(term);
      })
      .map((inv) => {
        const vendor = vendors.find((v) => v._id === inv.partyId);
        const total = Number(inv.totalAmount) || 0;
        const taxAmount = Number(inv.taxAmount) || 0;
        const purchaseAmount = total - taxAmount;
        const paidAmount = Number(inv.paidAmount) || 0;
        const balanceAmount = total - paidAmount;
        return {
          ...inv,
          vendorName: vendor?.vendorName || "Unknown",
          transactionNo: inv.voucherNo || inv.transactionNo || "",
          purchaseAmount,
          taxAmount,
          total,
          paidAmount,
          balanceAmount,
          status:
            inv.status ||
            (balanceAmount <= 0
              ? "Paid"
              : paidAmount === 0
              ? "Unpaid"
              : "Partially Paid"),
        };
      });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let av = a[sortConfig.key];
        let bv = b[sortConfig.key];
        if (sortConfig.key === "date") {
          av = new Date(av).getTime();
          bv = new Date(bv).getTime();
        } else if (sortConfig.key === "vendorName") {
          av = av.toLowerCase();
          bv = bv.toLowerCase();
        } else if (typeof av === "number") {
          av = Number(av);
          bv = Number(bv);
        }
        return av < bv
          ? sortConfig.direction === "asc"
            ? -1
            : 1
          : av > bv
          ? sortConfig.direction === "asc"
            ? 1
            : -1
          : 0;
      });
    }

    return filtered;
  }, [invoices, selectedVendor, searchTerm, sortConfig, vendors]);

  const filteredVouchers = useMemo(() => {
    const filtered = asArray(vouchers)
      .filter((voucher) => {
        if (selectedVendor && voucher.partyId?._id !== selectedVendor.value)
          return false;
        const term = searchTerm.toLowerCase();
        return voucher.voucherNo?.toLowerCase().includes(term);
      })
      .map((voucher) => {
        const linkedInvoices = asArray(voucher.linkedInvoices).map((link) => {
          const invoice = invoices.find(
            (inv) => inv._id === (link.invoiceId?._id || link.invoiceId)
          );
          const total = Number(invoice?.totalAmount) || 0;
          const taxAmount = Number(invoice?.taxAmount) || 0;
          const purchaseAmount = total - taxAmount;
          return {
            ...link,
            invoiceNo:
              invoice?.voucherNo || invoice?.transactionNo || "Unknown",
            purchaseAmount,
            taxAmount,
            total,
            paidAmount: Number(link.amount) || 0,
            balanceAmount: Number(link.balance) || 0,
            status:
              Number(link.balance) <= 0
                ? "Paid"
                : Number(link.amount) === 0
                ? "Unpaid"
                : "Partially Paid",
          };
        });
        return {
          ...voucher,
          vendorName: voucher.partyName || "Unknown",
          linkedInvoices,
        };
      });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let av = a[sortConfig.key];
        let bv = b[sortConfig.key];
        if (sortConfig.key === "date") {
          av = new Date(av).getTime();
          bv = new Date(bv).getTime();
        } else if (sortConfig.key === "vendorName") {
          av = av.toLowerCase();
          bv = bv.toLowerCase();
        }
        return av < bv
          ? sortConfig.direction === "asc"
            ? -1
            : 1
          : av > bv
          ? sortConfig.direction === "asc"
            ? 1
            : -1
          : 0;
      });
    }

    return filtered;
  }, [vouchers, invoices, selectedVendor, searchTerm, sortConfig]);

  const paginatedData = useMemo(() => {
    const data = activeTab === "invoices" ? filteredInvoices : filteredVouchers;
    return data;
  }, [activeTab, filteredInvoices, filteredVouchers]);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const stats = useMemo(
    () => ({
      totalInvoices: filteredInvoices.length,
      totalVouchers: filteredVouchers.length,
      totalAmount: filteredInvoices.reduce((sum, inv) => sum + inv.total, 0),
      paidAmount: filteredInvoices.reduce(
        (sum, inv) => sum + inv.paidAmount,
        0
      ),
      balanceAmount: filteredInvoices.reduce(
        (sum, inv) => sum + inv.balanceAmount,
        0
      ),
    }),
    [filteredInvoices, filteredVouchers]
  );

  const vendorOptions = useMemo(
    () => [
      { value: "", label: "All Vendors" },
      ...vendors.map((v) => ({ value: v._id, label: v.vendorName })),
    ],
    [vendors]
  );

  const EmptyState = ({ type }) => (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <Receipt size={40} className="text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No {type} found
      </h3>
      <p className="text-gray-600 text-center mb-8 max-w-md">
        {searchTerm
          ? `No ${type} match your search.`
          : `No ${type} available for the selected vendor.`}
      </p>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2
            size={48}
            className="text-purple-600 animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 text-lg font-medium">
            Loading purchase accounts...
          </p>
        </div>
      </div>
    );
  }

  if (activeView === "view") {
    return (
      <InvoiceView
        selectedInvoice={selectedInvoice}
        parties={vendors}
        setActiveView={setActiveView}
        setSelectedInvoice={setSelectedInvoice}
        voucherType="purchase"
        title="Purchase Invoice"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      <style>{`
        @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .animate-shake { animation: shake 0.3s ease-in-out; }
        .modal-backdrop { backdrop-filter: blur(8px); animation: fadeIn 0.2s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <Toast
        show={showToast.visible}
        message={showToast.message}
        type={showToast.type}
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Purchase Accounts
            </h1>
            <p className="text-gray-600 mt-1 font-medium">
              {activeTab === "invoices"
                ? `${stats.totalInvoices} total invoices`
                : `${stats.totalVouchers} total vouchers`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          {activeTab === "invoices" && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 font-semibold"
            >
              <Plus size={18} /> Add Purchase
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-3 rounded-xl bg-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 hover:scale-105"
            title="Refresh data"
          >
            <RefreshCw
              size={18}
              className={`text-gray-600 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 ${
              showFilters
                ? "bg-purple-100 text-purple-600 ring-2 ring-purple-300"
                : "bg-white text-gray-600"
            }`}
            title="Toggle filters"
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      <div className="mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Records"
            count={
              activeTab === "invoices"
                ? stats.totalInvoices
                : stats.totalVouchers
            }
            icon={<Receipt size={24} />}
            bgColor="bg-emerald-50"
            textColor="text-emerald-700"
            borderColor="border-emerald-200"
            iconBg="bg-emerald-100"
            iconColor="text-emerald-600"
            subText={activeTab === "invoices" ? "All invoices" : "All vouchers"}
          />
          <StatCard
            title="Total Amount"
            count={formatCurrency(stats.totalAmount, "text-purple-700")}
            icon={<TrendingUp size={24} />}
            bgColor="bg-purple-50"
            textColor="text-purple-700"
            borderColor="border-purple-200"
            iconBg="bg-purple-100"
            iconColor="text-purple-600"
            subText="Total purchase value"
          />
          <StatCard
            title="Paid Amount"
            count={formatCurrency(stats.paidAmount, "text-blue-700")}
            icon={<DollarSign size={24} />}
            bgColor="bg-blue-50"
            textColor="text-blue-700"
            borderColor="border-blue-200"
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            subText="Total paid"
          />
          <StatCard
            title="Balance Amount"
            count={formatCurrency(stats.balanceAmount, "text-red-700")}
            icon={<DollarSign size={24} />}
            bgColor="bg-red-50"
            textColor="text-red-700"
            borderColor="border-red-200"
            iconBg="bg-red-100"
            iconColor="text-red-600"
            subText="Outstanding balance"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {activeTab === "invoices"
                  ? "Purchase Invoices"
                  : "Payment Vouchers"}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                {activeTab === "invoices"
                  ? "View purchase invoices and payment status"
                  : "View payment vouchers linked to invoices"}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setActiveTab("invoices");
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "invoices"
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Invoices
              </button>
              <button
                onClick={() => {
                  setActiveTab("vouchers");
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === "vouchers"
                    ? "bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Vouchers
              </button>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder={`Search by ${
                  activeTab === "invoices" ? "invoice" : "voucher"
                } number...`}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-300 transition-all duration-200 hover:border-gray-300"
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {showFilters && (
              <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                <div className="w-full sm:w-1/3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <User size={16} className="inline mr-2" /> Vendor Name
                  </label>
                  <Select
                    value={selectedVendor}
                    onChange={(value) => {
                      setSelectedVendor(value);
                      setCurrentPage(1);
                    }}
                    options={vendorOptions}
                    isSearchable={true}
                    placeholder="Search and select vendor..."
                    classNamePrefix="react-select"
                  />
                </div>
                <div className="w-full sm:w-1/3">
                  <FormInput
                    label="Start Date"
                    icon={Calendar}
                    type="date"
                    name="startDate"
                    value={dateFilter.startDate}
                    onChange={(e) => {
                      setDateFilter((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }));
                      setCurrentPage(1);
                    }}
                    hint="Filter by start date"
                  />
                </div>
                <div className="w-full sm:w-1/3">
                  <FormInput
                    label="End Date"
                    icon={Calendar}
                    type="date"
                    name="endDate"
                    value={dateFilter.endDate}
                    onChange={(e) => {
                      setDateFilter((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }));
                      setCurrentPage(1);
                    }}
                    hint="Filter by end date"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      fetchInvoices();
                      fetchVouchers();
                      setCurrentPage(1);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-semibold"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {activeTab === "invoices" && paginatedData.length === 0 ? (
          <EmptyState type="invoices" />
        ) : activeTab === "vouchers" && paginatedData.length === 0 ? (
          <EmptyState type="vouchers" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  {[
                    { key: "vendorName", label: "Vendor Name" },
                    {
                      key:
                        activeTab === "invoices"
                          ? "transactionNo"
                          : "voucherNo",
                      label:
                        activeTab === "invoices"
                          ? "Invoice Number"
                          : "Voucher Number",
                    },
                    { key: "date", label: "Date" },
                    { key: "purchaseAmount", label: "Purchase Amount" },
                    { key: "taxAmount", label: "Tax Amount" },
                    { key: "total", label: "Total" },
                    { key: "paidAmount", label: "Paid Amount" },
                    { key: "balanceAmount", label: "Balance Amount" },
                    { key: "status", label: "Status" },
                    { key: "actions", label: "Actions" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={
                        col.key !== "actions" ? () => handleSort(col.key) : null
                      }
                    >
                      <div className="flex items-center space-x-1">
                        <span>{col.label}</span>
                        {sortConfig.key === col.key &&
                          col.key !== "actions" && (
                            <span className="text-purple-600 font-bold">
                              {sortConfig.direction === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeTab === "invoices"
                  ? paginatedData.map((inv) => (
                      <tr
                        key={inv._id}
                        className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {inv.partyName}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {inv.transactionNo}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(inv.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.purchaseAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.taxAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.total)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.paidAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(inv.balanceAmount)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClassForStatus(
                              inv.status || inv.status
                            )}`}
                          >
                            {inv.status || inv.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleViewInvoice(inv)}
                            className="text-purple-600 hover:text-purple-800 font-semibold"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  : paginatedData.flatMap((voucher) =>
                      voucher.linkedInvoices.map((link) => (
                        <tr
                          key={`${voucher._id}-${
                            link.invoiceId?._id || link.invoiceId
                          }`}
                          className="hover:bg-gradient-to-r hover:from-purple-50 hover:to-blue-50 transition-all duration-200"
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {voucher.vendorName}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            {voucher.voucherNo}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(voucher.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.purchaseAmount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.taxAmount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.total)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.paidAmount)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {formatCurrency(link.balanceAmount)}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClassForStatus(
                                link.status
                              )}`}
                            >
                              {link.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">----</td>
                        </tr>
                      ))
                    )}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={handleItemsPerPageChange}
        />
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 modal-backdrop flex items-center justify-center p-4 z-50">
          <div
            ref={modalRef}
            className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden transform scale-95 opacity-0 transition-all duration-300"
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Package size={28} />
                  Add Purchase Invoice
                </h3>
                <p className="text-purple-100 text-sm mt-1">
                  Create a new purchase invoice with automatic calculations
                </p>
              </div>
              <button
                onClick={resetForm}
                className="p-2 text-white hover:bg-white/20 rounded-xl transition-all duration-200 hover:rotate-90"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-l-4 border-purple-500">
                <div className="flex items-start gap-3">
                  <Sparkles size={20} className="text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Smart Auto-Fill
                    </h4>
                    <p className="text-sm text-gray-600">
                      Select a vendor and invoices to automatically calculate
                      amounts, taxes, and payment status
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <VendorSelect
                    vendors={vendors}
                    value={formData.vendorId}
                    onChange={handleVendorChange}
                    onInvoiceSelect={handleInvoiceSelect}
                  />
                </div>
                <FormInput
                  label="Invoice Number"
                  icon={Receipt}
                  type="text"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleChange}
                  readOnly
                  required
                  error={errors.invoiceNumber}
                  hint="Auto-filled from selected invoices"
                />
                <FormInput
                  label="Date"
                  icon={Calendar}
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  error={errors.date}
                  hint="Select invoice date (cannot be future date)"
                  max={new Date().toISOString().split("T")[0]}
                />
                <FormInput
                  label="Purchase Amount"
                  icon={DollarSign}
                  type="number"
                  name="purchaseAmount"
                  value={formData.purchaseAmount}
                  readOnly
                  hint="Calculated excluding tax"
                />
                <FormInput
                  label="Tax Amount"
                  icon={DollarSign}
                  type="number"
                  name="taxAmount"
                  value={formData.taxAmount}
                  readOnly
                  hint="VAT/Tax calculation"
                />
                <FormInput
                  label="Total Amount"
                  icon={DollarSign}
                  type="number"
                  name="total"
                  value={formData.total}
                  readOnly
                  hint="Purchase + Tax - Return"
                />
                <FormInput
                  label="Return Amount"
                  icon={DollarSign}
                  type="number"
                  name="returnAmount"
                  value={formData.returnAmount}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  hint="Enter any return amount"
                />
                <FormInput
                  label="Paid Amount"
                  icon={CreditCard}
                  type="number"
                  name="paidAmount"
                  value={formData.paidAmount}
                  readOnly
                  hint="Calculated from vouchers"
                />
                <FormInput
                  label="Balance Amount"
                  icon={DollarSign}
                  type="number"
                  name="balanceAmount"
                  value={formData.balanceAmount}
                  readOnly
                  hint="Remaining to be paid"
                />
                <div className="md:col-span-2">
                  <FormInput
                    label="Payment Status"
                    icon={AlertCircle}
                    name="status"
                    value={formData.status}
                    readOnly
                    hint="Auto-updated based on balance"
                  />
                </div>
              </div>
              <div className="mt-8 p-4 bg-gray-50 rounded-xl">
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <FileText size={18} className="text-purple-600" />
                  Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Purchase</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(formData.purchaseAmount || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Tax</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(formData.taxAmount || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total</p>
                    <p className="font-semibold text-purple-600">
                      {formatCurrency(formData.total || 0, "text-purple-600")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Balance</p>
                    <p className="font-semibold text-red-600">
                      {formatCurrency(
                        formData.balanceAmount || 0,
                        "text-red-600"
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={resetForm}
                disabled={isSubmitting}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-all duration-200 font-semibold disabled:opacity-50 hover:scale-105"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-200 font-semibold disabled:opacity-50 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 min-w-[160px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />{" "}
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" /> Save Invoice
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseAccountsManagement;
