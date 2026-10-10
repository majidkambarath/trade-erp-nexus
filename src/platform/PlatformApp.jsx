import React, { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import PlatformShell from "./PlatformShell";
import PlatformLogin from "./PlatformLogin";
import OrganisationsList from "./OrganisationsList";
import NewOrganisation from "./NewOrganisation";
import OrganisationDetail from "./OrganisationDetail";
import { ActivityTab } from "./detailTabs";
import PlatformSecurity from "./PlatformSecurity";
import { clearConsoleSession, getConsoleToken, getConsoleUser } from "./platformSession";
import { PageHeader } from "../components/accounting/kit";

// The developer console, mounted at /platform. It sits outside the product's session guard and shell: its own
// sign-in, its own token and its own frame, so nothing a customer is signed in to is reachable from here.
export default function PlatformApp() {
  const [user, setUser] = useState(() => (getConsoleToken() ? getConsoleUser() : null));

  const signOut = useCallback(() => {
    clearConsoleSession();
    setUser(null);
  }, []);

  // The server ended the session (it lasts eight hours): back to the sign-in.
  useEffect(() => {
    window.addEventListener("console-signed-out", signOut);
    return () => window.removeEventListener("console-signed-out", signOut);
  }, [signOut]);

  useEffect(() => {
    document.title = "Developer console";
  }, []);

  if (!user) return <PlatformLogin onSignedIn={setUser} />;

  return (
    <PlatformShell user={user} onSignOut={signOut}>
      <Routes>
        <Route index element={<OrganisationsList />} />
        <Route path="new" element={<NewOrganisation />} />
        <Route path="organisations/:code" element={<OrganisationDetail />} />
        <Route
          path="activity"
          element={
            <>
              <PageHeader title="Activity" />
              <ActivityTab />
            </>
          }
        />
        <Route path="security" element={<PlatformSecurity user={user} />} />
        <Route path="*" element={<Navigate to="/platform" replace />} />
      </Routes>
    </PlatformShell>
  );
}
