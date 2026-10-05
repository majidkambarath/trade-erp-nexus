import React from "react";
import { useParams } from "react-router-dom";
import PartyAccountPage from "../shared/PartyAccountPage";

// /credit-accounts/customer/:customerId - one customer's account (Receivables).
export default function CustomerDetailsPage() {
  const { customerId } = useParams();
  return <PartyAccountPage key={customerId} kind="customer" partyId={customerId} />;
}
