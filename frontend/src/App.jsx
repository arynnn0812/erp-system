// Route table. Role arrays here mirror the backend's authorize() calls -
// the backend is the enforcement, this just avoids showing locked doors.
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/inventory/Products.jsx';
import Customers from './pages/sales/Customers.jsx';
import Orders from './pages/sales/Orders.jsx';
import OrderCreate from './pages/sales/OrderCreate.jsx';
import Employees from './pages/hr/Employees.jsx';
import Departments from './pages/hr/Departments.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <div className="container">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/customers" element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}><Customers /></ProtectedRoute>} />
          <Route path="/orders" element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}><Orders /></ProtectedRoute>} />
          <Route path="/orders/new" element={
            <ProtectedRoute roles={['ADMIN', 'MANAGER']}><OrderCreate /></ProtectedRoute>} />
          <Route path="/employees" element={
            <ProtectedRoute roles={['ADMIN', 'HR', 'MANAGER']}><Employees /></ProtectedRoute>} />
          <Route path="/departments" element={
            <ProtectedRoute roles={['ADMIN', 'HR']}><Departments /></ProtectedRoute>} />
        </Routes>
      </div>
    </>
  );
}
