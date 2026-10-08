import React from "react";
import {
  ChevronUp,
  ChevronDown,
  Eye,
  Edit3,
  CheckSquare,
  MoreVertical,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Send,
} from "lucide-react";
import { SentLine } from "../../send/shared";
import { formatNumber, formatDate } from "../../../utils/format";
import Can from "../../shell/Can";

const TableView = ({
  paginatedSOs,
  selectedSOs,
  setSelectedSOs,
  getPriorityColor,
  getStatusColor,
  getStatusIcon,
  handleSort,
  sortBy,
  sortOrder,
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
  return (
    <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        {/* Tighter cells below lg: at tablet width (820px) the roomy cells made the table wider than its card and pushed
            the Confirm and menu buttons of a draft off the right edge. */}
        <table className="w-full [&_th]:px-2 [&_td]:px-2 lg:[&_th]:px-4 lg:[&_td]:px-4">
          <thead className="bg-secondary border-b border-border">
            <tr>
              <th className="px-4 py-4 text-left">
                <input
                  type="checkbox"
                  className="rounded border-border"
                  checked={
                    selectedSOs.length === paginatedSOs.length &&
                    paginatedSOs.length > 0
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSOs(paginatedSOs.map((so) => so.id));
                    } else {
                      setSelectedSOs([]);
                    }
                  }}
                />
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  onClick={() => handleSort("id")}
                  className="flex items-center space-x-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <span>SO Number</span>
                  {sortBy === "id" &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    ))}
                </button>
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  onClick={() => handleSort("customer")}
                  className="flex items-center space-x-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <span>Customer</span>
                  {sortBy === "customer" &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    ))}
                </button>
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  onClick={() => handleSort("date")}
                  className="flex items-center space-x-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <span>Date</span>
                  {sortBy === "date" &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    ))}
                </button>
              </th>
              <th className="px-4 py-4 text-left">
                <span className="text-sm font-semibold text-muted-foreground">
                  Status
                </span>
              </th>
              <th className="px-4 py-4 text-right">
                <button
                  onClick={() => handleSort("amount")}
                  className="flex items-center space-x-1 text-sm font-semibold text-muted-foreground hover:text-foreground ml-auto"
                >
                  <span>Amount</span>
                  {sortBy === "amount" &&
                    (sortOrder === "asc" ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    ))}
                </button>
              </th>
              <th className="px-4 py-4 text-center">
                <span className="text-sm font-semibold text-muted-foreground">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedSOs.map((so,i) => (
              <tr
                key={i}
                className="hover:bg-secondary transition-colors"
              >
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={selectedSOs.includes(so.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSOs((prev) => [...prev, so.id]);
                      } else {
                        setSelectedSOs((prev) =>
                          prev.filter((id) => id !== so.id)
                        );
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-2 h-8 rounded-full ${getPriorityColor(
                        so.priority
                      )}`}
                    ></div>
                    <div>
                      <p className="font-medium text-foreground">
  {so.status === "APPROVED"
    ? (so.displayTransactionNo ?? so.transactionNo)
    : so.transactionNo}
</p>

                      <p className="text-xs text-muted-foreground">{so.createdBy}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div>
                    <p className="font-medium text-foreground">
                      {so?.customerName}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div>
                    <p className="text-sm text-foreground">
                      {formatDate(so.date)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Delivery:{" "}
                      {formatDate(so.deliveryDate)}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col space-y-1">
                    <div
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        so.status
                      )}`}
                    >
                      {getStatusIcon(so.status)}
                      <span className="ml-1">
                        {so.status.replace("_", " ")}
                      </span>
                    </div>
                    {so.closedShort && <span className="text-xs font-medium text-status-warning">Closed short</span>}
                    {!!onSendDocument && so.status === "APPROVED" && !so.isOpening && <SentLine send={so.lastSend} />}
                    <div className="flex space-x-1">
                      {so.invoiceGenerated && (
                        <div
                          className="w-2 h-2 bg-foreground rounded-full"
                          title="Invoice Generated"
                        ></div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <div>
                    <p className="font-semibold text-foreground">
                      AED {formatNumber(so.totalAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {so.items.length} items
                    </p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center space-x-2">
                    {!!onSendDocument && so.status === "APPROVED" && !so.isOpening && (
                      <button
                        type="button" onClick={() => onSendDocument(so)} aria-label={`Send ${so.displayTransactionNo || so.transactionNo} to the customer`}
                        className="grid min-h-10 min-w-10 place-items-center p-1.5 text-foreground hover:bg-secondary rounded-full lg:min-h-0 lg:min-w-0 transition-colors"
                        title="Send to the customer"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedSO(so);
                        setActiveView("invoice");
                      }}
                      className="grid min-h-10 min-w-10 place-items-center p-1.5 text-foreground hover:bg-secondary rounded-full lg:min-h-0 lg:min-w-0 transition-colors"
                      title="View Details"
                      aria-label={`View ${so.displayTransactionNo || so.transactionNo}`}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {so.status === "DRAFT" && (
                      <Can permission="sales.create">
                        <button
                          onClick={() => editSO(so)}
                          className="grid min-h-10 min-w-10 place-items-center p-1.5 text-muted-foreground hover:bg-secondary rounded-full lg:min-h-0 lg:min-w-0 transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </Can>
                    )}
                    {so.status === "DRAFT" && (
                      <Can permission="sales.approve">
                        <button
                          onClick={() => confirmSO(so.id)}
                          className="grid min-h-10 min-w-10 place-items-center p-1.5 text-foreground hover:bg-secondary rounded-full lg:min-h-0 lg:min-w-0 transition-colors"
                          title="Confirm"
                        >
                          <CheckSquare className="w-4 h-4" />
                        </button>
                      </Can>
                    )}
                    <div className="relative group">
                      <button className="grid min-h-10 min-w-10 place-items-center p-1.5 text-muted-foreground hover:bg-secondary rounded-full lg:min-h-0 lg:min-w-0 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-8 w-36 bg-card rounded-2xl shadow-lg border border-border py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200 z-10">
                        <button onClick={() => onShowAudit && onShowAudit(so)} className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary">
                          Audit trail
                        </button>
                        {onDeliveryNote && ["DRAFT", "APPROVED"].includes(so.status) && !so.isOpening && !so.closedShort && (
                          <button onClick={() => onDeliveryNote(so)} className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary">
                            Delivery note
                          </button>
                        )}
                        <button onClick={() => onDownloadInternal && onDownloadInternal(so)} className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary">
                          Download
                        </button>
                        <button onClick={() => onDownloadCustomer && onDownloadCustomer(so)} className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary">
                          Customer copy
                        </button>
                        {so.status === "DRAFT" && (
                          <Can permission="sales.delete">
                            <button
                              onClick={() => deleteSO(so.id)}
                              className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary"
                            >
                              Delete
                            </button>
                          </Can>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableView;
