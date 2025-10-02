import { useState, useCallback } from "react";
import { Search, User } from "lucide-react";

const vendorSelect = ({ vendor, value, onChange, error }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredCustomers = vendor.filter((c) =>
    c.vendorName.toLowerCase().includes(searchTerm?.toLowerCase())
  );

  const handleSelect = useCallback((customer) => {
    onChange({ target: { name: "vendorId", value: vendor._id } });
    setSearchTerm(vendor.vendorId);
    setIsOpen(false);
  }, [onChange]);

  return (
    <div className="relative">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        <User size={16} className="inline mr-2" /> Vendor Name *
      </label>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search vendor..."
          className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 ${
            error ? "border-red-300 bg-red-50" : "border-gray-300"
          }`}
        />
      </div>
      {isOpen && filteredCustomers.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filteredCustomers.map((vendor) => (
            <div
              key={vendor._id}
              onClick={() => handleSelect(vendor)}
              className="px-4 py-2 text-sm text-gray-900 hover:bg-purple-50 cursor-pointer"
            >
              {vendor.vendorName}
            </div>
          ))}
        </div>
      )}
      {isOpen && filteredCustomers.length === 0 && searchTerm && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 text-sm text-gray-500">
          No vendor found
        </div>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center">
          <AlertCircle size={12} className="mr-1" /> {error}
        </p>
      )}
    </div>
  );
};

export default vendorSelect;