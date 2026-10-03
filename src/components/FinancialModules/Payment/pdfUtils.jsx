import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCurrencyAED, formatDateGB } from "../../../utils/format";

// Builds the voucher document. Both the download and print paths share this so the
// two outputs can never drift apart.
//
// Money must go through formatCurrencyAED (a string), never through the formatCurrency
// in ./utils — that one returns JSX, which jsPDF stringifies to "[object Object]".
const buildVoucherDoc = (voucher, party, type) => {
  const doc = new jsPDF();
  const isPayment = type === "payment";
  const partyName =
    voucher.partyName ||
    voucher[isPayment ? "vendorName" : "customerName"] ||
    party?.[isPayment ? "vendorName" : "customerName"] ||
    "Unknown";

  doc.setFontSize(18);
  doc.text(`${isPayment ? "Payment" : "Receipt"} Voucher`, 14, 20);

  doc.setFontSize(12);
  doc.text(`Voucher No: ${voucher.voucherNo}`, 14, 30);
  doc.text(`Date: ${formatDateGB(voucher.date)}`, 14, 38);
  doc.text(`${isPayment ? "Vendor" : "Customer"}: ${partyName}`, 14, 46);
  doc.text(`Payment Mode: ${voucher.paymentMode ?? "-"}`, 14, 54);
  doc.text(
    `Total Amount: ${formatCurrencyAED(voucher.totalAmount ?? voucher.amount)}`,
    14,
    62
  );

  let y = 70;
  if (voucher.paymentDetails) {
    const { bankDetails, chequeDetails, onlineDetails } = voucher.paymentDetails;

    if (bankDetails) {
      doc.text("Bank Details:", 14, y);
      doc.text(`Account: ${bankDetails.accountNumber ?? "-"}`, 20, y + 8);
      doc.text(`Name: ${bankDetails.accountName ?? "-"}`, 20, y + 16);
      y += 24;
    }
    if (chequeDetails) {
      doc.text("Cheque Details:", 14, y);
      doc.text(`Number: ${chequeDetails.chequeNumber ?? "-"}`, 20, y + 8);
      doc.text(`Date: ${formatDateGB(chequeDetails.chequeDate)}`, 20, y + 16);
      y += 24;
    }
    if (onlineDetails) {
      doc.text("Online Details:", 14, y);
      doc.text(`Transaction ID: ${onlineDetails.transactionId ?? "-"}`, 20, y + 8);
      doc.text(`Date: ${formatDateGB(onlineDetails.transactionDate)}`, 20, y + 16);
      y += 24;
    }
  }

  const tableData = (voucher.linkedInvoices || []).map((inv, idx) => [
    idx + 1,
    inv.invoiceId?.transactionNo || inv.transactionNo || inv.invoiceId || "N/A",
    formatCurrencyAED(inv.amount),
    formatCurrencyAED(inv.balance || 0),
  ]);

  if (tableData.length) {
    autoTable(doc, {
      startY: y,
      head: [["#", "Invoice No", "Amount", "Balance"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [100, 116, 139] },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
    });
    y = doc.lastAutoTable?.finalY ?? y;
  }

  if (voucher.narration) {
    doc.text("Narration:", 14, y + 10);
    doc.text(doc.splitTextToSize(voucher.narration, 180), 14, y + 18);
  }

  return doc;
};

export const downloadVoucherPDF = (voucher, party, type = "payment") => {
  const doc = buildVoucherDoc(voucher, party, type);
  doc.save(`${type}_voucher_${voucher.voucherNo}.pdf`);
};

export const printVoucherPDF = (voucher, party, type = "payment") => {
  const doc = buildVoucherDoc(voucher, party, type);
  window.open(doc.output("bloburl"), "_blank");
};
