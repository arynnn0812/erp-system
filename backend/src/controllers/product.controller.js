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
  const rows = await productModel.listTransactions(req.params.id, {
    page: Number(page),
    limit: Number(limit),
  });
  res.json({ success: true, data: rows });
});

const lowStock = asyncHandler(async (req, res) => {
  const rows = await productModel.listLowStock();
  res.json({ success: true, count: rows.length, data: rows });
});

module.exports = { list, getOne, create, update, remove, adjustStock, transactions, lowStock };
