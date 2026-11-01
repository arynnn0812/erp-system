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
const Products = lazy(() => import('./pages/inventory/Products.jsx'));
const Customers = lazy(() => import('./pages/sales/Customers.jsx'));
const Orders = lazy(() => import('./pages/sales/Orders.jsx'));
const OrderCreate = lazy(() => import('./pages/sales/OrderCreate.jsx'));
const Employees = lazy(() => import('./pages/hr/Employees.jsx'));
const Departments = lazy(() => import('./pages/hr/Departments.jsx'));

const guard = (roles, page) => <ProtectedRoute roles={roles}>{page}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={guard(ACCESS.inventory, <Products />)} />
        <Route path="customers" element={guard(ACCESS.customers, <Customers />)} />
        <Route path="orders" element={guard(ACCESS.orders, <Orders />)} />
        <Route path="orders/new" element={guard(ACCESS.orders, <OrderCreate />)} />
        <Route path="employees" element={guard(ACCESS.employees, <Employees />)} />
        <Route path="departments" element={guard(ACCESS.departments, <Departments />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
