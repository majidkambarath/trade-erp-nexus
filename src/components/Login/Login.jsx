import React, { useState, useEffect } from "react";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Zap,
  Building2,
  CheckCircle,
  Smartphone,
  Monitor,
  Globe,
  Layers,
  LayoutDashboard,
  TrendingUp,
  Users,
  Package,
  DollarSign,
  BarChart3,
  Settings,
  Activity,
  AlertCircle,
  X,
} from "lucide-react";
import axiosInstance from "../../axios/axios";

const ERPLogin = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const features = [
    {
      icon: <LayoutDashboard className="w-8 h-8" />,
      title: "Comprehensive Dashboard",
      description: "Real-time insights at your fingertips",
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Advanced Analytics",
      description: "Data-driven decision making",
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Team Collaboration",
      description: "Seamless workflow management",
    },
    {
      icon: <Package className="w-8 h-8" />,
      title: "Inventory Control",
      description: "Smart stock management",
    },
    {
      icon: <DollarSign className="w-8 h-8" />,
      title: "Financial Tracking",
      description: "Complete financial oversight",
    },
    {
      icon: <Settings className="w-8 h-8" />,
      title: "Customizable Solutions",
      description: "Tailored to your business needs",
    },
  ];

  const stats = [
    { number: "50K+", label: "Active Users" },
    { number: "99.9%", label: "Uptime" },
    { number: "24/7", label: "Support" },
  ];

  // Token management functions
  const storeTokens = (tokens, data, adminData, rememberMe = false) => {
    const storage = rememberMe ? localStorage : sessionStorage;

    try {
      storage.setItem("accessToken", tokens.accessToken);
      storage.setItem("refreshToken", tokens.refreshToken);
      storage.setItem("adminId", data._id);
      storage.setItem("tokenExpiry", tokens.expiresIn);
      //   storage.setItem('adminData', JSON.stringify(adminData));
      storage.setItem("loginTime", new Date().toISOString());
      storage.setItem("rememberMe", rememberMe.toString());

      // Set up axios default authorization header
      axiosInstance.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${tokens.accessToken}`;

      console.log("Tokens stored successfully");
    } catch (error) {
      console.error("Error storing tokens:", error);
    }
  };

  const getStoredToken = () => {
    return (
      localStorage.getItem("accessToken") ||
      sessionStorage.getItem("accessToken")
    );
  };

  const getStoredRefreshToken = () => {
    return (
      localStorage.getItem("refreshToken") ||
      sessionStorage.getItem("refreshToken")
    );
  };

  //   const getStoredAdminData = () => {
  //     try {
  //       const adminData = localStorage.getItem('adminData') || sessionStorage.getItem('adminData');
  //       return adminData ? JSON.parse(adminData) : null;
  //     } catch (error) {
  //       console.error('Error parsing admin data:', error);
  //       return null;
  //     }
  //   };

  const clearTokens = () => {
    // Clear from both storages
    const items = [
      "accessToken",
      "refreshToken",
      "tokenExpiry",
      "adminData",
      "loginTime",
      "rememberMe",
    ];

    items.forEach((item) => {
      localStorage.removeItem(item);
      sessionStorage.removeItem(item);
    });

    // Remove authorization header
    delete axiosInstance.defaults.headers.common["Authorization"];

    console.log("Tokens cleared");
  };

  // Initialize axios with stored token on component mount
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      axiosInstance.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${token}`;
    }
  }, []);

  // Refresh token function
  const refreshAccessToken = async () => {
    try {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      console.log("Attempting to refresh token...");

      const response = await axiosInstance.post("/auth/refresh", {
        refreshToken: refreshToken,
      });

      if (response.data.success && response.data.data.tokens) {
        const { tokens, admin, data } = response.data.data;
        const rememberMe = localStorage.getItem("rememberMe") === "true";

        // Update stored tokens
        storeTokens(tokens, data, admin || rememberMe);

        console.log("Token refreshed successfully");
        return tokens.accessToken;
      } else {
        throw new Error("Invalid refresh response");
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
      clearTokens();
      setError("Session expired. Please login again.");
      return null;
    }
  };

  // Axios interceptor for handling token refresh
  useEffect(() => {
    const requestInterceptor = axiosInstance.interceptors.request.use(
      (config) => {
        const token = getStoredToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    const responseInterceptor = axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const newToken = await refreshAccessToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axiosInstance(originalRequest);
          } else {
            // Redirect to login or handle logout
            clearTokens();
            window.location.reload();
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axiosInstance.interceptors.request.eject(requestInterceptor);
      axiosInstance.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  // Feature carousel effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [features.length]);

  // Mouse position tracking
  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError("Email is required");
      return false;
    }

    if (!formData.password.trim()) {
      setError("Password is required");
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Please enter a valid email address");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      console.log("Attempting login with:", { email: formData.email });

      const response = await axiosInstance.post("/login", {
        email: formData.email.trim(),
        password: formData.password,
      });

      console.log("Login response:", response.data);

      if (response.data.success) {
        const { admin, tokens, loginInfo } = response.data.data;

        // Store tokens and user data
        storeTokens(tokens, admin, formData.rememberMe);

        setSuccess(`Welcome back, ${admin.name}!`);

        // Log successful login
        console.log("Login successful:", {
          user: admin.name,
          email: admin.email,
          lastLogin: loginInfo.lastLogin,
          permissions: admin.permissions,
        });

        // Redirect to dashboard after short delay
        setTimeout(() => {
          // Replace this with your routing logic
          window.location.href = "/dashboard";
          // or if using React Router: navigate('/dashboard');
        }, 1500);
      } else {
        setError(response.data.message || "Login failed. Please try again.");
      }
    } catch (error) {
      console.error("Login error:", error);

      let errorMessage = "Login failed. Please try again.";

      if (error.response) {
        // Server responded with error status
        errorMessage =
          error.response.data?.message || `Error: ${error.response.status}`;
      } else if (error.request) {
        // Network error
        errorMessage =
          "Unable to connect to server. Please check your connection.";
      } else {
        // Other error
        errorMessage = error.message || "An unexpected error occurred.";
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const dismissMessage = () => {
    setError("");
    setSuccess("");
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gray-200/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gray-300/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gray-100/30 rounded-full blur-2xl animate-pulse"></div>
      </div>

      {/* Floating Icons Animation */}
      <div className="absolute inset-0 pointer-events-none">
        {[
          { icon: <Activity className="w-4 h-4" />, top: "10%", left: "10%" },
          { icon: <BarChart3 className="w-5 h-5" />, top: "20%", right: "15%" },
          { icon: <Globe className="w-4 h-4" />, bottom: "25%", left: "8%" },
          { icon: <Layers className="w-5 h-5" />, bottom: "15%", right: "12%" },
          { icon: <Shield className="w-4 h-4" />, top: "40%", left: "5%" },
          { icon: <Zap className="w-5 h-5" />, top: "60%", right: "8%" },
        ].map((item, index) => (
          <div
            key={index}
            className="absolute text-gray-400/30 animate-bounce"
            style={{
              top: item.top,
              left: item.left,
              right: item.right,
              bottom: item.bottom,
              animationDelay: `${index * 0.5}s`,
              animationDuration: "3s",
            }}
          >
            {item.icon}
          </div>
        ))}
      </div>

      {/* Mouse Follower */}
      <div
        className="fixed w-96 h-96 bg-gray-200/10 rounded-full blur-3xl pointer-events-none transition-all duration-1000 ease-out"
        style={{
          left: mousePosition.x - 192,
          top: mousePosition.y - 192,
        }}
      ></div>

      {/* Error/Success Messages */}
      {(error || success) && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div
            className={`p-4 rounded-lg shadow-lg border ${
              error
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-green-50 border-green-200 text-green-800"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center">
                {error ? (
                  <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                ) : (
                  <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                )}
                <span className="text-sm font-medium">{error || success}</span>
              </div>
              <button
                onClick={dismissMessage}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="relative z-10 min-h-screen flex">
        {/* Left Side - Feature Showcase */}
        <div className="hidden lg:flex lg:w-1/2 pl-32 bg-gray-100/50 backdrop-blur-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-200/20 to-gray-300/20"></div>

          <div className="relative z-10 flex flex-col justify-center items-center p-12 text-center">
            {/* Logo and Branding */}
            <div className="mb-12">
              <div className="w-20 h-20 bg-gray-200 rounded-3xl flex items-center justify-center shadow-2xl mb-6 mx-auto transform hover:scale-110 transition-all duration-500">
                <Building2 className="w-10 h-10 text-gray-800" />
              </div>
              <h1 className="text-4xl font-bold text-gray-800 mb-4">
                ERP NEXUS
              </h1>
              <p className="text-xl text-gray-600 mb-8">Enterprise System</p>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-8 mb-12">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-3xl font-bold text-gray-800 mb-2">
                      {stat.number}
                    </div>
                    <div className="text-sm text-gray-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Feature Carousel */}
            <div className="w-full max-w-md">
              <div className="bg-gray-100/50 backdrop-blur-xl rounded-3xl p-8 border border-gray-200/50 shadow-2xl">
                <div className="flex items-center justify-center mb-6 text-gray-700">
                  {features[currentFeature].icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">
                  {features[currentFeature].title}
                </h3>
                <p className="text-gray-600">
                  {features[currentFeature].description}
                </p>
              </div>

              {/* Feature Indicators */}
              <div className="flex justify-center mt-8 space-x-2">
                {features.map((_, index) => (
                  <div
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      index === currentFeature
                        ? "bg-gray-600 w-8"
                        : "bg-gray-300"
                    }`}
                  ></div>
                ))}
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 flex items-center space-x-8">
              {[
                { icon: <Shield className="w-6 h-6" />, text: "Secure" },
                { icon: <Monitor className="w-6 h-6" />, text: "Reliable" },
                {
                  icon: <Smartphone className="w-6 h-6" />,
                  text: "Mobile Ready",
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 text-gray-600"
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
          {/* Mobile Logo */}
          <div className="lg:hidden absolute top-8 left-1/2 transform -translate-x-1/2">
            <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <Building2 className="w-8 h-8 text-gray-800" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-800">ERP NEXUS</h1>
              <p className="text-gray-600">Enterprise System</p>
            </div>
          </div>

          <div className="w-full max-w-md mt-24 lg:mt-0">
            {/* Welcome Message */}
            <div className="text-center mb-8">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
                Welcome Back
              </h2>
              <p className="text-gray-600">
                Sign in to access your ERP dashboard
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
                  </div>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    className="w-full pl-12 pr-4 py-4 bg-gray-100/50 backdrop-blur-xl border border-gray-200/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent transition-all duration-300 text-gray-800 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-gray-600 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    className="w-full pl-12 pr-12 py-4 bg-gray-100/50 backdrop-blur-xl border border-gray-200/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent transition-all duration-300 text-gray-800 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors disabled:cursor-not-allowed"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    className="w-4 h-4 text-gray-600 bg-gray-100 border-gray-300 rounded focus:ring-gray-300 focus:ring-2 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm text-gray-700">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !formData.email || !formData.password}
                className="group w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-4 px-6 rounded-2xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                <div className="flex items-center justify-center space-x-2">
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>
            </form>

            {/* Divider */}
            <div className="my-8 flex items-center">
              <div className="flex-1 border-t border-gray-200"></div>
              <span className="px-4 text-sm text-gray-500">or</span>
              <div className="flex-1 border-t border-gray-200"></div>
            </div>

            {/* Alternative Login Options */}
            <div className="grid grid-cols-2 gap-4">
              <button className="group flex items-center justify-center px-4 py-3 bg-gray-100/50 backdrop-blur-xl border border-gray-200/50 rounded-xl hover:bg-gray-200/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-300">
                <div className="w-5 h-5 bg-gray-600 rounded mr-3"></div>
                <span className="text-sm font-medium text-gray-700">SSO</span>
              </button>
              <button className="group flex items-center justify-center px-4 py-3 bg-gray-100/50 backdrop-blur-xl border border-gray-200/50 rounded-xl hover:bg-gray-200/50 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-300">
                <Shield className="w-5 h-5 text-gray-600 mr-3" />
                <span className="text-sm font-medium text-gray-700">2FA</span>
              </button>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-gray-600">
              Don't have an account?{" "}
              <button className="text-gray-800 hover:text-gray-600 font-medium transition-colors">
                Contact Administrator
              </button>
            </div>

            {/* Trust Badge */}
            <div className="mt-6 flex items-center justify-center space-x-2 text-gray-500">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs">
                Secured with enterprise-grade encryption
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Version Info */}
      <div className="absolute bottom-4 left-4 text-xs text-gray-400">
        ERP NEXUS v2.4.1
      </div>

      <div className="absolute bottom-4 right-4 text-xs text-gray-400">
        © 2025 Enterprise System
      </div>
    </div>
  );
};

export default ERPLogin;
