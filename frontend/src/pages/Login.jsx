import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api/axios.js';
import Button from '../components/ui/Button.jsx';
import Field from '../components/ui/Field.jsx';
import Icon from '../components/ui/Icon.jsx';
import { Alert } from '../components/ui/index.jsx';
import ThemeSwitch from '../components/layout/ThemeSwitch.jsx';

// The seed script's accounts. Listed only in development, or when a demo
// deployment opts in with VITE_SHOW_DEMO_ACCOUNTS=true; a real deployment
// never advertises credentials on its sign-in page.
const SHOW_DEMO = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';
const DEMO_PASSWORD = 'Password@123';
const DEMO_ACCOUNTS = [
  { email: 'admin@erp.com', role: 'Admin', note: 'Everything' },
  { email: 'manager@erp.com', role: 'Manager', note: 'Stock & sales' },
  { email: 'hr@erp.com', role: 'HR', note: 'People & salaries' },
  { email: 'employee@erp.com', role: 'Employee', note: 'Read-only' },
];

const FEATURES = [
  { icon: 'box', text: 'Stock that can never go negative, with a full movement ledger' },
  { icon: 'receipt', text: 'Orders priced on the server and reversible in one click' },
  { icon: 'shield', text: 'Role-based access down to individual salary fields' },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = 'Sign in · ERP System'; }, []);

  const from = location.state?.from || '/';
  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-aside" aria-hidden="true">
        <div className="auth-brand"><span className="brand-mark">E</span> ERP System</div>
        <div>
          <h2>Inventory, sales and people, in one place.</h2>
          <p>A small-business ERP built around correctness: every stock movement and order is transactional and audited.</p>
          <ul className="auth-features">
            {FEATURES.map((f) => <li key={f.icon}><Icon name={f.icon} />{f.text}</li>)}
          </ul>
        </div>
        <div className="auth-foot">React · Express · MySQL</div>
      </aside>

      <main className="auth-main">
        <div className="auth-theme"><ThemeSwitch /></div>
        <div className="auth-card">
          <h1>Sign in</h1>
          <p>Welcome back. Use your work email to continue.</p>

          <Alert>{error}</Alert>
          <form onSubmit={onSubmit}>
            <Field label="Email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     autoComplete="username" required autoFocus />
            </Field>
            <Field label="Password" htmlFor="login-password">
              <div className="input-group">
                <input id="login-password" className="input" style={{ paddingLeft: 12, paddingRight: 44 }}
                       type={showPassword ? 'text' : 'password'} value={password}
                       onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" className="btn btn-ghost btn-icon btn-sm input-action"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
            </Field>
            <Button type="submit" variant="primary" block loading={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {SHOW_DEMO && (
            <div className="demo-box">
              <div className="demo-box-title">Demo accounts · password {DEMO_PASSWORD}</div>
              <div className="demo-accounts">
                {DEMO_ACCOUNTS.map((a) => (
                  <button key={a.email} type="button" onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setError(''); }}>
                    <strong>{a.role}</strong>
                    <span>{a.note}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
