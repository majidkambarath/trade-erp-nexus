import React from "react";
import { useParams } from "react-router-dom";
import PartyAccountPage from "../shared/PartyAccountPage";

// /debit-accounts/vendor/:vendorId - one vendor's account (Payables).
export default function VendorDetailsPage() {
  const { vendorId } = useParams();
  return <PartyAccountPage key={vendorId} kind="vendor" partyId={vendorId} />;
}
