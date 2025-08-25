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
  paginatedPOs,
  selectedPOs,
  setSelectedPOs,
  getPriorityColor,
  getStatusColor,
  getStatusIcon,
  handleSort,
  sortBy,
  sortOrder,
  setSelectedPO,
  setActiveView,
  editPO,
  approvePO,
  deletePO,
}) => {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/20 shadow-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50/80 border-b border-slate-200">
            <tr>
              <th className="px-4 py-4 text-left">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={
                    selectedPOs.length === paginatedPOs.length &&
                    paginatedPOs.length > 0
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedPOs(paginatedPOs.map((po) => po.id));
                    } else {
                      setSelectedPOs([]);
                    }
                  }}
                />
              </th>
              <th className="px-4 py-4 text-left">
                <button
                  onClick={() => handleSort("id")}
                  className="flex items-center space-x-1 text-sm font-semibold text-slate-700 hover:text-slate-900"
                >
                  <span>PO Number</span>
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
                  onClick={() => handleSort("vendor")}
                  className="flex items-center space-x-1 text-sm font-semibold text-slate-700 hover:text-slate-900"
                >
                  <span>Vendor</span>
                  {sortBy === "vendor" &&
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
                  className="flex items-center space-x-1 text-sm font-semibold text-slate-700 hover:text-slate-900"
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
                <span className="text-sm font-semibold text-slate-700">
                  Status
                </span>
              </th>
              <th className="px-4 py-4 text-right">
                <button
                  onClick={() => handleSort("amount")}
                  className="flex items-center space-x-1 text-sm font-semibold text-slate-700 hover:text-slate-900 ml-auto"
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
                <span className="text-sm font-semibold text-slate-700">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {paginatedPOs.map((po) => (
              <tr
                key={po.id}
                className="hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
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
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-2 h-8 rounded-full ${getPriorityColor(
                        po.priority
                      )}`}
                    ></div>
                    <div>
                      <p className="font-medium text-slate-900">
                        {po.transactionNo}
                      </p>
                      <p className="text-xs text-slate-500">{po.createdBy}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div>
                    <p className="font-medium text-slate-900">
                      {po.vendorName}
                    </p>
                    <p className="text-xs text-slate-500">{po.vendorId}</p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div>
                    <p className="text-sm text-slate-900">
                      {new Date(po.date).toLocaleDateString("en-GB")}
                    </p>
                    <p className="text-xs text-slate-500">
                      Delivery:{" "}
                      {new Date(po.deliveryDate).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col space-y-1">
                    <div
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                        po.status
                      )}`}
                    >
                      {getStatusIcon(po.status)}
                      <span className="ml-1">
                        {po.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      {po.grnGenerated && (
                        <div
                          className="w-2 h-2 bg-green-500 rounded-full"
                          title="GRN Generated"
                        ></div>
                      )}
                      {po.invoiceGenerated && (
                        <div
                          className="w-2 h-2 bg-blue-500 rounded-full"
                          title="Invoice Generated"
                        ></div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <div>
                    <p className="font-semibold text-slate-900">
                      AED {parseFloat(po.totalAmount).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">
                      {po.items.length} items
                    </p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedPO(po);
                        setActiveView("invoice");
                      }}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {po.status === "DRAFT" && (
                      <button
                        onClick={() => editPO(po)}
                        className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}
                    {po.status === "PENDING" && (
                      <button
                        onClick={() => approvePO(po.id)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Approve"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                    )}
                    <div className="relative group">
                      <button className="p-1.5 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-8 w-32 bg-white rounded-lg shadow-lg border border-slate-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        <button className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                          Download
                        </button>
                        <button className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                          Duplicate
                        </button>
                        {(po.status === "DRAFT" ||
                          po.status === "REJECTED") && (
                          <button
                            onClick={() => deletePO(po.id)}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
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