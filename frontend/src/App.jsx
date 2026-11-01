// Route table. Every signed-in page renders inside AppShell; role lists come
// from config/nav.js, the same lists the sidebar uses.
import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './components/layout/AppShell.jsx';
import { ACCESS } from './config/nav.js';
import Login from './pages/Login.jsx';

// Each page is its own chunk, so the sign-in screen doesn't download the
// chart library and every page loads only what it uses.
const NotFound = lazy(() => import('./pages/NotFound.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Products = lazy(() => import('./pages/inventory/Products.jsx'));
const ProductDetail = lazy(() => import('./pages/inventory/ProductDetail.jsx'));
const Reorder = lazy(() => import('./pages/inventory/Reorder.jsx'));
const Categories = lazy(() => import('./pages/inventory/Categories.jsx'));
const Customers = lazy(() => import('./pages/sales/Customers.jsx'));
const Orders = lazy(() => import('./pages/sales/Orders.jsx'));
const OrderCreate = lazy(() => import('./pages/sales/OrderCreate.jsx'));
const OrderDetail = lazy(() => import('./pages/sales/OrderDetail.jsx'));
const Reports = lazy(() => import('./pages/sales/Reports.jsx'));
const Employees = lazy(() => import('./pages/hr/Employees.jsx'));
const Departments = lazy(() => import('./pages/hr/Departments.jsx'));
const Users = lazy(() => import('./pages/admin/Users.jsx'));
const AuditLog = lazy(() => import('./pages/admin/AuditLog.jsx'));

const guard = (roles, page) => <ProtectedRoute roles={roles}>{page}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="inventory" element={guard(ACCESS.inventory, <Products />)} />
        <Route path="inventory/reorder" element={guard(ACCESS.reorder, <Reorder />)} />
        <Route path="inventory/:id" element={guard(ACCESS.inventory, <ProductDetail />)} />
        <Route path="categories" element={guard(ACCESS.categories, <Categories />)} />
        <Route path="customers" element={guard(ACCESS.customers, <Customers />)} />
        <Route path="orders" element={guard(ACCESS.orders, <Orders />)} />
        <Route path="orders/new" element={guard(ACCESS.orders, <OrderCreate />)} />
        <Route path="orders/:id" element={guard(ACCESS.orders, <OrderDetail />)} />
        <Route path="reports" element={guard(ACCESS.reports, <Reports />)} />
        <Route path="employees" element={guard(ACCESS.employees, <Employees />)} />
        <Route path="departments" element={guard(ACCESS.departments, <Departments />)} />
        <Route path="users" element={guard(ACCESS.users, <Users />)} />
        <Route path="audit" element={guard(ACCESS.audit, <AuditLog />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
