// The QR code for an authenticator app, drawn in the browser from the otpauth:// address. The library is loaded only when a
// person actually sets two-factor up, so it is not part of the main bundle (nor of any page that does not need it).
export async function qrDataUrl(text) {
  const QRCode = (await import("qrcode")).default;
  // Black on white with a quiet zone: a phone camera reads that in any theme, dark mode included.
  return QRCode.toDataURL(text, { errorCorrectionLevel: "M", margin: 2, width: 216, color: { dark: "#000000", light: "#ffffff" } });
}
