import React from "react";

export const FormInput = ({
  label,
  icon: Icon,
  type = "text",
  name,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  className = "",
  ...props
}) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      {Icon && <Icon size={16} className="inline mr-2" />} {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`w-full px-4 py-3 border ${
        error ? "border-red-500" : "border-gray-200"
      } rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${className}`}
      {...props}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

export const FormSelect = ({
  label,
  icon: Icon,
  name,
  value,
  onChange,
  error,
  options = [],
  required = false,
}) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      {Icon && <Icon size={16} className="inline mr-2" />} {label}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className={`w-full px-4 py-3 border ${
        error ? "border-red-500" : "border-gray-200"
      } rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

export const StatCard = ({
  title,
  count,
  icon,
  bgColor = "bg-gray-50",
  textColor = "text-gray-700",
  borderColor = "border-gray-200",
  iconBg = "bg-gray-100",
  iconColor = "text-gray-600",
  subText,
}) => (
  <div
    className={`p-6 rounded-2xl ${bgColor} border ${borderColor} shadow-sm hover:shadow-md transition-all duration-200 flex items-center space-x-4`}
  >
    <div className={`p-3 ${iconBg} rounded-xl ${iconColor}`}>{icon}</div>
    <div>
      <p className={`text-sm font-semibold ${textColor}`}>{title}</p>
      <p className={`text-2xl font-bold ${textColor}`}>{count}</p>
      {subText && <p className="text-xs text-gray-500">{subText}</p>}
    </div>
  </div>
);

export const Toast = ({ show, message, type = "success" }) => {
  if (!show) return null;
  return (
    <div
      className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg flex items-center space-x-2 transition-all duration-300 ${
        type === "success"
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {type === "success" ? (
        <CheckCircle size={20} />
      ) : (
        <AlertCircle size={20} />
      )}
      <span>{message}</span>
    </div>
  );
};