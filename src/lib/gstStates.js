// India's GST state and union territory codes (the first two digits of a GSTIN). The twin of trade ERP node/utils/gstStates.js;
// the server stays the authority, this is for drawing a select and printing a name.
export const GST_STATES = [
  ["01", "Jammu and Kashmir"], ["02", "Himachal Pradesh"], ["03", "Punjab"], ["04", "Chandigarh"], ["05", "Uttarakhand"],
  ["06", "Haryana"], ["07", "Delhi"], ["08", "Rajasthan"], ["09", "Uttar Pradesh"], ["10", "Bihar"], ["11", "Sikkim"],
  ["12", "Arunachal Pradesh"], ["13", "Nagaland"], ["14", "Manipur"], ["15", "Mizoram"], ["16", "Tripura"], ["17", "Meghalaya"],
  ["18", "Assam"], ["19", "West Bengal"], ["20", "Jharkhand"], ["21", "Odisha"], ["22", "Chhattisgarh"], ["23", "Madhya Pradesh"],
  ["24", "Gujarat"], ["26", "Dadra and Nagar Haveli and Daman and Diu"], ["27", "Maharashtra"], ["29", "Karnataka"], ["30", "Goa"],
  ["31", "Lakshadweep"], ["32", "Kerala"], ["33", "Tamil Nadu"], ["34", "Puducherry"], ["35", "Andaman and Nicobar Islands"],
  ["36", "Telangana"], ["37", "Andhra Pradesh"], ["38", "Ladakh"], ["97", "Other territory"], ["99", "Centre jurisdiction"],
];

const NAMES = Object.fromEntries(GST_STATES);

export const stateName = (code) => NAMES[String(code ?? "")] || "";

// "29 - Karnataka" for a code, "" for none or an unknown one
export const placeLabel = (code) => (stateName(code) ? `${code} - ${stateName(code)}` : "");

// The state a GSTIN belongs to (its first two digits), or "" when they are not a real code.
export const stateCodeOfGstin = (gstin) => {
  const m = /^(\d{2})/.exec(String(gstin ?? "").trim());
  return m && NAMES[m[1]] ? m[1] : "";
};

// A union territory without a legislature charges UTGST where a state charges SGST; the amount is the same.
export const secondHalfLabel = (code) => (["04", "26", "31", "35", "38"].includes(String(code)) ? "UTGST" : "SGST");
