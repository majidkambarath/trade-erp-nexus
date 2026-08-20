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
    <label className="mb-2 block text-sm font-semibold text-foreground">
      {Icon && <Icon size={16} className="mr-2 inline" />} {label}
      {required && <span className="ml-1 text-destructive">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`w-full rounded-full border px-4 py-3 transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-foreground/20 ${
        error ? "border-destructive" : "border-border bg-background"
      } ${className}`}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
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
    <label className="mb-2 block text-sm font-semibold text-foreground">
      {Icon && <Icon size={16} className="mr-2 inline" />} {label}
      {required && <span className="ml-1 text-destructive">*</span>}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      className={`w-full rounded-full border px-4 py-3 transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-foreground/20 ${
        error ? "border-destructive" : "border-border bg-background"
      }`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
  </div>
);

export const StatCard = ({
  title,
  count,
  icon,
  bgColor = "bg-secondary",
  textColor = "text-foreground",
  borderColor = "border-border",
  iconBg = "bg-card",
  iconColor = "text-foreground",
  subText,
}) => (
  <div
    className={`${bgColor} ${borderColor} cursor-pointer rounded-[1.35rem] border p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)]`}
  >
    <div className="mb-4 flex items-center justify-between">
      <div className={`rounded-2xl p-3 ${iconBg}`}>
        <div className={iconColor}>{icon}</div>
      </div>
      <button
        className={`text-xs font-medium ${textColor} transition-opacity hover:opacity-80`}
      >
        View Details
      </button>
    </div>
    <h3 className={`mb-1 text-sm font-semibold ${textColor}`}>{title}</h3>
    <p className="text-2xl font-extrabold tracking-tight text-foreground">
      {count}
    </p>
    {subText && (
      <p className="mt-2 text-xs text-muted-foreground">{subText}</p>
    )}
  </div>
);
