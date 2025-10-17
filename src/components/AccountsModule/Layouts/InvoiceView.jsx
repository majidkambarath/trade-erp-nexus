import React, { useEffect, useState } from "react";
import { Send } from "lucide-react";
import PaymentInvoiceView from "../../FinancialModules/Payment/PaymentInvoiceView";

const InvoiceView = ({
  selectedInvoice,
  parties,
  setActiveView,
  setSelectedInvoice,
  voucherType = "sale",
  calculateTotals = (entries) => ({
    subtotal: entries.reduce(
      (sum, e) => sum + (e.debitAmount || e.creditAmount || 0),
      0
    ),
    tax: entries.reduce((sum, e) => sum + (e.taxAmount || 0), 0),
    total: entries.reduce(
      (sum, e) =>
        sum + (e.debitAmount || e.creditAmount || 0) + (e.taxAmount || 0),
      0
    ),
  }),
}) => {
  const handleBackClick = () => {
    setSelectedInvoice(null);
    setActiveView("list");
  };

  const handleSendToParty = () => {
    const party = parties.find((p) => p._id === selectedInvoice.partyId);
    const isSale = voucherType === "sale";
    alert(
      `${
        voucherType.charAt(0).toUpperCase() + voucherType.slice(1)
      } Invoice sent to ${party?.customerName || party?.vendorName || "party"}!`
    );
  };

  const showToastMessage = (message, type) => {
    alert(message);
  };

  // Prepare the invoice data with calculated totals
  const invoiceWithTotals = {
    ...selectedInvoice,
    entries: selectedInvoice.entries || [],
    totals: calculateTotals(selectedInvoice.entries || []),
  };

  if (!selectedInvoice) return null;

  return (
    <div>
      <PaymentInvoiceView
        selectedPayment={invoiceWithTotals}
        vendors={parties}
        onBack={handleBackClick}
        voucherType={voucherType}
        showToastMessage={showToastMessage}
        additionalActions={
            <button
              onClick={handleSendToParty}
              className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-4 h-4" />
            <span>Send to {voucherType === "sale" ? "Customer" : "Vendor"}</span>
            </button>
        }
      />
    </div>
  );
};

export default InvoiceView;
