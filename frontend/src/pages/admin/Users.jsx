// Login accounts and their access (ADMIN only). Role changes, deactivation
// and password resets sign the person out everywhere on their next request;
// the API refuses changes that would lock an admin out of their own account.
import { useState } from 'react';
import api, { errMsg } from '../../api/axios.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { ROLE_LABEL } from '../../config/nav.js';
import DataTable from '../../components/ui/DataTable.jsx';
import Modal, { ModalFooter } from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { useConfirm } from '../../components/ui/ConfirmDialog.jsx';
import { Alert, Badge, Card, PageHeader } from '../../components/ui/index.jsx';
import { tsDate } from '../../utils/format.js';

const ROLES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];
const ROLE_HELP = {
  ADMIN: 'Everything, including users and the audit log.',
  HR: 'Employees, departments and salaries.',
  MANAGER: 'Inventory, customers, orders and reports.',
  EMPLOYEE: 'Read-only inventory and their own profile.',
};
const PASSWORD_HINT = 'At least 10 characters, with a letter and a number.';

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, loading, error: loadError, reload } = useApi('/users');
  const [dialog, setDialog] = useState(null); // {kind: 'create'|'role'|'password', ...}
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const open = (d) => { setError(''); setDialog(d); };
  const set = (patch) => setDialog((d) => ({ ...d, ...patch }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      if (dialog.kind === 'create') {
        await api.post('/auth/register', { name: dialog.name, email: dialog.email, password: dialog.password, role: dialog.role });
        toast.success(`${dialog.name} can now sign in`, 'Account created');
      } else if (dialog.kind === 'role') {
        await api.patch(`/users/${dialog.id}`, { role: dialog.role });
        toast.success(`${dialog.name} is now ${ROLE_LABEL[dialog.role]}`);
      } else {
        await api.post(`/users/${dialog.id}/reset-password`, { newPassword: dialog.password });
        toast.success(`${dialog.name}'s password was reset and their sessions signed out`);
      }
      setDialog(null); reload();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  async function toggleActive(u) {
    const activate = !u.is_active;
    if (!activate) {
      const ok = await confirm({
        title: `Deactivate ${u.name}?`,
        message: 'They are signed out immediately and cannot sign in until reactivated. Their history is kept.',
        confirmLabel: 'Deactivate', danger: true,
      });
      if (!ok) return;
    }
    try {
      await api.patch(`/users/${u.id}`, { isActive: activate });
      toast.success(`${u.name} ${activate ? 'reactivated' : 'deactivated'}`);
      reload();
    } catch (err) { toast.error(errMsg(err)); }
  }

  const columns = [
    {
      key: 'name', label: 'User', primary: true,
      render: (u) => (
        <>
          <span className="cell-strong">{u.name}</span>{u.id === me.id && <> <Badge tone="primary">You</Badge></>}
          <span className="cell-sub">{u.email}{u.employee_id ? ' · HR record linked' : ''}</span>
        </>
      ),
    },
    { key: 'role', label: 'Role', render: (u) => <Badge tone={u.role === 'ADMIN' ? 'primary' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge> },
    {
      key: 'is_active', label: 'Status',
      render: (u) => (u.is_active ? <Badge tone="success" dot>Active</Badge> : <Badge tone="danger" dot>Deactivated</Badge>),
    },
    { key: 'created_at', label: 'Created', render: (u) => <span className="nowrap">{tsDate(u.created_at)}</span> },
    {
      key: 'actions', label: '', actions: true,
      render: (u) => (
        <div className="row-end">
          <Button size="sm" variant="ghost" collapse icon="shield" disabled={u.id === me.id}
                  title={u.id === me.id ? 'You cannot change your own role' : undefined}
                  onClick={() => open({ kind: 'role', id: u.id, name: u.name, role: u.role })}>Role</Button>
          <Button size="sm" variant="ghost" collapse icon="key"
                  onClick={() => open({ kind: 'password', id: u.id, name: u.name, password: '' })}>Reset password</Button>
          {u.id !== me.id && (
            <Button size="sm" variant={u.is_active ? 'ghost-danger' : 'ghost'} collapse icon={u.is_active ? 'x' : 'check'} onClick={() => toggleActive(u)}>
              {u.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const titles = { create: 'Add user', role: `Change role · ${dialog?.name}`, password: `Reset password · ${dialog?.name}` };

  return (
    <>
      <PageHeader
        title="Users & access"
        description="Who can sign in, and what each person can do."
        actions={<Button variant="primary" icon="plus" onClick={() => open({ kind: 'create', name: '', email: '', password: '', role: 'EMPLOYEE' })}>Add user</Button>}
      />
      <Card>
        <DataTable caption="Users" columns={columns} rows={data || []} loading={loading} error={loadError} />
      </Card>

      {dialog && (
        <Modal title={titles[dialog.kind]} onClose={() => setDialog(null)}>
          <Alert>{error}</Alert>
          <form onSubmit={submit}>
            {dialog.kind === 'create' && (
              <>
                <Field label="Full name">
                  <input value={dialog.name} onChange={(e) => set({ name: e.target.value })} required maxLength={100} autoComplete="off" />
                </Field>
                <Field label="Email">
                  <input type="email" value={dialog.email} onChange={(e) => set({ email: e.target.value })} required maxLength={255} autoComplete="off" />
                </Field>
              </>
            )}
            {(dialog.kind === 'create' || dialog.kind === 'role') && (
              <Field label="Role" hint={ROLE_HELP[dialog.role]}>
                <select value={dialog.role} onChange={(e) => set({ role: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </Field>
            )}
            {(dialog.kind === 'create' || dialog.kind === 'password') && (
              <Field label={dialog.kind === 'create' ? 'Initial password' : 'New password'} hint={PASSWORD_HINT}>
                <input type="text" value={dialog.password} onChange={(e) => set({ password: e.target.value })}
                       required minLength={10} autoComplete="new-password" spellCheck={false} />
              </Field>
            )}
            {dialog.kind !== 'create' && (
              <Alert tone="info">{dialog.name} will be signed out on every device and must sign in again.</Alert>
            )}
            <ModalFooter>
              <Button onClick={() => setDialog(null)}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy}>
                {dialog.kind === 'create' ? 'Create account' : dialog.kind === 'role' ? 'Change role' : 'Reset password'}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </>
  );
}
