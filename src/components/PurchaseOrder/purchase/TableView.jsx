import React from "react";
import {
  Eye,
  Edit3,
  CheckSquare,
  MoreVertical,
  Download,
  Trash2,
  Copy,
  Hash,
  HashIcon,
  Building2,
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
  const toggleSelect = (id) => {
    setSelectedPOs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPOs.length === paginatedPOs.length) {
      setSelectedPOs([]);
    } else {
      setSelectedPOs(paginatedPOs.map((po) => po.id));
    }
  };

  return (
    <div className="bg-card rounded-[1.75rem] shadow-[var(--shadow-card)] border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary border-b border-border">
              <th className="px-4 py-4 text-left">
                <input
                  type="checkbox"
                  checked={
                    selectedPOs.length === paginatedPOs.length &&
                    paginatedPOs.length > 0
                  }
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-border"
                />
              </th>
              <th
                onClick={() => handleSort("transactionNo")}
                className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors"
              >
                PO #
              </th>
              <th
                onClick={() => handleSort("vendor")}
                className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors"
              >
                Vendor
              </th>
              <th
                onClick={() => handleSort("date")}
                className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors"
              >
                Date
              </th>
              <th
                onClick={() => handleSort("amount")}
                className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors"
              >
                Amount
              </th>
              <th
                onClick={() => handleSort("status")}
                className="px-4 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:bg-muted transition-colors"
              >
                Status
              </th>
              <th className="px-4 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedPOs.map((po) => (
              <tr
                key={po.id}
                className={`hover:bg-secondary transition-colors ${
                  selectedPOs.includes(po.id) ? "bg-secondary" : ""
                }`}
              >
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selectedPOs.includes(po.id)}
                    onChange={() => toggleSelect(po.id)}
                    className="w-4 h-4 rounded border-border"
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-secondary rounded-2xl flex items-center justify-center">
                      <HashIcon className="w-4 h-4 text-foreground" />
                    </div>
                    <span className="font-medium text-foreground">
                      {po.transactionNo}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-secondary rounded-2xl flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {po.vendorName}
                      </p>
                      {po.vendorReference && (
                        <p className="text-xs text-muted-foreground">
                          Ref: {po.vendorReference}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm text-muted-foreground">
                  {new Date(po.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-4 font-semibold text-foreground">
                  AED {po.totalAmount}
                </td>
                <td className="px-4 py-4">
                  
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                      po.status
                    )}`}
                  >
                    {getStatusIcon(po.status)}
                    {po.status}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => {
                        setSelectedPO(po);
                        setActiveView("invoice");
                      }}
                      className="p-1.5 text-foreground hover:bg-secondary rounded-full transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {po.status === "DRAFT" && (
                      <button
                        onClick={() => editPO(po)}
                        className="p-1.5 text-muted-foreground hover:bg-secondary rounded-full transition-colors"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    )}

                    {po.status === "PENDING" && (
                      <button
                        onClick={() => approvePO(po.id)}
                        className="p-1.5 text-foreground hover:bg-secondary rounded-full transition-colors"
                        title="Approve"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                    )}

                    <div className="relative group">
                      <button className="p-1.5 text-muted-foreground hover:bg-secondary rounded-full transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <div className="absolute right-0 top-8 w-32 bg-card rounded-2xl shadow-lg border border-border py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                        <button className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary flex items-center space-x-2">
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </button>
                        <button className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary flex items-center space-x-2">
                          <Copy className="w-3 h-3" />
                          <span>Duplicate</span>
                        </button>
                        {(po.status === "DRAFT" ||
                          po.status === "REJECTED") && (
                          <button
                            onClick={() => deletePO(po.id)}
                            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
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
