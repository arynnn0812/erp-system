// The route guard: signed-out users go to /login (remembering where they were
// headed), signed-in users without the role go home.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute from '../src/components/ProtectedRoute.jsx';
import { useAuth } from '../src/context/AuthContext.jsx';

vi.mock('../src/context/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

function LoginProbe() {
  const { state } = useLocation();
  return <p>login page, from {state?.from}</p>;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginProbe />} />
        <Route path="/" element={<p>home page</p>} />
        <Route path="/users" element={<ProtectedRoute roles={['ADMIN']}><p>users page</p></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>
  );
}

const as = (user, loading = false) => useAuth.mockReturnValue({ user, loading });

describe('ProtectedRoute', () => {
  beforeEach(() => useAuth.mockReset());

  it('waits while the session is being checked', () => {
    as(null, true);
    renderAt('/users');
    expect(screen.getByRole('status', { name: 'Checking your session' })).toBeTruthy();
    expect(screen.queryByText('users page')).toBeNull();
  });

  it('sends a signed-out user to sign in, remembering the page', () => {
    as(null);
    renderAt('/users?tab=roles');
    expect(screen.getByText('login page, from /users?tab=roles')).toBeTruthy();
  });

  it('sends a user without the role home', () => {
    as({ id: 2, role: 'MANAGER' });
    renderAt('/users');
    expect(screen.getByText('home page')).toBeTruthy();
  });

  it('renders the page for an allowed role', () => {
    as({ id: 1, role: 'ADMIN' });
    renderAt('/users');
    expect(screen.getByText('users page')).toBeTruthy();
  });
});
