import React, { useMemo } from "react";
import { Link as LinkIcon } from "lucide-react";
import { formatCurrency, asArray } from "./utils";

const InvoiceSelection = ({
  availableInvoices = [],
  linkedInvoices = [],
  onInvoiceSelection,
  onInvoiceAmountChange,
  partyId,
  error,
  noInvoicesMessage = "No invoices available",
}) => {
  const safeInvoices = useMemo(() => asArray(availableInvoices), [availableInvoices]);
  const safeLinkedInvoices = useMemo(() => asArray(linkedInvoices), [linkedInvoices]);

  if (!partyId) {
    return (
      <div className="md:col-span-2">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          <LinkIcon size={16} className="inline mr-2" /> Linked Invoices
        </label>
        <p className="text-gray-500">{noInvoicesMessage}</p>
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        <LinkIcon size={16} className="inline mr-2" /> Linked Invoices
      </label>
      {safeInvoices.length === 0 ? (
        <p className="text-gray-500">{noInvoicesMessage}</p>
      ) : (
        <div className="space-y-4">
          {safeInvoices.map((invoice) => {
            const isSelected = safeLinkedInvoices.some(
              (inv) => inv.invoiceId === invoice._id
            );
            const linkedInvoice = safeLinkedInvoices.find(
              (inv) => inv.invoiceId === invoice._id
            );
            return (
              <div
                key={invoice._id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200"
              >
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() =>
                      onInvoiceSelection(invoice._id, invoice.totalAmount)
                    }
                    className="h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">
                      {invoice.transactionNo || invoice._id}
                    </p>
                    <p className="text-sm text-gray-600">
                      Total: {formatCurrency(invoice.totalAmount)}
                    </p>
                    {isSelected && (
                      <p className="text-sm text-gray-600">
                        Balance: {formatCurrency(linkedInvoice?.balance || 0)}
                      </p>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={linkedInvoice?.amount || ""}
                      onChange={(e) =>
                        onInvoiceAmountChange(invoice._id, e.target.value)
                      }
                      placeholder="Amount"
                      className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default InvoiceSelection;