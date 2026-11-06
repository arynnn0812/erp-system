// Data-fetching hooks shared by the pages.
//
// Both key each response by the request that produced it and ignore any
// response that arrives after a newer request started. That fixes the race
// the old pages had: type "lap", then "laptop", and the slower "lap" reply
// could land last and overwrite the right results.
import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '../api/axios.js';

// GET a single resource: const { data, loading, error, reload } = useApi('/departments')
// (For a paged endpoint, `data` is the first page's rows.)
// Pass null as the url to skip the request (e.g. a role that may not call it).
export function useApi(url, params) {
  const [nonce, setNonce] = useState(0);
  const reqKey = url ? JSON.stringify([url, params, nonce]) : null;
  const [result, setResult] = useState({ key: null, data: undefined, error: '' });

  useEffect(() => {
    if (!reqKey) return undefined;
    let stale = false;
    const [u, p] = JSON.parse(reqKey);
    api.get(u, { params: p })
      .then((r) => { if (!stale) setResult({ key: reqKey, data: r.data.data ?? r.data.rows, error: '' }); })
      .catch((e) => { if (!stale) setResult((prev) => ({ ...prev, key: reqKey, error: errMsg(e) })); });
    return () => { stale = true; };
  }, [reqKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data: result.data, error: result.error, loading: !!reqKey && result.key !== reqKey, reload };
}

// Server-paginated list. Changing `params` (search text, filters) returns to
// page 1 without an extra request.
//   const list = usePagedList('/products', { search });
//   list.rows, list.page, list.pages, list.total, list.loading, list.setPage(n), list.reload()
export function usePagedList(url, params = {}, { limit = 10 } = {}) {
  // Empty filters are left out of the query string ("status=" would fail validation).
  const filterKey = JSON.stringify(Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined)
  ));
  const [pageState, setPageState] = useState({ filterKey, page: 1 });
  const page = pageState.filterKey === filterKey ? pageState.page : 1;
  const [nonce, setNonce] = useState(0);

  const reqKey = JSON.stringify([url, filterKey, page, limit, nonce]);
  const [result, setResult] = useState({ key: null, rows: [], total: 0, pages: 1, error: '' });

  useEffect(() => {
    let stale = false;
    const [u, f, p, l] = JSON.parse(reqKey);
    api.get(u, { params: { ...JSON.parse(f), page: p, limit: l } })
      .then((r) => {
        if (stale) return;
        const { rows, total, pages } = r.data;
        // Deleting the last row on the last page leaves an empty page: step back.
        if (rows.length === 0 && p > 1) { setPageState({ filterKey: f, page: Math.max(1, pages) }); return; }
        setResult({ key: reqKey, rows, total, pages: Math.max(1, pages), error: '' });
      })
      .catch((e) => { if (!stale) setResult((prev) => ({ ...prev, key: reqKey, error: errMsg(e) })); });
    return () => { stale = true; };
  }, [reqKey]);

  const setPage = useCallback((p) => setPageState({ filterKey, page: p }), [filterKey]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...result, page, loading: result.key !== reqKey, setPage, reload };
}
