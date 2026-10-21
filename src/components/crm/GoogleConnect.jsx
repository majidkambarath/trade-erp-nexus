// Connecting a person's own Google account, so arranging a meeting mints a real Meet link and the event lands in
// their own Google Calendar.
//
// It is each PERSON's own connection, not the organisation's - the link is minted by their account and the event goes
// in their diary - so it sits in Settings beside their password and their two-factor, where their other accounts are,
// and is open to anybody signed in rather than to managers.
//
// It says plainly that nothing here is required: meetings already reach the customer's calendar without Google.
import React, { useCallback, useEffect, useState } from "react";
import { Panel, Spinner, ErrorNote } from "../accounting/kit.jsx";
import { Note } from "../salesDocs/parts.jsx";
import { crm } from "../../lib/crmApi";

export default function GoogleConnect({ notify }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const read = useCallback(async () => {
    try {
      setStatus(await crm.googleStatus());
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);
  useEffect(() => {
    read();
  }, [read]);

  const connect = async () => {
    setBusy(true);
    try {
      const { url } = await crm.googleStart();
      // Google's own page, so a real navigation rather than a popup a browser may block.
      window.location.assign(url);
    } catch (e) {
      notify?.(e.message, "error");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      setStatus(await crm.googleDisconnect());
      notify?.("Google was disconnected");
    } catch (e) {
      notify?.(e.message, "error");
    } finally {
      setBusy(false);
    }
  };

  if (error) return <Panel title="Google Calendar"><ErrorNote error={error} onRetry={read} /></Panel>;
  if (!status) return <Panel title="Google Calendar"><Spinner label="Reading the connection" /></Panel>;

  // Nothing to offer: this server has no Google app set up, so a button here could only fail.
  if (!status.available) {
    return (
      <Panel title="Google Calendar" description="Not set up on this server.">
        <p className="text-sm text-muted-foreground">
          Meetings still work without it: arrange one and everybody is sent an invitation for their own calendar.
          Connecting Google would add a Meet link made for you. Ask whoever runs the server to set it up.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Google Calendar"
      description="Your own account, so a meeting you arrange gets a Meet link and appears in your Google Calendar."
      actions={
        status.connected ? (
          <button type="button" onClick={disconnect} disabled={busy} className="h-10 rounded-lg border border-input px-3 text-sm hover:bg-accent disabled:opacity-60">
            Disconnect
          </button>
        ) : (
          <button type="button" onClick={connect} disabled={busy} className="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy ? "Opening Google…" : "Connect Google"}
          </button>
        )
      }
    >
      <p className="text-sm text-foreground">{status.label}</p>
      {status.detail && <Note tone="warning" className="mt-3">{status.detail}</Note>}
      <p className="mt-3 text-sm text-muted-foreground">
        {status.connected
          ? "New meetings can be given a Meet link made for you, and moving or cancelling one changes it in your Google Calendar too."
          : "You do not have to. Meetings already go in the customer's calendar, and you can paste your own Meet, Zoom or Teams link. Connecting only saves you that step."}
      </p>
    </Panel>
  );
}
