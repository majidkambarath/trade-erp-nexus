import { useCallback, useRef, useState } from "react";
import { ArrowLeft, Download, Printer, Loader2 } from "lucide-react";
import { asArray, formatCurrency, displayMode } from "./utils";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const ReceiptView = ({ receipt, customers, onBack }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const receiptRef = useRef(null);

  const calculateReceiptTotals = useCallback((entries) => {
    const subtotal = entries.reduce((sum, entry) => sum + (Number(entry.debitAmount) || 0), 0);
    const tax = entries.reduce((sum, entry) => sum + (Number(entry.taxAmount) || 0), 0);
    return { subtotal: subtotal.toFixed(2), tax: tax.toFixed(2), total: (subtotal + tax).toFixed(2) };
  }, []);

  const downloadReceiptPDF = useCallback(async () => {
    setIsGeneratingPDF(true);
    try {
      const element = receiptRef.current;
      if (!element) throw new Error("Receipt content not found");
      
      // Ensure images are preloaded to avoid CORS issues
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = "https://res.cloudinary.com/dmkdrwpfp/image/upload/v1755452581/erp_Uploads/NH%20foods_1755452579855.jpg";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Failed to load logo image"));
      });

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`receipt_${receipt.voucherNo}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [receipt]);

  const printReceiptPDF = useCallback(async () => {
    setIsGeneratingPDF(true);
    try {
      const element = receiptRef.current;
      if (!element) throw new Error("Receipt content not found");

      // Ensure images are preloaded
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = "https://res.cloudinary.com/dmkdrwpfp/image/upload/v1755452581/erp_Uploads/NH%20foods_1755452579855.jpg";
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Failed to load logo image"));
      });

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      const pdfBlob = pdf.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(url);
      if (!printWindow) throw new Error("Failed to open print window");
      printWindow.onload = () => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 100);
      };
    } catch (err) {
      console.error("Failed to print PDF:", err);
      alert("Failed to print PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [receipt]);

  const customer = customers.find((c) => c._id === (typeof receipt.partyId === "object" ? receipt.partyId._id : receipt.partyId));
  const totals = calculateReceiptTotals(asArray(receipt.entries));

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> <span>Back to List</span>
          </button>
          <div className="flex space-x-3">
            <button
              onClick={downloadReceiptPDF}
              disabled={isGeneratingPDF}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isGeneratingPDF ? "Generating..." : "Download PDF"}</span>
            </button>
            <button
              onClick={printReceiptPDF}
              disabled={isGeneratingPDF}
              className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              <span>{isGeneratingPDF ? "Generating..." : "Print PDF"}</span>
            </button>
          </div>
        </div>
        <div
          id="receipt-content"
          ref={receiptRef}
          className="bg-white shadow-lg p-8 font-sans text-black"
          style={{ width: "210mm", minHeight: "297mm", margin: "0 auto", fontSize: "12px", lineHeight: "1.4" }}
        >
          <div className="text-center border-b-2 border-purple-600 pb-4 mb-4">
            <h1 className="text-sm font-bold direction-rtl">نجم لتجارة المواد الغذائية ذ.م.م ش.ش.و</h1>
            <h2 className="text-lg font-bold text-teal-700 mb-4">NH FOODSTUFF TRADING LLC S.O.C.</h2>
            <div className="bg-purple-200 text-white py-2 -mx-8">
              <h3 className="text-base font-bold">RECEIPT VOUCHER</h3>
            </div>
          </div>
          <div className="flex justify-between mb-4 text-xs">
            <div>
              <p>Dubai, UAE</p>
              <p>VAT Reg. No: 10503303</p>
              <p>Email: finance@nhfo.com</p>
              <p>Phone: +971 58 724 2111</p>
              <p>Web: www.nhfo.com</p>
            </div>
            <div className="text-center">
              <img
                src="https://res.cloudinary.com/dmkdrwpfp/image/upload/v1755452581/erp_Uploads/NH%20foods_1755452579855.jpg"
                alt="NH Foods Logo"
                className="w-20 h-20 object-contain"
                crossOrigin="anonymous"
              />
            </div>
            <div className="text-right">
              <p>Date: {new Date(receipt.date).toLocaleDateString("en-GB")}</p>
              <p>Receipt No: {receipt.voucherNo}</p>
              <p>Payment Mode: {displayMode(receipt.paymentMode)}</p>
            </div>
          </div>
          <div className="bg-purple-100 p-4 mb-4">
            <div className="flex justify-between">
              <div>
                <div className="text-xs font-bold mb-2">Received From:</div>
                <div className="text-xs">
                  <p className="font-bold">{receipt.partyName || receipt.customerName || "-"}</p>
                  <p>{customer?.address?.split("\n")[0] || ""}</p>
                  <p>{customer?.address?.split("\n")[1] || ""}</p>
                  <p>Tel: {customer?.phone || "-"}</p>
                </div>
              </div>
              <div className="text-xs">
                <p>VAT Reg. No:</p>
                <p className="font-bold">{customer?.vatNumber || "-"}</p>
              </div>
            </div>
          </div>
          <table className="w-full border-collapse mb-4 text-xs">
            <thead>
              <tr className="bg-purple-100">
                {["Account", "Description", "Debit", "Credit", "Tax Amount"].map((header) => (
                  <th key={header} className="border border-black p-2 text-center font-bold">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {asArray(receipt.entries).map((entry, index) => (
                <tr key={index}>
                  <td className="border border-black p-2 text-center">{entry.accountName || "-"}</td>
                  <td className="border border-black p-2">{entry.description || "-"}</td>
                  <td className="border border-black p-2 text-center">{Number(entry.debitAmount || 0).toFixed(2)}</td>
                  <td className="border border-black p-2 text-center">{Number(entry.creditAmount || 0).toFixed(2)}</td>
                  <td className="border border-black p-2 text-center">{Number(entry.taxAmount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between mb-4">
            <div className="w-5/12">
              <div className="text-xs font-bold mb-2">BANK DETAILS:-</div>
              <div className="text-xs">
                <p><strong>BANK:</strong> NATIONAL BANK OF ABUDHABI</p>
                <p><strong>ACCOUNT NO:</strong> {receipt.paymentDetails?.bankDetails?.accountNumber || "-"}</p>
              </div>
            </div>
            <div className="w-5/12">
              <table className="w-full border-collapse text-xs">
                <tr>
                  <td className="border border-black p-2 text-right font-bold">Sub Total</td>
                  <td className="border border-black p-2 text-center">{totals.subtotal}</td>
                </tr>
                <tr>
                  <td className="border border-black p-2 text-right font-bold">Tax</td>
                  <td className="border border-black p-2 text-center">{totals.tax}</td>
                </tr>
              </table>
            </div>
          </div>
          <div className="flex justify-between items-end mb-4">
            <div className="text-xs">
              <p><strong>IBAN NO:</strong> AE410547283001</p>
              <p><strong>CURRENCY:</strong> AED</p>
              <p><strong>ACCOUNT NAME:</strong> {receipt.paymentDetails?.bankDetails?.accountName || "NH FOODSTUFF TRADING LLC S.O.C"}</p>
              {receipt.paymentMode === "Cheque" && (
                <>
                  <p><strong>CHEQUE NUMBER:</strong> {receipt.paymentDetails?.chequeDetails?.chequeNumber || "-"}</p>
                  <p><strong>CHEQUE DATE:</strong> {receipt.paymentDetails?.chequeDetails?.chequeDate ? new Date(receipt.paymentDetails.chequeDetails.chequeDate).toLocaleDateString("en-GB") : "-"}</p>
                </>
              )}
              {receipt.paymentMode === "Online" && (
                <>
                  <p><strong>TRANSACTION ID:</strong> {receipt.paymentDetails?.onlineDetails?.transactionId || "-"}</p>
                  <p><strong>TRANSACTION DATE:</strong> {receipt.paymentDetails?.onlineDetails?.transactionDate ? new Date(receipt.paymentDetails.onlineDetails.transactionDate).toLocaleDateString("en-GB") : "-"}</p>
                </>
              )}
            </div>
            <div className="border-2 border-black p-4 bg-gray-100">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold">GRAND TOTAL</span>
                <span className="text-base font-bold">{totals.total}</span>
              </div>
            </div>
          </div>
          <div className="text-center mb-8">
            <p className="text-xs">Payment received in good order.</p>
          </div>
          <div className="flex justify-between pt-4">
            <div className="text-xs w-5/12">
              <p className="mb-8">Received by:</p>
              <div className="border-b border-black"></div>
            </div>
            <div className="text-xs w-5/12 text-right">
              <p className="mb-8">Prepared by:</p>
              <div className="border-b border-black"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptView;