import React, { useState, useEffect } from "react";
import {
  ShoppingCart,
  Building,
  User,
  Calendar,
  Hash,
  Package,
  DollarSign,
  Plus,
  Trash2,
  Eye,
  Edit3,
  CheckCircle,
  ArrowLeft,
  Truck,
  AlertCircle,
  Search,
  Filter,
  FileText,
  X,
  Save,
  Send,
  Clock,
  CheckSquare,
  XCircle,
  Receipt,
  Download,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Grid,
  List,
  Settings,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Users,
  Archive
} from "lucide-react";

const PurchaseOrderManagement = () => {
  const [activeView, setActiveView] = useState("dashboard"); // dashboard, list, create, edit, invoice
  const [viewMode, setViewMode] = useState("table"); // table, grid
  const [selectedPO, setSelectedPO] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [vendorFilter, setVendorFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [notifications, setNotifications] = useState([]);
  const [selectedPOs, setSelectedPOs] = useState([]);

  // Sample vendors data
  const vendors = [
    {
      id: "V001",
      name: "AL MAYA TRADING",
      address: "Dubai Industrial City, Dubai, UAE",
      phone: "+971 4 567 8901",
      email: "orders@almaya.com",
      paymentTerms: "30 days",
      vatNumber: "100123456789",
    },
    {
      id: "V002",
      name: "EMIRATES FOOD SUPPLIERS",
      address: "Al Quoz, Dubai, UAE",
      phone: "+971 4 456 7890",
      email: "procurement@efs.ae",
      paymentTerms: "45 days",
      vatNumber: "100987654321",
    },
    {
      id: "V003",
      name: "GULF MEAT COMPANY",
      address: "Sharjah Industrial Area, Sharjah, UAE",
      phone: "+971 6 789 0123",
      email: "sales@gulfmeat.com",
      paymentTerms: "60 days",
      vatNumber: "100555666777",
    },
    {
      id: "V004",
      name: "FRESH PRODUCE LLC",
      address: "Dubai Investment Park, Dubai, UAE",
      phone: "+971 4 345 6789",
      email: "orders@freshproduce.ae",
      paymentTerms: "15 days",
      vatNumber: "100444555666",
    },
    {
      id: "V005",
      name: "SPICE WORLD TRADING",
      address: "Deira, Dubai, UAE",
      phone: "+971 4 234 5678",
      email: "sales@spiceworld.com",
      paymentTerms: "30 days",
      vatNumber: "100333444555",
    }
  ];

  // Sample stock items
  const stockItems = [
    {
      id: "2174",
      description: "FROZEN CHICKEN THIGH B/L S/L 6x2Kgs",
      unit: "pcs",
      lastPurchaseRate: "15.50",
      category: "Frozen Foods",
      minStock: 20,
      currentStock: 150,
    },
    {
      id: "2175",
      description: "FRESH VEGETABLES MIXED PACK",
      unit: "kg",
      lastPurchaseRate: "12.00",
      category: "Fresh Produce",
      minStock: 10,
      currentStock: 89,
    },
    {
      id: "2176",
      description: "PREMIUM RICE BASMATI 5KG",
      unit: "bags",
      lastPurchaseRate: "25.00",
      category: "Dry Goods",
      minStock: 15,
      currentStock: 45,
    },
    {
      id: "2177",
      description: "OLIVE OIL EXTRA VIRGIN 1L",
      unit: "bottles",
      lastPurchaseRate: "32.50",
      category: "Oils & Vinegars",
      minStock: 25,
      currentStock: 75,
    },
  ];

  // Generate sample data for 120+ POs
  const generateSamplePOs = () => {
    const statuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"];
    const samplePOs = [];
    
    for (let i = 1; i <= 125; i++) {
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 90));
      const deliveryDate = new Date(date);
      deliveryDate.setDate(deliveryDate.getDate() + Math.floor(Math.random() * 14) + 1);
      
      const vendor = vendors[Math.floor(Math.random() * vendors.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const itemCount = Math.floor(Math.random() * 5) + 1;
      const items = [];
      let totalAmount = 0;
      
      for (let j = 0; j < itemCount; j++) {
        const item = stockItems[Math.floor(Math.random() * stockItems.length)];
        const qty = Math.floor(Math.random() * 100) + 1;
        const rate = parseFloat(item.lastPurchaseRate) + (Math.random() * 10 - 5);
        const taxPercent = Math.random() > 0.5 ? 5 : 0;
        const lineTotal = qty * rate * (1 + taxPercent / 100);
        
        items.push({
          itemId: item.id,
          description: item.description,
          qty,
          rate: rate.toFixed(2),
          taxPercent,
          lineTotal
        });
        
        totalAmount += lineTotal;
      }
      
      samplePOs.push({
        id: `PO-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(i).padStart(3, '0')}`,
        vendorId: vendor.id,
        vendorName: vendor.name,
        date: date.toISOString().slice(0, 10),
        deliveryDate: deliveryDate.toISOString().slice(0, 10),
        status,
        approvalStatus: status === "DRAFT" ? "DRAFT" : status,
        totalAmount: totalAmount.toFixed(2),
        items,
        terms: "Standard delivery terms",
        notes: `Order #${i} - ${status === "APPROVED" ? "Approved order" : "Pending processing"}`,
        createdBy: ["John Doe", "Jane Smith", "Mike Johnson", "Sarah Wilson"][Math.floor(Math.random() * 4)],
        createdAt: date.toISOString(),
        grnGenerated: status === "APPROVED" && Math.random() > 0.3,
        invoiceMatched: status === "APPROVED" && Math.random() > 0.4,
        priority: ["High", "Medium", "Low"][Math.floor(Math.random() * 3)]
      });
    }
    
    return samplePOs.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const [purchaseOrders, setPurchaseOrders] = useState(generateSamplePOs());

  // Form state for creating/editing PO
  const [formData, setFormData] = useState({
    poNo: "",
    vendorId: "",
    date: new Date().toISOString().slice(0, 10),
    deliveryDate: "",
    status: "DRAFT",
    items: [
      {
        itemId: "",
        description: "",
        qty: "",
        rate: "",
        taxPercent: "5",
      },
    ],
    terms: "",
    notes: "",
  });

  useEffect(() => {
    if (activeView === "create") {
      generatePONumber();
    }
  }, [activeView]);

  const generatePONumber = () => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const sequence = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
    setFormData((prev) => ({ ...prev, poNo: `PO-${dateStr}-${sequence}` }));
  };

  const addNotification = (message, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  };

  // Statistics calculations
  const getStatistics = () => {
    const total = purchaseOrders.length;
    const pending = purchaseOrders.filter(po => po.status === "PENDING_APPROVAL").length;
    const approved = purchaseOrders.filter(po => po.status === "APPROVED").length;
    const draft = purchaseOrders.filter(po => po.status === "DRAFT").length;
    const rejected = purchaseOrders.filter(po => po.status === "REJECTED").length;
    
    const totalValue = purchaseOrders.reduce((sum, po) => sum + parseFloat(po.totalAmount), 0);
    const approvedValue = purchaseOrders
      .filter(po => po.status === "APPROVED")
      .reduce((sum, po) => sum + parseFloat(po.totalAmount), 0);
    
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const thisMonthPOs = purchaseOrders.filter(po => {
      const poDate = new Date(po.date);
      return poDate.getMonth() === thisMonth && poDate.getFullYear() === thisYear;
    }).length;
    
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
    const lastMonthPOs = purchaseOrders.filter(po => {
      const poDate = new Date(po.date);
      return poDate.getMonth() === lastMonth && poDate.getFullYear() === lastMonthYear;
    }).length;
    
    const growthRate = lastMonthPOs === 0 ? 0 : ((thisMonthPOs - lastMonthPOs) / lastMonthPOs) * 100;
    
    return {
      total,
      pending,
      approved,
      draft,
      rejected,
      totalValue,
      approvedValue,
      thisMonthPOs,
      growthRate
    };
  };

  const statistics = getStatistics();

  // Filtering and sorting logic
  const filteredAndSortedPOs = () => {
    let filtered = purchaseOrders.filter((po) => {
      const matchesSearch = 
        po.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.createdBy.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "ALL" || po.status === statusFilter;
      const matchesVendor = vendorFilter === "ALL" || po.vendorId === vendorFilter;
      
      let matchesDate = true;
      if (dateFilter !== "ALL") {
        const poDate = new Date(po.date);
        const today = new Date();
        
        switch (dateFilter) {
          case "TODAY":
            matchesDate = poDate.toDateString() === today.toDateString();
            break;
          case "WEEK":
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = poDate >= weekAgo;
            break;
          case "MONTH":
            const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
            matchesDate = poDate >= monthAgo;
            break;
        }
      }

      return matchesSearch && matchesStatus && matchesVendor && matchesDate;
    });

    // Sorting
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case "date":
          aVal = new Date(a.date);
          bVal = new Date(b.date);
          break;
        case "amount":
          aVal = parseFloat(a.totalAmount);
          bVal = parseFloat(b.totalAmount);
          break;
        case "vendor":
          aVal = a.vendorName;
          bVal = b.vendorName;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        default:
          aVal = a.id;
          bVal = b.id;
      }
      
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  const filteredPOs = filteredAndSortedPOs();
  const totalPages = Math.ceil(filteredPOs.length / itemsPerPage);
  const paginatedPOs = filteredPOs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getStatusColor = (status) => {
    switch (status) {
      case "DRAFT":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "PENDING_APPROVAL":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "REJECTED":
        return "bg-rose-100 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "DRAFT":
        return <Edit3 className="w-3 h-3" />;
      case "PENDING_APPROVAL":
        return <Clock className="w-3 h-3" />;
      case "APPROVED":
        return <CheckCircle className="w-3 h-3" />;
      case "REJECTED":
        return <XCircle className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "High":
        return "bg-red-500";
      case "Medium":
        return "bg-yellow-500";
      case "Low":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const handleBulkAction = (action) => {
    if (selectedPOs.length === 0) {
      addNotification("Please select orders to perform bulk actions", "warning");
      return;
    }
    
    switch (action) {
      case "approve":
        setPurchaseOrders(prev => 
          prev.map(po => 
            selectedPOs.includes(po.id) 
              ? { ...po, status: "APPROVED", approvalStatus: "APPROVED" }
              : po
          )
        );
        addNotification(`${selectedPOs.length} orders approved successfully`, "success");
        break;
      case "delete":
        if (window.confirm(`Delete ${selectedPOs.length} selected orders?`)) {
          setPurchaseOrders(prev => prev.filter(po => !selectedPOs.includes(po.id)));
          addNotification(`${selectedPOs.length} orders deleted`, "success");
        }
        break;
      case "export":
        addNotification(`Exporting ${selectedPOs.length} orders...`, "info");
        break;
    }
    setSelectedPOs([]);
  };

  // Notifications Component
  const NotificationList = () => (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`px-4 py-3 rounded-lg shadow-lg max-w-sm backdrop-blur-sm ${
            notification.type === "success"
              ? "bg-emerald-500/90 text-white"
              : notification.type === "warning"
              ? "bg-amber-500/90 text-white"
              : notification.type === "error"
              ? "bg-rose-500/90 text-white"
              : "bg-blue-500/90 text-white"
          } animate-slide-in border border-white/20`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === "success" && <CheckCircle className="w-4 h-4" />}
            {notification.type === "warning" && <AlertCircle className="w-4 h-4" />}
            {notification.type === "error" && <AlertCircle className="w-4 h-4" />}
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      ))}
    </div>
  );

  // Dashboard Component with improved status overview using bar charts
  const Dashboard = () => (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Orders</p>
              <p className="text-3xl font-bold text-slate-900">{statistics.total}</p>
              <div className="flex items-center mt-2">
                {statistics.growthRate >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-500 mr-1" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-500 mr-1" />
                )}
                <span className={`text-sm font-medium ${statistics.growthRate >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Math.abs(statistics.growthRate).toFixed(1)}% from last month
                </span>
              </div>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Pending Approval</p>
              <p className="text-3xl font-bold text-amber-600">{statistics.pending}</p>
              <p className="text-sm text-slate-500 mt-2">Requires attention</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Total Value</p>
              <p className="text-3xl font-bold text-emerald-600">AED {statistics.totalValue.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mt-2">Approved: AED {statistics.approvedValue.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">This Month</p>
              <p className="text-3xl font-bold text-indigo-600">{statistics.thisMonthPOs}</p>
              <p className="text-sm text-slate-500 mt-2">New orders created</p>
            </div>
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Purchase Orders</h3>
          <div className="space-y-3">
            {purchaseOrders.slice(0, 5).map((po) => (
              <div key={po.id} className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(po.priority)}`}></div>
                  <div>
                    <p className="font-medium text-slate-900">{po.id}</p>
                    <p className="text-sm text-slate-600">{po.vendorName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(po.status)}`}>
                    {getStatusIcon(po.status)}
                    <span className="ml-1">{po.status.replace("_", " ")}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">AED {parseFloat(po.totalAmount).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setActiveView("list")}
            className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            View All Orders →
          </button>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Status Overview</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Approved</span>
                <span className="text-xs font-medium text-emerald-600">{statistics.approved}</span>
              </div>
              <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                  style={{ width: `${(statistics.approved / statistics.total * 100) || 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Pending</span>
                <span className="text-xs font-medium text-amber-600">{statistics.pending}</span>
              </div>
              <div className="h-2 bg-amber-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-500 ease-out"
                  style={{ width: `${(statistics.pending / statistics.total * 100) || 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Draft</span>
                <span className="text-xs font-medium text-slate-600">{statistics.draft}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-400 transition-all duration-500 ease-out"
                  style={{ width: `${(statistics.draft / statistics.total * 100) || 0}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-slate-700">Rejected</span>
                <span className="text-xs font-medium text-rose-600">{statistics.rejected}</span>
              </div>
              <div className="h-2 bg-rose-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-rose-500 transition-all duration-500 ease-out"
                  style={{ width: `${(statistics.rejected / statistics.total * 100) || 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Enhanced Table View Component
  const TableView = () => (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50/80 border-b border-slate-200">
            <tr>
              <th className="px-4 py-4 text-left">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={selectedPOs.length === paginatedPOs.length && paginatedPOs.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPOs(paginatedPOs.map(po => po.id));
                    } else {
                      setSelectedPOs([]);
                    }
                  }}
                />
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  onClick={() => handleSort("id")}
                  className="flex items-center space-x-1 text-sm font-semibold text-slate-700 hover:text-slate-900"
                >
                  <span>PO Number</span>
                  {sortBy === "id" && (
                    sortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  onClick={() => handleSort("vendor")}
                  className="flex items-center space-x-1 text-sm font-semibold text-slate-700 hover:text-slate-900"
                >
                  <span>Vendor</span>
                  {sortBy === "vendor" && (
                    sortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  onClick={() => handleSort("date")}
                  className="flex items-center space-x-1 text-sm font-semibold text-slate-700 hover:text-slate-900"
                >
                  <span>Date</span>
                  {sortBy === "date" && (
                    sortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-4 text-left">
                <span className="text-sm font-semibold text-slate-700">Status</span>
              </th>
              <th className="px-4 py-4 text-right">
                <button
                  onClick={() => handleSort("amount")}
                  className="flex items-center space-x-1 text-sm font-semibold text-slate-700 hover:text-slate-900 ml-auto"
                >
                  <span>Amount</span>
                  {sortBy === "amount" && (
                    sortOrder === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-4 text-center">
                <span className="text-sm font-semibold text-slate-700">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginatedPOs.map((po) => (
              <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={selectedPOs.includes(po.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPOs(prev => [...prev, po.id]);
                      } else {
                        setSelectedPOs(prev => prev.filter(id => id !== po.id));
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-8 rounded-full ${getPriorityColor(po.priority)}`}></div>
                    <div>
                      <p className="font-medium text-slate-900">{po.id}</p>
                      <p className="text-xs text-slate-500">{po.createdBy}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div>
                    <p className="font-medium text-slate-900">{po.vendorName}</p>
                    <p className="text-xs text-slate-500">{po.vendorId}</p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div>
                    <p className="text-sm text-slate-900">{new Date(po.date).toLocaleDateString('en-GB')}</p>
                    <p className="text-xs text-slate-500">Delivery: {new Date(po.deliveryDate).toLocaleDateString('en-GB')}</p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col space-y-1">
                    <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border w-fit ${getStatusColor(po.status)}`}>
                      {getStatusIcon(po.status)}
                      <span className="ml-1">{po.status.replace("_", " ")}</span>
                    </div>
                    <div className="flex space-x-1">
                      {po.grnGenerated && (
                        <div className="w-2 h-2 bg-green-500 rounded-full" title="GRN Generated"></div>
                      )}
                      {po.invoiceMatched && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" title="Invoice Matched"></div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <div>
                    <p className="font-semibold text-slate-900">AED {parseFloat(po.totalAmount).toLocaleString()}</p>
                    <p className="text-xs text-slate-500">{po.items.length} items</p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedPO(po);
                        setActiveView("invoice");
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {po.status === "DRAFT" && (
                      <button
                        onClick={() => editPO(po)}
                        className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {po.status === "PENDING_APPROVAL" && (
                      <button
                        onClick={() => approvePO(po.id)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                    )}
                    <div className="relative group">
                      <button className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-8 w-32 bg-white rounded-lg shadow-lg border border-slate-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        <button className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Download</button>
                        <button className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Duplicate</button>
                        {(po.status === "DRAFT" || po.status === "REJECTED") && (
                          <button 
                            onClick={() => deletePO(po.id)}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Enhanced Grid View Component with more attractive cards (added gradients and hover effects)
  const GridView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {paginatedPOs.map((po) => (
        <div key={po.id} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group hover:scale-105">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-6 py-4 border-b border-slate-200">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={selectedPOs.includes(po.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPOs(prev => [...prev, po.id]);
                    } else {
                      setSelectedPOs(prev => prev.filter(id => id !== po.id));
                    }
                  }}
                />
                <div>
                  <h3 className="text-lg font-bold text-slate-800">{po.id}</h3>
                  <p className="text-sm text-slate-600">{po.vendorName}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getPriorityColor(po.priority)}`} title={`${po.priority} Priority`}></div>
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(po.status)}`}>
                  {getStatusIcon(po.status)}
                  <span className="ml-1">{po.status.replace("_", " ")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Date</p>
                <p className="text-sm font-medium text-slate-800">{new Date(po.date).toLocaleDateString("en-GB")}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Delivery</p>
                <p className="text-sm font-medium text-slate-800">{new Date(po.deliveryDate).toLocaleDateString("en-GB")}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Items</p>
                <p className="text-sm font-medium text-slate-800">{po.items.length}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total</p>
                <p className="text-lg font-bold text-emerald-600">AED {parseFloat(po.totalAmount).toLocaleString()}</p>
              </div>
            </div>

            {/* Items Preview */}
            <div className="mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Items</p>
              <div className="space-y-1">
                {po.items.slice(0, 2).map((item, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-slate-600 truncate">{item.description}</span>
                    <span className="text-slate-800 font-medium ml-2">{item.qty} × {item.rate}</span>
                  </div>
                ))}
                {po.items.length > 2 && (
                  <p className="text-xs text-slate-500">+{po.items.length - 2} more items</p>
                )}
              </div>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center space-x-4 mb-4 text-xs">
              {po.grnGenerated && (
                <div className="flex items-center space-x-1 text-emerald-600">
                  <CheckCircle className="w-3 h-3" />
                  <span>GRN</span>
                </div>
              )}
              {po.invoiceMatched && (
                <div className="flex items-center space-x-1 text-blue-600">
                  <Receipt className="w-3 h-3" />
                  <span>Invoice</span>
                </div>
              )}
              <div className="flex items-center space-x-1 text-slate-500">
                <User className="w-3 h-3" />
                <span>{po.createdBy}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedPO(po);
                    setActiveView("invoice");
                  }}
                  className="flex items-center space-x-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">View</span>
                </button>
                {po.status === "DRAFT" && (
                  <button
                    onClick={() => editPO(po)}
                    className="flex items-center space-x-1 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="text-sm">Edit</span>
                  </button>
                )}
              </div>

              <div className="flex space-x-2">
                {po.status === "PENDING_APPROVAL" && (
                  <>
                    <button
                      onClick={() => approvePO(po.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span className="text-sm">Approve</span>
                    </button>
                    <button
                      onClick={() => rejectPO(po.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-sm">Reject</span>
                    </button>
                  </>
                )}
                {(po.status === "DRAFT" || po.status === "REJECTED") && (
                  <button
                    onClick={() => deletePO(po.id)}
                    className="flex items-center space-x-1 px-3 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Pagination Component
  const Pagination = () => {
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredPOs.length);

    return (
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-slate-600">
            Showing {startItem} to {endItem} of {filteredPOs.length} orders
          </span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-1 border border-slate-300 rounded-lg text-sm"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex space-x-1">
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    currentPage === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // List View Component
  const ListView = () => (
    <div className="space-y-6">
      {/* Filters and Actions Bar */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-white/20 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders, vendors..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
            
            <select
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Vendors</option>
              {vendors.map(vendor => (
                <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
              ))}
            </select>
            
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="WEEK">This Week</option>
              <option value="MONTH">This Month</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "table" ? "bg-white shadow-sm text-blue-600" : "text-slate-600"
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === "grid" ? "bg-white shadow-sm text-blue-600" : "text-slate-600"
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
            
            <button 
              onClick={() => addNotification("Data refreshed", "success")}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Bulk Actions */}
        {selectedPOs.length > 0 && (
          <div className="mt-4 flex items-center justify-between bg-blue-50 rounded-lg p-4">
            <span className="text-sm text-blue-700 font-medium">
              {selectedPOs.length} order(s) selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleBulkAction("approve")}
                className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
              >
                Bulk Approve
              </button>
              <button
                onClick={() => handleBulkAction("export")}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                Export Selected
              </button>
              <button
                onClick={() => handleBulkAction("delete")}
                className="px-3 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm"
              >
                Delete Selected
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {filteredPOs.length === 0 ? (
        <div className="text-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20">
          <ShoppingCart className="w-20 h-20 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-500 mb-2">No Purchase Orders Found</h3>
          <p className="text-slate-400 mb-6">
            {searchTerm || statusFilter !== "ALL" || vendorFilter !== "ALL" || dateFilter !== "ALL"
              ? "Try adjusting your search criteria"
              : "Get started by creating your first purchase order"}
          </p>
          {!searchTerm && statusFilter === "ALL" && vendorFilter === "ALL" && dateFilter === "ALL" && (
            <button
              onClick={() => setActiveView("create")}
              className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Create First PO</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {viewMode === "table" ? <TableView /> : <GridView />}
          <Pagination />
        </>
      )}
    </div>
  );

  // Invoice View Component
  const InvoiceView = () => {
    if (!selectedPO) return null;

    const vendor = vendors.find((v) => v.id === selectedPO.vendorId);
    const totals = calculateTotals(selectedPO.items);

    return (
     
<div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setActiveView("list")}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to List</span>
          </button>
          <div className="flex space-x-3">
            <button className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <button className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
              <Send className="w-4 h-4" />
              <span>Send to Vendor</span>
            </button>
          </div>
        </div>

        {/* Invoice Document */}
        <div className="bg-white shadow-lg border border-gray-200">
          {/* Company Header */}
          <div className="px-8 py-6 border-b">
            <div className="text-center mb-4">
              <h1 className="text-lg font-bold text-gray-800 mb-1" dir="rtl">
                نجم لتجارة المواد الغذائية ذ.م.م ش.ش.و
              </h1>
              <h2 className="text-xl font-bold text-teal-700 mb-2">
                NH FOODSTUFF TRADING LLC S.O.C.
              </h2>
            </div>
            
            {/* Purple header bar */}
            <div className="bg-purple-300 text-center py-2 -mx-8 mb-6">
              <h3 className="text-lg font-bold text-white">TAX INVOICE</h3>
            </div>

            <div className="flex justify-between items-start">
              <div className="text-sm space-y-1">
                <p>Dubai, UAE</p>
                <p>VAT Reg. No: 10503303</p>
                <p>Email: finance@nhfo.com</p>
                <p>Phone: +971 58 724 2111</p>
                <p>Web: www.nhfo.com</p>
              </div>
              
              {/* Logo and Company Info */}
              <div className="text-center">
                <img 
                  src="https://res.cloudinary.com/dmkdrwpfp/image/upload/v1755452581/erp_uploads/NH%20foods_1755452579855.jpg" 
                  alt="NH Foods Logo" 
                  className="w-20 h-20 object-contain mb-2 mx-auto"
                />
                <p className="text-xs text-gray-600">Precision. Purity. Everyday</p>
              </div>
              
              <div className="text-right text-sm space-y-1">
                <p>Date: {new Date(selectedPO.date).toLocaleDateString("en-GB")}</p>
                <p>Invoice: 0110</p>
                <p>PO: B202508-14413</p>
              </div>
            </div>
          </div>

          {/* Bill To Section */}
          <div className="px-8 py-4 bg-purple-100">
            <div className="flex justify-between">
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Bill To:</h4>
                <div className="text-sm space-y-1">
                  <p className="font-semibold">{vendor.name}</p>
                  <p>{vendor.address.split('\n')[0]}</p>
                  <p>{vendor.address.split('\n')[1]}</p>
                  <p>Tel: {vendor.phone}</p>
                </div>
              </div>
              <div className="text-right text-sm">
                <p>VAT Reg. No: {vendor.vatNumber}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="px-8 py-6">
            <table className="w-full">
              <thead>
                <tr className="bg-purple-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Line</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">CODE</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Item Description</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Qty</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Unit price</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Value</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">VAT 5%</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedPO.items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="px-3 py-3 text-sm text-center">{index + 1}</td>
                    <td className="px-3 py-3 text-sm">{item.itemId}</td>
                    <td className="px-3 py-3 text-sm">{item.description}</td>
                    <td className="px-3 py-3 text-sm text-center">{item.qty}</td>
                    <td className="px-3 py-3 text-sm text-center">{item.rate}</td>
                    <td className="px-3 py-3 text-sm text-center">186.00</td>
                    <td className="px-3 py-3 text-sm text-center">9.30</td>
                    <td className="px-3 py-3 text-sm text-center font-semibold">195.30</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bank Details and Totals */}
          <div className="px-8 py-6 border-t">
            <div className="flex justify-between">
              <div className="w-1/2">
                <h4 className="font-semibold text-gray-800 mb-3">BANK DETAILS:-</h4>
                <div className="text-sm space-y-1">
                  <p><strong>BANK:</strong> NATIONAL BANK OF Abudhabi</p>
                  <p><strong>ACCOUNT NO:</strong> 087989283001</p>
                </div>
              </div>
              
              <div className="w-1/3">
                <table className="w-full">
                  <tr className="border border-gray-400">
                    <td className="px-3 py-2 text-sm font-semibold text-right">Sub Total</td>
                    <td className="px-3 py-2 text-sm text-center border-l border-gray-400">186.00</td>
                  </tr>
                  <tr className="border-l border-r border-b border-gray-400">
                    <td className="px-3 py-2 text-sm font-semibold text-right">VAT (5%)</td>
                    <td className="px-3 py-2 text-sm text-center border-l border-gray-400">9.30</td>
                  </tr>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div className="px-8 py-6 border-t">
            <div className="flex justify-between items-center mb-6">
              <div className="text-sm space-y-1">
                <p><strong>IBAN NO:</strong> AE410547283001</p>
                <p><strong>CURRENCY:</strong> AED</p>
                <p><strong>ACCOUNT NAME:</strong> NH FOODSTUFF TRADING LLC S.O.C</p>
              </div>
              
              <div className="border-2 border-gray-400 px-6 py-3">
                <div className="flex items-center space-x-4">
                  <span className="text-lg font-bold">GRAND TOTAL</span>
                  <span className="text-xl font-bold">195.30</span>
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <p className="text-sm">Received the above goods in good order and condition.</p>
            </div>

            <div className="flex justify-between pt-6 border-t border-gray-300">
              <div>
                <p className="text-sm">Received by: _______________________</p>
              </div>
              <div>
                <p className="text-sm">Prepared by: _______________________</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    );
  };

  // Form Component for Create/Edit
  const POForm = () => {
    const totals = calculateTotals(formData.items);
    const isEditing = activeView === "edit";

    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleVendorSelect = (vendorId) => {
      const vendor = vendors.find((v) => v.id === vendorId);
      if (vendor) {
        setFormData((prev) => ({
          ...prev,
          vendorId: vendor.id,
        }));
        addNotification(`Vendor ${vendor.name} selected`, "success");
      }
    };

    const handleItemChange = (index, field, value) => {
      const newItems = [...formData.items];
      newItems[index][field] = value;

      // Auto-fill description and rate when item is selected
      if (field === "itemId") {
        const item = stockItems.find((i) => i.id === value);
        if (item) {
          newItems[index].description = item.description;
          newItems[index].rate = item.lastPurchaseRate;

          // Check stock levels
          if (item.currentStock < item.minStock) {
            addNotification(
              `Warning: ${item.description} is running low on stock (${item.currentStock} remaining)`,
              "warning"
            );
          }
        }
      }

      setFormData((prev) => ({ ...prev, items: newItems }));
    };

    const addItem = () => {
      setFormData((prev) => ({
        ...prev,
        items: [
          ...prev.items,
          {
            itemId: "",
            description: "",
            qty: "",
            rate: "",
            taxPercent: "5",
          },
        ],
      }));
    };

    const removeItem = (index) => {
      if (formData.items.length > 1) {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData((prev) => ({ ...prev, items: newItems }));
      }
    };

    const savePO = () => {
      const totals = calculateTotals(formData.items);
      const newPO = {
        id: formData.poNo,
        vendorId: formData.vendorId,
        vendorName: vendors.find((v) => v.id === formData.vendorId)?.name || "",
        date: formData.date,
        deliveryDate: formData.deliveryDate,
        status: formData.status,
        approvalStatus: formData.status === "DRAFT" ? "DRAFT" : "PENDING",
        totalAmount: totals.total,
        items: formData.items.map((item) => ({
          ...item,
          lineTotal:
            parseFloat(item.qty || 0) *
            parseFloat(item.rate || 0) *
            (1 + parseFloat(item.taxPercent || 0) / 100),
        })),
        terms: formData.terms,
        notes: formData.notes,
        createdBy: "Current User",
        createdAt: new Date().toISOString(),
        priority: "Medium",
      };

      if (selectedPO) {
        // Update existing PO
        setPurchaseOrders((prev) =>
          prev.map((po) => (po.id === selectedPO.id ? newPO : po))
        );
        addNotification("Purchase Order updated successfully", "success");
      } else {
        // Create new PO
        setPurchaseOrders((prev) => [newPO, ...prev]);
        addNotification("Purchase Order created successfully", "success");
      }

      setActiveView("list");
      resetForm();
    };

    const resetForm = () => {
      setFormData({
        poNo: "",
        vendorId: "",
        date: new Date().toISOString().slice(0, 10),
        deliveryDate: "",
        status: "DRAFT",
        items: [
          {
            itemId: "",
            description: "",
            qty: "",
            rate: "",
            taxPercent: "5",
          },
        ],
        terms: "",
        notes: "",
      });
      setSelectedPO(null);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="relative bg-white/80 backdrop-blur-xl shadow-xl border-b border-gray-200/50">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    setActiveView("list");
                    resetForm();
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-slate-800">
                    {isEditing
                      ? "Edit Purchase Order"
                      : "Create Purchase Order"}
                  </h1>
                  <p className="text-slate-600 mt-1">
                    {isEditing
                      ? "Update purchase order details"
                      : "Create a new purchase order"}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={savePO}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
                >
                  <Save className="w-5 h-5" />
                  <span>{isEditing ? "Update PO" : "Save PO"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-2xl p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    PO Number
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      name="poNo"
                      value={formData.poNo}
                      onChange={handleInputChange}
                      disabled
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="date"
                        name="date"
                        value={formData.date}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Delivery Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="date"
                        name="deliveryDate"
                        value={formData.deliveryDate}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Select Vendor
                  </label>
                  <select
                    name="vendorId"
                    value={formData.vendorId}
                    onChange={(e) => handleVendorSelect(e.target.value)}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a vendor...</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.id} - {vendor.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    {isEditing && <option value="APPROVED">Approved</option>}
                    {isEditing && <option value="REJECTED">Rejected</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Terms & Conditions
                  </label>
                  <textarea
                    name="terms"
                    value={formData.terms}
                    onChange={handleInputChange}
                    placeholder="Payment terms, delivery conditions, etc."
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Additional notes or special instructions"
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent h-24 resize-none"
                  />
                </div>
              </div>

              {/* Right Column - Vendor Preview */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Vendor Preview
                </h3>
                {formData.vendorId ? (
                  (() => {
                    const vendor = vendors.find(
                      (v) => v.id === formData.vendorId
                    );
                    return vendor ? (
                      <div className="text-sm text-slate-700 space-y-2">
                        <p className="font-semibold text-blue-600">
                          {vendor.id}
                        </p>
                        <p className="font-bold text-slate-800">{vendor.name}</p>
                        <p>{vendor.address}</p>
                        <p className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{vendor.phone}</span>
                        </p>
                        <p>{vendor.email}</p>
                        <p>VAT: {vendor.vatNumber}</p>
                        <p>Terms: {vendor.paymentTerms}</p>
                      </div>
                    ) : null;
                  })()
                ) : (
                  <p className="text-slate-500 italic">
                    Select a vendor to see details
                  </p>
                )}

                {/* Totals Preview */}
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-3">
                    Order Summary
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Items:</span>
                      <span>
                        {formData.items.filter((item) => item.itemId).length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Subtotal:</span>
                      <span>AED {totals.subtotal}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tax:</span>
                      <span>AED {totals.tax}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span className="text-emerald-600">
                          AED {totals.total}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Items Section */}
            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-slate-800 flex items-center">
                  <Package className="w-6 h-6 mr-2 text-blue-600" />
                  Purchase Items
                </h3>
                <button
                  onClick={addItem}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Item</span>
                </button>
              </div>

              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div
                    key={index}
                    className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-2xl p-6 border border-slate-200"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">
                          Item Code
                        </label>
                        <select
                          value={item.itemId}
                          onChange={(e) =>
                            handleItemChange(index, "itemId", e.target.value)
                          }
                          className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="">Select...</option>
                          {stockItems.map((stockItem) => (
                            <option key={stockItem.id} value={stockItem.id}>
                              {stockItem.id}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="lg:col-span-2">
                        <label className="block text-sm font-medium text-slate-600 mb-2">
                          Description
                        </label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          placeholder="Item description"
                          className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">
                          Quantity
                        </label>
                        <input
                          type="number"
                          value={item.qty}
                          onChange={(e) =>
                            handleItemChange(index, "qty", e.target.value)
                          }
                          placeholder="0"
                          min="0"
                          step="1"
                          className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-600 mb-2">
                          Rate (AED)
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="number"
                            value={item.rate}
                            onChange={(e) =>
                              handleItemChange(index, "rate", e.target.value)
                            }
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            className="w-full pl-8 pr-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex items-end space-x-2">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-600 mb-2">
                            Tax %
                          </label>
                          <input
                            type="number"
                            value={item.taxPercent}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "taxPercent",
                                e.target.value
                              )
                            }
                            placeholder="5"
                            min="0"
                            max="100"
                            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          />
                        </div>
                        {formData.items.length > 1 && (
                          <button
                            onClick={() => removeItem(index)}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Line Total */}
                    {item.qty && item.rate && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">
                            Line Total (incl. tax):
                          </span>
                          <span className="font-semibold text-slate-800">
                            AED{" "}
                            {(
                              parseFloat(item.qty || 0) *
                              parseFloat(item.rate || 0) *
                              (1 + parseFloat(item.taxPercent || 0) / 100)
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper functions for form functionality
  const calculateTotals = (items) => {
    let subtotal = 0;
    let totalTax = 0;

    items.forEach((item) => {
      if (item.qty && item.rate) {
        const lineValue = parseFloat(item.qty) * parseFloat(item.rate);
        const taxAmount = (lineValue * parseFloat(item.taxPercent || 0)) / 100;
        subtotal += lineValue;
        totalTax += taxAmount;
      }
    });

    return {
      subtotal: subtotal.toFixed(2),
      tax: totalTax.toFixed(2),
      total: (subtotal + totalTax).toFixed(2),
    };
  };

  const editPO = (po) => {
    setSelectedPO(po);
    setFormData({
      poNo: po.id,
      vendorId: po.vendorId,
      date: po.date,
      deliveryDate: po.deliveryDate,
      status: po.status,
      items: po.items.map((item) => ({
        itemId: item.itemId,
        description: item.description,
        qty: item.qty.toString(),
        rate: item.rate.toString(),
        taxPercent: item.taxPercent.toString(),
      })),
      terms: po.terms,
      notes: po.notes,
    });
    setActiveView("edit");
  };

  const deletePO = (poId) => {
    if (
      window.confirm("Are you sure you want to delete this Purchase Order?")
    ) {
      setPurchaseOrders((prev) => prev.filter((po) => po.id !== poId));
      addNotification("Purchase Order deleted successfully", "success");
    }
  };

  const approvePO = (poId) => {
    setPurchaseOrders((prev) =>
      prev.map((po) =>
        po.id === poId
          ? { ...po, status: "APPROVED", approvalStatus: "APPROVED" }
          : po
      )
    );
    addNotification("Purchase Order approved successfully", "success");
  };

  const rejectPO = (poId) => {
    setPurchaseOrders((prev) =>
      prev.map((po) =>
        po.id === poId
          ? { ...po, status: "REJECTED", approvalStatus: "REJECTED" }
          : po
      )
    );
    addNotification("Purchase Order rejected", "error");
  };

  // Main render logic
  if (activeView === "invoice") {
    return (
      <>
        <NotificationList />
        <InvoiceView />
      </>
    );
  }

  if (activeView === "create" || activeView === "edit") {
    return (
      <>
        <NotificationList />
        <POForm />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NotificationList />

      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-200/20 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Header */}
      <div className="relative bg-white/80 backdrop-blur-xl shadow-xl border-b border-gray-200/50">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-800">
                  Purchase Order Management
                </h1>
                <p className="text-slate-600 mt-1">
                  Manage purchase orders, approvals, and vendor invoices
                </p>
              </div>
            </div>
            
            {/* Navigation Tabs */}
            <div className="flex items-center space-x-1 bg-white/60 backdrop-blur-sm rounded-xl p-1 border border-white/30">
              <button
                onClick={() => setActiveView("dashboard")}
                className={`px-4 py-2 rounded-lg transition-all font-medium text-sm ${
                  activeView === "dashboard"
                    ? "bg-white shadow-sm text-blue-600"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setActiveView("list")}
                className={`px-4 py-2 rounded-lg transition-all font-medium text-sm ${
                  activeView === "list"
                    ? "bg-white shadow-sm text-blue-600"
                    : "text-slate-600 hover:text-slate-800"
                }`}
              >
                Orders
              </button>
              <button
                onClick={() => setActiveView("create")}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Create PO</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative p-8">
        {activeView === "dashboard" ? <Dashboard /> : <ListView />}
      </div>

      {/* Custom Styles for animations */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default PurchaseOrderManagement;