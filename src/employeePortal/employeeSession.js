// The employee portal's own token, kept apart from the ERP's (src/axios/session.js) - a separate key in
// the SAME sessionStorage is enough, since this is a different browser tab/visit in practice (the portal
// is reached by its own link, never alongside a signed-in Admin session in the same tab). sessionStorage,
// never localStorage, the same reasoning the rest of the product already holds to.
const KEY = "employee_access_token";
const PROFILE_KEY = "employee_profile";

export const getEmployeeToken = () => sessionStorage.getItem(KEY) || null;

export function setEmployeeSession({ accessToken, user }) {
  if (accessToken) sessionStorage.setItem(KEY, accessToken);
  if (user) sessionStorage.setItem(PROFILE_KEY, JSON.stringify(user));
}

export function getEmployeeProfile() {
  try {
    const raw = sessionStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearEmployeeSession() {
  sessionStorage.removeItem(KEY);
  sessionStorage.removeItem(PROFILE_KEY);
}
