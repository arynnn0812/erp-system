import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { api, pool, resetDb, loginAll } from './helpers.js';

let t;
let departmentId;
beforeAll(async () => {
  await resetDb();
  t = await loginAll();
  departmentId = (await api(t.HR.token).post('/api/departments').send({ name: 'Engineering' })).body.data.id;
});
afterAll(() => pool.end());

let n = 0;
const employee = (overrides = {}) => ({
  name: 'Asha Rao',
  email: `asha${(n += 1)}@test.com`,
  departmentId,
  designation: 'Engineer',
  joiningDate: '2026-01-15',
  salary: 1200000,
  ...overrides,
});
const create = async (overrides) => {
  const res = await api(t.HR.token).post('/api/employees').send(employee(overrides));
  if (res.status !== 201) throw new Error(`create employee: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.id;
};

describe('employees', () => {
  it('hides salary from MANAGER but shows it to HR', async () => {
    const id = await create();
    const asManager = await api(t.MANAGER.token).get(`/api/employees/${id}`);
    const asHr = await api(t.HR.token).get(`/api/employees/${id}`);
    expect(asManager.body.data.salary).toBeUndefined();
    expect(Number(asHr.body.data.salary)).toBe(1200000);
  });

  it('audits salary changes with the old and new values', async () => {
    const id = await create();
    const body = employee({ salary: 1500000 });
    expect((await api(t.HR.token).put(`/api/employees/${id}`).send(body)).status).toBe(200);
    const [[log]] = await pool.query(
      "SELECT details FROM audit_logs WHERE action = 'SALARY_CHANGE' AND entity_id = ?", [id]
    );
    expect(log.details).toEqual({ from: 1200000, to: 1500000 });
  });

  // B1
  it('returns joining_date exactly as stored', async () => {
    const id = await create({ joiningDate: '2026-01-15' });
    const res = await api(t.HR.token).get(`/api/employees/${id}`);
    expect(res.body.data.joining_date).toBe('2026-01-15');
  });

  // B4
  it('rejects updating to another employee’s email with 409', async () => {
    const taken = employee();
    await create({ email: taken.email });
    const id = await create();
    const res = await api(t.HR.token).put(`/api/employees/${id}`).send(employee({ email: taken.email }));
    expect(res.status).toBe(409);
  });

  it('validates the search filter on the employee list', async () => {
    expect((await api(t.HR.token).get('/api/employees?search=Asha')).status).toBe(200);
    expect((await api(t.HR.token).get(`/api/employees?search=${'x'.repeat(101)}`)).status).toBe(400);
  });

  it('rejects a userId that does not exist with 400', async () => {
    const res = await api(t.ADMIN.token).post('/api/employees').send(employee({ userId: 9999 }));
    expect(res.status).toBe(400);
  });

  // B8
  it('links an employee to a login on update, which unlocks their own documents', async () => {
    const id = await create();
    const res = await api(t.ADMIN.token).put(`/api/employees/${id}`).send(employee({ userId: t.EMPLOYEE.id }));
    expect(res.status).toBe(200);
    expect((await api(t.HR.token).get(`/api/employees/${id}`)).body.data.user_id).toBe(t.EMPLOYEE.id);

    const own = await api(t.EMPLOYEE.token).get(`/api/documents?ownerType=EMPLOYEE&ownerId=${id}`);
    expect(own.status).toBe(200);
    const other = await create();
    const theirs = await api(t.EMPLOYEE.token).get(`/api/documents?ownerType=EMPLOYEE&ownerId=${other}`);
    expect(theirs.status).toBe(403);
  });
});

describe('linking an employee record to a login', () => {
  // A linked login sees that record's salary and documents, so HR must not
  // be able to hand someone else's record to an arbitrary account.
  it('is ADMIN-only; HR edits that leave the link alone still work', async () => {
    const id = await create();
    const link = { userId: t.MANAGER.id };
    expect((await api(t.HR.token).post('/api/employees').send(employee(link))).status).toBe(403);
    expect((await api(t.HR.token).put(`/api/employees/${id}`).send(employee(link))).status).toBe(403);
    expect((await api(t.ADMIN.token).put(`/api/employees/${id}`).send(employee(link))).status).toBe(200);

    // HR: omitting userId, or sending the current value, keeps the link
    expect((await api(t.HR.token).put(`/api/employees/${id}`).send(employee({ salary: 1300000 }))).status).toBe(200);
    expect((await api(t.HR.token).put(`/api/employees/${id}`).send(employee(link))).status).toBe(200);
    expect((await api(t.HR.token).put(`/api/employees/${id}`).send(employee({ userId: null }))).status).toBe(403);
    expect((await api(t.HR.token).get(`/api/employees/${id}`)).body.data.user_id).toBe(t.MANAGER.id);
  });
});

describe('departments', () => {
  it('refuses to delete a department that still has employees (409)', async () => {
    await create();
    expect((await api(t.ADMIN.token).delete(`/api/departments/${departmentId}`)).status).toBe(409);
  });

  it('rejects renaming to an existing department name with 409', async () => {
    const id = (await api(t.HR.token).post('/api/departments').send({ name: 'Sales' })).body.data.id;
    expect((await api(t.HR.token).put(`/api/departments/${id}`).send({ name: 'Engineering' })).status).toBe(409);
  });
});

describe('documents', () => {
  it('checks permissions before reporting storage state', async () => {
    const id = await create();
    const upload = (token) => api(token).post('/api/documents')
      .field('ownerType', 'EMPLOYEE').field('ownerId', String(id))
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'offer.pdf', contentType: 'application/pdf' });
    expect((await upload(t.EMPLOYEE.token)).status).toBe(403);
    expect((await upload(t.MANAGER.token)).status).toBe(403);
    expect((await upload(t.HR.token)).status).toBe(503); // S3 not configured in tests
  });
});
