import React, { useState } from "react";
import { ArrowLeft, Download, Send, Loader2, Printer } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

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
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  if (!selectedInvoice) return null;

  const party = parties.find((p) => p._id === selectedInvoice.partyId);
  const totals = calculateTotals(selectedInvoice.entries || []);

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const input = document.getElementById("invoice-content");
      if (!input) {
        alert("Invoice content not found!");
        return;
      }

      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: input.scrollWidth,
        height: input.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(
        pdfWidth / (imgWidth * 0.264583),
        pdfHeight / (imgHeight * 0.264583)
      );
      const imgX = (pdfWidth - imgWidth * 0.264583 * ratio) / 2;

      pdf.addImage(
        imgData,
        "PNG",
        imgX,
        0,
        imgWidth * 0.264583 * ratio,
        imgHeight * 0.264583 * ratio,
        undefined,
        "FAST"
      );
      const filename = `${voucherType.toUpperCase()}_${
        selectedInvoice.voucherNo
      }_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(
        "Failed to generate PDF. Please try again or use the Print option."
      );
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrintPDF = () => {
    const printWindow = window.open("", "_blank");
    const invoiceContent = document.getElementById("invoice-content");

    if (!invoiceContent || !printWindow) {
      alert("Unable to open print dialog");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${voucherType.toUpperCase()}_${
      selectedInvoice.voucherNo
    }</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; line-height: 1.4; color: #000; }
            @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
            table { border-collapse: collapse; width: 100%; }
            th, td { padding: 8px; text-align: left; border: 1px solid #000; }
          </style>
        </head>
        <body>
          ${invoiceContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleSendToParty = () => {
    alert(
      `${
        voucherType.charAt(0).toUpperCase() + voucherType.slice(1)
      } Invoice sent to ${party?.customerName || party?.vendorName || "party"}!`
    );
  };

  const handleBackClick = () => {
    setSelectedInvoice(null);
    setActiveView("list");
  };

  const isSale = voucherType === "sale";
  const title = isSale ? "SALE INVOICE" : "PURCHASE INVOICE";
  const partyName = party?.customerName || party?.vendorName || "Unknown";
  const partyAddress = party?.address?.split("\n") || ["", ""];
  const partyVatNumber = party?.vatNumber || "N/A";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleBackClick}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to List</span>
          </button>
          <div className="flex space-x-3">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isGeneratingPDF ? "Generating..." : "Download PDF"}</span>
            </button>
            <button
              onClick={handlePrintPDF}
              className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print PDF</span>
            </button>
            <button
              onClick={handleSendToParty}
              className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Send to {isSale ? "Customer" : "Vendor"}</span>
            </button>
          </div>
        </div>
        <div
          id="invoice-content"
          className="bg-white shadow-lg"
          style={{
            width: "210mm",
            minHeight: "297mm",
            margin: "0 auto",
            padding: "20mm",
            fontSize: "12px",
            lineHeight: "1.4",
            fontFamily: "Arial, sans-serif",
            color: "#000",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: "20px",
              borderBottom: "2px solid #8B5CF6",
              paddingBottom: "15px",
            }}
          >
            <h1
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                margin: "0 0 5px 0",
                direction: "rtl",
              }}
            >
              نجم لتجارة المواد الغذائية ذ.م.م ش.ش.و
            </h1>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                margin: "0 0 15px 0",
                color: "#0f766e",
              }}
            >
              NH FOODSTUFF TRADING LLC S.O.C.
            </h2>
            <div
              style={{
                backgroundColor: "#c8a2c8",
                color: "white",
                padding: "8px",
                margin: "0 -20mm 20px -20mm",
              }}
            >
              <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: "0" }}>
                {title}
              </h3>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "20px",
              fontSize: "10px",
            }}
          >
            <div>
              <p style={{ margin: "2px 0" }}>Dubai, UAE</p>
              <p style={{ margin: "2px 0" }}>VAT Reg. No: 10503303</p>
              <p style={{ margin: "2px 0" }}>Email: finance@nhfo.com</p>
              <p style={{ margin: "2px 0" }}>Phone: +971 58 724 2111</p>
              <p style={{ margin: "2px 0" }}>Web: www.nhfo.com</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <img
                src="https://res.cloudinary.com/dmkdrwpfp/image/upload/v1755452581/erp_Uploads/NH%20foods_1755452579855.jpg"
                alt="NH Foods Logo"
                style={{ width: "80px", height: "80px", objectFit: "contain" }}
              />
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "2px 0" }}>
                Date:{" "}
                {new Date(selectedInvoice.date).toLocaleDateString("en-GB")}
              </p>
              <p style={{ margin: "2px 0" }}>
                Invoice: {selectedInvoice.voucherNo}
              </p>
              <p style={{ margin: "2px 0" }}>
                Status: {selectedInvoice.approvalStatus}
              </p>
            </div>
          </div>
          <div
            style={{
              backgroundColor: "#e6d7e6",
              padding: "10px",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "bold",
                    marginBottom: "5px",
                  }}
                >
                  Bill To:
                </div>
                <div style={{ fontSize: "10px" }}>
                  <p style={{ margin: "2px 0", fontWeight: "bold" }}>
                    {partyName}
                  </p>
                  <p style={{ margin: "2px 0" }}>{partyAddress[0]}</p>
                  <p style={{ margin: "2px 0" }}>{partyAddress[1] || ""}</p>
                  <p style={{ margin: "2px 0" }}>
                    Tel: {party?.phone || "N/A"}
                  </p>
                </div>
              </div>
              <div style={{ fontSize: "10px" }}>
                <p style={{ margin: "2px 0" }}>VAT Reg. No:</p>
                <p style={{ margin: "2px 0", fontWeight: "bold" }}>
                  {partyVatNumber}
                </p>
              </div>
            </div>
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "20px",
              fontSize: "10px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#e6d7e6" }}>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Line
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "left",
                    fontWeight: "bold",
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Account
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Debit
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Credit
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Tax
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {selectedInvoice.entries.map((entry, index) => (
                <tr key={index}>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "6px",
                      textAlign: "center",
                    }}
                  >
                    {index + 1}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>
                    {entry.description}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "6px",
                      textAlign: "center",
                    }}
                  >
                    {entry.accountName}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "6px",
                      textAlign: "center",
                    }}
                  >
                    {entry.debitAmount.toFixed(2)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "6px",
                      textAlign: "center",
                    }}
                  >
                    {entry.creditAmount.toFixed(2)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "6px",
                      textAlign: "center",
                    }}
                  >
                    {entry.taxAmount.toFixed(2)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "6px",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {(entry.debitAmount || entry.creditAmount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "20px",
            }}
          >
            <div style={{ width: "45%" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: "bold",
                  marginBottom: "10px",
                }}
              >
                BANK DETAILS:
              </div>
              <div style={{ fontSize: "10px", lineHeight: "1.5" }}>
                <p style={{ margin: "2px 0" }}>
                  <strong>BANK:</strong> NATIONAL BANK OF ABUDHABI
                </p>
                <p style={{ margin: "2px 0" }}>
                  <strong>ACCOUNT NO:</strong> 087989283001
                </p>
              </div>
            </div>
            <div style={{ width: "40%" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "10px",
                }}
              >
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    Sub Total
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    {totals.subtotal.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    VAT
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    {totals.tax.toFixed(2)}
                  </td>
                </tr>
              </table>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: "20px",
            }}
          >
            <div style={{ fontSize: "10px", lineHeight: "1.5" }}>
              <p style={{ margin: "2px 0" }}>
                <strong>IBAN NO:</strong> AE410547283001
              </p>
              <p style={{ margin: "2px 0" }}>
                <strong>CURRENCY:</strong> AED
              </p>
              <p style={{ margin: "2px 0" }}>
                <strong>ACCOUNT NAME:</strong> NH FOODSTUFF TRADING LLC S.O.C
              </p>
            </div>
            <div
              style={{
                border: "2px solid #000",
                padding: "10px 20px",
                backgroundColor: "#f9f9f9",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "15px" }}
              >
                <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                  GRAND TOTAL
                </span>
                <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                  {totals.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: "30px" }}>
            <div style={{ textAlign: "center", marginBottom: "30px" }}>
              <p style={{ fontSize: "11px", margin: "0" }}>
                {isSale ? "Sale invoice issued" : "Returned goods"} in good
                order and condition.
              </p>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "20px",
              }}
            >
              <div style={{ fontSize: "11px", width: "45%" }}>
                <p style={{ margin: "0 0 30px 0" }}>Received by:</p>
                <div
                  style={{
                    borderBottom: "1px solid #000",
                    marginBottom: "5px",
                  }}
                ></div>
              </div>
              <div
                style={{ fontSize: "11px", width: "45%", textAlign: "right" }}
              >
                <p style={{ margin: "0 0 30px 0" }}>Prepared by:</p>
                <div
                  style={{
                    borderBottom: "1px solid #000",
                    marginBottom: "5px",
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceView;
