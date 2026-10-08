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
