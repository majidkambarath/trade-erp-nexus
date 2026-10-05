import { banking } from "../../lib/bankingApi";
import { partyMaster } from "../../lib/partyMasterApi";
import { useAsync } from "../accounting/kit";

// The two lists the party form picks from: the bank master and the document types. `enabled` false
// (an account form that is not for a customer or vendor) loads nothing.
export default function usePartyLookups(enabled = true) {
  const banks = useAsync(() => (enabled ? banking.banks({ active: "true" }) : Promise.resolve([])), [enabled]);
  const types = useAsync(() => (enabled ? partyMaster.documentTypes.list({ active: "true" }) : Promise.resolve([])), [enabled]);
  return {
    banks: banks.data || [],
    banksLoading: banks.loading,
    documentTypes: types.data || [],
    typesLoading: types.loading,
  };
}
