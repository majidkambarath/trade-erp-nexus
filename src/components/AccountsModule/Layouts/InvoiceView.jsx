import React from "react";
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

  const showToastMessage = (message) => {
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
      />
    </div>
  );
};

export default InvoiceView;
