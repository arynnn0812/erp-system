// Role-aware dashboard: everyone gets a dashboard, but the numbers each
// role sees match what their role is allowed to know.
const dashboardModel = require('../models/dashboard.model');
const orderModel = require('../models/order.model');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/dashboard/summary
const summary = asyncHandler(async (req, res) => {
  const c = await dashboardModel.counters();
  const role = req.user.role;

  // Base view: inventory health - safe for every role.
  const data = {
    total_products: c.total_products,
    low_stock_count: c.low_stock_count,
  };

  // Sales numbers: ADMIN + MANAGER
  if (role === 'ADMIN' || role === 'MANAGER') {
    data.total_revenue = c.total_revenue;
    data.total_orders = c.total_orders;
    data.total_customers = c.total_customers;
  }

  // Workforce numbers: ADMIN + HR
  if (role === 'ADMIN' || role === 'HR') {
    data.total_employees = c.total_employees;
  }

  res.json({ success: true, role, data });
});

// GET /api/dashboard/sales-trend?months=6  (ADMIN, MANAGER)
const salesTrend = asyncHandler(async (req, res) => {
  const months = Math.min(Number(req.query.months) || 6, 24); // cap the range
  const data = await dashboardModel.monthlySalesTrend(months);
  res.json({ success: true, data });
});

// GET /api/dashboard/category-sales  (ADMIN, MANAGER)
const categories = asyncHandler(async (req, res) => {
  const data = await dashboardModel.categorySales();
  res.json({ success: true, data });
});

// GET /api/dashboard/top-products?limit=5  (ADMIN, MANAGER)
// Reuses the Phase 4 report query with a default 90-day window.
const topProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 5, 20);
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const data = await orderModel.topProducts({ from, to, limit });
  res.json({ success: true, window: { from, to }, data });
});

module.exports = { summary, salesTrend, categories, topProducts };
