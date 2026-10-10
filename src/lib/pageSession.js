// What a screen remembers while the person moves around the app: the search they typed, the filters they chose, the form they
// half filled in. It is kept in this tab's MEMORY only - never in the browser's storage - so it survives going to another page
// and coming back, is gone when the tab is reloaded or closed, and is emptied at sign-out (`clearPageSessions`, called from
// `clearSession`) so one person's filters and drafts are never shown to the next. A draft can hold a person's ID number: that is
// why this does not touch localStorage / sessionStorage, as the access token does not either.
//
//   const session = pageSession("customers");
//   session.set("filters", { status: "active" });
//   session.get("filters", {})        -> { status: "active" }   (the fallback when nothing was kept)
//   session.remove("filters");  session.clear();
//
// Values are kept as given (a File in a draft stays a File); callers keep plain data and never change what `get` returns.
//
// Five management screens each carried their own copy of this as `const SessionManager = { storage: {}, get: (k) => this.storage[..] }`.
// `this` inside an arrow function at module level is undefined, so every read and write threw, was swallowed by its try/catch, and
// nothing was ever remembered. One tested copy replaces them.

const memory = new Map();

const keyOf = (name, key) => `${name}:${key}`;

export function pageSession(name) {
  return {
    get(key, fallback = null) {
      const k = keyOf(name, key);
      return memory.has(k) ? memory.get(k) : fallback;
    },
    set(key, value) {
      if (value === undefined) memory.delete(keyOf(name, key));
      else memory.set(keyOf(name, key), value);
    },
    remove(key) {
      memory.delete(keyOf(name, key));
    },
    clear() {
      const prefix = `${name}:`;
      for (const k of [...memory.keys()]) if (k.startsWith(prefix)) memory.delete(k);
    },
  };
}

/** Forget everything every screen kept. Signing out calls this. */
export function clearPageSessions() {
  memory.clear();
}
