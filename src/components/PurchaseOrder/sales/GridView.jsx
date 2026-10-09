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
  History,
  Truck,
  Send,
} from "lucide-react";
import { SentLine } from "../../send/shared";
import { formatNumber, formatDate, CURRENCY } from "../../../utils/format";
import Can from "../../shell/Can";
import { AwaitingSecondBadge, useApproval } from "../../shell/Approval";
import { deleteKey } from "../../../lib/permissions";

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
  onShowAudit,
  onDeliveryNote,
  onSendDocument,
}) => {
  // Confirm only for someone who may approve THIS order; a first approval awaiting its second is badged (see TableView).
  const { stateOf } = useApproval();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {paginatedSOs.map((so) => (
        <div key={so.id} className="bg-card rounded-xl border border-border shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden group">
          {/* Card Header */}
          <div className="bg-secondary px-4 py-4 sm:px-6 border-b border-border">
            <div className="flex flex-wrap justify-between items-start gap-x-3 gap-y-2">
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
                  <h3 className="text-lg font-extrabold text-foreground whitespace-nowrap">{so.transactionNo}</h3>
                  <p className="text-sm text-muted-foreground">{so.customerName}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getPriorityColor(so.priority)}`} title={`${so.priority} Priority`}></div>
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(so.status)}`}>
                  {getStatusIcon(so.status)}
                  <span className="ml-1">{so.status}</span>
                </div>
                {so.closedShort && <span className="text-xs font-medium text-status-warning">Closed short</span>}
                {!!onSendDocument && so.status === "APPROVED" && !so.isOpening && <SentLine send={so.lastSend} />}
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 mb-4 min-[380px]:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Date</p>
                <p className="text-sm font-medium text-foreground">{formatDate(so.date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Dispatch</p>
                <p className="text-sm font-medium text-foreground">{formatDate(so.deliveryDate)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Items</p>
                <p className="text-sm font-medium text-foreground">{so.items.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Total</p>
                <p className="text-lg font-extrabold text-foreground">{CURRENCY} {formatNumber(so.totalAmount)}</p>
              </div>
            </div>

            {/* Items Preview */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Items</p>
              <div className="space-y-1">
                {so.items.slice(0, 2).map((item, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate">{item.description || item.itemName || item.stockDetails?.itemName || "Item"}</span>
                    <span className="text-foreground font-medium ml-2 shrink-0 whitespace-nowrap">{item.qty} × {item.rate}</span>
                  </div>
                ))}
                {so.items.length > 2 && (
                  <p className="text-xs text-muted-foreground">+{so.items.length - 2} more items</p>
                )}
              </div>
            </div>

            {/* Status Indicators */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 text-xs">
              <div className="flex items-center space-x-1 text-muted-foreground">
                <User className="w-3 h-3" />
                <span>{so.createdBy}</span>
              </div>
              <AwaitingSecondBadge doc={so} state={stateOf(so)} />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
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
                  <span className="text-sm">Customer copy</span>
                </button>
                {!!onSendDocument && so.status === "APPROVED" && !so.isOpening && (
                  <Can permission="sales.send">
                    <button
                      type="button" onClick={() => onSendDocument(so)} aria-label={`Send ${so.displayTransactionNo || so.transactionNo} to the customer`}
                      className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                    >
                      <Send className="w-4 h-4" />
                      <span className="text-sm">Send</span>
                    </button>
                  </Can>
                )}
                <button
                  onClick={() => onShowAudit && onShowAudit(so)}
                  className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                >
                  <History className="w-4 h-4" />
                  <span className="text-sm">Audit trail</span>
                </button>
                {onDeliveryNote && ["DRAFT", "APPROVED"].includes(so.status) && !so.isOpening && !so.closedShort && (
                  <button
                    onClick={() => onDeliveryNote(so)}
                    className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                  >
                    <Truck className="w-4 h-4" />
                    <span className="text-sm">Delivery note</span>
                  </button>
                )}
                {so.status === "DRAFT" && (
                  <Can permission="sales.edit">
                    <button
                      onClick={() => editSO(so)}
                      className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span className="text-sm">Edit</span>
                    </button>
                  </Can>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {so.status === "DRAFT" && stateOf(so).canApprove && (
                  <Can permission="sales.approve">
                    <button
                      onClick={() => confirmSO(so.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-foreground text-background rounded-full hover:opacity-90 transition-colors"
                    >
                      <ConfirmIcon className="w-4 h-4" />
                      <span className="text-sm">Confirm</span>
                    </button>
                  </Can>
                )}
                {(so.status === "DRAFT" || so.status === "APPROVED") && (
                  <Can permission={deleteKey("sales", so.status === "APPROVED")}>
                    <button
                      onClick={() => deleteSO(so.id)}
                      className="flex items-center space-x-1 px-3 py-2 bg-secondary text-foreground rounded-full hover:bg-muted transition-colors border border-border"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="text-sm">Delete</span>
                    </button>
                  </Can>
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
