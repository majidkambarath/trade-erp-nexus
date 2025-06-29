import React from "react";
import { Edit, Trash2, Eye } from "lucide-react";

const ActionButtons = ({ onEdit, onDelete, onView }) => (
  <div className="flex space-x-2">
    <button
      onClick={onEdit}
      className="p-1.5 sm:p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors duration-300"
      aria-label="Edit Vendor"
    >
      <Edit size={14} className="sm:size-16" />
    </button>
    <button
      onClick={onDelete}
      className="p-1.5 sm:p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors duration-300"
      aria-label="Delete Vendor"
    >
      <Trash2 size={14} className="sm:size-16" />
    </button>
    <button
      onClick={onView}
      className="p-1.5 sm:p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors duration-300"
      aria-label="View Vendor"
    >
      <Eye size={14} className="sm:size-16" />
    </button>
  </div>
);

export default ActionButtons;