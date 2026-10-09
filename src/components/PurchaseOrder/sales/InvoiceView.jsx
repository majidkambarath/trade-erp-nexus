/* Sales order / tax invoice: the document is built in shared/invoiceDocuments, the page is shared. */
import React, { useMemo } from "react";
import InvoiceScreen from "../shared/InvoiceScreen";
import { ApprovalBanner } from "../../shell/Approval";
import { useCompanyProfile } from "../shared/useCompanyProfile";
import { buildSalesDocument } from "../shared/invoiceDocuments";
import { orgCurrency } from "../../../utils/orgLocale";

// A stable stand-in while the party is not found (a new {} each render would rebuild the document).
const NO_PARTY = {};

const SaleInvoiceView = ({
  selectedSO,
  createdSO,
  customers,
  setActiveView,
  setSelectedSO,
  setCreatedSO,
}) => {
  const company = useCompanyProfile();
  const so = createdSO || selectedSO;
  const customer = (so && customers.find((c) => c._id === so.customerId)) || NO_PARTY;
  const currency = orgCurrency();
  const doc = useMemo(() => (so ? buildSalesDocument(so, customer, company, currency) : null), [so, customer, company, currency]);

  if (!doc) return null;

  // Only an approved order is a tax invoice, so only it can be sent: a draft shows no Send button at all.
  const sendable = so.status === "APPROVED" && !so.isOpening;
  const send = sendable
    ? {
        kind: "tax_invoice", sourceType: "Transaction", id: so.id || so._id, number: doc.sheet.number.value, title: doc.sheet.title,
        companyName: company.companyName, lastSend: so.lastSend || null,
        party: { email: customer.email, phone: customer.phone, contacts: customer.contacts },
      }
    : null;

  return (
    <InvoiceScreen
      sheet={doc.sheet}
      fileName={doc.fileName}
      status={doc.status}
      missingTrn={doc.missingTrn}
      auditId={so.id || so._id}
      send={send}
      banner={<ApprovalBanner doc={so} permission="sales.approve" />}
      onBack={() => {
        setSelectedSO(null);
        setCreatedSO(null);
        setActiveView("list");
      }}
    />
  );
};

export default SaleInvoiceView;
