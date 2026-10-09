// "A different role in a branch" as plain functions: no React and no requests, so each rule is a test.
//
// A person holds their own role everywhere, except in the branches listed here, where they hold the role named instead. The
// server keeps the list as [{ branchId, role }] (`role` is a role key) and answers it as [{ branchId, role: { key, name, ... } }].
// The dialog edits it as rows of the same two fields, one row per branch, with a blank row allowed while it is being filled in.

/** An empty row, as "Add a branch" appends it. */
export const blankRow = () => ({ branchId: "", role: "" });

const isBlank = (row) => !row?.branchId && !row?.role;

/** The rows a person's dialog starts with: one per branch they hold another role in. */
export const rowsFromPerson = (person) =>
  (person?.branchRoles || []).map((b) => ({ branchId: b.branchId || "", role: b.role?.key || b.roleKey || (typeof b.role === "string" ? b.role : "") || "" }));

/** The body the server takes: every row that says anything. A row with nothing in it is just an unused line. */
export const payloadFromRows = (rows) => (rows || []).filter((r) => !isBlank(r)).map((r) => ({ branchId: r.branchId, role: r.role }));

/** { [rowIndex]: message } for what the server would refuse, so the dialog says so before anything is sent. */
export function validateRows(rows, { branches } = {}) {
  const errors = {};
  const known = Array.isArray(branches) ? new Set(branches.map((b) => b.code)) : null;
  const seen = new Set();
  (rows || []).forEach((row, i) => {
    if (isBlank(row)) return;
    if (!row.branchId) errors[i] = "Choose a branch";
    else if (known && !known.has(row.branchId)) errors[i] = "That branch is not available";
    else if (seen.has(row.branchId)) errors[i] = "This branch is already listed. A person has one role in a branch";
    else if (!row.role) errors[i] = "Choose a role";
    if (row.branchId) seen.add(row.branchId);
  });
  return errors;
}

const branchName = (code, branches) => (branches || []).find((b) => b.code === code)?.name || (code === "main" ? "Head office" : code);

/** "Viewer in Sharjah", "Viewer in Sharjah, Auditor in Dubai"; empty when the person holds their own role everywhere.
 * `branches` ([{ code, name }]) turns a branch code into its name; without it the code is shown. */
export function summaryOf(person, branches) {
  return (person?.branchRoles || [])
    .filter((b) => b?.branchId)
    .map((b) => `${b.role?.name || b.role?.key || b.roleName || b.roleKey || "A role"} in ${branchName(b.branchId, branches)}`)
    .join(", ");
}

const canonical = (rows) =>
  JSON.stringify(
    payloadFromRows(rows)
      .map((r) => [r.branchId, r.role])
      .sort((a, b) => (a[0] === b[0] ? String(a[1]).localeCompare(String(b[1])) : String(a[0]).localeCompare(String(b[0]))))
  );

/** Do the rows say something other than what the person already has? The order of the rows does not matter, and a blank
 * row is nothing. For a new person (no `person`) any filled row is a change. */
export const changed = (rows, person) => canonical(rows) !== canonical(rowsFromPerson(person));

/** What to show for a refusal: the server's own sentence when it sent one, else the request's own message. */
export const serverMessage = (error) => error?.response?.data?.message || error?.message || "Something went wrong";
