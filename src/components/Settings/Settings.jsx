import { useState, useEffect, useCallback, useMemo } from "react";
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
  ChevronRight,
  Check,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  Lock,
  User,
  Key,
  Palette,
  Bell,
  Database,
  Clock,
  Zap,
  UserCheck,
  AlertTriangle,
  X,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Calendar,
  Monitor,
} from "lucide-react";
import axiosInstance from "../../axios/axios";

const SettingsModule = () => {
  // Get real session data
  const adminId = sessionStorage.getItem("adminId");
  const token = sessionStorage.getItem("accessToken");

  // Consolidated state
  const [state, setState] = useState({
    settings: {
      company: {
        companyName: "",
        addressLine1: "",
        addressLine2: "",
        city: "",
        stateProvince: "",
        country: "United Arab Emirates",
        postalCode: "",
        phoneNumber: "",
        email: "",
        website: "",
        logo: null,
        logoFile: null,
      },
      bank: {
        bankName: "",
        accountNumber: "",
        accountName: "",
        ibanNumber: "",
        currency: "AED",
      },
      currency: {
        defaultCurrency: "USD",
        currencySymbol: "$",
        decimalPlaces: 2,
      },
      numbering: {
        documentType: "Invoice",
        prefix: "INV",
        suffix: "",
        startingNumber: 1,
        numberPadding: 4,
      },
      email: {
        smtpServer: "",
        port: 587,
        username: "",
        password: "",
        useSslTls: true,
        fromEmailAddress: "",
      },
      taxation: {
        taxName: "VAT",
        taxCode: "VAT001",
        taxRate: 5.0,
        effectiveFrom: new Date().toISOString().split("T")[0],
        taxType: "VAT",
        taxApplicability: ["UAE"],
        status: "Active",
        description: "",
      },
      security: {
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        twoFactorEnabled: false,
        sessionTimeout: 30,
      },
      preferences: {
        theme: "light",
        language: "en",
        dateFormat: "DD/MM/YYYY",
        timeFormat: "24h",
        timezone: "Asia/Dubai",
        notifications: {
          email: true,
          push: true,
          sms: false,
        },
      },
    },
    uiState: {
      showPassword: false,
      showCurrentPassword: false,
      showNewPassword: false,
      showConfirmPassword: false,
      loading: false,
      sectionLoading: {},
      profileData: null,
      showToast: { visible: false, message: "", type: "success" },
      errors: {},
      expandedSections: {
        company: true,
        bank: false,
        currency: false,
        numbering: false,
        email: false,
        taxation: false,
        security: false,
        preferences: false,
      },
      showPasswordModal: false,
      passwordStrength: 0,
      isDirty: false,
    },
  });

  const { settings, uiState } = state;

  // Static configuration data
  const staticData = useMemo(
    () => ({
      sections: [
        {
          id: "company",
          label: "Company Details",
          icon: Building,
          color: "blue",
          description: "Manage your company information and branding",
        },
        {
          id: "bank",
          label: "Bank Details",
          icon: Calculator,
          color: "indigo",
          description: "Configure banking and payment information",
        },
        {
          id: "currency",
          label: "Currency Settings",
          icon: DollarSign,
          color: "green",
          description: "Set default currency and formatting",
        },
        {
          id: "numbering",
          label: "Document Numbering",
          icon: FileText,
          color: "purple",
          description: "Configure invoice and document numbering",
        },
        {
          id: "email",
          label: "Email Server",
          icon: Server,
          color: "orange",
          description: "SMTP settings for email notifications",
        },
        {
          id: "taxation",
          label: "Taxation Settings",
          icon: Calculator,
          color: "red",
          description: "Configure tax rates and applicability",
        },
        {
          id: "security",
          label: "Security & Password",
          icon: Lock,
          color: "gray",
          description: "Change password and security settings",
        },
        {
          id: "preferences",
          label: "User Preferences",
          icon: Palette,
          color: "pink",
          description: "Customize your application experience",
        },
      ],
      countries: [
        "United Arab Emirates",
        "United States",
        "United Kingdom",
        "Canada",
        "Australia",
        "Germany",
        "France",
        "Japan",
        "China",
        "India",
        "Saudi Arabia",
        "Singapore",
        "Qatar",
        "Bahrain",
        "Kuwait",
        "Oman",
      ],
      currencies: [
        { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
        { code: "USD", name: "US Dollar", symbol: "$" },
        { code: "EUR", name: "Euro", symbol: "€" },
        { code: "GBP", name: "British Pound", symbol: "£" },
        { code: "SAR", name: "Saudi Riyal", symbol: "﷼" },
        { code: "INR", name: "Indian Rupee", symbol: "₹" },
      ],
      documentTypes: [
        "Invoice",
        "Purchase Order",
        "Quotation",
        "Receipt",
        "Credit Note",
      ],
      taxTypes: ["VAT", "GST", "Sales Tax", "Service Tax"],
      uaeStates: [
        "Abu Dhabi",
        "Dubai",
        "Sharjah",
        "Ajman",
        "Fujairah",
        "Ras Al Khaimah",
        "Umm Al Quwain",
      ],
      themes: [
        {
          id: "light",
          name: "Light Theme",
          description: "Clean and bright interface",
        },
        {
          id: "dark",
          name: "Dark Theme",
          description: "Easy on the eyes for low light",
        },
        { id: "auto", name: "Auto", description: "Follow system preference" },
      ],
      languages: [
        { code: "en", name: "English" },
        { code: "ar", name: "Arabic" },
        { code: "fr", name: "French" },
        { code: "es", name: "Spanish" },
      ],
      dateFormats: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"],
      timeFormats: ["12h", "24h"],
      timezones: [
        "Asia/Dubai",
        "America/New_York",
        "Europe/London",
        "Asia/Tokyo",
        "Australia/Sydney",
        "Europe/Paris",
        "Asia/Kolkata",
      ],
    }),
    []
  );

  // Toast notification system
  const showToastMessage = useCallback((message, type = "success") => {
    setState((prev) => ({
      ...prev,
      uiState: {
        ...prev.uiState,
        showToast: { visible: true, message, type },
      },
    }));
    setTimeout(
      () =>
        setState((prev) => ({
          ...prev,
          uiState: {
            ...prev.uiState,
            showToast: { ...prev.uiState.showToast, visible: false },
          },
        })),
      4000
    );
  }, []);

  // Load profile data from backend
  const loadProfileData = useCallback(async () => {
    if (!adminId || !token) {
      showToastMessage("Authentication required", "error");
      return;
    }

    setState((prev) => ({
      ...prev,
      uiState: { ...prev.uiState, loading: true },
    }));

    try {
      const response = await axiosInstance.get("/profile/me");

      if (response.data.success) {
        const profileData = response.data.data;
        setState((prev) => ({
          ...prev,
          uiState: {
            ...prev.uiState,
            profileData: profileData,
            loading: false,
          },
          settings: {
            ...prev.settings,
            company: {
              ...prev.settings.company,
              companyName: profileData.companyInfo?.companyName || "",
              addressLine1: profileData.companyInfo?.addressLine1 || "",
              addressLine2: profileData.companyInfo?.addressLine2 || "",
              city: profileData.companyInfo?.city || "",
              stateProvince: profileData.companyInfo?.state || "",
              country:
                profileData.companyInfo?.country || "United Arab Emirates",
              postalCode: profileData.companyInfo?.postalCode || "",
              phoneNumber: profileData.companyInfo?.phoneNumber || "",
              email:
                profileData.companyInfo?.emailAddress ||
                profileData.email ||
                "",
              website: profileData.companyInfo?.website || "",
              logo: profileData.companyInfo?.companyLogo?.url || null,
            },
            bank: {
              ...prev.settings.bank,
              bankName: profileData.companyInfo?.bankDetails?.bankName || "",
              accountNumber:
                profileData.companyInfo?.bankDetails?.accountNumber || "",
              accountName:
                profileData.companyInfo?.bankDetails?.accountName || "",
              ibanNumber:
                profileData.companyInfo?.bankDetails?.ibanNumber || "",
              currency: profileData.companyInfo?.bankDetails?.currency || "AED",
            },
          },
        }));

        showToastMessage("Profile data loaded successfully", "success");
      }
    } catch (error) {
      console.error("Failed to load profile data:", error);
      showToastMessage(
        `Failed to load profile data: ${
          error.response?.data?.message || error.message
        }`,
        "error"
      );
      setState((prev) => ({
        ...prev,
        uiState: { ...prev.uiState, loading: false },
      }));
    }
  }, [adminId, token, showToastMessage]);

  // Load data on component mount
  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Handle input changes
  const handleInputChange = useCallback((section, field, value) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [section]: { ...prev.settings[section], [field]: value },
      },
      uiState: {
        ...prev.uiState,
        errors: { ...prev.uiState.errors, [field]: null },
        isDirty: true,
      },
    }));
  }, []);

  // Toggle section expansion
  const toggleSection = useCallback((sectionId) => {
    setState((prev) => ({
      ...prev,
      uiState: {
        ...prev.uiState,
        expandedSections: {
          ...prev.uiState.expandedSections,
          [sectionId]: !prev.uiState.expandedSections[sectionId],
        },
      },
    }));
  }, []);

  // Validate form data
  const validateSettings = useCallback(() => {
    const newErrors = {};
    const { company, security } = settings;

    // Company validation
    if (!company.companyName.trim())
      newErrors.companyName = "Company name is required";
    if (!company.addressLine1.trim())
      newErrors.addressLine1 = "Address is required";
    if (!company.city.trim()) newErrors.city = "City is required";
    if (!company.stateProvince.trim())
      newErrors.stateProvince = "State/Province is required";

    if (
      company.email &&
      !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(company.email)
    ) {
      newErrors.email = "Please enter a valid email";
    }

    // Security validation (if password change is attempted)
    if (
      security.currentPassword ||
      security.newPassword ||
      security.confirmPassword
    ) {
      if (!security.currentPassword)
        newErrors.currentPassword = "Current password is required";
      if (!security.newPassword)
        newErrors.newPassword = "New password is required";
      if (security.newPassword.length < 6)
        newErrors.newPassword = "Password must be at least 6 characters";
      if (security.newPassword !== security.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    setState((prev) => ({
      ...prev,
      uiState: { ...prev.uiState, errors: newErrors },
    }));
    return Object.keys(newErrors).length === 0;
  }, [settings]);

  // Save all settings
  const handleSave = useCallback(async () => {
    if (!validateSettings()) {
      showToastMessage("Please fix validation errors", "error");
      return;
    }

    setState((prev) => ({
      ...prev,
      uiState: { ...prev.uiState, loading: true },
    }));

    try {
      const formData = new FormData();

      const companyInfo = {
        companyName: settings.company.companyName,
        addressLine1: settings.company.addressLine1,
        addressLine2: settings.company.addressLine2,
        city: settings.company.city,
        state: settings.company.stateProvince,
        country: settings.company.country,
        postalCode: settings.company.postalCode,
        phoneNumber: settings.company.phoneNumber,
        emailAddress: settings.company.email,
        website: settings.company.website,
        bankDetails: settings.bank,
      };

      formData.append("companyInfo", JSON.stringify(companyInfo));

      if (settings.company.logoFile) {
        formData.append("companyLogo", settings.company.logoFile);
      }

      const response = await axiosInstance.put("/profile/me", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        showToastMessage("Settings saved successfully!", "success");
        setState((prev) => ({
          ...prev,
          uiState: { ...prev.uiState, isDirty: false },
        }));
        await loadProfileData();
      } else {
        throw new Error(response.data.message || "Failed to save settings");
      }
    } catch (error) {
      console.error("Save error:", error);
      showToastMessage(
        `Error saving settings: ${
          error.response?.data?.message || error.message
        }`,
        "error"
      );
    } finally {
      setState((prev) => ({
        ...prev,
        uiState: { ...prev.uiState, loading: false },
      }));
    }
  }, [settings, loadProfileData, showToastMessage, validateSettings]);

  // Change password
  const handlePasswordChange = useCallback(async () => {
    const { currentPassword, newPassword, confirmPassword } = settings.security;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToastMessage("All password fields are required", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToastMessage("New passwords do not match", "error");
      return;
    }

    if (newPassword.length < 6) {
      showToastMessage("Password must be at least 6 characters long", "error");
      return;
    }

    setState((prev) => ({
      ...prev,
      uiState: { ...prev.uiState, loading: true },
    }));

    try {
      const response = await axiosInstance.put(
        "/profile/change-password",
        {
          currentPassword,
          newPassword,
        }
      );

      if (response.data.success) {
        showToastMessage("Password changed successfully!", "success");

        // Clear password fields
        setState((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            security: {
              ...prev.settings.security,
              currentPassword: "",
              newPassword: "",
              confirmPassword: "",
            },
          },
          uiState: {
            ...prev.uiState,
            showPasswordModal: false,
            showCurrentPassword: false,
            showNewPassword: false,
            showConfirmPassword: false,
          },
        }));
      }
    } catch (error) {
      console.error("Password change error:", error);
      showToastMessage(
        `Failed to change password: ${
          error.response?.data?.message || error.message
        }`,
        "error"
      );
    } finally {
      setState((prev) => ({
        ...prev,
        uiState: { ...prev.uiState, loading: false },
      }));
    }
  }, [settings.security, showToastMessage]);

  // Reset settings to last saved state
  const handleReset = useCallback(() => {
    loadProfileData();
    setState((prev) => ({
      ...prev,
      uiState: { ...prev.uiState, isDirty: false },
    }));
    showToastMessage("Settings reset to saved values!", "info");
  }, [loadProfileData, showToastMessage]);

  // Handle logo upload
  const handleLogoUpload = useCallback(
    (event) => {
      const file = event.target.files[0];
      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          showToastMessage("File size must be less than 5MB", "error");
          return;
        }
        if (!file.type.startsWith("image/")) {
          showToastMessage("Please select an image file", "error");
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          setState((prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              company: {
                ...prev.settings.company,
                logo: e.target.result,
                logoFile: file,
              },
            },
            uiState: { ...prev.uiState, isDirty: true },
          }));
        };
        reader.readAsDataURL(file);
      }
    },
    [showToastMessage]
  );

  // Remove logo
  const handleLogoRemove = useCallback(() => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        company: {
          ...prev.settings.company,
          logo: null,
          logoFile: null,
        },
      },
      uiState: { ...prev.uiState, isDirty: true },
    }));
  }, []);

  // Calculate password strength
  const calculatePasswordStrength = useCallback((password) => {
    let strength = 0;
    if (password.length >= 6) strength += 25;
    if (password.length >= 10) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password))
      strength += 25;
    return strength;
  }, []);

  // Update password strength when new password changes
  useEffect(() => {
    const strength = calculatePasswordStrength(settings.security.newPassword);
    setState((prev) => ({
      ...prev,
      uiState: { ...prev.uiState, passwordStrength: strength },
    }));
  }, [settings.security.newPassword, calculatePasswordStrength]);

  // Reusable components
  const SectionCard = useCallback(
    ({ section, children }) => {
      const isExpanded = uiState.expandedSections[section.id];
      const isLoading = uiState.sectionLoading[section.id];
      const IconComponent = section.icon;

      return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-xl">
          <div
            className={`p-6 cursor-pointer bg-gradient-to-r from-${section.color}-50 to-${section.color}-100 hover:from-${section.color}-100 hover:to-${section.color}-200 transition-all duration-300`}
            onClick={() => toggleSection(section.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div
                  className={`p-3 bg-${section.color}-500 text-white rounded-xl shadow-lg`}
                >
                  <IconComponent size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {section.label}
                  </h3>
                  <p className="text-gray-600 text-sm">{section.description}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {section.id === "company" && uiState.isDirty && (
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                )}
                <div
                  className={`transition-transform duration-300 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                >
                  <ChevronRight size={20} className="text-gray-400" />
                </div>
              </div>
            </div>
          </div>
          {isExpanded && (
            <div className="p-6 border-t border-gray-100">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
                  <span className="ml-2 text-gray-600">Loading...</span>
                </div>
              ) : (
                children
              )}
            </div>
          )}
        </div>
      );
    },
    [
      uiState.expandedSections,
      uiState.sectionLoading,
      uiState.isDirty,
      toggleSection,
    ]
  );

  const InputField = useCallback(
    ({ label, icon: Icon, error, children, required = false, description }) => (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          {Icon && <Icon size={16} className="inline mr-2" />}
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {description && <p className="text-xs text-gray-500">{description}</p>}
        {children}
        {error && (
          <div className="flex items-center mt-1 text-red-600 text-sm">
            <AlertCircle size={14} className="mr-1" />
            {error}
          </div>
        )}
      </div>
    ),
    []
  );

  // Password Modal Component
  const PasswordModal = useCallback(() => {
    if (!uiState.showPasswordModal) return null;

    return (
      <div className="fixed inset-0 bg-white/50 bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gray-500 text-white rounded-xl">
                <Lock size={20} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">
                Change Password
              </h3>
            </div>
            <button
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  uiState: { ...prev.uiState, showPasswordModal: false },
                }))
              }
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          <div className="space-y-4">
            <InputField
              label="Current Password"
              icon={Key}
              required
              error={uiState.errors.currentPassword}
            >
              <div className="relative">
                <input
                  type={uiState.showCurrentPassword ? "text" : "password"}
                  value={settings.security.currentPassword}
                  onChange={(e) =>
                    handleInputChange(
                      "security",
                      "currentPassword",
                      e.target.value
                    )
                  }
                  className={`w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all duration-300 ${
                    uiState.errors.currentPassword
                      ? "border-red-300"
                      : "border-gray-300"
                  }`}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      uiState: {
                        ...prev.uiState,
                        showCurrentPassword: !prev.uiState.showCurrentPassword,
                      },
                    }))
                  }
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {uiState.showCurrentPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </InputField>

            <InputField
              label="New Password"
              icon={Lock}
              required
              error={uiState.errors.newPassword}
              description="Password should be at least 6 characters long"
            >
              <div className="relative">
                <input
                  type={uiState.showNewPassword ? "text" : "password"}
                  value={settings.security.newPassword}
                  onChange={(e) =>
                    handleInputChange("security", "newPassword", e.target.value)
                  }
                  className={`w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all duration-300 ${
                    uiState.errors.newPassword
                      ? "border-red-300"
                      : "border-gray-300"
                  }`}
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      uiState: {
                        ...prev.uiState,
                        showNewPassword: !prev.uiState.showNewPassword,
                      },
                    }))
                  }
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {uiState.showNewPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {settings.security.newPassword && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Password Strength</span>
                    <span>{uiState.passwordStrength}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        uiState.passwordStrength < 50
                          ? "bg-red-500"
                          : uiState.passwordStrength < 75
                          ? "bg-yellow-500"
                          : "bg-green-500"
                      }`}
                      style={{ width: `${uiState.passwordStrength}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </InputField>

            <InputField
              label="Confirm New Password"
              icon={Shield}
              required
              error={uiState.errors.confirmPassword}
            >
              <div className="relative">
                <input
                  type={uiState.showConfirmPassword ? "text" : "password"}
                  value={settings.security.confirmPassword}
                  onChange={(e) =>
                    handleInputChange(
                      "security",
                      "confirmPassword",
                      e.target.value
                    )
                  }
                  className={`w-full px-4 py-3 pr-12 border rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all duration-300 ${
                    uiState.errors.confirmPassword
                      ? "border-red-300"
                      : "border-gray-300"
                  }`}
                  placeholder="Confirm new password"
                />
                <button
                  type="button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      uiState: {
                        ...prev.uiState,
                        showConfirmPassword: !prev.uiState.showConfirmPassword,
                      },
                    }))
                  }
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {uiState.showConfirmPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </InputField>
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={handlePasswordChange}
              disabled={uiState.loading}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uiState.loading ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <Key size={18} />
              )}
              <span>{uiState.loading ? "Changing..." : "Change Password"}</span>
            </button>
            <button
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  uiState: { ...prev.uiState, showPasswordModal: false },
                  settings: {
                    ...prev.settings,
                    security: {
                      ...prev.settings.security,
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    },
                  },
                }))
              }
              className="px-4 py-3 text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    uiState.showPasswordModal,
    uiState.errors,
    uiState.showCurrentPassword,
    uiState.showNewPassword,
    uiState.showConfirmPassword,
    uiState.loading,
    uiState.passwordStrength,
    settings.security,
    handleInputChange,
    handlePasswordChange,
  ]);

  // Loading state
  if (uiState.loading && !uiState.profileData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg">
          <div className="flex items-center space-x-4">
            <Loader2 className="animate-spin h-12 w-12 text-indigo-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Loading Settings
              </h3>
              <p className="text-gray-600">
                Please wait while we fetch your data...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-4 bg-white rounded-2xl shadow-lg">
              <Settings size={32} className="text-indigo-600" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Settings</h1>
              <p className="text-gray-600 mt-1">
                Configure your ERP system preferences
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {uiState.isDirty && (
              <div className="flex items-center space-x-2 px-4 py-2 bg-orange-100 border border-orange-200 rounded-xl text-orange-800">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">Unsaved Changes</span>
              </div>
            )}

            <button
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  uiState: { ...prev.uiState, showPasswordModal: true },
                }))
              }
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              <Lock size={18} />
              <span>Change Password</span>
            </button>

            <button
              onClick={handleReset}
              disabled={uiState.loading || !uiState.isDirty}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={18} />
              <span>Reset Changes</span>
            </button>

            <button
              onClick={handleSave}
              disabled={uiState.loading || !uiState.isDirty}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uiState.loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-500 text-white rounded-xl">
                <Building size={20} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Company</h3>
                <p className="text-xl font-bold text-gray-900">
                  {settings.company.companyName || "Not Set"}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-green-100">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-500 text-white rounded-xl">
                <DollarSign size={20} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Currency</h3>
                <p className="text-xl font-bold text-gray-900">
                  {settings.currency.defaultCurrency} (
                  {settings.currency.currencySymbol})
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-purple-100">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-500 text-white rounded-xl">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">
                  Document Format
                </h3>
                <p className="text-xl font-bold text-gray-900">
                  {settings.numbering.prefix}
                  {settings.numbering.startingNumber
                    .toString()
                    .padStart(settings.numbering.numberPadding, "0")}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg border border-red-100">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-red-500 text-white rounded-xl">
                <Calculator size={20} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-600">Tax Rate</h3>
                <p className="text-xl font-bold text-gray-900">
                  {settings.taxation.taxRate}% {settings.taxation.taxName}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {uiState.showToast.visible && (
        <div
          className={`fixed top-4 right-4 p-4 rounded-xl shadow-lg text-white z-50 transform transition-all duration-300 ${
            uiState.showToast.type === "success"
              ? "bg-green-500"
              : uiState.showToast.type === "error"
              ? "bg-red-500"
              : uiState.showToast.type === "info"
              ? "bg-blue-500"
              : "bg-gray-500"
          }`}
        >
          <div className="flex items-center space-x-2">
            {uiState.showToast.type === "success" && <CheckCircle size={20} />}
            {uiState.showToast.type === "error" && <XCircle size={20} />}
            {uiState.showToast.type === "info" && <AlertCircle size={20} />}
            <span>{uiState.showToast.message}</span>
          </div>
        </div>
      )}

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Company Details Section */}
        <SectionCard section={staticData.sections[0]}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField
              label="Company Name"
              icon={Building}
              required
              error={uiState.errors.companyName}
            >
              <input
                type="text"
                value={settings.company.companyName}
                onChange={(e) =>
                  handleInputChange("company", "companyName", e.target.value)
                }
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${
                  uiState.errors.companyName
                    ? "border-red-300"
                    : "border-gray-300"
                }`}
                placeholder="Enter your company name"
              />
            </InputField>

            <InputField
              label="Email Address"
              icon={Mail}
              error={uiState.errors.email}
            >
              <input
                type="email"
                value={settings.company.email}
                onChange={(e) =>
                  handleInputChange("company", "email", e.target.value)
                }
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${
                  uiState.errors.email ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="company@example.com"
              />
            </InputField>

            <InputField
              label="Address Line 1"
              icon={MapPin}
              required
              error={uiState.errors.addressLine1}
            >
              <input
                type="text"
                value={settings.company.addressLine1}
                onChange={(e) =>
                  handleInputChange("company", "addressLine1", e.target.value)
                }
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${
                  uiState.errors.addressLine1
                    ? "border-red-300"
                    : "border-gray-300"
                }`}
                placeholder="Street address"
              />
            </InputField>

            <InputField
              label="Address Line 2"
              error={uiState.errors.addressLine2}
            >
              <input
                type="text"
                value={settings.company.addressLine2}
                onChange={(e) =>
                  handleInputChange("company", "addressLine2", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                placeholder="Apartment, suite, etc. (optional)"
              />
            </InputField>

            <InputField label="City" required error={uiState.errors.city}>
              <input
                type="text"
                value={settings.company.city}
                onChange={(e) =>
                  handleInputChange("company", "city", e.target.value)
                }
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${
                  uiState.errors.city ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="City name"
              />
            </InputField>

            <InputField
              label="State / Province"
              required
              error={uiState.errors.stateProvince}
            >
              <input
                type="text"
                value={settings.company.stateProvince}
                onChange={(e) =>
                  handleInputChange("company", "stateProvince", e.target.value)
                }
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${
                  uiState.errors.stateProvince
                    ? "border-red-300"
                    : "border-gray-300"
                }`}
                placeholder="State or Province"
              />
            </InputField>

            <InputField label="Country" required>
              <select
                value={settings.company.country}
                onChange={(e) =>
                  handleInputChange("company", "country", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
              >
                {staticData.countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </InputField>

            <InputField label="Postal Code">
              <input
                type="text"
                value={settings.company.postalCode}
                onChange={(e) =>
                  handleInputChange("company", "postalCode", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                placeholder="ZIP / Postal Code"
              />
            </InputField>

            <InputField
              label="Phone Number"
              icon={Phone}
              error={uiState.errors.phoneNumber}
            >
              <input
                type="tel"
                value={settings.company.phoneNumber}
                onChange={(e) =>
                  handleInputChange("company", "phoneNumber", e.target.value)
                }
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 ${
                  uiState.errors.phoneNumber
                    ? "border-red-300"
                    : "border-gray-300"
                }`}
                placeholder="+971 50 123 4567"
              />
            </InputField>

            <InputField label="Website" icon={Globe}>
              <input
                type="url"
                value={settings.company.website}
                onChange={(e) =>
                  handleInputChange("company", "website", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                placeholder="https://www.example.com"
              />
            </InputField>

            <div className="md:col-span-2">
              <InputField
                label="Company Logo"
                icon={Image}
                description="Upload your company logo. Recommended size: 300x300px. Max file size: 5MB."
              >
                <div className="space-y-4">
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
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-50 border border-blue-200 rounded-xl cursor-pointer hover:bg-blue-100 transition-all duration-300 text-blue-700"
                    >
                      <Upload size={18} />
                      <span>Choose Logo</span>
                    </label>

                    {settings.company.logo && (
                      <button
                        onClick={handleLogoRemove}
                        className="flex items-center space-x-2 px-6 py-3 bg-red-50 border border-red-200 rounded-xl cursor-pointer hover:bg-red-100 transition-all duration-300 text-red-700"
                      >
                        <Trash2 size={18} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {settings.company.logo && (
                    <div className="relative">
                      <div className="w-40 h-40 rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg bg-gray-50">
                        <img
                          src={settings.company.logo}
                          alt="Company Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </InputField>
            </div>
          </div>
        </SectionCard>

        {/* Bank Details Section */}
        <SectionCard section={staticData.sections[1]}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Bank Name">
              <input
                type="text"
                value={settings.bank.bankName}
                onChange={(e) =>
                  handleInputChange("bank", "bankName", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                placeholder="Enter bank name"
              />
            </InputField>

            <InputField label="Account Name">
              <input
                type="text"
                value={settings.bank.accountName}
                onChange={(e) =>
                  handleInputChange("bank", "accountName", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                placeholder="Account holder name"
              />
            </InputField>

            <InputField label="Account Number">
              <input
                type="text"
                value={settings.bank.accountNumber}
                onChange={(e) =>
                  handleInputChange("bank", "accountNumber", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                placeholder="Bank account number"
              />
            </InputField>

            <InputField label="IBAN Number">
              <input
                type="text"
                value={settings.bank.ibanNumber}
                onChange={(e) =>
                  handleInputChange("bank", "ibanNumber", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
                placeholder="International Bank Account Number"
              />
            </InputField>

            <InputField label="Bank Currency">
              <select
                value={settings.bank.currency}
                onChange={(e) =>
                  handleInputChange("bank", "currency", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
              >
                {staticData.currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            </InputField>
          </div>
        </SectionCard>

        {/* Currency Settings Section */}
        <SectionCard section={staticData.sections[2]}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <InputField label="Default Currency">
              <select
                value={settings.currency.defaultCurrency}
                onChange={(e) => {
                  const selectedCurrency = staticData.currencies.find(
                    (c) => c.code === e.target.value
                  );
                  handleInputChange(
                    "currency",
                    "defaultCurrency",
                    e.target.value
                  );
                  if (selectedCurrency) {
                    handleInputChange(
                      "currency",
                      "currencySymbol",
                      selectedCurrency.symbol
                    );
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300"
              >
                {staticData.currencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            </InputField>

            <InputField label="Currency Symbol">
              <input
                type="text"
                value={settings.currency.currencySymbol}
                onChange={(e) =>
                  handleInputChange(
                    "currency",
                    "currencySymbol",
                    e.target.value
                  )
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300"
                placeholder="$, €, £, etc."
              />
            </InputField>

            <InputField label="Decimal Places">
              <select
                value={settings.currency.decimalPlaces}
                onChange={(e) =>
                  handleInputChange(
                    "currency",
                    "decimalPlaces",
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-300"
              >
                <option value={0}>0 (No decimals)</option>
                <option value={1}>1 decimal place</option>
                <option value={2}>2 decimal places</option>
                <option value={3}>3 decimal places</option>
                <option value={4}>4 decimal places</option>
              </select>
            </InputField>
          </div>
        </SectionCard>

        {/* Document Numbering Section */}
        <SectionCard section={staticData.sections[3]}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InputField label="Document Type">
              <select
                value={settings.numbering.documentType}
                onChange={(e) =>
                  handleInputChange("numbering", "documentType", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
              >
                {staticData.documentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </InputField>

            <InputField label="Prefix">
              <input
                type="text"
                value={settings.numbering.prefix}
                onChange={(e) =>
                  handleInputChange("numbering", "prefix", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                placeholder="INV, PO, QT, etc."
              />
            </InputField>

            <InputField label="Suffix">
              <input
                type="text"
                value={settings.numbering.suffix}
                onChange={(e) =>
                  handleInputChange("numbering", "suffix", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                placeholder="Suffix (optional)"
              />
            </InputField>

            <InputField label="Starting Number">
              <input
                type="number"
                value={settings.numbering.startingNumber}
                onChange={(e) =>
                  handleInputChange(
                    "numbering",
                    "startingNumber",
                    parseInt(e.target.value) || 1
                  )
                }
                min="1"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
                placeholder="1"
              />
            </InputField>

            <InputField label="Number Padding">
              <select
                value={settings.numbering.numberPadding}
                onChange={(e) =>
                  handleInputChange(
                    "numbering",
                    "numberPadding",
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <option key={num} value={num}>
                    {num} digit{num > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </InputField>

            <InputField label="Preview">
              <div className="w-full px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-purple-800 font-mono text-center font-semibold">
                {settings.numbering.prefix}
                {settings.numbering.startingNumber
                  .toString()
                  .padStart(settings.numbering.numberPadding, "0")}
                {settings.numbering.suffix}
              </div>
            </InputField>
          </div>
        </SectionCard>

        {/* Email Server Section */}
        <SectionCard section={staticData.sections[4]}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="SMTP Server" icon={Server}>
              <input
                type="text"
                value={settings.email.smtpServer}
                onChange={(e) =>
                  handleInputChange("email", "smtpServer", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                placeholder="smtp.gmail.com"
              />
            </InputField>

            <InputField label="Port">
              <input
                type="number"
                value={settings.email.port}
                onChange={(e) =>
                  handleInputChange(
                    "email",
                    "port",
                    parseInt(e.target.value) || 587
                  )
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                placeholder="587"
              />
            </InputField>

            <InputField label="Username">
              <input
                type="text"
                value={settings.email.username}
                onChange={(e) =>
                  handleInputChange("email", "username", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                placeholder="your-email@example.com"
              />
            </InputField>

            <InputField label="Password">
              <div className="relative">
                <input
                  type={uiState.showPassword ? "text" : "password"}
                  value={settings.email.password}
                  onChange={(e) =>
                    handleInputChange("email", "password", e.target.value)
                  }
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                  placeholder="App password or email password"
                />
                <button
                  type="button"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      uiState: {
                        ...prev.uiState,
                        showPassword: !prev.uiState.showPassword,
                      },
                    }))
                  }
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {uiState.showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </InputField>

            <InputField label="From Email Address">
              <input
                type="email"
                value={settings.email.fromEmailAddress}
                onChange={(e) =>
                  handleInputChange("email", "fromEmailAddress", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all duration-300"
                placeholder="noreply@yourcompany.com"
              />
            </InputField>

            <InputField label="Security" icon={Shield}>
              <div className="flex items-center space-x-4 mt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.email.useSslTls}
                    onChange={(e) =>
                      handleInputChange("email", "useSslTls", e.target.checked)
                    }
                    className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">
                    Use SSL/TLS encryption
                  </span>
                </label>
              </div>
            </InputField>
          </div>
        </SectionCard>

        {/* Taxation Settings Section */}
        <SectionCard section={staticData.sections[5]}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InputField label="Tax Name">
              <input
                type="text"
                value={settings.taxation.taxName}
                onChange={(e) =>
                  handleInputChange("taxation", "taxName", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300"
                placeholder="VAT, GST, Sales Tax, etc."
              />
            </InputField>

            <InputField label="Tax Code">
              <input
                type="text"
                value={settings.taxation.taxCode}
                onChange={(e) =>
                  handleInputChange("taxation", "taxCode", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300"
                placeholder="VAT001, GST123, etc."
              />
            </InputField>

            <InputField label="Tax Rate (%)">
              <input
                type="number"
                value={settings.taxation.taxRate}
                onChange={(e) =>
                  handleInputChange(
                    "taxation",
                    "taxRate",
                    parseFloat(e.target.value) || 0
                  )
                }
                step="0.01"
                min="0"
                max="100"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300"
                placeholder="5.00"
              />
            </InputField>

            <InputField label="Effective From" icon={Calendar}>
              <input
                type="date"
                value={settings.taxation.effectiveFrom}
                onChange={(e) =>
                  handleInputChange("taxation", "effectiveFrom", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300"
              />
            </InputField>

            <InputField label="Tax Type">
              <select
                value={settings.taxation.taxType}
                onChange={(e) =>
                  handleInputChange("taxation", "taxType", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300"
              >
                {staticData.taxTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </InputField>

            <InputField label="Status">
              <select
                value={settings.taxation.status}
                onChange={(e) =>
                  handleInputChange("taxation", "status", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </InputField>

            <div className="lg:col-span-3">
              <InputField
                label="Tax Applicability"
                description="Select regions where this tax applies"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                  {staticData.uaeStates.map((state) => (
                    <label
                      key={state}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={settings.taxation.taxApplicability.includes(
                          state
                        )}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleInputChange("taxation", "taxApplicability", [
                              ...settings.taxation.taxApplicability,
                              state,
                            ]);
                          } else {
                            handleInputChange(
                              "taxation",
                              "taxApplicability",
                              settings.taxation.taxApplicability.filter(
                                (s) => s !== state
                              )
                            );
                          }
                        }}
                        className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">{state}</span>
                    </label>
                  ))}
                </div>
              </InputField>
            </div>

            <div className="lg:col-span-3">
              <InputField label="Description">
                <textarea
                  value={settings.taxation.description}
                  onChange={(e) =>
                    handleInputChange("taxation", "description", e.target.value)
                  }
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-300 resize-none"
                  placeholder="Brief description of this tax configuration..."
                />
              </InputField>
            </div>
          </div>
        </SectionCard>

        {/* Security Section */}
        <SectionCard section={staticData.sections[6]}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-gray-500 text-white rounded-lg">
                  <Lock size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    Password Security
                  </h4>
                  <p className="text-sm text-gray-600">
                    Manage your account password
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    uiState: { ...prev.uiState, showPasswordModal: true },
                  }))
                }
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300"
              >
                <Key size={18} />
                <span>Change Password</span>
              </button>
            </div>

            <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-blue-500 text-white rounded-lg">
                  <Shield size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    Two-Factor Authentication
                  </h4>
                  <p className="text-sm text-gray-600">
                    Extra security for your account
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Enable 2FA
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.security.twoFactorEnabled}
                    onChange={(e) =>
                      handleInputChange(
                        "security",
                        "twoFactorEnabled",
                        e.target.checked
                      )
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>

            <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-orange-500 text-white rounded-lg">
                  <Clock size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">
                    Session Timeout
                  </h4>
                  <p className="text-sm text-gray-600">
                    Auto-logout after inactivity
                  </p>
                </div>
              </div>
              <select
                value={settings.security.sessionTimeout}
                onChange={(e) =>
                  handleInputChange(
                    "security",
                    "sessionTimeout",
                    parseInt(e.target.value)
                  )
                }
                className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={240}>4 hours</option>
                <option value={480}>8 hours</option>
              </select>
            </div>
          </div>
        </SectionCard>

        {/* Preferences Section */}
        <SectionCard section={staticData.sections[7]}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <InputField label="Theme" icon={Palette}>
              <div className="space-y-2">
                {staticData.themes.map((theme) => (
                  <label
                    key={theme.id}
                    className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-pink-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={theme.id}
                      checked={settings.preferences.theme === theme.id}
                      onChange={(e) =>
                        handleInputChange(
                          "preferences",
                          "theme",
                          e.target.value
                        )
                      }
                      className="w-4 h-4 text-pink-600 border-gray-300 focus:ring-pink-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900">
                        {theme.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {theme.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </InputField>

            <InputField label="Language" icon={Globe}>
              <select
                value={settings.preferences.language}
                onChange={(e) =>
                  handleInputChange("preferences", "language", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-300"
              >
                {staticData.languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </InputField>

            <InputField label="Timezone" icon={Clock}>
              <select
                value={settings.preferences.timezone}
                onChange={(e) =>
                  handleInputChange("preferences", "timezone", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-300"
              >
                {staticData.timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace("_", " ")}
                  </option>
                ))}
              </select>
            </InputField>

            <InputField label="Date Format" icon={Calendar}>
              <select
                value={settings.preferences.dateFormat}
                onChange={(e) =>
                  handleInputChange("preferences", "dateFormat", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-300"
              >
                {staticData.dateFormats.map((format) => (
                  <option key={format} value={format}>
                    {format} -{" "}
                    {new Date()
                      .toLocaleDateString("en-GB", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                      .split("/")
                      .join(format.includes("/") ? "/" : "-")}
                  </option>
                ))}
              </select>
            </InputField>

            <InputField label="Time Format" icon={Clock}>
              <select
                value={settings.preferences.timeFormat}
                onChange={(e) =>
                  handleInputChange("preferences", "timeFormat", e.target.value)
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-300"
              >
                {staticData.timeFormats.map((format) => (
                  <option key={format} value={format}>
                    {format === "12h" ? "12 Hour (1:30 PM)" : "24 Hour (13:30)"}
                  </option>
                ))}
              </select>
            </InputField>

            <div className="lg:col-span-3">
              <InputField label="Notification Preferences" icon={Bell}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-pink-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <Mail size={20} className="text-blue-500" />
                      <span className="font-medium text-gray-900">
                        Email Notifications
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.preferences.notifications.email}
                      onChange={(e) =>
                        handleInputChange("preferences", "notifications", {
                          ...settings.preferences.notifications,
                          email: e.target.checked,
                        })
                      }
                      className="w-5 h-5 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-pink-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <Bell size={20} className="text-green-500" />
                      <span className="font-medium text-gray-900">
                        Push Notifications
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.preferences.notifications.push}
                      onChange={(e) =>
                        handleInputChange("preferences", "notifications", {
                          ...settings.preferences.notifications,
                          push: e.target.checked,
                        })
                      }
                      className="w-5 h-5 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-pink-50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <Phone size={20} className="text-orange-500" />
                      <span className="font-medium text-gray-900">
                        SMS Notifications
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.preferences.notifications.sms}
                      onChange={(e) =>
                        handleInputChange("preferences", "notifications", {
                          ...settings.preferences.notifications,
                          sms: e.target.checked,
                        })
                      }
                      className="w-5 h-5 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                    />
                  </label>
                </div>
              </InputField>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Password Modal */}
      <PasswordModal />

      {/* Bottom Spacing */}
      <div className="h-8"></div>
    </div>
  );
};

export default SettingsModule;
