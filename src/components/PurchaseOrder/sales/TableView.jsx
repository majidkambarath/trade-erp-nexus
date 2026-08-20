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
} from "lucide-react";

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
}) => {
  console.log(paginatedSOs)
  return (
    <div className="bg-card rounded-[1.75rem] shadow-[var(--shadow-card)] border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
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
                      {new Date(so.date).toLocaleDateString("en-GB")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Delivery:{" "}
                      {new Date(so.deliveryDate).toLocaleDateString("en-GB")}
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
                      AED {parseFloat(so.totalAmount).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {so.items.length} items
                    </p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedSO(so);
                        setActiveView("invoice");
                      }}
                      className="p-1.5 text-foreground hover:bg-secondary rounded-full transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {so.status === "DRAFT" && (
                      <button
                        onClick={() => editSO(so)}
                        className="p-1.5 text-muted-foreground hover:bg-secondary rounded-full transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {so.status === "DRAFT" && (
                      <button
                        onClick={() => confirmSO(so.id)}
                        className="p-1.5 text-foreground hover:bg-secondary rounded-full transition-colors"
                        title="Confirm"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                    )}
                    <div className="relative group">
                      <button className="p-1.5 text-muted-foreground hover:bg-secondary rounded-full transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-8 w-32 bg-card rounded-2xl shadow-lg border border-border py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        <button onClick={() => onDownloadInternal && onDownloadInternal(so)} className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary">
                          Download
                        </button>
                        <button onClick={() => onDownloadCustomer && onDownloadCustomer(so)} className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary">
                          Duplicate
                        </button>
                        {so.status === "DRAFT" && (
                          <button
                            onClick={() => deleteSO(so.id)}
                            className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary"
                          >
                            Delete
                          </button>
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
