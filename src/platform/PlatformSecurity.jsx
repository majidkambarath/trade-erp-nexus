import React from "react";
import { PageHeader, useToasts } from "../components/accounting/kit";
import TwoFactorPanel from "../components/security/TwoFactorPanel";
import { PRODUCT_NAME } from "../config/product";
import { platform } from "./platformApi";

// The signed-in console person's own sign-in security: two-factor, with the same panel a customer's person has on
// Settings -> Security. A colleague who has lost their phone is cleared through the console's API
// (POST /platform/users/:id/2fa/reset), written to the console's own audit.
export default function PlatformSecurity({ user }) {
  const { notify, toastNode } = useToasts();
  return (
    <>
      <PageHeader title="Security" description="How you sign in to the developer console." />
      <TwoFactorPanel api={platform.twoFactor} account={user?.email} issuer={`${PRODUCT_NAME} Console`} notify={notify} />
      {toastNode}
    </>
  );
}
