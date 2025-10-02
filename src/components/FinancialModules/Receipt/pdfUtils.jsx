import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const downloadReceiptPDF = async (selectedReceipt, showToastMessage) => {
  try {
    setIsGeneratingPDF(true);
    const input = document.getElementById("receipt-content");
    if (!input) {
      showToastMessage("Receipt content not found!", "error");
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
        const clonedElement = clonedDoc.getElementById("receipt-content");
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

    const filename = `Receipt_${selectedReceipt.voucherNo}_${
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
};

export const printReceiptPDF = (selectedReceipt, showToastMessage) => {
  const receiptContent = document.getElementById("receipt-content");
  if (!receiptContent) {
    showToastMessage("Unable to open print dialog", "error");
    return;
  }

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToastMessage("Unable to open print dialog", "error");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt_${selectedReceipt.voucherNo}</title>
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
        ${receiptContent.innerHTML}
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