import { useState } from "react";

// Runs an action with a busy flag and the server's refusal kept in the dialog, so nothing typed is lost.
// `onDone(message, result)` is called on success; `message` may be a function of the result.
export function useAction(run, onDone, message) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const go = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await run();
      onDone?.(typeof message === "function" ? message(result) : message, result);
    } catch (e) {
      setProblem(e);
    } finally {
      setBusy(false);
    }
  };
  return { busy, problem, go, setProblem };
}

const TYPE_LABEL = { receipt: "Receipt", payment: "Payment", journal: "Journal", contra: "Contra", expense: "Expense", cheque_clearance: "Cheque cleared", cheque: "Cheque", debit_note: "Debit note", credit_note: "Credit note" };
export const typeLabel = (t) => TYPE_LABEL[t] || t || "Entry";
