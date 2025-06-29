import React, { useState } from "react";
import {
  Settings,
  Building,
  MapPin,
  Phone,
  Mail,
  Globe,
  Image,
  DollarSign,
  FileText,
  Server,
  Shield,
  Calculator,
  Save,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Upload,
  Eye,
  EyeOff,
} from "lucide-react";

const SettingsModule = () => {
  const [activeSection, setActiveSection] = useState("company");
  const [showPassword, setShowPassword] = useState(false);
  const [settings, setSettings] = useState({
    // Company Details
    companyName: "Acme Corporation",
    addressLine1: "123 Business Street",
    addressLine2: "Suite 100",
    city: "New York",
    stateProvince: "NY",
    country: "United States",
    postalCode: "10001",
    phoneNumber: "+1-234-567-8900",
    email: "info@acmecorp.com",
    website: "https://www.acmecorp.com",
    logo: null,

    // Currency Settings
    defaultCurrency: "USD",
    currencySymbol: "$",
    decimalPlaces: 2,

    // Document Numbering
    documentType: "Invoice",
    prefix: "INV",
    suffix: "",
    startingNumber: 1,
    numberPadding: 4,

    // Email Server Settings
    smtpServer: "smtp.gmail.com",
    port: 587,
    username: "your-email@gmail.com",
    password: "",
    useSslTls: true,
    fromEmailAddress: "noreply@acmecorp.com",

    // Taxation Settings
    taxName: "VAT",
    taxCode: "VAT001",
    taxRate: 5.0,
    effectiveFrom: "2024-01-01",
    taxType: "VAT",
    taxApplicability: ["UAE"],
    status: "Active",
    description: "Standard UAE VAT at 5%",
  });

  const [expandedSections, setExpandedSections] = useState({
    company: true,
    currency: false,
    numbering: false,
    email: false,
    taxation: false,
  });

  const [showToast, setShowToast] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const sections = [
    { id: "company", label: "Company Details", icon: Building, color: "blue" },
    {
      id: "currency",
      label: "Currency Settings",
      icon: DollarSign,
      color: "green",
    },
    {
      id: "numbering",
      label: "Document Numbering",
      icon: FileText,
      color: "purple",
    },
    { id: "email", label: "Email Server", icon: Server, color: "orange" },
    {
      id: "taxation",
      label: "Taxation Settings",
      icon: Calculator,
      color: "red",
    },
  ];

  const countries = [
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "Germany",
    "France",
    "Japan",
    "China",
    "India",
    "UAE",
    "Saudi Arabia",
    "Singapore",
  ];

  const currencies = [
    { code: "USD", name: "US Dollar", symbol: "$" },
    { code: "EUR", name: "Euro", symbol: "€" },
    { code: "GBP", name: "British Pound", symbol: "£" },
    { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
    { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
    { code: "INR", name: "Indian Rupee", symbol: "₹" },
  ];

  const documentTypes = [
    "Invoice",
    "Purchase Order",
    "Quotation",
    "Receipt",
    "Credit Note",
  ];
  const taxTypes = ["VAT", "GST", "Sales Tax", "Service Tax"];
  const uaeStates = [
    "Abu Dhabi",
    "Dubai",
    "Sharjah",
    "Ajman",
    "Fujairah",
    "Ras Al Khaimah",
    "Umm Al Quwain",
  ];

  const handleInputChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const handleSave = () => {
    setShowToast({
      visible: true,
      message: "Settings saved successfully!",
      type: "success",
    });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  };

  const handleReset = () => {
    setShowToast({
      visible: true,
      message: "Settings reset to default values!",
      type: "info",
    });
    setTimeout(
      () => setShowToast((prev) => ({ ...prev, visible: false })),
      3000
    );
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSettings((prev) => ({ ...prev, logo: e.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const SectionCard = ({ section, children }) => {
    const isExpanded = expandedSections[section.id];
    const IconComponent = section.icon;

    return (
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div
          className={`p-6 cursor-pointer transition-all duration-200 bg-gradient-to-r from-${section.color}-50 to-${section.color}-100 hover:from-${section.color}-100 hover:to-${section.color}-200`}
          onClick={() => toggleSection(section.id)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div
                className={`p-3 bg-${section.color}-500 text-white rounded-xl`}
              >
                <IconComponent size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {section.label}
                </h3>
                <p className="text-gray-600 text-sm">
                  Configure {section.label.toLowerCase()} settings
                </p>
              </div>
            </div>
            <div
              className={`transition-transform duration-200 ${
                isExpanded ? "rotate-90" : ""
              }`}
            >
              <ChevronRight size={20} className="text-gray-400" />
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="p-6 border-t border-gray-100">{children}</div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className="p-4 bg-white rounded-2xl shadow-lg">
            <Settings size={28} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Settings Module
            </h1>
            <p className="text-gray-600 mt-1">
              Configure your application settings and preferences
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Save size={18} />
            <span>Save All Settings</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <RefreshCw size={18} />
            <span>Reset to Default</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast.visible && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg text-white z-50 transform transition-all duration-300 ${
            showToast.type === "success"
              ? "bg-green-500"
              : showToast.type === "error"
              ? "bg-red-500"
              : "bg-blue-500"
          }`}
        >
          <div className="flex items-center space-x-2">
            <Check size={18} />
            <span>{showToast.message}</span>
          </div>
        </div>
      )}

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Company Details */}
        <SectionCard section={sections[0]}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Building size={16} className="inline mr-2" />
                Company Name *
              </label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) =>
                  handleInputChange("companyName", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Official company name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MapPin size={16} className="inline mr-2" />
                Address Line 1 *
              </label>
              <input
                type="text"
                value={settings.addressLine1}
                onChange={(e) =>
                  handleInputChange("addressLine1", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Primary address line"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Address Line 2
              </label>
              <input
                type="text"
                value={settings.addressLine2}
                onChange={(e) =>
                  handleInputChange("addressLine2", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Secondary address line (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                City *
              </label>
              <input
                type="text"
                value={settings.city}
                onChange={(e) => handleInputChange("city", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="City"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                State / Province *
              </label>
              <input
                type="text"
                value={settings.stateProvince}
                onChange={(e) =>
                  handleInputChange("stateProvince", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="State or province"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Country *
              </label>
              <select
                value={settings.country}
                onChange={(e) => handleInputChange("country", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Postal Code
              </label>
              <input
                type="text"
                value={settings.postalCode}
                onChange={(e) =>
                  handleInputChange("postalCode", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="ZIP or postal code"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Phone size={16} className="inline mr-2" />
                Phone Number
              </label>
              <input
                type="tel"
                value={settings.phoneNumber}
                onChange={(e) =>
                  handleInputChange("phoneNumber", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Primary contact number"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Mail size={16} className="inline mr-2" />
                Email Address
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="General company email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Globe size={16} className="inline mr-2" />
                Website
              </label>
              <input
                type="url"
                value={settings.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="Company website URL"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Image size={16} className="inline mr-2" />
                Company Logo
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  id="logo-upload"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <label
                  htmlFor="logo-upload"
                  className="flex items-center space-x-2 px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl cursor-pointer hover:bg-gray-200 transition-all duration-200"
                >
                  <Upload size={18} />
                  <span>Upload Company Logo Image</span>
                </label>
                {settings.logo && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-gray-300">
                    <img
                      src={settings.logo}
                      alt="Company Logo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Currency Settings */}
        <SectionCard section={sections[1]}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Default Currency
              </label>
              <select
                value={settings.defaultCurrency}
                onChange={(e) => {
                  const selectedCurrency = currencies.find(
                    (c) => c.code === e.target.value
                  );
                  handleInputChange("defaultCurrency", e.target.value);
                  if (selectedCurrency) {
                    handleInputChange(
                      "currencySymbol",
                      selectedCurrency.symbol
                    );
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
              >
                {currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Currency Symbol
              </label>
              <input
                type="text"
                value={settings.currencySymbol}
                onChange={(e) =>
                  handleInputChange("currencySymbol", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                placeholder="Currency symbol to display (e.g., $)"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Decimal Places
              </label>
              <input
                type="number"
                value={settings.decimalPlaces}
                onChange={(e) =>
                  handleInputChange("decimalPlaces", parseInt(e.target.value))
                }
                min="0"
                max="4"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                placeholder="Number of decimal places (usually 2)"
              />
            </div>
          </div>
        </SectionCard>

        {/* Document Numbering Settings */}
        <SectionCard section={sections[2]}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Document Type
              </label>
              <select
                value={settings.documentType}
                onChange={(e) =>
                  handleInputChange("documentType", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
              >
                {documentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Prefix
              </label>
              <input
                type="text"
                value={settings.prefix}
                onChange={(e) => handleInputChange("prefix", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                placeholder="Prefix to add before the document number"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Suffix
              </label>
              <input
                type="text"
                value={settings.suffix}
                onChange={(e) => handleInputChange("suffix", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                placeholder="Suffix to add after the document number - Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Starting Number
              </label>
              <input
                type="number"
                value={settings.startingNumber}
                onChange={(e) =>
                  handleInputChange("startingNumber", parseInt(e.target.value))
                }
                min="1"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                placeholder="Initial number to start counting from - default 1"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Number Padding
              </label>
              <input
                type="number"
                value={settings.numberPadding}
                onChange={(e) =>
                  handleInputChange("numberPadding", parseInt(e.target.value))
                }
                min="1"
                max="10"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                placeholder="Minimum digit length, padded with zeros"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Preview
              </label>
              <div className="w-full px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-800 font-mono">
                {settings.prefix}
                {settings.startingNumber
                  .toString()
                  .padStart(settings.numberPadding, "0")}
                {settings.suffix}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Email Server Settings */}
        <SectionCard section={sections[3]}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Server size={16} className="inline mr-2" />
                SMTP Server
              </label>
              <input
                type="text"
                value={settings.smtpServer}
                onChange={(e) =>
                  handleInputChange("smtpServer", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                placeholder="SMTP server address"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Port
              </label>
              <input
                type="number"
                value={settings.port}
                onChange={(e) =>
                  handleInputChange("port", parseInt(e.target.value))
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                placeholder="SMTP port number"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={settings.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                placeholder="SMTP username"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={settings.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                  placeholder="SMTP password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Shield size={16} className="inline mr-2" />
                Use SSL/TLS
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.useSslTls}
                    onChange={(e) =>
                      handleInputChange("useSslTls", e.target.checked)
                    }
                    className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">
                    Enable secure connection
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                From Email Address
              </label>
              <input
                type="email"
                value={settings.fromEmailAddress}
                onChange={(e) =>
                  handleInputChange("fromEmailAddress", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-200"
                placeholder="Default sender email address"
              />
            </div>
          </div>
        </SectionCard>

        {/* Taxation Settings */}
        <SectionCard section={sections[4]}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tax Name
              </label>
              <input
                type="text"
                value={settings.taxName}
                onChange={(e) => handleInputChange("taxName", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                placeholder='Example: "VAT"'
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tax Code
              </label>
              <input
                type="text"
                value={settings.taxCode}
                onChange={(e) => handleInputChange("taxCode", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                placeholder='Example: "VAT001" or "VAT-5"'
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tax Rate (%)
              </label>
              <input
                type="number"
                value={settings.taxRate}
                onChange={(e) =>
                  handleInputChange("taxRate", parseFloat(e.target.value))
                }
                step="0.01"
                min="0"
                max="100"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                placeholder="Fixed at 5.00% Default"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Effective From
              </label>
              <input
                type="date"
                value={settings.effectiveFrom}
                onChange={(e) =>
                  handleInputChange("effectiveFrom", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tax Type
              </label>
              <select
                value={settings.taxType}
                onChange={(e) => handleInputChange("taxType", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
              >
                {taxTypes.map((type) => (
                  <option key={type} value={type}>
                    {type} (fixed option for UAE)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status
              </label>
              <select
                value={settings.status}
                onChange={(e) => handleInputChange("status", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tax Applicability
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {uaeStates.map((state) => (
                  <label
                    key={state}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={settings.taxApplicability.includes(state)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleInputChange("taxApplicability", [
                            ...settings.taxApplicability,
                            state,
                          ]);
                        } else {
                          handleInputChange(
                            "taxApplicability",
                            settings.taxApplicability.filter((s) => s !== state)
                          );
                        }
                      }}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                    />
                    <span className="text-sm text-gray-700">{state}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={settings.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                rows="3"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
                placeholder="Brief description of this tax configuration"
              />
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Bottom Spacing */}
      <div className="h-8"></div>
    </div>
  );
};

export default SettingsModule;
