// Live dashboard stream (Server-Sent Events): who may open it, what a write
// sends, and that a stream ends when its session stops being valid.
// Supertest waits for a response to finish, which a stream never does, so
// these tests listen on a real port and read the stream with http.get.
import http from 'http';
import { createRequire } from 'module';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool, api, resetDb, loginAll, makeProduct } from './helpers.js';

// require(), not import: shares the module instances the app uses.
const require = createRequire(import.meta.url);
const app = require('../src/app');
const events = require('../src/utils/events');
const { MAX_STREAMS_PER_USER } = require('../src/controllers/stream.controller');

let server;
let base;
let users;

beforeAll(async () => {
  await resetDb();
  users = await loginAll();
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  events.closeAll();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

// Opens the stream and collects what arrives. `next(pattern)` resolves once
// the received text matches; `ended` resolves when the server closes it.
function openStream(token) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${base}/api/dashboard/stream`, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
      let text = '';
      const waiters = [];
      const ended = new Promise((done) => res.on('end', done));
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        text += chunk;
        for (const w of waiters.splice(0)) if (!w.check()) waiters.push(w);
      });
      const next = (pattern, ms = 3000) => new Promise((ok, fail) => {
        const timer = setTimeout(() => fail(new Error(`no ${pattern} in: ${JSON.stringify(text)}`)), ms);
        const check = () => (pattern.test(text) ? (clearTimeout(timer), ok(text), true) : false);
        if (!check()) waiters.push({ check });
      });
      resolve({ res, next, ended, text: () => text, close: () => req.destroy() });
    });
    req.on('error', reject);
  });
}

// Lets the coalescing timer fire and the event reach the client.
const settle = () => new Promise((r) => setTimeout(r, events.COALESCE_MS + 300));

describe('GET /api/dashboard/stream', () => {
  it('needs a session', async () => {
    expect((await api().get('/api/dashboard/stream')).status).toBe(401);
  });

  it('is open to every role and sends a change event, without data, after a write', async () => {
    const s = await openStream(users.EMPLOYEE.token);
    expect(s.res.statusCode).toBe(200);
    expect(s.res.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(s.res.headers['x-accel-buffering']).toBe('no');
    await s.next(/event: ready/);

    await makeProduct(users.ADMIN.token);
    const text = await s.next(/event: change/);
    expect(text).toContain('data: {"topic":"dashboard"}');
    expect(text).not.toMatch(/Widget|price|revenue/i); // a nudge to refetch, never the numbers
    s.close();
  });

  it('coalesces a burst of writes into one event', async () => {
    const s = await openStream(users.MANAGER.token);
    await s.next(/event: ready/);
    const cat = (await api(users.ADMIN.token).post('/api/categories').send({ name: 'Burst' })).body.data.id;
    await Promise.all([1, 2, 3].map(() => makeProduct(users.ADMIN.token, { categoryId: cat })));
    await settle();
    expect(s.text().match(/event: change/g)).toHaveLength(1);
    s.close();
  });

  it('stays quiet for reads and failed writes', async () => {
    const s = await openStream(users.MANAGER.token);
    await s.next(/event: ready/);
    await api(users.ADMIN.token).get('/api/products');
    await api(users.ADMIN.token).post('/api/products').send({ name: '' }); // 400
    await api(users.EMPLOYEE.token).post('/api/categories').send({ name: 'Nope' }); // 403
    await settle();
    expect(s.text()).not.toContain('event: change');
    s.close();
  });

  it('ends instead of forwarding once the session is revoked', async () => {
    const s = await openStream(users.HR.token);
    await s.next(/event: ready/);
    expect((await api(users.HR.token).post('/api/auth/logout-all')).status).toBe(200);

    await makeProduct(users.ADMIN.token);
    await s.ended;
    expect(s.text()).not.toContain('event: change');
    users.HR = (await loginAll()).HR; // later tests should not depend on this one
  });

  it(`allows ${MAX_STREAMS_PER_USER} streams per user`, async () => {
    const open = [];
    for (let i = 0; i < MAX_STREAMS_PER_USER; i += 1) open.push(await openStream(users.ADMIN.token));
    const extra = await openStream(users.ADMIN.token);
    expect(extra.res.statusCode).toBe(429);
    extra.close();

    open.pop().close(); // one closes, so a new one fits
    await new Promise((r) => setTimeout(r, 100));
    const again = await openStream(users.ADMIN.token);
    expect(again.res.statusCode).toBe(200);
    for (const s of [...open, again]) s.close();
  });

  it('ends every stream on shutdown', async () => {
    const s = await openStream(users.ADMIN.token);
    await s.next(/event: ready/);
    events.closeAll();
    await s.ended; // would hang (and time out) if shutdown left it open
  });
});
