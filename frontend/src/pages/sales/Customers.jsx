import { useState } from 'react';
import api, { errMsg } from '../../api/axios.js';
import { usePagedList } from '../../hooks/useApi.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Alert, Card, PageHeader, SearchInput } from '../../components/ui/index.jsx';

const EMPTY = { name: '', email: '', phone: '', address: '' };

export default function Customers() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const list = usePagedList('/customers', { search });
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openForm = (f) => { setError(''); setForm(f); };

  async function save(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (form.id) await api.put(`/customers/${form.id}`, form);
      else await api.post('/customers', form);
      toast.success(form.id ? `${form.name} updated` : `${form.name} added`);
      setForm(null); list.reload();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  const dash = (v) => v || <span className="muted">—</span>;
  const columns = [
    { key: 'name', label: 'Name', primary: true, render: (r) => <span className="cell-strong">{r.name}</span> },
    { key: 'email', label: 'Email', render: (r) => (r.email ? <a href={`mailto:${r.email}`}>{r.email}</a> : dash()) },
    { key: 'phone', label: 'Phone', render: (r) => <span className="num">{dash(r.phone)}</span> },
    { key: 'address', label: 'Address', render: (r) => dash(r.address) },
    {
      key: 'actions', label: '', actions: true,
      render: (r) => (
        <Button size="sm" variant="ghost" collapse icon="edit" onClick={() => openForm({ id: r.id, name: r.name,
          email: r.email || '', phone: r.phone || '', address: r.address || '' })}>Edit</Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Customers"
        description="People and businesses you sell to."
        actions={<Button variant="primary" icon="plus" onClick={() => openForm({ ...EMPTY })}>Add customer</Button>}
      />

      <Card>
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or phone…" label="Search customers" />
          {!list.loading && <span className="toolbar-meta">{list.total} {list.total === 1 ? 'customer' : 'customers'}</span>}
        </div>
        <DataTable
          caption="Customers"
          columns={columns} rows={list.rows} loading={list.loading} error={list.error}
          page={list.page} pages={list.pages} total={list.total} onPage={list.setPage}
          empty={search
            ? { icon: 'search', title: 'No matching customers', message: `Nothing matches “${search}”.` }
            : { icon: 'users', title: 'No customers yet', message: 'Add a customer to start taking orders.' }}
        />
      </Card>

      {form && (
        <Modal title={form.id ? 'Edit customer' : 'Add customer'} onClose={() => setForm(null)}>
          <Alert>{error}</Alert>
          <form onSubmit={save}>
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
            </Field>
            <div className="form-grid">
              <Field label="Email" optional>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
              </Field>
              <Field label="Phone" optional>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={20} />
              </Field>
            </div>
            <Field label="Address" optional>
              <textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} maxLength={255} />
            </Field>
            <ModalFooter>
              <Button onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy}>{form.id ? 'Save changes' : 'Add customer'}</Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </>
  );
}
