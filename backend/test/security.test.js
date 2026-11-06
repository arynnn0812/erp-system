import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { app, api, pool, resetDb, loginAll, PASSWORD } from './helpers.js';

let t;
beforeEach(async () => { await resetDb(); t = await loginAll(); });
afterAll(() => pool.end());

const login = (email, password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });

describe('session cookie', () => {
  it('sets an httpOnly, SameSite=Strict cookie that authenticates on its own', async () => {
    const res = await login('hr@test.com');
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('erp_session='));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\/api/);

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie.split(';')[0]);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('hr@test.com');
  });

  it('clears the cookie on logout', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/erp_session=;.*Expires=Thu, 01 Jan 1970/);
  });
});

describe('revocation', () => {
  it('rejects an existing token as soon as the user is deactivated', async () => {
    expect((await api(t.MANAGER.token).get('/api/products')).status).toBe(200);
    const res = await api(t.ADMIN.token).patch(`/api/users/${t.MANAGER.id}`).send({ isActive: false });
    expect(res.status).toBe(200);
    expect((await api(t.MANAGER.token).get('/api/products')).status).toBe(401);
    expect((await login('manager@test.com')).status).toBe(401);

    await api(t.ADMIN.token).patch(`/api/users/${t.MANAGER.id}`).send({ isActive: true });
    expect((await login('manager@test.com')).status).toBe(200);
  });

  it('applies a role change immediately', async () => {
    await api(t.ADMIN.token).patch(`/api/users/${t.MANAGER.id}`).send({ role: 'EMPLOYEE' });
    expect((await api(t.MANAGER.token).get('/api/orders')).status).toBe(401); // old token revoked
    const fresh = (await login('manager@test.com')).body.data;
    expect(fresh.user.role).toBe('EMPLOYEE');
    expect((await api(fresh.token).get('/api/orders')).status).toBe(403);
  });

  it('logs out every session with logout-all', async () => {
    const second = (await login('hr@test.com')).body.data.token;
    expect((await api(t.HR.token).post('/api/auth/logout-all')).status).toBe(200);
    expect((await api(t.HR.token).get('/api/auth/me')).status).toBe(401);
    expect((await api(second).get('/api/auth/me')).status).toBe(401);
  });

  it('stops an admin from deactivating or demoting themselves', async () => {
    const self = (body) => api(t.ADMIN.token).patch(`/api/users/${t.ADMIN.id}`).send(body);
    expect((await self({ isActive: false })).status).toBe(409);
    expect((await self({ role: 'HR' })).status).toBe(409);
  });

  it('keeps account administration ADMIN-only', async () => {
    expect((await api(t.HR.token).patch(`/api/users/${t.EMPLOYEE.id}`).send({ isActive: false })).status).toBe(403);
  });
});

describe('passwords', () => {
  const change = (token, body) => api(token).post('/api/auth/change-password').send(body);

  it('enforces the password policy', async () => {
    const cases = {
      short: 'Ab1',
      'no digit': 'abcdefghijkl',
      'no letter': '123456789012',
      'over 72 bytes': `A1${'é'.repeat(36)}`, // 74 bytes, 38 characters
    };
    for (const [why, newPassword] of Object.entries(cases)) {
      const res = await change(t.EMPLOYEE.token, { currentPassword: PASSWORD, newPassword });
      expect(res.status, why).toBe(400);
    }
  });

  it('requires the current password', async () => {
    const res = await change(t.EMPLOYEE.token, { currentPassword: 'wrong', newPassword: 'NewPassw0rd!' });
    expect(res.status).toBe(400);
  });

  it('changes the password, revokes old sessions and returns a working new one', async () => {
    const res = await change(t.EMPLOYEE.token, { currentPassword: PASSWORD, newPassword: 'NewPassw0rd!' });
    expect(res.status).toBe(200);
    expect((await api(t.EMPLOYEE.token).get('/api/auth/me')).status).toBe(401);
    expect((await api(res.body.data.token).get('/api/auth/me')).status).toBe(200);
    expect((await login('employee@test.com')).status).toBe(401);
    expect((await login('employee@test.com', 'NewPassw0rd!')).status).toBe(200);
  });

  it('lets an admin reset a password, signing the user out', async () => {
    const res = await api(t.ADMIN.token).post(`/api/users/${t.HR.id}/reset-password`).send({ newPassword: 'Temp0rary-pass' });
    expect(res.status).toBe(200);
    expect((await api(t.HR.token).get('/api/auth/me')).status).toBe(401);
    expect((await login('hr@test.com', 'Temp0rary-pass')).status).toBe(200);
  });

  it('records failed and successful logins in the audit log', async () => {
    await login('hr@test.com', 'wrong');
    const [rows] = await pool.query("SELECT action FROM audit_logs WHERE action IN ('LOGIN', 'LOGIN_FAILED')");
    const actions = rows.map((r) => r.action);
    expect(actions).toContain('LOGIN');
    expect(actions).toContain('LOGIN_FAILED');
  });
});

describe('documents', () => {
  const makeEmployee = async () => {
    const dept = (await api(t.HR.token).post('/api/departments').send({ name: 'Ops' })).body.data.id;
    return (await api(t.HR.token).post('/api/employees').send({
      name: 'Ravi', email: 'ravi@test.com', departmentId: dept,
      designation: 'Analyst', joiningDate: '2026-02-01', salary: 1,
    })).body.data.id;
  };

  it('rejects a file whose bytes do not match its declared type (415)', async () => {
    const id = await makeEmployee();
    const res = await api(t.HR.token).post('/api/documents')
      .field('ownerType', 'EMPLOYEE').field('ownerId', String(id))
      .attach('file', Buffer.from('MZ\x90\x00 pretend executable'), { filename: 'cv.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(415);
  });

  it('will not delete an employee who still has documents', async () => {
    const id = await makeEmployee();
    await pool.query(
      `INSERT INTO documents (owner_type, owner_id, file_name, s3_key, mime_type, size_bytes, uploaded_by)
       VALUES ('EMPLOYEE', ?, 'offer.pdf', 'k', 'application/pdf', 10, ?)`,
      [id, t.HR.id]
    );
    expect((await api(t.ADMIN.token).delete(`/api/employees/${id}`)).status).toBe(409);
  });
});

describe('request tracing', () => {
  it('returns a request id, reusing a well-formed incoming one', async () => {
    const generated = await request(app).get('/api/health');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const passed = await request(app).get('/api/health').set('X-Request-Id', 'trace-abc.123');
    expect(passed.headers['x-request-id']).toBe('trace-abc.123');
    const junk = await request(app).get('/api/health').set('X-Request-Id', 'bad id<script>');
    expect(junk.headers['x-request-id']).not.toBe('bad id<script>');
  });
});
