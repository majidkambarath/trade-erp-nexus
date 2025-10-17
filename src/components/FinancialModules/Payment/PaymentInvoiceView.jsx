import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  Download,
  Printer,
  Loader2,
} from "lucide-react";
import axiosInstance from "../../../axios/axios";

const PaymentInvoiceView = ({
  selectedPayment,
  vendors = [],
  onBack,
  voucherType = "payment",
  showToastMessage = (message, type) => console.log(message, type),
  additionalActions = null,
}) => {
  console.log(selectedPayment)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [profileData, setProfileData] = useState({
    companyName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateProvince: "",
    country: "United Arab Emirates",
    postalCode: "",
    phoneNumber: "",
    email: "",
    website: "",
    logo: null,
    bankName: "",
    accountNumber: "",
    accountName: "",
    ibanNumber: "",
    currency: "AED",
    vatNumber: "",
  });

  const adminId = sessionStorage.getItem("adminId");
  const token = sessionStorage.getItem("accessToken");

  useEffect(() => {
    const loadProfileData = async () => {
      if (!adminId || !token) {
        console.warn("Authentication required");
        return;
      }

      try {
        const response = await axiosInstance.get("/profile/me");
        if (response.data.success) {
          const data = response.data.data;
          setProfileData({
            companyName: data.companyInfo?.companyName || "",
            addressLine1: data.companyInfo?.addressLine1 || "",
            addressLine2: data.companyInfo?.addressLine2 || "",
            city: data.companyInfo?.city || "",
            stateProvince: data.companyInfo?.state || "",
            country: data.companyInfo?.country || "United Arab Emirates",
            postalCode: data.companyInfo?.postalCode || "",
            phoneNumber: data.companyInfo?.phoneNumber || "",
            email: data.companyInfo?.emailAddress || data.email || "",
            website: data.companyInfo?.website || "",
            logo: data.companyInfo?.companyLogo?.url || null,
            bankName: data.companyInfo?.bankDetails?.bankName || "",
            accountNumber: data.companyInfo?.bankDetails?.accountNumber || "",
            accountName: data.companyInfo?.bankDetails?.accountName || "",
            ibanNumber: data.companyInfo?.bankDetails?.ibanNumber || "",
            currency: data.companyInfo?.bankDetails?.currency || "AED",
            vatNumber: data.companyInfo?.vatNumber || "",
          });
        }
      } catch (error) {
        console.error("Failed to load profile data:", error);
        showToastMessage(
          `Failed to load profile data: ${
            error.response?.data?.message || error.message
          }`,
          "error"
        );
      }
    };

    loadProfileData();
  }, [adminId, token, showToastMessage]);

  const asArray = (x) => (Array.isArray(x) ? x : []);

  const displayMode = (mode) => {
    const m = (mode || "").toString().toLowerCase();
    return m === "cash"
      ? "Cash"
      : m === "bank"
      ? "Bank"
      : m === "cheque"
      ? "Cheque"
      : m === "online"
      ? "Online"
      : mode || "Unknown";
  };

  const handleDownloadPDF = useCallback(async () => {
    try {
      setIsGeneratingPDF(true);
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const input = document.getElementById("payment-content");
      if (!input) {
        showToastMessage("Payment content not found!", "error");
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
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById("payment-content");
          if (clonedElement) {
            clonedElement.style.display = "block";
            clonedElement.style.visibility = "visible";
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

      const filename = `${voucherType.toUpperCase()}_${selectedPayment.voucherNo}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      pdf.save(filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      showToastMessage(
        "Failed to generate PDF. Please try again or use the Print option.",
        "error"
      );
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [selectedPayment, showToastMessage]);

  const handlePrintPDF = useCallback(() => {
    const printWindow = window.open("", "_blank");
    const paymentContent = document.getElementById("payment-content");

    if (!paymentContent || !printWindow) {
      showToastMessage("Unable to open print dialog", "error");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${voucherType.toUpperCase()}_${selectedPayment.voucherNo}</title>
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
          </style>
        </head>
        <body>
          ${paymentContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }, [selectedPayment, showToastMessage]);

  if (!selectedPayment) return null;

  const vendor = vendors.find(
    (v) =>
      v._id ===
      (typeof selectedPayment.partyId === "object"
        ? selectedPayment.partyId._id
        : selectedPayment.partyId)
  );

  // Calculate totals based on voucher type and available data
  const totals = voucherType === "payment" 
    ? asArray(selectedPayment.linkedInvoices).reduce(
        (acc, inv) => ({
          total: acc.total + (Number(inv.amount) || 0),
        }),
        { total: 0 }
      )
    : selectedPayment.totals || (() => {
        // Check if we have items (for sales/purchase orders)
        const items = asArray(selectedPayment.items);
        if (items.length > 0) {
          const subtotal = items.reduce((sum, item) => {
            const value = parseFloat(item.rate) || 0;
            return sum + value;
          }, 0);
          
          const tax = items.reduce((sum, item) => {
            const value = parseFloat(item.rate) || 0;
            const taxPercent = parseFloat(item.taxPercent) || 0;
            return sum + (value * (taxPercent / 100));
          }, 0);
          
          return {
            subtotal,
            tax,
            total: subtotal + tax,
          };
        }
        console.log(selectedPayment)
        // Calculate totals from entries if not provided
        const entries = asArray(selectedPayment.entries);
        const totalDebit = entries.reduce((sum, e) => sum + (e.debitAmount || 0), 0);
        const totalCredit = entries.reduce((sum, e) => sum + (e.creditAmount || 0), 0);
        const totalTax = entries.reduce((sum, e) => sum + (e.taxAmount || 0), 0);
        
        return {
          subtotal: Math.max(totalDebit, totalCredit), // Use the larger of debit or credit
          tax: totalTax,
          total: Math.max(totalDebit, totalCredit) + totalTax,
          totalDebit,
          totalCredit,
        };
      })();

  const getTitle = (type) => {
    switch (type) {
      case "payment":
        return "PAYMENT VOUCHER";
      case "sale":
      case "sales":
        return "SALE INVOICE";
      case "purchase":
      case "purchases":
        return "PURCHASE INVOICE";
      case "receipt":
        return "RECEIPT VOUCHER";
      case "contra":
        return "CONTRA VOUCHER";
      case "journal":
        return "JOURNAL VOUCHER";
      case "expense":
        return "EXPENSE VOUCHER";
      case "sales_return":
        return "SALES RETURN INVOICE";
      case "purchase_return":
        return "PURCHASE RETURN INVOICE";
      default:
        return "INVOICE";
    }
  };

  const title = getTitle(voucherType);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={onBack}
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
              <span>
                {isGeneratingPDF ? "Generating..." : "Download PDF"}
              </span>
            </button>
            <button
              onClick={handlePrintPDF}
              className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print PDF</span>
            </button>
            {additionalActions}
          </div>
        </div>
        <div
          id="payment-content"
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
              {"نجم لتجارة المواد الغذائية ذ.م.م ش.ش.و"}
            </h1>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                margin: "0 0 15px 0",
                color: "#0f766e",
              }}
            >
              {profileData.companyName || "NH FOODSTUFF TRADING LLC S.O.C."}
            </h2>
            <div
              style={{
                backgroundColor: "#c8a2c8",
                color: "white",
                padding: "8px",
                margin: "0 -20mm 20px -20mm",
              }}
            >
              <h3
                style={{ fontSize: "16px", fontWeight: "bold", margin: "0" }}
              >
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
              <p style={{ margin: "2px 0" }}>
                {profileData.city && profileData.country
                  ? `${profileData.city}, ${profileData.country}`
                  : "Dubai, UAE"}
              </p>
              <p style={{ margin: "2px 0" }}>
                VAT Reg. No: {profileData.vatNumber || "10503303"}
              </p>
              <p style={{ margin: "2px 0" }}>
                Email: {profileData.email || "finance@nhfo.com"}
              </p>
              <p style={{ margin: "2px 0" }}>
                Phone: {profileData.phoneNumber || "+971 58 724 2111"}
              </p>
              <p style={{ margin: "2px 0" }}>
                Web: {profileData.website || "www.nhfo.com"}
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <img
                src={
                  profileData.logo ||
                  "https://res.cloudinary.com/dmkdrwpfp/image/upload/v1755452581/erp_Uploads/NH%20foods_1755452579855.jpg"
                }
                alt="NH Foods Logo"
                style={{
                  width: "80px",
                  height: "80px",
                  objectFit: "contain",
                }}
              />
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "2px 0" }}>
                Date:{" "}
                {new Date(selectedPayment.date).toLocaleDateString("en-GB")}
              </p>
              <p style={{ margin: "2px 0" }}>
                Voucher No: {selectedPayment.voucherNo}
              </p>
              {voucherType === "payment" && (
                <p style={{ margin: "2px 0" }}>
                  Payment Mode: {displayMode(selectedPayment.paymentMode)}
                </p>
              )}
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
                  {voucherType === "payment" 
                    ? "Paid To:" 
                    : voucherType === "receipt"
                    ? "Received From:"
                    : "Bill To:"}
                </div>
                <div style={{ fontSize: "10px" }}>
                  <p style={{ margin: "2px 0", fontWeight: "bold" }}>
                    {selectedPayment.partyName || selectedPayment.vendorName}
                  </p>
                  <p style={{ margin: "2px 0" }}>
                    {vendor?.address?.split("\n")[0] || ""}
                  </p>
                  <p style={{ margin: "2px 0" }}>
                    {vendor?.address?.split("\n")[1] || ""}
                  </p>
                  <p style={{ margin: "2px 0" }}>
                    Tel: {vendor?.phone || "-"}
                  </p>
                </div>
              </div>
              <div style={{ fontSize: "10px" }}>
                <p style={{ margin: "2px 0" }}>VAT Reg. No:</p>
                <p style={{ margin: "2px 0", fontWeight: "bold" }}>
                  {vendor?.vatNumber || "-"}
                </p>
              </div>
            </div>
          </div>
          
          {/* Dynamic Table based on voucher type and available data */}
          {asArray(selectedPayment.entries || []).length > 0 ? (
            // Entries Table - Show entries (for payment, receipt, journal, contra vouchers)
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
                {asArray(selectedPayment.entries || []).map((entry, index) => (
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
                      {entry.description || entry.narration || "-"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {entry.accountName || entry.account || "-"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {(entry.debitAmount || 0).toFixed(2)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {(entry.creditAmount || 0).toFixed(2)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {(entry.taxAmount || 0).toFixed(2)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                        fontWeight: "bold",
                      }}
                    >
                      {(entry.debitAmount || entry.creditAmount || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : voucherType === "payment" && asArray(selectedPayment.linkedInvoices).length > 0 ? (
            // Fallback: Payment Voucher Table - Show linked invoices if no entries
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
                    Invoice No
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
                    Amount
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {asArray(selectedPayment.linkedInvoices).map((inv, index) => (
                  <tr key={index}>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {inv.invoiceId?.transactionNo ||
                        inv.transactionNo ||
                        inv.invoiceId ||
                        "N/A"}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "6px" }}>
                      {selectedPayment.narration || "-"}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {Number(inv.amount).toFixed(2)}
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "6px",
                        textAlign: "center",
                      }}
                    >
                      {Number(inv.balance).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : asArray(selectedPayment.items || []).length > 0 ? (
            // Items-based Invoice Table (for sales/purchase orders)
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
                    Item Code
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
                    Rate
                  </th>
                  <th
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    Tax %
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
                {asArray(selectedPayment.items || []).map((item, index) => {
                  const qty = parseFloat(item.qty) || 0;
                  const rate = parseFloat(item.rate) / qty || 0;
                  const taxPercent = parseFloat(item.taxPercent) || 0;
                  const value = parseFloat(item.rate) || 0;
                  const taxAmount = value * (taxPercent / 100);
                  const amount = value + taxAmount;
                  
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
                      <td style={{ border: "1px solid #000", padding: "6px" }}>
                        {item.itemCode || "-"}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "6px" }}>
                        {item.description || "-"}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "6px",
                          textAlign: "center",
                        }}
                      >
                        {qty.toFixed(2)}
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
                        {taxPercent.toFixed(2)}%
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "6px",
                          textAlign: "center",
                          fontWeight: "bold",
                        }}
                      >
                        {amount.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            // No entries or invoices to display
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                border: "1px solid #ddd",
                marginBottom: "20px",
                backgroundColor: "#f9f9f9",
              }}
            >
              <p style={{ margin: 0, color: "#666" }}>
                No {voucherType === "payment" ? "linked invoices" : 
                    asArray(selectedPayment.items || []).length > 0 ? "items" : "entries"} 
                available for this {voucherType === "payment" ? "payment" : "invoice"}.
              </p>
            </div>
          )}
          
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
                  <strong>BANK:</strong>{" "}
                  {profileData.bankName || "NATIONAL BANK OF ABUDHABI"}
                </p>
                <p style={{ margin: "2px 0" }}>
                  <strong>ACCOUNT NO:</strong>{" "}
                  {profileData.accountNumber || "087989283001"}
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
                  <>
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
                        {totals.subtotal?.toFixed(2) || totals.total.toFixed(2)}
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
                        {totals.tax?.toFixed(2) || "0.00"}
                      </td>
                    </tr>
                  </>
              
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
                <strong>IBAN NO:</strong>{" "}
                {profileData.ibanNumber || "AE410547283001"}
              </p>
              <p style={{ margin: "2px 0" }}>
                <strong>CURRENCY:</strong> {profileData.currency || "AED"}
              </p>
              <p style={{ margin: "2px 0" }}>
                <strong>ACCOUNT NAME:</strong>{" "}
                {profileData.accountName || "NH FOODSTUFF TRADING LLC S.O.C"}
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
                {voucherType === "payment"
                  ? "Payment issued in good order."
                  : "Invoice issued in good order and condition."}
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
                <p style={{ margin: "0 0 30px 0" }}>
                  {voucherType === "payment" ? "Received by:" : "Received by:"}
                </p>
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

export default PaymentInvoiceView;
