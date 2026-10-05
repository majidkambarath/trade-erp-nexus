import React from "react";
import PartyAccountsList from "../shared/PartyAccountsList";

// /credit-accounts - Receivables: every customer with what they owe and how much credit is used.
export default function CreditAccountsManagement() {
  return <PartyAccountsList kind="customer" />;
}
