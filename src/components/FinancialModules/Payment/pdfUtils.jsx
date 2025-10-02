import jsPDF from "jspdf";
// import "jspdf-autotable";
import { formatCurrency } from "./utils";

export const downloadVoucherPDF = (voucher, party, type = "payment") => {
  const doc = new jsPDF();
  const partyName =
    voucher.partyName ||
    voucher[type === "payment" ? "vendorName" : "customerName"] ||
    party?.[type === "payment" ? "vendorName" : "customerName"] ||
    "Unknown";

  doc.setFontSize(18);
  doc.text(`${type === "payment" ? "Payment" : "Receipt"} Voucher`, 14, 20);

  doc.setFontSize(12);
  doc.text(`Voucher No: ${voucher.voucherNo}`, 14, 30);
  doc.text(`Date: ${new Date(voucher.date).toLocaleDateString()}`, 14, 38);
  doc.text(
    `${type === "payment" ? "Vendor" : "Customer"}: ${partyName}`,
    14,
    46
  );
  doc.text(`Payment Mode: ${voucher.paymentMode}`, 14, 54);
  doc.text(
    `Total Amount: ${formatCurrency(voucher.totalAmount ?? voucher.amount)}`,
    14,
    62
  );

  if (voucher.paymentDetails) {
    let y = 70;
    if (voucher.paymentDetails.bankDetails) {
      doc.text("Bank Details:", 14, y);
      doc.text(
        `Account: ${voucher.paymentDetails.bankDetails.accountNumber}`,
        20,
        y + 8
      );
      doc.text(
        `Name: ${voucher.paymentDetails.bankDetails.accountName}`,
        20,
        y + 16
      );
      y += 24;
    }
    if (voucher.paymentDetails.chequeDetails) {
      doc.text("Cheque Details:", 14, y);
      doc.text(
        `Number: ${voucher.paymentDetails.chequeDetails.chequeNumber}`,
        20,
        y + 8
      );
      doc.text(
        `Date: ${new Date(
          voucher.paymentDetails.chequeDetails.chequeDate
        ).toLocaleDateString()}`,
        20,
        y + 16
      );
      y += 24;
    }
    if (voucher.paymentDetails.onlineDetails) {
      doc.text("Online Details:", 14, y);
      doc.text(
        `Transaction ID: ${voucher.paymentDetails.onlineDetails.transactionId}`,
        20,
        y + 8
      );
      doc.text(
        `Date: ${new Date(
          voucher.paymentDetails.onlineDetails.transactionDate
        ).toLocaleDateString()}`,
        20,
        y + 16
      );
      y += 24;
    }
  }

  const tableData = (voucher.linkedInvoices || []).map((inv, idx) => [
    idx + 1,
    inv.invoiceId?.transactionNo || inv.transactionNo || inv.invoiceId || "N/A",
    formatCurrency(inv.amount),
    formatCurrency(inv.balance || 0),
  ]);

  doc.autoTable({
    startY: voucher.paymentDetails ? 100 : 70,
    head: [["#", "Invoice No", "Amount", "Balance"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [100, 116, 139] },
  });

  if (voucher.narration) {
    const finalY = doc.lastAutoTable.finalY || 70;
    doc.text("Narration:", 14, finalY + 10);
    doc.text(voucher.narration, 14, finalY + 18);
  }

  doc.save(`${type}_voucher_${voucher.voucherNo}.pdf`);
};

export const printVoucherPDF = (voucher, party, type = "payment") => {
  const doc = new jsPDF();
  const partyName =
    voucher.partyName ||
    voucher[type === "payment" ? "vendorName" : "customerName"] ||
    party?.[type === "payment" ? "vendorName" : "customerName"] ||
    "Unknown";

  doc.setFontSize(18);
  doc.text(`${type === "payment" ? "Payment" : "Receipt"} Voucher`, 14, 20);

  doc.setFontSize(12);
  doc.text(`Voucher No: ${voucher.voucherNo}`, 14, 30);
  doc.text(`Date: ${new Date(voucher.date).toLocaleDateString()}`, 14, 38);
  doc.text(
    `${type === "payment" ? "Vendor" : "Customer"}: ${partyName}`,
    14,
    46
  );
  doc.text(`Payment Mode: ${voucher.paymentMode}`, 14, 54);
  doc.text(
    `Total Amount: ${formatCurrency(voucher.totalAmount ?? voucher.amount)}`,
    14,
    62
  );

  if (voucher.paymentDetails) {
    let y = 70;
    if (voucher.paymentDetails.bankDetails) {
      doc.text("Bank Details:", 14, y);
      doc.text(
        `Account: ${voucher.paymentDetails.bankDetails.accountNumber}`,
        20,
        y + 8
      );
      doc.text(
        `Name: ${voucher.paymentDetails.bankDetails.accountName}`,
        20,
        y + 16
      );
      y += 24;
    }
    if (voucher.paymentDetails.chequeDetails) {
      doc.text("Cheque Details:", 14, y);
      doc.text(
        `Number: ${voucher.paymentDetails.chequeDetails.chequeNumber}`,
        20,
        y + 8
      );
      doc.text(
        `Date: ${new Date(
          voucher.paymentDetails.chequeDetails.chequeDate
        ).toLocaleDateString()}`,
        20,
        y + 16
      );
      y += 24;
    }
    if (voucher.paymentDetails.onlineDetails) {
      doc.text("Online Details:", 14, y);
      doc.text(
        `Transaction ID: ${voucher.paymentDetails.onlineDetails.transactionId}`,
        20,
        y + 8
      );
      doc.text(
        `Date: ${new Date(
          voucher.paymentDetails.onlineDetails.transactionDate
        ).toLocaleDateString()}`,
        20,
        y + 16
      );
      y += 24;
    }
  }

  const tableData = (voucher.linkedInvoices || []).map((inv, idx) => [
    idx + 1,
    inv.invoiceId?.transactionNo || inv.transactionNo || inv.invoiceId || "N/A",
    formatCurrency(inv.amount),
    formatCurrency(inv.balance || 0),
  ]);

  doc.autoTable({
    startY: voucher.paymentDetails ? 100 : 70,
    head: [["#", "Invoice No", "Amount", "Balance"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [100, 116, 139] },
  });

  if (voucher.narration) {
    const finalY = doc.lastAutoTable.finalY || 70;
    doc.text("Narration:", 14, finalY + 10);
    doc.text(voucher.narration, 14, finalY + 18);
  }

  window.open(doc.output("bloburl"), "_blank");
};