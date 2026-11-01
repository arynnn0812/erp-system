// Frontend twin of the backend middleware chain: auth gate + role gate.
// Reminder for interviews: this is UX, not security - the backend's
// authorize middleware is the real enforcement.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from './ui/Button.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-center"><Spinner large label="Checking your session" /></div>;
  }
  // Remember where they were going, so login can send them back there.
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
