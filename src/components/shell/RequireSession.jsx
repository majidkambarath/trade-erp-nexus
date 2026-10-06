import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { restoreSession } from "../../axios/axios";
import { clearSession, getAccessToken, onSignedOutElsewhere } from "../../axios/session";

// Guards every page behind the sign-in. A tab opened from a link starts with no token in memory;
// the session cookie restores it, so the user does not sign in again just to open a link.
export default function RequireSession() {
  const location = useLocation();
  const [state, setState] = useState(() => (getAccessToken() ? "ready" : "checking"));

  useEffect(() => {
    if (state !== "checking") return undefined;
    let active = true;
    restoreSession().then((ok) => {
      if (active) setState(ok ? "ready" : "out");
    });
    return () => {
      active = false;
    };
  }, [state]);

  // Signing out in another tab signs this one out too.
  useEffect(
    () =>
      onSignedOutElsewhere(() => {
        clearSession();
        window.location.assign("/");
      }),
    []
  );

  if (state === "checking") {
    return (
      <div role="status" className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Restoring your session…
      </div>
    );
  }

  if (state === "out") {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/?next=${next}`} replace />;
  }

  return <Outlet />;
}
