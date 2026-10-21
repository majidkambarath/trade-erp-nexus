// The developer console's sign-in, kept apart from the product's: its own key, its own token, never sent to the
// product's API and never accepted by it. Held in sessionStorage, so closing the tab ends it (the server also ends
// it after eight hours).
//
// NOT like the product's own token, which this comment used to claim: that one is memory-only (see axios/session.js,
// "page scripts never find a token sitting in storage"). So the console's token - which reaches every organisation,
// lasts eight hours and cannot be revoked - is the one credential an injected script could read, and the console is
// /platform/* in this same app, on the same origin as every customer screen, with no Content-Security-Policy in
// front of it. Moving it to memory with a refresh cookie, as the product's token does, is the real fix; it is a
// behaviour change (a reload would sign the developer out) and has not been done. Do not copy this pattern.
const KEY = "zarvia.console";

const read = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
};

export const getConsoleToken = () => read()?.token || null;
export const getConsoleUser = () => read()?.user || null;

export const setConsoleSession = ({ token, user }) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ token, user }));
  } catch {
    // storage unavailable: the session lasts until the page is reloaded
  }
};

export const clearConsoleSession = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
};
