// Where Google sends the browser back to after the person has consented.
//
// This is not a page anybody navigates to: it exists because OAuth hands the answer to a BROWSER, while this app
// signs its requests with a token held in the tab rather than a cookie. So Google returns here, and this page hands
// the code to the server with the tab's own token, then sends the person back to where the connection is managed.
//
// The code is a one-time secret and is taken out of the address immediately, so it reaches neither history nor a
// bookmark nor the next page's referrer.
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "../accounting/kit.jsx";
import { Note } from "../salesDocs/parts.jsx";
import { crm } from "../../lib/crmApi";

const BACK = "/settings?tab=security";

export default function GoogleCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  // React runs an effect twice in development; a one-time code exchanged twice fails the second time.
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const code = params.get("code");
    const state = params.get("state");
    const refused = params.get("error");

    if (refused) {
      setProblem(refused === "access_denied" ? "Google was not connected: the permission was declined." : `Google was not connected: ${refused}`);
      return;
    }
    if (!code) {
      setProblem("That address carried no answer from Google. Start again from Settings.");
      return;
    }
    crm
      .googleConnect({ code, state })
      .then(() => navigate(BACK, { replace: true }))
      .catch((e) => setProblem(e.message));
  }, [params, navigate]);

  return (
    <div className="mx-auto max-w-[560px] p-4 sm:p-6 lg:p-8">
      {problem ? (
        <>
          <Note tone="danger">{problem}</Note>
          <Link to={BACK} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
            Back to your settings
          </Link>
        </>
      ) : (
        <Spinner label="Finishing the Google connection" />
      )}
    </div>
  );
}
