// The Users & roles screen's rules as plain functions: no React and no requests, so each is a test.
//
// The role editor never keeps its own copy of what a permission brings with it: the server sends the catalogue with each
// action's `implies`, and everything here reads that. Ticking "Approve" therefore locks "View" because the server says
// approving needs seeing, and a rule changed on the server changes the editor with no edit here.

import { limitSummary } from "./approvals";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The ranks a custom role may take, in words. A role may only sit below the person making it (and below the owner). */
export const RANK_CHOICES = [
  { value: 75, label: "Senior (below administrator)" },
  { value: 60, label: "Manager level" },
  { value: 50, label: "Accountant level" },
  { value: 40, label: "Sales, purchase, store level" },
  { value: 30, label: "Junior" },
  { value: 20, label: "Viewer level" },
];

const TOP = 100;
/** The ranks the person may give: strictly below their own. */
export const rankChoices = (myRank) => RANK_CHOICES.filter((c) => c.value < (Number(myRank) || 0));

/** May this person change someone of `rank`? Anyone strictly below them, and the owner may change any. */
export const mayChange = (myRank, rank) => Number(myRank) >= TOP || Number(rank) < Number(myRank);

/** The roles a person may give: switched on, and below their own rank. */
export const rolesToGive = (roles, myRank) => (roles || []).filter((r) => r.isActive && (Number(myRank) >= TOP || r.rank < Number(myRank)));

/** A role key from a name: "Sales supervisor" -> "sales_supervisor". */
export function keyFromName(name) {
  const k = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (/^[a-z]/.test(k) ? k : k ? `role_${k}` : "").slice(0, 30).replace(/_+$/g, "");
}

// ---- people

export const emptyPerson = () => ({ name: "", email: "", password: "", role: "viewer", branchId: "main" });

export const personFrom = (person) => ({ name: person.name, email: person.email, password: "", role: person.role?.key || "viewer", branchId: person.branchId || "main", status: person.isActive ? "active" : "inactive" });

/** { field: message } for what the server would refuse, so the form says so before it is sent. */
export function validatePerson(form, { isNew }) {
  const errors = {};
  if (String(form.name || "").trim().length < 2) errors.name = "Enter the person's name";
  if (isNew) {
    if (!EMAIL.test(String(form.email || "").trim())) errors.email = "Enter a valid email address";
    if (String(form.password || "").length < 8) errors.password = "A password needs at least 8 characters";
  } else if (form.password && String(form.password).length < 8) errors.password = "A password needs at least 8 characters";
  if (!form.role) errors.role = "Choose a role";
  return errors;
}

/** The body for a new person. */
export const newPersonPayload = (form) => ({
  name: form.name.trim(),
  email: form.email.trim().toLowerCase(),
  password: form.password,
  role: form.role,
  branchId: form.branchId || "main",
});

/** The body for a change: only what differs from the person as they were, so nothing is "changed" to what it already is. */
export function personChanges(form, original) {
  const out = {};
  if (form.name.trim() !== original.name) out.name = form.name.trim();
  if (form.role !== (original.role?.key || "")) out.role = form.role;
  if ((form.branchId || "main") !== (original.branchId || "main")) out.branchId = form.branchId;
  if (form.status !== (original.isActive ? "active" : "inactive")) out.status = form.status;
  if (form.password) out.password = form.password;
  return out;
}

// ---- the role editor

/** Every action of the catalogue, flat. */
export const allActions = (catalogue) => (catalogue || []).flatMap((m) => m.actions);

/** The permissions ticking `named` brings along, as a set (not including those ticked themselves unless another brings them). */
export function impliedOf(catalogue, named) {
  const byKey = new Map(allActions(catalogue).map((a) => [a.key, a]));
  const out = new Set();
  for (const k of named) for (const i of byKey.get(k)?.implies || []) out.add(i);
  return out;
}

/** What the role really grants: what was ticked and everything that comes with it. */
export const effectiveOf = (catalogue, named) => new Set([...named, ...impliedOf(catalogue, named)]);

/** Is this box locked on because something ticked needs it? (It cannot be unticked while that stays ticked.) */
export const isLocked = (catalogue, named, key) => impliedOf(catalogue, [...named].filter((k) => k !== key)).has(key);

/** Tick or untick one box. */
export function toggle(named, key, on) {
  const next = new Set(named);
  if (on) next.add(key);
  else next.delete(key);
  return next;
}

