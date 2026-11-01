// Role-based navigation: links come from one config array filtered by role,
// the same roles used in App.jsx route guards - nav and access never drift.
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const LINKS = [
  { to: '/', label: 'Dashboard', roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
  { to: '/inventory', label: 'Inventory', roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
  { to: '/customers', label: 'Customers', roles: ['ADMIN', 'MANAGER'] },
  { to: '/orders', label: 'Orders', roles: ['ADMIN', 'MANAGER'] },
  { to: '/employees', label: 'Employees', roles: ['ADMIN', 'HR', 'MANAGER'] },
  { to: '/departments', label: 'Departments', roles: ['ADMIN', 'HR'] },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <nav className="navbar">
      <span className="brand">ERP</span>
      <div className="nav-links">
        {LINKS.filter((l) => l.roles.includes(user.role)).map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/'}>
            {l.label}
          </NavLink>
        ))}
      </div>
      <div className="nav-user">
        <span className="badge">{user.role}</span>
        <span>{user.name}</span>
        <button className="btn btn-ghost" onClick={async () => { await logout(); navigate('/login'); }}>
          Logout
        </button>
      </div>
    </nav>
  );
}
