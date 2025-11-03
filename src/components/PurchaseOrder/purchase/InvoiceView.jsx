/*  InvoiceView.jsx  */
import React, { useEffect, useState } from "react";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import axiosInstance from "../../../axios/axios";

const InvoiceView = ({
  selectedPO,
  vendors,
  setActiveView,
  createdPO,
  setSelectedPO,
  setCreatedPO,
}) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [profileData, setProfileData] = useState({
    companyName: " NAJM ALHUDA FOODSTUFF TRADING LLC S.O.C. ",
    companyNameArabic: "نجم الهدى لتجارة المواد الغذائية ذ.م.م ش.ش.و",
    addressLine1: "Dubai Investment Park",
    addressLine2: "P.O. Box: 3352 - DUBAI - U.A.E.",
    phoneNumber: "+971 4 8857575",
    email: "corporate@elfab.ae",
    website: "www.elfabshop.com",
    vatNumber: "100000266500003",
    logo: null,
    bankName: "EMIRATES NBD",
    accountNumber: "1011024652501",
    accountName: "ELFAB CO L L C",
    ibanNumber: "AE550260001011024652501",
    swiftCode: "EBILAEAD",
    branch: "AL SOUK BRANCH",
  });

  const adminId = sessionStorage.getItem("adminId");
  const token = sessionStorage.getItem("accessToken");

  /* -------------------------------------------------- PROFILE -------------------------------------------------- */
  useEffect(() => {
    const load = async () => {
      if (!adminId || !token) return;
      try {
        const { data } = await axiosInstance.get("/profile/me");
        if (data.success) {
          const d = data.data;
          setProfileData((p) => ({
            ...p,
            companyName: d.companyInfo?.companyName || p.companyName,
            companyNameArabic:
              d.companyInfo?.companyNameArabic || p.companyNameArabic,
            addressLine1: d.companyInfo?.addressLine1 || p.addressLine1,
            addressLine2: d.companyInfo?.addressLine2 || p.addressLine2,
            phoneNumber: d.companyInfo?.phoneNumber || p.phoneNumber,
            fax: d.companyInfo?.fax || p.fax,
            email: d.companyInfo?.emailAddress || p.email,
            website: d.companyInfo?.website || p.website,
            vatNumber: d.companyInfo?.vatNumber || p.vatNumber,
            logo: d.companyInfo?.companyLogo?.url || p.logo,
            bankName: d.companyInfo?.bankDetails?.bankName || p.bankName,
            accountNumber:
              d.companyInfo?.bankDetails?.accountNumber || p.accountNumber,
            accountName:
              d.companyInfo?.bankDetails?.accountName || p.accountName,
            ibanNumber: d.companyInfo?.bankDetails?.ibanNumber || p.ibanNumber,
            swiftCode: d.companyInfo?.bankDetails?.swiftCode || p.swiftCode,
            branch: d.companyInfo?.bankDetails?.branch || p.branch,
          }));
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [adminId, token]);

  const po = createdPO || selectedPO;
  console.log("PO Value......");
  console.log(po);
  if (!po) return null;
  const vendor = vendors.find((v) => v._id === po.vendorId);
  console.log("DEBUG: Full vendor object:", vendor);  // ENHANCED: Better logging
  const isApproved = po.status === "APPROVED";

  /* -------------------------------------------------- TOTALS -------------------------------------------------- */
  // SAFEGUARD: Handle empty items
  const safeItems = po.items || [];
  const subtotal = safeItems.reduce((s, i) => s + (i.rate || 0), 0);
  const vatTotal = safeItems.reduce((s, i) => s + (i.vatAmount || 0), 0);  // FIX: Fallback for missing vatAmount
  const grandTotal = subtotal + vatTotal;
  console.log("DEBUG: Totals - Subtotal:", subtotal, "VAT:", vatTotal, "Grand:", grandTotal);  // TEMP: Verify calculations

  const numberToWords = (n) => {
    const a = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ];
    const b = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    if (n === 0) return "Zero";
    let w = "";
    if (n >= 100) {
      w += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      w += b[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) w += a[n] + " ";
    return w.trim();
  };
  const amountInWords = `${numberToWords(
    Math.floor(grandTotal)
  )} Dirhams and ${Math.round((grandTotal % 1) * 100)} Fils Only`;

  /* -------------------------------------------------- PDF / PRINT -------------------------------------------------- */
  const generatePDF = async (copyType) => {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");

    if (copyType) {
      document.getElementById("copy-label").innerText = copyType;
      await new Promise((r) => setTimeout(r, 80));
    }

    const el = document.getElementById("invoice-content");
    const canvas = await html2canvas(el, {
      scale: 3,
      useCORS: true,
      backgroundColor: "#fff",
      width: el.scrollWidth,
      height: el.scrollHeight,
    });
    const img = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = 210;
    const pdfH = 297;
    const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(img, "PNG", (pdfW - w) / 2, (pdfH - h) / 2, w, h);
    pdf.save(
      `${isApproved ? "INV" : "PO"}_${po.transactionNo}${copyType ? `_${copyType.replace(/ /g, "_")}` : ""}.pdf`
    );
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      if (isApproved) {
        await generatePDF("Internal Copy");
        await generatePDF("Supplier Copy");
      } else {
        await generatePDF("");
      }
    } catch (e) {
      alert("PDF generation failed");
    } finally {
      setIsGeneratingPDF(false);
      if (isApproved) {
        document.getElementById("copy-label").innerText = "Supplier Copy";
      }
    }
  };

  const handlePrintPDF = () => {
    const printWindow = window.open("", "_blank");
    const invoiceEl = document.getElementById("invoice-content");

    // ---- 1. Grab the current date-time that is shown on screen ----
    const now = new Date().toLocaleString("en-GB"); // e.g. 28/10/2025, 17:03:05

    // ---- 2. Build the HTML for the print window ----
    const printHTML = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${po.transactionNo}</title>
        <style>
          @page { size: A4; margin:0; }
          html,body { margin:0; padding:0; height:100%; }
          #invoice-content {
            width:210mm; height:297mm; padding:10mm;
            box-sizing:border-box; font-family:Arial,Helvetica,sans-serif;
            font-size:11px; color:#000; background:#fff;
          }
          table { border-collapse:collapse; width:100%; font-size:11px; }
          th,td { border:1px solid #000; padding:4px; }
          .no-print { display:none; }

          /* ---- RE-CREATE THE FOOTER SPACING (same as Tailwind) ---- */
          .footer-grid { display:grid; grid-template-columns:1 1fr 1fr; gap:1rem; margin-top:1.5rem; font-size:11px; }
          .footer-left  strong { display:block; margin-bottom:0.2rem; }
          .footer-right { text-align:right; }
          .footer-right div { margin-bottom:0.1rem; }
        </style>
      </head>
      <body>
        ${invoiceEl.outerHTML}
        <!-- inject the live date-time -->
        <script>
          document.querySelector('.date-time').innerText = '${now}';
        </script>
      </body>
    </html>
  `;

    printWindow.document.write(printHTML);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handleBack = () => {
    setSelectedPO(null);
    setCreatedPO(null);
    setActiveView("list");
  };

  const terms = [
    // "Manual Correction of this invoice is not allowed",
    // "Receiving stamp is mandatory",
    // "In case of any mismatches in price/ item inform our respective salesperson",
    // "Goods return is only accepted if agreed by us with in agreed period and items should be in good condition",
    // "Payment should be processed and released as per above mentioned payment term without delay",
    // "Cash invoices should be paid at the time of delivery",
  ];

  /* -------------------------------------------------- JSX -------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* ---------- BUTTONS ---------- */}
        <div className="flex justify-between mb-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to List
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isGeneratingPDF ? "Generating…" : "Download PDF"}
            </button>

            <button
              onClick={handlePrintPDF}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>

        {/* ---------- A4 INVOICE (exact size) ---------- */}
        <div
          id="invoice-content"
          style={{
            width: "210mm",
            height: "297mm",
            padding: "10mm",
            background: "#fff",
            fontFamily: "Arial,Helvetica,sans-serif",
            fontSize: "11px",
            color: "#000",
            position: "relative",
            boxSizing: "border-box",
          }}
        >
          {/* ---------- COPY LABEL ---------- */}
          {isApproved && (
            <div
              style={{
                textAlign: "center",
                fontWeight: "bold",
                marginBottom: "2px",
                margin: "25px",
              }}
            >
              <span id="copy-label">Supplier Copy</span>
            </div>
          )}

          {/* ---------- HEADER (Centered: LOGO – AR – EN – ADDRESS – VAT – TITLE) ---------- */}
          <div
            style={{
              textAlign: "center",
              marginBottom: "4px",
            }}
          >
            {profileData.logo && (
              <img
                src={profileData.logo}
                alt="Company Logo"
                style={{
                  width: "110px",
                  height: "auto",
                  marginBottom: "2px",
                  display: "block",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              />
            )}
            <h2
              style={{
                margin: "2px 0",
                fontWeight: "bold",
                fontSize: "13px",
                direction: "rtl",
                fontFamily: "'Noto Sans Arabic',Arial,sans-serif",
              }}
            >
              {profileData.companyNameArabic}
            </h2>
            <h2
              style={{
                margin: "2px 0",
                fontWeight: "bold",
                fontSize: "13px",
              }}
            >
              {profileData.companyName}
            </h2>
            <p
              style={{
                margin: "1px 0",
                lineHeight: "1.3",
                fontSize: "11px",
              }}
            >
              {profileData.addressLine1}
              <br />
              {profileData.phoneNumber}
              {/* <br />
              {profileData.addressLine2} */}
            </p>
            <p
              style={{
                margin: "1px 0",
                fontSize: "14px",
                fontWeight: "bold",
              }}
            >
              VAT Number : {profileData.vatNumber}
            </p>
            <h1
              style={{
                margin: "10px 0 0 0",
                fontSize: "16px",
                fontWeight: "bold",
                letterSpacing: "0.8px",
              }}
            >
              {isApproved ? "PURCHASE ORDER " : "PURCHASE"}  {/* FIX: Clarified title */}
            </h1>
          </div>

          {/* ---------- CUSTOMER & INVOICE INFO ---------- */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "6px",
              fontSize: "11px",
            }}
          >
            <div>
              <p>
                <strong>Vendor ID :</strong> {vendor?.vendorId || "N/A"}
              </p>
              <p>
                <strong>{vendor?.vendorName || "Unknown Vendor"}</strong>  {/* FIX: Better fallback */}
              </p>
              <p>{vendor?.address || "P.O. BOX - 3352 DUBAI U.A.E 3352"}</p>
              <p>
                <strong>VAT Number :</strong>{" "}
                {vendor?.trnNO || "Not Provided"}
              </p>
              <p>
                <strong>Location / PO / Ref # :</strong> {po.transactionNo}
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <table
                style={{
                  display: "inline-table",
                  border: "1px solid #000",
                  fontSize: "11px",
                }}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        borderBottom: "1px solid #000",
                        padding: "2px 6px",
                      }}
                    >
                      <strong>No.</strong>
                    </td>
                    <td
                      style={{
                        borderBottom: "1px solid #000",
                        padding: "2px 6px",
                      }}
                    >
                      {po.transactionNo}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        borderBottom: "1px solid #000",
                        padding: "2px 6px",
                      }}
                    >
                      <strong>Date</strong>
                    </td>
                    <td
                      style={{
                        borderBottom: "1px solid #000",
                        padding: "2px 6px",
                      }}
                    >
                      {po.date ? new Date(po.date).toLocaleDateString("en-GB") : "N/A"}  {/* FIX: Safeguard date */}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        borderBottom: "1px solid #000",
                        padding: "2px 6px",
                      }}
                    >
                      <strong>Delivery Date</strong>
                    </td>
                    <td
                      style={{
                        borderBottom: "1px solid #000",
                        padding: "2px 6px",
                      }}
                    >
                      {po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString("en-GB") : "N/A"}  {/* FIX: Safeguard date */}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "2px 6px" }}>
                      <strong>Payment Terms</strong>
                    </td>
                    <td style={{ padding: "2px 6px" }}>
                      {vendor?.paymentTerms || "CASH ON DELIVERY"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------- ITEMS TABLE ---------- */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginBottom: "6px",
              fontSize: "11px",
            }}
          >
            <thead style={{ backgroundColor: "#fffacd" }}>
              <tr>
                {[
                  "SR",
                  "ITEM CODE",
                  "DESCRIPTION",
                  "QTY KG.",
                  "RATE AED/KG",
                  "AMOUNT AED.",
                  "VAT 5%",
                  "TOTAL AMOUNT AED.",
                ].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {safeItems.length > 0 ? (
                safeItems.map((it, idx) => {
                  console.log("DEBUG: Item:", it);  // FIX: Better logging (remove after testing)
                  const rateKg =
                    it.qty > 0 ? ((it.rate || 0) / it.qty).toFixed(2) : "0.00";
                  const line = (it.rate || 0).toFixed(2);
                  const vat = it.vatAmount || 0// FIX: Fallback
                  const total = (parseFloat(line) + parseFloat(vat)).toFixed(2);
                  return (
                    <tr key={idx}>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          textAlign: "center",
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          textAlign: "center",
                        }}
                      >
                        {it.itemCode || it.sku || ""}  {/* FIX: Use itemCode first, fallback to sku */}
                      </td>
                      <td style={{ border: "1px solid #000", padding: "4px" }}>
                        {it.description || "N/A"}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          textAlign: "center",
                        }}
                      >
                        {(it.qty || 0).toFixed(2)}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          textAlign: "center",
                        }}
                      >
                        {rateKg}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          textAlign: "center",
                        }}
                      >
                        {line}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          textAlign: "center",
                        }}
                      >
                        {vat}
                      </td>
                      <td
                        style={{
                          border: "1px solid #000",
                          padding: "4px",
                          textAlign: "center",
                        }}
                      >
                        {total}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} style={{ border: "1px solid #000", padding: "4px", textAlign: "center" }}>
                    No items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* ---------- TOTALS BOX (right side) ---------- */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "6px",
            }}
          >
            <table
              style={{
                width: "40%",
                borderCollapse: "collapse",
                fontSize: "11px",
              }}
            >
              <tbody>
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "right",
                    }}
                  >
                    <strong>AMOUNT AED.</strong>
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                    }}
                  >
                    {subtotal.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "right",
                    }}
                  >
                    <strong>VAT 5%</strong>
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                    }}
                  >
                    {Number(vatTotal).toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "right",
                      fontWeight: "bold",
                    }}
                  >
                    <strong>TOTAL AMOUNT AED.</strong>
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      fontWeight: "bold",
                    }}
                  >
                    {grandTotal.toFixed(2)}
                  </td>
                </tr>
                {/* ADD: Display amount in words */}
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "right",
                      fontStyle: "italic",
                    }}
                  >
                    <strong>(In Words):</strong>
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "4px",
                      textAlign: "center",
                      fontStyle: "italic",
                    }}
                  >
                    {amountInWords}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ---------- VEHICLE LINE ---------- */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "4px",
              fontSize: "11px",
            }}
          >
            <div>
              <strong>Manager :</strong> STORE
            </div>
          </div>

          {/* ---------- TERMS & CONDITIONS ---------- */}
          

          {/* ---------- FOOTER (BANK + SIGNATURE) ---------- */}
          <div className="grid grid-cols-2 gap-4 mt-6 text-xs footer-grid">
            {/* BANK DETAILS (LEFT) */}
            <div className="footer-left">
              {/* <strong>BANK DETAILS</strong>
              <div>Bank : {profileData.bankName}</div>
              <div>Account Name : {profileData.accountName}</div>
              <div>Account No. : {profileData.accountNumber}</div>
              <div>IBAN : {profileData.ibanNumber}</div> */}
              {/* <div>
                Currency : AED */}
                {/* Branch : {profileData.branch} | Swift Code :{" "}
                {profileData.swiftCode} */}
              {/* </div> */}
            </div>

            {/* SIGNATURE & COMPANY NOTE (RIGHT) */}
            <div className="footer-right">
              <div>
                This is a computer-generated document and does not require a signature.
              </div>
              <div className="mt-2">
                <strong>For {profileData.companyName}</strong>
              </div>
            </div>
          </div>

          {/* ---------- RECEIVED (BOTTOM CENTER) ---------- */}
          <div
            style={{
              textAlign: "center",
              marginTop: "1.5rem",
              fontSize: "11px",
            }}
          >
            <div style={{ marginBottom: "1.5rem" }}>
              Received the above goods in good order and condition.
            </div>
            <div>Received by</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceView;