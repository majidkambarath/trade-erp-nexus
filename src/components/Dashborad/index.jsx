import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Package,
  ShoppingCart,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  RefreshCw,
  Filter,
  Download,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
  Briefcase,
  CreditCard,
  Truck,
  Warehouse,
  Receipt,
  FileText,
  Bell,
  Settings,
  Archive,
  Database,
  Scale,
  UserPlus,
  BookOpen,
  Wallet,
  Calculator,
  ShoppingBag,
  Box,
  Barcode,
  Star,
  Award,
  Flame,
  Globe,
  Shield,
  Layers,
  MousePointer,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Cell,
  RadialBarChart,
  RadialBar,
  ComposedChart,
  Pie,
} from "recharts";

const Dashboard = () => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // KPI Data
  const kpiData = [
    {
      id: 1,
      title: "Total Revenue",
      value: "₹24,56,789",
      change: "+12.5%",
      trend: "up",
      icon: <DollarSign className="w-6 h-6" />,
      bgColor: "bg-gray-100/50",
      borderColor: "border-gray-200/50",
      description: "vs last month",
      target: "₹30,00,000",
    },
    {
      id: 2,
      title: "Active Customers",
      value: "1,234",
      change: "+8.2%",
      trend: "up",
      icon: <Users className="w-6 h-6" />,
      bgColor: "bg-gray-100/50",
      borderColor: "border-gray-200/50",
      description: "new customers",
      target: "1,500",
    },
    {
      id: 3,
      title: "Inventory Value",
      value: "₹18,54,321",
      change: "-2.1%",
      trend: "down",
      icon: <Package className="w-6 h-6" />,
      bgColor: "bg-gray-100/50",
      borderColor: "border-gray-200/50",
      description: "stock valuation",
      target: "₹20,00,000",
    },
    {
      id: 4,
      title: "Monthly Orders",
      value: "856",
      change: "+15.3%",
      trend: "up",
      icon: <ShoppingCart className="w-6 h-6" />,
      bgColor: "bg-gray-100/50",
      borderColor: "border-gray-200/50",
      description: "orders processed",
      target: "1,000",
    },
    {
      id: 5,
      title: "Profit Margin",
      value: "23.5%",
      change: "+2.3%",
      trend: "up",
      icon: <TrendingUp className="w-6 h-6" />,
      bgColor: "bg-gray-100/50",
      borderColor: "border-gray-200/50",
      description: "improvement",
      target: "25%",
    },
    {
      id: 6,
      title: "Staff Productivity",
      value: "87%",
      change: "+5.1%",
      trend: "up",
      icon: <Award className="w-6 h-6" />,
      bgColor: "bg-gray-100/50",
      borderColor: "border-gray-200/50",
      description: "efficiency rate",
      target: "90%",
    },
  ];

  // Sales Performance Data
  const salesData = [
    {
      month: "Jan",
      sales: 450000,
      purchase: 320000,
      profit: 130000,
      orders: 45,
    },
    {
      month: "Feb",
      sales: 520000,
      purchase: 380000,
      profit: 140000,
      orders: 52,
    },
    {
      month: "Mar",
      sales: 480000,
      purchase: 340000,
      profit: 140000,
      orders: 48,
    },
    {
      month: "Apr",
      sales: 610000,
      purchase: 430000,
      profit: 180000,
      orders: 61,
    },
    {
      month: "May",
      sales: 550000,
      purchase: 390000,
      profit: 160000,
      orders: 55,
    },
    {
      month: "Jun",
      sales: 670000,
      purchase: 460000,
      profit: 210000,
      orders: 67,
    },
    {
      month: "Jul",
      sales: 720000,
      purchase: 500000,
      profit: 220000,
      orders: 72,
    },
    {
      month: "Aug",
      sales: 680000,
      purchase: 470000,
      profit: 210000,
      orders: 68,
    },
  ];

  // Inventory Distribution
  const inventoryData = [
    { name: "Raw Materials", value: 35, count: 1250, color: "#1F1F1F" },
    { name: "Finished Goods", value: 28, count: 890, color: "#4B4B4B" },
    { name: "Work in Progress", value: 20, count: 450, color: "#6B7280" },
    { name: "Spare Parts", value: 12, count: 320, color: "#9CA3AF" },
    { name: "Consumables", value: 5, count: 180, color: "#D1D5DB" },
  ];

  // Financial Modules Performance
  const financialData = [
    {
      module: "Receipt Voucher",
      processed: 145,
      amount: 2450000,
      growth: 12.5,
    },
    { module: "Payment Voucher", processed: 89, amount: 1890000, growth: 8.3 },
    { module: "Journal Voucher", processed: 67, amount: 890000, growth: 15.2 },
    { module: "Contra Voucher", processed: 34, amount: 450000, growth: 6.8 },
    { module: "Expense Voucher", processed: 112, amount: 1230000, growth: 9.7 },
  ];

  // Staff Performance Data
  const staffData = [
    { department: "Sales", active: 12, performance: 87, efficiency: 92 },
    { department: "Purchase", active: 8, performance: 91, efficiency: 89 },
    { department: "Inventory", active: 6, performance: 85, efficiency: 88 },
    { department: "Accounts", active: 5, performance: 94, efficiency: 95 },
    { department: "Admin", active: 3, performance: 88, efficiency: 90 },
  ];

  // Recent Activities
  const recentActivities = [
    {
      id: 1,
      type: "sale",
      description: "New sale order #SO-2024-001 created",
      time: "10 minutes ago",
      status: "success",
      amount: "₹45,000",
      user: "John Doe",
    },
    {
      id: 2,
      type: "purchase",
      description: "Purchase order #PO-2024-045 approved",
      time: "25 minutes ago",
      status: "info",
      amount: "₹32,000",
      user: "Jane Smith",
    },
    {
      id: 3,
      type: "inventory",
      description: "Low stock alert for Product XYZ",
      time: "1 hour ago",
      status: "warning",
      amount: "150 units",
      user: "System",
    },
    {
      id: 4,
      type: "payment",
      description: "Payment received from Customer ABC",
      time: "2 hours ago",
      status: "success",
      amount: "₹75,000",
      user: "Mike Johnson",
    },
    {
      id: 5,
      type: "user",
      description: "New staff member added to Sales team",
      time: "3 hours ago",
      status: "info",
      amount: "",
      user: "HR Admin",
    },
    {
      id: 6,
      type: "ledger",
      description: "Customer ledger updated",
      time: "4 hours ago",
      status: "success",
      amount: "₹12,000",
      user: "Accountant",
    },
  ];

  // Top Performing Items
  const topItems = [
    {
      name: "Product Alpha",
      sales: 2450000,
      units: 1250,
      growth: 18.5,
      category: "Electronics",
    },
    {
      name: "Product Beta",
      sales: 1890000,
      units: 890,
      growth: 12.3,
      category: "Home & Garden",
    },
    {
      name: "Product Gamma",
      sales: 1650000,
      units: 750,
      growth: 15.7,
      category: "Clothing",
    },
    {
      name: "Product Delta",
      sales: 1420000,
      units: 680,
      growth: 9.8,
      category: "Sports",
    },
    {
      name: "Product Epsilon",
      sales: 1180000,
      units: 520,
      growth: 22.1,
      category: "Books",
    },
  ];

  // Alerts and Notifications
  const alerts = [
    {
      type: "critical",
      message: "7 items are critically low in stock",
      count: 7,
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    {
      type: "warning",
      message: "23 pending orders require attention",
      count: 23,
      icon: <Clock className="w-4 h-4" />,
    },
    {
      type: "info",
      message: "5 new customer registrations today",
      count: 5,
      icon: <Users className="w-4 h-4" />,
    },
    {
      type: "success",
      message: "89% of targets achieved this month",
      count: 89,
      icon: <Target className="w-4 h-4" />,
    },
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setRefreshing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "bg-gray-600";
      case "warning":
        return "bg-gray-500";
      case "critical":
        return "bg-gray-700";
      case "info":
        return "bg-gray-600";
      default:
        return "bg-gray-500";
    }
  };

  const getAlertBgColor = (type) => {
    switch (type) {
      case "critical":
        return "bg-gray-100/20 border-gray-200/50";
      case "warning":
        return "bg-gray-100/20 border-gray-200/50";
      case "info":
        return "bg-gray-100/20 border-gray-200/50";
      case "success":
        return "bg-gray-100/20 border-gray-200/50";
      default:
        return "bg-gray-100/20 border-gray-200/50";
    }
  };

  const tabs = [
    {
      id: "overview",
      name: "Overview",
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: "financial",
      name: "Financial",
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      id: "inventory",
      name: "Inventory",
      icon: <Package className="w-4 h-4" />,
    },
    { id: "sales", name: "Sales", icon: <ShoppingCart className="w-4 h-4" /> },
    { id: "staff", name: "Staff", icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gray-200/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gray-300/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Header */}
      <div className="relative bg-gray-100/50 backdrop-blur-xl shadow-2xl border-b border-gray-200/50">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-2xl flex items-center justify-center shadow-lg">
                  <LayoutDashboard className="w-6 h-6 text-gray-800" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">
                    ERP Dashboard
                  </h1>
                  <p className="text-gray-600">
                    Welcome back, Administrator •{" "}
                    {currentTime.toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-gray-100/50 rounded-xl px-4 py-2 backdrop-blur-sm">
                <Calendar className="w-4 h-4 text-gray-600" />
                <select
                  className="bg-transparent text-gray-800 text-sm border-none outline-none"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                >
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="quarter">This Quarter</option>
                  <option value="year">This Year</option>
                </select>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="relative px-8 pt-6">
        <div className="flex space-x-2 bg-gray-100/50 backdrop-blur-xl rounded-2xl p-2 border border-gray-200/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-gray-200 text-gray-800 shadow-lg"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-200/50"
              }`}
            >
              {tab.icon}
              <span className="font-medium">{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative p-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {kpiData.map((kpi) => (
            <div key={kpi.id} className="group relative">
              <div className="absolute inset-0 bg-gray-200/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div
                className={`relative bg-gray-100/50 backdrop-blur-xl rounded-2xl p-6 border ${kpi.borderColor} hover:border-gray-300/50 transition-all duration-300 overflow-hidden`}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`p-3 rounded-xl ${kpi.bgColor} text-gray-800 shadow-lg`}
                    >
                      {kpi.icon}
                    </div>
                    <div
                      className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium ${
                        kpi.trend === "up"
                          ? "bg-gray-200/50 text-gray-600"
                          : "bg-gray-300/50 text-gray-700"
                      }`}
                    >
                      {kpi.trend === "up" ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      <span>{kpi.change}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-gray-800">
                      {kpi.value}
                    </h3>
                    <p className="text-sm font-medium text-gray-700">
                      {kpi.title}
                    </p>
                    <p className="text-xs text-gray-600">{kpi.description}</p>
                    <div className="w-full bg-gray-200/50 rounded-full h-2">
                      <div
                        className={`h-2 bg-gray-400 rounded-full transition-all duration-1000`}
                        style={{
                          width: `${Math.min(
                            (parseInt(kpi.value.replace(/[^\d]/g, "")) /
                              parseInt(kpi.target.replace(/[^\d]/g, ""))) *
                              100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Target: {kpi.target}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Alerts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl border ${getAlertBgColor(
                alert.type
              )} backdrop-blur-sm`}
            >
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-lg ${getStatusColor(
                    alert.type
                  )} text-white`}
                >
                  {alert.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    {alert.message}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Count: {alert.count}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sales Performance Chart */}
          <div className="lg:col-span-2">
            <div className="bg-gray-100/50 backdrop-blur-xl rounded-2xl border border-gray-200/50 overflow-hidden">
              <div className="p-6 border-b border-gray-200/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">
                      Sales Performance
                    </h3>
                    <p className="text-gray-600">
                      Revenue, purchases, and profit trends
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 hover:bg-gray-200/50 rounded-lg transition-colors">
                      <Filter className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-200/50 rounded-lg transition-colors">
                      <Download className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={salesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
                    <XAxis dataKey="month" stroke="#4B4B4B" />
                    <YAxis stroke="#4B4B4B" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        borderRadius: "12px",
                        color: "#000000",
                      }}
                    />
                    <Bar
                      dataKey="sales"
                      fill="url(#salesGradient)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="purchase"
                      fill="url(#purchaseGradient)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#4B4B4B"
                      strokeWidth={3}
                      dot={{ fill: "#4B4B4B", r: 6 }}
                    />
                    <defs>
                      <linearGradient
                        id="salesGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#6B7280"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#6B7280"
                          stopOpacity={0.3}
                        />
                      </linearGradient>
                      <linearGradient
                        id="purchaseGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#9CA3AF"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#9CA3AF"
                          stopOpacity={0.3}
                        />
                      </linearGradient>
                    </defs>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Inventory Distribution */}
          <div className="space-y-8">
            <div className="bg-gray-100/50 backdrop-blur-xl rounded-2xl border border-gray-200/50">
              <div className="p-6 border-b border-gray-200/50">
                <h3 className="text-xl font-bold text-gray-800">
                  Inventory Distribution
                </h3>
                <p className="text-gray-600">Stock distribution by category</p>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPieChart>
                    <Pie
                      data={inventoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {inventoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        borderRadius: "8px",
                        color: "#000000",
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {inventoryData.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        ></div>
                        <span className="text-gray-700">{item.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-800 font-medium">
                          {item.value}%
                        </span>
                        <span className="text-gray-600 ml-2">
                          ({item.count})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-100/50 backdrop-blur-xl rounded-2xl border border-gray-200/50">
              <div className="p-6 border-b border-gray-200/50">
                <h3 className="text-xl font-bold text-gray-800">
                  Quick Actions
                </h3>
                <p className="text-gray-600">Frequently used functions</p>
              </div>
              <div className="p-6 grid grid-cols-2 gap-3">
                {[
                  {
                    icon: <Receipt className="w-5 h-5" />,
                    label: "New Invoice",
                    bgColor: "bg-gray-200",
                  },
                  {
                    icon: <ShoppingCart className="w-5 h-5" />,
                    label: "Add Order",
                    bgColor: "bg-gray-200",
                  },
                  {
                    icon: <Package className="w-5 h-5" />,
                    label: "Stock Entry",
                    bgColor: "bg-gray-200",
                  },
                  {
                    icon: <Users className="w-5 h-5" />,
                    label: "New Customer",
                    bgColor: "bg-gray-200",
                  },
                ].map((action, index) => (
                  <button
                    key={index}
                    className="group p-4 bg-gray-100/50 rounded-xl hover:bg-gray-200/50 transition-all duration-300 flex flex-col items-center space-y-3 border border-gray-200/50 hover:border-gray-300/50"
                  >
                    <div
                      className={`p-3 rounded-lg ${action.bgColor} text-gray-800 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                    >
                      {action.icon}
                    </div>
                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-800 transition-colors">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Modules Performance */}
        <div className="bg-gray-100/50 backdrop-blur-xl rounded-2xl border border-gray-200/50">
          <div className="p-6 border-b border-gray-200/50">
            <h3 className="text-xl font-bold text-gray-800">
              Financial Modules Performance
            </h3>
            <p className="text-gray-600">
              Voucher processing and transaction volumes
            </p>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={financialData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#D1D5DB" />
                <XAxis type="number" stroke="#4B4B4B" />
                <YAxis
                  dataKey="module"
                  type="category"
                  stroke="#4B4B4B"
                  width={120}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #D1D5DB",
                    borderRadius: "12px",
                    color: "#000000",
                  }}
                />
                <Bar dataKey="processed" fill="#6B7280" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Staff Performance and Top Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Staff Performance */}
          <div className="bg-gray-100/50 backdrop-blur-xl rounded-2xl border border-gray-200/50">
            <div className="p-6 border-b border-gray-200/50">
              <h3 className="text-xl font-bold text-gray-800">
                Staff Performance
              </h3>
              <p className="text-gray-600">
                Department-wise performance metrics
              </p>
            </div>
            <div className="p-6">
              <ResponsiveContainer width="100%" height={300}>
                <RadialBarChart
                  data={staffData}
                  innerRadius="30%"
                  outerRadius="80%"
                >
                  <RadialBar
                    dataKey="performance"
                    cornerRadius={10}
                    fill="#6B7280"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #D1D5DB",
                      borderRadius: "12px",
                      color: "#000000",
                    }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="mt-6 space-y-4">
                {staffData.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                      <span className="text-gray-700">{item.department}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-800 font-medium">
                        {item.performance}%
                      </span>
                      <span className="text-gray-600 ml-2">
                        ({item.active} active)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Performing Items */}
          <div className="bg-gray-100/50 backdrop-blur-xl rounded-2xl border border-gray-200/50">
            <div className="p-6 border-b border-gray-200/50">
              <h3 className="text-xl font-bold text-gray-800">
                Top Performing Items
              </h3>
              <p className="text-gray-600">Best-selling products by revenue</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {topItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-100/50 rounded-xl border border-gray-200/50 hover:bg-gray-200/50 transition-all duration-300"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-2 rounded-lg bg-gray-200 text-gray-800">
                        <Star className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-600">{item.category}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800">
                        ₹{item.sales.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600">
                        +{item.growth}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-gray-100/50 backdrop-blur-xl rounded-2xl border border-gray-200/50">
          <div className="p-6 border-b border-gray-200/50">
            <h3 className="text-xl font-bold text-gray-800">
              Recent Activities
            </h3>
            <p className="text-gray-600">Latest system events and updates</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-4 bg-gray-100/50 rounded-xl border border-gray-200/50 hover:bg-gray-200/50 transition-all duration-300"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`p-2 rounded-lg ${getStatusColor(
                        activity.status
                      )} text-white`}
                    >
                      {activity.type === "sale" && (
                        <ShoppingCart className="w-4 h-4" />
                      )}
                      {activity.type === "purchase" && (
                        <Truck className="w-4 h-4" />
                      )}
                      {activity.type === "inventory" && (
                        <Package className="w-4 h-4" />
                      )}
                      {activity.type === "payment" && (
                        <CreditCard className="w-4 h-4" />
                      )}
                      {activity.type === "user" && (
                        <UserPlus className="w-4 h-4" />
                      )}
                      {activity.type === "ledger" && (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {activity.description}
                      </p>
                      <p className="text-xs text-gray-600">
                        {activity.time} • By {activity.user}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    {activity.amount}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;