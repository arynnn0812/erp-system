// Employees: HR/ADMIN can create/edit; MANAGER sees the list WITHOUT the
// salary column - we simply don't render a column the API didn't send.
import { useState } from 'react';
import api, { errMsg } from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi, usePagedList } from '../../hooks/useApi.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useConfirm } from '../../components/ui/ConfirmDialog.jsx';
import { Alert, Badge, Card, PageHeader, SearchInput } from '../../components/ui/index.jsx';
import { inr, dateFmt, dateLong } from '../../utils/format.js';

const EMPTY = { name: '', email: '', departmentId: '', designation: '', joiningDate: '', salary: '' };

export default function Employees() {
  const { hasRole } = useAuth();
  const canWrite = hasRole('ADMIN', 'HR');
  const seesSalary = hasRole('ADMIN', 'HR');
  const toast = useToast();
  const confirm = useConfirm();

  const [search, setSearch] = useState('');
  const list = usePagedList('/employees', { search });
  const departments = useApi(canWrite ? '/departments' : null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openForm = (f) => { setError(''); setForm(f); };

  async function save(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const body = { ...form, departmentId: Number(form.departmentId), salary: Number(form.salary) };
    try {
      if (form.id) await api.put(`/employees/${form.id}`, body);
      else await api.post('/employees', body);
      toast.success(form.id ? `${form.name} updated` : `${form.name} added`);
      setForm(null); list.reload();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  async function remove(emp) {
    const ok = await confirm({
      title: 'Delete employee record?',
      message: `${emp.name}'s HR record will be permanently removed. Their login account, if any, is not affected.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try { await api.delete(`/employees/${emp.id}`); toast.success(`${emp.name} deleted`); list.reload(); }
    catch (err) { toast.error(errMsg(err)); } // 409 while they still have documents
  }

  const columns = [
    {
      key: 'name', label: 'Name', primary: true,
      render: (r) => <><span className="cell-strong">{r.name}</span><span className="cell-sub">{r.email}</span></>,
    },
    { key: 'designation', label: 'Role' },
    { key: 'department', label: 'Department', render: (r) => <Badge>{r.department}</Badge> },
    { key: 'joining_date', label: 'Joined', render: (r) => <span className="nowrap">{dateLong(r.joining_date)}</span> },
    ...(seesSalary ? [{ key: 'salary', label: 'Salary / yr', align: 'right', render: (r) => <span className="num">{inr(r.salary)}</span> }] : []),
    ...(canWrite ? [{
      key: 'actions', label: '', actions: true,
      render: (r) => (
        <div className="row-end">
          <Button size="sm" variant="ghost" collapse icon="edit" onClick={() => openForm({ id: r.id, name: r.name, email: r.email,
            departmentId: r.department_id, designation: r.designation,
            joiningDate: dateFmt(r.joining_date), salary: r.salary })}>Edit</Button>
          {hasRole('ADMIN') && (
            <Button size="sm" variant="ghost-danger" iconOnly icon="trash" aria-label={`Delete ${r.name}`} title="Delete" onClick={() => remove(r)} />
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        description={seesSalary ? 'Your team, with departments and compensation.' : 'Your team and their departments.'}
        actions={canWrite && <Button variant="primary" icon="plus" onClick={() => openForm({ ...EMPTY })}>Add employee</Button>}
      />

      <Card>
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or role…" label="Search employees" />
          {!list.loading && <span className="toolbar-meta">{list.total} {list.total === 1 ? 'employee' : 'employees'}</span>}
        </div>
        <DataTable
          caption="Employees"
          columns={columns} rows={list.rows} loading={list.loading} error={list.error}
          page={list.page} pages={list.pages} total={list.total} onPage={list.setPage}
          empty={search
            ? { icon: 'search', title: 'No matching employees', message: `Nothing matches “${search}”.` }
            : { icon: 'badge', title: 'No employees yet', message: canWrite ? 'Add your first team member.' : undefined }}
        />
      </Card>

      {form && (
        <Modal title={form.id ? 'Edit employee' : 'Add employee'} size="lg" onClose={() => setForm(null)}>
          <Alert>{error}</Alert>
          {departments.data?.length === 0 && <Alert tone="warning">Create a department first; every employee belongs to one.</Alert>}
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="Full name">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} autoComplete="off" />
              </Field>
              <Field label="Work email">
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required maxLength={255} autoComplete="off" />
              </Field>
              <Field label="Department">
                <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
                  <option value="">Select…</option>
                  {(departments.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Designation">
                <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required maxLength={100} />
              </Field>
              <Field label="Joining date">
                <input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} required />
              </Field>
              <Field label="Salary (₹ / year)">
                <input type="number" min="0" step="1" inputMode="numeric" value={form.salary}
                       onChange={(e) => setForm({ ...form, salary: e.target.value })} required />
              </Field>
            </div>
            <ModalFooter>
              <Button onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy}>{form.id ? 'Save changes' : 'Add employee'}</Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </>
  );
}
