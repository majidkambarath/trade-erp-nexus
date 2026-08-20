import React from "react";
import {
  Eye,
  Edit3,
  CheckSquare,
  X,
  Trash2,
  CheckCircle,
  Receipt,
  User,
} from "lucide-react";

const GridView = ({
  paginatedPOs,
  selectedPOs,
  setSelectedPOs,
  getPriorityColor,
  getStatusColor,
  getStatusIcon,
  setSelectedPO,
  setActiveView,
  editPO,
  approvePO,
  rejectPO,
  deletePO,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {paginatedPOs.map((po) => (
        <div
          key={po.id}
          className="bg-card rounded-[1.75rem] border border-border shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-all duration-300 overflow-hidden group"
        >
          <div className="bg-secondary px-6 py-4 border-b border-border">
            <div className="flex justify-between items-start">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={selectedPOs.includes(po.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPOs((prev) => [...prev, po.id]);
                    } else {
                      setSelectedPOs((prev) =>
                        prev.filter((id) => id !== po.id)
                      );
                    }
                  }}
                />
                <div>
                  <h3 className="text-lg font-extrabold text-foreground">
                    {po.transactionNo}
                  </h3>
                  <p className="text-sm text-muted-foreground">{po.vendorName}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-2 h-2 rounded-full ${getPriorityColor(
                    po.priority
                  )}`}
                  title={`${po.priority} Priority`}
                ></div>
                <div
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                    po.status
                  )}`}
                >
                  {getStatusIcon(po.status)}
                  <span className="ml-1">{po.status.replace("_", " ")}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Date
                </p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(po.date).toLocaleDateString("en-GB")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Delivery
                </p>
                <p className="text-sm font-medium text-foreground">
                  {new Date(po.deliveryDate).toLocaleDateString("en-GB")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Items
                </p>
                <p className="text-sm font-medium text-foreground">
                  {po.items.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Total
                </p>
                <p className="text-lg font-extrabold text-foreground">
                  AED {parseFloat(po.totalAmount).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
                Items
              </p>
              <div className="space-y-1">
                {po.items.slice(0, 2).map((item, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate">
                      {item.description}
                    </span>
                    <span className="text-foreground font-medium ml-2">
                      {item.qty} × {item.rate}
                    </span>
                  </div>
                ))}
                {po.items.length > 2 && (
                  <p className="text-xs text-muted-foreground">
                    +{po.items.length - 2} more items
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4 mb-4 text-xs">
              {po.grnGenerated && (
                <div className="flex items-center space-x-1 text-foreground">
                  <CheckCircle className="w-3 h-3" />
                  <span>GRN</span>
                </div>
              )}
              {po.invoiceGenerated && (
                <div className="flex items-center space-x-1 text-foreground">
                  <Receipt className="w-3 h-3" />
                  <span>Invoice</span>
                </div>
              )}
              <div className="flex items-center space-x-1 text-muted-foreground">
                <User className="w-3 h-3" />
                <span>{po.createdBy}</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setSelectedPO(po);
                    setActiveView("invoice");
                  }}
                  className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">View</span>
                </button>
                {po.status === "DRAFT" && (
                  <button
                    onClick={() => editPO(po)}
                    className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span className="text-sm">Edit</span>
                  </button>
                )}
              </div>

              <div className="flex space-x-2">
                {po.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => approvePO(po.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-foreground text-background rounded-full hover:opacity-90 transition-colors"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span className="text-sm">Approve</span>
                    </button>
                    <button
                      onClick={() => rejectPO(po.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-sm">Reject</span>
                    </button>
                  </>
                )}
                {(po.status === "DRAFT" || po.status === "REJECTED") && (
                  <button
                    onClick={() => deletePO(po.id)}
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
