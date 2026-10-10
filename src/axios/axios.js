import axios from "axios";
import { clearSession, announceSignOut, getAccessToken, getSelectedBranch, setSelectedBranch, setSession } from "./session";
import { BLOCKED_EVENT, BRANCH_RESET_EVENT, blockedFrom, isBranchRefusal, isPermissionError } from "../lib/organisation";

// One place for the API address. Set VITE_API_URL (e.g. in .env.local, or as a Render
// environment variable) to point the app at another backend; with nothing set it is the local
// server, as before.
const API_PATH = "/api/v1";

// Every route is mounted under /api/v1, but a deployment dashboard invites you to paste the bare
// host (https://trade-erp-nexus-nodejs.onrender.com), which would send each request to /login
// instead of /api/v1/login and 404 the whole app. Both forms are accepted, trailing slash or not.
export const resolveApiBaseUrl = (raw) => {
  const value = String(raw ?? "").trim().replace(/[/]+$/, "");
  if (!value) return `http://localhost:3000${API_PATH}`;
  return value.includes(API_PATH) ? value : `${value}${API_PATH}`;
};

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env?.VITE_API_URL);

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// The auth calls never trigger a refresh of their own: a refresh that fails must not loop. The second sign-in step and the
// forgot / reset password calls are here too: they have no session to renew, and a wrong code must be an error on the form.
export const AUTH_PATH = /\/(login|login\/2fa|refresh-token|logout|forgot-password|reset-password)$/;

// One refresh at a time. Requests that fail together wait for the same refresh instead of each
// starting one, so a page does not sign itself out part way through.
let refreshing = null;

// Renews the access token from the session cookie. The browser sends the cookie; no token is
// passed in script. Resolves with the new session, or rejects when the session has ended.
export const refreshSession = () => {
  if (!refreshing) {
    refreshing = axios
      .post(`${API_BASE_URL}/refresh-token`, {}, { withCredentials: true })
      .then(({ data }) => {
        if (!data?.success || !data.data?.accessToken) throw new Error("Invalid refresh response");
        setSession({ accessToken: data.data.accessToken, admin: data.data.admin });
        return data.data;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
};

// True when the session was restored from the cookie, false when the browser has no session left.
export const restoreSession = () => refreshSession().then(() => true, () => false);

// Ends the session in this tab and tells the others. The server call is the caller's job
// (useSession.logout): only the caller knows whether the server answered.
export const signOutLocally = () => {
  clearSession();
  announceSignOut();
};

// Sends the user to the sign-in page, remembering where they were so sign-in brings them back.
const sendToSignIn = () => {
  if (window.location.pathname === "/") return;
  const here = window.location.pathname + window.location.search;
  window.location.assign(`/?next=${encodeURIComponent(here)}`);
};

// Request interceptor: the access token, when this tab has one.
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const branch = getSelectedBranch();
    if (branch) config.headers["X-Branch"] = branch;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: a 401 renews the session once and retries the request. If the session has
// ended, the tab signs out and goes to sign-in.
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    // A subscription that has ended (or a suspended account) refuses every request the same way. Tell the shell, so it
    // can say why instead of every screen showing its own error. The request still fails as before.
    const blocked = blockedFrom(error);
    if (blocked && typeof window !== "undefined") window.dispatchEvent(new CustomEvent(BLOCKED_EVENT, { detail: blocked }));
    // A role that does not allow an action is told in the server's own words, on every screen that shows error.message,
    // instead of "Request failed with status code 403".
    if (isPermissionError(error)) error.message = error.response.data.message || error.message;
    // The branch this tab chose is no longer the person's to work in: every request names it and every request is refused,
    // the one that would clear it included. Forget the choice so the next request works, and tell the shell. The refused
    // request is NOT sent again without the header - a document would silently land in the home branch instead.
    if (isBranchRefusal(error)) {
      error.message = error.response.data.message || error.message;
      if (error.config?.headers?.["X-Branch"] && getSelectedBranch()) {
        setSelectedBranch(null);
        if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(BRANCH_RESET_EVENT));
      }
    }
    const original = error.config;
    const unauthorized = error.response?.status === 401;
    if (!unauthorized || !original || original._retry || AUTH_PATH.test(original.url || "")) {
      return Promise.reject(error);
    }
    original._retry = true;
    try {
      await refreshSession();
      original.headers.Authorization = `Bearer ${getAccessToken()}`;
      return axiosInstance(original);
    } catch (refreshError) {
      clearSession();
      sendToSignIn();
      return Promise.reject(refreshError);
    }
  }
);

export default axiosInstance;
