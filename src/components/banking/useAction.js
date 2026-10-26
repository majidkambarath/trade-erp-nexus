import { useState } from "react";

// run() -> on success onDone(message); on failure the error stays in the dialog, where the person can act on it.
// `message` may be a function of run()'s result (a bulk act words its own outcome).
export function useAction(run, onDone, message) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const go = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await run();
      onDone(typeof message === "function" ? message(result) : message);
    } catch (e) {
      setProblem(e);
      setBusy(false);
    }
  };
  return { busy, problem, go };
}
