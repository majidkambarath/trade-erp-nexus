import React, { useState } from "react";
import { PRODUCT_NAME } from "../../config/product";
import { securityPolicy, twoFactor } from "../../lib/authApi";
import { useOrganisation } from "../shell/OrganisationContext";
import Can from "../shell/Can";
import TwoFactorPanel from "../security/TwoFactorPanel";

// The organisation's rule "everyone signs in with two-factor". Only someone who may change settings sees it (hidden from the rest,
// never shown disabled). The server refuses to switch it on for someone who has not set two-factor up themselves, and so does this.
function Policy({ notify }) {
  const { me, status, refresh } = useOrganisation();
  const required = Boolean(status?.policy?.security?.requireTwoFactor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function change(next) {
    setError("");
    if (next && me && me.twoFactorEnabled === false) {
      return setError("Turn on two-factor for your own account first. The rule applies to you too.");
    }
    setBusy(true);
    try {
      await securityPolicy.save({ requireTwoFactor: next });
      await refresh();
      notify?.(next ? "Everyone must now use two-factor" : "Two-factor is no longer required");
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Can permission="settings.manage">
      <div className="mt-6 max-w-xl border-t border-border pt-5">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={required} disabled={busy} onChange={(e) => change(e.target.checked)} className="mt-0.5 h-5 w-5 accent-foreground lg:h-4 lg:w-4" />
          <span>
            <span className="block font-medium text-foreground">Require two-factor for everyone in this organisation</span>
            <span className="block text-muted-foreground">Until a person has set it up, they can do nothing else: the app asks them to set it up first.</span>
          </span>
        </label>
        {error && <p role="alert" className="mt-3 rounded-xl border border-status-danger/25 bg-status-danger-soft p-3 text-sm text-status-danger">{error}</p>}
      </div>
    </Can>
  );
}

// Settings -> Security: a person's own two-factor, and (for those who may change settings) the organisation's rule about it.
export default function TwoFactorSection({ notify }) {
  const { me, status, refresh } = useOrganisation();
  const required = Boolean(status?.policy?.security?.requireTwoFactor);
  return (
    <TwoFactorPanel api={twoFactor} account={me?.email} issuer={PRODUCT_NAME} locked={required} notify={notify} onChanged={refresh}>
      <Policy notify={notify} />
    </TwoFactorPanel>
  );
}
