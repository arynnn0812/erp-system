import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api/axios.js';
import Modal from '../../components/Modal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Departments() {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null); // {id?, name}
  const [error, setError] = useState('');

  const load = () => api.get('/departments').then((r) => setRows(r.data.data));
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      if (form.id) await api.put(`/departments/${form.id}`, { name: form.name });
      else await api.post('/departments', { name: form.name });
      setForm(null); load();
    } catch (err) { setError(errMsg(err)); }
  }

  async function remove(id) {
    if (!confirm('Delete this department?')) return;
    try { await api.delete(`/departments/${id}`); load(); }
    catch (err) { alert(errMsg(err)); } // 409 if it still has employees
  }

  return (
    <>
      <div className="row-between">
        <h2>Departments</h2>
        <button className="btn btn-primary" onClick={() => setForm({ name: '' })}>+ Department</button>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Employees</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={3} className="empty">No departments</td></tr>}
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.employee_count}</td>
                <td>
                  <div className="row">
                    <button className="btn" onClick={() => setForm({ id: d.id, name: d.name })}>Edit</button>
                    {hasRole('ADMIN') && (
                      <button className="btn btn-danger" onClick={() => remove(d.id)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={form.id ? 'Edit department' : 'New department'} onClose={() => setForm(null)}>
          {error && <div className="error">{error}</div>}
          <form onSubmit={save}>
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
