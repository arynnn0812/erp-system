// Live updates from GET /api/dashboard/stream (Server-Sent Events).
//
//   const status = useLiveUpdates(reloadEverything);
//
// Calls onChange when the API says data changed, and once more when a dropped
// connection comes back (events sent while it was down are not replayed).
//
// EventSource retries a dropped connection by itself, but gives up for good
// on an error response - which is what a proxy returns while the API
// restarts (502), as does the API itself when it refuses (401, 429). Then
// this polls every POLL_MS and tries the stream again every RETRY_MS, so a
// deploy does not leave the dashboard on polling until the page is reloaded.
//
// status: 'connecting' | 'live' | 'polling'
import { useEffect, useRef, useState } from 'react';

export const STREAM_URL = '/api/dashboard/stream';
export const POLL_MS = 60_000;
export const RETRY_MS = 30_000;

const hasEventSource = () => typeof window !== 'undefined' && 'EventSource' in window;

export function useLiveUpdates(onChange) {
  const [status, setStatus] = useState(() => (hasEventSource() ? 'connecting' : 'polling'));
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; });

  useEffect(() => {
    let poll = null;
    let retry = null;
    let es = null;
    let missed = false; // events may have been lost: refresh once when back
    const startPolling = () => { if (!poll) poll = setInterval(() => callback.current(), POLL_MS); };
    const stopPolling = () => { clearInterval(poll); poll = null; };

    if (!hasEventSource()) {
      startPolling();
      return stopPolling;
    }

    const connect = () => {
      es = new EventSource(STREAM_URL);
      es.addEventListener('ready', () => {
        stopPolling();
        setStatus('live');
        if (missed) { missed = false; callback.current(); }
      });
      es.addEventListener('change', () => callback.current());
      es.onerror = () => {
        missed = true;
        if (es.readyState !== EventSource.CLOSED) { setStatus('connecting'); return; } // browser retries
        es.close();
        setStatus('polling');
        startPolling();
        retry = setTimeout(connect, RETRY_MS);
      };
    };
    connect();

    return () => { es.close(); clearTimeout(retry); stopPolling(); };
  }, []);

  return status;
}
