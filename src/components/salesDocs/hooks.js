import { useEffect, useState } from "react";
import axiosInstance from "../../axios/axios";

// The customers and stock items the order form needs, loaded the way the sales order page loads them.
export function useOrderLookups() {
  const [customers, setCustomers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  useEffect(() => {
    let live = true;
    axiosInstance.get("/customers/customers").then((r) => live && setCustomers(r.data.data || [])).catch(() => {});
    axiosInstance
      .get("/stock/stock")
      .then((r) => {
        if (!live) return;
        const stocks = r.data.data?.stocks || r.data.data || [];
        setStockItems(
          stocks.map((s) => ({
            _id: s._id, itemId: s.itemId, itemName: s.itemName, itemType: s.itemType, sku: s.sku, category: s.category, unitOfMeasure: s.unitOfMeasure,
            unitOfMeasureDetails: s.unitOfMeasureDetails || {}, currentStock: s.currentStock, purchasePrice: s.purchasePrice,
            salesPrice: s.salesPrice, reorderLevel: s.reorderLevel, status: s.status, taxPercent: s.taxPercent || 5,
          }))
        );
      })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return { customers, stockItems };
}

// A value that settles: a search box that asks the server on every keystroke would race itself.
export function useDebounced(value, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

// Run an action on a document: busy while it runs, the server's message if it refuses, a toast and a
// reload when it works. Returns what the action returned, or true if it returned nothing, or undefined
// if it failed. `refresh: false` is for an action that leaves the screen, which has nothing left to reload.
export function useDocumentAction({ notify, reload }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const run = async (fn, message, { refresh = true } = {}) => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await fn();
      notify(typeof message === "function" ? message(result) : message);
      if (refresh) await reload?.(result);
      return result ?? true;
    } catch (e) {
      setProblem(e);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, run, clear: () => setProblem(null) };
}
