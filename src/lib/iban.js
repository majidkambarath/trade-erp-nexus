// IBAN checksum (ISO 13616 mod 97), the same check the server makes, so a mistyped digit is caught
// before the form is sent.
export const normalizeIban = (s) => String(s || "").replace(/\s+/g, "").toUpperCase();

export function isValidIban(value) {
  const v = normalizeIban(value);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v)) return false;
  if (v.startsWith("AE") && v.length !== 23) return false; // a UAE IBAN is always 23 characters
  let remainder = 0;
  for (const ch of v.slice(4) + v.slice(0, 4)) {
    const digits = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}
