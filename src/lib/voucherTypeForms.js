// Pure logic behind the Numbering screen (Accounting setup): what a number will look like before it is
// saved, and what the form refuses.
//
// A deliberate TWIN of the server's utils/voucherTypes.js, not an import - the two repositories share no
// code. The server is the authority and refuses anything this misses; this exists so a person sees the
// number change as they type, and sees why something cannot be saved without a round trip. Keep the two
// in step: the rules here are the subset a form needs.

export const SEPARATORS = [
  { value: "-", label: "Hyphen  SO-2026-0001" },
  { value: "/", label: "Slash  SO/2026/0001" },
  { value: "", label: "None  SO20260001" },
];

export const RESET_POLICIES = [
  { value: "yearly", label: "Every year", hint: "The count starts again at 1 in each fiscal year." },
  { value: "never", label: "Never", hint: "One count that carries on for good. The number cannot then carry the year." },
];

export const METHODS = [
  { value: "auto", label: "Given automatically", hint: "Nobody can type a number." },
  { value: "auto_override", label: "Automatic, can be typed over", hint: "The next number is filled in and can be changed. A duplicate is always refused." },
];

export const BRANCH_PREFIXES = [
  { value: "auto", label: "In front of the number", hint: "SHJ-SO-2026-0001 in a branch, SO-2026-0001 at head office." },
  { value: "none", label: "Not shown", hint: "Every branch counts in one series." },
];

export const KIND_LABELS = {
  voucher: "Finance vouchers",
  trade: "Sales and purchase",
  inventory: "Stock and production",
  crm: "CRM",
  system: "Written by the system",
};
export const KIND_ORDER = ["voucher", "trade", "inventory", "crm", "system"];

// India CGST Rule 46(b): a tax document's serial is 16 characters at most.
export const STATUTORY_MAX_LENGTH = 16;
export const CONTINUOUS = "ALL";

const clean = (v) => String(v == null ? "" : v).trim().toUpperCase();
const widthOf = (t) => Math.min(10, Math.max(3, Math.trunc(Number(t?.numberLength) || 4)));
const separatorOf = (t) => (SEPARATORS.some((s) => s.value === t?.separator) ? t.separator : "-");

/** The branch segment, or "" for none. Head office never carries one. */
export function branchPartOf(type, branchId) {
  if (!type || type.branchPrefix === "none") return "";
  const code = clean(branchId);
  if (!code || code === "MAIN") return "";
  const own = (type.branchPrefixes || []).find((b) => clean(b?.branchId) === code);
  return clean(own?.prefix || code);
}

/** What a number will read, e.g. "SO-2026-0001". */
export function previewNumber(type, { branchId = "main", yearCode = "2026", seq = 1 } = {}) {
  const sep = separatorOf(type);
  const parts = [];
  const branch = branchPartOf(type, branchId);
  if (branch) parts.push(branch);
  parts.push(clean(type?.prefix));
  if (type?.includeYear !== false && clean(yearCode)) parts.push(clean(yearCode));
  parts.push(String(Math.max(0, Math.trunc(Number(seq) || 0))).padStart(widthOf(type), "0"));
  if (clean(type?.suffix)) parts.push(clean(type.suffix));
  return parts.join(sep);
}

/** The longest it can ever read, which is what a length limit has to be judged against. */
export const longestNumber = (type, opts = {}) => previewNumber(type, { ...opts, seq: Math.pow(10, widthOf(type)) - 1 });

export const emptyVoucherType = (parent = null) => ({
  key: "",
  name: "",
  parentKey: parent ? parent.key : "",
  prefix: "",
  suffix: "",
  separator: "-",
  includeYear: true,
  numberLength: 4,
  resetPolicy: "yearly",
  branchPrefix: "auto",
  branchPrefixes: [],
  method: "auto",
  allowReuse: false,
  isActive: true,
});

const KEY_RE = /^[A-Z0-9]{2,8}$/;
const PREFIX_RE = /^[A-Z0-9]{1,10}$/;
const SUFFIX_RE = /^[A-Z0-9]{0,6}$/;
const isInt = (v, lo, hi) => Number.isInteger(Number(v)) && Number(v) >= lo && Number(v) <= hi;

