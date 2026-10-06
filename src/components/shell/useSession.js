import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance, { signOutLocally } from "../../axios/axios";
import { clearLegacySessionStorage } from "../../axios/session";

// The navigation's role names (Admin / Accountant / Purchase Officer / ...) do not match
// the backend's admin.type enum (super_admin / admin / manager / operator / viewer).
// Mapping them is a product decision, so the role stays "Admin" (full access, the
// existing behaviour) until that mapping is agreed. Wiring admin.type straight in would
// hide every module, because no role list in src/config/navigation.js contains
// "super_admin".
export const CURRENT_ROLE = "Admin";

export function useSession() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get("/profile/me")
      .then(({ data }) => {
        if (!cancelled && data?.success) setProfile(data.data);
      })
      .catch(() => {
        // Not fatal: the shell falls back to generic labels, and the 401 interceptor in
        // src/axios/axios.js already handles an expired session.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Clears the session only. The remembered login email (erp-remember-email) is kept
  // on purpose: the user opted into it on the sign-in page.
  // The server ends this browser's session and clears the cookie. If the server cannot be reached,
  // this tab still signs out, and the other tabs with it.
  const logout = useCallback(() => {
    // Not awaited: the tab leaves at once. If the server cannot be reached, the cookie simply expires.
    axiosInstance.post("/logout").catch(() => {});
    signOutLocally();
    clearLegacySessionStorage();
    try {
      localStorage.removeItem("userPreferences");
    } catch {
      // storage unavailable - nothing to clear
    }
    navigate("/", { replace: true });
  }, [navigate]);

  return { profile, role: CURRENT_ROLE, logout };
}

/** "Super Admin" -> "SA"; falls back to a neutral glyph-free initial. */
export const initials = (name) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
