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
  if (!po) return null;
  const vendor = vendors.find((v) => v._id === po.vendorId);
  console.log(vendor);
  const isApproved = po.status === "APPROVED";

  /* -------------------------------------------------- TOTALS -------------------------------------------------- */
  const subtotal = po.items.reduce((s, i) => s + i.lineTotal, 0);
    const total = po.items.reduce((s, i) => s + i.rate, 0);
  const vatTotal = po.items.reduce((s, i) => s + i.vatAmount, 0);
  const grandTotal = subtotal + vatTotal;

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

    document.getElementById("copy-label").innerText = copyType;
    await new Promise((r) => setTimeout(r, 80));

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
      `${isApproved ? "INV" : "PO"}_${po.transactionNo}_${copyType.replace(
        " ",
        "_"
      )}.pdf`
    );
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      await generatePDF("Internal Copy");
      await generatePDF("Supplier Copy");
    } catch (e) {
      alert("PDF generation failed");
    } finally {
      setIsGeneratingPDF(false);
      document.getElementById("copy-label").innerText = "Supplier Copy";
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
          .received-block { margin-top:1.5rem; }
          .date-time      { text-align:center; margin-top:1.5rem; font-size:11px; }
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

          {/* ---------- HEADER (EN – LOGO – AR) ---------- */}
                    <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "4px",
  }}
>
  {/* ENGLISH DETAILS */}
  <div style={{ width: "35%" }}>
    <p
      style={{ margin: "1px 0", lineHeight: "1.3", fontSize: "11px" }}
    >
      {profileData.addressLine1}
      <br />
      Tel. : {profileData.phoneNumber}
      <br />
      E-mail: {profileData.email}
      <br />
      Website : {profileData.website}
      <br />
      <strong>VAT Number : {profileData.vatNumber}</strong>
    </p>
  </div>

  {/* CENTER: ENGLISH NAME – ARABIC NAME – LOGO – TITLE */}
  <div style={{ textAlign: "center", width: "30%" }}>
    <h2
      style={{
        margin: "0 0 2px",
        fontWeight: "bold",
        fontSize: "13px",
      }}
    >
      NAJM ALHUDA FOODSTUFF TRADING LLC S.O.C.
    </h2>
    <h2
      style={{
        margin: "2px 0 0",
        fontWeight: "bold",
        fontSize: "13px",
        direction: "rtl",
        fontFamily: "'Noto Sans Arabic',Arial,sans-serif",
      }}
    >
      {profileData.companyNameArabic}
    </h2>
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
    <h1
      style={{
        margin: "0",
        fontSize: "16px",
        fontWeight: "bold",
        letterSpacing: "0.8px",
      }}
    >
      PURCHASE ORDER
    </h1>
  </div>

  {/* EMPTY RIGHT FOR ALIGNMENT */}
  <div style={{ width: "35%" }}></div>
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
              <strong>{vendor?.vendorName}</strong>
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
                      {new Date(po.date).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "2px 6px" }}>
                      <strong>Payment Terms</strong>
                    </td>
                    <td style={{ padding: "2px 6px" }}>
                      {vendor.paymentTerms || "CASH ON DELIVERY"}
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
                  // "PKGS",
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
              {po.items.map((it, idx) => {
                const rateKg =
                  it.qty > 0 ? (it.rate / it.qty).toFixed(2) : "0.00";
                const line = it.rate.toFixed(2);
                const vat = it.vatAmount.toFixed(2);
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
                      {it.sku}
                    </td>
                    <td style={{ border: "1px solid #000", padding: "4px" }}>
                      {it.description}
                    </td>
                    {/* <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                      }}
                    >
                      1
                    </td> */}
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "4px",
                        textAlign: "center",
                      }}
                    >
                      {it.qty.toFixed(2)}
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
              })}
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
                    {total.toFixed(2)}
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
                    {vatTotal.toFixed(2)}
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
                    {subtotal.toFixed(2)}
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
              <strong>VEHICLE NUMBER & NAME OF DRIVER :</strong> _______________
            </div>
            <div>
              <strong>Manager :</strong> STORE
            </div>
          </div>

          {/* ---------- TERMS & CONDITIONS ---------- */}
          

          {/* ---------- FOOTER (BANK + SIGNATURE) ---------- */}
          <div className="grid grid-cols-2 gap-4 mt-6 text-xs footer-grid">
            {/* BANK DETAILS (LEFT) */}
            <div className="footer-left">
              <strong>BANK DETAILS</strong>
              <div>Bank : {profileData.bankName}</div>
              <div>Account Name : {profileData.accountName}</div>
              <div>Account No. : {profileData.accountNumber}</div>
              <div>IBAN : {profileData.ibanNumber}</div>
              <div>
                Currency : AED
                {/* Branch : {profileData.branch} | Swift Code :{" "}
                {profileData.swiftCode} */}
              </div>
            </div>

            {/* SIGNATURE & COMPANY NOTE (RIGHT) */}
            <div className="footer-right">
              <div>
                This is computer generated{" "}
                {isApproved ? "invoice" : "purchase order"}.
              </div>
              <div>Therefore signature is not required.</div>
              <div className="mt-2">
                <strong>For {profileData.companyName}</strong>
              </div>

              <div className="received-block">
                Received the above goods in good order and condition.
              </div>
              <div className="mt-8"></div>
              <div>Received by</div>
            </div>
          </div>

         
        </div>
      </div>
    </div>
  );
};

export default InvoiceView;
