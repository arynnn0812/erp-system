// Employees: HR/ADMIN can create/edit; MANAGER sees the list WITHOUT the
// salary column - we simply don't render a column the API didn't send.
import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import DataTable from '../../components/DataTable.jsx';
import Modal from '../../components/Modal.jsx';
import { inr, dateFmt } from '../../utils/format.js';

const EMPTY = { name: '', email: '', departmentId: '', designation: '', joiningDate: '', salary: '' };

export default function Employees() {
  const { hasRole } = useAuth();
  const canWrite = hasRole('ADMIN', 'HR');
  const seesSalary = hasRole('ADMIN', 'HR');

  const [data, setData] = useState({ rows: [], page: 1, pages: 1 });
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  async function load(p = 1) {
    const res = await api.get('/employees', { params: { search, page: p, limit: 10 } });
    setData(res.data);
  }
  useEffect(() => { load(1); }, [search]); // eslint-disable-line
  useEffect(() => { api.get('/departments').then((r) => setDepartments(r.data.data)); }, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    const body = { ...form, departmentId: Number(form.departmentId), salary: Number(form.salary) };
    try {
      if (form.id) await api.put(`/employees/${form.id}`, body);
      else await api.post('/employees', body);
      setForm(null); load(data.page);
    } catch (err) { setError(errMsg(err)); }
  }

  async function remove(id) {
    if (!confirm('Delete this employee record?')) return;
    try { await api.delete(`/employees/${id}`); load(data.page); }
    catch (err) { alert(errMsg(err)); }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' },
    { key: 'designation', label: 'Designation' },
    { key: 'joining_date', label: 'Joined', render: (r) => dateFmt(r.joining_date) },
    ...(seesSalary ? [{ key: 'salary', label: 'Salary', render: (r) => inr(r.salary) }] : []),
    ...(canWrite ? [{
      key: 'actions', label: '',
      render: (r) => (
        <div className="row">
          <button className="btn" onClick={() => setForm({ id: r.id, name: r.name, email: r.email,
            departmentId: r.department_id, designation: r.designation,
            joiningDate: dateFmt(r.joining_date), salary: r.salary })}>Edit</button>
          {hasRole('ADMIN') && <button className="btn btn-danger" onClick={() => remove(r.id)}>Delete</button>}
        </div>
      ),
    }] : []),
  ];

  return (
    <>
      <div className="row-between">
        <h2>Employees</h2>
        <div className="row">
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
          {canWrite && <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>+ Employee</button>}
        </div>
      </div>

      <DataTable columns={columns} rows={data.rows} page={data.page} pages={data.pages} onPage={load} />

      {form && (
        <Modal title={form.id ? 'Edit employee' : 'New employee'} onClose={() => setForm(null)}>
          {error && <div className="error">{error}</div>}
          <form onSubmit={save}>
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <label>Department</label>
            <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
              <option value="">Select…</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <label>Designation</label>
            <input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required />
            <label>Joining date</label>
            <input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} required />
            <label>Salary (₹/year)</label>
            <input type="number" min="0" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} required />
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
