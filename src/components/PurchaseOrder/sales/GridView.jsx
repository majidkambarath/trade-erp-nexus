import React from "react";
import {
  ChevronUp,
  ChevronDown,
  Eye,
  Edit3,
  CheckSquare,
  MoreVertical,
  FileText,
  CheckSquare as ConfirmIcon,
  Trash2,
  User,
} from "lucide-react";

const GridView = ({
  paginatedSOs,
  selectedSOs,
  setSelectedSOs,
  getPriorityColor,
  getStatusColor,
  getStatusIcon,
  setSelectedSO,
  setActiveView,
  editSO,
  confirmSO,
  deleteSO,
  onDownloadInternal,
  onDownloadCustomer,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {paginatedSOs.map((so) => (
        <div key={so.id} className="bg-card rounded-[1.75rem] border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300 overflow-hidden group">
          {/* Card Header */}
          <div className="bg-secondary px-6 py-4 border-b border-border">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={selectedSOs.includes(so.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSOs(prev => [...prev, so.id]);
                    } else {
                      setSelectedSOs(prev => prev.filter(id => id !== so.id));
                    }
                  }}
                />
                <div>
                  <h3 className="text-lg font-extrabold text-foreground">{so.transactionNo}</h3>
                  <p className="text-sm text-muted-foreground">{so.customerName}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${getPriorityColor(so.priority)}`} title={`${so.priority} Priority`}></div>
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(so.status)}`}>
                  {getStatusIcon(so.status)}
                  <span className="ml-1">{so.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Date</p>
                <p className="text-sm font-medium text-foreground">{new Date(so.date).toLocaleDateString("en-GB")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Dispatch</p>
                <p className="text-sm font-medium text-foreground">{new Date(so.deliveryDate).toLocaleDateString("en-GB")}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Items</p>
                <p className="text-sm font-medium text-foreground">{so.items.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total</p>
                <p className="text-lg font-extrabold text-foreground">AED {parseFloat(so.totalAmount).toLocaleString()}</p>
              </div>
            </div>

            {/* Items Preview */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Items</p>
              <div className="space-y-1">
                {so.items.slice(0, 2).map((item, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate">{item.description}</span>
                    <span className="text-foreground font-medium ml-2">{item.qty} × {item.rate}</span>
                  </div>
                ))}
                {so.items.length > 2 && (
                  <p className="text-xs text-muted-foreground">+{so.items.length - 2} more items</p>
                )}
              </div>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center space-x-4 mb-4 text-xs">
              <div className="flex items-center space-x-1 text-muted-foreground">
                <User className="w-3 h-3" />
                <span>{so.createdBy}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedSO(so);
                    setActiveView("invoice");
                  }}
                  className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">View</span>
                </button>
                <button
                  onClick={() => onDownloadInternal && onDownloadInternal(so)}
                  className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">Download</span>
                </button>
                <button
                  onClick={() => onDownloadCustomer && onDownloadCustomer(so)}
                  className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">Duplicate</span>
                </button>
                {so.status === "DRAFT" && (
                  <button
                    onClick={() => editSO(so)}
                    className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="text-sm">Edit</span>
                  </button>
                )}
              </div>

              <div className="flex space-x-2">
                {so.status === "DRAFT" && (
                  <button
                    onClick={() => confirmSO(so.id)}
                    className="flex items-center space-x-1 px-3 py-2 bg-foreground text-background rounded-full hover:opacity-90 transition-colors"
                  >
                    <ConfirmIcon className="w-4 h-4" />
                    <span className="text-sm">Confirm</span>
                  </button>
                )}
                {so.status === "DRAFT" && (
                  <button
                    onClick={() => deleteSO(so.id)}
                    className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="text-sm">Delete</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GridView;
