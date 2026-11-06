const productModel = require('../models/product.model');
const inventoryService = require('../services/inventory.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// GET /api/products?search=&categoryId=&lowStock=true&page=1&limit=10
const list = asyncHandler(async (req, res) => {
  const { search, categoryId, lowStock, page = 1, limit = 10 } = req.query;
  const result = await productModel.list({
    search,
    categoryId,
    lowStock: lowStock === 'true',
    page: Number(page),
    limit: Number(limit),
  });
  res.json({ success: true, ...result });
});

const getOne = asyncHandler(async (req, res) => {
  const product = await productModel.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ success: true, data: product });
});

const create = asyncHandler(async (req, res) => {
  const id = await inventoryService.createProduct(req.body, req.user);
  res.status(201).json({ success: true, data: { id } });
});

const update = asyncHandler(async (req, res) => {
  await inventoryService.updateProduct(req.params.id, req.body);
  res.json({ success: true, message: 'Product updated' });
});

const remove = asyncHandler(async (req, res) => {
  await inventoryService.deleteProduct(req.params.id, req.user, req.ip);
  res.json({ success: true, message: 'Product deactivated' });
});

// POST /api/products/:id/stock  { type: 'IN'|'OUT', quantity, reference? }
const adjustStock = asyncHandler(async (req, res) => {
  const result = await inventoryService.adjustStock({
    productId: Number(req.params.id),
    type: req.body.type,
    quantity: Number(req.body.quantity),
    reference: req.body.reference,
    actor: req.user,
    ip: req.ip,
  });
  res.json({ success: true, data: result });
});

const transactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await productModel.listTransactions(req.params.id, {
    page: Number(page),
    limit: Number(limit),
  });
  // `data` kept for existing clients; rows/total/pages match the other lists.
  res.json({ success: true, data: result.rows, ...result });
});

const lowStock = asyncHandler(async (req, res) => {
  const rows = await productModel.listLowStock();
  res.json({ success: true, count: rows.length, data: rows });
});

// GET /api/products/insights/reorder?days=30&cover=30&leadTime=7
// status: OUT (none left), REORDER (below reorder level, or runs out within
// the supplier lead time), OK.
const reorder = asyncHandler(async (req, res) => {
  const { days = 30, cover = 30, leadTime = 7 } = req.query;
  const rows = await productModel.reorderPlan({ days, cover });
  const data = rows.map((r) => {
    const runsOut = r.days_of_stock !== null && Number(r.days_of_stock) < Number(leadTime);
    let status = 'OK';
    if (r.quantity === 0) status = 'OUT';
    else if (r.quantity < r.reorder_level || runsOut) status = 'REORDER';
    return {
      ...r,
      units_sold: Number(r.units_sold),
      daily_velocity: Number(r.daily_velocity),
      days_of_stock: r.days_of_stock === null ? null : Number(r.days_of_stock),
      suggested_qty: Number(r.suggested_qty),
      status,
    };
  });
  res.json({ success: true, params: { days: Number(days), cover: Number(cover), leadTime: Number(leadTime) }, data });
});

module.exports = { reorder, list, getOne, create, update, remove, adjustStock, transactions, lowStock };
