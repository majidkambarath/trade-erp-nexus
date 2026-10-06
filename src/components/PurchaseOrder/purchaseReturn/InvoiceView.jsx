/* Purchase return: the document is built in shared/invoiceDocuments, the page is shared with the other documents. */
import React, { useMemo } from "react";
import InvoiceScreen from "../shared/InvoiceScreen";
import { useCompanyProfile } from "../shared/useCompanyProfile";
import { buildPurchaseReturnDocument } from "../shared/invoiceDocuments";
import { getBrand } from "../../../config/brands";

// A stable stand-in while the vendor is not found (a new {} each render would rebuild the document).
const NO_PARTY = {};

const InvoiceView = ({
  selectedPO,
  vendors = [],
  setActiveView,
  createdPO,
  setSelectedPO,
  setCreatedPO,
}) => {
  const company = useCompanyProfile();
  const po = createdPO || selectedPO;
  const vendor = (po && vendors.find((v) => v._id === po.vendorId)) || NO_PARTY;
  const currency = getBrand().currency;
  const doc = useMemo(
    () => (po?.items ? buildPurchaseReturnDocument(po, vendor, company, currency) : null),
    [po, vendor, company, currency]
  );

  if (!doc) return null;

  return (
    <InvoiceScreen
      sheet={doc.sheet}
      fileName={doc.fileName}
      status={doc.status}
      missingTrn={doc.missingTrn}
      auditId={po.id || po._id}
      onBack={() => {
        setSelectedPO?.(null);
        setCreatedPO?.(null);
        setActiveView?.("list");
      }}
    />
  );
};

export default InvoiceView;