/** Field errors as `{field: message}`. Things that are merely unusual are warnings, not errors. */
export function validateVoucherType(form = {}, { takenKeys = [], isNew = false, statutory = false, kind = "voucher", branches = [] } = {}) {
  const e = {};
  if (isNew) {
    const key = clean(form.key);
    if (!key) e.key = "A code is needed.";
    else if (!KEY_RE.test(key)) e.key = "The code is 2 to 8 letters or digits.";
    else if (takenKeys.map(clean).includes(key)) e.key = "That code is already in use.";
    if (!clean(form.parentKey)) e.parentKey = "Choose the type this is a variant of.";
  }
  const name = String(form.name || "").trim();
  if (!name) e.name = "A name is needed.";
  else if (name.length > 60) e.name = "The name is 60 characters at most.";

  const prefix = clean(form.prefix);
  if (!prefix) e.prefix = "A prefix is needed.";
  else if (!PREFIX_RE.test(prefix)) e.prefix = "The prefix is 1 to 10 letters or digits, and carries no separator of its own.";
  if (!SUFFIX_RE.test(clean(form.suffix))) e.suffix = "The suffix is up to 6 letters or digits.";
  if (!isInt(form.numberLength, 3, 10)) e.numberLength = "The counter is 3 to 10 digits.";

  if (form.resetPolicy === "never" && form.includeYear !== false) {
    e.includeYear = "A counter that never restarts cannot carry the year: the year would move while the count carried on.";
  }
  if (form.allowReuse === true && statutory) {
    e.allowReuse = "A document you issue bearing tax keeps its number for good, so it cannot be re-used.";
  }
  if (form.allowReuse === true && kind === "system") e.allowReuse = "The system writes this series itself, so there is nothing to re-use.";
  if (form.method === "auto_override" && kind === "system") e.method = "The system writes this series itself, so it cannot be typed.";

  if (!e.prefix && !e.numberLength) {
    const widest = branches
      .map((b) => (typeof b === "string" ? b : b?.code))
      .filter(Boolean)
      .reduce((best, code) => (branchPartOf(form, code).length > branchPartOf(form, best).length ? code : best), "main");
    const longest = longestNumber({ ...form, prefix }, { branchId: widest });
    const where = branchPartOf(form, widest) ? ` in ${clean(widest)}` : "";
    if (statutory && longest.length > STATUTORY_MAX_LENGTH) {
      e.numberLength = `At its longest this reads ${longest}${where} (${longest.length} characters). A tax document's number is ${STATUTORY_MAX_LENGTH} at most.`;
    } else if (longest.length > 24) {
      e.numberLength = `At its longest this reads ${longest}${where} (${longest.length} characters), which is too long to print.`;
    }
  }
  return e;
}

/** Things worth saying out loud that are nobody's mistake. */
export function warningsFor(form = {}, { branches = [] } = {}) {
  const out = [];
  if (form.resetPolicy === "never") out.push("The number will not say which year a document belongs to.");
  if (form.branchPrefix === "none" && branches.length > 1) {
    out.push("Without the branch in front, two branches can reach the same number. A document number should be unique across the organisation.");
  }
  if (form.separator === "") out.push("With no separator the parts of the number run together.");
  if (form.method === "auto_override") out.push("Somebody can type a number over the one offered. A duplicate is still refused.");
  if (form.allowReuse) out.push("A number freed by a deletion will be given to the next document of this kind, so the sequence stays unbroken.");
  return out;
}

const FIELDS = ["name", "prefix", "suffix", "separator", "includeYear", "numberLength", "resetPolicy", "branchPrefix", "branchPrefixes", "method", "allowReuse", "isActive"];

/** What is sent. A new type also names its code and its parent; neither can change afterwards. */
export function voucherTypeBody(form, { isNew = false } = {}) {
  const body = {};
  for (const f of FIELDS) if (form[f] !== undefined) body[f] = f === "numberLength" ? Number(form.numberLength) : form[f];
  body.name = String(form.name || "").trim();
  body.prefix = clean(form.prefix);
  body.suffix = clean(form.suffix);
  if (isNew) {
    body.key = clean(form.key);
    body.parentKey = clean(form.parentKey);
  }
  return body;
}

/** The form a stored row opens with. */
export const formFrom = (row) => ({ ...emptyVoucherType(), ...row, branchPrefixes: row?.branchPrefixes || [], suffix: row?.suffix || "" });

/** One line saying what this type does, for the row on the list. */
export function summaryOf(row) {
  const bits = [previewNumber(row)];
  bits.push(row.resetPolicy === "never" ? "counts on for good" : "restarts each year");
  if (row.method === "auto_override") bits.push("can be typed");
  if (row.allowReuse) bits.push("deleted numbers re-used");
  return bits.join(" \u00b7 ");
}

/** How a counter row says what it counts. */
export const scopeLabel = (label) => (clean(label) === CONTINUOUS ? "Every year (continuous)" : `Year ${clean(label)}`);

export const GAP_LABELS = {
  RELEASED: "Handed back",
  CANCELLED: "Retired",
  UNRECORDED: "No record",
};
