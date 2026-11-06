// One source of truth for who may open which area. The sidebar and the route
// guards in App.jsx both read ACCESS, so a link can never point at a page its
// role is bounced from (or the reverse). The values mirror the backend's
// authorize() calls; the backend is still the real enforcement.
const ALL = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];

export const ACCESS = {
  dashboard: ALL,
  inventory: ALL,
  reorder: ['ADMIN', 'MANAGER'],
  categories: ['ADMIN', 'MANAGER'],
  customers: ['ADMIN', 'MANAGER'],
  orders: ['ADMIN', 'MANAGER'],
  reports: ['ADMIN', 'MANAGER'],
  employees: ['ADMIN', 'HR', 'MANAGER'],
  departments: ['ADMIN', 'HR'],
  users: ['ADMIN'],
  audit: ['ADMIN'],
  profile: ALL,
};

export const NAV = [
  {
    section: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: 'dashboard', roles: ACCESS.dashboard }],
  },
  {
    section: 'Inventory',
    items: [
      { to: '/inventory', label: 'Products', icon: 'box', roles: ACCESS.inventory, end: true },
      { to: '/inventory/reorder', label: 'Reorder planner', icon: 'bolt', roles: ACCESS.reorder },
      { to: '/categories', label: 'Categories', icon: 'layers', roles: ACCESS.categories },
    ],
  },
  {
    section: 'Sales',
    items: [
      { to: '/orders', label: 'Orders', icon: 'receipt', roles: ACCESS.orders },
      { to: '/customers', label: 'Customers', icon: 'users', roles: ACCESS.customers },
      { to: '/reports', label: 'Reports', icon: 'chart', roles: ACCESS.reports },
    ],
  },
  {
    section: 'People',
    items: [
      { to: '/employees', label: 'Employees', icon: 'badge', roles: ACCESS.employees },
      { to: '/departments', label: 'Departments', icon: 'building', roles: ACCESS.departments },
    ],
  },
  {
    section: 'Administration',
    items: [
      { to: '/users', label: 'Users & access', icon: 'shield', roles: ACCESS.users },
      { to: '/audit', label: 'Audit log', icon: 'list', roles: ACCESS.audit },
    ],
  },
];

// Title shown in the top bar and the browser tab for each path.
const TITLES = [
  [/^\/$/, 'Dashboard'],
  [/^\/inventory\/reorder/, 'Reorder planner'],
  [/^\/inventory\/\d+/, 'Product'],
  [/^\/inventory/, 'Products'],
  [/^\/categories/, 'Categories'],
  [/^\/orders\/new/, 'New order'],
  [/^\/orders\/\d+/, 'Order'],
  [/^\/orders/, 'Orders'],
  [/^\/customers/, 'Customers'],
  [/^\/reports/, 'Reports'],
  [/^\/employees/, 'Employees'],
  [/^\/departments/, 'Departments'],
  [/^\/users/, 'Users & access'],
  [/^\/audit/, 'Audit log'],
  [/^\/profile/, 'My profile'],
];

export const titleFor = (path) => TITLES.find(([re]) => re.test(path))?.[1] || 'Page not found';

// Navigation filtered to what this role can open; empty sections dropped.
export const navFor = (role) => NAV
  .map((s) => ({ ...s, items: s.items.filter((i) => i.roles.includes(role)) }))
  .filter((s) => s.items.length > 0);

export const ROLE_LABEL = { ADMIN: 'Administrator', HR: 'HR', MANAGER: 'Manager', EMPLOYEE: 'Employee' };
