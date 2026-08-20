import React from "react";
import { Edit, Trash2, Eye } from "lucide-react";

const ActionButtons = ({ onEdit, onDelete, onView }) => (
  <div className="flex space-x-2">
    <button
      onClick={onEdit}
      className="p-2 bg-secondary text-foreground rounded-full border border-border hover:bg-foreground hover:text-background transition-colors duration-300"
      aria-label="Edit"
    >
      <Edit size={14} />
    </button>
    <button
      onClick={onDelete}
      className="p-2 bg-secondary text-foreground rounded-full border border-border hover:bg-destructive hover:text-destructive-foreground transition-colors duration-300"
      aria-label="Delete"
    >
      <Trash2 size={14} />
    </button>
    <button
      onClick={onView}
      className="p-2 bg-secondary text-foreground rounded-full border border-border hover:bg-[var(--highlight)] hover:text-[#171717] transition-colors duration-300"
      aria-label="View"
    >
      <Eye size={14} />
    </button>
  </div>
);

export default ActionButtons;
