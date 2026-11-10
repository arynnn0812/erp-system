// Live dashboard updates: refresh on a change event, catch up after a dropped
// connection, and poll (while retrying the stream) when the stream is refused.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLiveUpdates, STREAM_URL, POLL_MS, RETRY_MS } from '../src/hooks/useLiveUpdates.js';

// Minimal EventSource double: tests drive it with emit() and fail().
class FakeEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeEventSource.CONNECTING;
    this.listeners = {};
    this.closed = false;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  close() { this.closed = true; this.readyState = FakeEventSource.CLOSED; }
  emit(type) { act(() => { this.readyState = FakeEventSource.OPEN; (this.listeners[type] || []).forEach((fn) => fn({})); }); }
  // dropped: the browser will reconnect; refused: it gives up (readyState CLOSED)
  fail({ refused }) { act(() => { this.readyState = refused ? FakeEventSource.CLOSED : FakeEventSource.CONNECTING; this.onerror?.(); }); }
}
const latest = () => FakeEventSource.instances.at(-1);

describe('useLiveUpdates', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('goes live and refreshes on each change event', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useLiveUpdates(onChange));
    expect(latest().url).toBe(STREAM_URL);
    expect(result.current).toBe('connecting');

    latest().emit('ready');
    expect(result.current).toBe('live');
    expect(onChange).not.toHaveBeenCalled(); // first connect: the page just loaded its data

    latest().emit('change');
    latest().emit('change');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('refreshes once after a dropped connection comes back', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useLiveUpdates(onChange));
    latest().emit('ready');
    latest().fail({ refused: false });
    expect(result.current).toBe('connecting');

    latest().emit('ready'); // the browser reconnected the same EventSource
    expect(result.current).toBe('live');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('polls when the stream is refused, and goes live again when a retry works', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useLiveUpdates(onChange));
    const first = latest();
    first.fail({ refused: true }); // e.g. a 502 from the proxy during a deploy
    expect(result.current).toBe('polling');
    expect(first.closed).toBe(true);

    act(() => vi.advanceTimersByTime(RETRY_MS));
    expect(FakeEventSource.instances).toHaveLength(2); // retried
    latest().fail({ refused: true }); // API still down

    act(() => vi.advanceTimersByTime(POLL_MS - RETRY_MS));
    expect(onChange).toHaveBeenCalledTimes(1); // polled meanwhile
    expect(FakeEventSource.instances).toHaveLength(3);
    latest().emit('ready'); // back up
    expect(result.current).toBe('live');
    expect(onChange).toHaveBeenCalledTimes(2); // catch-up refresh

    act(() => vi.advanceTimersByTime(POLL_MS * 3));
    expect(onChange).toHaveBeenCalledTimes(2); // polling stopped
  });

  it('closes the stream and stops timers on unmount', () => {
    const onChange = vi.fn();
    const { unmount } = renderHook(() => useLiveUpdates(onChange));
    latest().fail({ refused: true });
    unmount();
    act(() => vi.advanceTimersByTime(POLL_MS * 3));
    expect(onChange).not.toHaveBeenCalled();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(latest().closed).toBe(true);
  });

  it('polls when the browser has no EventSource', () => {
    vi.unstubAllGlobals();
    expect('EventSource' in window).toBe(false); // jsdom has none
    const onChange = vi.fn();
    const { result } = renderHook(() => useLiveUpdates(onChange));
    expect(result.current).toBe('polling');
    act(() => vi.advanceTimersByTime(POLL_MS));
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
