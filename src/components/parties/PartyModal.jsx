import React, { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { ErrorNote, Modal } from "../accounting/kit";
import PartyForm from "./PartyForm";
import usePartyLookups from "./usePartyLookups";
import { partyMaster } from "../../lib/partyMasterApi";
import { fieldForServerError, firstSectionWithErrors, formToPayload, partyToForm, validateParty } from "../../lib/partyForms";

// Add or edit a customer / vendor in a dialog: the party form, validated here with the server's
// rules, then saved through the customer / vendor API. Used by the Customer and Vendor pages.
//
//   kind "customer" | "vendor"      record the saved party to edit (none: a new one)
//   onSaved(party)                  called with the saved record      onClose()  cancel
export default function PartyModal({ kind, record, onClose, onSaved }) {
  const editing = Boolean(record?._id);
  const noun = kind === "vendor" ? "vendor" : "customer";
  const lookups = usePartyLookups();
  const [form, setForm] = useState(() => partyToForm(kind, record));
  const [submitted, setSubmitted] = useState(false); // after the first try, mistakes show and clear as they are fixed
  const [serverErrors, setServerErrors] = useState({});
  const [section, setSection] = useState("basic");
  const [topError, setTopError] = useState(null);
  const [busy, setBusy] = useState(false);
  const clientErrors = useMemo(
    () => (submitted ? validateParty(kind, form, { documentTypes: lookups.documentTypes }) : {}),
    [submitted, kind, form, lookups.documentTypes]
  );
  const errors = { ...clientErrors, ...serverErrors };
  const change = (next) => {
    setForm(next);
    if (Object.keys(serverErrors).length) setServerErrors({});
  };

  async function submit(ev) {
    ev.preventDefault();
    setTopError(null);
    setSubmitted(true);
    const found = validateParty(kind, form, { documentTypes: lookups.documentTypes });
    if (Object.keys(found).length) {
      setSection(firstSectionWithErrors(found));
      return;
    }
    setBusy(true);
    try {
      const saved = await partyMaster.parties.save(kind, record?._id, formToPayload(kind, form));
      const word = `${noun[0].toUpperCase()}${noun.slice(1)}`;
      onSaved?.(saved, editing ? `${word} updated successfully!` : `${word} created successfully!`);
    } catch (err) {
      const field = fieldForServerError(err);
      if (field) {
        setServerErrors({ [field]: err.message });
        setSection(firstSectionWithErrors({ [field]: true }));
      } else {
        setTopError(err);
      }
      setBusy(false);
    }
  }

  return (
    <Modal
      size="xl" onClose={onClose} title={editing ? `Edit ${noun}` : `Add ${noun}`}
      description={editing ? `${kind === "vendor" ? record.vendorName : record.customerName} · ${kind === "vendor" ? record.vendorId : record.customerId}` : `Create a new ${noun} record. Its ledger account is created with it.`}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="party-form" disabled={busy}>{busy ? "Saving…" : editing ? `Update ${noun}` : `Add ${noun}`}</Button>
        </>
      }
    >
      <form id="party-form" onSubmit={submit} noValidate className="space-y-4">
        {topError && <ErrorNote error={topError} />}
        <PartyForm
          kind={kind} value={form} onChange={change} errors={errors} section={section} onSection={setSection}
          banks={lookups.banks} banksLoading={lookups.banksLoading} documentTypes={lookups.documentTypes} typesLoading={lookups.typesLoading}
        />
      </form>
    </Modal>
  );
}
