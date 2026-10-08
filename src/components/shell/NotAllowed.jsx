import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { notAllowedText } from "../../lib/permissions";

// Shown in the workspace in place of a page the person's role does not include (reached by a typed address or an old
// bookmark; the navigation does not offer it). It says whose role, and takes them somewhere they can go.
export default function NotAllowed({ me, needed, home }) {
  const { title, lead } = notAllowedText(me, needed);
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
        <ShieldAlert className="h-5 w-5" aria-hidden="true" />
      </span>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{lead} Ask your administrator if you need it.</p>
      {home && (
        <Link to={home} className="mt-2 inline-flex h-11 items-center justify-center rounded-full border border-input bg-card px-5 text-sm font-medium hover:bg-accent lg:h-10">
          Go to a page you can open
        </Link>
      )}
    </div>
  );
}
