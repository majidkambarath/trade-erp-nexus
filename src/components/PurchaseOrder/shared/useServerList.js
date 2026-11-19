import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPeriodCount, fetchTransactionPage, fetchTransactionSummary } from "../../../lib/transactionList";

// What a trade-document list page reads from the server: ONE filtered, sorted page of documents, the cards of the whole
// period, and (when the page compares with the period before) how many documents that period held.
//
//   - the page is asked again whenever the period, the filters, the sort or the page change; an answer to an older question is
//     dropped, so quick typing never shows an earlier search's rows
//   - the search is sent 300 ms after the last keystroke
//   - the cards describe the period (not the filters) and are asked again only when the period changes or `refresh()` is called
//     after a save, an approval or a delete
// `refresh({ quiet: true })` reads again without blanking the list.

const SEARCH_WAIT = 300;

export default function useServerList({ http, type, period, compare = null, search = "", status = "ALL", partyId = "ALL", recurring = "", sort, order, page, size, onError }) {
  const [state, setState] = useState({ rows: [], total: 0, pages: 1 });
  const [summary, setSummary] = useState(null);
  const [previousCount, setPreviousCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState(String(search ?? "").trim());
  const quiet = useRef(false);
  const asked = useRef(0);
  const askedCards = useRef(0);
  const fail = useRef(onError);
  fail.current = onError;

  useEffect(() => {
    const needle = String(search ?? "").trim();
    if (needle === settled) return undefined;
    const t = setTimeout(() => setSettled(needle), SEARCH_WAIT);
    return () => clearTimeout(t);
  }, [search, settled]);

  useEffect(() => {
    const ask = ++asked.current;
    if (!quiet.current) setLoading(true);
    (async () => {
      try {
        const got = await fetchTransactionPage(http, { type, period, search: settled, status, partyId, recurring, sort, order, page, limit: size });
        if (ask !== asked.current) return;
        setState(got);
      } catch (error) {
        if (ask === asked.current) fail.current?.(error);
      } finally {
        if (ask === asked.current) {
          setLoading(false);
          quiet.current = false;
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the period is read by its key
  }, [http, type, period.key, settled, status, partyId, recurring, sort, order, page, size, tick]);

  const compareKey = compare ? `${compare.from || ""}|${compare.to || ""}` : "";
  useEffect(() => {
    const ask = ++askedCards.current;
    (async () => {
      const [cards, before] = await Promise.all([
        fetchTransactionSummary(http, { type, period }).catch((error) => {
          if (ask === askedCards.current) fail.current?.(error);
          return null;
        }),
        compare && (compare.from || compare.to) ? fetchPeriodCount(http, { type, period: compare }) : Promise.resolve(null),
      ]);
      if (ask !== askedCards.current) return;
      setSummary(cards);
      setPreviousCount(before);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the periods are read by their keys
  }, [http, type, period.key, compareKey, tick]);

  const refresh = useCallback((opts = {}) => {
    quiet.current = opts.quiet === true;
    setTick((n) => n + 1);
  }, []);

  return { rows: state.rows, total: state.total, pages: state.pages, summary, previousCount, loading, refresh };
}
