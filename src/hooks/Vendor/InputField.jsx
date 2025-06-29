import React from "react";
import { UserPlus, Mail, Phone, MapPin, DollarSign, Percent } from "lucide-react";

const InputField = ({ label, name, value, onChange, error, type = "text", placeholder, icon }) => {
  const getIcon = () => {
    switch (icon) {
      case "user": return <UserPlus size={16} className="text-gray-400" />;
      case "mail": return <Mail size={16} className="text-gray-400" />;
      case "phone": return <Phone size={16} className="text-gray-400" />;
      case "map": return <MapPin size={16} className="text-gray-400" />;
      case "dollar": return <DollarSign size={16} className="text-gray-400" />;
      case "percent": return <Percent size={16} className="text-gray-400" />;
      default: return null;
    }
  };

  return (
    <div>
      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
        {label} {label.includes("required") && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {getIcon() && <span className="absolute left-3 top-1/2 transform -translate-y-1/2">{getIcon()}</span>}
        {type === "textarea" ? (
          <textarea
            name={name}
            value={value}
            onChange={onChange}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white shadow-sm"
            placeholder={placeholder}
            rows="3"
          />
        ) : (
          <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 bg-white shadow-sm"
            placeholder={placeholder}
            readOnly={name === "vendorId"}
            disabled={name === "vendorId"}
          />
        )}
      </div>
      {error && <p className="mt-1 text-xs sm:text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default InputField;