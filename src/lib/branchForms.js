// Adding and changing a branch: what the form asks, what is wrong with it, and what is sent. No React in it, so the rules are
// tested without rendering. The server decides everything that matters (the plan's feature and limit, a code that is taken,
// people still working in a branch); these helpers catch a mistake before the request and word the plan's answer.

// The same shape the server accepts (services/core/branchService.js): it is printed in the branch's document numbers.
export const CODE_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const emptyBranch = () => ({ code: "", name: "", addressLine1: "", city: "", phone: "", email: "" });

export const branchFrom = (branch) => ({
  code: branch.code || "",
  name: branch.name || "",
  addressLine1: branch.address?.line1 || "",
  city: branch.address?.city || "",
  phone: branch.phone || "",
  email: branch.email || "",
});

/** A short code to suggest from a name: its first word, lower-case, as a short branch code reads best on a document number. */
export function codeFromName(name) {
  const word = String(name || "").trim().toLowerCase().split(/\s+/)[0] || "";
  return word.normalize("NFKD").replace(/[^a-z0-9]/g, "").slice(0, 10);
}

/** -> { field: message } for what is wrong; {} when the form is good to send. */
export function validateBranch(form, { isNew }) {
  const errors = {};
  if (isNew) {
    const code = String(form.code || "").trim().toLowerCase();
    if (code.length < 2 || code.length > 20 || !CODE_PATTERN.test(code)) errors.code = "Use 2 to 20 lower-case letters, digits or hyphens";
  }
  if (!String(form.name || "").trim()) errors.name = "Give the branch a name";
  else if (String(form.name).trim().length > 120) errors.name = "A branch name is at most 120 characters";
  if (String(form.email || "").trim() && !EMAIL.test(String(form.email).trim())) errors.email = "Enter a valid email address";
  return errors;
}

const trimmed = (form) => ({
  name: String(form.name || "").trim(),
  addressLine1: String(form.addressLine1 || "").trim(),
  city: String(form.city || "").trim(),
  phone: String(form.phone || "").trim(),
  email: String(form.email || "").trim(),
});

/** The body for a new branch. */
export const newBranchPayload = (form) => ({ code: String(form.code || "").trim().toLowerCase(), ...trimmed(form) });

/** Only what changed, so a save never rewrites what the person did not touch. The code never changes. */
export function branchChanges(form, existing) {
  const now = trimmed(form);
  const before = trimmed(branchFrom(existing));
  return Object.fromEntries(Object.entries(now).filter(([key, value]) => value !== before[key]));
}

/**
 * Whether another branch may be added, and a sentence saying where the plan stands. `featureOn` is whether the plan includes more
 * than one branch (unknown counts as yes: the server is the lock), `limit` the plan's number of branches (null is unlimited),
 * `used` how many are switched on now.
 */
export function planNote({ featureOn, limit, used }) {
  if (featureOn === false) return { canAdd: false, text: "More than one branch is not included in your plan." };
  if (limit !== null && limit !== undefined && used >= limit) {
    return { canAdd: false, text: `Your plan allows ${limit} ${limit === 1 ? "branch" : "branches"} and ${limit === 1 ? "it is" : "all are"} in use.` };
  }
  const count = `${used} ${used === 1 ? "branch" : "branches"} in use`;
  return { canAdd: true, text: limit === null || limit === undefined ? count : `${count} of ${limit}` };
}
