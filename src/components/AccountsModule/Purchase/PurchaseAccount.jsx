import React from "react";
import PartyAccountsList from "../shared/PartyAccountsList";

// /debit-accounts - Payables: every vendor with what is owed to them and what is overdue.
export default function DebitAccountsManagement() {
  return <PartyAccountsList kind="vendor" />;
}
