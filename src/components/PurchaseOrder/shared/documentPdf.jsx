// Printing and PDF for every order and invoice document. The sheet is rendered to markup from the
// same React component the screen uses, then drawn inside its own frame. That frame has no app
// stylesheet, so the theme's modern colour functions cannot reach the PDF renderer. This is what
// made the list's download fail: it captured the live app page instead.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InvoiceSheet from "./InvoiceSheet";
import DeliverySheet from "./DeliverySheet";
import VoucherSheet from "../../finance/VoucherSheet";

const A4_MM = { w: 210, h: 297 };
// 210mm at 96dpi: the width the sheet is laid out at.
const SHEET_PX = 794;

// How sharply a copy is drawn. Download is the full page; email is a lighter one (about 120-220 KB a page
// instead of about 400), because a PDF that goes in an email is posted from the sender's browser, often
// over a phone connection, and some mail servers refuse a heavy attachment. Lowering only one of the two
// wastes most of the saving, so both move.
const RASTER = { download: { scale: 2, quality: 0.92 }, email: { scale: 1.5, quality: 0.82 } };

// Which page a document is drawn on. Invoices, orders, returns and quotations share the priced sheet;
// a delivery note and a pick list have their own (quantities, signatures), and a finance voucher has
// the debit/credit one, each named by `layout`. This is the registry every reader goes through -
// `sheetMarkup` for print and PDF, and `InvoiceScreen` for the preview - so a document cannot be
// drawn one way on screen and another on paper.
const LAYOUTS = { delivery: DeliverySheet, voucher: VoucherSheet };
export const sheetComponent = (sheet) => LAYOUTS[sheet?.layout] || InvoiceSheet;

// The page markup for one copy of a document.
export const sheetMarkup = (sheet, { copy, accent }) => {
  const Sheet = sheetComponent(sheet);
  return renderToStaticMarkup(<Sheet {...sheet} copy={copy} accent={accent} />);
};

// The sheets ask for Inter, but this frame is built from a bare srcdoc and inherits nothing from
// the app document - so without this link the text fell back to Arial, whose slash has a narrow
// left and a wide right sidebearing: a date printed as "09/11 /2026" while the screen, where Inter
// does load, showed it evenly. The same href as index.html, so it is already in the browser cache.
export const FONT_HREF = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap";

// How long to wait for that font before drawing anyway. A browser with no network still prints,
// in the fallback face, exactly as it did before this.
const FONT_WAIT_MS = 2000;

// The frame's load event fires before a webfont has been fetched, and html2canvas measures text the
// moment it is handed the node - so capturing without this wait would draw the fallback face and
// leave the bug exactly where it was.
const fontsReady = (frame) => {
  const fonts = frame.contentDocument?.fonts;
  if (!fonts?.ready) return Promise.resolve();
  return Promise.race([fonts.ready, new Promise((r) => setTimeout(r, FONT_WAIT_MS))]);
};

// The document the frame is loaded with. Exported so the font link can be tested: it is the whole
// of the fix for the clotted date, and nothing else in the suite renders this frame.
export const frameHtml = (markup) =>
  '<!doctype html><html><head><meta charset="utf-8">' +
  `<link rel="stylesheet" href="${FONT_HREF}">` +
  "<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}</style>" +
  `</head><body>${markup}</body></html>`;

// A frame holding one copy, loaded and ready to be captured or printed. It sits off screen, so
// the user never sees it, but it has full layout size, which is what both the PDF and print need.
const loadFrame = (markup) =>
  new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${SHEET_PX}px;height:1600px;border:0`;
    frame.onload = () => fontsReady(frame).then(() => resolve(frame));
    frame.onerror = () => reject(new Error("The document frame could not load"));
    frame.srcdoc = frameHtml(markup);
    document.body.appendChild(frame);
  });

// Adds one copy to the PDF. A sheet taller than an A4 page is cut into page-high slices rather
// than shrunk until the text is unreadable.
const addCopyPages = (pdf, canvas, startOnNewPage, quality) => {
  const pxPerMm = canvas.width / A4_MM.w;
  // Rounded up so a sheet that is one A4 page does not leave a 1px sliver for a second page.
  const sliceH = Math.ceil(A4_MM.h * pxPerMm);
  for (let y = 0, page = 0; y < canvas.height; y += sliceH, page += 1) {
    if (startOnNewPage || page > 0) pdf.addPage();
    const h = Math.min(sliceH, canvas.height - y);
    const part = document.createElement("canvas");
    part.width = canvas.width;
    part.height = h;
    part.getContext("2d").drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    // JPEG, not PNG: jsPDF embeds a PNG that carries an alpha channel uncompressed, which made the
    // two-copy file 20 MB. JPEG at this quality keeps a text page small.
    pdf.addImage(part.toDataURL("image/jpeg", quality), "JPEG", 0, 0, A4_MM.w, h / pxPerMm);
  }
};

// Every copy drawn into one PDF, one after another, each starting on a new page. Returned, not saved: the
// two ends differ only in what they do with it.
const renderSheetsPdf = async (markups, { scale, quality } = RASTER.download) => {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");
  for (const [i, markup] of markups.entries()) {
    const frame = await loadFrame(markup);
    try {
      const node = frame.contentDocument.body.firstElementChild;
      const canvas = await html2canvas(node, {
        scale,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: SHEET_PX,
        windowWidth: SHEET_PX,
      });
      addCopyPages(pdf, canvas, i > 0, quality);
    } finally {
      frame.remove();
    }
  }
  return pdf;
};

export const downloadSheetsPdf = async (markups, fileName) => {
  const pdf = await renderSheetsPdf(markups);
  pdf.save(`${fileName}.pdf`);
};

// The same page as the download, as a file, for attaching to an email. How many pages it came to is
// on the result, because the dialog tells the person before they send.
export const sheetsPdfFile = async (markups, fileName, options = RASTER.email) => {
  const pdf = await renderSheetsPdf(markups, options);
  const file = new File([pdf.output("blob")], `${fileName}.pdf`, { type: "application/pdf" });
  file.pageCount = typeof pdf.getNumberOfPages === "function" ? pdf.getNumberOfPages() : 1;
  return file;
};

// Prints one copy through the browser's print dialog. A frame is used rather than a popup window,
// which is often blocked.
export const printMarkup = async (markup) => {
  const frame = await loadFrame(markup);
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 1000);
  }, 100);
};
