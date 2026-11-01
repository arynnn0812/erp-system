import { Link } from 'react-router-dom';
import Icon from '../components/ui/Icon.jsx';

export default function NotFound() {
  return (
    <div className="state-page">
      <div className="state-code">404</div>
      <h1 style={{ fontSize: 20 }}>Page not found</h1>
      <p>The page you asked for doesn&apos;t exist, or the link that brought you here is out of date.</p>
      <Link to="/" className="btn btn-primary"><Icon name="dashboard" size={16} /> Back to dashboard</Link>
    </div>
  );
}
