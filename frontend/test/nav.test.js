// The sidebar and the route guards both read config/nav.js, so these lists are
// what each role can see and open in the UI. They mirror the backend's
// authorize() calls (which stay the real enforcement).
import { describe, it, expect } from 'vitest';
import { ACCESS, navFor, titleFor } from '../src/config/nav.js';

const labels = (role) => navFor(role).flatMap((s) => s.items.map((i) => i.label));

describe('navigation per role', () => {
  it('shows the admin everything', () => {
    expect(labels('ADMIN')).toEqual([
      'Dashboard', 'Products', 'Reorder planner', 'Categories', 'Orders', 'Customers', 'Reports',
      'Employees', 'Departments', 'Users & access', 'Audit log',
    ]);
  });

  it('keeps sales, staff and admin pages away from an employee', () => {
    expect(labels('EMPLOYEE')).toEqual(['Dashboard', 'Products']);
    expect(navFor('EMPLOYEE').map((s) => s.section)).toEqual(['Overview', 'Inventory']); // empty sections dropped
  });

  it('gives HR people pages but no sales', () => {
    expect(labels('HR')).toEqual(['Dashboard', 'Products', 'Employees', 'Departments']);
  });

  it('gives a manager stock and sales, employees read-only, no departments or admin', () => {
    expect(labels('MANAGER')).toEqual([
      'Dashboard', 'Products', 'Reorder planner', 'Categories', 'Orders', 'Customers', 'Reports', 'Employees',
    ]);
  });

  it('lists only known roles', () => {
    const roles = new Set(Object.values(ACCESS).flat());
    expect([...roles].sort()).toEqual(['ADMIN', 'EMPLOYEE', 'HR', 'MANAGER']);
  });
});

describe('titleFor', () => {
  it('matches the most specific path first', () => {
    expect(titleFor('/')).toBe('Dashboard');
    expect(titleFor('/inventory/reorder')).toBe('Reorder planner');
    expect(titleFor('/inventory/42')).toBe('Product');
    expect(titleFor('/orders/new')).toBe('New order');
    expect(titleFor('/orders/7')).toBe('Order');
    expect(titleFor('/nowhere')).toBe('Page not found');
  });
});
