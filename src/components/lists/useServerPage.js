import { useEffect, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

// The page and page size of a list the SERVER pages (quotations, delivery notes).
//
// `resetKey` names everything that changes which rows there are (status, search, period): while it differs from the one the
// page was chosen under, the page is 1 - derived, so a filter change asks the server once, not twice. A page size starts again
// from the first page.
export function useServerPage(resetKey, { size = DEFAULT_PAGE_SIZE } = {}) {
  const [state, setState] = useState({ page: 1, size, key: resetKey });
  const page = state.key === resetKey ? state.page : 1;
  return {
    page,
    pageSize: state.size,
    setPage: (p) => setState((s) => ({ ...s, page: p, key: resetKey })),
    setPageSize: (n) => setState({ page: 1, size: n, key: resetKey }),
  };
}

// If the page the person is on no longer exists (the last row of the last page was deleted, or a refresh found fewer rows) and
// the server answered it empty, move to the last page that does. `pagination` is the server's { pages, total } for the page just
// read; `loaded` says it is for the current request.
export function useClampPage({ pagination, loaded, page, setPage }) {
  const lastPage = pagination?.pages || 1;
  useEffect(() => {
    if (loaded && pagination?.total > 0 && page > lastPage) setPage(lastPage);
  }, [loaded, pagination?.total, page, lastPage]); // eslint-disable-line react-hooks/exhaustive-deps
}
