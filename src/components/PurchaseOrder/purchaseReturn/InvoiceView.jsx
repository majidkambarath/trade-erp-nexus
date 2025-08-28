import React, { useState } from "react";
import { ArrowLeft, Download, Send, Loader2, Printer } from "lucide-react";

const InvoiceView = ({ selectedPO, vendors, calculateTotals, setActiveView, createdPO, setSelectedPO, setCreatedPO }) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // Use createdPO if it exists, otherwise fall back to selectedPO
  const po = createdPO || selectedPO;
  
  if (!po) return null;

  const vendor = vendors.find((v) => v._id === po.vendorId);
  const totals = calculateTotals(po.items);

  const handleDownloadPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      
      // Dynamic imports to ensure libraries are loaded
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
      const input = document.getElementById("invoice-content");
      if (!input) {
        alert("Invoice content not found!");
        return;
      }

      // Better canvas options for higher quality
      const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: input.scrollWidth,
        height: input.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById("invoice-content");
          if (clonedElement) {
            clonedElement.style.display = 'block';
            clonedElement.style.visibility = 'visible';
          }
        }
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / (imgWidth * 0.264583), pdfHeight / (imgHeight * 0.264583));
      
      const imgX = (pdfWidth - (imgWidth * 0.264583 * ratio)) / 2;
      const imgY = 0;
      
      pdf.addImage(
        imgData, 
        'PNG', 
        imgX, 
        imgY, 
        imgWidth * 0.264583 * ratio, 
        imgHeight * 0.264583 * ratio,
        undefined,
        'FAST'
      );
      
      const filename = `PR_${po.transactionNo}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      pdf.save(filename);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again or use the Print option.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrintPDF = () => {
    const printWindow = window.open('', '_blank');
    const invoiceContent = document.getElementById("invoice-content");
    
    if (!invoiceContent || !printWindow) {
      alert("Unable to open print dialog");
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PR_${po.transactionNo}</title>
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
    alert("Purchase Return Order sent to vendor!");
  };

  const handleBackClick = () => {
    setSelectedPO(null);
    setCreatedPO(null);
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
              <span>{isGeneratingPDF ? 'Generating...' : 'Download PDF'}</span>
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

        {/* Invoice Content */}
        <div 
          id="invoice-content" 
          className="bg-white shadow-lg"
          style={{ 
            width: '210mm', 
            minHeight: '297mm', 
            margin: '0 auto',
            padding: '20mm',
            fontSize: '12px',
            lineHeight: '1.4',
            fontFamily: 'Arial, sans-serif',
            color: '#000'
          }}
        >
          {/* Header Section */}
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #8B5CF6', paddingBottom: '15px' }}>
            <h1 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 5px 0', direction: 'rtl' }}>
              نجم لتجارة المواد الغذائية ذ.م.م ش.ش.و
            </h1>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 15px 0', color: '#0f766e' }}>
              NH FOODSTUFF TRADING LLC S.O.C.
            </h2>
            
            <div style={{ backgroundColor: '#c8a2c8', color: 'white', padding: '8px', margin: '0 -20mm 20px -20mm' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0' }}>PURCHASE RETURN INVOICE</h3>
            </div>
          </div>

          {/* Company Details and Invoice Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '10px' }}>
            <div>
              <p style={{ margin: '2px 0' }}>Dubai, UAE</p>
              <p style={{ margin: '2px 0' }}>VAT Reg. No: 10503303</p>
              <p style={{ margin: '2px 0' }}>Email: finance@nhfo.com</p>
              <p style={{ margin: '2px 0' }}>Phone: +971 58 724 2111</p>
              <p style={{ margin: '2px 0' }}>Web: www.nhfo.com</p>
            </div>

            <div style={{ textAlign: 'center' }}>
              <img
                src="https://res.cloudinary.com/dmkdrwpfp/image/upload/v1755452581/erp_Uploads/NH%20foods_1755452579855.jpg"
                alt="NH Foods Logo"
                style={{ width: '80px', height: '80px', objectFit: 'contain' }}
              />
            </div>

            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '2px 0' }}>Date: {new Date().toLocaleDateString("en-GB")}</p>
              <p style={{ margin: '2px 0' }}>Invoice: {po.transactionNo}</p>
              <p style={{ margin: '2px 0' }}>PR. NO: {po.transactionNo}</p>
            </div>
          </div>

          {/* Bill To Section */}
          <div style={{ backgroundColor: '#e6d7e6', padding: '10px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '5px' }}>Bill To:</div>
                <div style={{ fontSize: '10px' }}>
                  <p style={{ margin: '2px 0', fontWeight: 'bold' }}>{vendor?.vendorName}</p>
                  <p style={{ margin: '2px 0' }}>{vendor?.address.split("\n")[0]}</p>
                  <p style={{ margin: '2px 0' }}>{vendor?.address.split("\n")[1] || ''}</p>
                  <p style={{ margin: '2px 0' }}>Tel: {vendor?.phone}</p>
                </div>
              </div>
              <div style={{ fontSize: '10px' }}>
                <p style={{ margin: '2px 0' }}>VAT Reg. No:</p>
                <p style={{ margin: '2px 0', fontWeight: 'bold' }}>{vendor?.vatNumber}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#e6d7e6' }}>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Line</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>CODE</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Item Description</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Qty</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Unit price</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Value</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>VAT 5%</th>
                <th style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {po.items.map((item, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{index + 1}</td>
                  <td style={{ border: '1px solid #000', padding: '6px' }}>{item.itemId}</td>
                  <td style={{ border: '1px solid #000', padding: '6px' }}>{item.description}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.qty}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{item.rate}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{(item.qty * item.rate).toFixed(2)}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center' }}>{((item.qty * item.rate * item.taxPercent) / 100).toFixed(2)}</td>
                  <td style={{ border: '1px solid #000', padding: '6px', textAlign: 'center', fontWeight: 'bold' }}>{item.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bank Details and Totals */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ width: '45%' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '10px' }}>BANK DETAILS:-</div>
              <div style={{ fontSize: '10px', lineHeight: '1.5' }}>
                <p style={{ margin: '2px 0' }}><strong>BANK:</strong> NATIONAL BANK OF ABUDHABI</p>
                <p style={{ margin: '2px 0' }}><strong>ACCOUNT NO:</strong> 087989283001</p>
              </div>
            </div>

            <div style={{ width: '40%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Sub Total</td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{totals.subtotal}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>VAT (5%)</td>
                  <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center' }}>{totals.tax}</td>
                </tr>
              </table>
            </div>
          </div>

          {/* IBAN Details and Grand Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
            <div style={{ fontSize: '10px', lineHeight: '1.5' }}>
              <p style={{ margin: '2px 0' }}><strong>IBAN NO:</strong> AE410547283001</p>
              <p style={{ margin: '2px 0' }}><strong>CURRENCY:</strong> AED</p>
              <p style={{ margin: '2px 0' }}><strong>ACCOUNT NAME:</strong> NH FOODSTUFF TRADING LLC S.O.C</p>
            </div>

            <div style={{ border: '2px solid #000', padding: '10px 20px', backgroundColor: '#f9f9f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>GRAND TOTAL</span>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{totals.total}</span>
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div style={{ marginTop: '30px' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <p style={{ fontSize: '11px', margin: '0' }}>Returned the above goods in good order and condition.</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '20px' }}>
              <div style={{ fontSize: '11px', width: '45%' }}>
                <p style={{ margin: '0 0 30px 0' }}>Received by:</p>
                <div style={{ borderBottom: '1px solid #000', marginBottom: '5px' }}></div>
              </div>
              <div style={{ fontSize: '11px', width: '45%', textAlign: 'right' }}>
                <p style={{ margin: '0 0 30px 0' }}>Prepared by:</p>
                <div style={{ borderBottom: '1px solid #000', marginBottom: '5px' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceView;