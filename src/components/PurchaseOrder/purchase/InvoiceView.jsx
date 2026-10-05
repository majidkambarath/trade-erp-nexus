/* Purchase InvoiceView.jsx - aligned to Sales Invoice format */
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Loader2, Printer, Send } from "lucide-react";
import axiosInstance from "../../../axios/axios";
import {
  formatNumber,
  formatDateGB,
} from "../../../utils/format";
import { documentTotals } from "../../../utils/documentTotals";

// a stable stand-in while the party is not found (a new {} each render would re-run the effect below)
const NO_PARTY = {};

const PurchaseInvoiceView = ({
  selectedPO,
  createdPO,
  vendors = [],
  setActiveView,
  setSelectedPO,
  setCreatedPO,
}) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [profileData, setProfileData] = useState({
    companyName: "",
    companyNameArabic: "",
    addressLine1: "",
    addressLine2: "",
    phoneNumber: "",
    email: "",
    website: "",
    vatNumber: "",
    logo: null,
    bankName: "",
    accountNumber: "",
    accountName: "",
    ibanNumber: "",
    swiftCode: "",
    branch: "",
  });

  const adminId = sessionStorage.getItem("adminId");
  const token = sessionStorage.getItem("accessToken");

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
            branch: d.companyInfo?.branch || p.branch,
          }));
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, [adminId, token]);

  // The hooks below run on every render; the "nothing selected" return comes after them.
  const po = createdPO || selectedPO;
  const vendor = (po && vendors.find((v) => v._id === po.vendorId)) || NO_PARTY;
  const isApproved = po?.status === "APPROVED";

  // invoice meta: not editable in UI (display-only)
  const [invoiceMeta, setInvoiceMeta] = useState({
    // Prefer explicit vendorReference, then refNo
    reference: po?.vendorReference ?? po?.refNo ?? "",
    poNo: isApproved ? (po?.displayTransactionNo || po?.transactionNo) : po?.transactionNo,
    paymentTerms: vendor.paymentTerms || "COD",
  });

  useEffect(() => {
    if (!po) return;
    setInvoiceMeta((m) => ({
      ...m,
      reference: (po.vendorReference ?? po.refNo ?? m.reference ?? ""),
      poNo: isApproved ? (po.displayTransactionNo || po.transactionNo) : po.transactionNo,
      paymentTerms: vendor.paymentTerms || m.paymentTerms || "COD",
    }));
  }, [po, vendor, isApproved]);

  // totals
  // the server's own pricing (charges, header discount, round-off), not a re-sum of the lines
  const totals = useMemo(() => (po ? documentTotals(po) : { gross: 0, vat: 0, grandTotal: 0 }), [po]);
  const { gross: grossAmount, vat: vatTotal, grandTotal } = totals;

  if (!po) return null;

  // pdf generation
  const generatePDF = async (copyType) => {
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    document.getElementById("copy-label").innerText = copyType;
    await new Promise((r) => setTimeout(r, 80));
    const el = document.getElementById("invoice-content");
    const canvas = await html2canvas(el, { scale: 3, useCORS: true, backgroundColor: "#fff" });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = 210, pdfH = 297;
    const ratio = Math.min(pdfW / canvas.width, pdfH / canvas.height);
    const w = canvas.width * ratio, h = canvas.height * ratio;
    pdf.addImage(img, "PNG", (pdfW - w) / 2, (pdfH - h) / 2, w, h);
    const fname = `${isApproved ? "PINV" : "PO"}_${invoiceMeta.invoiceNo || (po.displayTransactionNo || po.transactionNo)}_${copyType.replace(/\s+/g, "_")}.pdf`;
    pdf.save(fname);
  };

  const handleBack = () => {
    setSelectedPO && setSelectedPO(null);
    setCreatedPO && setCreatedPO(null);
    setActiveView && setActiveView("list");
  };

  return (
    <div className="bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between mb-4">
          <button onClick={handleBack} className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded hover:bg-slate-700">
            <ArrowLeft className="w-4 h-4" /> Back to List
          </button>
          <div className="flex gap-3">
            <button onClick={async () => { setIsGeneratingPDF(true); try { await generatePDF("Internal Copy"); } finally { setIsGeneratingPDF(false); document.getElementById("copy-label").innerText = "Vendor Copy"; } }} disabled={isGeneratingPDF} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isGeneratingPDF ? "Generating…" : "Download (Internal Copy)"}
            </button>
            <button onClick={async () => { setIsGeneratingPDF(true); try { await generatePDF("Vendor Copy"); } finally { setIsGeneratingPDF(false); document.getElementById("copy-label").innerText = "Vendor Copy"; } }} disabled={isGeneratingPDF} className="flex items-center gap-2 px-5 py-2 bg-slate-600 text-white rounded hover:bg-slate-700 disabled:opacity-50">
              {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {isGeneratingPDF ? "Generating…" : "Copy (Vendor Copy)"}
            </button>
            <button onClick={() => { const w = window.open("", "_blank"); const invoiceEl = document.getElementById("invoice-content"); const now = new Date().toLocaleString("en-GB"); const printHTML = `<!doctype html><html><head><meta charset="utf-8"><title>PO</title><style>@page{size:A4;margin:0}html,body{margin:0;padding:0}#invoice-content{width:210mm;height:297mm;padding:10mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;background:#fff}table{border-collapse:collapse;width:100%}th,td{padding:6px 8px;border:0 solid #ccc}thead th{border-bottom:2px solid #000;padding:8px}tbody td{border-bottom:1px dotted #ccc}.right{text-align:right}.center{text-align:center}.small{font-size:10px}</style></head><body>${invoiceEl.outerHTML}<script>document.querySelector('.date-time').innerText='${now}';</script></body></html>`; w.document.write(printHTML); w.document.close(); setTimeout(()=>{w.focus(); w.print(); w.close();},300); }} className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded hover:bg-green-700"><Printer className="w-4 h-4" /> Print</button>
            <button onClick={() => alert("Sent")} className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Send className="w-4 h-4" /> Send</button>
          </div>
        </div>

        <div
          id="invoice-content"
          style={{
            width: "210mm",
            height: "297mm",
            padding: "10mm",
            background: "#fff",
            fontFamily: "Arial,Helvetica,sans-serif",
            fontSize: 11,
            color: "#000",
            boxSizing: "border-box",
          }}
        >
          <div style={{ textAlign: "right", fontWeight: "bold", marginBottom: 9 }}>
            <span id="copy-label">Vendor Copy</span>
          </div>

          {/* Header block: Arabic, English, contact, title */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div style={{ width: "18%", textAlign: "left" }}>
              {profileData.logo ? (
                <img src={profileData.logo} alt="logo" style={{ width: 110 }} />
              ) : (
                <div style={{ width: 100, height: 100 }} />
              )}
              {/* <div style={{ marginTop: 6, fontSize: 10 }}>
                <div><strong>VAT Reg. No:</strong> {profileData.vatNumber}</div>
              </div> */}
            </div>

            <div style={{ width: "52%", textAlign: "center", paddingLeft: 8, paddingRight: 8 }}>
              <div style={{ fontWeight: "700", direction: "rtl", fontSize: 13 }}>{profileData.companyNameArabic}</div>

              <div style={{ fontWeight: 800, fontSize: 15, marginTop: 4, whiteSpace: "nowrap" }}>
                {profileData.companyName}
              </div>

              <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.4 }}>
                <div>
                  {profileData.addressLine1 || "Dubai, United Arab Emirates."}
                  <span style={{ display: "inline-block", margin: "0 8px" }}>|</span>
                  <span>Tel: {profileData.phoneNumber || "+971 50 836 2661"}</span>
                </div>
                <div>
                  Email: {profileData.email || ""}
                  <span style={{ display: "inline-block", margin: "0 8px" }}>|</span>
                  Web: {profileData.website || ""}
                </div>
              </div>

              {/* VAT Reg. No centered above heading */}
              <div style={{ marginTop: 6, fontSize: 11 }}>
                <strong>VAT Reg. No:</strong> {profileData.vatNumber}
              </div>

              <div style={{ fontWeight: 700, textDecoration: "underline", marginTop: 6, fontSize: 13 }}>
                {isApproved ? "PURCHASE ORDER" : "PURCHASE"}
              </div>
            </div>

            <div style={{ width: "28%", textAlign: "right", fontSize: 11 }} />
          </div>

          {/* Vendor + meta */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ width: "58%", fontSize: 11 }}>
              <div style={{ fontWeight: 700 }}>VENDOR:</div>
              <div style={{ marginTop: 6 }}>{vendor.vendorId || ""}</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>{vendor.vendorName || ""}</div>
              <div style={{ marginTop: 4 }}>{vendor.address || profileData.addressLine1}</div>
              <div style={{ marginTop: 4 }}>TEL: {vendor.phone || profileData.phoneNumber}, Email: {vendor.email || profileData.email}</div>
              <div style={{ marginTop: 4 }}>VAT Reg. No: {vendor.trnNO || ""}</div>
            </div>

            <div style={{ width: "38%", textAlign: "right", fontSize: 11 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ textAlign: "left", minWidth: 120 }}>
                  <div style={{ fontWeight: 700 }}>Date:</div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>PO No</div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>Reference</div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>Payment Terms</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 140 }}>
                  <div style={{ marginTop: 0 }}>{formatDateGB(po.date)}</div>
                  <div style={{ marginTop: 6 }}>{invoiceMeta.poNo}</div>
                  <div style={{ marginTop: 6 }}>{invoiceMeta.reference || '-'}</div>
                  <div style={{ marginTop: 6 }}>{invoiceMeta.paymentTerms}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: "#000", marginBottom: 8 }} />

          {/* Items */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10, marginBottom: 10 }}>
            <thead>
              <tr style={{ background: "#fffacd" }}>
                <th style={{ width: 30, padding: "8px 6px", borderBottom: "1px solid #777", textAlign: "center" }}>Line</th>
                <th style={{ width: 64, padding: "8px 6px", borderBottom: "1px solid #777", textAlign: "center" }}>CODE</th>
                <th style={{ textAlign: "left", padding: "8px 10px 8px 22px", borderBottom: "1px solid #777" }}>Item Description</th>
                <th style={{ width: 60, padding: "8px 6px", borderBottom: "1px solid #777", textAlign: "center" }}>Qty</th>
                <th style={{ width: 72, padding: "8px 6px", borderBottom: "1px solid #777", textAlign: "center" }}>Unit price</th>
                <th style={{ width: 84, padding: "8px 6px", borderBottom: "1px solid #777", textAlign: "center" }}>Value</th>
                <th style={{ width: 54, padding: "8px 6px", borderBottom: "1px solid #777", textAlign: "center" }}>VAT %</th>
                <th style={{ width: 84, padding: "8px 6px", borderBottom: "1px solid #777", textAlign: "center" }}>VAT Amount</th>
                <th style={{ width: 120, padding: "8px 6px", borderBottom: "1px solid #777", textAlign: "center" }}>TOTAL AMT. AED<br />(INCL. VAT)</th>
              </tr>
            </thead>
            <tbody>
              {(po.items || []).map((it, idx) => {
                const qty = parseFloat(it.qty) || 0;
                const lineValue = parseFloat(it.rate) || 0; // treat as line value
                const unitPrice = qty > 0 ? (lineValue / qty) : 0;
                const vatAmt = parseFloat(it.vatAmount) || 0;
                const totalIncl = lineValue + vatAmt;
                return (
                  <tr key={idx}>
                    <td style={{ textAlign: "center", padding: "8px 6px", verticalAlign: "top" }}>{idx + 1}</td>
                    <td style={{ textAlign: "center", padding: "8px 6px", verticalAlign: "top" }}>{it.itemCode|| ""}</td>
                    <td style={{ padding: "8px 10px 8px 22px", verticalAlign: "top" }}>{it.description}</td>
                    <td style={{ textAlign: "center", padding: "8px 6px", verticalAlign: "top" }}>{qty}</td>
                    <td style={{ textAlign: "center", padding: "8px 6px", verticalAlign: "top" }}>{formatNumber(unitPrice)}</td>
                    <td style={{ textAlign: "center", padding: "8px 6px", verticalAlign: "top" }}>{formatNumber(lineValue)}</td>
                    <td style={{ textAlign: "center", padding: "8px 6px", verticalAlign: "top" }}>{it.vatPercent || 5}</td>
                    <td style={{ textAlign: "center", padding: "8px 6px", verticalAlign: "top" }}>{formatNumber(vatAmt)}</td>
                    <td style={{ textAlign: "center", padding: "8px 6px", verticalAlign: "top" }}>{formatNumber(totalIncl)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ minHeight: 40 }} />

          {/* totals block and bank details */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <div style={{ width: "58%", fontSize: 11 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>BANK DETAILS:-</div>
              <div style={{ marginTop: 3 }}>BANK : {profileData.bankName}</div>
              <div>ACCOUNT NO : {profileData.accountNumber}</div>
              <div>IBAN NO : {profileData.ibanNumber}</div>
              <div>CURRENCY : AED</div>
              <div>ACCOUNT NAME : {profileData.accountName}</div>
            </div>

            <div style={{ width: "38%", fontSize: 11 }}>
              <div style={{ border: "1px solid #000", padding: 8 }}>
                {/* <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>DISCOUNT (IF ANY)</div>
                  <div style={{ minWidth: 100, textAlign: "right" }}>{formatNumber(discount)}</div>
                </div> */}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>GROSS AMOUNT</div>
                  <div style={{ minWidth: 100, textAlign: "right" }}>{formatNumber(grossAmount)}</div>
                </div>
                {totals.charges.map((c, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>{(c.description || "Charge").toUpperCase()}</div>
                    <div style={{ minWidth: 100, textAlign: "right" }}>{formatNumber(c.amount)}</div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div>VAT (5%)</div>
                  <div style={{ minWidth: 100, textAlign: "right" }}>{formatNumber(vatTotal)}</div>
                </div>
                {totals.headerDiscount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>DISCOUNT</div>
                    <div style={{ minWidth: 100, textAlign: "right" }}>-{formatNumber(totals.headerDiscount)}</div>
                  </div>
                )}
                {totals.roundOff !== 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>ROUND OFF</div>
                    <div style={{ minWidth: 100, textAlign: "right" }}>{formatNumber(totals.roundOff)}</div>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid #000", fontWeight: 800 }}>
                  <div>GRAND TOTAL</div>
                  <div style={{ minWidth: 100, textAlign: "right" }}>{formatNumber(grandTotal)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* signature area and footer */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, alignItems: "flex-start" }}>
            <div style={{ width: "58%", fontSize: 10 }}>
              <div>This is computer generated document. Therefore signature is not required.</div>
              <div style={{ marginTop: 6 }}>For {profileData.companyName}</div>
            </div>

            <div style={{ width: "38%", textAlign: "center" }}>
              <div style={{ fontSize: 11, marginBottom: 6 }}>Received the above goods in good order and condition.</div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Received by</div>
              <div style={{ border: "1px solid #000", height: 82, width: "78%", marginLeft: "auto", marginRight: "auto" }} />
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 18, fontSize: 10 }}>Page 1 of 1</div>

          <div className="date-time" style={{ display: "none" }} />
        </div>
      </div>
    </div>
  );
};

export default PurchaseInvoiceView;
