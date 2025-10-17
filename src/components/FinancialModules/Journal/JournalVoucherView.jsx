import React, { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Download, Printer, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import DirhamIcon from "../../../assets/dirham.svg";
import axiosInstance from "../../../axios/axios";

const JournalVoucherView = ({
  selectedVoucher,
  transactors,
  setSelectedVoucher,
  showToastMessage,
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

  if (!selectedVoucher) return null;

  const formatCurrency = (amount, colorClass = "text-black") => {
    const numAmount = Number(amount) || 0;
    const absAmount = Math.abs(numAmount).toFixed(2);
    const isNegative = numAmount < 0;
    return (
      <span className={`inline-flex items-center ${colorClass}`}>
        {isNegative && "-"}
        <img src={DirhamIcon} alt="AED" className="w-4 h-4 mr-1" />
        {absAmount}
      </span>
    );
  };

  const displayAccount = (account) => {
    if (typeof account === "object" && account) {
      return account.accountName || "Unknown";
    }
    const trans = transactors.find((t) => t.accountCode === account);
    return trans ? trans.accountName : account || "Unknown";
  };

  const handleDownloadPDF = useCallback(async () => {
    try {
      setIsGeneratingPDF(true);
      const input = document.getElementById("journal-content");
      if (!input) {
        showToastMessage("Journal content not found!", "error");
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
          const clonedElement = clonedDoc.getElementById("journal-content");
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

      const filename = `Journal_${selectedVoucher.voucherNo}_${
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
  }, [selectedVoucher, showToastMessage]);

  const handlePrintPDF = useCallback(() => {
    const printWindow = window.open("", "_blank");
    const journalContent = document.getElementById("journal-content");

    if (!journalContent || !printWindow) {
      showToastMessage("Unable to open print dialog", "error");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Journal_${selectedVoucher.voucherNo}</title>
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
            .dirham-icon { width: 10px; height: 10px; vertical-align: middle; margin-right: 2px; }
          </style>
        </head>
        <body>
          ${journalContent.innerHTML.replace(
            /<img[^>]*src="${DirhamIcon}"[^>]*>/g,
            `<img src="${DirhamIcon}" class="dirham-icon" alt="AED">`
          )}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }, [selectedVoucher, showToastMessage]);

  const handleBackToList = () => {
    setSelectedVoucher(null);
  };

  const entries = Array.isArray(selectedVoucher.entries) ? selectedVoucher.entries : [];
  const totals = {
    total: Number(selectedVoucher.totalAmount || selectedVoucher.amount || 0),
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleBackToList}
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
          </div>
        </div>
        <div
          id="journal-content"
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
              { "نجم لتجارة المواد الغذائية ذ.م.م ش.ش.و"}
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
                JOURNAL VOUCHER
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
                alt="Company Logo"
                style={{
                  width: "80px",
                  height: "80px",
                  objectFit: "contain",
                }}
              />
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "2px 0" }}>
                Date: {new Date(selectedVoucher.date).toLocaleDateString("en-GB")}
              </p>
              <p style={{ margin: "2px 0" }}>
                Voucher No: {selectedVoucher.voucherNo}
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
                  Journal Details:
                </div>
                <div style={{ fontSize: "10px" }}>
                  <p style={{ margin: "2px 0" }}>
                    <strong>Debit Account:</strong>{" "}
                    {displayAccount(selectedVoucher.debitAccount)}
                  </p>
                  <p style={{ margin: "2px 0" }}>
                    <strong>Credit Account:</strong>{" "}
                    {displayAccount(selectedVoucher.creditAccount)}
                  </p>
                  <p style={{ margin: "2px 0" }}>
                    <strong>Narration:</strong>{" "}
                    {selectedVoucher.narration || "-"}
                  </p>
                </div>
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
                  Account Code
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Account Name
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Debit Amount
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Credit Amount
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                  }}
                >
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry._id || index}>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>
                    {entry.accountCode || "-"}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>
                    {entry.accountName || "-"}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>
                    {entry.debitAmount}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "6px", textAlign: "center" }}>
                    {entry.creditAmount}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "6px" }}>
                    {entry.description || "-"}
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
                BANK DETAILS:-
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
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    Total
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    {totals.total}
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
                  {totals.total}
                </span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: "30px" }}>
            <div style={{ textAlign: "center", marginBottom: "30px" }}>
              <p style={{ fontSize: "11px", margin: "0" }}>
                Journal entry issued in good order.
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
                <p style={{ margin: "0 0 30px 0" }}>Approved by:</p>
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

export default JournalVoucherView;