// Publishes a 'dashboard' change after any successful write to the data the
// dashboard summarises (products, categories, customers, orders, employees).
// Done here, once, rather than in every service: a new write endpoint under
// these paths is covered without anyone remembering to add a publish call.
// The cost is an occasional refresh that changed nothing on screen.
const events = require('../utils/events');

const WATCHED = /^\/api\/(products|categories|customers|orders|employees)(\/|\?|$)/;
const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

module.exports = function notifyChanges(req, res, next) {
  if (!READS.has(req.method) && WATCHED.test(req.originalUrl)) {
    res.on('finish', () => {
      if (res.statusCode < 400) events.publish('dashboard');
    });
  }
  next();
};
