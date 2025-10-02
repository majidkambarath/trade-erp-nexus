import { AlertCircle, Link } from "lucide-react";
import { formatCurrency } from "./utils";

const InvoiceSelection = ({ availableInvoices, linkedInvoices, onInvoiceSelection, onInvoiceAmountChange, customerId, error }) => (
  <div className="md:col-span-2">
    <label className="block text-sm font-semibold text-gray-700 mb-2">
      <Link size={16} className="inline mr-2" /> Linked Invoice(s) *
    </label>
    <div className={`border rounded-xl p-4 max-h-48 overflow-y-auto ${error ? "border-red-300 bg-red-50" : "border-gray-300"}`}>
      {availableInvoices.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          {customerId ? "No unpaid invoices found for selected customer" : "Please select a customer first to view unpaid invoices"}
        </p>
      ) : (
        <div className="space-y-2">
          {availableInvoices.map((inv) => (
            <div key={inv._id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex items-center space-x-3 w-2/3">
                <input
                  type="checkbox"
                  checked={linkedInvoices.some((i) => i.invoiceId === inv._id)}
                  onChange={() => onInvoiceSelection(inv._id, inv.totalAmount)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <div>
                  <p className="font-medium text-sm text-gray-900">{inv.transactionNo || "N/A"}</p>
                  <p className="text-xs text-gray-500">{inv.date ? new Date(inv.date).toLocaleDateString() : "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 w-1/3">
                <div className="text-right">
                  <p className="font-medium text-sm text-gray-900">{formatCurrency(inv.totalAmount)}</p>
                  <p className="text-xs text-gray-500">{inv.status || "N/A"}</p>
                </div>
                {linkedInvoices.some((i) => i.invoiceId === inv._id) && (
                  <div className="w-32">
                    <input
                      type="number"
                      value={linkedInvoices.find((i) => i.invoiceId === inv._id)?.amount || ""}
                      onChange={(e) => onInvoiceAmountChange(inv._id, e.target.value)}
                      placeholder="Enter amount"
                      min="0"
                      step="0.01"
                      max={inv.totalAmount}
                      className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500">
                      Balance: {formatCurrency(linkedInvoices.find((i) => i.invoiceId === inv._id)?.balance || inv.totalAmount)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    {error && (
      <p className="mt-1 text-sm text-red-600 flex items-center">
        <AlertCircle size={12} className="mr-1" /> {error}
      </p>
    )}
  </div>
);

export default InvoiceSelection;