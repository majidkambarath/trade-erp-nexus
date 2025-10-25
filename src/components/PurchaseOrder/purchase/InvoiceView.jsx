import React, { useEffect, useState } from "react";
import { ArrowLeft, Download, Send, Loader2, Printer } from "lucide-react";
import axiosInstance from "../../../axios/axios";

const InvoiceView = ({
  selectedPO,
  vendors,
  calculateTotals,
  setActiveView,
  createdPO,
  setSelectedPO,
  setCreatedPO,
}) => {
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
        alert("Authentication required");
        return;
      }

      try {
        const response = await axiosInstance.get("/profile/me");
        if (response.data.success) {
          const data = response.data.data;
          setProfileData({
            companyName: data.companyInfo?.companyName || "WOOHOO KITCHEN",
            addressLine1: data.companyInfo?.addressLine1 || "Loading Bay, G01 & G03, Ground Floor",
            addressLine2: data.companyInfo?.addressLine2 || "Kempinski, The Boulevard Dubai",
            city: data.companyInfo?.city || "Downtown Dubai",
            stateProvince: data.companyInfo?.state || "",
            country: data.companyInfo?.country || "United Arab Emirates",
            postalCode: data.companyInfo?.postalCode || "",
            phoneNumber: data.companyInfo?.phoneNumber || "+971 50 5894738",
            email: data.companyInfo?.emailAddress || data.email || "contact@woohookitchen.com",
            website: data.companyInfo?.website || "www.woohookitchen.com",
            logo: data.companyInfo?.companyLogo?.url || null,
            bankName: data.companyInfo?.bankDetails?.bankName || "Emirates NBD",
            accountNumber: data.companyInfo?.bankDetails?.accountNumber || "1234567890",
            accountName: data.companyInfo?.bankDetails?.accountName || "WOOHOO KITCHEN LLC",
            ibanNumber: data.companyInfo?.bankDetails?.ibanNumber || "AE123456789012345678901",
            currency: data.companyInfo?.bankDetails?.currency || "AED",
            vatNumber: data.companyInfo?.vatNumber || "1048471625000003",
          });
        }
      } catch (error) {
        console.error("Failed to load profile data:", error);
        alert(
          `Failed to load profile data: ${
            error.response?.data?.message || error.message
          }`
        );
      }
    };

    loadProfileData();
  }, [adminId, token]);

  const po = createdPO || selectedPO;
  if (!po) return null;
  const vendor = vendors.find((v) => v._id === po.vendorId);

  const subtotal = po.items.reduce((sum, item) => sum + item.lineTotal, 0);
  const vatAmount = subtotal * 0.05;
  const grandTotal = subtotal + vatAmount;

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

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
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById("invoice-content");
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

      const filename = `PO_${po.transactionNo}_${
        new Date().toISOString().split("T")[0]
      }.pdf`;
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
          <title>PO_${po.transactionNo}</title>
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

  const handleSendToVendor = () => {
    alert("Purchase Order sent to vendor!");
  };

  const handleBackClick = () => {
    setSelectedPO(null);
    setCreatedPO(null);
    setActiveView("list");
  };

  // Terms and Conditions
  const termsAndConditions = [
    "Payment is due within 30 days from the invoice date.",
    "Goods remain the property of the seller until fully paid.",
    "Late payments may incur a 2% monthly interest charge.",
    "All deliveries must be inspected upon receipt, and any discrepancies reported within 48 hours.",
    "Returns are subject to prior approval and must be in original condition.",
  ];

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
              onClick={handleSendToVendor}
              className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Send to Vendor</span>
            </button>
          </div>
        </div>

        <div
          id="invoice-content"
          className="bg-white shadow-lg rounded-lg"
          style={{
            width: "210mm",
            minHeight: "297mm",
            margin: "0 auto",
            padding: "20mm 15mm",
            fontSize: "11px",
            lineHeight: "1.5",
            fontFamily: "Arial, sans-serif",
            color: "#000",
          }}
        >
          {/* Header Section */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ width: "50%" }}>
              {profileData.logo && (
                <img
                  src={profileData.logo}
                  alt="Company Logo"
                  style={{
                    width: "150px",
                    height: "auto",
                    marginBottom: "10px",
                    objectFit: "contain",
                  }}
                />
              )}
              <h2 style={{ fontSize: "14px", fontWeight: "bold", margin: "0" }}>
                {profileData.companyName}
              </h2>
              <p style={{ margin: "5px 0 0 0", fontSize: "10px" }}>
                {profileData.addressLine1}
                {profileData.addressLine2 && `, ${profileData.addressLine2}`}
                <br />
                {profileData.city}
                {profileData.stateProvince && `, ${profileData.stateProvince}`}
                {profileData.postalCode && `, ${profileData.postalCode}`}
                <br />
                {profileData.country}
                <br />
                Tel: {profileData.phoneNumber}
                <br />
                Email: {profileData.email}
                <br />
                Website: {profileData.website}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  borderTop: "2px solid #000",
                  borderBottom: "2px solid #000",
                  padding: "5px 0",
                  margin: "0 0 10px 0",
                }}
              >
                <h1
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    margin: "0",
                    letterSpacing: "1px",
                  }}
                >
                  PURCHASE ORDER
                </h1>
              </div>
              <p style={{ margin: "0 0 5px 0", fontSize: "10px" }}>
                <strong>VAT Reg. No.:</strong> {profileData.vatNumber}
              </p>
            </div>
          </div>

          {/* Two Column Layout - Vendor Info and Order Details */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "20px",
              fontSize: "10px",
              borderTop: "1px solid #ccc",
              paddingTop: "10px",
            }}
          >
            {/* Left Column - Vendor Info */}
            <div style={{ width: "48%" }}>
              <p
                style={{
                  margin: "0 0 5px 0",
                  fontWeight: "bold",
                  fontSize: "12px",
                }}
              >
                To: {vendor?.vendorName || "NAJM ALHUDA FOODSTUFF TRADING LLC"}
              </p>
              <p style={{ margin: "0 0 5px 0" }}>
                Address: {vendor?.address || "Not Provided"}
              </p>
              <p style={{ margin: "0 0 5px 0" }}>Tel: {vendor?.phone || "Not Provided"}</p>
              <p style={{ margin: "0 0 5px 0" }}>TRN No: {vendor?.traNo || "Not Provided"}</p>
              <p style={{ margin: "0 0 5px 0" }}>Email: {vendor?.email || "Not Provided"}</p>
            </div>

            {/* Right Column - Order Details */}
            <div style={{ width: "48%", textAlign: "right" }}>
              <p style={{ margin: "0 0 5px 0" }}>
                <strong>Order No:</strong> {po.transactionNo}
              </p>
              <p style={{ margin: "0 0 5px 0" }}>
                <strong>Order Date:</strong>{" "}
                {new Date(po.date || Date.now()).toLocaleDateString("en-GB")}
              </p>
              <p style={{ margin: "0 0 5px 0" }}>
                <strong>Requested By:</strong> {profileData.companyName}
              </p>
              <p style={{ margin: "0 0 5px 0" }}>
                <strong>Request No.:</strong> {po.requestNo || "i25-30157"}
              </p>
              <p style={{ margin: "0 0 5px 0" }}>
                <strong>Delivery Date:</strong>{" "}
                {po.deliveryDate
                  ? new Date(po.deliveryDate).toLocaleDateString("en-GB")
                  : "Not Specified"}
              </p>
            </div>
          </div>

          {/* Delivery Information */}
          <div style={{ marginBottom: "20px", fontSize: "10px" }}>
            <p style={{ margin: "0 0 5px 0" }}>
              <strong>Delivery To:</strong>{" "}
              {po.deliveryAddress || `${profileData.addressLine1}, ${profileData.addressLine2}, ${profileData.city}, ${profileData.country}`}
            </p>
            <p style={{ margin: "0 0 5px 0" }}>
              <strong>Contact Person:</strong>{" "}
              {po.contactPerson || profileData.phoneNumber}
            </p>
            <p style={{ margin: "0 0 10px 0" }}>
              <strong>Payment Terms:</strong> {po.paymentTerms || "Due on Receipt"}
            </p>
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
              <tr>
                <th
                  style={{
                    border: "1px solid #000",
                    borderBottom: "2px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    backgroundColor: "#f5f5f5",
                  }}
                >
                  Article
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    borderBottom: "2px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    backgroundColor: "#f5f5f5",
                  }}
                >
                  Unit
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    borderBottom: "2px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    backgroundColor: "#f5f5f5",
                  }}
                >
                  Qty
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    borderBottom: "2px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    backgroundColor: "#f5f5f5",
                  }}
                >
                  Unit Price
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    borderBottom: "2px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    backgroundColor: "#f5f5f5",
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item, index) => (
                <tr key={index}>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "left",
                    }}
                  >
                    {item.description}
                    {item.note && (
                      <div
                        style={{
                          fontSize: "9px",
                          fontStyle: "italic",
                          color: "#666",
                        }}
                      >
                        {item.note}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    {item.unit || "N/A"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    {item.qty.toFixed(2)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    {(item.rate / item.qty).toFixed(2)}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    {item.rate.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Section */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "20px",
              fontSize: "10px",
            }}
          >
            <tbody>
              <tr>
                <td
                  style={{
                    border: "none",
                    borderLeft: "1px solid #000",
                    borderRight: "1px solid #000",
                    padding: "8px",
                  }}
                ></td>
                <td
                  style={{
                    border: "none",
                    borderRight: "1px solid #000",
                    padding: "8px",
                  }}
                ></td>
                <td
                  style={{
                    border: "none",
                    borderRight: "1px solid #000",
                    padding: "8px",
                  }}
                ></td>
                <td
                  style={{
                    border: "1px solid #000",
                    borderTop: "2px solid #000",
                    padding: "8px",
                    textAlign: "right",
                    fontWeight: "bold",
                  }}
                >
                  NET TOTAL
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    borderTop: "2px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  {profileData.currency}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    borderTop: "2px solid #000",
                    padding: "8px",
                    textAlign: "right",
                  }}
                >
                  {subtotal.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "none",
                    borderLeft: "none",
                    borderRight: "none",
                    padding: "8px",
                  }}
                ></td>
                <td
                  style={{
                    border: "none",
                    borderRight: "none",
                    padding: "8px",
                  }}
                ></td>
                <td
                  style={{
                    border: "none",
                    borderRight: "1px solid #000",
                    padding: "8px",
                  }}
                ></td>
                <td
                  style={{
                    border: "1px solid #000",
                    borderTop: "none",
                    padding: "8px",
                    textAlign: "right",
                    fontWeight: "bold",
                  }}
                >
                  VAT 5%
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    borderTop: "none",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  {profileData.currency}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    borderTop: "none",
                    padding: "8px",
                    textAlign: "right",
                  }}
                >
                  {vatAmount.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "none",
                    borderTop: "none",
                    borderBottom: "none",
                    padding: "8px",
                  }}
                ></td>
                <td
                  style={{
                    border: "none",
                    borderTop: "none",
                    borderBottom: "none",
                    padding: "8px",
                  }}
                ></td>
                <td
                  style={{
                    border: "none",
                    borderTop: "none",
                    borderBottom: "none",
                    padding: "8px",
                  }}
                ></td>
                <td
                  style={{
                    border: "1px solid #000",
                    borderTop: "none",
                    borderBottom: "2px solid #000",
                    padding: "8px",
                    textAlign: "right",
                    fontWeight: "bold",
                  }}
                >
                  GRAND TOTAL
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    borderTop: "none",
                    borderBottom: "2px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  {profileData.currency}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    borderTop: "none",
                    borderBottom: "2px solid #000",
                    padding: "8px",
                    textAlign: "right",
                    fontWeight: "bold",
                  }}
                >
                  {grandTotal.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Terms and Conditions */}
          <div style={{ marginBottom: "20px", fontSize: "10px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: "bold", margin: "0 0 10px 0" }}>
              Terms and Conditions
            </h3>
            <ul style={{ margin: "0", paddingLeft: "20px" }}>
              {termsAndConditions.map((term, index) => (
                <li key={index} style={{ marginBottom: "5px" }}>
                  {term}
                </li>
              ))}
            </ul>
          </div>

          {/* Footer - Page Number */}
          <div
            style={{
              textAlign: "right",
              fontSize: "9px",
              marginTop: "20px",
              borderTop: "1px solid #ccc",
              paddingTop: "10px",
            }}
          >
            <p style={{ margin: "0" }}>Page: 1/1</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceView;