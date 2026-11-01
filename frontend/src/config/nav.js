// One source of truth for who may open which area. The sidebar and the route
// guards in App.jsx both read ACCESS, so a link can never point at a page its
// role is bounced from (or the reverse). The values mirror the backend's
// authorize() calls; the backend is still the real enforcement.
export const ACCESS = {
  dashboard: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'],
  inventory: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'],
  customers: ['ADMIN', 'MANAGER'],
  orders: ['ADMIN', 'MANAGER'],
  employees: ['ADMIN', 'HR', 'MANAGER'],
  departments: ['ADMIN', 'HR'],
};

export const NAV = [
  {
    section: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: 'dashboard', roles: ACCESS.dashboard }],
  },
  {
    section: 'Inventory',
    items: [{ to: '/inventory', label: 'Products', icon: 'box', roles: ACCESS.inventory }],
  },
  {
    section: 'Sales',
    items: [
      { to: '/orders', label: 'Orders', icon: 'receipt', roles: ACCESS.orders },
      { to: '/customers', label: 'Customers', icon: 'users', roles: ACCESS.customers },
    ],
  },
  {
    section: 'People',
    items: [
      { to: '/employees', label: 'Employees', icon: 'badge', roles: ACCESS.employees },
      { to: '/departments', label: 'Departments', icon: 'building', roles: ACCESS.departments },
    ],
  },
];

// Title shown in the top bar and the browser tab for each path.
const TITLES = [
  [/^\/$/, 'Dashboard'],
  [/^\/inventory/, 'Products'],
  [/^\/orders\/new/, 'New order'],
  [/^\/orders/, 'Orders'],
  [/^\/customers/, 'Customers'],
  [/^\/employees/, 'Employees'],
  [/^\/departments/, 'Departments'],
];

export const titleFor = (path) => TITLES.find(([re]) => re.test(path))?.[1] || 'Page not found';

// Navigation filtered to what this role can open; empty sections dropped.
export const navFor = (role) => NAV
  .map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(role)) }))
  .filter((s) => s.items.length > 0);
