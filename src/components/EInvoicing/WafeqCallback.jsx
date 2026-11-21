// Where Wafeq sends the browser back to after the business has approved Zarvia. Not a page anybody navigates to: OAuth hands the answer to a
// BROWSER, while this app signs its requests with a token held in the tab. So Wafeq returns here, and this page hands the code to the server with
// the tab's own token, takes the one-time code out of the address at once, and sends the person back to the e-invoicing settings.
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "../accounting/kit.jsx";
import { Note } from "../salesDocs/parts.jsx";
import { einvoice } from "../../lib/accountingApi";

const BACK = "/e-invoicing/settings";

export default function WafeqCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const done = useRef(false); // React runs an effect twice in development; a one-time code exchanged twice fails the second time

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const code = params.get("code");
    const state = params.get("state");
    const refused = params.get("error");
    if (refused) {
      setProblem(refused === "access_denied" ? "Wafeq was not connected: the approval was declined." : `Wafeq was not connected: ${params.get("error_description") || refused}`);
      return;
    }
    if (!code) {
      setProblem("That address carried no answer from Wafeq. Start again from the e-invoicing settings.");
      return;
    }
    einvoice.wafeqFinish({ code, state }).then(() => navigate(BACK, { replace: true })).catch((e) => setProblem(e.message));
  }, [params, navigate]);

  return (
    <div className="mx-auto max-w-[560px] p-4 sm:p-6 lg:p-8">
      {problem ? (
        <>
          <Note tone="danger">{problem}</Note>
          <Link to={BACK} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">Back to the e-invoicing settings</Link>
        </>
      ) : (
        <Spinner label="Finishing the Wafeq connection" />
      )}
    </div>
  );
}