/** Tick or untick a whole module at once (what the person is allowed to grant, only). */
export function toggleModule(catalogue, named, moduleKey, on, canGrant = () => true) {
  const mod = (catalogue || []).find((m) => m.key === moduleKey);
  let next = new Set(named);
  for (const a of mod?.actions || []) {
    if (on && canGrant(a.key)) next.add(a.key);
    if (!on) next.delete(a.key);
  }
  // a module can only be cleared if nothing ticked elsewhere still needs one of its boxes
  if (!on) for (const a of mod?.actions || []) if (isLocked(catalogue, next, a.key) && named.has(a.key)) next.add(a.key);
  return next;
}

/** The smallest ticked set that gives the same result: a copied role shows ticks, not every implied box ticked. */
export function minimal(catalogue, keys) {
  const set = new Set(keys);
  return new Set([...set].filter((k) => !impliedOf(catalogue, [...set].filter((o) => o !== k)).has(k)));
}

/** The ticks a role starts the editor with. A custom role remembers what was ticked; a built-in one is reduced to its smallest set. */
export const ticksOf = (catalogue, role) => (role?.named ? new Set(role.named) : minimal(catalogue, role?.permissions || []));

export const emptyRole = () => ({ name: "", key: "", description: "", rank: 40, approvalLimit: "" });

// The limit is kept in the form as the text typed ("" for none); a stored number is shown as it is.
const limitText = (limit) => (limit === null || limit === undefined || limit === "" ? "" : String(limit));

export const roleFrom = (role) => ({ name: role.name, key: role.key, description: role.description || "", rank: role.rank, approvalLimit: limitText(role.approvalLimit) });

/** Does this set of permissions include approving something? (Any "<module>.approve".) */
export const holdsApprove = (keys) => [...(keys || [])].some((k) => String(k).endsWith(".approve"));

/** What was typed for an approval limit -> a number, null for empty (no limit), NaN for something that is not an amount. */
export function parseLimit(text) {
  const t = String(text ?? "").replace(/,/g, "").trim();
  if (t === "") return null;
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

/** { field: message } for a role the server would refuse. `canGrant` is what the person holds. `approves`: the role holds an Approve (a limit means nothing otherwise). */
export function validateRole(form, named, { isNew, myRank, canGrant = () => true, approves = true }) {
  const errors = {};
  if (approves && Number.isNaN(parseLimit(form.approvalLimit))) errors.approvalLimit = "Enter an amount of 0 or more, or leave it empty for no limit";
  if (String(form.name || "").trim().length < 2) errors.name = "Give the role a name";
  if (isNew && !/^[a-z][a-z0-9_]{1,29}$/.test(form.key || "")) errors.key = "The key is 2 to 30 lower-case letters, digits or underscores";
  const rank = Number(form.rank);
  if (!Number.isInteger(rank) || rank < 10 || rank > 90) errors.rank = "Choose a rank";
  else if (Number(myRank) < TOP && rank >= Number(myRank)) errors.rank = "A role cannot rank at or above your own";
  const beyond = [...named].filter((k) => !canGrant(k));
  if (beyond.length) errors.permissions = `You cannot grant what you do not hold: ${beyond.join(", ")}`;
  return errors;
}

/**
 * The body for a new or changed role. The approval limit is a number, or null for none (empty); a role that approves nothing
 * has none to keep, so it is sent as null (`approves: false`).
 */
export const rolePayload = (form, named, { isNew, approves = true }) => {
  const limit = approves ? parseLimit(form.approvalLimit) : null;
  return {
    ...(isNew ? { key: form.key } : {}),
    name: form.name.trim(),
    description: form.description.trim(),
    rank: Number(form.rank),
    permissions: [...named],
    approvalLimit: Number.isNaN(limit) ? null : limit,
  };
};

/**
 * "9 permissions in 4 areas" for a list row. A role that approves says how much: "... · Approval: Up to 5,000.00 AED" or
 * "... · Approval: No limit".
 */
export function summarise(role) {
  const keys = role.permissions || [];
  const areas = new Set(keys.map((k) => k.split(".")[0]).filter((m) => m !== "lookups"));
  const base = `${keys.length} permission${keys.length === 1 ? "" : "s"} in ${areas.size} area${areas.size === 1 ? "" : "s"}`;
  return holdsApprove(keys) ? `${base} · Approval: ${limitSummary(role.approvalLimit)}` : base;
}

// ---- what the server answers when it refuses a role

/** The server's own sentence for a refusal, else the error's. (An axios error's `message` is only "Request failed with status code 400".) */
export const serverMessage = (error) => error?.response?.data?.message || error?.message || "";

/** The field the server says a refusal is about (`details.field`, e.g. "approvalLimit"), or null. */
export const serverField = (error) => error?.response?.data?.details?.field || null;
