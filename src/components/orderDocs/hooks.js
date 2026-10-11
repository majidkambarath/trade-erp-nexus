import { useEffect, useState } from "react";
import axiosInstance from "../../axios/axios";

export { useDebounced, useDocumentAction } from "../salesDocs/hooks";

// The parties and stock items an order or receipt form needs. A sales order takes customers; a purchase order and goods
// received take vendors. The stock map keeps what a purchase line reads (brand, origin, expiry, VAT), which the sales one drops.
export function useTradeLookups(kind) {
  const [parties, setParties] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  useEffect(() => {
    let live = true;
    const url = kind === "sales" ? "/customers/customers" : "/vendors/vendors";
    axiosInstance.get(url).then((r) => live && setParties(r.data.data || [])).catch(() => {});
    axiosInstance
      .get("/stock/stock")
      .then((r) => {
        if (!live) return;
        const stocks = r.data.data?.stocks || r.data.data || [];
        setStockItems(
          stocks.map((s) => ({
            _id: s._id, itemId: s.itemId, itemName: s.itemName, itemType: s.itemType, sku: s.sku, category: s.category, unitOfMeasure: s.unitOfMeasure,
            unitOfMeasureDetails: s.unitOfMeasureDetails || {}, currentStock: s.currentStock, purchasePrice: s.purchasePrice, salesPrice: s.salesPrice,
            reorderLevel: s.reorderLevel, status: s.status, taxPercent: s.taxPercent || 5, brand: s.brand, origin: s.origin, expiryDate: s.expiryDate,
          }))
        );
      })
      .catch(() => {});
    return () => { live = false; };
  }, [kind]);
  return { parties, stockItems };
}
