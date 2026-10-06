// Printing and PDF for every order and invoice document. The sheet is rendered to markup from the
// same React component the screen uses, then drawn inside its own frame. That frame has no app
// stylesheet, so the theme's modern colour functions cannot reach the PDF renderer. This is what
// made the list's download fail: it captured the live app page instead.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import InvoiceSheet from "./InvoiceSheet";

const A4_MM = { w: 210, h: 297 };
// 210mm at 96dpi: the width the sheet is laid out at.
const SHEET_PX = 794;

// The page markup for one copy of a document.
export const sheetMarkup = (sheet, { copy, accent }) =>
  renderToStaticMarkup(<InvoiceSheet {...sheet} copy={copy} accent={accent} />);

// A frame holding one copy, loaded and ready to be captured or printed. It sits off screen, so
// the user never sees it, but it has full layout size, which is what both the PDF and print need.
const loadFrame = (markup) =>
  new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${SHEET_PX}px;height:1600px;border:0`;
    frame.onload = () => resolve(frame);
    frame.onerror = () => reject(new Error("The document frame could not load"));
    frame.srcdoc =
      '<!doctype html><html><head><meta charset="utf-8">' +
      "<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}</style>" +
      `</head><body>${markup}</body></html>`;
    document.body.appendChild(frame);
  });

// Adds one copy to the PDF. A sheet taller than an A4 page is cut into page-high slices rather
// than shrunk until the text is unreadable.
const addCopyPages = (pdf, canvas, startOnNewPage) => {
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
    pdf.addImage(part.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, A4_MM.w, h / pxPerMm);
  }
};

// One PDF with one copy after another, each starting on a new page.
export const downloadSheetsPdf = async (markups, fileName) => {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4");
  for (const [i, markup] of markups.entries()) {
    const frame = await loadFrame(markup);
    try {
      const node = frame.contentDocument.body.firstElementChild;
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: SHEET_PX,
        windowWidth: SHEET_PX,
      });
      addCopyPages(pdf, canvas, i > 0);
    } finally {
      frame.remove();
    }
  }
  pdf.save(`${fileName}.pdf`);
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
