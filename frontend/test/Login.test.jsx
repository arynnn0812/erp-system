// Sign-in page: submits the typed credentials, returns the user to the page
// they were sent away from, and shows the API's message on failure.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Login from '../src/pages/Login.jsx';
import { useAuth } from '../src/context/AuthContext.jsx';

vi.mock('../src/context/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../src/components/layout/ThemeSwitch.jsx', () => ({ default: () => null }));

function renderLogin(from) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: from && { from } }]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<p>dashboard</p>} />
        <Route path="/orders" element={<p>orders page</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function signIn(email, password) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('Login page', () => {
  let login;
  beforeEach(() => {
    login = vi.fn();
    useAuth.mockReturnValue({ user: null, login });
  });

  it('signs in with what was typed and returns to the page the user wanted', async () => {
    login.mockResolvedValue({ id: 1, role: 'ADMIN' });
    renderLogin('/orders');
    await signIn('admin@erp.com', 'secret-pass');
    expect(login).toHaveBeenCalledWith('admin@erp.com', 'secret-pass');
    expect(await screen.findByText('orders page')).toBeTruthy();
  });

  it("shows the API's error and stays on the page", async () => {
    login.mockRejectedValue({ response: { status: 401, data: { message: 'Invalid email or password' } } });
    renderLogin();
    await signIn('admin@erp.com', 'wrong');
    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy(); // re-enabled for another try
    expect(screen.queryByText('dashboard')).toBeNull();
  });

  it('skips the form when already signed in', () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'ADMIN' }, login });
    renderLogin();
    expect(screen.getByText('dashboard')).toBeTruthy();
  });
});
