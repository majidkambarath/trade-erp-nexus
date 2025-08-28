import React, { useState } from "react";
import { ArrowLeft, Download, Send, Loader2, Printer } from "lucide-react";

const SalesReturnInvoiceView = ({
  selectedSO,
  createdSO,
  customers,
  calculateTotals,
  setActiveView,
  setSelectedSO,
  setCreatedSO,
}) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Use createdSO if it exists, otherwise fall back to selectedSO
  const so = createdSO || selectedSO;

  // Validate sales return order data
  if (!so || !so.items || !Array.isArray(so.items)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">
            Invalid sales return order data. Please try again or contact support.
          </p>
          <button
            onClick={() => setActiveView("list")}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to List</span>
          </button>
        </div>
      </div>
    );
  }

  // Find customer details with fallback
  const customer = customers?.find((c) => c._id === so.customerId) || {
    customerName: "Unknown Customer",
    address: "N/A",
    phone: "N/A",
    vatNumber: "N/A",
  };

  // Calculate totals safely, using absolute values for display
  const totals = calculateTotals(so.items) || {
    subtotal: "0.00",
    tax: "0.00",
    total: "0.00",
  };
  const displayTotals = {
    subtotal: Math.abs(parseFloat(totals.subtotal)).toFixed(2),
    tax: Math.abs(parseFloat(totals.tax)).toFixed(2),
    total: Math.abs(parseFloat(totals.total)).toFixed(2),
  };

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const input = document.getElementById("invoice-content");
      if (!input) {
        throw new Error("Invoice content element not found");
      }

      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: input.scrollWidth,
        height: input.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById("invoice-content");
          if (clonedElement) {
            clonedElement.style.display = "block";
            clonedElement.style.visibility = "visible";
            const img = clonedElement.querySelector("img");
            if (img) {
              img.src = img.src; // Force reload to ensure CORS compliance
            }
          }
        },
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
      const imgY = 0;

      pdf.addImage(
        imgData,
        "PNG",
        imgX,
        imgY,
        imgWidth * 0.264583 * ratio,
        imgHeight * 0.264583 * ratio,
        undefined,
        "FAST"
      );

      const filename = `SR_${so.transactionNo || "Unknown"}_${new Date().toISOString().split("T")[0]}.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(`Failed to generate PDF: ${error.message}. Please try again or use the Print option.`);
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
          <title>SR_${so.transactionNo || "Unknown"}</title>
          <style>
            * { box-sizing: border-box; }
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif;
              line-height: 1.4;
              color: #000;
            }
            @media print { 
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
            table { border-collapse: collapse; width: 100%; }
            th, td { padding: 8px; text-align: left; border: 1px solid #000; }
            img { max-width: 80px; max-height: 80px; }
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

  const handleSendToCustomer = () => {
    alert("Sales Return Invoice sent to customer!");
    // TODO: Implement actual email integration here
  };

  const handleBackClick = () => {
    setSelectedSO(null);
    setCreatedSO(null);
    setActiveView("list");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Action Buttons */}
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
              onClick={handleSendToCustomer}
              className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Send to Customer</span>
            </button>
          </div>
        </div>

        {/* Invoice Content */}
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
          {/* Header Section */}
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
                SALES RETURN INVOICE
              </h3>
            </div>
          </div>

          {/* Company Details and Invoice Info */}
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
                onError={(e) => (e.target.src = "/path/to/fallback-logo.png")}
              />
            </div>

            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "2px 0" }}>
                Date: {new Date(so.date || Date.now()).toLocaleDateString("en-GB")}
              </p>
              <p style={{ margin: "2px 0" }}>Invoice: {so.transactionNo || "N/A"}</p>
              <p style={{ margin: "2px 0" }}>SR: {so.transactionNo || "N/A"}</p>
              <p style={{ margin: "2px 0" }}>
                Return Date: {new Date(so.deliveryDate || Date.now()).toLocaleDateString("en-GB")}
              </p>
            </div>
          </div>

          {/* Bill To and Reason Section */}
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
                    {customer.customerName || "N/A"}
                  </p>
                  <p style={{ margin: "2px 0" }}>
                    {customer.address?.split("\n")[0] || "N/A"}
                  </p>
                  <p style={{ margin: "2px 0" }}>
                    {customer.address?.split("\n")[1] || ""}
                  </p>
                  <p style={{ margin: "2px 0" }}>
                    Tel: {customer.phone || "N/A"}
                  </p>
                </div>
              </div>
              <div style={{ fontSize: "10px" }}>
                <p style={{ margin: "2px 0" }}>VAT Reg. No:</p>
                <p style={{ margin: "2px 0", fontWeight: "bold" }}>
                  {customer.vatNumber || "N/A"}
                </p>
                <p style={{ margin: "2px 0", fontWeight: "bold" }}>
                  Reason for Return:
                </p>
                <p style={{ margin: "2px 0" }}>
                  {so.reason || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Items Table */}
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
                  CODE
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "left",
                    fontWeight: "bold",
                  }}
                >
                  Item Description
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Qty
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Unit Price
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Value
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  VAT 5%
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Refund Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {so.items.map((item, index) => {
                const qty = parseFloat(item.qty) || 0;
                const rate = parseFloat(item.rate) || 0;
                const taxPercent = parseFloat(item.taxPercent) || 0;
                const value = Math.abs(qty * rate); // Display as positive
                const vat = Math.abs((value * taxPercent) / 100); // Display as positive
                const amount = Math.abs(value + vat); // Display as positive
                return (
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
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                      }}
                    >
                      {item.itemId || "N/A"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                      }}
                    >
                      {item.description || "N/A"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {Math.abs(qty).toFixed(2)} {/* Display as positive */}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {rate.toFixed(2)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {value.toFixed(2)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {vat.toFixed(2)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                        fontWeight: "bold",
                        color: "#e11d48", // Red to indicate refund
                      }}
                    >
                      {amount.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Bank Details and Totals */}
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
                BANK DETAILS:-
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
                    {displayTotals.subtotal}
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
                    VAT (5%)
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    {displayTotals.tax}
                  </td>
                </tr>
              </table>
            </div>
          </div>

          {/* IBAN Details and Grand Total */}
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "15px",
                }}
              >
                <span style={{ fontSize: "12px", fontWeight: "bold" }}>
                  TOTAL REFUNDED
                </span>
                <span style={{ fontSize: "14px", fontWeight: "bold", color: "#e11d48" }}>
                  {displayTotals.total}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div style={{ marginTop: "30px" }}>
            <div style={{ textAlign: "center", marginBottom: "30px" }}>
              <p style={{ fontSize: "11px", margin: "0" }}>
                Returned the above goods in accordance with the return policy.
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
                <p style={{ margin: "0 0 30px 0" }}>Returned by:</p>
                <div
                  style={{
                    borderBottom: "1px solid #000",
                    marginBottom: "5px",
                  }}
                ></div>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  width: "45%",
                  textAlign: "right",
                }}
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

export default SalesReturnInvoiceView;