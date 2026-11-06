// Self-service for every role: account details, the linked HR record (with
// the person's own salary), their documents, password change, and signing
// out of every other device.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../api/axios.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { ROLE_LABEL } from '../config/nav.js';
import DocumentsPanel from '../components/DocumentsPanel.jsx';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useConfirm } from '../components/ui/ConfirmDialog.jsx';
import { Alert, Badge, Card, PageHeader, Skeleton } from '../components/ui/index.jsx';
import { inr, dateLong } from '../utils/format.js';

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' };

export default function Profile() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const profile = useApi('/auth/profile');
  const [pw, setPw] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const u = profile.data?.user;
  const e = profile.data?.employee;
  const mismatch = pw.confirm && pw.newPassword !== pw.confirm;

  async function changePassword(ev) {
    ev.preventDefault();
    if (mismatch) return;
    setError(''); setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      setPw(EMPTY);
      toast.success('Other devices were signed out; this one stays signed in.', 'Password changed');
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  async function signOutEverywhere() {
    const ok = await confirm({
      title: 'Sign out everywhere?',
      message: 'Every session on every device ends, including this one. You will need to sign in again.',
      confirmLabel: 'Sign out everywhere', danger: true,
    });
    if (!ok) return;
    try {
      await api.post('/auth/logout-all');
      await logout();
      navigate('/login');
    } catch (err) { toast.error(errMsg(err)); }
  }

  return (
    <>
      <PageHeader title="My profile" description="Your account, your HR record and your security settings." />
      <Alert>{profile.error}</Alert>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <Card title="Account" pad>
            {!u ? <Skeleton height={60} /> : (
              <dl className="detail-grid">
                <div><dt>Name</dt><dd>{u.name}</dd></div>
                <div><dt>Email</dt><dd>{u.email}</dd></div>
                <div><dt>Role</dt><dd><Badge tone="primary">{ROLE_LABEL[u.role] || u.role}</Badge></dd></div>
              </dl>
            )}
          </Card>

          <Card title="Employment" pad>
            {profile.loading ? <Skeleton height={60} /> : !e ? (
              <p className="muted">Your login isn&apos;t linked to an employee record. HR can link it from the Employees page.</p>
            ) : (
              <dl className="detail-grid">
                <div><dt>Designation</dt><dd>{e.designation}</dd></div>
                <div><dt>Department</dt><dd>{e.department}</dd></div>
                <div><dt>Joined</dt><dd>{dateLong(e.joining_date)}</dd></div>
                <div><dt>Salary / year</dt><dd className="num">{inr(e.salary)}</dd></div>
              </dl>
            )}
          </Card>

          {e && <DocumentsPanel ownerType="EMPLOYEE" ownerId={e.id} title="My documents" />}
        </div>

        <div className="stack">
          <Card title="Change password" pad>
            <Alert>{error}</Alert>
            <form onSubmit={changePassword}>
              <Field label="Current password">
                <input type="password" value={pw.currentPassword} autoComplete="current-password" required
                       onChange={(ev) => setPw({ ...pw, currentPassword: ev.target.value })} />
              </Field>
              <Field label="New password" hint="At least 10 characters, with a letter and a number.">
                <input type="password" value={pw.newPassword} autoComplete="new-password" required minLength={10}
                       onChange={(ev) => setPw({ ...pw, newPassword: ev.target.value })} />
              </Field>
              <Field label="Confirm new password" error={mismatch ? 'Passwords do not match.' : undefined}>
                <input type="password" value={pw.confirm} autoComplete="new-password" required
                       onChange={(ev) => setPw({ ...pw, confirm: ev.target.value })} />
              </Field>
              <Button type="submit" variant="primary" loading={busy} disabled={mismatch}>Change password</Button>
            </form>
          </Card>

          <Card title="Sessions" pad>
            <p className="muted" style={{ marginBottom: 'var(--sp-4)' }}>
              Lost a device, or signed in on a shared computer? End every session at once.
            </p>
            <Button variant="danger" icon="logout" onClick={signOutEverywhere}>Sign out everywhere</Button>
          </Card>
        </div>
      </div>
    </>
  );
}
