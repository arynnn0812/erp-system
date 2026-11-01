import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, pool, resetDb, loginAll, PASSWORD } from './helpers.js';

let t;
beforeAll(async () => { await resetDb(); t = await loginAll(); });
afterAll(() => pool.end());

describe('auth', () => {
  it('logs in and returns a token plus the user without the password hash', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'admin@test.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user).toMatchObject({ email: 'admin@test.com', role: 'ADMIN' });
    expect(res.body.data.user.password_hash).toBeUndefined();
  });

  it('gives the same 401 for an unknown email and a wrong password', async () => {
    const a = await api().post('/api/auth/login').send({ email: 'nobody@test.com', password: 'x' });
    const b = await api().post('/api/auth/login').send({ email: 'admin@test.com', password: 'wrong' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('rejects requests without a token (401) and with a forged one (401)', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401);
    expect((await api('not.a.jwt').get('/api/auth/me')).status).toBe(401);
  });

  it('returns the current user from /me', async () => {
    const res = await api(t.HR.token).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ email: 'hr@test.com', role: 'HR' });
  });

  it('enforces roles: only ADMIN lists users or registers accounts', async () => {
    expect((await api(t.MANAGER.token).get('/api/users')).status).toBe(403);
    expect((await api(t.ADMIN.token).get('/api/users')).status).toBe(200);

    const body = { name: 'New', email: 'new@test.com', password: 'Str0ng!Passw0rd', role: 'EMPLOYEE' };
    expect((await api(t.MANAGER.token).post('/api/auth/register').send(body)).status).toBe(403);
    expect((await api(t.ADMIN.token).post('/api/auth/register').send(body)).status).toBe(201);
    expect((await api(t.ADMIN.token).post('/api/auth/register').send(body)).status).toBe(409);
  });

  it('returns 400 with field errors for invalid login input', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['email', 'password']));
  });
});
