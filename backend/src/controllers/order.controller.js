const orderModel = require('../models/order.model');
const orderService = require('../services/order.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { toCsv } = require('../utils/csv');

// GET /api/orders?from=&to=&status=&customerId=&page=&limit=
const list = asyncHandler(async (req, res) => {
  const { from, to, status, customerId, page = 1, limit = 10 } = req.query;
  const result = await orderModel.list({
    from, to, status, customerId,
    page: Number(page), limit: Number(limit),
  });
  res.json({ success: true, ...result });
});

const getOne = asyncHandler(async (req, res) => {
  const order = await orderModel.findById(req.params.id);
  if (!order) throw new ApiError(404, 'Order not found');
  res.json({ success: true, data: order });
});

// POST /api/orders  { customerId, items:[{productId, quantity}], taxPercent?, discount? }
const create = asyncHandler(async (req, res) => {
  const { customerId, items, taxPercent = 0, discount = 0 } = req.body;
  const result = await orderService.createOrder({
    customerId: Number(customerId),
    items,
    taxPercent: Number(taxPercent),
    discount: Number(discount),
    actor: req.user,
    ip: req.ip,
  });
  res.status(201).json({ success: true, data: result });
});

// POST /api/orders/:id/cancel
const cancel = asyncHandler(async (req, res) => {
  await orderService.cancelOrder({ orderId: Number(req.params.id), actor: req.user, ip: req.ip });
  res.json({ success: true, message: 'Order cancelled and stock restored' });
});

// GET /api/orders/reports/summary?from=&to=
const summary = asyncHandler(async (req, res) => {
  const data = await orderModel.salesSummary(req.query);
  res.json({ success: true, data });
});

// GET /api/orders/reports/top-products?from=&to=&limit=5
const top = asyncHandler(async (req, res) => {
  const { from, to, limit = 5 } = req.query;
  const data = await orderModel.topProducts({ from, to, limit: Number(limit) });
  res.json({ success: true, data });
});

// GET /api/orders/reports/daily?from=&to=
const daily = asyncHandler(async (req, res) => {
  const data = await orderModel.salesByDay(req.query);
  res.json({ success: true, data });
});

// GET /api/orders/reports/export?from=&to=  -> orders-<from>-to-<to>.csv
const exportCsv = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const rows = await orderModel.exportRows({ from, to });
  const csv = toCsv(rows, [
    ['id', 'Order #'], ['order_date', 'Date'], ['status', 'Status'], ['customer', 'Customer'],
    ['created_by', 'Created by'], ['units', 'Units'], ['subtotal', 'Subtotal'], ['tax', 'Tax'],
    ['discount', 'Discount'], ['grand_total', 'Total'],
  ]);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="orders-${from}-to-${to}.csv"`);
  res.send(`\uFEFF${csv}`); // BOM so Excel opens UTF-8 (₹, accented names) correctly
});

module.exports = { list, getOne, create, cancel, summary, top, daily, exportCsv };
