// In-process change notifications for live views (the dashboard stream).
//
// A successful write publishes a topic; every open stream forwards it. The
// event carries no business data - clients refetch through the normal,
// role-checked endpoints - so a stream can never leak numbers its viewer is
// not allowed to read.
//
// One process only: with several API instances behind a load balancer, a
// write on one instance is not seen by streams on another. That needs a
// shared bus (Redis pub/sub, for example); see docs/ARCHITECTURE.md.
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per open stream

// A CSV import or a burst of orders becomes one refresh, not dozens.
const COALESCE_MS = 500;
const pending = new Map(); // topic -> timer

function publish(topic) {
  if (pending.has(topic)) return;
  const timer = setTimeout(() => {
    pending.delete(topic);
    bus.emit('change', topic);
  }, COALESCE_MS);
  timer.unref();
  pending.set(topic, timer);
}

// Returns the unsubscribe function.
function onChange(listener) {
  bus.on('change', listener);
  return () => bus.off('change', listener);
}

// Graceful shutdown: open streams would otherwise hold server.close() open
// until the forced exit.
function onCloseAll(listener) {
  bus.on('close-all', listener);
  return () => bus.off('close-all', listener);
}
const closeAll = () => bus.emit('close-all');

module.exports = { publish, onChange, onCloseAll, closeAll, COALESCE_MS };
