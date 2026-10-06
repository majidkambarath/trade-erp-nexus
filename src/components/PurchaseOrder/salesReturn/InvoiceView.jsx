/* Sales return: the document is built in shared/invoiceDocuments, the page is shared with the other documents. */
import React, { useMemo } from "react";
import InvoiceScreen from "../shared/InvoiceScreen";
import { useCompanyProfile } from "../shared/useCompanyProfile";
import { buildSalesReturnDocument } from "../shared/invoiceDocuments";
import { getBrand } from "../../../config/brands";

// A stable stand-in while the customer is not found (a new {} each render would rebuild the document).
const NO_PARTY = {};

const SaleInvoiceView = ({
  selectedSO,
  createdSO,
  customers = [],
  setActiveView,
  setSelectedSO,
  setCreatedSO,
}) => {
  const company = useCompanyProfile();
  const so = createdSO || selectedSO;
  const customer = (so && customers.find((c) => c._id === so.customerId)) || NO_PARTY;
  const currency = getBrand().currency;
  const doc = useMemo(
    () => (so?.items && Array.isArray(so.items) ? buildSalesReturnDocument(so, customer, company, currency) : null),
    [so, customer, company, currency]
  );

  if (!doc) return null;

  return (
    <InvoiceScreen
      sheet={doc.sheet}
      fileName={doc.fileName}
      status={doc.status}
      missingTrn={doc.missingTrn}
      auditId={so.id || so._id}
      onBack={() => {
        setSelectedSO?.(null);
        setCreatedSO?.(null);
        setActiveView?.("list");
      }}
    />
  );
};

export default SaleInvoiceView;
