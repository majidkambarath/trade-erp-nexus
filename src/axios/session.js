// The signed-in session as this tab holds it. The access token lives in memory only: a tab opened
// from a link starts empty and asks the server for a token with the session cookie, and page
// scripts never find a token sitting in storage.

let accessToken = null;
let admin = null;

const SIGNED_OUT = "signed-out";
const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("erp-session");

export const getAccessToken = () => accessToken;
export const getAdmin = () => admin;

export const setSession = ({ accessToken: token, admin: who }) => {
  accessToken = token;
  if (who) admin = who;
};

export const clearSession = () => {
  accessToken = null;
  admin = null;
  setSelectedBranch(null);
};

// The branch a head-office user has chosen to work in ("" or nothing = all branches). Kept for this tab only, and
// sent with every request as X-Branch; the server honours it for head-office users alone and checks it every time.
const BRANCH_KEY = "zarvia.branch";
export const getSelectedBranch = () => {
  try {
    return sessionStorage.getItem(BRANCH_KEY) || null;
  } catch {
    return null;
  }
};
export const setSelectedBranch = (code) => {
  try {
    if (code) sessionStorage.setItem(BRANCH_KEY, code);
    else sessionStorage.removeItem(BRANCH_KEY);
  } catch {
    // storage unavailable: the choice lasts until the page is reloaded
  }
};

// Tells the other tabs of this browser that the session ended, so none of them keeps working on it.
export const announceSignOut = () => channel?.postMessage({ type: SIGNED_OUT });

export const onSignedOutElsewhere = (handler) => {
  if (!channel) return () => {};
  const listener = (event) => {
    if (event.data?.type === SIGNED_OUT) handler();
  };
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
};

// The page to return to after signing in. Only a path inside this app is accepted: an absolute or
// protocol-relative address would let a link to the sign-in page send the user somewhere else.
export const safeNext = (value) => {
  if (typeof value !== "string" || !value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/dashboard";
  return value;
};

// Keys the previous version kept in sessionStorage. Removed on sign-out so none is left behind.
const LEGACY_KEYS = ["accessToken", "refreshToken", "adminId", "loginTime", "tokenExpiry", "rememberMe"];
export const clearLegacySessionStorage = () => {
  try {
    for (const key of LEGACY_KEYS) sessionStorage.removeItem(key);
  } catch {
    // storage unavailable (private mode): nothing to clear
  }
};
