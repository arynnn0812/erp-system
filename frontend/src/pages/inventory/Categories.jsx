import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useConfirm } from '../../components/ui/ConfirmDialog.jsx';
import { Alert, Card, PageHeader } from '../../components/ui/index.jsx';

export default function Categories() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error: loadError, reload } = useApi('/categories');
  const [form, setForm] = useState(null); // {id?, name}
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openForm = (f) => { setError(''); setForm(f); };

  async function save(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (form.id) await api.put(`/categories/${form.id}`, { name: form.name });
      else await api.post('/categories', { name: form.name });
      toast.success(form.id ? 'Category renamed' : `${form.name} created`);
      setForm(null); reload();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  async function remove(c) {
    if (c.product_count > 0) {
      toast.error(`${c.name} still has ${c.product_count} ${c.product_count === 1 ? 'product' : 'products'}. Move or deactivate them first.`);
      return;
    }
    const ok = await confirm({ title: `Delete ${c.name}?`, message: 'The category is removed permanently.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await api.delete(`/categories/${c.id}`); toast.success(`${c.name} deleted`); reload(); }
    catch (err) { toast.error(errMsg(err)); }
  }

  const columns = [
    { key: 'name', label: 'Category', primary: true, render: (c) => <span className="cell-strong">{c.name}</span> },
    { key: 'product_count', label: 'Products', align: 'right', render: (c) => <span className="num">{c.product_count}</span> },
    {
      key: 'actions', label: '', actions: true,
      render: (c) => (
        <div className="row-end">
          <Button size="sm" variant="ghost" collapse icon="edit" onClick={() => openForm({ id: c.id, name: c.name })}>Rename</Button>
          {hasRole('ADMIN') && (
            <Button size="sm" variant="ghost-danger" iconOnly icon="trash" aria-label={`Delete ${c.name}`} title="Delete" onClick={() => remove(c)} />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Categories"
        description={<>Groups for your <Link to="/inventory">products</Link>; every product belongs to one.</>}
        actions={<Button variant="primary" icon="plus" onClick={() => openForm({ name: '' })}>Add category</Button>}
      />
      <Card>
        <DataTable
          caption="Categories"
          columns={columns} rows={data || []} loading={loading} error={loadError}
          empty={{
            icon: 'layers', title: 'No categories yet', message: 'Create a category before adding products.',
            action: <Button size="sm" variant="primary" icon="plus" onClick={() => openForm({ name: '' })}>Add category</Button>,
          }}
        />
      </Card>

      {form && (
        <Modal title={form.id ? 'Rename category' : 'Add category'} size="sm" onClose={() => setForm(null)}>
          <Alert>{error}</Alert>
          <form onSubmit={save}>
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={100} />
            </Field>
            <ModalFooter>
              <Button onClick={() => setForm(null)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy}>Save</Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </>
  );
}
