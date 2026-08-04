import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api/axios.js';
import DataTable from '../../components/DataTable.jsx';
import Modal from '../../components/Modal.jsx';

const EMPTY = { name: '', email: '', phone: '', address: '' };

export default function Customers() {
  const [data, setData] = useState({ rows: [], page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  async function load(p = 1) {
    const res = await api.get('/customers', { params: { search, page: p, limit: 10 } });
    setData(res.data);
  }
  useEffect(() => { load(1); }, [search]); // eslint-disable-line

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      if (form.id) await api.put(`/customers/${form.id}`, form);
      else await api.post('/customers', form);
      setForm(null); load(data.page);
    } catch (err) { setError(errMsg(err)); }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email', render: (r) => r.email || '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.phone || '—' },
    { key: 'address', label: 'Address', render: (r) => r.address || '—' },
    { key: 'actions', label: '', render: (r) => (
        <button className="btn" onClick={() => setForm({ id: r.id, name: r.name,
          email: r.email || '', phone: r.phone || '', address: r.address || '' })}>Edit</button>
    )},
  ];

  return (
    <>
      <div className="row-between">
        <h2>Customers</h2>
        <div className="row">
          <input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
          <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>+ Customer</button>
        </div>
      </div>

      <DataTable columns={columns} rows={data.rows} page={data.page} pages={data.pages} onPage={load} />

      {form && (
        <Modal title={form.id ? 'Edit customer' : 'New customer'} onClose={() => setForm(null)}>
          {error && <div className="error">{error}</div>}
          <form onSubmit={save}>
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <label>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <label>Address</label>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
