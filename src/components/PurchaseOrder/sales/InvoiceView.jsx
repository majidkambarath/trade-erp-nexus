/* Sales order / tax invoice: the document is built in shared/invoiceDocuments, the page is shared. */
import React, { useMemo } from "react";
import InvoiceScreen from "../shared/InvoiceScreen";
import { useCompanyProfile } from "../shared/useCompanyProfile";
import { buildSalesDocument } from "../shared/invoiceDocuments";
import { getBrand } from "../../../config/brands";

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
  const currency = getBrand().currency;
  const doc = useMemo(() => (so ? buildSalesDocument(so, customer, company, currency) : null), [so, customer, company, currency]);

  if (!doc) return null;

  return (
    <InvoiceScreen
      sheet={doc.sheet}
      fileName={doc.fileName}
      status={doc.status}
      missingTrn={doc.missingTrn}
      auditId={so.id || so._id}
      onBack={() => {
        setSelectedSO(null);
        setCreatedSO(null);
        setActiveView("list");
      }}
    />
  );
};

export default SaleInvoiceView;
