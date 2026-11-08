// Dashboard: each role asks only for the figures it may see, and a live
// change event refetches them in place.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../src/pages/Dashboard.jsx';
import { ThemeProvider } from '../src/context/ThemeContext.jsx';
import api from '../src/api/axios.js';
import { useAuth } from '../src/context/AuthContext.jsx';
import { useLiveUpdates } from '../src/hooks/useLiveUpdates.js';

vi.mock('../src/api/axios.js', () => ({ default: { get: vi.fn() }, errMsg: () => 'error' }));
vi.mock('../src/context/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../src/hooks/useLiveUpdates.js', () => ({ useLiveUpdates: vi.fn() }));

const SUMMARY = {
  EMPLOYEE: { total_products: 17, low_stock_count: 0 },
  ADMIN: {
    total_products: 17, low_stock_count: 0, total_revenue: '7511836.00',
    total_orders: 131, total_customers: 10, total_employees: 10,
  },
};

function signInAs(role) {
  useAuth.mockReturnValue({
    user: { id: 1, name: `${role} User`, role },
    hasRole: (...roles) => roles.includes(role),
  });
}

// Every chart endpoint answers empty, so no chart has to render in jsdom.
function answer(summaryFor) {
  api.get.mockImplementation((url) => Promise.resolve({
    data: { data: url === '/dashboard/summary' ? summaryFor() : [] },
  }));
}

const renderDashboard = () => render(<ThemeProvider><MemoryRouter><Dashboard /></MemoryRouter></ThemeProvider>);
const requested = () => api.get.mock.calls.map(([url]) => url).sort();

describe('Dashboard', () => {
  beforeEach(() => {
    api.get.mockReset();
    useLiveUpdates.mockReset().mockReturnValue('live');
  });

  it('asks an employee-level role for the summary only, and shows no sales', async () => {
    signInAs('EMPLOYEE');
    answer(() => SUMMARY.EMPLOYEE);
    renderDashboard();

    expect(await screen.findByText('Active products')).toBeTruthy();
    expect(requested()).toEqual(['/dashboard/summary']);
    expect(screen.queryByText('Revenue')).toBeNull();
    expect(screen.queryByText('Employees')).toBeNull();
    expect(screen.queryByRole('link', { name: 'New order' })).toBeNull();
  });

  it('gives the admin every figure and the sales charts', async () => {
    signInAs('ADMIN');
    answer(() => SUMMARY.ADMIN);
    renderDashboard();

    expect(await screen.findByText('131')).toBeTruthy();
    expect(requested()).toEqual([
      '/dashboard/category-sales', '/dashboard/sales-trend', '/dashboard/summary', '/dashboard/top-products',
    ]);
    expect(screen.getByText('Employees')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'New order' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Live');
  });

  it('refetches everything in place when a live change arrives', async () => {
    signInAs('ADMIN');
    let orders = 131;
    answer(() => ({ ...SUMMARY.ADMIN, total_orders: orders }));
    renderDashboard();
    expect(await screen.findByText('131')).toBeTruthy();

    const onChange = useLiveUpdates.mock.calls.at(-1)[0];
    orders = 132;
    api.get.mockClear();
    await act(async () => onChange());

    expect(await screen.findByText('132')).toBeTruthy();
    expect(requested()).toHaveLength(4);
  });

  it('says when it has fallen back to polling', async () => {
    signInAs('EMPLOYEE');
    answer(() => SUMMARY.EMPLOYEE);
    useLiveUpdates.mockReturnValue('polling');
    renderDashboard();
    expect((await screen.findByRole('status')).textContent).toBe('Auto-refresh');
  });
});
