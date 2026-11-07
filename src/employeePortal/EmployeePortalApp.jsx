// The employee self-service portal (D15, W5): its own app, its own identity, reached at /portal/*,
// outside the ERP's RequireSession/Layout entirely - the same reasoning PlatformApp.jsx and /d/:token
// already sit outside them. Phone-first: a bottom bar of four stops, no sidebar, no desktop chrome.
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Home, CalendarDays, Wallet, LogOut } from "lucide-react";
import { Button } from "../components/ui/button";
import { employeeApi } from "./employeeApi";
import { getEmployeeToken, clearEmployeeSession } from "./employeeSession";
import EmployeeLogin from "./EmployeeLogin.jsx";
import EmployeeChangePassword from "./EmployeeChangePassword.jsx";
import EmployeeHome from "./EmployeeHome.jsx";
import EmployeeLeave from "./EmployeeLeave.jsx";
import EmployeePayslips from "./EmployeePayslips.jsx";

function usePortalSession() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!getEmployeeToken()) { setLoading(false); return; }
    employeeApi.me().then(setProfile).catch(() => clearEmployeeSession()).finally(() => setLoading(false));
  }, []);
  return { profile, setProfile, loading };
}

// Relative, not absolute - the same convention PlatformApp.jsx already proves: this tree is reached via
// the parent router's path="/portal/*", so its own Routes matches against what is LEFT of that wildcard.
const TABS = [
  { to: "home", label: "Home", icon: Home },
  { to: "leave", label: "Leave", icon: CalendarDays },
  { to: "payslips", label: "Payslips", icon: Wallet },
];

function PortalShell({ profile, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  async function logout() {
    await employeeApi.logout().catch(() => {});
    navigate("/portal/login");
  }
  return (
    <div className="flex min-h-dvh flex-col bg-background pb-16">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{profile?.name || "My work"}</p>
          <p className="text-xs text-muted-foreground">{profile?.designation}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4" aria-hidden="true" /></Button>
      </header>
      <main className="flex-1 overflow-y-auto">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-border bg-background pb-safe">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = location.pathname === `/portal/${t.to}`;
          return (
            <button
              key={t.to}
              type="button"
              onClick={() => navigate(`/portal/${t.to}`)}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function EmployeePortalApp() {
  const { profile, setProfile, loading } = usePortalSession();

  if (loading) return <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Loading…</div>;

  // An administrator set the first password - shown in place of the WHOLE portal until it is changed,
  // the same gate shell/PasswordChangeRequired.jsx holds the main app to.
  const authed = (page) => {
    if (!profile) return <Navigate to="/portal/login" replace />;
    if (profile.mustChangePassword) return <EmployeeChangePassword onChanged={setProfile} />;
    return <PortalShell profile={profile}>{page}</PortalShell>;
  };

  return (
    <Routes>
      <Route index element={<Navigate to={profile ? "home" : "login"} replace />} />
      <Route path="login" element={profile ? <Navigate to="/portal/home" replace /> : <EmployeeLogin onSignedIn={setProfile} />} />
      <Route path="home" element={authed(<EmployeeHome />)} />
      <Route path="leave" element={authed(<EmployeeLeave />)} />
      <Route path="payslips" element={authed(<EmployeePayslips />)} />
      <Route path="*" element={<Navigate to="/portal" replace />} />
    </Routes>
  );
}
