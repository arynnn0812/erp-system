import { useState } from 'react';
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

export default function Departments() {
  const { hasRole } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error: loadError, reload } = useApi('/departments');
  const [form, setForm] = useState(null); // {id?, name}
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const openForm = (f) => { setError(''); setForm(f); };

  async function save(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (form.id) await api.put(`/departments/${form.id}`, { name: form.name });
      else await api.post('/departments', { name: form.name });
      toast.success(form.id ? 'Department renamed' : `${form.name} created`);
      setForm(null); reload();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  async function remove(d) {
    if (d.employee_count > 0) {
      toast.error(`${d.name} still has ${d.employee_count} ${d.employee_count === 1 ? 'employee' : 'employees'}. Move them to another department first.`);
      return;
    }
    const ok = await confirm({ title: `Delete ${d.name}?`, message: 'The department is removed permanently.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await api.delete(`/departments/${d.id}`); toast.success(`${d.name} deleted`); reload(); }
    catch (err) { toast.error(errMsg(err)); } // 409 if employees were added meanwhile
  }

  const columns = [
    { key: 'name', label: 'Department', primary: true, render: (d) => <span className="cell-strong">{d.name}</span> },
    { key: 'employee_count', label: 'Employees', align: 'right', render: (d) => <span className="num">{d.employee_count}</span> },
    {
      key: 'actions', label: '', actions: true,
      render: (d) => (
        <div className="row-end">
          <Button size="sm" variant="ghost" collapse icon="edit" onClick={() => openForm({ id: d.id, name: d.name })}>Rename</Button>
          {hasRole('ADMIN') && (
            <Button size="sm" variant="ghost-danger" iconOnly icon="trash" aria-label={`Delete ${d.name}`} title="Delete" onClick={() => remove(d)} />
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Departments"
        description="Teams that employees belong to."
        actions={<Button variant="primary" icon="plus" onClick={() => openForm({ name: '' })}>Add department</Button>}
      />
      <Card>
        <DataTable
          caption="Departments"
          columns={columns} rows={data || []} loading={loading} error={loadError}
          empty={{ icon: 'building', title: 'No departments yet', message: 'Create one before adding employees.' }}
        />
      </Card>

      {form && (
        <Modal title={form.id ? 'Rename department' : 'Add department'} size="sm" onClose={() => setForm(null)}>
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
