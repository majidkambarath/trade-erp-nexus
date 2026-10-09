// What the signed-in person may do, as plain functions: no React and no requests, so every rule is a test.
//
// The server is the lock and decides every request for itself (403 PERMISSION_DENIED). Nothing here grants anything:
// it decides what to SHOW, so a storekeeper is not offered a Finance menu and a sales clerk is not offered an Approve
// button that would only answer "your role does not allow this". The grants come from GET /organisation/status
// (`me.grants`), already widened by the server, so this file never keeps a copy of which role holds what.
//
// While the grants are not known (loading, or the status could not be loaded) nothing is hidden: a missing answer must
// never lock a working person out of a screen, and the server still refuses what it should.

const known = (me) => Array.isArray(me?.grants);

/** May the person do this? A key like "sales.approve". */
export const can = (me, key) => !known(me) || me.grants.includes(key);

/** May they do at least one of these? A list that names nothing asks for nothing and is refused. */
export const canAny = (me, keys) => {
  const list = [].concat(keys || []).filter(Boolean);
  if (!known(me)) return true;
  return list.length > 0 && list.some((k) => me.grants.includes(k));
};

/**
 * Is a navigation tab open to them? A tab names the permission(s) it needs (any one will do) or says it is `open` to
 * everyone, with a reason. A tab that does neither is refused once the grants are known: guarding is the default.
 */
export const tabAllowed = (tab, me) => {
  if (!known(me)) return true;
  if (tab.open) return true;
  return canAny(me, tab.permission);
};

/** The name a person sees for their role, for the top bar and the "not allowed" page. */
export const roleName = (me) => me?.role?.name || me?.role?.key || null;

/** What the "not allowed" page says, naming the permission when the server's refusal carried it. */
export function notAllowedText(me, needed) {
  const who = roleName(me);
  const missing = [].concat(needed || []).filter(Boolean);
  return {
    title: "You do not have access to this page",
    lead: who ? `Your role (${who}) does not include it.` : "Your role does not include it.",
    need: missing.length ? missing : null,
  };
}

// ---- deleting a trade document or a voucher ----------------------------------------------------------------------
// The server decides by the STORED status (byDocumentDelete / byVoucherDelete): an approved document has moved stock and
// posted to the ledger, and deleting it reverses all of that, so it is its own permission (`deletePosted`, which implies
// plain `delete`). Anything not yet approved needs plain `delete`. A screen hides (never disables) the Delete it would be
// refused, and uses these so the rule lives in one place.

/** The permission a Delete needs: `<module>.deletePosted` for a posted (approved) document, else `<module>.delete`. */
export const deleteKey = (module, posted) => `${module}.${posted ? "deletePosted" : "delete"}`;

/** Is this trade document posted? Trade documents say APPROVED in capitals (a voucher's approved status is lower case). */
export const isPostedDocument = (doc) => doc?.status === "APPROVED";

/**
 * A selection of documents someone asked to delete, split by what this person may delete. Approved ones are skipped when
 * they lack deletePosted (never sent to the server). A selected id the list does not hold is not known to be approved and
 * stays with the deletable ones: the server is the lock and answers for it.
 *   -> { deletable: ids to send, skipped: ids left alone, posted: how many deletable ones are approved }
 */
export function planBulkDelete(ids, docs, mayDeletePosted) {
  const byId = new Map((docs || []).map((d) => [d.id, d]));
  const plan = { deletable: [], skipped: [], posted: 0 };
  for (const id of ids || []) {
    const posted = isPostedDocument(byId.get(id));
    if (posted && !mayDeletePosted) plan.skipped.push(id);
    else {
      plan.deletable.push(id);
      if (posted) plan.posted += 1;
    }
  }
  return plan;
}

/** What to tell the person when approved documents were not deleted for them. */
export const skippedPostedText = (n) =>
  `${n} approved document${n === 1 ? " was" : "s were"} left alone: deleting an approved document needs the Delete approved permission.`;

/** The warning for deleting approved documents: it undoes their postings. */
export const postedDeleteText = (n) =>
  `${n} of them ${n === 1 ? "is" : "are"} approved: deleting ${n === 1 ? "it" : "those"} REVERSES ${n === 1 ? "its" : "their"} stock and ledger postings.`;
